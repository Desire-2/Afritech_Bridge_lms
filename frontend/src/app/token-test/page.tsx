'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { jwtDecode } from 'jwt-decode';

interface TokenPayload {
  exp: number;
  iat: number;
  jti: string;
  type: string;
  sub: number;
  nbf: number;
  fresh: boolean;
}

export default function TokenTestPage() {
  const { token, user, isAuthenticated, refreshToken } = useAuth();
  const [tokenInfo, setTokenInfo] = useState<TokenPayload | null>(null);
  const [timeUntilExpiry, setTimeUntilExpiry] = useState<string>('');
  const [refreshResult, setRefreshResult] = useState<string>('');

  useEffect(() => {
    if (token) {
      try {
        const decoded: TokenPayload = jwtDecode(token);
        setTokenInfo(decoded);
      } catch (error) {
        console.error('Error decoding token:', error);
      }
    } else {
      setTokenInfo(null);
    }
  }, [token]);

  useEffect(() => {
    if (!tokenInfo) return;

    const interval = setInterval(() => {
      const currentTime = Math.floor(Date.now() / 1000);
      const expiresIn = tokenInfo.exp - currentTime;
      
      if (expiresIn <= 0) {
        setTimeUntilExpiry('Token expired');
      } else {
        const minutes = Math.floor(expiresIn / 60);
        const seconds = expiresIn % 60;
        setTimeUntilExpiry(`${minutes}m ${seconds}s`);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [tokenInfo]);

  const handleManualRefresh = async () => {
    setRefreshResult('Refreshing...');
    try {
      const success = await refreshToken();
      setRefreshResult(success ? 'Refresh successful!' : 'Refresh failed');
    } catch (error) {
      setRefreshResult(`Refresh error: ${error}`);
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white/10 backdrop-blur-md rounded-lg border border-white/20 p-6">
          <h1 className="text-2xl font-bold text-white mb-4">Token Test Page</h1>
          <p className="text-slate-300">Please log in to test token refresh functionality.</p>
          <a 
            href="/auth/login" 
            className="mt-4 inline-block px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Go to Login
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 p-4">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white/10 backdrop-blur-md rounded-lg border border-white/20 p-6 mb-6">
          <h1 className="text-3xl font-bold text-white mb-6">Token Refresh Test Page</h1>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* User Info */}
            <div className="bg-white/5 rounded-lg p-4">
              <h2 className="text-xl font-semibold text-white mb-3">User Information</h2>
              <div className="space-y-2 text-slate-300">
                <p><span className="font-medium">Name:</span> {user?.first_name} {user?.last_name}</p>
                <p><span className="font-medium">Email:</span> {user?.email}</p>
                <p><span className="font-medium">Role:</span> {user?.role}</p>
                <p><span className="font-medium">Status:</span> 
                  <span className={`ml-2 px-2 py-1 rounded text-xs ${
                    isAuthenticated ? 'bg-green-600 text-white' : 'bg-red-600 text-white'
                  }`}>
                    {isAuthenticated ? 'Authenticated' : 'Not Authenticated'}
                  </span>
                </p>
              </div>
            </div>

            {/* Token Info */}
            <div className="bg-white/5 rounded-lg p-4">
              <h2 className="text-xl font-semibold text-white mb-3">Token Information</h2>
              {tokenInfo ? (
                <div className="space-y-2 text-slate-300">
                  <p><span className="font-medium">Type:</span> {tokenInfo.type}</p>
                  <p><span className="font-medium">Fresh:</span> {tokenInfo.fresh ? 'Yes' : 'No'}</p>
                  <p><span className="font-medium">User ID:</span> {tokenInfo.sub}</p>
                  <p><span className="font-medium">Issued:</span> {new Date(tokenInfo.iat * 1000).toLocaleString()}</p>
                  <p><span className="font-medium">Expires:</span> {new Date(tokenInfo.exp * 1000).toLocaleString()}</p>
                  <p><span className="font-medium">Time until expiry:</span> 
                    <span className={`ml-2 px-2 py-1 rounded text-xs ${
                      timeUntilExpiry.includes('expired') ? 'bg-red-600 text-white' : 'bg-yellow-600 text-white'
                    }`}>
                      {timeUntilExpiry}
                    </span>
                  </p>
                </div>
              ) : (
                <p className="text-slate-400">No token information available</p>
              )}
            </div>
          </div>

          {/* Token Actions */}
          <div className="mt-6 bg-white/5 rounded-lg p-4">
            <h2 className="text-xl font-semibold text-white mb-3">Token Actions</h2>
            <div className="flex flex-wrap gap-3">
              <button
                onClick={handleManualRefresh}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
              >
                Manual Token Refresh
              </button>
              <button
                onClick={() => window.location.reload()}
                className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors"
              >
                Refresh Page (Test Auto-Refresh)
              </button>
              <a
                href="/student/dashboard"
                className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
              >
                Go to Dashboard
              </a>
            </div>
            {refreshResult && (
              <div className={`mt-3 p-2 rounded text-sm ${
                refreshResult.includes('successful') ? 'bg-green-600/20 text-green-300' : 
                refreshResult.includes('Refreshing') ? 'bg-yellow-600/20 text-yellow-300' :
                'bg-red-600/20 text-red-300'
              }`}>
                {refreshResult}
              </div>
            )}
          </div>

          {/* Local Storage Info */}
          <div className="mt-6 bg-white/5 rounded-lg p-4">
            <h2 className="text-xl font-semibold text-white mb-3">Local Storage</h2>
            <div className="space-y-2 text-slate-300 text-sm">
              <p><span className="font-medium">Access Token:</span> {token ? `${token.substring(0, 50)}...` : 'None'}</p>
              <p><span className="font-medium">Refresh Token:</span> {
                typeof window !== 'undefined' && localStorage.getItem('refreshToken') 
                  ? `${localStorage.getItem('refreshToken')?.substring(0, 50)}...` 
                  : 'None'
              }</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
