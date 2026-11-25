'use client';

import { useState } from 'react';

import { DocumentPanel } from '@/components/talent-passport/DocumentPanel';
import { PassportPageHeader } from '@/components/talent-passport/PassportPageHeader';
import { ProfessionalProfilePanel } from '@/components/talent-passport/ProfessionalProfilePanel';
import {
  PassportErrorState,
  PassportSkeleton,
  PassportUnauthorizedState,
} from '@/components/talent-passport/PassportStates';
import { usePassportI18n } from '@/components/talent-passport/TalentPassportProvider';
import { SharePanel } from '@/components/talent-passport/SharePanel';
import { VisibilityPanel } from '@/components/talent-passport/VisibilityPanel';
import { usePassportResource } from '@/components/talent-passport/usePassportResource';
import { talentPassportService } from '@/services/talent-passport.service';
import type { VisibilitySettings } from '@/types/talent-passport';

export default function TalentSettingsPage() {
  const { t } = usePassportI18n();
  const [visibilityOverride, setVisibilityOverride] = useState<VisibilitySettings | null>(null);
  const [profileNonce, setProfileNonce] = useState(0);

  const resource = usePassportResource(async () => {
    const [profile, visibility, taxonomy] = await Promise.all([
      talentPassportService.getProfile(),
      talentPassportService.getVisibility(),
      talentPassportService.getTaxonomy().catch(() => null),
    ]);
    return { profile, visibility, taxonomy };
  }, `settings:${profileNonce}`);

  if (resource.loading) return <><PassportPageHeader title={t('settingsTitle')} subtitle={t('settingsSubtitle')} /><PassportSkeleton cards={3} /></>;
  if (resource.status === 401 || resource.status === 403) return <PassportUnauthorizedState />;
  if (resource.error) {
    return <PassportErrorState message={resource.error.message} onRetry={resource.reload} />;
  }
  if (!resource.data) return <PassportSkeleton cards={3} />;

  const visibility = visibilityOverride ?? resource.data.visibility;

  return (
    <div className="space-y-6">
      <PassportPageHeader
        eyebrow={t('passportTitle')}
        title={t('settingsTitle')}
        subtitle={t('settingsSubtitle')}
      />
      <ProfessionalProfilePanel
        key={profileNonce}
        profile={resource.data.profile.profile}
        taxonomy={resource.data.taxonomy}
        onSaved={() => setProfileNonce((value) => value + 1)}
      />
      <VisibilityPanel
        key={`visibility-${visibility.public_slug ?? 'draft'}-${visibility.is_published}`}
        visibility={visibility}
        onSaved={(next) => setVisibilityOverride(next)}
      />
      <SharePanel visibility={visibility} />
      <DocumentPanel />
    </div>
  );
}
