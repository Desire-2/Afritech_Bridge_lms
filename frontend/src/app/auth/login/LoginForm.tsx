'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { useIsClient, ClientOnly } from '@/lib/hydration-helper';
import { ApiErrorHandler } from '@/lib/error-handler';
import { RolePermissions } from '@/lib/permissions';
import { ChangePasswordModal } from '@/components/auth/ChangePasswordModal';

export default function LoginForm() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { isAuthenticated, login, isLoading, user, logout } = useAuth();
  const isClient = useIsClient();
  
  const registrationSuccess = searchParams.get('registered') === 'true';
  const resetSuccess = searchParams.get('reset') === 'success';
  const message = searchParams.get('message');
  const forceLogin = searchParams.get('force') === 'true'; // Allow force login
  const redirectPath = searchParams.get('redirect'); // Get redirect path from URL

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [authCheckTimeout, setAuthCheckTimeout] = useState<number>(0);
  const [initialAuthCheckComplete, setInitialAuthCheckComplete] = useState(false);
  const [showPasswordChangeModal, setShowPasswordChangeModal] = useState(false);
  const [pendingRedirect, setPendingRedirect] = useState<string | null>(null);

  
  // Validation states
  const [identifierTouched, setIdentifierTouched] = useState(false);
  const [passwordTouched, setPasswordTouched] = useState(false);
  const [validationErrors, setValidationErrors] = useState<{
    identifier?: string;
    password?: string;
  }>({});

  // Check initial authentication state on mount
  useEffect(() => {
    if (isClient && !isLoading && !initialAuthCheckComplete) {
      setInitialAuthCheckComplete(true);
      
      // If user is authenticated but on login page, they might want to login as different user
      if (isAuthenticated && user) {
        console.log('LoginForm: User already authenticated. Show option to continue or logout.');
        // Don't redirect immediately - let them choose
      } else {
        console.log('LoginForm: User not authenticated, showing login form');
      }
    }
  }, [isClient, isLoading, isAuthenticated, user, initialAuthCheckComplete]);

  // Validation functions with proper client-side checks
  const validateIdentifier = (value: string): string | undefined => {
    if (!value.trim()) {
      return 'Email or username is required';
    }
    
    // If it contains @, validate as email format
    if (value.includes('@')) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(value)) {
        return 'Please enter a valid email address';
      }
    }
    // For usernames, just check it's not empty (already checked above)
    
    return undefined;
  };

  const validatePassword = (value: string): string | undefined => {
    if (!value) {
      return 'Password is required';
    }
    if (value.length < 3) {
      return 'Password must be at least 3 characters long';
    }
    return undefined;
  };

  // Real-time validation with immediate feedback
  useEffect(() => {
    if (identifierTouched) {
      const identifierError = validateIdentifier(identifier);
      setValidationErrors(prev => ({ 
        ...prev, 
        identifier: identifierError 
      }));
      
      // Only clear validation errors, not authentication errors
      // Authentication errors should persist until user tries to login again
    }
  }, [identifier, identifierTouched]);

  useEffect(() => {
    if (passwordTouched) {
      const passwordError = validatePassword(password);
      setValidationErrors(prev => ({ 
        ...prev, 
        password: passwordError 
      }));
      
      // Only clear validation errors, not authentication errors
      // Authentication errors should persist until user tries to login again
    }
  }, [password, passwordTouched]);
  
  // If already authenticated, redirect to appropriate dashboard
  useEffect(() => {
    // Start auth check timeout
    if (isLoading && authCheckTimeout === 0) {
      setAuthCheckTimeout(Date.now());
    }

    // Check for excessive auth loading time
    if (isLoading && authCheckTimeout > 0) {
      const elapsed = Date.now() - authCheckTimeout;
      if (elapsed > 12000) { // 12 seconds timeout
        console.warn('LoginForm: Auth check timeout, forcing logout');
        logout();
        setError('Authentication check timed out. Please try again.');
        setAuthCheckTimeout(0);
        return;
      }
    }

    // Reset timeout when loading completes
    if (!isLoading && authCheckTimeout > 0) {
      setAuthCheckTimeout(0);
    }

    // GuestGuard will handle the redirect, so we don't need to do it here
    // Just log the state
    if (isClient && isAuthenticated && !isLoading && user) {
      console.log(`LoginForm: User authenticated as ${user.role}, GuestGuard will handle redirect`);
    }
  }, [isClient, isAuthenticated, isLoading, user, logout, authCheckTimeout]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    setIsSubmitting(true);

    // Mark fields as touched for validation
    setIdentifierTouched(true);
    setPasswordTouched(true);

    // Validate all fields before sending request
    const identifierError = validateIdentifier(identifier);
    const passwordError = validatePassword(password);

    // If there are validation errors, show them immediately and don't send request
    if (identifierError || passwordError) {
      setValidationErrors({
        identifier: identifierError,
        password: passwordError,
      });
      
      // Set a general error message for immediate feedback
      const errorMessages = [];
      if (identifierError) errorMessages.push(identifierError);
      if (passwordError) errorMessages.push(passwordError);
      setError(errorMessages.join('. '));
      
      setIsSubmitting(false);
      return;
    }

    // Clear validation errors and existing error only when starting new submission
    setValidationErrors({});
    setError(''); // Clear previous errors before new attempt
    setSuccessMessage(''); // Clear any success messages

    try {
      console.log('LoginForm: Submitting login request');
      
      // Add timeout to login request
      const loginPromise = login(identifier, password);
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Login request timed out')), 15000)
      );
      
      const authData = await Promise.race([loginPromise, timeoutPromise]) as any;
      
      console.log('LoginForm: Login successful');
      
      // Check if password change is required
      if (authData.must_change_password || authData.user.must_change_password) {
        console.log('LoginForm: Password change required, showing modal');
        
        // Determine where to redirect after password change
        let targetRoute = '/student/dashboard'; // Default fallback
        
        if (redirectPath && !redirectPath.includes('/auth/')) {
          targetRoute = redirectPath;
        } else {
          targetRoute = RolePermissions.getDashboardRoute(authData.user.role);
        }
        
        setPendingRedirect(targetRoute);
        setShowPasswordChangeModal(true);
        setIsSubmitting(false);
        return;
      }
      
      // Determine where to redirect after login
      let targetRoute = '/student/dashboard'; // Default fallback
      
      if (authData && authData.user) {
        // If there's a redirect parameter, use it (unless it's a login/auth page)
        if (redirectPath && !redirectPath.includes('/auth/')) {
          targetRoute = redirectPath;
          console.log(`LoginForm: Redirecting to saved path: ${targetRoute}`);
        } else {
          // Otherwise use the role-based dashboard
          targetRoute = RolePermissions.getDashboardRoute(authData.user.role);
          console.log(`LoginForm: Redirecting ${authData.user.role} to ${targetRoute}`);
        }
      } else if (redirectPath && !redirectPath.includes('/auth/')) {
        // If we have a redirect path but no user data, use the redirect
        targetRoute = redirectPath;
        console.log(`LoginForm: Redirecting to saved path (no user data): ${targetRoute}`);
      }
      
      // Use router.push for client-side navigation to preserve React state
      // Add a small delay to ensure state has updated
      setTimeout(() => {
        router.push(targetRoute);
      }, 200);
      
    } catch (err: any) {
      console.error('Login submission error:', err);
      
      // Handle timeout error
      if (err.message === 'Login request timed out') {
        setError('Login request timed out. Please check your connection and try again.');
        return;
      }
      
      // Use the error handler to get user-friendly messages
      let errorMessage = 'Login failed. Please try again.';
      
      if (err.error_type === 'authentication_error' || err.status === 401) {
        // Handle authentication-specific errors
        errorMessage = ApiErrorHandler.getLoginErrorMessage(err);
      } else if (err.error_type === 'validation_error' || err.status === 400 || err.status === 422) {
        // Handle validation errors
        errorMessage = ApiErrorHandler.getLoginErrorMessage(err);
      } else if (err.status === 500) {
        errorMessage = 'Server error. Please try again later or contact support if the problem persists.';
      } else if (err.status === 503) {
        errorMessage = 'Service temporarily unavailable. Please try again in a few moments.';
      } else if (!err.status && !err.response) {
        // Network error
        errorMessage = 'Unable to connect to the server. Please check your internet connection.';
      } else {
        // Use the error message from the API or error handler
        errorMessage = err.message || errorMessage;
      }
      
      setError(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };



  return (
    <ClientOnly fallback={
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 to-slate-800">
        <div className="bg-white/5 backdrop-blur-sm p-8 rounded-2xl shadow-xl w-full max-w-md border border-white/10">
          <div className="animate-pulse space-y-6">
            <div className="h-8 bg-white/10 rounded"></div>
            <div className="h-12 bg-white/10 rounded"></div>
            <div className="h-12 bg-white/10 rounded"></div>
            <div className="h-12 bg-white/10 rounded"></div>
          </div>
        </div>
      </div>
    }>
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
          <span className="text-2xl font-bold bg-gradient-to-r from-sky-400 to-blue-500 bg-clip-text text-transparent">
            Afritec Bridge
          </span>
        </div>

        <h2 className="text-3xl font-bold mb-8 text-center text-white">Welcome Back</h2>
        
        {/* Success Messages */}
        {registrationSuccess && (
          <div className="bg-emerald-500/20 border border-emerald-500/30 rounded-lg mb-6 overflow-hidden">
            <div className="flex items-start gap-3 p-4">
              <svg className="w-5 h-5 text-emerald-300 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/>
              </svg>
              <div className="flex-1">
                <p className="text-emerald-100 text-sm font-medium">
                  🎉 Account created successfully!
                </p>
                <p className="text-emerald-200/70 text-xs mt-1">
                  Welcome to Afritec Bridge! Please log in with your credentials to get started.
                </p>
              </div>
            </div>
          </div>
        )}
        
        {resetSuccess && (
          <div className="bg-emerald-500/20 border border-emerald-500/30 rounded-lg mb-6 overflow-hidden">
            <div className="flex items-start gap-3 p-4">
              <svg className="w-5 h-5 text-emerald-300 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/>
              </svg>
              <div className="flex-1">
                <p className="text-emerald-100 text-sm font-medium">
                  ✅ Password reset successful!
                </p>
                <p className="text-emerald-200/70 text-xs mt-1">
                  You can now log in with your new password.
                </p>
              </div>
            </div>
          </div>
        )}
        
        {message && !registrationSuccess && !resetSuccess && (
          <div className="bg-sky-500/20 border border-sky-500/30 rounded-lg mb-6 overflow-hidden">
            <div className="flex items-start gap-3 p-4">
              <svg className="w-5 h-5 text-sky-300 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd"/>
              </svg>
              <div className="flex-1">
                <p className="text-sky-100 text-sm">
                  {message}
                </p>
              </div>
            </div>
          </div>
        )}
        
        {successMessage && (
          <div className="bg-emerald-500/20 border border-emerald-500/30 rounded-lg mb-6 overflow-hidden relative">
            <div className="flex items-start gap-3 p-4 pr-12">
              <svg className="w-5 h-5 text-emerald-300 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/>
              </svg>
              <div className="flex-1">
                <p className="text-emerald-100 text-sm font-medium">
                  {successMessage}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSuccessMessage('')}
                className="absolute top-3 right-3 text-emerald-300 hover:text-emerald-200 transition-colors"
                aria-label="Dismiss message"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        )}

        {/* Enhanced Error Display */}
        {error && (
          <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-lg relative">
            <div className="flex items-start gap-3">
              <svg 
                className="w-5 h-5 text-red-400 mt-0.5 flex-shrink-0" 
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                <path 
                  strokeLinecap="round" 
                  strokeLinejoin="round" 
                  strokeWidth="2" 
                  d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <div className="flex-1 pr-6">
                <p className="text-red-300 text-sm font-medium">
                  {error}
                </p>
                
                {/* Contextual help text based on error type */}
                {(error.toLowerCase().includes('no account') || 
                  error.toLowerCase().includes('not found') ||
                  error.toLowerCase().includes('user_not_found')) && (
                  <div className="mt-2 p-2 bg-red-500/5 rounded border border-red-500/10">
                    <p className="text-red-400/80 text-xs mb-1.5">
                      🔍 Account not found with these credentials.
                    </p>
                    <p className="text-red-400/70 text-xs">
                      Need an account?{' '}
                      <Link 
                        href="/courses" 
                        className="text-red-300 hover:text-red-200 underline font-medium"
                      >
                        Apply for a course
                      </Link>
                      {' '}to get started.
                    </p>
                  </div>
                )}
                
                {(error.toLowerCase().includes('incorrect password') || 
                  error.toLowerCase().includes('invalid password') ||
                  error.toLowerCase().includes('invalid_password')) && (
                  <div className="mt-2 p-2 bg-red-500/5 rounded border border-red-500/10">
                    <p className="text-red-400/80 text-xs mb-1.5">
                      🔒 The password you entered is incorrect.
                    </p>
                    <p className="text-red-400/70 text-xs">
                      <Link 
                        href="/auth/forgot-password" 
                        className="text-red-300 hover:text-red-200 underline font-medium"
                      >
                        Reset your password
                      </Link>
                      {' '}or try again
                    </p>
                  </div>
                )}
                
                {(error.toLowerCase().includes('invalid email') || 
                  error.toLowerCase().includes('email address')) && (
                  <div className="mt-2 p-2 bg-red-500/5 rounded border border-red-500/10">
                    <p className="text-red-400/70 text-xs">
                      💡 Please enter a valid email address (e.g., user@example.com) or use your username instead
                    </p>
                  </div>
                )}
                
                {(error.toLowerCase().includes('connection') || 
                  error.toLowerCase().includes('network') ||
                  error.toLowerCase().includes('connect to the server')) && (
                  <div className="mt-2 p-2 bg-red-500/5 rounded border border-red-500/10">
                    <p className="text-red-400/70 text-xs">
                      🌐 Please check your internet connection and try again
                    </p>
                  </div>
                )}
                
                {(error.toLowerCase().includes('server error') || 
                  error.toLowerCase().includes('temporarily unavailable')) && (
                  <div className="mt-2 p-2 bg-red-500/5 rounded border border-red-500/10">
                    <p className="text-red-400/70 text-xs">
                      ⚙️ We're experiencing technical difficulties. Please try again in a few moments.
                    </p>
                  </div>
                )}
              </div>
              
              {/* Dismiss Button */}
              <button
                type="button"
                onClick={() => setError('')}
                className="absolute top-3 right-3 text-red-400 hover:text-red-300 transition-colors"
                aria-label="Dismiss error"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        )}

          <form className="space-y-6" onSubmit={handleSubmit}>
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-slate-300 mb-2">
              Email or Username
              <span className="text-xs text-slate-400 font-normal ml-2">
                (Enter your registered email or username)
              </span>
            </label>
            <input
              id="email"
              name="email"
              type="text"
              autoComplete="email"
              required
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              onBlur={() => setIdentifierTouched(true)}
              className={`w-full px-4 py-3 bg-white/5 border rounded-lg focus:ring-2 text-white placeholder-slate-400 transition-all ${
                validationErrors.identifier
                  ? 'border-red-500/50 focus:ring-red-500 focus:border-red-500'
                  : 'border-white/10 focus:ring-sky-500 focus:border-sky-500'
              }`}
              placeholder="Enter your email or username"
            />
            {validationErrors.identifier && (
              <div className="mt-2 p-2 bg-red-500/10 border border-red-500/20 rounded flex items-start gap-2">
                <svg className="w-3.5 h-3.5 text-red-400 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd"/>
                </svg>
                <p className="text-xs text-red-300 flex-1">
                  {validationErrors.identifier}
                </p>
              </div>
            )}
          </div>

          <div className="relative">
            <label htmlFor="password" className="block text-sm font-medium text-slate-300 mb-2">
              Password
              <span className="text-xs text-slate-400 font-normal ml-2">
                (Minimum 3 characters)
              </span>
            </label>
            <input
              id="password"
              name="password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onBlur={() => setPasswordTouched(true)}
              className={`w-full px-4 py-3 bg-white/5 border rounded-lg focus:ring-2 text-white placeholder-slate-400 transition-all pr-12 ${
                validationErrors.password
                  ? 'border-red-500/50 focus:ring-red-500 focus:border-red-500'
                  : 'border-white/10 focus:ring-sky-500 focus:border-sky-500'
              }`}
              placeholder="••••••••"
            />
            <button
              type="button"
              onClick={() => setShowPassword((s) => !s)}
              aria-pressed={showPassword}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              className="absolute right-3 top-[calc(50%+0.25rem)] transform -translate-y-1/2 text-slate-300 hover:text-sky-400"
            >
              {showPassword ? (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-5.523 0-10-5.373-10-7s4.477-7 10-7c1.21 0 2.37.214 3.447.605M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 3l18 18"></path>
                </svg>
              ) : (
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 5c-7 0-11 7-11 7s4 7 11 7 11-7 11-7-4-7-11-7zm0 12a5 5 0 110-10 5 5 0 010 10z" />
                  <circle cx="12" cy="12" r="2.5" />
                </svg>
              )}
            </button>
            {validationErrors.password && (
              <div className="mt-2 p-2 bg-red-500/10 border border-red-500/20 rounded flex items-start gap-2">
                <svg className="w-3.5 h-3.5 text-red-400 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd"/>
                </svg>
                <p className="text-xs text-red-300 flex-1">
                  {validationErrors.password}
                </p>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex items-center">
              <input
                id="remember-me"
                name="remember-me"
                type="checkbox"
                className="h-4 w-4 text-sky-500 bg-white/5 border border-white/10 rounded focus:ring-sky-500"
              />
              <label htmlFor="remember-me" className="ml-2 block text-sm text-slate-300">
                Remember me
              </label>
            </div>

            <div className="text-right">
              <Link 
                href="/auth/forgot-password" 
                className="text-sm text-slate-300 hover:text-sky-400 transition-colors"
              >
                Forgot password?
              </Link>
            </div>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full flex items-center justify-center gap-2 py-3.5 px-6 bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-600 hover:to-blue-700 text-white font-semibold rounded-lg shadow-lg transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? (
              <>
                <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Signing In...
              </>
            ) : (
              <>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
                </svg>
                Sign In
              </>
            )}
          </button>
          
          {isSubmitting && (
            <div className="mt-3 text-center">
              <p className="text-xs text-slate-400 animate-pulse">
                Verifying your credentials...
              </p>
            </div>
          )}
        </form>

        {/* Timeout warning for stuck authentication */}
        {authCheckTimeout > 0 && (Date.now() - authCheckTimeout) > 8000 && (
          <div className="mt-4 p-4 bg-yellow-900/50 border border-yellow-700 rounded-lg">
            <div className="flex items-center gap-2 text-yellow-300 text-sm mb-2">
              <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              Authentication is taking longer than expected
            </div>
            <p className="text-slate-300 text-sm mb-3">
              If you're stuck on this page, try refreshing or clearing your browser cache.
            </p>
            <button
              onClick={() => {
                localStorage.removeItem('token');
                localStorage.removeItem('refreshToken');
                setAuthCheckTimeout(0);
                window.location.href = '/auth/login';
              }}
              className="px-3 py-2 bg-red-600 hover:bg-red-700 text-white text-sm rounded-md transition-colors"
            >
              Force Logout & Retry
            </button>
          </div>
        )}

        <div className="mt-8">
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-white/10"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-transparent text-slate-400">Or continue with</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 mt-6">
            <button
              type="button"
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 rounded-lg transition-colors"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12.24 10.285V14.4h6.806c-.275 1.765-2.056 5.174-6.806 5.174-4.095 0-7.439-3.389-7.439-7.574s3.345-7.574 7.439-7.574c2.33 0 3.891.989 4.785 1.849l3.254-3.138C18.189 1.186 15.479 0 12.24 0c-6.635 0-12 5.365-12 12s5.365 12 12 12c6.926 0 11.52-4.869 11.52-11.726 0-.788-.085-1.39-.189-1.989H12.24z"/>
              </svg>
              Google
            </button>
            
            <button
              type="button"
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 rounded-lg transition-colors"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 0C5.373 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.6.113.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0112 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z"/>
              </svg>
              GitHub
            </button>
          </div>

          <p className="mt-8 text-center text-slate-400">
            Don't have an account yet?{' '}
            <Link 
              href="/courses" 
              className="font-medium text-sky-400 hover:text-sky-300 underline-offset-4 hover:underline"
            >
              Apply for a course
            </Link>
            {' '}to get started.
          </p>
        </div>
      </div>
      
      {/* Password Change Modal for first-time login */}
      <ChangePasswordModal
        isOpen={showPasswordChangeModal}
        onClose={() => {
          setShowPasswordChangeModal(false);
          // After password change, redirect to the intended destination
          if (pendingRedirect) {
            router.push(pendingRedirect);
          }
        }}
        required={true}
      />
    </div>
    </ClientOnly>
  );
}