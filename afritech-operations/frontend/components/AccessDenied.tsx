'use client';

import Link from 'next/link';
import { useAuth } from '@/lib/auth';
import { roleLabel } from '@/lib/permissions';
import { logout } from '@/lib/api';
import { useRouter } from 'next/navigation';

export default function AccessDenied({ title = 'Access denied' }: { title?: string }) {
  const { user } = useAuth();
  const router = useRouter();
  return (
    <div className="access-denied d-flex flex-column align-items-center justify-content-center text-center">
      <div className="access-denied-icon mb-3">
        <i className="bi bi-shield-lock" />
      </div>
      <h1 className="h4 fw-semibold mb-2">{title}</h1>
      <p className="text-muted mb-4 mx-auto" style={{ maxWidth: 420 }}>
        Your account ({roleLabel(user)}) does not have permission to view this page.
        If you believe this is an error, contact your administrator.
      </p>
      <div className="d-flex gap-2">
        <Link href="/" className="btn btn-primary">
          <i className="bi bi-speedometer2 me-1" /> Dashboard
        </Link>
        <button type="button" className="btn btn-outline-secondary"
          onClick={() => { logout(); router.replace('/login'); }}>
          <i className="bi bi-box-arrow-right me-1" /> Sign out
        </button>
      </div>
    </div>
  );
}