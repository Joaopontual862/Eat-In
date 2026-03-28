// src/app/layout.tsx
import './globals.css' // Importa o CSS global
import { Inter } from 'next/font/google'

const inter = Inter({ subsets: ['latin'], weight: ['400','500','600'] })

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt" className={inter.className}>
      <body>{children}</body>
    </html>
  )
}