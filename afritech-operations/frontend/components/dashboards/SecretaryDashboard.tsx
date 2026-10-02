'use client';

import type { CSSProperties } from 'react';
import Link from 'next/link';
import { useFetch } from '@/lib/use-fetch';
import { fmtDate, fmtDateTime, can } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { PageHeader, Loading, ErrorAlert, EmptyState, Badge, PriorityBadge } from '@/components/ui';

/**
 * Company Secretary workspace.
 *
 * Reads `/api/dashboard/secretary`, which is deliberately operational-only: the
 * endpoint holds no revenue, commission, payroll, expense or salary data, so
 * there is nothing financial to hide here.
 *
 * The layout is a coordination desk, not a statistics wall — a today strip, a
 * needs-attention queue, a time-ordered agenda and a follow-up rail.
 */

const ACTION_LABELS: Record<string, string> = {
  task_created: 'Task created',
  task_updated: 'Task updated',
  task_comment_added: 'Comment added to a task',
  meeting_created: 'Meeting scheduled',
  meeting_updated: 'Meeting updated',
  meeting_minutes_recorded: 'Minutes recorded',
  meeting_attendance_recorded: 'Attendance recorded for a meeting',
  action_item_created: 'Action item created',
  action_item_updated: 'Action item updated',
  activity_created: 'Activity planned',
  activity_updated: 'Activity updated',
  activity_deleted: 'Activity removed',
  announcement_created: 'Announcement published',
  announcement_updated: 'Announcement updated',
  announcement_acknowledged: 'Announcement acknowledged',
  memo_created: 'Memo created',
  memo_published: 'Memo published',
  memo_updated: 'Memo updated',
  document_uploaded: 'Document uploaded',
  document_updated: 'Document updated',
  document_deleted: 'Document deleted',
  admin_request_created: 'Request submitted',
  admin_request_updated: 'Request reviewed',
  admin_request_resolved: 'Request resolved',
  followup_created: 'Follow-up opened',
  followup_updated: 'Follow-up updated',
  followup_progress_recorded: 'Follow-up progress recorded',
  escalation_created: 'Issue escalated',
  escalation_updated: 'Escalation updated',
  escalation_resolved: 'Escalation resolved',
  leave_requested: 'Leave request submitted',
  leave_request_decided: 'Leave request decided',
  employee_updated: 'Employee record updated',
  attendance_recorded: 'Attendance recorded',
};

const ENTITY_ICONS: Record<string, string> = {
  task: 'bi-check2-square',
  meeting: 'bi-people',
  action_item: 'bi-flag',
  activity: 'bi-clipboard-check',
  announcement: 'bi-megaphone',
  memo: 'bi-sticky',
  document: 'bi-folder2-open',
  admin_request: 'bi-inbox',
  follow_up: 'bi-arrow-repeat',
  escalation: 'bi-exclamation-diamond',
  leave_request: 'bi-airplane',
  employee: 'bi-person-badge',
  attendance: 'bi-clock-history',
};

const PROGRESS_SEGMENTS = [
  { key: 'completed', label: 'Completed', color: 'var(--bs-success)' },
  { key: 'in_progress', label: 'In progress', color: 'var(--bs-info)' },
  { key: 'awaiting_verification', label: 'Awaiting verification', color: 'var(--bs-warning)' },
  { key: 'todo', label: 'To do', color: 'var(--bs-secondary)' },
  { key: 'cancelled', label: 'Cancelled', color: 'var(--border-strong)' },
];

function dayLabel(iso: string): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

export default function SecretaryDashboard() {
  const { user } = useAuth();
  const { data, error, loading, reload } = useFetch('/api/dashboard/secretary');

  if (loading) return <Loading label="Loading your workspace…" />;
  if (error) return <ErrorAlert message={error} onRetry={reload} />;
  if (!data) return <EmptyState message="No workspace data" />;

  const attendance = data.attendance_month || {};
  const pendingAck = data.announcements_pending_my_ack || [];
  const progress = data.task_progress || {};
  const schedule = data.today_schedule || [];
  const attention = data.needs_attention || [];
  const week = data.week_overview || [];
  const recent = data.recent_activity || [];
  const service = data.service_operations;
  const name = data.employee?.name || '';
  const firstName = name ? name.split(' ')[0] : '';
  const totalForBar = PROGRESS_SEGMENTS.reduce((sum, s) => sum + (progress[s.key] || 0), 0) || 1;

  const quickActions = [
    { label: 'New Task', href: '/tasks?new=1', perm: 'tasks.create', primary: true, icon: 'bi-plus-circle' },
    { label: 'Schedule Meeting', href: '/meetings?new=1', perm: 'meetings.manage', icon: 'bi-calendar-plus' },
    { label: 'Plan Activity', href: '/activities?new=1', perm: 'activities.manage', icon: 'bi-clipboard-plus' },
    { label: 'Announcement', href: '/announcements?new=1', perm: 'announcements.manage', icon: 'bi-megaphone' },
    { label: 'Memo', href: '/memos?new=1', perm: 'memos.manage', icon: 'bi-sticky' },
    { label: 'Follow-up', href: '/follow-ups?new=1', perm: 'followups.manage', icon: 'bi-arrow-repeat' },
  ].filter((a) => can(user, a.perm));

  const todayMetrics = [
    { label: 'Tasks', value: progress.assigned ?? 0, href: '/tasks' },
    { label: 'Overdue', value: progress.overdue ?? 0, href: '/tasks', alert: (progress.overdue || 0) > 0 },
    { label: 'Meetings', value: data.meetings_today_count ?? 0, href: '/meetings' },
    { label: 'Activities', value: (data.activities_today || []).length, href: '/activities' },
    { label: 'Follow-ups', value: data.followups_open ?? 0, href: '/follow-ups' },
    { label: 'Requests', value: data.requests_open ?? 0, href: '/requests' },
  ];

  return (
    <div className="d-flex flex-column gap-4">
      <PageHeader
        eyebrow="Company Secretary"
        title={`${greeting()}${firstName ? `, ${firstName}` : ''}`}
        subtitle="Here's what needs your attention today."
        actions={
          quickActions.length ? (
            <div className="sec-quick">
              {quickActions.map((a) => (
                <Link
                  key={a.label}
                  href={a.href}
                  className={`btn btn-sm ${a.primary ? 'btn-primary' : 'btn-outline-primary'}`}
                >
                  <i className={`bi ${a.icon} me-1`} />
                  {a.label}
                </Link>
              ))}
            </div>
          ) : undefined
        }
      />

      {/* ── TODAY ─────────────────────────────────────────────────────── */}
      <div className="sec-strip">
        <div className="sec-strip-head">
          <b>Today</b>
          <span>{fmtDate(data.today)}</span>
        </div>
        {todayMetrics.map((m) => (
          <Link key={m.label} href={m.href}
            className={`sec-strip-item text-decoration-none text-body${m.alert ? ' is-alert' : ''}`}>
            <b>{m.value}</b>
            <span>{m.label}</span>
          </Link>
        ))}
      </div>

      <div className="row g-3">
        {/* ── main column ───────────────────────────────────────────────── */}
        <div className="col-xl-8 d-flex flex-column gap-3">

          <div className="card">
            <div className="card-header py-2 d-flex justify-content-between align-items-center">
              <span className="sec-panel-title">Needs attention</span>
              <span className="small text-muted">{attention.length} open</span>
            </div>
            <div className="card-body py-1">
              {attention.length === 0 ? (
                <p className="text-muted small py-3 mb-0">
                  Nothing is waiting on you. Enjoy the quiet.
                </p>
              ) : (
                <ul className="sec-attention">
                  {attention.map((a: any) => (
                    <li key={a.label} className={`tone-${a.tone}`}>
                      <Link href={a.href}>
                        <i className={`bi ${a.icon} text-${a.tone}`} />
                        <span>{a.label}</span>
                        <span className="count">{a.count}</span>
                        <i className="bi bi-chevron-right small text-muted" />
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          <div className="card">
            <div className="card-header py-2 d-flex justify-content-between align-items-center">
              <span className="sec-panel-title">Today&apos;s schedule</span>
              <Link href="/calendar" className="btn btn-sm btn-outline-secondary">Company calendar</Link>
            </div>
            <div className="card-body py-1">
              {schedule.length === 0 ? (
                <EmptyState message="Nothing scheduled today" icon="bi-calendar-x" />
              ) : (
                <div className="sec-timeline">
                  {schedule.map((s: any, i: number) => (
                    <div key={`${s.kind}-${s.id}-${i}`} className={`sec-slot kind-${s.kind}`}>
                      <div className={`sec-slot-time${s.time ? '' : ' is-empty'}`}>
                        {s.time || 'Anytime'}
                      </div>
                      <div className="sec-slot-body">
                        <div className="d-flex justify-content-between align-items-start gap-2 flex-wrap">
                          <div className="min-w-0">
                            <div className="sec-slot-title">{s.title}</div>
                            <div className="sec-slot-meta">
                              {s.end_time ? `${s.time} – ${s.end_time}` : ''}
                              {s.detail ? `${s.end_time ? ' · ' : ''}${s.detail}` : ''}
                            </div>
                          </div>
                          <Badge status={s.status} />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="card">
            <div className="card-header py-2 d-flex justify-content-between align-items-center">
              <span className="sec-panel-title">Task progress</span>
              <Link href="/tasks" className="btn btn-sm btn-outline-secondary">All tasks</Link>
            </div>
            <div className="card-body">
              <div className="d-flex justify-content-between align-items-baseline flex-wrap gap-2 mb-2">
                <div>
                  <span className="fs-3 fw-bold">{progress.assigned ?? 0}</span>
                  <span className="small text-muted ms-2">assigned in scope</span>
                </div>
                <div className="small">
                  <span className="text-success fw-semibold">{progress.completion_rate ?? 0}%</span>
                  <span className="text-muted ms-1">completed</span>
                  <span className={`ms-3 fw-semibold ${(progress.overdue || 0) ? 'text-danger' : 'text-muted'}`}>
                    {progress.overdue ?? 0} overdue
                  </span>
                </div>
              </div>
              <div className="sec-progress-track">
                {PROGRESS_SEGMENTS.map((seg) => (
                  <i
                    key={seg.key}
                    style={{
                      width: `${((progress[seg.key] || 0) / totalForBar) * 100}%`,
                      background: seg.color,
                    }}
                  />
                ))}
              </div>
              <div className="sec-legend">
                {PROGRESS_SEGMENTS.map((seg) => (
                  <span key={seg.key} className="sec-legend-item" style={{ '--dot': seg.color } as React.CSSProperties}>
                    <b>{progress[seg.key] ?? 0}</b> {seg.label}
                  </span>
                ))}
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-header py-2 d-flex justify-content-between align-items-center">
              <span className="sec-panel-title">Recent activity</span>
              <Link href="/admin/audit" className="btn btn-sm btn-outline-secondary">Audit log</Link>
            </div>
            <div className="card-body py-1">
              {recent.length === 0 ? (
                <p className="text-muted small py-3 mb-0">No coordination activity recorded yet.</p>
              ) : (
                <ul className="sec-feed">
                  {recent.map((r: any) => (
                    <li key={r.id}>
                      <span className="sec-feed-icon">
                        <i className={`bi ${ENTITY_ICONS[r.entity] || 'bi-circle-square'}`} />
                      </span>
                      <div className="sec-feed-body">
                        <div>{ACTION_LABELS[r.action] || r.action.replace(/_/g, ' ')}</div>
                        <div className="sec-feed-actor">
                          {r.actor} · {fmtDateTime(r.at)}
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>

        {/* ── rail ──────────────────────────────────────────────────────── */}
        <div className="col-xl-4 d-flex flex-column gap-3">

          <div className="card">
            <div className="card-header py-2">
              <span className="sec-panel-title">This week</span>
            </div>
            <div className="card-body py-2">
              <div className="sec-week">
                {week.map((d: any) => (
                  <Link key={d.date} href={`/calendar?date=${d.date}`}
                    className={`sec-day${d.is_today ? ' is-today' : ''}`}>
                    <span className="sec-day-dow">{d.weekday.slice(0, 3)}</span>
                    <span className="sec-day-counts">
                      {d.meetings > 0 && <span><b>{d.meetings}</b> mtg</span>}
                      {d.activities > 0 && <span><b>{d.activities}</b> act</span>}
                      {d.task_deadlines > 0 && <span><b>{d.task_deadlines}</b> due</span>}
                      {!d.meetings && !d.activities && !d.task_deadlines && (
                        <span className="text-muted">clear</span>
                      )}
                    </span>
                    <span className="sec-day-date">{dayLabel(d.date)}</span>
                  </Link>
                ))}
              </div>
            </div>
          </div>

          {service && (
            <div className="card">
              <div className="card-header py-2 d-flex justify-content-between align-items-center">
                <span className="sec-panel-title">Service operations</span>
                <Link href="/transactions" className="btn btn-sm btn-outline-secondary">Open</Link>
              </div>
              <div className="card-body py-1">
                <div className="sec-kv"><span>Transactions in period</span><b>{service.total}</b></div>
                <div className="sec-kv"><span>Completed</span><b>{service.completed}</b></div>
                <div className="sec-kv"><span>Processing</span><b>{service.processing}</b></div>
                <div className="sec-kv"><span>Failed / cancelled</span><b>{service.failed + service.cancelled}</b></div>
                <div className="sec-kv">
                  <span className="text-warning-emphasis fw-semibold">Awaiting follow-up</span>
                  <b className="text-warning-emphasis">{service.pending_follow_up}</b>
                </div>
                <p className="small text-muted mb-0 mt-2">
                  Operational status only — payments, costs and commission are not part of this view.
                </p>
              </div>
            </div>
          )}

          <div className="card">
            <div className="card-header py-2 d-flex justify-content-between align-items-center">
              <span className="sec-panel-title">Upcoming meetings</span>
              <Link href="/meetings" className="btn btn-sm btn-outline-secondary">All</Link>
            </div>
            {(data.upcoming_meetings || []).length === 0 ? (
              <EmptyState message="Nothing booked ahead" icon="bi-calendar-x" />
            ) : (
              <ul className="list-group list-group-flush">
                {data.upcoming_meetings.map((m: any) => (
                  <li key={m.id} className="list-group-item">
                    <div className="d-flex justify-content-between align-items-start gap-2">
                      <div className="min-w-0">
                        <div className="fw-semibold text-truncate">{m.title}</div>
                        <div className="small text-muted">
                          {fmtDate(m.meeting_date)}{m.start_time ? ` · ${m.start_time}` : ''}
                          {m.location ? ` · ${m.location}` : ''}
                        </div>
                      </div>
                      <Badge status={m.status} />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="card">
            <div className="card-header py-2 d-flex justify-content-between align-items-center">
              <span className="sec-panel-title">Attendance today</span>
              <Link href="/attendance" className="btn btn-sm btn-outline-secondary">Overview</Link>
            </div>
            <div className="card-body py-1">
              <div className="sec-kv"><span>Not clocked in</span><b>{data.not_clocked_in_today ?? 0}</b></div>
              <div className="sec-kv"><span>Present this month</span><b>{attendance.present ?? 0}</b></div>
              <div className="sec-kv"><span>Late this month</span><b>{attendance.late ?? 0}</b></div>
              <div className="sec-kv"><span>Absent this month</span><b>{attendance.absent ?? 0}</b></div>
              <div className="sec-kv"><span>On leave</span><b>{attendance.leave ?? 0}</b></div>
              <p className="small text-muted mb-0 mt-2">
                {attendance.employees_tracked || 0} employees tracked. Pay and overtime are outside this role.
              </p>
            </div>
          </div>

          <div className="card">
            <div className="card-header py-2 d-flex justify-content-between align-items-center">
              <span className="sec-panel-title">Open queues</span>
            </div>
            <div className="card-body py-1">
              <div className="sec-kv"><span>Tasks awaiting verification</span><b>{data.tasks_awaiting_verification ?? 0}</b></div>
              <div className="sec-kv"><span>Tasks due tomorrow</span><b>{data.tasks_due_tomorrow ?? 0}</b></div>
              <div className="sec-kv"><span>Overdue action items</span><b>{data.overdue_action_items ?? 0}</b></div>
              <div className="sec-kv"><span>Stale requests</span><b>{data.requests_stale ?? 0}</b></div>
              <div className="sec-kv"><span>Overdue follow-ups</span><b>{data.followups_overdue ?? 0}</b></div>
              <div className="sec-kv"><span>Open escalations</span><b>{data.escalations_open ?? 0}</b></div>
              <div className="sec-kv"><span>Announcements needing acknowledgement</span><b>{data.acknowledgements_pending ?? 0}</b></div>
            </div>
          </div>

          {(data.recent_requests || []).length > 0 && (
            <div className="card">
              <div className="card-header py-2 d-flex justify-content-between align-items-center">
                <span className="sec-panel-title">Employee requests</span>
                <Link href="/requests" className="btn btn-sm btn-outline-secondary">All</Link>
              </div>
              <ul className="list-group list-group-flush">
                {data.recent_requests.map((r: any) => (
                  <li key={r.id} className="list-group-item">
                    <div className="d-flex justify-content-between align-items-start gap-2">
                      <div className="min-w-0">
                        <div className="fw-semibold text-truncate">{r.title}</div>
                        <div className="small text-muted">
                          {r.requester || 'Unknown'} · {fmtDate(r.created_at)}
                        </div>
                      </div>
                      <div className="d-flex gap-1">
                        {r.is_stale && <Badge status="overdue" />}
                        <Badge status={r.status} />
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {(data.overdue_followups || []).length > 0 && (
            <div className="card">
              <div className="card-header py-2 d-flex justify-content-between align-items-center">
                <span className="sec-panel-title">Overdue follow-ups</span>
                <Link href="/follow-ups" className="btn btn-sm btn-outline-secondary">All</Link>
              </div>
              <ul className="list-group list-group-flush">
                {data.overdue_followups.map((f: any) => (
                  <li key={f.id} className="list-group-item">
                    <div className="d-flex justify-content-between align-items-start gap-2">
                      <div className="min-w-0">
                        <div className="fw-semibold text-truncate">{f.subject}</div>
                        <div className="small text-muted">
                          {f.employee || 'Unassigned'} · due {fmtDate(f.next_follow_up)}
                        </div>
                      </div>
                      <PriorityBadge priority={f.priority} />
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>

      {pendingAck.length > 0 && (
        <div className="card border-warning-subtle">
          <div className="card-header py-2 d-flex justify-content-between align-items-center">
            <span className="fw-semibold">
              <i className="bi bi-megaphone me-2" />
              Announcements awaiting your acknowledgement
            </span>
            <Link href="/announcements" className="btn btn-sm btn-outline-primary">View all</Link>
          </div>
          <ul className="list-group list-group-flush">
            {pendingAck.map((a: any) => (
              <li key={a.id} className="list-group-item d-flex justify-content-between align-items-center gap-2">
                <div className="min-w-0">
                  <div className="fw-semibold text-truncate">{a.title}</div>
                  <div className="small text-muted">{fmtDate(a.publish_date)}</div>
                </div>
                <Link href={`/announcements?focus=${a.id}`} className="btn btn-sm btn-primary text-nowrap">Acknowledge</Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
