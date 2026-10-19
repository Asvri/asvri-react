import { AsvriCheckoutButton } from "@asvri/react"

export default function Home() {
  return (
    <main>
      <h1>Tote bag · $25</h1>
      {/* send the order id; the server decides the price */}
      <AsvriCheckoutButton endpoint="/api/checkout" body={{ orderId: "1042" }}>Pay $25</AsvriCheckoutButton>
    </main>
  )
}
