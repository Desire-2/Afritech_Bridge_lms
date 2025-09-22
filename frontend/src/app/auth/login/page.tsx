
import React, { Suspense } from 'react';
import LoginForm from './LoginForm'; // Import the new client component

// This page component itself can remain a Server Component or be a Client Component
// if it doesn't directly use client-only hooks.
// For simplicity, and since it's just wrapping, it can be a server component.

export default function LoginPage() {
  return (
    <Suspense fallback={<div>Loading page...</div>}> {/* Fallback UI for Suspense */}
      <LoginForm />
    </Suspense>
  );
}

