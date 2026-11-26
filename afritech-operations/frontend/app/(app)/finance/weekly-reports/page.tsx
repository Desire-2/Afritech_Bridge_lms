'use client';

/** Entry point: agents keep the guided flow; reviewers get one management workspace. */
import { useEffect, useState } from 'react';
import { can } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { P } from '@/lib/permissions';
import { EmptyState, Loading, PageHeader } from '@/components/ui';
import { useWeeklyI18n, WeeklyLangSwitcher } from '@/lib/weekly-i18n';
import AgentWeeklyFlow from '@/components/weekly/AgentWeeklyFlow';
import WeeklyManagementWorkspace from '@/components/weekly/WeeklyManagementWorkspace';

export default function WeeklyReportsPage() {
  const { user, loading } = useAuth();
  const { t } = useWeeklyI18n();
  const [deepLink, setDeepLink] = useState<{ report?: number; shortage?: boolean }>({});

  // Keep the existing agent shortcuts (?report=<id>&tab=shortage) working. The
  // management workspace parses the same URL itself for reviewers.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const report = Number(params.get('report'));
    setDeepLink({
      report: Number.isInteger(report) && report > 0 ? report : undefined,
      shortage: params.get('tab') === 'shortage',
    });
  }, []);

  if (loading) return <Loading label={t('ui.label.loading')} />;
  if (!can(user, P.weeklyReportsView)) {
    return <EmptyState message={t('ui.error.accessDenied')} icon="bi-shield-lock" />;
  }

  const guidedAgent = can(user, P.weeklyReportsSubmit)
    && !can(user, P.weeklyReportsReview)
    && !can(user, P.weeklyReportsManage)
    && !user?.is_super_admin;

  if (guidedAgent) {
    return (
      <div>
        <PageHeader
          title={t('ui.agent.title')}
          subtitle={t('ui.agent.subtitle')}
          actions={<WeeklyLangSwitcher />}
        />
        <AgentWeeklyFlow initialReportId={deepLink.report}
          focusDeclaration={deepLink.shortage} />
      </div>
    );
  }

  return <WeeklyManagementWorkspace />;
}
