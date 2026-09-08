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
        title="My Dashboard"
        subtitle={`Teaching overview for ${user?.employee_name || 'you'} — ${data.today}`}
        actions={
          <>
            <Link href="/learning/weekly-plans" className="btn btn-primary">
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
        <StatCard label="Current plan completion" value={`${data.plan_completion || 0}%`} tone="primary" icon="bi-graph-up-arrow" />
      </div>

      <div className="row g-4">
        <div className="col-lg-7">
          <div className="card h-100">
            <div className="card-body">
              <div className="d-flex justify-content-between align-items-center mb-2">
                <h5 className="card-title h6 fw-semibold mb-0">Upcoming teaching activities</h5>
                <Link href="/learning/weekly-plans" className="small text-decoration-none">All plans</Link>
              </div>
              {(data.upcoming_activities || []).length === 0 && (
                <EmptyState message="No upcoming activities scheduled." icon="bi-calendar2-week" />
              )}
              {(data.upcoming_activities || []).map((a: any) => (
                <div key={a.id} className="d-flex justify-content-between align-items-center py-2 border-bottom small">
                  <div>
                    <div className="fw-semibold">{a.lesson_topic}</div>
                    <div className="text-muted">{fmtDate(a.activity_date)} · {a.cohort_name || 'Class'}</div>
                  </div>
                  <div className="text-end text-muted">{a.duration_hours ? `${a.duration_hours}h` : '—'}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="col-lg-5">
          <div className="card h-100">
            <div className="card-body">
              <div className="d-flex justify-content-between align-items-center mb-2">
                <h5 className="card-title h6 fw-semibold mb-0">Attendance today</h5>
                {data.today_attendance && <Badge status={data.today_attendance.status} />}
              </div>
              {data.today_attendance ? (
                <table className="table table-sm mb-0">
                  <tbody>
                    <tr><td className="text-muted">Clock in</td><td>{data.today_attendance.clock_in ? fmtDateTime(data.today_attendance.clock_in) : '—'}</td></tr>
                    <tr><td className="text-muted">Clock out</td><td>{data.today_attendance.clock_out ? fmtDateTime(data.today_attendance.clock_out) : '—'}</td></tr>
                    <tr><td className="text-muted">Hours</td><td>{data.today_attendance.total_hours || 0}</td></tr>
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
        <div className="card-body">
          <div className="d-flex justify-content-between align-items-center mb-2">
            <h5 className="card-title h6 fw-semibold mb-0">Current weekly plan</h5>
            <Link href="/learning/weekly-plans" className="small text-decoration-none">View</Link>
          </div>
          {plan ? (
            <div className="row g-3">
              <div className="col-md-4">
                <div className="text-muted small">Week</div>
                <div className="fw-semibold">{fmtDate(plan.week_start)} → {fmtDate(plan.week_end)}</div>
              </div>
              <div className="col-md-4">
                <div className="text-muted small">Status</div>
                <Badge status={plan.status} />
              </div>
              <div className="col-md-4">
                <div className="text-muted small">Completion</div>
                <div className="fw-semibold">{data.plan_completion}%</div>
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