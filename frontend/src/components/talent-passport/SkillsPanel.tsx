'use client';

import Link from 'next/link';
import { ArrowRight } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { SkillsResponse } from '@/types/talent-passport';
import { usePassportI18n } from './TalentPassportProvider';
import { passportCardClass, PassportEmptyState } from './PassportStates';
import { SkillStatusBadge } from './SkillStatusBadge';

export function SkillsPanel({ data }: { data: SkillsResponse }) {
  const { t } = usePassportI18n();

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">{t('evidenceDisclaimer')}</p>
      {data.items.length === 0 ? (
        <PassportEmptyState description={t('skillsEmpty')} />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {data.items.map((item) => (
            <Card key={item.id} className={passportCardClass}>
              <CardHeader className="flex flex-row items-start justify-between gap-3">
                <div>
                  <CardTitle className="text-base">{item.skill.name}</CardTitle>
                  <p className="text-xs text-muted-foreground">
                    {item.skill.category || item.skill.key}
                  </p>
                </div>
                <SkillStatusBadge status={item.status} />
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="flex justify-between gap-3">
                  <span className="text-muted-foreground">{t('proficiency')}</span>
                  <span>{item.proficiency_level || t('notProvided')}</span>
                </div>
                <div className="flex justify-between gap-3">
                  <span className="text-muted-foreground">{t('evidenceCount')}</span>
                  <span>{item.evidence_count}</span>
                </div>
                <div className="flex justify-between gap-3">
                  <span className="text-muted-foreground">{t('latestEvidence')}</span>
                  <span>{item.latest_evidence_at || t('notProvided')}</span>
                </div>
                <Button asChild variant="link" className="-ml-4">
                  <Link href={`/student/talent-passport/skills/${item.id}/evidence`}>
                    {t('viewEvidence')}
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
