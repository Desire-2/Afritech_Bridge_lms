'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001/api/v1';

export default function ForgotPasswordForm() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const router = useRouter();

  // Define the response type
  type ForgotPasswordResponse = {
    message: string;
    status?: 'user_not_found' | 'email_sent' | 'email_error';
  };

  // Add state for resend timer
  const [canResend, setCanResend] = useState(true);
  const [resendTimer, setResendTimer] = useState(0);
  const [userNotFound, setUserNotFound] = useState(false);

  // Handle countdown timer for resend button
  useEffect(() => {
    if (resendTimer > 0) {
      const timer = setTimeout(() => {
        setResendTimer(resendTimer - 1);
      }, 1000);
      return () => clearTimeout(timer);
    } else if (resendTimer === 0 && !canResend) {
      setCanResend(true);
    }
  }, [resendTimer, canResend]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setUserNotFound(false);
    setIsSubmitting(true);
    
    // Basic email validation
    const emailRegex = /^[\w\.-]+@[\w\.-]+\.\w+$/;
    if (!emailRegex.test(email)) {
      setError('Please enter a valid email address');
      setIsSubmitting(false);
      return;
    }
    
    // Disable resend button and set timer if needed
    if (canResend) {
      setCanResend(false);
      setResendTimer(60); // 60 seconds = 1 minute
    }
    
    try {
      const response = await fetch(`${API_URL}/auth/forgot-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      });
      
      const data = await response.json() as ForgotPasswordResponse;
      
      if (response.ok) {
        setSuccess(data.message || 'Password reset link sent! Please check your email.');
        
        // Additional handling based on status
        if (data.status === 'email_sent') {
          console.log('Email sent successfully');
        } else if (data.status === 'email_error') {
          console.log('Email sending failed');
        }
      } else {
        // Handle user not found case separately
        if (response.status === 404 && data.status === 'user_not_found') {
          setUserNotFound(true);
          setError(data.message || 'No account found with this email address');
        } else {
          setError(data.message || 'An error occurred. Please try again.');
        }
      }
    } catch (err) {
      setError('Network error. Please try again later.');
      console.error('Forgot password error:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 to-slate-800">
      <div className="bg-white/5 backdrop-blur-sm p-8 rounded-2xl shadow-xl w-full max-w-md border border-white/10">
        {/* Company Logo */}
        <div className="flex items-center justify-center gap-3 mb-8">
          <svg 
            className="w-10 h-10 text-sky-400"
            viewBox="0 0 64 64" 
            fill="none" 
            xmlns="http://www.w3.org/2000/svg"
          >
            <path 
              d="M32 0L38.9282 24H25.0718L32 0ZM50.954 18L57.8822 42H44.0258L50.954 18ZM13.046 18L19.9742 42H6.11783L13.046 18ZM32 48L38.9282 72H25.0718L32 48Z" 
              fill="currentColor"
            />
          </svg>
          <h1 className="text-2xl font-bold text-white">Afritec Bridge LMS</h1>
        </div>

        {/* Form Title */}
        <h2 className="text-xl font-semibold text-center text-white mb-6">Reset your password</h2>
        
        {/* Error Message */}
        {error && (
          <div className="mb-4 p-3 bg-red-900/30 border border-red-500/50 text-red-200 rounded-lg">
            {error}
          </div>
        )}
        
        {/* Success Message */}
        {success && (
          <div className="mb-4 p-3 bg-green-900/30 border border-green-500/50 text-green-200 rounded-lg">
            {success}
          </div>
        )}
        
        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label 
              htmlFor="email" 
              className="block text-sm font-medium text-gray-200 mb-1"
            >
              Email Address
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:ring-2 focus:ring-sky-500 focus:border-transparent transition-all"
              placeholder="your@email.com"
            />
          </div>

          <div>
            <button
              type="submit"
              disabled={isSubmitting || (!canResend && !userNotFound)}
              className={`w-full py-2 px-4 rounded-lg font-medium text-white bg-sky-500 hover:bg-sky-600 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:ring-offset-2 focus:ring-offset-gray-900 transition-all ${
                (isSubmitting || (!canResend && !userNotFound)) ? 'opacity-70 cursor-not-allowed' : ''
              }`}
            >
              {isSubmitting 
                ? 'Sending...' 
                : userNotFound && canResend 
                ? 'Try Again' 
                : success 
                ? 'Email Sent!' 
                : 'Send Reset Link'}
            </button>
            
            {/* Countdown timer for resend */}
            {!canResend && resendTimer > 0 && (
              <div className="mt-2 text-center text-sm text-gray-300">
                You can request again in {resendTimer} seconds
              </div>
            )}
            
            {/* Specific message for user not found */}
            {userNotFound && (
              <div className="mt-2 text-center text-sm text-gray-300">
                If you don't have an account yet, you can{' '}
                <Link 
                  href="/auth/register" 
                  className="font-medium text-sky-400 hover:text-sky-300 underline-offset-4 hover:underline"
                >
                  register here
                </Link>
              </div>
            )}
          </div>
        </form>
        
        {/* Back to Login */}
        <div className="mt-6 text-center">
          <p className="text-sm text-gray-300">
            Remember your password?{' '}
            <Link 
              href="/auth/login" 
              className="font-medium text-sky-400 hover:text-sky-300 underline-offset-4 hover:underline"
            >
              Back to Login
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}