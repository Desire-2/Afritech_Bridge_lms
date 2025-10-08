'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { RolePermissions } from '@/lib/permissions';

/**
 * A utility component to protect guest routes (like login, register) from authenticated users
 * Simplified to always show the login form without authentication checks
 * @param children The components to render
 */
export function GuestGuard({ children }: { children: React.ReactNode }) {
  // Simply render the children (login form) without any authentication checks
  return <>{children}</>;
}