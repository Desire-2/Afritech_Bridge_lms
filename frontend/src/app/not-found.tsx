'use client'

import Link from 'next/link'
import { useEffect } from 'react'

export default function NotFound() {
  // Log the 404 error
  useEffect(() => {
    console.log('404 page not found error occurred')
  }, [])

  return (
    <div className="flex flex-col items-center justify-center min-h-screen px-4 text-center bg-background">
      <h1 className="text-6xl font-bold text-primary">404</h1>
      <h2 className="mt-4 text-2xl font-medium text-foreground">Page Not Found</h2>
      <p className="mt-2 text-muted-foreground">
        The page you are looking for doesn't exist or has been moved.
      </p>
      <div className="mt-8">
        <Link href="/" className="px-4 py-2 text-sm font-medium text-white transition-colors bg-primary rounded-md hover:bg-primary/90">
          Return to Home
        </Link>
      </div>
    </div>
  )
}