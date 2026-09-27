'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Mail, RefreshCw, AlertTriangle, X } from 'lucide-react';
import { toast } from 'sonner';
import InstructorApiService from '@/services/api/instructor.service';
import { AdminService } from '@/services/admin.service';
import { InactivityDiagnosis, formatInactivityDiagnosis } from '@/types/inactivity';

interface SendWarningsResult {
  warnings_sent: number;
  total_at_risk: number;
  /** Present when the batch found nobody; explains the zero. */
  diagnosis?: InactivityDiagnosis | null;
}

/** Terminal HTTP statuses that retrying will never fix. */
const TERMINAL_STATUSES = [400, 403, 404, 422, 500];

const terminalError = (err: any): string | undefined => {
  const status = err?.response?.status ?? err?.status;
  if (!status || !TERMINAL_STATUSES.includes(status)) return undefined;
  return (
    err?.response?.data?.error ||
    err?.response?.data?.message ||
    err?.message ||
    'Failed to send inactivity warnings.'
  );
};

interface SendInactivityWarningsButtonProps {
  /** Which backend surface to call: instructor (scoped) or admin (platform-wide). */
  scope: 'instructor' | 'admin';
  courseId?: number | null;
  applicationWindowId?: number | null;
  /** Days without study activity before a student is considered inactive. */
  thresholdDays?: number;
  label?: string;
  /** Overrides the auto-generated confirmation copy. */
  description?: string;
  /** Visual theme — 'light' for the instructor pages, 'dark' for the admin console. */
  theme?: 'light' | 'dark';
  /** Extra classes for the trigger button (replaces the theme default). */
  className?: string;
  onSent?: (result: SendWarningsResult) => void;
}

/** ~10 minutes of 2-second polling before giving up on a background task. */
const MAX_POLL_ATTEMPTS = 300;

const DEFAULT_CLASSNAMES = {
  light:
    'bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium ' +
    'flex items-center gap-2 shadow-sm transition-colors',
  dark:
    'bg-[#0d1b2a] hover:bg-[#162844] text-white px-3.5 py-2 rounded-lg text-sm font-medium ' +
    'flex items-center gap-2 shadow-sm transition-colors',
};

const DISABLED_CLASSNAMES = 'disabled:opacity-50 disabled:cursor-not-allowed';

const SendInactivityWarningsButton: React.FC<SendInactivityWarningsButtonProps> = ({
  scope,
  courseId,
  applicationWindowId,
  thresholdDays = 5,
  label = 'Send Inactivity Warnings',
  description,
  theme = 'light',
  className,
  onSent,
}) => {
  const [confirming, setConfirming] = useState(false);
  const [sending, setSending] = useState(false);
  const [taskId, setTaskId] = useState<string | null>(null);

  const aliveRef = useRef(true);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const isScoped = Boolean(courseId || applicationWindowId);

  const resolvedDescription =
    description ??
    (scope === 'admin' && !isScoped
      ? `Every student on the platform who has been inactive for ${thresholdDays}+ days will receive an inactivity warning email.`
      : `Every student ${isScoped ? 'in this course / cohort' : 'in your courses'} who has been inactive for ${thresholdDays}+ days will receive an inactivity warning email.`);

  const reset = () => {
    setSending(false);
    setTaskId(null);
    setConfirming(false);
  };

  const handleSent = (result: SendWarningsResult) => {
    if (!aliveRef.current) return;
    reset();

    if (result.total_at_risk === 0) {
      // An unexplained zero looks like a broken button - say why instead.
      const reason = formatInactivityDiagnosis(result.diagnosis);
      toast.warning('No students matched this inactivity scope — 0 emails sent', {
        description: reason ?? 'Nobody in scope has been inactive for ' +
          `${thresholdDays} day(s).`,
        duration: 12000,
      });
    } else {
      toast.success(
        `Sent ${result.warnings_sent} inactivity warning email(s) ` +
          `to ${result.total_at_risk} at-risk student(s)`
      );
    }
    onSent?.(result);
  };

  const handleFailed = (message: string) => {
    if (!aliveRef.current) return;
    reset();
    toast.error(message);
  };

  const pollForStatus = async (id: string, attempts = 0): Promise<void> => {
    if (!aliveRef.current) return;

    if (attempts >= MAX_POLL_ATTEMPTS) {
      handleFailed('Timed out sending inactivity warnings. Please try again.');
      return;
    }

    try {
      const status =
        scope === 'admin'
          ? await AdminService.getSendWarningsStatus(id)
          : await InstructorApiService.getSendWarningsStatus(id);

      if (typeof status.warnings_sent === 'number') {
        handleSent({
          warnings_sent: status.warnings_sent,
          total_at_risk: status.total_at_risk ?? 0,
          diagnosis: status.diagnosis ?? null,
        });
      } else if (status.status === 'failed') {
        handleFailed(status.error || 'Failed to send inactivity warnings.');
      } else if (
        status.status === 'running' ||
        status.status === 'started' ||
        status.status === 'pending'
      ) {
        timerRef.current = setTimeout(() => pollForStatus(id, attempts + 1), 2000);
      } else {
        // Unknown status: stop polling rather than loop forever.
        handleFailed('Warning task ended unexpectedly. Please try again.');
      }
    } catch (err: any) {
      if (!aliveRef.current) return;
      // The status endpoint answers a failed task with HTTP 500, which axios
      // throws - retrying that for ten minutes just hides the real error.
      const message = terminalError(err);
      if (message) {
        handleFailed(message);
        return;
      }
      // Transient failure (network blip, worker restart) — retry with backoff.
      timerRef.current = setTimeout(() => pollForStatus(id, attempts + 1), 3000);
    }
  };

  const handleConfirm = async () => {
    setSending(true);
    try {
      const response =
        scope === 'admin'
          ? await AdminService.sendInactivityWarnings({
              threshold_days: thresholdDays,
              course_id: courseId,
              application_window_id: applicationWindowId,
            })
          : await InstructorApiService.sendInactivityWarnings(
              thresholdDays,
              courseId ?? undefined,
              applicationWindowId ?? undefined
            );

      if (response.task_id) {
        setTaskId(response.task_id);
        await pollForStatus(response.task_id);
      } else {
        handleSent({
          warnings_sent: (response as any).warnings_sent ?? 0,
          total_at_risk: (response as any).total_at_risk ?? 0,
          diagnosis: (response as any).diagnosis ?? null,
        });
      }
    } catch (err: any) {
      handleFailed(err?.message || 'Failed to send inactivity warnings.');
    }
  };

  const dark = theme === 'dark';

  return (
    <>
      <button
        type="button"
        onClick={() => setConfirming(true)}
        disabled={sending}
        aria-label={label}
        className={`${className ?? DEFAULT_CLASSNAMES[theme]} ${DISABLED_CLASSNAMES}`}
      >
        {sending ? (
          <RefreshCw className="w-4 h-4 animate-spin" />
        ) : (
          <Mail className="w-4 h-4" />
        )}
        {sending ? (taskId ? 'Sending Warnings…' : 'Starting…') : label}
      </button>

      {confirming && (
        <div
          className={`fixed inset-0 z-50 flex items-center justify-center p-4 ${
            dark ? 'bg-black/60' : 'bg-black/50 backdrop-blur-sm'
          }`}
          role="dialog"
          aria-modal="true"
          onClick={() => {
            if (!sending) setConfirming(false);
          }}
        >
          <div
            className={`rounded-xl shadow-xl max-w-md w-full p-6 ${
              dark ? 'bg-[#0d1b2a]' : 'bg-white dark:bg-slate-800'
            }`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4 mb-3">
              <div className="flex items-center gap-3">
                <span
                  className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${
                    dark ? 'bg-amber-500/15 text-amber-400' : 'bg-amber-100 text-amber-600'
                  }`}
                >
                  <AlertTriangle className="w-5 h-5" />
                </span>
                <h3
                  className={`text-lg font-semibold ${
                    dark ? 'text-white' : 'text-slate-900 dark:text-white'
                  }`}
                >
                  Send inactivity warnings?
                </h3>
              </div>
              <button
                type="button"
                aria-label="Close"
                disabled={sending}
                onClick={() => setConfirming(false)}
                className={`${
                  dark ? 'text-gray-500 hover:text-white' : 'text-slate-400 hover:text-slate-600'
                } transition-colors`}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p
              className={`text-sm leading-relaxed mb-6 ${
                dark ? 'text-gray-400' : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              {resolvedDescription} Students with email notifications turned off are skipped.
            </p>

            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setConfirming(false)}
                disabled={sending}
                className={`px-4 py-2 rounded-lg border text-sm font-medium transition-colors disabled:opacity-50 ${
                  dark
                    ? 'border-white/15 text-gray-200 hover:bg-[#0a1628]'
                    : 'border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700'
                }`}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirm}
                disabled={sending}
                className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {sending && <RefreshCw className="w-4 h-4 animate-spin" />}
                {sending ? 'Sending…' : 'Send Warnings'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default SendInactivityWarningsButton;
