'use client';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type {
  AchievementsResponse,
  CertificatesResponse,
  TimelineResponse,
} from '@/types/talent-passport';
import { usePassportI18n } from './TalentPassportProvider';
import { passportCardClass, PassportEmptyState } from './PassportStates';

export function CertificateList({ data }: { data: CertificatesResponse }) {
  const { t } = usePassportI18n();
  return (
    <div className="space-y-3">
      {data.items.length === 0 ? (
        <PassportEmptyState description={t('certificatesEmpty')} />
      ) : (
        data.items.map((item) => (
          <Card key={item.id} className={passportCardClass}>
            <CardHeader className="flex flex-row items-start justify-between gap-3">
              <CardTitle className="text-base">{item.title}</CardTitle>
              <Badge variant="outline">{item.status}</Badge>
            </CardHeader>
            <CardContent className="grid gap-2 text-sm text-muted-foreground md:grid-cols-2">
              <p>{t('certificateNumber')}: {item.certificate_number}</p>
              <p>{item.course?.title || t('notProvided')}</p>
              <p>{t('issuedOn')}: {item.issued_at || t('notProvided')}</p>
              <p>{t('expiresOn')}: {item.expires_at || t('noExpiry')}</p>
              {item.verification_url && (
                <a
                  href={item.verification_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="break-all text-primary hover:underline"
                >
                  {t('viewCertificate')}
                </a>
              )}
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
}

export function AchievementList({ data }: { data: AchievementsResponse }) {
  const { t } = usePassportI18n();
  return (
    <div className="space-y-3">
      {data.items.length === 0 ? (
        <PassportEmptyState description={t('achievementsEmpty')} />
      ) : (
        data.items.map((item) => (
          <Card key={item.id} className={passportCardClass}>
            <CardHeader className="flex flex-row items-start justify-between gap-3">
              <CardTitle className="text-base">{item.title}</CardTitle>
              <span className="text-2xl" aria-hidden="true">{item.icon || '★'}</span>
            </CardHeader>
            <CardContent className="space-y-1 text-sm text-muted-foreground">
              {item.description && <p>{item.description}</p>}
              <p>{t('earnedOn')}: {item.earned_at || t('notProvided')}</p>
              {item.source_type && <p>{t('achievementSource')}: {item.source_type}</p>}
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
}

export function TimelineList({ data }: { data: TimelineResponse }) {
  const { t } = usePassportI18n();
  return (
    <Card className={passportCardClass}>
      <CardHeader>
        <CardTitle>{t('timelineTitle')}</CardTitle>
      </CardHeader>
      <CardContent>
        {data.items.length === 0 ? (
          <PassportEmptyState description={t('timelineEmpty')} />
        ) : (
          <ol className="space-y-4">
            {data.items.map((item) => (
              <li key={item.id} className="flex gap-3 border-l-2 pl-4">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-medium">{item.title}</p>
                    <span className="text-xs text-muted-foreground">{item.date || t('notProvided')}</span>
                  </div>
                  {item.description && <p className="text-sm text-muted-foreground">{item.description}</p>}
                  <div className="mt-1 flex flex-wrap gap-2 text-xs text-muted-foreground">
                    <span>{item.kind}</span>
                    {item.status && <Badge variant="outline">{item.status}</Badge>}
                  </div>
                </div>
              </li>
            ))}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}
