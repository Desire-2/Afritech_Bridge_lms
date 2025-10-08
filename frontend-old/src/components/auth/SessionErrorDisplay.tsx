'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { 
  ShieldAlert, 
  AlertTriangle, 
  Clock, 
  Wifi, 
  RefreshCw, 
  LogIn, 
  Home,
  X,
  Info
} from 'lucide-react';

interface SessionErrorDisplayProps {
  error?: {
    type: 'UNAUTHORIZED' | 'FORBIDDEN' | 'SESSION_EXPIRED' | 'NETWORK_ERROR' | 'UNKNOWN';
    message: string;
    timestamp: number;
    path?: string;
    requiredRole?: string;
    userRole?: string;
  };
  onRetry?: () => void;
  onClearError?: () => void;
  className?: string;
}

export function SessionErrorDisplay({ 
  error, 
  onRetry, 
  onClearError, 
  className = '' 
}: SessionErrorDisplayProps) {
  const router = useRouter();
  const [isVisible, setIsVisible] = useState(!!error);

  useEffect(() => {
    setIsVisible(!!error);
  }, [error]);

  if (!error || !isVisible) return null;

  const getErrorConfig = () => {
    switch (error.type) {
      case 'UNAUTHORIZED':
        return {
          icon: ShieldAlert,
          color: 'red',
          title: 'Authentication Required',
          description: 'You need to log in to access this resource.',
          actions: [
            {
              label: 'Go to Login',
              action: () => router.push(`/auth/login?redirect=${encodeURIComponent(error.path || '/')}`),
              primary: true
            }
          ]
        };
      
      case 'FORBIDDEN':
        return {
          icon: AlertTriangle,
          color: 'amber',
          title: 'Access Denied',
          description: error.requiredRole 
            ? `This page requires ${error.requiredRole} access. Your current role: ${error.userRole || 'unknown'}`
            : 'You don\'t have permission to access this resource.',
          actions: [
            {
              label: 'Go to Dashboard',
              action: () => router.push('/dashboard'),
              primary: true
            },
            {
              label: 'Contact Support',
              action: () => router.push('/support')
            }
          ]
        };
      
      case 'SESSION_EXPIRED':
        return {
          icon: Clock,
          color: 'blue',
          title: 'Session Expired',
          description: 'Your session has expired for security reasons. Please log in again.',
          actions: [
            {
              label: 'Log In Again',
              action: () => router.push(`/auth/login?redirect=${encodeURIComponent(error.path || '/')}`),
              primary: true
            }
          ]
        };
      
      case 'NETWORK_ERROR':
        return {
          icon: Wifi,
          color: 'purple',
          title: 'Connection Problem',
          description: 'Unable to connect to the server. Please check your internet connection.',
          actions: [
            {
              label: 'Retry',
              action: onRetry || (() => window.location.reload()),
              primary: true
            },
            {
              label: 'Go Home',
              action: () => router.push('/')
            }
          ]
        };
      
      default:
        return {
          icon: AlertTriangle,
          color: 'gray',
          title: 'Something Went Wrong',
          description: error.message || 'An unexpected error occurred.',
          actions: [
            {
              label: 'Try Again',
              action: onRetry || (() => window.location.reload()),
              primary: true
            },
            {
              label: 'Go Home',
              action: () => router.push('/')
            }
          ]
        };
    }
  };

  const config = getErrorConfig();
  const IconComponent = config.icon;
  const colorClasses = {
    red: 'text-red-500 bg-red-50 border-red-200',
    amber: 'text-amber-500 bg-amber-50 border-amber-200',
    blue: 'text-blue-500 bg-blue-50 border-blue-200',
    purple: 'text-purple-500 bg-purple-50 border-purple-200',
    gray: 'text-gray-500 bg-gray-50 border-gray-200'
  };

  const handleClose = () => {
    setIsVisible(false);
    onClearError?.();
  };

  return (
    <div className={`fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 ${className}`}>
      <div className="bg-white rounded-xl shadow-2xl max-w-md w-full mx-4 overflow-hidden">
        {/* Header */}
        <div className={`p-6 border-b ${colorClasses[config.color as keyof typeof colorClasses]}`}>
          <div className="flex items-start gap-4">
            <div className={`p-3 rounded-full ${colorClasses[config.color as keyof typeof colorClasses]}`}>
              <IconComponent className="w-6 h-6" />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-gray-900">{config.title}</h3>
              <p className="text-sm text-gray-600 mt-1">{config.description}</p>
            </div>
            <button
              onClick={handleClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Error Details */}
        {(error.path || error.timestamp) && (
          <div className="px-6 py-4 bg-gray-50 border-b">
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <Info className="w-4 h-4" />
              <span>Error Details</span>
            </div>
            <div className="mt-2 space-y-1 text-xs text-gray-600">
              {error.path && (
                <div>
                  <span className="font-medium">Path:</span> {error.path}
                </div>
              )}
              <div>
                <span className="font-medium">Time:</span> {new Date(error.timestamp).toLocaleString()}
              </div>
              <div>
                <span className="font-medium">Type:</span> {error.type}
              </div>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="p-6">
          <div className="flex gap-3">
            {config.actions.map((action, index) => (
              <button
                key={index}
                onClick={action.action}
                className={`flex-1 px-4 py-2 rounded-lg font-medium transition-colors ${
                  action.primary
                    ? 'bg-indigo-600 text-white hover:bg-indigo-700'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                {action.label}
              </button>
            ))}
          </div>
          
          {/* Additional help text */}
          <div className="mt-4 text-xs text-gray-500 text-center">
            Need help? <a href="/support" className="text-indigo-600 hover:text-indigo-700">Contact Support</a>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Toast notification for session errors
 */
export function SessionErrorToast({ 
  error, 
  onClose, 
  duration = 5000 
}: {
  error: SessionErrorDisplayProps['error'];
  onClose: () => void;
  duration?: number;
}) {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(false);
      setTimeout(onClose, 300); // Allow fade out animation
    }, duration);

    return () => clearTimeout(timer);
  }, [duration, onClose]);

  if (!error || !isVisible) return null;

  const getToastConfig = () => {
    switch (error.type) {
      case 'UNAUTHORIZED':
        return { icon: ShieldAlert, color: 'bg-red-500' };
      case 'FORBIDDEN':
        return { icon: AlertTriangle, color: 'bg-amber-500' };
      case 'SESSION_EXPIRED':
        return { icon: Clock, color: 'bg-blue-500' };
      case 'NETWORK_ERROR':
        return { icon: Wifi, color: 'bg-purple-500' };
      default:
        return { icon: AlertTriangle, color: 'bg-gray-500' };
    }
  };

  const config = getToastConfig();
  const IconComponent = config.icon;

  return (
    <div className={`fixed top-4 right-4 z-50 transition-all duration-300 ${
      isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-2'
    }`}>
      <div className="bg-white rounded-lg shadow-lg border border-gray-200 p-4 max-w-sm">
        <div className="flex items-start gap-3">
          <div className={`p-2 rounded-full ${config.color} text-white`}>
            <IconComponent className="w-4 h-4" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium text-gray-900">{error.message}</p>
            <p className="text-xs text-gray-500 mt-1">
              {new Date(error.timestamp).toLocaleTimeString()}
            </p>
          </div>
          <button
            onClick={() => {
              setIsVisible(false);
              setTimeout(onClose, 300);
            }}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * URL-based error display for login/register pages
 */
export function URLErrorDisplay() {
  const searchParams = useSearchParams();
  const router = useRouter();
  
  const errorType = searchParams?.get('error');
  const requiredRole = searchParams?.get('required');
  const reason = searchParams?.get('reason');

  if (!errorType) return null;

  const getErrorFromURL = () => {
    switch (errorType) {
      case 'unauthorized':
        return {
          type: 'UNAUTHORIZED' as const,
          message: 'Authentication required to access this page',
          timestamp: Date.now()
        };
      case 'forbidden':
        return {
          type: 'FORBIDDEN' as const,
          message: `Access denied. Required role: ${requiredRole || 'unknown'}`,
          timestamp: Date.now(),
          requiredRole
        };
      case 'expired':
        return {
          type: 'SESSION_EXPIRED' as const,
          message: 'Your session has expired',
          timestamp: Date.now()
        };
      case 'logout':
        return {
          type: 'UNKNOWN' as const,
          message: reason || 'You have been logged out',
          timestamp: Date.now()
        };
      default:
        return null;
    }
  };

  const error = getErrorFromURL();
  if (!error) return null;

  return (
    <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
      <div className="flex items-start gap-3">
        <ShieldAlert className="w-5 h-5 text-red-500 mt-0.5" />
        <div>
          <p className="text-sm font-medium text-red-800">{error.message}</p>
          <p className="text-xs text-red-600 mt-1">
            Please log in to continue
          </p>
        </div>
      </div>
    </div>
  );
}