'use client';

import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import type { PortfolioItem, ProjectPayload } from '@/types/talent-passport';
import { usePassportI18n } from './TalentPassportProvider';
import { passportButtonClass } from './PassportStates';

function toList(value: string): string[] {
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

export function ProjectForm({
  initial,
  saving,
  onSubmit,
  onCancel,
}: {
  initial?: PortfolioItem | null;
  saving?: boolean;
  onSubmit: (payload: ProjectPayload) => void;
  onCancel: () => void;
}) {
  const { t } = usePassportI18n();
  const [title, setTitle] = useState(initial?.title ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [reflection, setReflection] = useState(initial?.reflection ?? '');
  const [technologies, setTechnologies] = useState((initial?.technologies ?? []).join(', '));
  const [externalUrl, setExternalUrl] = useState(initial?.external_url ?? '');
  const [isFeatured, setIsFeatured] = useState(initial?.is_featured ?? false);
  const [displayOrder, setDisplayOrder] = useState(initial?.display_order ?? 0);
  const [error, setError] = useState<string | null>(null);

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!title.trim()) {
      setError(t('displayTitle'));
      return;
    }
    setError(null);
    onSubmit({
      title: title.trim(),
      description: description.trim() || null,
      reflection: reflection.trim() || null,
      technologies: toList(technologies),
      external_url: externalUrl.trim() || null,
      is_featured: isFeatured,
      display_order: Number.isFinite(displayOrder) ? displayOrder : 0,
    });
  };

  return (
    <form onSubmit={submit} className="space-y-4 rounded-lg border p-4">
      <div className="space-y-2">
        <Label htmlFor="project-title">{t('displayTitle')}</Label>
        <Input
          id="project-title"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          required
        />
        {error && <p className="text-sm text-destructive">{error}</p>}
      </div>
      <div className="space-y-2">
        <Label htmlFor="project-description">{t('displayDescription')}</Label>
        <Textarea
          id="project-description"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          rows={3}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="project-reflection">{t('reflection')}</Label>
        <Textarea
          id="project-reflection"
          value={reflection}
          onChange={(event) => setReflection(event.target.value)}
          rows={3}
        />
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="project-technologies">{t('technologies')}</Label>
          <Input
            id="project-technologies"
            value={technologies}
            onChange={(event) => setTechnologies(event.target.value)}
            placeholder="React, Node.js"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="project-url">{t('externalUrl')}</Label>
          <Input
            id="project-url"
            type="url"
            value={externalUrl}
            onChange={(event) => setExternalUrl(event.target.value)}
          />
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={isFeatured}
            onChange={(event) => setIsFeatured(event.target.checked)}
          />
          {t('featuredProject')}
        </label>
        <div className="space-y-2">
          <Label htmlFor="project-order">{t('displayOrder')}</Label>
          <Input
            id="project-order"
            type="number"
            value={displayOrder}
            onChange={(event) => setDisplayOrder(Number(event.target.value))}
          />
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button type="submit" className={passportButtonClass} disabled={saving}>
          {saving ? t('saving') : t('save')}
        </Button>
        <Button type="button" variant="outline" className={passportButtonClass} onClick={onCancel}>
          {t('cancel')}
        </Button>
      </div>
    </form>
  );
}
