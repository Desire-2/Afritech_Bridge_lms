'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'

export default function NotFound() {
  const { isAuthenticated, user, isLoading } = useAuth();
  const [destination, setDestination] = useState('/');
  const [buttonText, setButtonText] = useState('Return to Home');

  // Determine appropriate redirect based on authentication state
  useEffect(() => {
    console.log('404 page not found error occurred');
    
    if (!isLoading && isAuthenticated && user) {
      // Set destination based on user role
      switch (user.role) {
        case 'admin':
          setDestination('/admin/dashboard');
          setButtonText('Return to Admin Dashboard');
          break;
        case 'instructor':
          setDestination('/instructor/Dashboard');
          setButtonText('Return to Instructor Dashboard');
          break;
        case 'student':
          setDestination('/dashboard');
          setButtonText('Return to Student Dashboard');
          break;
        default:
          setDestination('/dashboard');
          setButtonText('Return to Dashboard');
          break;
      }
    } else {
      setDestination('/');
      setButtonText('Return to Home');
    }
  }, [isLoading, isAuthenticated, user]);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen px-4 text-center bg-gradient-to-br from-slate-900 to-slate-800 text-white">
      <div className="w-24 h-24 mb-6 rounded-full bg-red-500/20 flex items-center justify-center">
        <span className="text-5xl">🔍</span>
      </div>
      <h1 className="text-7xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-red-400 to-pink-600">404</h1>
      <h2 className="mt-4 text-3xl font-medium text-white">Page Not Found</h2>
      <p className="mt-4 text-lg text-slate-300 max-w-md">
        The page you are looking for doesn't exist or may have been moved.
      </p>
      <div className="mt-8 flex gap-4">
        <Link 
          href={destination} 
          className="px-6 py-3 text-base font-medium text-white transition-colors bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-600 hover:to-blue-700 rounded-lg shadow-lg"
        >
          {buttonText}
        </Link>
      </div>
    </div>
  )
}