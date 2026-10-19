export const metadata = { title: "ASVRI React test shop" }
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="en"><body style={{ fontFamily: "system-ui", padding: 32 }}>{children}</body></html>
}
