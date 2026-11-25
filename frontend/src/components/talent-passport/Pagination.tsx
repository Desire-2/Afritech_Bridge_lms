'use client';

import { Button } from '@/components/ui/button';
import { usePassportI18n } from './TalentPassportProvider';
import { passportButtonClass } from './PassportStates';

export function Pagination({
  page,
  pageSize,
  total,
  onPageChange,
}: {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
}) {
  const { t } = usePassportI18n();
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (total <= pageSize) return null;

  return (
    <div className="mt-6 flex items-center justify-between gap-3">
      <Button
        type="button"
        variant="outline"
        className={passportButtonClass}
        disabled={page <= 1}
        onClick={() => onPageChange(page - 1)}
      >
        {t('previous')}
      </Button>
      <span className="text-sm text-muted-foreground">{t('pageOf', { page, pages })}</span>
      <Button
        type="button"
        variant="outline"
        className={passportButtonClass}
        disabled={page >= pages}
        onClick={() => onPageChange(page + 1)}
      >
        {t('next')}
      </Button>
    </div>
  );
}
