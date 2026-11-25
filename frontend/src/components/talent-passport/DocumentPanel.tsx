'use client';

import Image from 'next/image';
import { useEffect, useState } from 'react';
import { Download, Eye, FileText, RefreshCw } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  createPdfPreviewUrl,
  downloadBlob,
  talentPassportService,
} from '@/services/talent-passport.service';
import type { TalentDocument, TalentDocumentEdition } from '@/types/talent-passport';
import { usePassportI18n } from './TalentPassportProvider';
import { passportButtonClass, passportCardClass } from './PassportStates';

const EDITIONS: { value: TalentDocumentEdition; labelKey: 'editionShare' | 'editionRecord' }[] = [
  { value: 'professional_share', labelKey: 'editionShare' },
  { value: 'personal_record', labelKey: 'editionRecord' },
];

function formatGenerated(value: string | null): string {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

/**
 * PDF documents are always generated, previewed and downloaded by the backend.
 * This panel only requests those operations and renders returned metadata; it
 * never assembles a PDF, prints the page or draws layout in the browser.
 */
export function DocumentPanel() {
  const { t } = usePassportI18n();
  const [edition, setEdition] = useState<TalentDocumentEdition>('personal_record');
  const [documents, setDocuments] = useState<TalentDocument[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewRef, setPreviewRef] = useState<string | null>(null);

  const loadHistory = async () => {
    try {
      const result = await talentPassportService.listDocuments();
      setDocuments(result.items ?? []);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : t('documentHistoryFailed'));
    }
  };

  useEffect(() => {
    void loadHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Release the previous object URL when a new preview is shown or the panel
  // unmounts. The cleanup captures the current value on every render.
  useEffect(() => () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  const generate = async () => {
    setBusy(true);
    setMessage(null);
    try {
      const document = await talentPassportService.generateDocument(edition);
      setMessage(t('documentGenerated'));
      await loadHistory();
      setPreviewRef(document.document_ref);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : t('documentGenerateFailed'));
    } finally {
      setBusy(false);
    }
  };

  const preview = async (documentRef: string) => {
    setBusy(true);
    setMessage(null);
    try {
      const blob = await talentPassportService.previewDocument(documentRef);
      setPreviewUrl(createPdfPreviewUrl(blob));
      setPreviewRef(documentRef);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : t('documentPreviewFailed'));
    } finally {
      setBusy(false);
    }
  };

  const download = async (document: TalentDocument) => {
    setBusy(true);
    setMessage(null);
    try {
      const blob = await talentPassportService.downloadDocument(document.document_ref);
      downloadBlob(blob, `talent-passport-${document.edition}-${document.document_ref}.pdf`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : t('documentDownloadFailed'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className={passportCardClass}>
      <CardHeader className="flex-row items-start gap-3 space-y-0">
        <div className="shrink-0 rounded-md border bg-white p-1" aria-hidden="true">
          <Image
            src="/logo.jpg"
            alt=""
            width={32}
            height={32}
            className="h-8 w-8 rounded object-contain"
          />
        </div>
        <div className="space-y-1.5">
          <CardTitle>{t('documentTitle')}</CardTitle>
          <CardDescription>{t('documentDescription')}</CardDescription>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          {EDITIONS.map((option) => (
            <label key={option.value} className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                name="document-edition"
                value={option.value}
                checked={edition === option.value}
                onChange={() => setEdition(option.value)}
              />
              {t(option.labelKey)}
            </label>
          ))}
          <Button className={passportButtonClass} onClick={generate} disabled={busy}>
            <RefreshCw className="h-4 w-4" />
            {busy ? t('documentWorking') : t('documentGenerate')}
          </Button>
        </div>

        {message && <p className="text-sm text-muted-foreground">{message}</p>}

        {documents.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('documentHistoryEmpty')}</p>
        ) : (
          <ul className="divide-y rounded-md border">
            {documents.map((document) => (
              <li key={document.document_ref} className="flex flex-wrap items-center justify-between gap-2 p-3">
                <div className="min-w-0">
                  <p className="flex items-center gap-2 text-sm font-medium">
                    <FileText className="h-4 w-4" />
                    <span className="break-all">{document.document_ref}</span>
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {document.edition} · {document.status} · v{document.template_version} · {formatGenerated(document.generated_at)}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className={passportButtonClass}
                    onClick={() => preview(document.document_ref)}
                    disabled={busy}
                  >
                    <Eye className="h-4 w-4" />
                    {t('documentPreview')}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className={passportButtonClass}
                    onClick={() => download(document)}
                    disabled={busy}
                  >
                    <Download className="h-4 w-4" />
                    {t('documentDownload')}
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}

        {previewUrl && previewRef && (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">
              {t('documentPreviewOf')}: <span className="break-all">{previewRef}</span>
            </p>
            <iframe
              title={t('documentPreview')}
              src={previewUrl}
              className="h-[70vh] w-full rounded-md border bg-white"
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
