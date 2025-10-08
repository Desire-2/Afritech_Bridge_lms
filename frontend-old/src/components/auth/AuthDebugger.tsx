'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useEffect, useState } from 'react';

interface AuthDebuggerProps {
  enabled?: boolean;
}

/**
 * A debugging component to track authentication state changes
 */
export default function AuthDebugger({ enabled = false }: AuthDebuggerProps) {
  const { isAuthenticated, isLoading, user, token } = useAuth();
  const [logs, setLogs] = useState<string[]>([]);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!enabled || !mounted) return;

    const timestamp = new Date().toLocaleTimeString();
    const newLog = `${timestamp}: Auth State - Loading: ${isLoading}, Authenticated: ${isAuthenticated}, User: ${user?.email || 'none'}, Token: ${token ? 'exists' : 'none'}`;
    
    setLogs(prev => [...prev.slice(-9), newLog]); // Keep last 10 logs
    console.log('AuthDebugger:', newLog);
  }, [isAuthenticated, isLoading, user, token, enabled, mounted]);

  if (!enabled || !mounted) {
    return null;
  }

  return (
    <div className="fixed top-4 left-4 bg-black/80 text-white p-3 rounded-lg text-xs max-w-md z-50">
      <h4 className="text-yellow-400 font-bold mb-2">Auth Debug</h4>
      <div className="space-y-1 max-h-40 overflow-y-auto">
        {logs.map((log, index) => (
          <div key={index} className="font-mono text-xs">
            {log}
          </div>
        ))}
      </div>
      <div className="mt-2 pt-2 border-t border-gray-600">
        <div className="text-green-400">Current: Loading={isLoading.toString()}, Auth={isAuthenticated.toString()}</div>
      </div>
    </div>
  );
}