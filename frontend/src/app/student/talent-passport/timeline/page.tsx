'use client';

import { useState } from 'react';

import { Pagination } from '@/components/talent-passport/Pagination';
import { PassportPageHeader } from '@/components/talent-passport/PassportPageHeader';
import { TimelineList } from '@/components/talent-passport/RecordLists';
import {
  PassportErrorState,
  PassportSkeleton,
  PassportUnauthorizedState,
} from '@/components/talent-passport/PassportStates';
import { usePassportI18n } from '@/components/talent-passport/TalentPassportProvider';
import { usePassportResource } from '@/components/talent-passport/usePassportResource';
import { talentPassportService } from '@/services/talent-passport.service';

export default function TalentTimelinePage() {
  const { t } = usePassportI18n();
  const [page, setPage] = useState(1);
  const resource = usePassportResource(
    () => talentPassportService.getTimeline({ page }),
    `timeline:${page}`,
  );

  return (
    <div className="space-y-6">
      <PassportPageHeader
        eyebrow={t('passportTitle')}
        title={t('navTimeline')}
        subtitle={t('timelineTitle')}
      />
      {resource.loading && <PassportSkeleton cards={2} />}
      {resource.status === 401 || resource.status === 403 ? (
        <PassportUnauthorizedState />
      ) : resource.error ? (
        <PassportErrorState message={resource.error.message} onRetry={resource.reload} />
      ) : resource.data ? (
        <>
          <TimelineList data={resource.data} />
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
