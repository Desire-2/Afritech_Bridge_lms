'use client';

import { Award, BookOpen, FolderGit2, GraduationCap, Layers, Trophy } from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { PassportStats } from '@/types/talent-passport';
import { usePassportI18n } from './TalentPassportProvider';
import { passportCardClass } from './PassportStates';

const ICONS = [BookOpen, GraduationCap, Layers, Award, FolderGit2, Trophy];

export function LearningSummary({ stats }: { stats: PassportStats }) {
  const { t } = usePassportI18n();
  const values: Array<[string, number]> = [
    [t('inProgress'), stats.courses_in_progress],
    [t('completed'), stats.courses_completed],
    [t('statusLearning'), stats.skills_learning],
    [t('statusDemonstrated'), stats.skills_demonstrated],
    [t('skillsCount'), stats.skills_verified],
    [t('projectsTitle'), stats.projects],
    [t('certificatesTitle'), stats.certificates],
    [t('achievementsTitle'), stats.achievements],
  ];

  return (
    <Card className={passportCardClass}>
      <CardHeader>
        <CardTitle>{t('learningTitle')}</CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {values.map(([label, value], index) => {
          const Icon = ICONS[index % ICONS.length];
          return (
            <div key={`${label}-${index}`} className="rounded-lg border p-3">
              <Icon className="mb-2 h-4 w-4 text-muted-foreground" aria-hidden="true" />
              <div className="text-xl font-semibold">{value}</div>
              <div className="text-xs text-muted-foreground">{label}</div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
