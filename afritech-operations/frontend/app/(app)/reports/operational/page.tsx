'use client';

import { useState } from 'react';
import { useFetch, todayIso, yearAgoIso } from '@/lib/use-fetch';
import { fmtDate } from '@/lib/api';
import { PageHeader, Loading, ErrorAlert, EmptyState, StatCard, Badge } from '@/components/ui';
import { TextInput } from '@/components/form';

const TABS = [
  { key: '', label: 'Overview', path: '/api/reports/administrative' },
  { key: 'meetings', label: 'Meeting output', path: '/api/reports/administrative/meetings' },
  { key: 'task-throughput', label: 'Task throughput', path: '/api/reports/administrative/task-throughput' },
  { key: 'attendance-summary', label: 'Attendance', path: '/api/reports/administrative/attendance-summary' },
  { key: 'request-ageing', label: 'Request ageing', path: '/api/reports/administrative/request-ageing' },
  { key: 'department-branch', label: 'Department / branch', path: '/api/reports/administrative/department-branch' },
];

/**
 * Operational reports for the Company Secretary. Every figure here is
 * coordination-only — no revenue, commission, payroll, expense or salary data is
 * exposed on these endpoints at all.
 */
export default function OperationalReportsPage() {
  const [tab, setTab] = useState('');
  const [start, setStart] = useState(yearAgoIso());
  const [end, setEnd] = useState(todayIso());

  const active = TABS.find((t) => t.key === tab) || TABS[0];
  const params = tab === 'department-branch' ? undefined : { start, end };
  const { data, error, loading, reload } = useFetch(active.path, [active.path, start, end], params);

  return (
    <div className="d-flex flex-column gap-3">
      <PageHeader
        eyebrow="Reports"
        title="Operational Reports"
        subtitle="Coordination reporting: meetings, task flow, attendance, requests and structure."
      />

      <div className="card">
        <div className="card-body d-flex flex-wrap align-items-end gap-2">
          <ul className="nav nav-pills flex-wrap gap-1 me-auto">
            {TABS.map((t) => (
              <li className="nav-item" key={t.key}>
                <button className={`nav-link py-1 px-2 small ${tab === t.key ? 'active' : ''}`}
                  onClick={() => setTab(t.key)}>
                  {t.label}
                </button>
              </li>
            ))}
          </ul>
          {tab !== 'department-branch' && (
            <>
              <div>
                <label className="form-label small fw-semibold mb-1">From</label>
                <TextInput type="date" className="form-control form-control-sm" value={start}
                  onChange={(e) => setStart(e.target.value)} />
              </div>
              <div>
                <label className="form-label small fw-semibold mb-1">To</label>
                <TextInput type="date" className="form-control form-control-sm" value={end}
                  onChange={(e) => setEnd(e.target.value)} />
              </div>
            </>
          )}
        </div>
      </div>

      {loading && <Loading />}
      {error && <ErrorAlert message={error} onRetry={reload} />}

      {!loading && !error && data && tab === '' && (
        <Overview data={data} />
      )}
      {!loading && !error && data && tab === 'meetings' && <MeetingOutput data={data} />}
      {!loading && !error && data && tab === 'task-throughput' && <TaskThroughput data={data} />}
      {!loading && !error && data && tab === 'attendance-summary' && <AttendanceSummary data={data} />}
      {!loading && !error && data && tab === 'request-ageing' && <RequestAgeing data={data} />}
      {!loading && !error && data && tab === 'department-branch' && <OrgReport data={data} />}
    </div>
  );
}

function StatusBreakdown({ title, map }: { title: string; map: Record<string, number> | undefined }) {
  const entries = Object.entries(map || {});
  return (
    <div className="card h-100">
      <div className="card-header py-2 fw-semibold small">{title}</div>
      <div className="card-body d-flex flex-wrap gap-2">
        {entries.length === 0 ? <span className="small text-muted">No data.</span>
          : entries.map(([k, v]) => (
            <span key={k} className="badge bg-light text-body border">
              {k.replace(/_/g, ' ')}: <strong>{v}</strong>
            </span>
          ))}
      </div>
    </div>
  );
}

function Overview({ data }: { data: any }) {
  return (
    <div className="d-flex flex-column gap-3">
      <div className="small text-muted">
        {fmtDate(data.start)} → {fmtDate(data.end)} · {data.employees_in_scope} employees in scope
      </div>
      <div className="row g-3">
        <div className="col-6 col-xl-3">
          <StatCard label="Meetings held" value={data.meetings.held} icon="bi-people" tone="primary"
            sub={`${data.meetings.total} scheduled`} />
        </div>
        <div className="col-6 col-xl-3">
          <StatCard label="Minutes missing" value={data.meetings.minutes_missing} icon="bi-journal-text" tone="danger"
            sub={`${data.meetings.minutes_recorded} recorded`} />
        </div>
        <div className="col-6 col-xl-3">
          <StatCard label="Open tasks" value={
            (data.tasks.by_status?.todo || 0) + (data.tasks.by_status?.in_progress || 0)
          } icon="bi-check2-square" tone="info"
            sub={`${data.tasks.overdue} overdue`} />
        </div>
        <div className="col-6 col-xl-3">
          <StatCard label="Action items overdue" value={data.action_items.overdue} icon="bi-flag" tone="danger"
            sub={`${data.action_items.done} of ${data.action_items.total} done`} />
        </div>
      </div>
      <div className="row g-3">
        <div className="col-6 col-xl-3">
          <StatCard label="Open requests" value={data.requests.total - (data.requests.by_status?.approved || 0)
            - (data.requests.by_status?.rejected || 0) - (data.requests.by_status?.closed || 0)}
            icon="bi-inbox" tone="warning" sub={`${data.requests.stale} stale`} />
        </div>
        <div className="col-6 col-xl-3">
          <StatCard label="Follow-ups" value={data.followups.total} icon="bi-arrow-repeat" tone="primary"
            sub={`${data.followups.overdue} overdue`} />
        </div>
        <div className="col-6 col-xl-3">
          <StatCard label="Escalations" value={data.escalations.total} icon="bi-exclamation-diamond" tone="danger"
            sub="all time" />
        </div>
        <div className="col-6 col-xl-3">
          <StatCard label="Announcements" value={data.announcements.published_in_window}
            icon="bi-megaphone" tone="info" sub="published in window" />
        </div>
      </div>
      <div className="row g-3">
        <div className="col-md-6">
          <StatusBreakdown title="Tasks by status" map={data.tasks.by_status} />
        </div>
        <div className="col-md-6">
          <StatusBreakdown title="Requests by status" map={data.requests.by_status} />
        </div>
        <div className="col-md-6">
          <StatusBreakdown title="Follow-ups by status" map={data.followups.by_status} />
        </div>
        <div className="col-md-6">
          <StatusBreakdown title="Attendance by status" map={data.attendance.by_status} />
        </div>
      </div>
    </div>
  );
}

function MeetingOutput({ data }: { data: any }) {
  return (
    <div className="d-flex flex-column gap-3">
      <div className="row g-3">
        <div className="col-4">
          <StatCard label="Meetings" value={data.total} icon="bi-people" tone="primary" />
        </div>
        <div className="col-4">
          <StatCard label="Attendance rate" value={data.attendance_rate == null ? '—' : `${data.attendance_rate}%`}
            icon="bi-person-check" tone="success" />
        </div>
        <div className="col-4">
          <StatCard label="Without minutes"
            value={data.rows.filter((r: any) => r.status === 'completed' && !r.minutes_recorded).length}
            icon="bi-journal-text" tone="danger" />
        </div>
      </div>
      <div className="card">
        <div className="table-responsive">
          <table className="table table-sm align-middle mb-0">
            <thead>
              <tr><th>Meeting</th><th>Date</th><th>Scope</th><th>Attendance</th><th>Minutes</th><th>Actions</th></tr>
            </thead>
            <tbody>
              {data.rows.length === 0 && <tr><td colSpan={6}><EmptyState message="No meetings in this window" /></td></tr>}
              {data.rows.map((r: any) => (
                <tr key={r.meeting_id}>
                  <td>{r.title}</td>
                  <td className="text-nowrap">{fmtDate(r.date)}</td>
                  <td className="small">{r.department || 'Company'}{r.branch ? ` · ${r.branch}` : ''}</td>
                  <td className="text-nowrap">{r.attended}/{r.invited}</td>
                  <td>
                    {r.minutes_recorded
                      ? <Badge status="verified" />
                      : (r.status === 'completed' ? <Badge status="missing" /> : <span className="small text-muted">—</span>)}
                  </td>
                  <td className="small text-nowrap">{r.action_items_done}/{r.action_items} done</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function TaskThroughput({ data }: { data: any }) {
  return (
    <div className="d-flex flex-column gap-3">
      <div className="row g-3">
        <div className="col-4"><StatCard label="Tasks in window" value={data.total} icon="bi-check2-square" tone="primary" /></div>
        <div className="col-4"><StatCard label="Completed" value={data.done} icon="bi-check2-all" tone="success" /></div>
        <div className="col-4"><StatCard label="Overdue" value={data.overdue} icon="bi-exclamation-circle" tone="danger" /></div>
      </div>
      <div className="card">
        <div className="table-responsive">
          <table className="table table-sm align-middle mb-0">
            <thead>
              <tr><th>Employee</th><th>Department</th><th>Assigned</th><th>Done</th><th>Awaiting verification</th><th>Overdue</th></tr>
            </thead>
            <tbody>
              {data.by_employee.length === 0 && <tr><td colSpan={6}><EmptyState message="No task activity in this window" /></td></tr>}
              {data.by_employee.map((r: any) => (
                <tr key={r.employee_id}>
                  <td>{r.employee}</td>
                  <td className="small text-muted">{r.department || '—'}</td>
                  <td>{r.assigned}</td>
                  <td>{r.done}</td>
                  <td>{r.submitted}</td>
                  <td>{r.overdue > 0 ? <Badge status="overdue" /> : '0'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function AttendanceSummary({ data }: { data: any }) {
  return (
    <div className="d-flex flex-column gap-3">
      <StatCard label="Attendance records" value={data.total_records} icon="bi-calendar-check" tone="primary" />
      <div className="card">
        <div className="table-responsive">
          <table className="table table-sm align-middle mb-0">
            <thead>
              <tr><th>Employee</th><th>Department</th><th>Branch</th><th>Present</th><th>Late</th><th>Absent</th><th>Leave</th></tr>
            </thead>
            <tbody>
              {data.rows.length === 0 && <tr><td colSpan={7}><EmptyState message="No attendance records in this window" /></td></tr>}
              {data.rows.map((r: any) => (
                <tr key={r.employee_id}>
                  <td>{r.employee}</td>
                  <td className="small text-muted">{r.department || '—'}</td>
                  <td className="small text-muted">{r.branch || '—'}</td>
                  <td>{r.present}</td>
                  <td>{r.late}</td>
                  <td>{r.absent}</td>
                  <td>{r.leave}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <p className="small text-muted mb-0">
        Presence counts only — overtime hours and any pay figure are not available to this role.
      </p>
    </div>
  );
}

function RequestAgeing({ data }: { data: any }) {
  return (
    <div className="d-flex flex-column gap-3">
      <div className="row g-3">
        <div className="col-6 col-xl-3"><StatCard label="Total" value={data.total} icon="bi-inbox" tone="primary" /></div>
        <div className="col-6 col-xl-3"><StatCard label="Open" value={data.open} icon="bi-hourglass-split" tone="warning" /></div>
        <div className="col-6 col-xl-3"><StatCard label="Closed" value={data.closed} icon="bi-check2-circle" tone="success" /></div>
        <div className="col-6 col-xl-3"><StatCard label="Stale" value={data.stale} icon="bi-exclamation-circle" tone="danger" /></div>
      </div>
      <div className="row g-3">
        <div className="col-lg-5">
          <div className="card h-100">
            <div className="card-header py-2 fw-semibold small">Open requests by age</div>
            <div className="card-body d-flex flex-column gap-2">
              {Object.entries(data.age_buckets || {}).map(([bucket, count]: any) => (
                <div key={bucket}>
                  <div className="d-flex justify-content-between small">
                    <span>{bucket} days</span><strong>{count}</strong>
                  </div>
                  <div className="progress" style={{ height: 8 }}>
                    <div className="progress-bar bg-primary"
                      style={{ width: `${data.open ? (count / data.open) * 100 : 0}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="col-lg-7">
          <div className="card h-100">
            <div className="card-header py-2 fw-semibold small">Oldest open requests</div>
            <div className="table-responsive">
              <table className="table table-sm mb-0">
                <thead><tr><th>Request</th><th>Requester</th><th>Age</th><th>Status</th></tr></thead>
                <tbody>
                  {(data.oldest_open || []).length === 0 && <tr><td colSpan={4}><EmptyState message="No open requests" /></td></tr>}
                  {(data.oldest_open || []).map((r: any) => (
                    <tr key={r.id}>
                      <td>{r.title}</td>
                      <td className="small">{r.requester || '—'}</td>
                      <td className="text-nowrap">{r.age_days}d</td>
                      <td><Badge status={r.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function OrgReport({ data }: { data: any }) {
  return (
    <div className="d-flex flex-column gap-3">
      <div className="row g-3">
        <div className="col-4"><StatCard label="Headcount in scope" value={data.headcount} icon="bi-people" tone="primary" /></div>
        <div className="col-4"><StatCard label="Open tasks" value={data.open_tasks} icon="bi-check2-square" tone="info" /></div>
        <div className="col-4"><StatCard label="Open requests" value={data.open_requests} icon="bi-inbox" tone="warning" /></div>
      </div>
      <div className="row g-3">
        <div className="col-lg-6">
          <div className="card">
            <div className="card-header py-2 fw-semibold small">By department</div>
            <div className="table-responsive">
              <table className="table table-sm mb-0">
                <thead><tr><th>Department</th><th>Headcount</th></tr></thead>
                <tbody>
                  {data.departments.length === 0 && <tr><td colSpan={2}><EmptyState message="No departments yet" /></td></tr>}
                  {data.departments.map((d: any) => (
                    <tr key={d.department_id}>
                      <td>{d.department}</td>
                      <td>{d.headcount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
        <div className="col-lg-6">
          <div className="card">
            <div className="card-header py-2 fw-semibold small">By branch</div>
            <div className="table-responsive">
              <table className="table table-sm mb-0">
                <thead><tr><th>Branch</th><th>Headcount</th></tr></thead>
                <tbody>
                  {data.branches.length === 0 && <tr><td colSpan={2}><EmptyState message="No branches yet" /></td></tr>}
                  {data.branches.map((b: any) => (
                    <tr key={b.branch_id}>
                      <td>{b.branch}</td>
                      <td>{b.headcount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}