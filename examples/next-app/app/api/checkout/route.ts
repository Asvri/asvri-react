import { createCheckoutRoute } from "@asvri/react/server"

// your orders live in your database; this stands in for it
const ORDERS: Record<string, { total: number }> = { "1042": { total: 25 } }
const BASE = process.env.BASE_URL ?? "http://localhost:3000"

export const POST = createCheckoutRoute<{ orderId?: string }>(async ({ orderId }) => {
  const order = orderId ? ORDERS[orderId] : undefined
  if (!order) throw new Error("No such order.")
  return {
    amount: order.total,
    currency: "USD",
    reference: orderId,
    success_url: `${BASE}/thanks`,
    cancel_url: BASE,
    metadata: { order_id: String(orderId) },
    idempotencyKey: `order-${orderId}`,
  }
})
