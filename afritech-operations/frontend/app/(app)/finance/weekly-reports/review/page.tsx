'use client';

/** Legacy review route now resolves to the single weekly reports workspace. */
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Loading } from '@/components/ui';

export default function WeeklyReportsReviewPage() {
  const router = useRouter();

  useEffect(() => {
    const query = window.location.search;
    router.replace(`/finance/weekly-reports${query}`);
  }, [router]);

  return <Loading label="Opening the weekly reports workspace…" />;
}
