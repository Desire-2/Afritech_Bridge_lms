'use client'

import { useEffect } from 'react'
import { AuthProvider } from '@/contexts/AuthContext'
import { MaintenanceModeWrapper } from '@/components/MaintenanceModeWrapper'
import ErrorBoundary from '@/components/ErrorBoundary'
import { Toaster } from 'sonner'

export default function ClientLayout({
  children
}: {
  children: React.ReactNode
}) {
  // ── Global chunk-loading error recovery ──
  useEffect(() => {
    function handleScriptError(event: ErrorEvent) {
      const msg = (event.error?.message || event.message || '').toLowerCase()
      if (
        msg.includes('failed to load') ||
        msg.includes('loading chunk') ||
        msg.includes('chunkloaderror') ||
        /src_[a-f0-9]+\._/.test(msg)
      ) {
        console.warn('🚀 New deployment detected — reloading app')
        window.location.reload()
      }
    }

    window.addEventListener('error', handleScriptError)
    return () => window.removeEventListener('error', handleScriptError)
  }, [])

  return (
    <ErrorBoundary>
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
    </ErrorBoundary>
  )
}