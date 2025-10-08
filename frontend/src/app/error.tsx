'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useAuth } from '@/contexts/AuthContext'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const { isAuthenticated, user, isLoading } = useAuth();
  const [destination, setDestination] = useState('/');
  const [buttonText, setButtonText] = useState('Return to Home');

  useEffect(() => {
    // Log the error to an error reporting service
    console.error('Application error:', error);
    
    // Set appropriate destination based on authentication state
    if (!isLoading && isAuthenticated && user) {
      // Set destination based on user role
      switch (user.role) {
        case 'admin':
          setDestination('/admin/dashboard');
          setButtonText('Return to Admin Dashboard');
          break;
        case 'instructor':
          setDestination('/instructor/dashboard');
          setButtonText('Return to Instructor Dashboard');
          break;
        case 'student':
          setDestination('/student/dashboard');
          setButtonText('Return to Student Dashboard');
          break;
        default:
          setDestination('/student/dashboard');
          setButtonText('Return to Dashboard');
          break;
      }
    } else {
      setDestination('/');
      setButtonText('Return to Home');
    }
  }, [error, isLoading, isAuthenticated, user]);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen px-4 text-center bg-gradient-to-br from-slate-900 to-slate-800 text-white">
      <div className="w-24 h-24 mb-6 rounded-full bg-amber-500/20 flex items-center justify-center">
        <span className="text-5xl">⚠️</span>
      </div>
      <h1 className="text-6xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-red-500">Error</h1>
      <h2 className="mt-4 text-3xl font-medium text-white">Something went wrong!</h2>
      <p className="mt-4 text-lg text-slate-300 max-w-md">
        {error.message || 'An unexpected error occurred'}
      </p>
      <div className="flex gap-4 mt-8">
        <button
          onClick={reset}
          className="px-6 py-3 text-base font-medium text-white transition-colors bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 rounded-lg shadow-lg"
        >
          Try again
        </button>
        <Link 
          href={destination} 
          className="px-6 py-3 text-base font-medium text-white border border-white/20 hover:bg-white/10 rounded-lg shadow transition-colors"
        >
          {buttonText}
        </Link>
      </div>
    </div>
  )
}