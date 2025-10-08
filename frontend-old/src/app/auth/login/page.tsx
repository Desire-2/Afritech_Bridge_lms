
'use client';

import React, { Suspense } from 'react';
import LoginForm from './LoginForm';
import { GuestGuard } from '@/components/guards/guest-guard';

export default function LoginPage() {
  return (
    <GuestGuard>
      <Suspense fallback={<div>Loading page...</div>}>
        <LoginForm />
      </Suspense>
    </GuestGuard>
  );
}

