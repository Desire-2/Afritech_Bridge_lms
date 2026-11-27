import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  parseAttachments,
  projectFileMetadata,
} from '../src/lib/project-submission';

const BLOB_URL =
  'https://acme.public.blob.vercel-storage.com/projects/12/34/report_abc_final_report.pdf';

test('project upload metadata matches the assignment file record', () => {
  const record = projectFileMetadata({
    url: BLOB_URL,
    pathname: 'projects/12/34/report_abc_final_report.pdf',
    size: 4321,
    contentType: 'application/pdf',
    uploadedAt: '2026-11-27T10:00:00.000Z',
    storage: 'vercel_blob',
  });

  assert.deepEqual(record, {
    url: BLOB_URL,
    filename: 'report_abc_final_report.pdf',
    size: 4321,
    contentType: 'application/pdf',
    uploadedAt: '2026-11-27T10:00:00.000Z',
    storage: 'vercel_blob',
  });
});

test('stored metadata array renders as a real attachment URL', () => {
  const stored = JSON.stringify([
    {
      url: BLOB_URL,
      filename: 'report.pdf',
      contentType: 'application/pdf',
      storage: 'vercel_blob',
    },
  ]);

  assert.deepEqual(parseAttachments(stored), [
    { url: BLOB_URL, name: 'report.pdf' },
  ]);
});

test('legacy name field and single URL still decode', () => {
  assert.deepEqual(
    parseAttachments(JSON.stringify([{ url: BLOB_URL, name: 'old.pdf' }])),
    [{ url: BLOB_URL, name: 'old.pdf' }],
  );
  assert.deepEqual(parseAttachments(BLOB_URL), [{ url: BLOB_URL, name: undefined }]);
});
