# ASVRI for React and Next.js

ASVRI Checkout in a React app: a button (or hook) that sends the customer to ASVRI's payment page, and server route handlers that create the checkout session and verify ASVRI's webhooks. Your secret key stays on your server.

React 18+. The server helpers work in Next.js route handlers (app router, Node runtime) or anything that speaks `Request`/`Response`. Built on the [ASVRI Node SDK](https://github.com/asvri/asvri-node).

## Install

```bash
npm install github:asvri/asvri-react
```

```dotenv
# .env.local
ASVRI_SECRET_KEY=sk_test_...       # ASVRI → Settings → API access
ASVRI_WEBHOOK_SECRET=whsec_...     # from registering your webhook endpoint (below)
```

## 1. The button

```tsx
import { AsvriCheckoutButton } from "@asvri/react"

<AsvriCheckoutButton endpoint="/api/checkout" body={{ orderId: order.id }} className="btn btn-primary">
  Pay $25
</AsvriCheckoutButton>
```

It posts `body` to your endpoint, then redirects to ASVRI's payment page. A double click starts one checkout. While it waits the button is disabled with `aria-busy` and `data-loading`. If your server refuses, the message shows under the button (`showError={false}` and `onError` to handle it yourself).

It is unstyled: pass `className`, and style `[data-asvri-error]`.

For your own UI, use the hook:

```tsx
const { start, loading, error } = useAsvriCheckout({ endpoint: "/api/checkout" })
<form onSubmit={(e) => { e.preventDefault(); start({ orderId }) }}>…</form>
```

## 2. Create the session on your server

```ts
// app/api/checkout/route.ts
import { createCheckoutRoute } from "@asvri/react/server"

export const POST = createCheckoutRoute<{ orderId: string }>(async ({ orderId }) => {
  const order = await db.orders.find(orderId)        // the price comes from YOUR data, never from the browser
  if (!order) throw new Error("No such order.")      // shown under the button
  return {
    amount: order.total,
    currency: "USD",
    reference: order.id,
    customer: { name: order.name, email: order.email },
    success_url: `${process.env.BASE_URL}/thanks`,   // ASVRI adds ?session_id=cs_…
    cancel_url: `${process.env.BASE_URL}/cart`,
    metadata: { order_id: order.id },
    idempotencyKey: `order-${order.id}`,             // one session per order
  }
})
```

## 3. Confirm the payment

On the thank-you page, **ask ASVRI**. Never trust the redirect alone:

```tsx
// app/thanks/page.tsx
import { retrieveCheckoutSession } from "@asvri/react/server"

export default async function Thanks({ searchParams }: { searchParams: Promise<{ session_id?: string }> }) {
  const session = await retrieveCheckoutSession((await searchParams).session_id ?? "")
  return session?.status === "paid" ? <p>Paid. Thank you!</p> : <p>We haven't received your payment yet.</p>
}
```

And fulfil orders from the webhook, which arrives even if the customer closes the tab:

```ts
// app/api/asvri-webhook/route.ts
import { createWebhookRoute } from "@asvri/react/server"

export const POST = createWebhookRoute({
  "checkout.session.completed": async (event) => {
    const session = event.data.checkout_session        // typed
    await db.orders.markPaid(session.metadata?.order_id, session.payment?.gateway_reference)
  },
  "*": async (event) => { /* every event type */ },
})
```

How it answers:

- **Bad signature, or an event older than 5 minutes:** 400.
- **A handler that throws:** 500, so ASVRI retries later with the same `event.id`. Make handlers safe to run twice.
- **Test mode:** `event.test` is `true` for test-mode events.

Register the endpoint once, for example with the Node SDK:

```js
import Asvri from "asvri"
const endpoint = await new Asvri(process.env.ASVRI_SECRET_KEY).webhookEndpoints.create({ url: "https://yourshop.com/api/asvri-webhook" })
console.log(endpoint.secret)   // → ASVRI_WEBHOOK_SECRET
```

## Anything else

`@asvri/react/server` re-exports the Node SDK client: `getAsvri()` returns one configured from `ASVRI_SECRET_KEY`, for refunds, listing sessions and so on.

```ts
import { getAsvri } from "@asvri/react/server"
await getAsvri().refunds.create({ session: "cs_live_…", amount: 1000 })
```

A complete Next.js app is in [`examples/next-app`](examples/next-app).

## Links

- API reference: https://www.asvri.com/developers/docs
- API playground: https://www.asvri.com/api-playground

MIT licence.
