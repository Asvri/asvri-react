import { retrieveCheckoutSession } from "@asvri/react/server"

export default async function Thanks({ searchParams }: { searchParams: Promise<{ session_id?: string }> }) {
  const { session_id = "" } = await searchParams
  const session = await retrieveCheckoutSession(session_id)
  return <main><h1 id="result">{session?.status === "paid" ? `PAID ${session.id} via ${session.payment?.gateway_name}` : `NOT PAID ${session_id}`}</h1></main>
}
