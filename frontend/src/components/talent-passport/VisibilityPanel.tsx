'use client';

import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { talentPassportService } from '@/services/talent-passport.service';
import type { VisibilitySettings } from '@/types/talent-passport';
import { usePassportI18n } from './TalentPassportProvider';
import { passportButtonClass, passportCardClass } from './PassportStates';

const SECTION_KEYS = [
  'professional_profile',
  'skills',
  'projects',
  'certificates',
  'learning_history',
  'achievements',
] as const;

const SECTION_LABELS = {
  professional_profile: 'sectionProfessionalProfile',
  skills: 'sectionSkills',
  projects: 'sectionProjects',
  certificates: 'sectionCertificates',
  learning_history: 'sectionLearningHistory',
  achievements: 'sectionAchievements',
} as const;

export function VisibilityPanel({
  visibility,
  onSaved,
}: {
  visibility: VisibilitySettings;
  onSaved: (next: VisibilitySettings) => void;
}) {
  const { t } = usePassportI18n();
  const [form, setForm] = useState(visibility);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const toggle = (key: keyof VisibilitySettings) =>
    setForm((current) => ({ ...current, [key]: !current[key] }));

  const run = async (action: () => Promise<unknown>, successMessage: string) => {
    setBusy(true);
    setMessage(null);
    try {
      await action();
      setMessage(successMessage);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : t('errorDescription'));
    } finally {
      setBusy(false);
    }
  };

  const save = () =>
    run(async () => {
      const next = await talentPassportService.updateVisibility(form);
      onSaved(next);
      return next;
    }, t('visibilitySaved'));

  const publish = () =>
    run(async () => {
      const result = await talentPassportService.publish();
      const next: VisibilitySettings = {
        ...form,
        is_published: result.is_published,
        public_slug: result.public_slug,
        public_url: result.public_url,
      };
      onSaved(next);
      return result;
    }, t('publishSuccess'));

  const unpublish = () =>
    run(async () => {
      const result = await talentPassportService.unpublish();
      const next: VisibilitySettings = {
        ...form,
        is_published: result.is_published,
        public_slug: null,
        public_url: null,
      };
      onSaved(next);
      return result;
    }, t('unpublishSuccess'));

  const sync = () => run(() => talentPassportService.sync(), t('syncSuccess'));

  return (
    <div className="space-y-4">
      <Card className={passportCardClass}>
        <CardHeader>
          <CardTitle>{t('visibilityTitle')}</CardTitle>
          <CardDescription>{t('visibilityDescription')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-2 md:grid-cols-2">
            {SECTION_KEYS.map((key) => (
              <label key={key} className="flex items-center gap-2 rounded-md border p-3 text-sm">
                <input
                  type="checkbox"
                  checked={Boolean(form[key])}
                  onChange={() => toggle(key)}
                />
                {t(SECTION_LABELS[key])}
              </label>
            ))}
          </div>
          <div className="grid gap-2 md:grid-cols-2">
            <label className="flex items-center gap-2 rounded-md border p-3 text-sm">
              <input type="checkbox" checked={Boolean(form.show_email)} onChange={() => toggle('show_email')} />
              {t('showEmail')}
            </label>
            <label className="flex items-center gap-2 rounded-md border p-3 text-sm">
              <input type="checkbox" checked={Boolean(form.show_phone)} onChange={() => toggle('show_phone')} />
              {t('showPhone')}
            </label>
          </div>
          <Button className={passportButtonClass} onClick={save} disabled={busy}>
            {busy ? t('saving') : t('save')}
          </Button>
        </CardContent>
      </Card>

      <Card className={passportCardClass}>
        <CardHeader>
          <CardTitle>{t('publish')}</CardTitle>
          <CardDescription>
            {form.is_published ? t('published') : t('draft')} · {t('publishWarning')}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Button className={passportButtonClass} onClick={form.is_published ? unpublish : publish} disabled={busy}>
            {form.is_published ? t('unpublish') : t('publish')}
          </Button>
          <Button variant="outline" className={passportButtonClass} onClick={sync} disabled={busy}>
            {t('syncNow')}
          </Button>
        </CardContent>
      </Card>

      {message && <p className="rounded-md border px-3 py-2 text-sm">{message}</p>}
    </div>
  );
}
