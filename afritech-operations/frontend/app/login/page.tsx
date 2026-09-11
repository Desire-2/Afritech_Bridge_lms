'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';

export default function LoginPage() {
  const { login } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const user = await login(email, password);
      router.push(user?.role_codes?.includes('service_agent') && !user.is_super_admin ? '/transactions/new' : '/');
    } catch (err: any) {
      setError(err.message || 'Login failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="login-page">
      <div className="card login-card shadow-lg">
        <div className="card-body p-4 p-md-5">
          <div className="text-center mb-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.jpg" alt="AfriTech Bridge logo" className="brand-mark-img mx-auto mb-3" style={{ width: 56, height: 56, borderRadius: 14 }} />
            <h1 className="h4 fw-bold mb-1">AfriTech Bridge Operations</h1>
            <p className="text-muted small mb-0">Internal business management</p>
          </div>
          {error && <div className="alert alert-danger py-2 small"><i className="bi bi-exclamation-triangle me-1" />{error}</div>}
          <form onSubmit={submit}>
            <div className="mb-3">
              <label className="form-label small fw-semibold">Email</label>
              <input
                type="email"
                className="form-control"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@afritech.dev"
                required
                autoFocus
              />
            </div>
            <div className="mb-4">
              <label className="form-label small fw-semibold">Password</label>
              <div className="input-group">
                <input
                  type={showPw ? 'text' : 'password'}
                  className="form-control"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                />
                <button
                  type="button"
                  className={`btn btn-outline-secondary px-2 ${showPw ? 'active' : ''}`}
                  tabIndex={-1}
                  onClick={() => setShowPw((v) => !v)}
                  title={showPw ? 'Hide password' : 'Show password'}
                  aria-label={showPw ? 'Hide password' : 'Show password'}
                >
                  <i className={`bi ${showPw ? 'bi-eye-slash' : 'bi-eye'}`} />
                </button>
              </div>
            </div>
            <button className="btn btn-primary w-100" disabled={busy}>
              {busy ? 'Signing in…' : 'Sign in'}
            </button>
          </form>
          <div className="text-center mt-4 text-muted small d-flex align-items-center justify-content-center gap-2">
            <i className="bi bi-shield-lock text-success" />
            Forgot your password? Contact your administrator.
          </div>
        </div>
      </div>
    </div>
  );
}