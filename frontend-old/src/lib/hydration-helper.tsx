'use client';

import { useEffect, useState } from 'react';

// Component that only renders its children on the client-side after hydration is complete
export function ClientOnly({ 
  children,
  fallback = null 
}: { 
  children: React.ReactNode;
  fallback?: React.ReactNode;
}) {
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    // Small delay to ensure React has settled after hydration
    const timer = setTimeout(() => {
      setIsClient(true);
    }, 50);
    
    return () => clearTimeout(timer);
  }, []);

  return isClient ? <>{children}</> : <>{fallback}</>;
}

// This hook returns true when the component is mounted on the client
export function useIsClient() {
  const [isClient, setIsClient] = useState(false);
  
  useEffect(() => {
    // Small delay to ensure React has settled after hydration
    const timer = setTimeout(() => {
      setIsClient(true);
    }, 50);
    
    return () => clearTimeout(timer);
  }, []);
  
  return isClient;
}

// A hook that checks if the value is available on the client
// This is useful for values that might be undefined during SSR
export function useClientValue<T>(value: T): T | undefined {
  const isClient = useIsClient();
  return isClient ? value : undefined;
}