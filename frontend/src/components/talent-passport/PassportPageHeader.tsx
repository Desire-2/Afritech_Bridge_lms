'use client';

import Image from 'next/image';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { ArrowLeft } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { usePassportI18n } from './TalentPassportProvider';

export function PassportPageHeader({
  eyebrow,
  title,
  subtitle,
  backHref = '/student/talent-passport',
  backLabel,
  actions,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  backHref?: string;
  backLabel?: string;
  actions?: ReactNode;
}) {
  const { t } = usePassportI18n();
  return (
    <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
      <div className="flex items-start gap-4">
        <div className="shrink-0 rounded-lg border bg-white p-1.5 shadow-sm" aria-hidden="true">
          <Image
            src="/logo.jpg"
            alt=""
            width={44}
            height={44}
            priority
            className="h-11 w-11 rounded-md object-contain"
          />
        </div>
        <div className="space-y-2">
          {backHref && (
            <Button asChild variant="ghost" size="sm" className="-ml-2">
              <Link href={backHref}>
                <ArrowLeft className="h-4 w-4" />
                {backLabel ?? t('backToPassport')}
              </Link>
            </Button>
          )}
          {eyebrow && (
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {eyebrow}
            </p>
          )}
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          {subtitle && <p className="max-w-2xl text-sm text-muted-foreground">{subtitle}</p>}
        </div>
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}
