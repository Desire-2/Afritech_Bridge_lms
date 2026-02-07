'use client'

import { AuthProvider } from '@/contexts/AuthContext'
import { MaintenanceModeWrapper } from '@/components/MaintenanceModeWrapper'
import { Toaster } from 'sonner'

export default function ClientLayout({
  children
}: {
  children: React.ReactNode
}) {
  return (
    <AuthProvider>
      <MaintenanceModeWrapper>
        {children}
      </MaintenanceModeWrapper>
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