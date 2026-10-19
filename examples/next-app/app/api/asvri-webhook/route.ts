import { createWebhookRoute } from "@asvri/react/server"

export const POST = createWebhookRoute({
  "checkout.session.completed": async (event) => {
    const session = event.data.checkout_session
    console.log("paid:", session.metadata?.order_id, session.payment?.gateway_reference)
    // mark the order paid here; handle each event.id once (ASVRI retries with the same id)
  },
})
