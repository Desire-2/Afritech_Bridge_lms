'use client';

import { useEffect, useState } from 'react';
import { api } from './api';

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
  const [employees, setEmployees] = useState<PickerOption[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
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
  }, []);

  return { employees, loading };
}

/** Reference data for audience pickers (department / branch broadcasts). */
export function useOrgOptions() {
  const [departments, setDepartments] = useState<PickerOption[]>([]);
  const [branches, setBranches] = useState<PickerOption[]>([]);

  useEffect(() => {
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
  }, []);

  return { departments, branches };
}

/** Generic reusable <option> list for a SelectInput. */
export function options(list: PickerOption[]) {
  return list.map((o) => (
    <option key={o.id} value={o.id}>{o.sub ? `${o.label} — ${o.sub}` : o.label}</option>
  ));
}