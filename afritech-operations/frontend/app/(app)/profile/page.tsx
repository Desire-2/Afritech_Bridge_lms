'use client';

import { useAuth } from '@/lib/auth';
import { api, fmtDate, can } from '@/lib/api';
import { roleLabel } from '@/lib/permissions';
import { PageHeader, Loading, ErrorAlert } from '@/components/ui';
import { useFetch } from '@/lib/use-fetch';

export default function ProfilePage() {
  const { user } = useAuth();
  const empId = user?.employee_id;
  const { data, error, loading } = useFetch(empId ? `/api/employees/${empId}` : '', [empId]);
  const emp = data?.employee;

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
      </div>
    </div>
  );
}