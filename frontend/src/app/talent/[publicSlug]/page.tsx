'use client';

import { useParams } from 'next/navigation';

import {
  PassportErrorState,
  PassportGoneState,
  PassportNotFoundState,
  PassportSkeleton,
} from '@/components/talent-passport/PassportStates';
import {
  LanguageSwitcher,
  TalentPassportProvider,
  usePassportI18n,
} from '@/components/talent-passport/TalentPassportProvider';
import { PublicPassportView } from '@/components/talent-passport/PublicPassportView';
import { usePassportResource } from '@/components/talent-passport/usePassportResource';
import { talentPassportService } from '@/services/talent-passport.service';
import { serializePublicPassport } from '@/types/talent-passport';

function PublicPassportContent({ slug }: { slug: string }) {
  const { t } = usePassportI18n();
  const resource = usePassportResource(() => talentPassportService.getPublicPassport(slug), slug);

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto flex w-full max-w-5xl items-center justify-end px-4 pt-4">
        <LanguageSwitcher />
      </div>
      {resource.loading && <PassportSkeleton cards={3} />}
      {resource.status === 404 ? (
        <div className="mx-auto max-w-5xl px-4 py-8"><PassportNotFoundState /></div>
      ) : resource.status === 410 ? (
        <div className="mx-auto max-w-5xl px-4 py-8"><PassportGoneState /></div>
      ) : resource.status === 401 || resource.status === 403 ? (
        <div className="mx-auto max-w-5xl px-4 py-8"><PassportNotFoundState /></div>
      ) : resource.error ? (
        <div className="mx-auto max-w-5xl px-4 py-8">
          <PassportErrorState message={resource.error.message} onRetry={resource.reload} />
        </div>
      ) : resource.data ? (
        <PublicPassportView view={serializePublicPassport(resource.data)} slug={slug} />
      ) : (
        <div className="mx-auto max-w-5xl px-4 py-8">
          <PassportErrorState message={t('publicNotFoundDescription')} onRetry={resource.reload} />
        </div>
      )}
    </div>
  );
}

export default function PublicTalentPassportPage() {
  const params = useParams<{ publicSlug: string }>();
  return (
    <TalentPassportProvider>
      <PublicPassportContent slug={params.publicSlug} />
    </TalentPassportProvider>
  );
}
