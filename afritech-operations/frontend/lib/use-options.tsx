'use client';

import { useEffect, useState } from 'react';
import { api, can } from './api';
import { useAuth } from './auth';
import { P } from './permissions';

export type PickerOption = { id: number; label: string; sub?: string };

function toOption(e: any): PickerOption {
  const dept = e.department?.name || e.department_name;
  return {
    id: e.id,
    label: e.full_name || e.name || `Employee ${e.id}`,
    sub: [e.position, dept].filter(Boolean).join(' · ') || undefined,
  };
}

/**
 * Employee options for coordinator pickers.
 *
 * The Service Agent exclusion is applied server-side by `/api/employees`, so the
 * Secretary's pickers cannot offer an agent even if the filter were bypassed.
 */
export function useEmployeeOptions() {
  const { user } = useAuth();
  // `GET /api/employees` needs employees.view. Roles that only *read* a
  // coordination page (Instructor, Service Agent) never open the pickers this
  // feeds, so don't fire a request they are not allowed to make — it only
  // produced a 403 on every visit. Every role that holds a `.manage` right
  // behind those pickers also holds employees.view, so nothing is lost.
  const mayRead = can(user, P.employeesView);
  const [employees, setEmployees] = useState<PickerOption[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!mayRead) {
      setEmployees([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    api<any>('/api/employees?per_page=500&status=active')
      .then((d) => {
        if (cancelled) return;
        setEmployees((d?.items || []).map(toOption));
      })
      .catch(() => {
        if (!cancelled) setEmployees([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [mayRead]);

  return { employees, loading };
}

/** Reference data for audience pickers (department / branch broadcasts). */
export function useOrgOptions() {
  const { user } = useAuth();
  // Same rule as useEmployeeOptions: departments/branches need employees.view.
  const mayRead = can(user, P.employeesView);
  const [departments, setDepartments] = useState<PickerOption[]>([]);
  const [branches, setBranches] = useState<PickerOption[]>([]);

  useEffect(() => {
    if (!mayRead) {
      setDepartments([]);
      setBranches([]);
      return;
    }
    let cancelled = false;
    Promise.all([
      api<any>('/api/employees/departments').catch(() => ({ departments: [] })),
      api<any>('/api/employees/branches').catch(() => ({ branches: [] })),
    ]).then(([d, b]) => {
      if (cancelled) return;
      setDepartments((d.departments || []).map((x: any) => ({ id: x.id, label: x.name })));
      setBranches((b.branches || []).map((x: any) => ({ id: x.id, label: x.name })));
    });
    return () => { cancelled = true; };
  }, [mayRead]);

  return { departments, branches };
}

/** Generic reusable <option> list for a SelectInput. */
export function options(list: PickerOption[]) {
  return list.map((o) => (
    <option key={o.id} value={o.id}>{o.sub ? `${o.label} — ${o.sub}` : o.label}</option>
  ));
}