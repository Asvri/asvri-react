import { AsvriCheckoutButton } from "@asvri/react"

export default function Home() {
  return (
    <main>
      <h1>Tote bag · ₦2,500</h1>
      {/* send the order id; the server decides the price */}
      <AsvriCheckoutButton endpoint="/api/checkout" body={{ orderId: "1042" }}>Pay ₦2,500</AsvriCheckoutButton>
    </main>
  )
}
