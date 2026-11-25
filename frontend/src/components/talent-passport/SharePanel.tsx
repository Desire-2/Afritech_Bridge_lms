'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Copy, Download, ExternalLink } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { downloadBlob, talentPassportService } from '@/services/talent-passport.service';
import type { VisibilitySettings } from '@/types/talent-passport';
import { usePassportI18n } from './TalentPassportProvider';
import { passportButtonClass, passportCardClass } from './PassportStates';

export function SharePanel({ visibility }: { visibility: VisibilitySettings }) {
  const { t } = usePassportI18n();
  const [message, setMessage] = useState<string | null>(null);
  const url = visibility.public_url ?? null;

  const copy = async () => {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setMessage(t('copied'));
    } catch {
      setMessage(t('copyFailed'));
    }
  };

  const downloadPdf = async () => {
    setMessage(null);
    try {
      const blob = await talentPassportService.exportPdf();
      downloadBlob(blob, 'talent-passport.pdf');
      setMessage(t('exportSuccess'));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : t('exportFailed'));
    }
  };

  return (
    <Card className={passportCardClass}>
      <CardHeader>
        <CardTitle>{t('shareTitle')}</CardTitle>
        <CardDescription>{t('shareDescription')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!url || !visibility.is_published ? (
          <p className="text-sm text-muted-foreground">{t('notPublished')}</p>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <Button className={passportButtonClass} onClick={copy}>
                <Copy className="h-4 w-4" />
                {t('copy')}
              </Button>
              <Button asChild variant="outline" className={passportButtonClass}>
                <Link href={url}>
                  <ExternalLink className="h-4 w-4" />
                  {t('openPublic')}
                </Link>
              </Button>
            </div>
            <div className="rounded-md border bg-muted/40 p-3">
              <p className="text-xs font-medium text-muted-foreground">{t('qrTitle')}</p>
              <p className="break-all text-xs">{url}</p>
              <p className="mt-2 text-xs text-muted-foreground">{t('qrDescription')}</p>
            </div>
          </>
        )}
        <Button variant="outline" className={passportButtonClass} onClick={downloadPdf}>
          <Download className="h-4 w-4" />
          {t('downloadPdf')}
        </Button>
        {message && <p className="text-sm text-muted-foreground">{message}</p>}
      </CardContent>
    </Card>
  );
}
