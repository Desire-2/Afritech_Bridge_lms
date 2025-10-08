'use client';

import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';

export default function TestLoginPage() {
  const { login } = useAuth();
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);

  const addLog = (message: string) => {
    console.log(message);
    setLogs(prev => [...prev, `${new Date().toLocaleTimeString()}: ${message}`]);
  };

  const testFailedLogin = async () => {
    addLog('Starting test with invalid credentials');
    setError('');
    setIsSubmitting(true);

    try {
      addLog('Calling login function...');
      await login('invalid@email.com', 'wrongpassword');
      addLog('Login unexpectedly succeeded');
    } catch (err: any) {
      addLog(`Login failed as expected: ${JSON.stringify(err)}`);
      const errorMsg = err.message || 'Login failed';
      addLog(`Setting error message: ${errorMsg}`);
      setError(errorMsg);
    } finally {
      setIsSubmitting(false);
      addLog('Test completed');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-2xl w-full space-y-8 p-8 bg-white rounded-lg shadow">
        <h1 className="text-2xl font-bold text-center">Test Login Page</h1>
        
        <button
          onClick={testFailedLogin}
          disabled={isSubmitting}
          className="w-full py-2 px-4 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
        >
          {isSubmitting ? 'Testing...' : 'Test Failed Login'}
        </button>

        {error && (
          <div className="p-4 bg-red-100 border border-red-300 rounded text-red-700">
            <strong>Error:</strong> {error}
          </div>
        )}

        <div className="text-sm text-gray-600">
          <p><strong>Test Details:</strong></p>
          <p>Email: invalid@email.com</p>
          <p>Password: wrongpassword</p>
        </div>

        <div className="bg-gray-100 p-4 rounded">
          <h3 className="font-bold mb-2">Debug Logs:</h3>
          <div className="text-xs font-mono space-y-1 max-h-40 overflow-y-auto">
            {logs.map((log, index) => (
              <div key={index}>{log}</div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}