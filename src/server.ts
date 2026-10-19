// The server side, for Next.js route handlers (app router) or anything that speaks Request/Response. Uses the ASVRI
// Node SDK; the secret key never reaches the browser.
//
//   // app/api/checkout/route.ts
//   export const POST = createCheckoutRoute(async (body) => {
//     const order = await getOrder(body.orderId)                    // work the price out here, not in the browser
//     return { amount: order.total, currency: "USD", reference: order.id, success_url: `${BASE}/thanks`, idempotencyKey: `order-${order.id}` }
//   })
//
//   // app/api/asvri-webhook/route.ts
//   export const POST = createWebhookRoute({ "checkout.session.completed": async (event) => markPaid(event.data.checkout_session) })

import Asvri, { ApiError, ConnectionError, constructEvent, type CheckoutSession, type CheckoutSessionCreateParams, type ClientOptions, type WebhookEvent } from "asvri"

export { Asvri }
export type { CheckoutSession, WebhookEvent }

export interface ServerOptions extends ClientOptions {
  /** Default: process.env.ASVRI_SECRET_KEY. */
  secretKey?: string
}

let shared: { key: string; client: Asvri } | null = null

/** One client per secret key for the process. */
export function getAsvri(options: ServerOptions = {}): Asvri {
  const key = options.secretKey ?? process.env.ASVRI_SECRET_KEY ?? ""
  const opts: ClientOptions = { apiBase: options.apiBase ?? process.env.ASVRI_API_BASE, apiExt: options.apiExt ?? process.env.ASVRI_API_EXT, timeout: options.timeout, maxRetries: options.maxRetries, fetch: options.fetch }
  if (shared?.key === key && !options.apiBase && !options.fetch) return shared.client
  const client = new Asvri(key, opts)
  shared = { key, client }
  return client
}

export type SessionRequest = CheckoutSessionCreateParams & {
  /** The same key returns the same session (a double click, a retry): use your order id. */
  idempotencyKey?: string
}

const json = (status: number, data: unknown) => new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } })

/**
 * POST handler: reads the JSON body the button sent, asks build() for the session (amount, currency, URLs…), creates
 * it, and answers { id, url }. Throw from build() (or return null) to refuse, e.g. an unknown order.
 */
export function createCheckoutRoute<B = Record<string, unknown>>(
  build: (body: B, request: Request) => Promise<SessionRequest | null> | SessionRequest | null,
  options: ServerOptions = {},
): (request: Request) => Promise<Response> {
  return async (request: Request) => {
    let body: B
    try {
      body = (await request.json()) as B
    } catch {
      body = {} as B
    }
    let params: SessionRequest | null
    try {
      params = await build(body, request)
    } catch (e) {
      return json(400, { error: e instanceof Error ? e.message : "This checkout can't be started." })
    }
    if (!params) return json(400, { error: "This checkout can't be started." })
    const { idempotencyKey, ...session } = params
    try {
      const created = await getAsvri(options).checkoutSessions.create(session, { idempotencyKey })
      return json(200, { id: created.id, url: created.url })
    } catch (e) {
      // ASVRI's message for a bad request is safe and useful to show; anything else stays generic
      if (e instanceof ApiError && e.status < 500 && e.status !== 401) return json(400, { error: e.message, param: e.param })
      console.error("[asvri] checkout session failed:", e)
      return json(e instanceof ConnectionError ? 503 : 502, { error: "Payment is unavailable right now. Please try again." })
    }
  }
}

export type WebhookHandlers = {
  [type: string]: ((event: WebhookEvent<any>) => unknown | Promise<unknown>) | undefined
} & {
  "checkout.session.completed"?: (event: WebhookEvent<{ checkout_session: CheckoutSession }>) => unknown | Promise<unknown>
  "checkout.session.expired"?: (event: WebhookEvent<{ checkout_session: CheckoutSession }>) => unknown | Promise<unknown>
  /** Every verified event, after its own handler. */
  "*"?: (event: WebhookEvent) => unknown | Promise<unknown>
}

export interface WebhookRouteOptions {
  /** Default: process.env.ASVRI_WEBHOOK_SECRET. */
  secret?: string
  /** Seconds an event may be old. Default 300. */
  tolerance?: number
}

/**
 * POST handler for ASVRI's webhook: checks the signature on the raw body, runs the handler for the event's type (and
 * "*"), answers 200. A bad signature gets 400; a handler that throws gets 500, so ASVRI retries it later (with the same
 * event id: make handlers safe to run twice).
 */
export function createWebhookRoute(handlers: WebhookHandlers, options: WebhookRouteOptions = {}): (request: Request) => Promise<Response> {
  return async (request: Request) => {
    const secret = options.secret ?? process.env.ASVRI_WEBHOOK_SECRET ?? ""
    if (!secret) {
      console.error("[asvri] webhook received but ASVRI_WEBHOOK_SECRET is not set")
      return new Response("Webhook secret not configured.", { status: 500 })
    }
    const raw = await request.text()
    let event: WebhookEvent
    try {
      event = constructEvent(raw, request.headers.get("asvri-signature"), secret, options.tolerance)
    } catch (e) {
      return new Response(e instanceof Error ? e.message : "Bad signature.", { status: 400 })
    }
    try {
      await handlers[event.type]?.(event as never)
      await handlers["*"]?.(event)
    } catch (e) {
      console.error(`[asvri] webhook handler for ${event.type} failed:`, e)
      return new Response("Handler failed; ASVRI will retry.", { status: 500 })
    }
    return new Response("ok", { status: 200 })
  }
}

/** For a thank-you page (server component): is this session paid, according to ASVRI? */
export async function retrieveCheckoutSession(sessionId: string, options: ServerOptions = {}): Promise<CheckoutSession | null> {
  if (!/^cs_(test|live)_[a-f0-9]{16,}$/.test(sessionId)) return null
  try {
    return await getAsvri(options).checkoutSessions.retrieve(sessionId)
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) return null
    throw e
  }
}
