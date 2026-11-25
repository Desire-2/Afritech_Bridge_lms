'use client';

import Link from 'next/link';
import { useState } from 'react';
import { ExternalLink, Settings, RefreshCw } from 'lucide-react';

import { CompletenessCard } from '@/components/talent-passport/CompletenessCard';
import { LearningSummary } from '@/components/talent-passport/LearningSummary';
import { PassportPageHeader } from '@/components/talent-passport/PassportPageHeader';
import {
  PassportErrorState,
  PassportSkeleton,
  PassportUnauthorizedState,
  passportButtonClass,
} from '@/components/talent-passport/PassportStates';
import { usePassportI18n } from '@/components/talent-passport/TalentPassportProvider';
import { usePassportResource } from '@/components/talent-passport/usePassportResource';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { talentPassportService } from '@/services/talent-passport.service';
import { passportCardClass } from '@/components/talent-passport/PassportStates';

function SyncButton() {
  const { t } = usePassportI18n();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        variant="outline"
        className={passportButtonClass}
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setMessage(null);
          try {
            await talentPassportService.sync();
            setMessage(t('syncSuccess'));
          } catch (error) {
            setMessage(error instanceof Error ? error.message : t('syncFailed'));
          } finally {
            setBusy(false);
          }
        }}
      >
        <RefreshCw className="h-4 w-4" />
        {t('syncNow')}
      </Button>
      {message && <span className="text-xs text-muted-foreground">{message}</span>}
    </div>
  );
}

export default function TalentPassportOverviewPage() {
  const { t } = usePassportI18n();
  const resource = usePassportResource(async () => {
    const [overview, completeness, visibility] = await Promise.all([
      talentPassportService.getOverview(),
      talentPassportService.getCompleteness(),
      talentPassportService.getVisibility(),
    ]);
    return { overview, completeness, visibility };
  }, 'overview');

  if (resource.loading) return <PassportSkeleton cards={4} />;
  if (resource.status === 401 || resource.status === 403) return <PassportUnauthorizedState />;
  if (resource.error) {
    return <PassportErrorState message={resource.error.message} onRetry={resource.reload} />;
  }
  if (!resource.data) return <PassportSkeleton cards={2} />;

  const { overview, completeness, visibility } = resource.data;

  return (
    <div className="space-y-6">
      <PassportPageHeader
        eyebrow={t('passportTitle')}
        title={overview.profile.headline || t('passportTitle')}
        subtitle={t('passportSubtitle')}
        backHref="/student/dashboard"
        backLabel={t('backToDashboard')}
        actions={
          <>
            <SyncButton />
            <Button asChild variant="outline" className={passportButtonClass}>
              <Link href="/student/talent-passport/settings">
                <Settings className="h-4 w-4" />
                {t('navSettings')}
              </Link>
            </Button>
            {visibility.is_published && visibility.public_url && (
              <Button asChild className={passportButtonClass}>
                <Link href={visibility.public_url}>
                  <ExternalLink className="h-4 w-4" />
                  {t('openPublic')}
                </Link>
              </Button>
            )}
          </>
        }
      />

      <LearningSummary stats={overview.stats} />

      <div className="grid gap-6 lg:grid-cols-2">
        <CompletenessCard data={completeness} />
        <Card className={passportCardClass}>
          <CardHeader>
            <CardTitle>{t('timelineTitle')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-xs text-muted-foreground">
              {t('lastSynced')}: {overview.last_synced_at || t('notProvided')}
            </p>
            {overview.recent_timeline.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t('timelineEmpty')}</p>
            ) : (
              <ul className="space-y-2">
                {overview.recent_timeline.slice(0, 5).map((event) => (
                  <li key={event.id} className="rounded-md border p-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium">{event.title}</span>
                      <span className="text-xs text-muted-foreground">{event.date || t('notProvided')}</span>
                    </div>
                    {event.description && (
                      <p className="text-xs text-muted-foreground">{event.description}</p>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      {visibility.is_published && visibility.public_url && (
        <p className="text-sm text-muted-foreground">
          {t('shareLink')}:{' '}
          <a href={visibility.public_url} target="_blank" rel="noopener noreferrer" className="break-all text-primary hover:underline">
            {visibility.public_url}
          </a>
        </p>
      )}
    </div>
  );
}
