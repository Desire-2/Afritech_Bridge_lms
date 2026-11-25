'use client';

import { useState } from 'react';

import { Pagination } from '@/components/talent-passport/Pagination';
import { PassportPageHeader } from '@/components/talent-passport/PassportPageHeader';
import { PortfolioPanel } from '@/components/talent-passport/PortfolioPanel';
import {
  PassportErrorState,
  PassportSkeleton,
  PassportUnauthorizedState,
} from '@/components/talent-passport/PassportStates';
import { usePassportI18n } from '@/components/talent-passport/TalentPassportProvider';
import { usePassportResource } from '@/components/talent-passport/usePassportResource';
import { talentPassportService } from '@/services/talent-passport.service';

export default function TalentProjectsPage() {
  const { t } = usePassportI18n();
  const [page, setPage] = useState(1);
  const [nonce, setNonce] = useState(0);
  const resource = usePassportResource(
    () => talentPassportService.getProjects({ page, page_size: 20 }),
    `${page}:${nonce}`,
  );

  return (
    <div className="space-y-6">
      <PassportPageHeader
        eyebrow={t('passportTitle')}
        title={t('projectsTitle')}
        subtitle={t('projectsSubtitle')}
      />
      {resource.loading && <PassportSkeleton />}
      {resource.status === 401 || resource.status === 403 ? (
        <PassportUnauthorizedState />
      ) : resource.error ? (
        <PassportErrorState message={resource.error.message} onRetry={resource.reload} />
      ) : resource.data ? (
        <>
          <PortfolioPanel data={resource.data} onChanged={() => setNonce((value) => value + 1)} />
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
