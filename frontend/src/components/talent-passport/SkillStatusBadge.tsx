'use client';

import { Badge } from '@/components/ui/badge';
import type { TalentPassportTranslationKey } from '@/lib/i18n/talent-passport';
import type { SkillState } from '@/types/talent-passport';
import { usePassportI18n } from './TalentPassportProvider';

const STATUS_KEYS: Record<SkillState, TalentPassportTranslationKey> = {
  LEARNING: 'statusLearning',
  EVIDENCE_SUBMITTED: 'statusEvidenceSubmitted',
  DEMONSTRATED: 'statusDemonstrated',
  VERIFIED: 'statusVerified',
};

/** Labels only - the state itself always comes from the backend. */
export function SkillStatusBadge({ status }: { status: SkillState }) {
  const { t } = usePassportI18n();
  const label = STATUS_KEYS[status] ? t(STATUS_KEYS[status]) : String(status);
  const variant =
    status === 'VERIFIED'
      ? 'default'
      : status === 'DEMONSTRATED'
        ? 'secondary'
        : 'outline';

  return (
    <Badge variant={variant} title={status}>
      {label}
    </Badge>
  );
}
