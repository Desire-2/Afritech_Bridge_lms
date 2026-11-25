'use client';

import { useState } from 'react';
import { Pencil, Plus, Trash2 } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { talentPassportService } from '@/services/talent-passport.service';
import type { PortfolioItem, ProjectsResponse, ProjectPayload } from '@/types/talent-passport';
import { usePassportI18n } from './TalentPassportProvider';
import { passportButtonClass, passportCardClass, PassportEmptyState } from './PassportStates';
import { ProjectForm } from './ProjectForm';

export function PortfolioPanel({
  data,
  onChanged,
}: {
  data: ProjectsResponse;
  onChanged: () => void;
}) {
  const { t } = usePassportI18n();
  const [editing, setEditing] = useState<PortfolioItem | 'new' | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const save = async (payload: ProjectPayload) => {
    setSaving(true);
    setMessage(null);
    try {
      if (editing === 'new') {
        await talentPassportService.createProject(payload);
        setMessage(t('projectCreated'));
      } else if (editing) {
        await talentPassportService.updateProject(editing.id, payload);
        setMessage(t('projectUpdated'));
      }
      setEditing(null);
      onChanged();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : t('projectError'));
    } finally {
      setSaving(false);
    }
  };

  const remove = async (item: PortfolioItem) => {
    setMessage(null);
    if (!window.confirm(`${t('deleteConfirm')}: ${item.title}?`)) return;
    try {
      await talentPassportService.deleteProject(item.id);
      setMessage(t('projectDeleted'));
      onChanged();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : t('projectError'));
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">{t('projectsSubtitle')}</p>
        {!editing && (
          <Button className={passportButtonClass} onClick={() => setEditing('new')}>
            <Plus className="h-4 w-4" />
            {t('addProject')}
          </Button>
        )}
      </div>

      {message && <p className="rounded-md border px-3 py-2 text-sm">{message}</p>}

      {editing && (
        <ProjectForm
          initial={editing === 'new' ? null : editing}
          saving={saving}
          onSubmit={save}
          onCancel={() => setEditing(null)}
        />
      )}

      {data.items.length === 0 && !editing ? (
        <PassportEmptyState description={t('projectsEmpty')} />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {data.items.map((item) => (
            <Card key={item.id} className={passportCardClass}>
              <CardHeader className="flex flex-row items-start justify-between gap-2">
                <div>
                  <CardTitle className="text-base">{item.title}</CardTitle>
                  <p className="text-xs text-muted-foreground">
                    {item.course?.title || t(item.source_type === 'manual' ? 'manualProject' : 'courseProject')}
                  </p>
                </div>
                {item.is_featured && <Badge>{t('featured')}</Badge>}
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                {item.description && <p>{item.description}</p>}
                {item.reflection && (
                  <p className="text-muted-foreground">
                    <span className="font-medium">{t('reflection')}: </span>
                    {item.reflection}
                  </p>
                )}
                {item.technologies.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {item.technologies.map((technology) => (
                      <Badge key={technology} variant="secondary">{technology}</Badge>
                    ))}
                  </div>
                )}
                {item.external_url && (
                  <a
                    href={item.external_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block break-all text-primary hover:underline"
                  >
                    {item.external_url}
                  </a>
                )}
                <div className="flex gap-2 pt-1">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className={passportButtonClass}
                    onClick={() => setEditing(item)}
                  >
                    <Pencil className="h-4 w-4" />
                    {t('edit')}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className={passportButtonClass}
                    onClick={() => remove(item)}
                  >
                    <Trash2 className="h-4 w-4" />
                    {t('delete')}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
