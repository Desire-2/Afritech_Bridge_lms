import assert from 'node:assert/strict';
import test from 'node:test';

import {
  TalentApiError,
  TalentPassportApi,
  buildTalentUrl,
  getTalentErrorStatus,
  isTalentGone,
  isTalentNotFound,
  isTalentUnauthorized,
  parseTalentApiError,
  type TalentHttpClient,
} from '../src/services/talent-passport.service';
import { serializePublicPassport } from '../src/types/talent-passport';

type Call = { method: string; url: string; body?: unknown; config?: unknown };

function mockClient(responses: Record<string, unknown> = {}) {
  const calls: Call[] = [];
  const client = {
    get: async <T>(url: string, config?: unknown) => {
      calls.push({ method: 'get', url, config });
      return { data: (responses[url] ?? {}) as T };
    },
    post: async <T>(url: string, body?: unknown, config?: unknown) => {
      calls.push({ method: 'post', url, body, config });
      return { data: (responses[url] ?? { success: true }) as T };
    },
    put: async <T>(url: string, body?: unknown, config?: unknown) => {
      calls.push({ method: 'put', url, body, config });
      return { data: (responses[url] ?? {}) as T };
    },
    delete: async <T>(url: string, config?: unknown) => {
      calls.push({ method: 'delete', url, config });
      return { data: (responses[url] ?? { success: true }) as T };
    },
  } as unknown as TalentHttpClient;
  return { client, calls };
}

test('buildTalentUrl adds only defined query values in contract order', () => {
  assert.equal(
    buildTalentUrl('/student/talent-passport/projects', { page: 2, page_size: 10 }),
    '/student/talent-passport/projects?page=2&page_size=10',
  );
  assert.equal(
    buildTalentUrl('/admin/talent/evidence', { q: 'react', status: null, page: 1 }),
    '/admin/talent/evidence?q=react&page=1',
  );
  assert.equal(buildTalentUrl('/student/talent-passport/skills'), '/student/talent-passport/skills');
});

test('client methods build the exact private and admin URLs', async () => {
  const { client, calls } = mockClient();
  const api = new TalentPassportApi(client, client);

  await api.getOverview();
  await api.getEvidence(42);
  await api.getProjects({ page: 3, page_size: 5 });
  await api.getCertificates();
  await api.getAchievements();
  await api.getTimeline();
  await api.updateProject('a/b', { title: 'Demo' });
  await api.deleteProject(7);
  await api.adminGetEvidence({ q: 'sql', status: 'pending', page: 2, page_size: 50 });

  assert.deepEqual(
    calls.map((call) => call.url),
    [
      '/student/talent-passport/overview',
      '/student/talent-passport/skills/42/evidence',
      '/student/talent-passport/projects?page=3&page_size=5',
      '/student/talent-passport/certificates?page=1&page_size=20',
      '/student/talent-passport/achievements?page=1&page_size=20',
      '/student/talent-passport/timeline?page=1&page_size=20',
      '/student/talent-passport/projects/a%2Fb',
      '/student/talent-passport/projects/7',
      '/admin/talent/evidence?q=sql&status=pending&page=2&page_size=50',
    ],
  );
});

test('public client is used without an Authorization config', async () => {
  const privateClient = mockClient();
  const publicClient = mockClient({
    '/talent/public/ada': { profile: { name: 'Ada' }, sections: {}, skills: [] },
    '/talent/public/ada/documents/current/download': new Blob(['%PDF-1.4'], { type: 'application/pdf' }),
  });
  const api = new TalentPassportApi(privateClient.client, publicClient.client);

  await api.getPublicPassport('ada');
  await api.getPublicPdf('ada');

  assert.deepEqual(
    publicClient.calls.map((call) => call.url),
    ['/talent/public/ada', '/talent/public/ada/documents/current/download'],
  );
  assert.equal(privateClient.calls.length, 0);
  for (const call of publicClient.calls) {
    const config = call.config as { headers?: Record<string, string> } | undefined;
    assert.equal(config?.headers?.Authorization, undefined);
  }
});

test('private document methods request backend-owned PDF operations only', async () => {
  const pdfBlob = new Blob(['%PDF-1.4'], { type: 'application/pdf' });
  const privateClient = mockClient({
    '/student/talent-passport/documents/generate': {
      document_ref: 'TP-REF-1',
      edition: 'personal_record',
      status: 'current',
      verification_url: 'https://example.test/api/v1/talent/verify/TP-REF-1',
    },
    '/student/talent-passport/documents': {
      items: [{ document_ref: 'TP-REF-1', edition: 'personal_record', status: 'current' }],
    },
    '/student/talent-passport/documents/TP-REF-1/preview': pdfBlob,
    '/student/talent-passport/documents/TP-REF-1/download': pdfBlob,
  });
  const publicClient = mockClient({
    '/talent/verify/TP-REF-1': {
      document_ref: 'TP-REF-1',
      verified: true,
      state: 'issued',
      edition: 'professional_share',
      template_version: '1.0.0',
      generated_at: null,
      verification_url: 'https://example.test/api/v1/talent/verify/TP-REF-1',
    },
  });
  const api = new TalentPassportApi(privateClient.client, publicClient.client);

  const document = await api.generateDocument('personal_record');
  assert.equal(document.document_ref, 'TP-REF-1');
  const history = await api.listDocuments();
  assert.equal(history.items.length, 1);
  assert.ok((await api.previewDocument('TP-REF-1')) instanceof Blob);
  assert.ok((await api.downloadDocument('TP-REF-1')) instanceof Blob);
  const verification = await api.getVerification('TP-REF-1');
  assert.equal(verification.verified, true);

  assert.deepEqual(
    privateClient.calls.map((call) => call.url),
    [
      '/student/talent-passport/documents/generate',
      '/student/talent-passport/documents',
      '/student/talent-passport/documents/TP-REF-1/preview',
      '/student/talent-passport/documents/TP-REF-1/download',
    ],
  );
  const generateCall = privateClient.calls[0];
  assert.deepEqual(generateCall.body, { edition: 'personal_record' });
  assert.deepEqual(publicClient.calls.map((call) => call.url), ['/talent/verify/TP-REF-1']);
});

test('parseTalentApiError reads error.code, message and details', () => {
  const error = {
    response: {
      status: 422,
      data: {
        error: {
          code: 'VALIDATION_ERROR',
          message: 'A title is required',
          details: { field: 'title' },
        },
      },
    },
  };
  const parsed = parseTalentApiError(error);
  assert.ok(parsed instanceof TalentApiError);
  assert.equal(parsed.status, 422);
  assert.equal(parsed.code, 'VALIDATION_ERROR');
  assert.equal(parsed.message, 'A title is required');
  assert.deepEqual(parsed.details, { field: 'title' });
});

test('parseTalentApiError falls back to status codes and network errors', () => {
  const unauthorized = parseTalentApiError({ response: { status: 401, data: {} } });
  assert.equal(unauthorized.code, 'UNAUTHORIZED');
  assert.equal(isTalentUnauthorized({ response: { status: 403 } }), true);

  const network = parseTalentApiError(new Error('Failed to fetch'));
  assert.equal(network.status, null);
  assert.equal(network.code, 'NETWORK_ERROR');
  assert.equal(network.message, 'Failed to fetch');

  assert.equal(getTalentErrorStatus({ response: { status: 410 } }), 410);
  assert.equal(isTalentNotFound({ response: { status: 404 } }), true);
  assert.equal(isTalentGone({ response: { status: 410 } }), true);
});

test('client throws parsed TalentApiError on failed requests', async () => {
  const { client } = mockClient();
  const failing = {
    ...client,
    get: async () => {
      throw { response: { status: 404, data: { error: { code: 'NOT_FOUND', message: 'No passport' } } } };
    },
  } as unknown as TalentHttpClient;
  const api = new TalentPassportApi(failing, failing);

  await assert.rejects(
    () => api.getPublicPassport('missing'),
    (error: unknown) => error instanceof TalentApiError && error.code === 'NOT_FOUND' && error.status === 404,
  );
});

test('serializePublicPassport drops disabled sections and unknown fields', () => {
  const raw = {
    profile: {
      name: 'Ada Lovelace',
      headline: 'Engineer',
      secret_internal_note: 'drop me',
    },
    sections: {
      professional_profile: true,
      skills: true,
      projects: false,
      certificates: false,
      learning_history: false,
      achievements: false,
    },
    skills: [{ id: 1, status: 'VERIFIED', injected: 'drop me' }],
    projects: [{ id: 9, title: 'Hidden project' }],
    certificates: [{ id: 3 }],
    achievements: [{ id: 4 }],
    timeline: [{ id: 5 }],
    published_at: '2026-01-02T00:00:00Z',
    completeness: 80,
    server_internal_field: 'drop me',
  };

  const view = serializePublicPassport(raw);

  assert.deepEqual(view.profile, { name: 'Ada Lovelace', headline: 'Engineer' });
  assert.equal(view.sections.professional_profile, true);
  assert.equal(view.sections.projects, false);
  assert.deepEqual(view.projects, []);
  assert.deepEqual(view.certificates, []);
  assert.deepEqual(view.achievements, []);
  assert.deepEqual(view.timeline, []);
  assert.deepEqual(view.skills, [{ id: 1, status: 'VERIFIED' }]);
  assert.equal(view.published_at, '2026-01-02T00:00:00Z');
  assert.equal(view.completeness, 80);
  assert.equal('server_internal_field' in view, false);
});

test('serializePublicPassport unwraps a success envelope without inventing values', () => {
  const view = serializePublicPassport({
    success: true,
    data: {
      profile: {},
      sections: { skills: true },
      skills: [],
    },
  });
  assert.deepEqual(view.profile, {});
  assert.deepEqual(view.skills, []);
  assert.equal('published_at' in view, false);
  assert.equal('completeness' in view, false);
});
