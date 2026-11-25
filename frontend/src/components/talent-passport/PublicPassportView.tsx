'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Download } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { downloadBlob, talentPassportService } from '@/services/talent-passport.service';
import {
  enabledPublicSections,
  type PublicPassportView as PassportView,
  type SkillState,
} from '@/types/talent-passport';
import { usePassportI18n } from './TalentPassportProvider';
import { SkillStatusBadge } from './SkillStatusBadge';
import { passportButtonClass, passportCardClass, PassportEmptyState } from './PassportStates';

const text = (value: unknown): string | null =>
  typeof value === 'string' && value.length > 0 ? value : null;
const list = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];

function Field({ label, value }: { label: string; value: unknown }) {
  const content = text(value);
  if (!content) return null;
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="text-sm">{content}</p>
    </div>
  );
}

function TagList({ label, values }: { label: string; values: unknown }) {
  const items = list(values);
  if (items.length === 0) return null;
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <div className="mt-1 flex flex-wrap gap-1">
        {items.map((item) => <Badge key={item} variant="secondary">{item}</Badge>)}
      </div>
    </div>
  );
}

function ExternalLinks({ profile }: { profile: PassportView['profile'] }) {
  const { t } = usePassportI18n();
  const links = [
    [profile.portfolio_url, t('portfolio')],
    [profile.github_url, t('github')],
    [profile.linkedin_url, t('linkedin')],
  ] as const;
  const other = Array.isArray(profile.other_links)
    ? profile.other_links
        .map((link) => (typeof link === 'string' ? { label: link, url: link } : link))
        .filter((link): link is { label?: string | null; url?: string | null } => Boolean(link.url))
    : [];

  const entries = [
    ...links.filter((entry): entry is readonly [string, string] => Boolean(entry[0])),
    ...other.map((link) => [link.url ?? '', link.label ?? link.url ?? ''] as const),
  ];

  if (entries.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-3">
      {entries.map(([url, label]) => (
        <a key={url} href={url} target="_blank" rel="noopener noreferrer" className="text-sm text-primary hover:underline">
          {label}
        </a>
      ))}
    </div>
  );
}

function ProfileSection({ profile }: { profile: PassportView['profile'] }) {
  const { t } = usePassportI18n();
  return (
    <Card className={passportCardClass}>
      <CardHeader>
        <CardTitle>{text(profile.name) ?? t('professionalProfileTitle')}</CardTitle>
        {text(profile.headline) && <p className="text-sm text-muted-foreground">{profile.headline}</p>}
      </CardHeader>
      <CardContent className="space-y-4">
        {text(profile.summary) && <p className="text-sm">{profile.summary}</p>}
        <div className="grid gap-3 md:grid-cols-2">
          <Field label={t('location')} value={[profile.city, profile.country].filter(Boolean).join(', ')} />
          <Field label={t('goals')} value={profile.professional_goals} />
          <Field label={t('workArrangement')} value={profile.preferred_work_arrangement} />
        </div>
        <TagList label={t('interests')} values={profile.career_interests} />
        <TagList label={t('specializations')} values={profile.areas_of_specialization} />
        <TagList label={t('opportunities')} values={profile.preferred_opportunities} />
        <TagList label={t('languages')} values={profile.languages} />
        <ExternalLinks profile={profile} />
        {profile.show_email === true && text(profile.email) && (
          <Field label="Email" value={profile.email} />
        )}
        {profile.show_phone === true && text(profile.phone) && (
          <Field label="Phone" value={profile.phone} />
        )}
      </CardContent>
    </Card>
  );
}

function SkillsSection({ items }: { items: Array<Record<string, unknown>> }) {
  const { t } = usePassportI18n();
  return (
    <Card className={passportCardClass}>
      <CardHeader><CardTitle>{t('sectionSkills')}</CardTitle></CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <PassportEmptyState description={t('skillsEmpty')} />
        ) : (
          <ul className="grid gap-3 md:grid-cols-2">
            {items.map((item, index) => {
              const nested = item.skill && typeof item.skill === 'object'
                ? (item.skill as Record<string, unknown>)
                : {};
              const name = text(nested.name) ?? text(item.name) ?? text(nested.key) ?? text(item.key);
              const state = text(item.status);
              const valid = ['LEARNING', 'EVIDENCE_SUBMITTED', 'DEMONSTRATED', 'VERIFIED'];
              return (
                <li key={text(item.id) ?? index} className="flex items-center justify-between gap-3 rounded-lg border p-3">
                  <span className="text-sm font-medium">{name ?? t('notProvided')}</span>
                  {state && valid.includes(state) ? (
                    <SkillStatusBadge status={state as SkillState} />
                  ) : state ? (
                    <Badge variant="outline">{state}</Badge>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function ProjectsSection({ items }: { items: Array<Record<string, unknown>> }) {
  const { t } = usePassportI18n();
  return (
    <Card className={passportCardClass}>
      <CardHeader><CardTitle>{t('sectionProjects')}</CardTitle></CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <PassportEmptyState description={t('projectsEmpty')} />
        ) : (
          <ul className="grid gap-3 md:grid-cols-2">
            {items.map((item, index) => (
              <li key={text(item.id) ?? index} className="space-y-2 rounded-lg border p-4">
                <p className="font-medium">{text(item.title) ?? t('notProvided')}</p>
                {text(item.description) && <p className="text-sm text-muted-foreground">{text(item.description)}</p>}
                {list(item.technologies).length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {list(item.technologies).map((technology) => (
                      <Badge key={technology} variant="secondary">{technology}</Badge>
                    ))}
                  </div>
                )}
                {text(item.external_url) && (
                  <a href={text(item.external_url) ?? '#'} target="_blank" rel="noopener noreferrer" className="block break-all text-sm text-primary hover:underline">
                    {text(item.external_url)}
                  </a>
                )}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function CertificatesSection({ items }: { items: Array<Record<string, unknown>> }) {
  const { t } = usePassportI18n();
  return (
    <Card className={passportCardClass}>
      <CardHeader><CardTitle>{t('sectionCertificates')}</CardTitle></CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <PassportEmptyState description={t('certificatesEmpty')} />
        ) : (
          <ul className="space-y-3">
            {items.map((item, index) => (
              <li key={text(item.id) ?? index} className="rounded-lg border p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-medium">{text(item.title) ?? t('notProvided')}</span>
                  {text(item.status) && <Badge variant="outline">{text(item.status)}</Badge>}
                </div>
                {text(item.issued_at) && <p className="text-sm text-muted-foreground">{t('issuedOn')}: {text(item.issued_at)}</p>}
                {text(item.verification_url) && (
                  <a href={text(item.verification_url) ?? '#'} target="_blank" rel="noopener noreferrer" className="text-sm text-primary hover:underline">
                    {t('viewCertificate')}
                  </a>
                )}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function AchievementsSection({ items }: { items: Array<Record<string, unknown>> }) {
  const { t } = usePassportI18n();
  return (
    <Card className={passportCardClass}>
      <CardHeader><CardTitle>{t('sectionAchievements')}</CardTitle></CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <PassportEmptyState description={t('achievementsEmpty')} />
        ) : (
          <ul className="grid gap-3 md:grid-cols-2">
            {items.map((item, index) => (
              <li key={text(item.id) ?? index} className="rounded-lg border p-3">
                <p className="font-medium">{text(item.title) ?? t('notProvided')}</p>
                {text(item.description) && <p className="text-sm text-muted-foreground">{text(item.description)}</p>}
                {text(item.earned_at) && <p className="text-xs text-muted-foreground">{t('earnedOn')}: {text(item.earned_at)}</p>}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function TimelineSection({ items }: { items: Array<Record<string, unknown>> }) {
  const { t } = usePassportI18n();
  if (items.length === 0) return null;
  return (
    <Card className={passportCardClass}>
      <CardHeader><CardTitle>{t('timelineTitle')}</CardTitle></CardHeader>
      <CardContent>
        <ol className="space-y-3">
          {items.map((item, index) => (
            <li key={text(item.id) ?? index} className="border-l-2 pl-3">
              <p className="text-sm font-medium">{text(item.title) ?? t('notProvided')}</p>
              {text(item.description) && <p className="text-sm text-muted-foreground">{text(item.description)}</p>}
              {text(item.date) && <p className="text-xs text-muted-foreground">{text(item.date)}</p>}
            </li>
          ))}
        </ol>
      </CardContent>
    </Card>
  );
}

export function PublicPassportView({
  view,
  slug,
}: {
  view: PassportView;
  slug: string;
}) {
  const { t } = usePassportI18n();
  const sections = enabledPublicSections(view);
  const hasProfileContent = Object.keys(view.profile).length > 0;
  const [downloading, setDownloading] = useState(false);

  const downloadPdf = async () => {
    setDownloading(true);
    try {
      const blob = await talentPassportService.getPublicPdf(slug);
      downloadBlob(blob, 'talent-passport.pdf');
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6 px-4 py-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {t('publicEyebrow')}
          </p>
          <h1 className="text-3xl font-semibold tracking-tight">{t('publicTitle')}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t('publicSubtitle')}</p>
        </div>
        <Button variant="outline" className={passportButtonClass} onClick={downloadPdf} disabled={downloading}>
          <Download className="h-4 w-4" />
          {t('downloadPublicPdf')}
        </Button>
      </div>

      <p className="rounded-md border px-3 py-2 text-sm text-muted-foreground">{t('publicDisclaimer')}</p>
      {view.published_at && (
        <p className="text-xs text-muted-foreground">{t('publishedOn')}: {view.published_at}</p>
      )}
      {view.completeness !== undefined && (
        <p className="text-xs text-muted-foreground">{t('completenessScore')}: {view.completeness}%</p>
      )}

      {sections.length === 0 && <PassportEmptyState description={t('allSectionsHidden')} />}
      {sections.includes('professional_profile') && hasProfileContent && (
        <ProfileSection profile={view.profile} />
      )}
      {sections.includes('skills') && <SkillsSection items={view.skills} />}
      {sections.includes('projects') && <ProjectsSection items={view.projects} />}
      {sections.includes('certificates') && <CertificatesSection items={view.certificates} />}
      {sections.includes('achievements') && <AchievementsSection items={view.achievements} />}
      {sections.includes('learning_history') && <TimelineSection items={view.timeline} />}

      <div className="flex justify-center pt-4">
        <Button asChild variant="link">
          <Link href="/">{t('backToSite')}</Link>
        </Button>
      </div>
    </div>
  );
}
