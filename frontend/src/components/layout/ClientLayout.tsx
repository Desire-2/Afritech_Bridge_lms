'use client'

import { AuthProvider } from '@/contexts/AuthContext'
import { Toaster } from 'sonner'

export default function ClientLayout({
  children
}: {
  children: React.ReactNode
}) {
  return (
    <AuthProvider>
      {children}
      <Toaster 
        position="top-right"
        richColors
        closeButton
        expand={false}
        duration={4000}
      />
    </AuthProvider>
  )
}