import test from 'node:test';
import assert from 'node:assert';
import path from 'node:path';
import fs from 'node:fs/promises';
import os from 'node:os';
import { InMemoryStore } from '../apps/backend/dist/db/store.js';
import { matchFormFields, matchFileUploadFields } from '../packages/shared/dist/index.js';

test('Store initializes with pre-populated candidates, encrypted credentials, and PDF blobs', async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'admitpilot-int-1-'));
  try {
    const store = new InMemoryStore(tempDir, { usePostgres: false });
    store.setContext({ organizationId: 'org-global-edu' });
    await store.init();
    const candidates = await store.listCandidates();
    assert.ok(candidates.length >= 1, 'Should have at least 1 candidate');

    const cand = candidates.find((c) => c.personal.familyName === 'Khan') || candidates[0];
    assert.strictEqual(cand.personal.legalGivenName, 'Muhammad Ali');
    assert.strictEqual(cand.personal.familyName, 'Khan');
    assert.strictEqual(cand.passport?.passportNumber, 'AB1234567');
    assert.strictEqual(cand.englishTests[0]?.overallScore, '8.0');

    const docs = await store.listDocuments(cand.id);
    assert.ok(docs.length >= 3, 'Should have passport, transcript, and IELTS documents');
    assert.ok(docs.some((d) => d.category === 'passport'));

    const creds = await store.listCredentials(cand.id);
    assert.ok(creds.length >= 1, 'Should have dedicated student email credential');
    assert.strictEqual(creds[0].password, undefined, 'Default credential list must mask raw password');
    assert.strictEqual(creds[0].hasPassword, true);
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true });
  }
});

test('Form matching handles full university admission form and file upload slots cleanly', async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'admitpilot-int-2-'));
  try {
    const store = new InMemoryStore(tempDir, { usePostgres: false });
    store.setContext({ organizationId: 'org-global-edu' });
    await store.init();
    const candidates = await store.listCandidates();
    const cand = candidates.find((c) => c.personal.familyName === 'Khan') || candidates[0];
    const docs = await store.listDocuments(cand.id);

    const universityFields = [
      { id: '1', kind: 'input' as const, type: 'text', name: 'givenNames', label: 'Given Names / First Name', required: true },
      { id: '2', kind: 'input' as const, type: 'text', name: 'surname', label: 'Family Name / Surname as on passport', required: true },
      { id: '3', kind: 'input' as const, type: 'email', name: 'email', label: 'Primary Applicant Email', required: true },
      { id: '4', kind: 'input' as const, type: 'tel', name: 'phone', label: 'Contact Mobile Phone', required: true },
      { id: '5', kind: 'datepicker' as const, type: 'date', name: 'dob', label: 'Date of Birth (DOB)', required: true },
      { id: '6', kind: 'select' as const, type: 'select', name: 'nationality', label: 'Country of Citizenship', required: true, options: ['Pakistan', 'India', 'Canada'] },
      { id: '7', kind: 'input' as const, type: 'text', name: 'passportNumber', label: 'Passport Document Number', required: true },
      { id: '8', kind: 'datepicker' as const, type: 'date', name: 'expiryDate', label: 'Passport Expiration Date', required: true },
      { id: '9', kind: 'input' as const, type: 'text', name: 'ieltsScore', label: 'Overall IELTS Score', required: false },
      { id: '10', kind: 'file' as const, type: 'file', name: 'passportFile', label: 'Upload Passport Bio-Page', required: true },
    ];

    const { mappings, unmatchedFields } = matchFormFields(universityFields, cand);
    assert.strictEqual(mappings.length, 9, 'All 9 text/select/date fields should be mapped deterministically');
    assert.strictEqual(unmatchedFields.length, 0, 'No text fields should remain unmatched');

    const fileMappings = matchFileUploadFields(universityFields, docs, cand);
    assert.strictEqual(fileMappings.length, 1);
    assert.strictEqual(fileMappings[0].status, 'approved');
    assert.strictEqual(fileMappings[0].portalFileName, 'Khan_MuhammadAli_Passport.pdf');

    const mappedObj = Object.fromEntries(mappings.map((m) => [m.fieldId, m.suggestedValue]));
    assert.strictEqual(mappedObj['1'], 'Muhammad Ali');
    assert.strictEqual(mappedObj['2'], 'Khan');
    assert.strictEqual(mappedObj['3'], 'alikhan.admissions2027@gmail.com');
    assert.strictEqual(mappedObj['4'], '+92 300 1234567');
    assert.strictEqual(mappedObj['5'], '1999-04-12');
    assert.strictEqual(mappedObj['6'], 'Pakistan');
    assert.strictEqual(mappedObj['7'], 'AB1234567');
    assert.strictEqual(mappedObj['8'], '2031-02-16');
    assert.strictEqual(mappedObj['9'], '8.0');
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true });
  }
});

test('Store handles application lifecycle status updates and cleanup', async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'admitpilot-int-3-'));
  try {
    const store = new InMemoryStore(tempDir, { usePostgres: false });
    store.setContext({ organizationId: 'org-global-edu' });
    await store.init();
    const cand = (await store.listCandidates())[0];

    const newApp = await store.saveApplication({
      id: 'app-test-99',
      candidateId: cand.id,
      organizationId: cand.organizationId,
      institutionName: 'University of Edinburgh',
      programName: 'MSc Data Science',
      country: 'United Kingdom',
      status: 'draft',
      createdAt: new Date().toISOString(),
      lastActivityAt: new Date().toISOString(),
    });

    assert.strictEqual(newApp.status, 'draft');

    const updated = await store.saveApplication({
      ...newApp,
      status: 'submitted',
      submissionDate: '2026-11-06',
    });

    assert.strictEqual(updated.status, 'submitted');
    const fetched = await store.getApplication('app-test-99');
    assert.strictEqual(fetched?.status, 'submitted');

    const deleted = await store.deleteApplication('app-test-99');
    assert.strictEqual(deleted, true);
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true });
  }
});
