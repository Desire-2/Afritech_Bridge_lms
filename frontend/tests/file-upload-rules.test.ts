import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  extensionOf,
  parseAllowedFileExtensions,
  resolveAllowedExtensions,
} from '../src/lib/file-upload-rules';
import { FileUploadService } from '../src/services/file-upload.service';

// The value persisted in the dev DB for the assignment from the bug report.
const STORED_JSON = '["html", "css", "js", "zip", "pdf", "txt", "md"]';

function fakeFile(name: string, type = ''): File {
  return { name, size: 1024, type } as File;
}

test('parses the JSON-array form stored by the LMS into dot-extensions', () => {
  assert.deepEqual(parseAllowedFileExtensions(STORED_JSON), [
    '.html', '.css', '.js', '.zip', '.pdf', '.txt', '.md',
  ]);
});

test('still accepts the legacy comma-separated form', () => {
  assert.deepEqual(parseAllowedFileExtensions('.pdf,.docx'), ['.pdf', '.docx']);
  assert.deepEqual(parseAllowedFileExtensions('pdf, DOCX'), ['.pdf', '.docx']);
});

test('wildcard and empty values resolve to unrestricted', () => {
  assert.equal(resolveAllowedExtensions('*'), undefined);
  assert.equal(resolveAllowedExtensions(''), undefined);
  assert.equal(resolveAllowedExtensions('["*"]'), undefined);
  assert.equal(FileUploadService.resolveAllowedTypes(STORED_JSON)?.includes('.html'), true);
});

test('extensionOf extracts a lowercase extension from a file name', () => {
  assert.equal(extensionOf('Contact_Form.HTML'), '.html');
  assert.equal(extensionOf('README'), '');
});

test('accepts contact_form.html against the stored allow-list', () => {
  const allowed = FileUploadService.resolveAllowedTypes(STORED_JSON);
  // Simulate a browser that reports no MIME type at all.
  const result = FileUploadService.validateFile(fakeFile('contact_form.html'), allowed);
  assert.deepEqual(result.errors, []);
  assert.equal(result.isValid, true);
});

test('rejects demo_video.mp4 with a readable list of the real extensions', () => {
  const allowed = FileUploadService.resolveAllowedTypes(STORED_JSON);
  const result = FileUploadService.validateFile(fakeFile('demo_video.mp4', 'video/mp4'), allowed);
  assert.equal(result.isValid, false);
  assert.equal(result.errors.length, 1);
  assert.match(result.errors[0], /Allowed types: \.html, \.css, \.js, \.zip, \.pdf, \.txt, \.md/);
  assert.doesNotMatch(result.errors[0], /application\/octet-stream/);
});

test('an mp4 allow-list accepts a video even when the browser omits its MIME type', () => {
  const allowed = FileUploadService.resolveAllowedTypes('["mp4", "webm", "html"]');
  const result = FileUploadService.validateFile(fakeFile('demo_video.mp4'), allowed);
  assert.deepEqual(result.errors, []);
});

test('unrestricted uploads keep using the default MIME accept-list', () => {
  const result = FileUploadService.validateFile(
    fakeFile('demo_video.mp4', 'video/mp4'),
    FileUploadService.resolveAllowedTypes('*'),
  );
  assert.deepEqual(result.errors, []);
});
