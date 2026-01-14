import './globals.css'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'GALACTIC CAPTCHA: PROTOCOL',
  description: 'Prove your intelligence through mathematical challenges',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
