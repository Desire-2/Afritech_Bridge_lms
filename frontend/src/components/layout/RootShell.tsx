'use client'

import { Geist, Geist_Mono } from 'next/font/google'
import { ReactNode } from 'react'
import ClientLayout from '@/components/layout/ClientLayout'
import HydrationScript from '@/components/layout/HydrationScript'

// Define fonts outside of the component
const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin']
})

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin']
})

export default function RootShell({
  children
}: {
  children: ReactNode
}) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <head>
        <HydrationScript />
      </head>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`} suppressHydrationWarning>
        <ClientLayout>
          {children}
        </ClientLayout>
      </body>
    </html>
  )
}