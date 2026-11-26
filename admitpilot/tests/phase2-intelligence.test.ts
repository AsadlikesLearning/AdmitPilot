import { describe, it } from 'node:test';
import assert from 'node:assert';
import { parseMRZTD3 } from '../packages/shared/dist/mrz-parser.js';
import { DocumentExtractorService } from '../apps/backend/dist/services/document-extractor.js';
import { InMemoryStore } from '../apps/backend/dist/db/store.js';
import path from 'path';
import fs from 'fs/promises';

describe('Phase 2 Document Intelligence & MRZ Parser', () => {
  it('correctly parses ICAO 9303 TD3 Passport MRZ and validates fields', () => {
    // Standard ICAO TD3 synthetic test sample (2 lines x 44 chars)
    const line1 = 'P<GBRDOE<<JOHN<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<';
    const line2 = '9876543210GBR9501014M3001018<<<<<<<<<<<<<<04';
    const mrzText = `${line1}\n${line2}`;

    const parsed = parseMRZTD3(mrzText);
    assert.ok(parsed, 'MRZ should be recognized');
    assert.strictEqual(parsed.passportNumber, '987654321');
    assert.strictEqual(parsed.familyName, 'DOE');
    assert.strictEqual(parsed.givenNames, 'JOHN');
    assert.strictEqual(parsed.fullName, 'JOHN DOE');
    assert.strictEqual(parsed.nationality, 'GBR');
    assert.strictEqual(parsed.dateOfBirth, '1995-01-01');
    assert.strictEqual(parsed.expiryDate, '2030-01-01');
    assert.strictEqual(parsed.sex, 'Male');
  });

  it('detects and extracts structured IELTS score report fields accurately', () => {
    const extractor = new DocumentExtractorService();
    const ieltsSample = `
      INTERNATIONAL ENGLISH LANGUAGE TESTING SYSTEM
      Test Report Form (TRF Number): 23PK998877ALIK01
      Candidate Name: MUHAMMAD ALI KHAN
      Test Date: 14/11/2023
      Listening: 8.5
      Reading: 8.5
      Writing: 7.5
      Speaking: 7.5
      Overall Band Score: 8.0
      CEFR Level: C1
    `;

    const category = extractor.detectCategory(ieltsSample, 'IELTS_Report.pdf');
    assert.strictEqual(category, 'english_test');

    const { fields, evidence } = extractor.extractStructuredFields(ieltsSample, 'english_test', 'IELTS_Report.pdf');
    assert.strictEqual(fields.testType, 'IELTS');
    assert.strictEqual(fields.overallScore, '8.0');
    assert.strictEqual(fields.listening, '8.5');
    assert.strictEqual(fields.reading, '8.5');
    assert.strictEqual(fields.writing, '7.5');
    assert.strictEqual(fields.speaking, '7.5');
    assert.strictEqual(fields.referenceNumber, '23PK998877ALIK01');
    const ovEv = evidence['englishTests[0].overallScore'] || evidence['overallScore'];
    assert.ok(ovEv && ovEv.confidence >= 0.95);
  });

  it('detects conflicts when uploaded document differs from candidate record', () => {
    const extractor = new DocumentExtractorService();
    const candidateMock: any = {
      personal: {
        legalGivenName: 'Muhammad Ali',
        familyName: 'Khan',
        dateOfBirth: '1999-04-12',
        nationality: 'Pakistani',
      },
      passport: {
        passportNumber: 'AB1234567',
      },
      contact: {
        email: 'ali.khan@example.com',
      },
    };

    // Document with differing passport number and date of birth
    const conflictingFields = {
      passportNumber: 'XY9999999',
      dateOfBirth: '2001-08-20',
      nationality: 'Pakistani',
    };

    const conflicts = extractor.detectConflicts(conflictingFields, candidateMock, 'Conflicting_Passport.pdf');
    assert.strictEqual(conflicts.length, 2);
    assert.ok(conflicts.some((c) => c.fieldKey === 'passport.passportNumber' && c.documentValue === 'XY9999999'));
    assert.ok(conflicts.some((c) => c.fieldKey === 'personal.dateOfBirth' && c.documentValue === '2001-08-20'));
  });

  it('verifies candidate CRUD persistence, search, and archive operations in store', async () => {
    const tempDir = path.resolve('./temp_test_store');
    await fs.mkdir(tempDir, { recursive: true });

    const store = new InMemoryStore(tempDir);
    await store.init();
    store.setContext({ organizationId: 'org-global-edu' });

    // 1. Create new candidate
    const newCand: any = {
      id: 'cand-test-alice-1',
      organizationId: 'org-global-edu',
      status: 'active',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      personal: {
        legalGivenName: 'Alice',
        familyName: 'Smith',
        dateOfBirth: '2000-05-15',
        nationality: 'British',
      },
      contact: {
        email: 'alice.smith@oxford.edu',
        phone: '+44 7700 900123',
        currentAddress: '10 High Street',
        city: 'Oxford',
        state: 'Oxfordshire',
        postalCode: 'OX1 4BH',
        country: 'United Kingdom',
      },
      passport: {
        passportNumber: 'GB55443322',
        fullName: 'ALICE SMITH',
        nationality: 'British',
        dateOfBirth: '2000-05-15',
        issuingCountry: 'United Kingdom',
        expiryDate: '2030-05-15',
      },
      education: [],
      englishTests: [],
      employment: [],
      additional: {},
      evidence: {},
      conflicts: {},
    };

    await store.saveCandidate(newCand);

    // 2. Search candidate
    const foundByName = await store.getCandidates({ search: 'Alice' });
    assert.strictEqual(foundByName.length, 1);
    assert.strictEqual(foundByName[0].id, 'cand-test-alice-1');

    const foundByPass = await store.getCandidates({ search: 'GB55443322' });
    assert.strictEqual(foundByPass.length, 1);

    // 3. Archive candidate
    const archived = await store.archiveCandidate('cand-test-alice-1');
    assert.strictEqual(archived, true);

    const activeList = await store.getCandidates({ includeArchived: false });
    assert.ok(!activeList.some((c) => c.id === 'cand-test-alice-1'));

    const archivedList = await store.getCandidates({ includeArchived: true, status: 'archived' });
    assert.ok(archivedList.some((c) => c.id === 'cand-test-alice-1'));

    // 4. Restore candidate
    const restored = await store.restoreCandidate('cand-test-alice-1');
    assert.strictEqual(restored, true);

    // 5. Delete candidate
    const deleted = await store.deleteCandidate('cand-test-alice-1');
    assert.strictEqual(deleted, true);

    const afterDelete = await store.getCandidate('cand-test-alice-1');
    assert.strictEqual(afterDelete, null);

    // Clean up
    await fs.rm(tempDir, { recursive: true, force: true });
  });
});

