'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

export function DateRange({ start, end, onStart, onEnd }: { start: string; end: string; onStart: (v: string) => void; onEnd: (v: string) => void }) {
  return (
    <div className="d-flex align-items-center gap-2">
      <label className="small text-muted mb-0">From</label>
      <input type="date" className="form-control form-control-sm" value={start} onChange={(e) => onStart(e.target.value)} />
      <label className="small text-muted mb-0">To</label>
      <input type="date" className="form-control form-control-sm" value={end} onChange={(e) => onEnd(e.target.value)} />
    </div>
  );
}

export function useStatic<T = any>(path: string) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    api<T>(path)
      .then(setData)
      .catch((e: any) => setError(e.message));
  }, [path]);
  return { data, error };
}

export function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div className="mb-3">
      <label className="form-label small fw-semibold">
        {label} {required && <span className="text-danger">*</span>}
      </label>
      {children}
    </div>
  );
}

export function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`form-control ${props.className || ''}`} />;
}

export function SelectInput({ children, ...props }: React.SelectHTMLAttributes<HTMLSelectElement> & { children: React.ReactNode }) {
  return (
    <select {...props} className={`form-select ${props.className || ''}`}>
      {children}
    </select>
  );
}

export function TextArea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={`form-control ${props.className || ''}`} rows={props.rows || 3} />;
}