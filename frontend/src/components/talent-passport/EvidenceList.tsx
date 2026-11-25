'use client';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { EvidenceResponse, SkillEvidence } from '@/types/talent-passport';
import { usePassportI18n } from './TalentPassportProvider';
import { passportCardClass, PassportEmptyState } from './PassportStates';

function gradingLabel(value: string | null, t: (key: 'provisional' | 'awaitingReview' | 'approved' | 'updated' | 'verified') => string) {
  switch (value) {
    case 'provisional':
      return t('provisional');
    case 'awaiting_review':
      return t('awaitingReview');
    case 'approved':
      return t('approved');
    case 'updated':
      return t('updated');
    case 'verified':
      return t('verified');
    default:
      return value || '—';
  }
}

function EvidenceRow({ item }: { item: SkillEvidence }) {
  const { t } = usePassportI18n();
  return (
    <li className="rounded-lg border p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-medium">{item.title}</p>
          <p className="text-xs text-muted-foreground">
            {item.course?.title || item.source_type || t('source')}
            {item.happened_at ? ` · ${item.happened_at}` : ''}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {item.score !== null && <Badge variant="secondary">{t('scoreLabel')}: {item.score}</Badge>}
          {item.verification_status && <Badge variant="outline">{item.verification_status}</Badge>}
          <Badge variant="outline">{gradingLabel(item.grading_state, t)}</Badge>
        </div>
      </div>
      {item.status && <p className="mt-2 text-xs text-muted-foreground">{item.status}</p>}
    </li>
  );
}

export function EvidenceList({ data }: { data: EvidenceResponse }) {
  const { t } = usePassportI18n();
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">{t('verificationNote')}</p>
      {data.items.length === 0 ? (
        <PassportEmptyState title={t('evidenceTitle')} description={t('evidenceEmpty')} />
      ) : (
        <Card className={passportCardClass}>
          <CardHeader>
            <CardTitle>{t('evidenceTitle')}</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3">
              {data.items.map((item) => (
                <EvidenceRow key={item.id} item={item} />
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
