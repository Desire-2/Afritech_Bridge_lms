import type { Metadata } from 'next'
import './globals.css'
import RootShell from '@/components/layout/RootShell'

// ...existing code...

export default function RootLayout({
  children
}: {
  children: React.ReactNode
}) {
  return <RootShell>{children}</RootShell>
}