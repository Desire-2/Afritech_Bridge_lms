'use client';

import { useParams } from 'next/navigation';

import { EvidenceList } from '@/components/talent-passport/EvidenceList';
import { PassportPageHeader } from '@/components/talent-passport/PassportPageHeader';
import {
  PassportErrorState,
  PassportSkeleton,
  PassportUnauthorizedState,
} from '@/components/talent-passport/PassportStates';
import { usePassportI18n } from '@/components/talent-passport/TalentPassportProvider';
import { usePassportResource } from '@/components/talent-passport/usePassportResource';
import { talentPassportService } from '@/services/talent-passport.service';

export default function SkillEvidencePage() {
  const { t } = usePassportI18n();
  const params = useParams<{ skillId: string }>();
  const skillId = params.skillId;

  const resource = usePassportResource(async () => {
    const [evidence, skills] = await Promise.all([
      talentPassportService.getEvidence(skillId),
      talentPassportService.getSkills(),
    ]);
    const skill = skills.items.find((item) => String(item.id) === String(skillId));
    return { evidence, skillName: skill?.skill.name ?? null };
  }, skillId);

  return (
    <div className="space-y-6">
      <PassportPageHeader
        eyebrow={t('skillsTitle')}
        title={resource.data?.skillName ?? t('evidenceTitle')}
        subtitle={t('skillsSubtitle')}
        backHref="/student/talent-passport/skills"
        backLabel={t('navSkills')}
      />
      {resource.loading && <PassportSkeleton cards={2} />}
      {resource.status === 401 || resource.status === 403 ? (
        <PassportUnauthorizedState />
      ) : resource.error ? (
        <PassportErrorState message={resource.error.message} onRetry={resource.reload} />
      ) : resource.data ? (
        <EvidenceList data={resource.data.evidence} />
      ) : null}
    </div>
  );
}
