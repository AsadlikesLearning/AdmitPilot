import test from 'node:test';
import assert from 'node:assert';
import {
  matchFormFields,
  matchFieldDeterministically,
  normalizeComparable,
  normalizeDate,
  CandidateProfile,
  FormField,
} from './index.js';

const sampleCandidate: CandidateProfile = {
  id: 'cand-test-1',
  organizationId: 'org-test',
  status: 'active',
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
  personal: {
    legalGivenName: 'Muhammad Ali',
    familyName: 'Khan',
    dateOfBirth: '1999-04-12',
    nationality: 'Pakistani',
    countryOfBirth: 'Pakistan',
    cityOfBirth: 'Lahore',
    gender: 'Male',
  },
  contact: {
    email: 'ali.khan@example.com',
    phone: '+92 300 1234567',
    currentAddress: 'House 42, Street 7, F-8/2',
    city: 'Islamabad',
    state: 'Federal Capital',
    postalCode: '44000',
    country: 'Pakistan',
  },
  passport: {
    passportNumber: 'AB1234567',
    fullName: 'MUHAMMAD ALI KHAN',
    nationality: 'Pakistani',
    dateOfBirth: '1999-04-12',
    issuingCountry: 'Pakistan',
    expiryDate: '2031-02-16',
  },
  education: [
    {
      id: 'edu-1',
      qualificationLevel: "Bachelor's",
      degreeTitle: 'Bachelor of Science in Computer Science',
      major: 'Computer Science',
      institution: 'NUST',
      country: 'Pakistan',
      gpa: '3.82',
      status: 'Completed',
    },
  ],
  englishTests: [
    {
      id: 'ielts-1',
      testType: 'IELTS',
      testDate: '2025-10-14',
      overallScore: '7.5',
    },
  ],
  employment: [],
  additional: {},
  evidence: {},
  conflicts: {},
};

test('matchFieldDeterministically correctly matches Given Names', () => {
  const field: FormField = {
    id: 'f1',
    kind: 'input',
    type: 'text',
    name: 'givenNames',
    label: 'Given Names / First Name',
    required: true,
  };
  const match = matchFieldDeterministically(field, sampleCandidate);
  assert.ok(match);
  assert.strictEqual(match.suggestedValue, 'Muhammad Ali');
  assert.strictEqual(match.confidence, 'high');
  assert.strictEqual(match.isConfirmedFact, true);
});

test('matchFieldDeterministically correctly matches Surname on travel document', () => {
  const field: FormField = {
    id: 'f2',
    kind: 'input',
    type: 'text',
    name: 'surname',
    label: 'Family Name / Surname as displayed on travel document',
    required: true,
  };
  const match = matchFieldDeterministically(field, sampleCandidate);
  assert.ok(match);
  assert.strictEqual(match.suggestedValue, 'Khan');
  assert.strictEqual(match.confidence, 'high');
});

test('matchFieldDeterministically matches Passport Number and Expiration Date', () => {
  const passField: FormField = {
    id: 'f3',
    kind: 'input',
    type: 'text',
    name: 'passportNumber',
    label: 'Passport Document Number',
    required: true,
  };
  const match1 = matchFieldDeterministically(passField, sampleCandidate);
  assert.ok(match1);
  assert.strictEqual(match1.suggestedValue, 'AB1234567');

  const expField: FormField = {
    id: 'f4',
    kind: 'datepicker',
    type: 'date',
    name: 'passportExpiry',
    label: 'Passport Expiration Date',
    required: true,
  };
  const match2 = matchFieldDeterministically(expField, sampleCandidate);
  assert.ok(match2);
  assert.strictEqual(match2.suggestedValue, '2031-02-16');
});

test('matchFieldDeterministically matches dropdown nationality to country option', () => {
  const natField: FormField = {
    id: 'f5',
    kind: 'select',
    type: 'select',
    name: 'nationality',
    label: 'Country of Citizenship',
    required: true,
    options: ['Select...', 'Pakistan', 'India', 'Canada'],
  };
  const match = matchFieldDeterministically(natField, sampleCandidate);
  assert.ok(match);
  // 'Pakistani' maps cleanly to 'Pakistan'
  assert.strictEqual(match.suggestedValue, 'Pakistan');
});

test('distinguishes Country of Birth from Nationality', () => {
  const birthField: FormField = {
    id: 'f6',
    kind: 'input',
    type: 'text',
    name: 'birthCountry',
    label: 'Country of Birth',
    required: true,
  };
  const match = matchFieldDeterministically(birthField, sampleCandidate);
  assert.ok(match);
  assert.strictEqual(match.candidateFieldKey, 'personal.countryOfBirth');
});

test('Zero-invention policy: unknown or sensitive fields are not filled', () => {
  const randomField: FormField = {
    id: 'f7',
    kind: 'input',
    type: 'text',
    name: 'criminalHistoryDetails',
    label: 'Provide criminal conviction details if any',
    required: false,
  };
  const match = matchFieldDeterministically(randomField, sampleCandidate);
  assert.strictEqual(match, null);
});

test('normalizeDate converts multiple date formats into YYYY-MM-DD', () => {
  assert.strictEqual(normalizeDate('1999-04-12'), '1999-04-12');
  assert.strictEqual(normalizeDate('12/04/1999'), '1999-04-12');
  assert.strictEqual(normalizeDate('12-04-1999'), '1999-04-12');
});

