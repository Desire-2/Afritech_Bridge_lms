'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { AlertCircle, Inbox, Lock, Search, Unplug } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { usePassportI18n } from './TalentPassportProvider';

/** Shared sizing so every passport control meets touch targets. */
export const passportButtonClass = 'min-h-11 focus-visible:ring-2 focus-visible:ring-offset-2';
export const passportCardClass = 'border-border shadow-none';

export function PassportSkeleton({ cards = 3 }: { cards?: number }) {
  const { t } = usePassportI18n();
  return (
    <div className="space-y-6" role="status" aria-live="polite" aria-busy="true">
      <p className="sr-only">{t('loadingContent')}</p>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: cards }).map((_, index) => (
          <Card key={index} className={passportCardClass}>
            <CardContent className="space-y-3 p-5">
              <Skeleton className="h-4 w-1/3" />
              <Skeleton className="h-8 w-2/3" />
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-4/5" />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

function StateCard({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <Card className={`${passportCardClass} border-dashed`}>
      <CardContent className="flex flex-col items-center gap-3 px-6 py-10 text-center">
        <div className="flex h-11 w-11 items-center justify-center rounded-full bg-muted text-muted-foreground">
          {icon}
        </div>
        {children}
      </CardContent>
    </Card>
  );
}

export function PassportEmptyState({
  title,
  description,
  icon,
  action,
}: {
  title?: string;
  description?: string;
  icon?: ReactNode;
  action?: ReactNode;
}) {
  const { t } = usePassportI18n();
  return (
    <StateCard icon={icon ?? <Inbox className="h-5 w-5" aria-hidden="true" />}>
      <div className="space-y-1">
        <p className="font-medium text-foreground">{title ?? t('emptyTitle')}</p>
        {description && <p className="text-sm text-muted-foreground">{description}</p>}
      </div>
      {action}
    </StateCard>
  );
}

export function PassportErrorState({
  message,
  onRetry,
}: {
  message?: string | null;
  onRetry?: () => void;
}) {
  const { t } = usePassportI18n();
  return (
    <StateCard icon={<AlertCircle className="h-5 w-5 text-destructive" aria-hidden="true" />}>
      <div className="space-y-1">
        <p className="font-medium text-foreground">{t('errorTitle')}</p>
        <p className="text-sm text-muted-foreground">{message || t('errorDescription')}</p>
      </div>
      {onRetry && (
        <Button type="button" variant="outline" className={passportButtonClass} onClick={onRetry}>
          {t('retry')}
        </Button>
      )}
    </StateCard>
  );
}

export function PassportUnauthorizedState() {
  const { t } = usePassportI18n();
  return (
    <StateCard icon={<Lock className="h-5 w-5" aria-hidden="true" />}>
      <div className="space-y-1">
        <p className="font-medium text-foreground">{t('unauthorizedTitle')}</p>
        <p className="text-sm text-muted-foreground">{t('unauthorizedDescription')}</p>
      </div>
      <Button asChild variant="outline" className={passportButtonClass}>
        <Link href="/auth/login">{t('backToSite')}</Link>
      </Button>
    </StateCard>
  );
}

export function PassportNotFoundState() {
  const { t } = usePassportI18n();
  return (
    <StateCard icon={<Search className="h-5 w-5" aria-hidden="true" />}>
      <div className="space-y-1">
        <p className="font-medium text-foreground">{t('publicNotFound')}</p>
        <p className="text-sm text-muted-foreground">{t('publicNotFoundDescription')}</p>
      </div>
      <Button asChild variant="outline" className={passportButtonClass}>
        <Link href="/">{t('backToSite')}</Link>
      </Button>
    </StateCard>
  );
}

export function PassportGoneState() {
  const { t } = usePassportI18n();
  return (
    <StateCard icon={<Unplug className="h-5 w-5" aria-hidden="true" />}>
      <div className="space-y-1">
        <p className="font-medium text-foreground">{t('publicGone')}</p>
        <p className="text-sm text-muted-foreground">{t('publicGoneDescription')}</p>
      </div>
      <Button asChild variant="outline" className={passportButtonClass}>
        <Link href="/">{t('backToSite')}</Link>
      </Button>
    </StateCard>
  );
}
