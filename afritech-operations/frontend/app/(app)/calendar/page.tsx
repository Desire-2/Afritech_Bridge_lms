'use client';

import { useMemo, useState } from 'react';
import { useFetch } from '@/lib/use-fetch';
import { todayIso } from '@/lib/use-fetch';
import { fmtDate } from '@/lib/api';
import { PageHeader, Loading, ErrorAlert, EmptyState, Badge, PriorityBadge } from '@/components/ui';
import { TextInput } from '@/components/form';

// `key` is the plural name the API expects in `types`; `eventType` is the
// singular name each event carries back (and the key used in `counts`).
const TYPES = [
  { key: 'meetings', eventType: 'meeting', label: 'Meetings', icon: 'bi-people', cls: 'primary' },
  { key: 'activities', eventType: 'activity', label: 'Activities', icon: 'bi-clipboard-check', cls: 'info' },
  { key: 'tasks', eventType: 'task', label: 'Task deadlines', icon: 'bi-check2-square', cls: 'success' },
  { key: 'leave', eventType: 'leave', label: 'Leave', icon: 'bi-airplane', cls: 'secondary' },
  { key: 'announcements', eventType: 'announcement', label: 'Announcements', icon: 'bi-megaphone', cls: 'warning' },
  { key: 'followups', eventType: 'follow_up', label: 'Follow-ups', icon: 'bi-arrow-repeat', cls: 'dark' },
  { key: 'requests', eventType: 'request', label: 'Request deadlines', icon: 'bi-inbox', cls: 'danger' },
];

function shiftIso(days: number) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * One feed of everything with a date on it. Nothing here is financial: the
 * endpoint returns operational events only.
 */
export default function CalendarPage() {
  const [start, setStart] = useState(todayIso());
  const [end, setEnd] = useState(shiftIso(30));
  const [active, setActive] = useState<string[]>(TYPES.map((t) => t.key));
  const [search, setSearch] = useState('');

  const types = active.join(',');
  const { data, error, loading, reload } = useFetch('/api/calendar', [start, end, types], {
    start, end, types,
  });

  const days: any[] = data?.days || [];
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return days;
    return days
      .map((d) => ({ ...d, events: d.events.filter((e: any) => (e.title || '').toLowerCase().includes(q)) }))
      .filter((d) => d.events.length > 0);
  }, [days, search]);

  function toggle(key: string) {
    setActive((cur) => (cur.includes(key) ? cur.filter((k) => k !== key) : [...cur, key]));
  }

  return (
    <div className="d-flex flex-column gap-3">
      <PageHeader
        eyebrow="Coordination"
        title="Company Calendar"
        subtitle="Meetings, activities, deadlines, leave and announcements in one window."
      />

      <div className="card">
        <div className="card-body d-flex flex-column gap-3">
          <div className="d-flex flex-wrap align-items-end gap-2">
            <div>
              <label className="form-label small fw-semibold mb-1">From</label>
              <input type="date" className="form-control form-control-sm" value={start}
                onChange={(e) => setStart(e.target.value)} />
            </div>
            <div>
              <label className="form-label small fw-semibold mb-1">To</label>
              <input type="date" className="form-control form-control-sm" value={end}
                onChange={(e) => setEnd(e.target.value)} />
            </div>
            <div className="ms-auto" style={{ minWidth: 220 }}>
              <label className="form-label small fw-semibold mb-1">Search</label>
              <TextInput className="form-control form-control-sm" placeholder="Filter by title…"
                value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
          </div>
          <div className="d-flex flex-wrap gap-2">
            {TYPES.map((t) => (
              <button key={t.key} type="button"
                onClick={() => toggle(t.key)}
                aria-pressed={active.includes(t.key)}
                className={`btn btn-sm ${active.includes(t.key) ? 'btn-primary' : 'btn-outline-secondary'}`}>
                <i className={`bi ${t.icon} me-1`} />
                {t.label}
                {data?.counts?.[t.eventType] !== undefined && (
                  <span className="badge bg-light text-dark ms-1">{data.counts[t.eventType]}</span>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      {loading && <Loading label="Loading calendar…" />}
      {error && <ErrorAlert message={error} onRetry={reload} />}

      {!loading && !error && filtered.length === 0 && (
        <EmptyState message="Nothing scheduled in this window"
          hint="Widen the date range or re-enable a category." icon="bi-calendar-x" />
      )}

      <div className="d-flex flex-column gap-3">
        {filtered.map((day) => (
          <div className="card" key={day.date}>
            <div className="card-header py-2 d-flex justify-content-between align-items-center">
              <span className="fw-semibold">{fmtDate(day.date)}</span>
              <span className="small text-muted">{day.events.length} item{day.events.length === 1 ? '' : 's'}</span>
            </div>
            <ul className="list-group list-group-flush">
              {day.events.map((e: any) => {
                const meta = TYPES.find((t) => t.eventType === e.type);
                return (
                  <li key={`${e.type}-${e.id}`} className="list-group-item">
                    <div className="d-flex justify-content-between align-items-start gap-2 flex-wrap">
                      <div className="d-flex align-items-start gap-2 min-w-0">
                        <i className={`bi ${meta?.icon || 'bi-calendar-event'} text-${meta?.cls || 'secondary'} mt-1`} />
                        <div className="min-w-0">
                          <div className="fw-semibold text-truncate">{e.title}</div>
                          <div className="small text-muted d-flex flex-wrap gap-2">
                            <span><i className="bi bi-clock me-1" />{e.time || 'All day'}</span>
                            {e.location && <span><i className="bi bi-geo-alt me-1" />{e.location}</span>}
                            {e.assignee && <span><i className="bi bi-person me-1" />{e.assignee}</span>}
                            {e.employee && <span><i className="bi bi-person me-1" />{e.employee}</span>}
                            {e.requester && <span><i className="bi bi-person me-1" />{e.requester}</span>}
                            {e.organizer && <span><i className="bi bi-person me-1" />{e.organizer}</span>}
                            {e.end_date && <span><i className="bi bi-calendar-range me-1" />to {fmtDate(e.end_date)}</span>}
                            {e.requires_ack && <span><i className="bi bi-check2-square me-1" />ack required</span>}
                          </div>
                        </div>
                      </div>
                      <div className="d-flex gap-1 align-items-center">
                        {e.priority && <PriorityBadge priority={e.priority} />}
                        {e.is_overdue && <Badge status="overdue" />}
                        <Badge status={e.status} />
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}