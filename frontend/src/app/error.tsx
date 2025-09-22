'use client'

import { useEffect } from 'react'
import Link from 'next/link'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // Log the error to an error reporting service
    console.error('Application error:', error)
  }, [error])

  return (
    <div className="flex flex-col items-center justify-center min-h-screen px-4 text-center bg-background">
      <h1 className="text-6xl font-bold text-destructive">Error</h1>
      <h2 className="mt-4 text-2xl font-medium text-foreground">Something went wrong!</h2>
      <p className="mt-2 text-muted-foreground">
        {error.message || 'An unexpected error occurred'}
      </p>
      <div className="flex gap-4 mt-8">
        <button
          onClick={reset}
          className="px-4 py-2 text-sm font-medium text-white transition-colors bg-primary rounded-md hover:bg-primary/90"
        >
          Try again
        </button>
        <Link href="/" className="px-4 py-2 text-sm font-medium transition-colors border rounded-md border-input hover:bg-accent hover:text-accent-foreground">
          Return to Home
        </Link>
      </div>
    </div>
  )
}