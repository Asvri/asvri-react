"use client"

// The browser side of ASVRI Checkout: a button (or a hook) that asks YOUR server for a checkout session and sends the
// customer to ASVRI's payment page. The secret key stays on your server (see @asvri/react/server).

import { useCallback, useRef, useState, type ButtonHTMLAttributes, type ReactNode } from "react"

export interface UseAsvriCheckoutOptions {
  /** Your route that creates the session and answers { url } (createCheckoutRoute from @asvri/react/server). Default "/api/checkout". */
  endpoint?: string
  /** Extra fetch options for that call (headers, credentials…). */
  init?: Omit<RequestInit, "method" | "body">
  /** Called instead of the redirect, with the session's url (for a custom flow). */
  onRedirect?: (url: string) => void
  onError?: (error: Error) => void
}

export interface AsvriCheckoutState {
  /** Ask your server for a session (posting body as JSON) and go to it. Resolves false when it failed. */
  start: (body?: unknown) => Promise<boolean>
  loading: boolean
  error: Error | null
}

/** The checkout flow without a UI: wire start() to any button or form. */
export function useAsvriCheckout(options: UseAsvriCheckoutOptions = {}): AsvriCheckoutState {
  const { endpoint = "/api/checkout", init, onRedirect, onError } = options
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  const busy = useRef(false)

  const start = useCallback(async (body?: unknown) => {
    if (busy.current) return false // a double click starts one checkout, not two
    busy.current = true
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(endpoint, {
        ...init,
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json", ...(init?.headers ?? {}) },
        body: JSON.stringify(body ?? {}),
      })
      const data = (await res.json().catch(() => null)) as { url?: string; error?: string } | null
      if (!res.ok || !data?.url) throw new Error(data?.error || `Checkout could not start (HTTP ${res.status}).`)
      if (!/^https?:\/\//.test(data.url)) throw new Error("The checkout endpoint answered without a payment URL.")
      if (onRedirect) onRedirect(data.url)
      else window.location.assign(data.url)
      // the page is leaving: stay "loading" so the button can't be pressed again on the way out
      return true
    } catch (e) {
      const err = e instanceof Error ? e : new Error(String(e))
      setError(err)
      setLoading(false)
      busy.current = false
      onError?.(err)
      return false
    }
  }, [endpoint, init, onRedirect, onError])

  return { start, loading, error }
}

export interface AsvriCheckoutButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "onClick" | "onError">, UseAsvriCheckoutOptions {
  /** Sent to your endpoint as JSON (an order id, a cart…). Never send prices you'd trust: work them out on the server. */
  body?: unknown
  children?: ReactNode
  /** Shown while the session is being made. Default "Redirecting to payment…". */
  loadingText?: ReactNode
  /** Show the error under the button. Default true; set false to handle it with onError. */
  showError?: boolean
}

/**
 * A button that starts ASVRI Checkout. Unstyled: pass className (it gets data-loading while busy).
 *
 *   <AsvriCheckoutButton endpoint="/api/checkout" body={{ orderId: "1042" }} className="btn">Pay ₦2,500</AsvriCheckoutButton>
 */
export function AsvriCheckoutButton({ endpoint, init, onRedirect, onError, body, children = "Pay now", loadingText = "Redirecting to payment…", showError = true, disabled, type = "button", ...rest }: AsvriCheckoutButtonProps) {
  const { start, loading, error } = useAsvriCheckout({ endpoint, init, onRedirect, onError })
  return (
    <>
      <button {...rest} type={type} disabled={disabled || loading} aria-busy={loading || undefined} data-loading={loading || undefined} onClick={() => void start(body)}>
        {loading ? loadingText : children}
      </button>
      {showError && error ? <p role="alert" data-asvri-error="">{error.message}</p> : null}
    </>
  )
}
