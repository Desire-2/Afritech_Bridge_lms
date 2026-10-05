'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/lib/auth';
import { api, fmtDate, can } from '@/lib/api';
import { roleLabel } from '@/lib/permissions';
import { PageHeader, Loading, ErrorAlert } from '@/components/ui';
import { useFetch } from '@/lib/use-fetch';

interface PrefRow {
  type: string;
  label: string;
  email_enabled: boolean;
  in_app_enabled: boolean;
  mandatory?: boolean;
}

interface PrefsData {
  email_notifications: boolean;
  preferences: PrefRow[];
}

export default function ProfilePage() {
  const { user } = useAuth();
  const empId = user?.employee_id;
  const { data, error, loading } = useFetch(empId ? `/api/employees/${empId}` : '', [empId]);
  const emp = data?.employee;

  const [prefs, setPrefs] = useState<PrefsData | null>(null);
  const [prefError, setPrefError] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    api<PrefsData>('/api/notifications/preferences')
      .then((d) => { setPrefs(d); setPrefError(''); })
      .catch((e: any) => setPrefError(e.message));
  }, []);

  const toggleEmail = useCallback((type: string) => {
    setPrefs((p) => p && {
      ...p,
      preferences: p.preferences.map((r) => r.type === type ? { ...r, email_enabled: !r.email_enabled } : r),
    });
  }, []);

  const toggleInApp = useCallback((type: string) => {
    setPrefs((p) => p && {
      ...p,
      preferences: p.preferences.map((r) => r.type === type ? { ...r, in_app_enabled: !r.in_app_enabled } : r),
    });
  }, []);

  const savePrefs = useCallback(async () => {
    if (!prefs) return;
    setSaving(true);
    setSaved(false);
    try {
      const updated = await api<PrefsData>('/api/notifications/preferences', {
        method: 'PUT',
        body: {
          email_notifications: prefs.email_notifications,
          preferences: prefs.preferences.map((r) => ({
            type: r.type,
            email_enabled: r.email_enabled,
            in_app_enabled: r.in_app_enabled,
          })),
        },
      });
      setPrefs(updated);
      setSaved(true);
    } catch (e: any) {
      setPrefError(e.message);
    } finally {
      setSaving(false);
    }
  }, [prefs]);

  if (!emp && !error && loading) return <Loading label="Loading profile…" />;
  if (error) return <ErrorAlert message={error} />;
  if (!emp) return <ErrorAlert message="No employee profile linked to this account." />;

  const showSalary = can(user, 'employees.manage') || can(user, 'employees.earnings.view_all') || emp.base_salary !== undefined;

  return (
    <div>
      <PageHeader title="My Profile" subtitle={`Employee #${emp.employee_number}`} />

      <div className="row g-4">
        <div className="col-lg-6">
          <div className="card h-100">
            <div className="card-body">
              <h6 className="card-title fw-semibold">Personal Information</h6>
              <table className="table table-sm table-borderless mb-0">
                <tbody>
                  <tr><td className="text-muted" style={{width:160}}>Full Name</td><td>{emp.first_name} {emp.last_name}</td></tr>
                  <tr><td className="text-muted">Email</td><td>{emp.email || '—'}</td></tr>
                  <tr><td className="text-muted">Phone</td><td>{emp.phone || '—'}</td></tr>
                  <tr><td className="text-muted">Gender</td><td>{emp.gender ? emp.gender.charAt(0).toUpperCase() + emp.gender.slice(1) : '—'}</td></tr>
                  <tr><td className="text-muted">National ID</td><td>{emp.national_id ? '••••' : '—'}</td></tr>
                  <tr><td className="text-muted">Emergency Contact</td><td>{emp.emergency_contact || '—'}</td></tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
        <div className="col-lg-6">
          <div className="card h-100">
            <div className="card-body">
              <h6 className="card-title fw-semibold">Employment Details</h6>
              <table className="table table-sm table-borderless mb-0">
                <tbody>
                  <tr><td className="text-muted" style={{width:160}}>Position</td><td>{emp.position || '—'}</td></tr>
                  <tr><td className="text-muted">Department</td><td>{emp.department?.name || '—'}</td></tr>
                  <tr><td className="text-muted">Branch</td><td>{emp.branch?.name || '—'}</td></tr>
                  <tr><td className="text-muted">Employment Date</td><td>{fmtDate(emp.employment_date)}</td></tr>
                  <tr><td className="text-muted">Status</td><td><span className={`badge ${emp.status === 'active' ? 'bg-success-subtle text-success' : 'bg-secondary-subtle text-secondary'}`}>{emp.status}</span></td></tr>
                  <tr><td className="text-muted">Role</td><td>{roleLabel(user)}</td></tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
        {showSalary && emp.base_salary !== undefined && (
          <div className="col-lg-6">
            <div className="card h-100">
              <div className="card-body">
                <h6 className="card-title fw-semibold">Compensation</h6>
                <table className="table table-sm table-borderless mb-0">
                  <tbody>
                    <tr><td className="text-muted" style={{width:160}}>Salary Type</td><td>{emp.salary_type || '—'}</td></tr>
                    <tr><td className="text-muted">Base Salary</td><td className="money">{emp.base_salary?.toLocaleString()} RWF</td></tr>
                    <tr><td className="text-muted">Hourly Rate</td><td className="money">{emp.hourly_rate?.toLocaleString()} RWF</td></tr>
                    <tr><td className="text-muted">Commission Rate</td><td>{emp.default_commission_rate !== null && emp.default_commission_rate !== undefined ? `${(emp.default_commission_rate * 100).toFixed(1)}%` : 'Default'}</td></tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
        <div className="col-12">
          <div className="card">
            <div className="card-body">
              <div className="d-flex justify-content-between align-items-center mb-1">
                <h6 className="card-title fw-semibold mb-0">Notification Preferences</h6>
                <button type="button" className="btn btn-sm btn-primary" onClick={savePrefs} disabled={saving || !prefs}>
                  {saving ? 'Saving…' : 'Save preferences'}
                </button>
              </div>
              <p className="small text-muted mb-3">
                Mute an event to keep it off a channel. Events marked
                <em> required</em> are safety-critical and are always delivered.
              </p>
              {prefError && <div className="alert alert-danger py-2 small">{prefError}</div>}
              {saved && <div className="alert alert-success py-2 small">Your notification preferences were saved.</div>}
              {!prefs && !prefError && <div className="small text-muted">Loading preferences…</div>}
              {prefs && (
                <>
                  <div className="form-check form-switch mb-1">
                    <input
                      className="form-check-input"
                      type="checkbox"
                      role="switch"
                      id="emailMaster"
                      checked={prefs.email_notifications}
                      onChange={() => setPrefs({ ...prefs, email_notifications: !prefs.email_notifications })}
                    />
                    <label className="form-check-label" htmlFor="emailMaster">Receive email notifications</label>
                  </div>
                  <table className="table table-sm table-borderless mb-0">
                    <thead>
                      <tr className="small text-muted">
                        <th style={{ width: 300 }}>Event</th>
                        <th>In-app</th>
                        <th>Email</th>
                      </tr>
                    </thead>
                    <tbody>
                      {prefs.preferences.map((p) => (
                        <tr key={p.type}>
                          <td className="text-muted">
                            {p.label}
                            {p.mandatory && (
                              <span className="badge text-bg-light border ms-1"
                                title="Always delivered — this event cannot be muted.">required</span>
                            )}
                          </td>
                          <td>
                            <div className="form-check form-switch">
                              <input
                                className="form-check-input"
                                type="checkbox"
                                role="switch"
                                id={`inapp-${p.type}`}
                                checked={p.in_app_enabled}
                                disabled={p.mandatory}
                                onChange={() => toggleInApp(p.type)}
                              />
                              <label className="form-check-label small visually-hidden"
                                htmlFor={`inapp-${p.type}`}>{p.label} in-app</label>
                            </div>
                          </td>
                          <td>
                            <div className="form-check form-switch">
                              <input
                                className="form-check-input"
                                type="checkbox"
                                role="switch"
                                id={`email-${p.type}`}
                                checked={p.email_enabled}
                                disabled={p.mandatory || !prefs.email_notifications}
                                onChange={() => toggleEmail(p.type)}
                              />
                              <label className="form-check-label small visually-hidden"
                                htmlFor={`email-${p.type}`}>{p.label} email</label>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}