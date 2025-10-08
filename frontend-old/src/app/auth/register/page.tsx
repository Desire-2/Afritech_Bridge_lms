'use client';

import { GuestGuard } from '@/components/guards/guest-guard';
import RegisterForm from './register-form';

export default function RegisterPage() {
  return (
    <GuestGuard>
      <RegisterForm />
    </GuestGuard>
  );
}