'use client';

import { useState } from 'react';

import { Pagination } from '@/components/talent-passport/Pagination';
import { PassportPageHeader } from '@/components/talent-passport/PassportPageHeader';
import { AchievementList } from '@/components/talent-passport/RecordLists';
import {
  PassportErrorState,
  PassportSkeleton,
  PassportUnauthorizedState,
} from '@/components/talent-passport/PassportStates';
import { usePassportI18n } from '@/components/talent-passport/TalentPassportProvider';
import { usePassportResource } from '@/components/talent-passport/usePassportResource';
import { talentPassportService } from '@/services/talent-passport.service';

export default function TalentAchievementsPage() {
  const { t } = usePassportI18n();
  const [page, setPage] = useState(1);
  const resource = usePassportResource(
    () => talentPassportService.getAchievements({ page }),
    `achievements:${page}`,
  );

  return (
    <div className="space-y-6">
      <PassportPageHeader
        eyebrow={t('passportTitle')}
        title={t('achievementsTitle')}
        subtitle={t('achievementsSubtitle')}
      />
      {resource.loading && <PassportSkeleton />}
      {resource.status === 401 || resource.status === 403 ? (
        <PassportUnauthorizedState />
      ) : resource.error ? (
        <PassportErrorState message={resource.error.message} onRetry={resource.reload} />
      ) : resource.data ? (
        <>
          <AchievementList data={resource.data} />
          <Pagination
            page={resource.data.page}
            pageSize={resource.data.page_size}
            total={resource.data.total}
            onPageChange={setPage}
          />
        </>
      ) : null}
    </div>
  );
}
