'use client';

import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { talentPassportService } from '@/services/talent-passport.service';
import type { OtherLink, TalentProfile, TaxonomyData } from '@/types/talent-passport';
import { usePassportI18n } from './TalentPassportProvider';
import { passportButtonClass, passportCardClass } from './PassportStates';

function toArray(value: string): string[] {
  return value.split(',').map((item) => item.trim()).filter(Boolean);
}

function toLinks(value: string): OtherLink[] {
  return value
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [label, url] = line.split('|').map((part) => part.trim());
      return url ? { label: label || url, url } : label;
    });
}

function fromLinks(links: OtherLink[]): string {
  return links
    .map((link) => {
      if (typeof link === 'string') return link;
      const url = link.url ?? '';
      return link.label && link.label !== url ? `${link.label}|${url}` : url;
    })
    .filter(Boolean)
    .join('\n');
}

export function ProfessionalProfilePanel({
  profile,
  taxonomy,
  onSaved,
}: {
  profile: TalentProfile;
  taxonomy?: TaxonomyData | null;
  onSaved: () => void;
}) {
  const { t } = usePassportI18n();
  const [form, setForm] = useState({
    headline: profile.headline ?? '',
    summary: profile.summary ?? '',
    country: profile.country ?? '',
    city: profile.city ?? '',
    career_interests: (profile.career_interests ?? []).join(', '),
    professional_goals: profile.professional_goals ?? '',
    areas_of_specialization: (profile.areas_of_specialization ?? []).join(', '),
    preferred_work_arrangement: profile.preferred_work_arrangement ?? '',
    preferred_opportunities: (profile.preferred_opportunities ?? []).join(', '),
    languages: (profile.languages ?? []).join(', '),
    portfolio_url: profile.portfolio_url ?? '',
    github_url: profile.github_url ?? '',
    linkedin_url: profile.linkedin_url ?? '',
    other_links: fromLinks(profile.other_links ?? []),
  });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const update = (key: keyof typeof form, value: string) =>
    setForm((current) => ({ ...current, [key]: value }));

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setMessage(null);
    try {
      await talentPassportService.updateProfile({
        headline: form.headline || null,
        summary: form.summary || null,
        country: form.country || null,
        city: form.city || null,
        career_interests: toArray(form.career_interests),
        professional_goals: form.professional_goals || null,
        areas_of_specialization: toArray(form.areas_of_specialization),
        preferred_work_arrangement: form.preferred_work_arrangement || null,
        preferred_opportunities: toArray(form.preferred_opportunities),
        languages: toArray(form.languages),
        portfolio_url: form.portfolio_url || null,
        github_url: form.github_url || null,
        linkedin_url: form.linkedin_url || null,
        other_links: toLinks(form.other_links),
      });
      setMessage(t('professionalProfileSaved'));
      onSaved();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : t('professionalProfileError'));
    } finally {
      setSaving(false);
    }
  };

  const interestSuggestions = (taxonomy?.skills ?? []).slice(0, 12).map((skill) => skill.name);

  return (
    <Card className={passportCardClass}>
      <CardHeader>
        <CardTitle>{t('professionalProfileTitle')}</CardTitle>
        <CardDescription>{t('professionalProfileDescription')}</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={save} className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="tp-headline">{t('headline')}</Label>
              <Input id="tp-headline" value={form.headline} onChange={(e) => update('headline', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tp-location">{t('location')}</Label>
              <div className="flex gap-2">
                <Input
                  id="tp-location"
                  value={form.city}
                  onChange={(e) => update('city', e.target.value)}
                  placeholder={t('notProvided')}
                />
                <Input
                  aria-label={t('notProvided')}
                  value={form.country}
                  onChange={(e) => update('country', e.target.value)}
                />
              </div>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="tp-summary">{t('summary')}</Label>
            <Textarea id="tp-summary" rows={4} value={form.summary} onChange={(e) => update('summary', e.target.value)} />
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="tp-interests">{t('interests')}</Label>
              <Input
                id="tp-interests"
                list="tp-interest-suggestions"
                value={form.career_interests}
                onChange={(e) => update('career_interests', e.target.value)}
              />
              <datalist id="tp-interest-suggestions">
                {interestSuggestions.map((name) => <option key={name} value={name} />)}
              </datalist>
            </div>
            <div className="space-y-2">
              <Label htmlFor="tp-goals">{t('goals')}</Label>
              <Input id="tp-goals" value={form.professional_goals} onChange={(e) => update('professional_goals', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tp-specializations">{t('specializations')}</Label>
              <Input
                id="tp-specializations"
                value={form.areas_of_specialization}
                onChange={(e) => update('areas_of_specialization', e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tp-arrangement">{t('workArrangement')}</Label>
              <Input
                id="tp-arrangement"
                value={form.preferred_work_arrangement}
                onChange={(e) => update('preferred_work_arrangement', e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tp-opportunities">{t('opportunities')}</Label>
              <Input
                id="tp-opportunities"
                value={form.preferred_opportunities}
                onChange={(e) => update('preferred_opportunities', e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tp-languages">{t('languages')}</Label>
              <Input id="tp-languages" value={form.languages} onChange={(e) => update('languages', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tp-portfolio">{t('portfolio')}</Label>
              <Input id="tp-portfolio" type="url" value={form.portfolio_url} onChange={(e) => update('portfolio_url', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tp-github">{t('github')}</Label>
              <Input id="tp-github" value={form.github_url} onChange={(e) => update('github_url', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tp-linkedin">{t('linkedin')}</Label>
              <Input id="tp-linkedin" type="url" value={form.linkedin_url} onChange={(e) => update('linkedin_url', e.target.value)} />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="tp-other-links">{t('openLink')}</Label>
            <Textarea
              id="tp-other-links"
              rows={3}
              value={form.other_links}
              onChange={(e) => update('other_links', e.target.value)}
              placeholder="https://example.com"
            />
          </div>
          {message && <p className="rounded-md border px-3 py-2 text-sm">{message}</p>}
          <Button type="submit" className={passportButtonClass} disabled={saving}>
            {saving ? t('saving') : t('save')}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
