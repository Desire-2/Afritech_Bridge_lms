'use client';

import Link from 'next/link';
import { useEffect } from 'react';

export default function AuthNotFound() {
  useEffect(() => {
    console.log('Auth section 404 error occurred');
  }, []);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen px-4 text-center bg-gradient-to-br from-slate-900 to-slate-800 text-white">
      <div className="w-24 h-24 mb-6 rounded-full bg-blue-500/20 flex items-center justify-center">
        <span className="text-5xl">🔒</span>
      </div>
      <h1 className="text-7xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-sky-400 to-blue-600">404</h1>
      <h2 className="mt-4 text-3xl font-medium text-white">Authentication Page Not Found</h2>
      <p className="mt-4 text-lg text-slate-300 max-w-md">
        The authentication page you're looking for doesn't exist or may have been moved.
      </p>
      <div className="mt-8 flex gap-4">
        <Link 
          href="/auth/login" 
          className="px-6 py-3 text-base font-medium text-white transition-colors bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-600 hover:to-blue-700 rounded-lg shadow-lg"
        >
          Go to Login
        </Link>
        <Link 
          href="/auth/register" 
          className="px-6 py-3 text-base font-medium text-white border border-white/20 hover:bg-white/10 rounded-lg shadow transition-colors"
        >
          Create Account
        </Link>
      </div>
    </div>
  );
}