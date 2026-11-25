'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import type { CompletenessResponse } from '@/types/talent-passport';
import { usePassportI18n } from './TalentPassportProvider';
import { passportCardClass } from './PassportStates';

export function CompletenessCard({ data }: { data: CompletenessResponse }) {
  const { t } = usePassportI18n();
  const score = Math.max(0, Math.min(100, data.score));

  return (
    <Card className={passportCardClass}>
      <CardHeader>
        <CardTitle>{t('completenessTitle')}</CardTitle>
        <CardDescription>{t('completenessDescription')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-end justify-between">
          <span className="text-3xl font-semibold">{score}%</span>
          <span className="text-xs text-muted-foreground">{t('completenessScore')}</span>
        </div>
        <Progress value={score} aria-label={t('completenessTitle')} />
        {data.items.length > 0 ? (
          <ul className="space-y-2">
            {data.items.map((item) => (
              <li key={item.key} className="flex items-center justify-between text-sm">
                <span>{item.label}</span>
                <span className={item.completed ? 'text-green-600' : 'text-muted-foreground'}>
                  {item.completed ? t('yes') : t('no')}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">{t('completenessEmpty')}</p>
        )}
      </CardContent>
    </Card>
  );
}
