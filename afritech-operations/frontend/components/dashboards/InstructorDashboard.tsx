'use client';

import Link from 'next/link';
import { fmtDate, fmtDateTime } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useFetch } from '@/lib/use-fetch';
import { PageHeader, Loading, ErrorAlert, StatCard, Badge, EmptyState } from '@/components/ui';

export default function InstructorDashboard() {
  const { user } = useAuth();
  const { data, error, loading } = useFetch('/api/dashboard/me');

  if (error) return <ErrorAlert message={error} />;
  if (loading || !data) return <Loading label="Loading your dashboard…" />;

  const plan = data.current_plan;

  return (
    <div>
      <PageHeader
        eyebrow="My teaching"
        title={`Welcome back, ${user?.employee_name?.split(' ')[0] || 'there'}`}
        subtitle={`Your teaching overview for ${data.today}`}
        actions={
          <>
            <Link href="/learning/weekly-plans" className="btn btn-accent">
              <i className="bi bi-journal-richtext me-1" /> Weekly plans
            </Link>
            <Link href="/learning/cohorts" className="btn btn-outline-primary">My cohorts</Link>
          </>
        }
      />

      <div className="row g-3 mb-4">
        <StatCard label="Teaching activities today" value={data.teaching_activities_today || 0} tone="primary" icon="bi-easel" />
        <StatCard label="Assigned cohorts" value={data.assigned_cohorts || 0} tone="primary" icon="bi-mortarboard" />
        <StatCard label="Learners (all cohorts)" value={data.total_learners || 0} tone="primary" icon="bi-people" />
        <StatCard label="Awaiting grading" value={data.pending_grading || 0} tone={data.pending_grading > 0 ? 'warning' : 'success'} icon="bi-clipboard-check" />
        <StatCard label="Open tasks" value={data.my_open_tasks || 0} sub={`${data.my_overdue_tasks || 0} overdue`} tone={data.my_overdue_tasks > 0 ? 'danger' : 'primary'} icon="bi-check2-square" />
        <StatCard label="Plan completion" value={`${data.plan_completion || 0}%`} tone="success" icon="bi-graph-up-arrow" />
      </div>

      <div className="row g-4">
        <div className="col-lg-7">
          <div className="card h-100">
            <div className="card-header d-flex justify-content-between align-items-center">
              <span>Upcoming teaching activities</span>
              <Link href="/learning/weekly-plans" className="small text-decoration-none text-primary fw-semibold">All plans</Link>
            </div>
            <div className="card-body p-0">
              {(data.upcoming_activities || []).length === 0 && (
                <div className="p-3"><EmptyState message="No upcoming activities scheduled." icon="bi-calendar2-week" /></div>
              )}
              {(data.upcoming_activities || []).map((a: any) => (
                <div key={a.id} className="list-row d-flex justify-content-between align-items-center px-3 py-2">
                  <div className="d-flex align-items-center gap-3">
                    <div className="stat-icon d-none d-sm-flex" style={{ width: 36, height: 36, fontSize: 15, background: 'var(--accent-100)', color: 'var(--accent-600)' }}>
                      <i className="bi bi-easel" />
                    </div>
                    <div>
                      <div className="fw-semibold">{a.lesson_topic}</div>
                      <div className="small text-muted">{fmtDate(a.activity_date)} · {a.cohort_name || 'Class'}</div>
                    </div>
                  </div>
                  <div className="text-end text-muted small">{a.duration_hours ? `${a.duration_hours}h` : '—'}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="col-lg-5">
          <div className="card h-100">
            <div className="card-header d-flex justify-content-between align-items-center">
              <span>Attendance today</span>
              {data.today_attendance && <Badge status={data.today_attendance.status} />}
            </div>
            <div className="card-body">
              {data.today_attendance ? (
                <table className="table table-sm mb-0">
                  <tbody>
                    <tr><td className="text-muted">Clock in</td><td className="text-end">{data.today_attendance.clock_in ? fmtDateTime(data.today_attendance.clock_in) : '—'}</td></tr>
                    <tr><td className="text-muted">Clock out</td><td className="text-end">{data.today_attendance.clock_out ? fmtDateTime(data.today_attendance.clock_out) : '—'}</td></tr>
                    <tr><td className="text-muted">Hours</td><td className="text-end fw-semibold">{data.today_attendance.total_hours || 0}</td></tr>
                  </tbody>
                </table>
              ) : (
                <p className="text-muted small mb-0">No attendance record yet today.</p>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="card mt-4">
        <div className="card-header d-flex justify-content-between align-items-center">
          <span>Current weekly plan</span>
          <Link href="/learning/weekly-plans" className="small text-decoration-none text-primary fw-semibold">View</Link>
        </div>
        <div className="card-body">
          {plan ? (
            <div className="row g-3 align-items-center">
              <div className="col-md-4">
                <div className="text-muted small">Week</div>
                <div className="fw-semibold">{fmtDate(plan.week_start)} → {fmtDate(plan.week_end)}</div>
              </div>
              <div className="col-md-3">
                <div className="text-muted small">Status</div>
                <Badge status={plan.status} />
              </div>
              <div className="col-md-3">
                <div className="text-muted small mb-1">Completion</div>
                <div className="progress" style={{ height: 8 }}>
                  <div className="progress-bar" style={{ width: `${data.plan_completion}%`, background: 'var(--accent)' }} role="progressbar" aria-valuenow={data.plan_completion} aria-valuemin={0} aria-valuemax={100} />
                </div>
                <div className="small fw-semibold mt-1">{data.plan_completion}%</div>
              </div>
            </div>
          ) : (
            <EmptyState message="No weekly plan for the current week." icon="bi-journal-richtext" />
          )}
        </div>
      </div>
    </div>
  );
}