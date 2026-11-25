'use client';

import { PassportPageHeader } from '@/components/talent-passport/PassportPageHeader';
import { SkillsPanel } from '@/components/talent-passport/SkillsPanel';
import {
  PassportErrorState,
  PassportSkeleton,
  PassportUnauthorizedState,
} from '@/components/talent-passport/PassportStates';
import { usePassportI18n } from '@/components/talent-passport/TalentPassportProvider';
import { usePassportResource } from '@/components/talent-passport/usePassportResource';
import { talentPassportService } from '@/services/talent-passport.service';

export default function TalentSkillsPage() {
  const { t } = usePassportI18n();
  const resource = usePassportResource(() => talentPassportService.getSkills(), 'skills');

  return (
    <div className="space-y-6">
      <PassportPageHeader
        eyebrow={t('passportTitle')}
        title={t('skillsTitle')}
        subtitle={t('skillsSubtitle')}
      />
      {resource.loading && <PassportSkeleton />}
      {resource.status === 401 || resource.status === 403 ? (
        <PassportUnauthorizedState />
      ) : resource.error ? (
        <PassportErrorState message={resource.error.message} onRetry={resource.reload} />
      ) : resource.data ? (
        <SkillsPanel data={resource.data} />
      ) : null}
    </div>
  );
}
