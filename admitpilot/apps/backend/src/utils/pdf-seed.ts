import fs from 'fs';
import path from 'path';
import { CandidateDocument } from 'admitpilot-shared';

/**
 * Builds a valid, standards-compliant 1-page PDF 1.4 binary buffer from plain text lines
 * with accurate byte-offset xref table so Chrome PDF viewer and pdf-parse read it cleanly.
 */
export function buildValidPdfBuffer(title: string, lines: string[]): Buffer {
  const esc = (s: string) => s.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');

  const streamOps: string[] = [
    'BT',
    '/F1 14 Tf',
    '48 756 Td',
    `(${esc(title)}) Tj`,
    '/F1 10 Tf',
    '0 -24 Td',
  ];

  for (const line of lines) {
    streamOps.push(`(${esc(line)}) Tj`);
    streamOps.push('0 -16 Td');
  }
  streamOps.push('ET');

  const streamContent = streamOps.join('\n');
  const streamByteLen = Buffer.byteLength(streamContent, 'latin1');

  const objects = [
    '1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n',
    '2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n',
    '3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>\nendobj\n',
    '4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Courier >>\nendobj\n',
    `5 0 obj\n<< /Length ${streamByteLen} >>\nstream\n${streamContent}\nendstream\nendobj\n`,
  ];

  let pdf = '%PDF-1.4\n';
  const offsets: number[] = [0];

  for (const obj of objects) {
    offsets.push(Buffer.byteLength(pdf, 'latin1'));
    pdf += obj;
  }

  const xrefOffset = Buffer.byteLength(pdf, 'latin1');
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += '0000000000 65535 f \n';
  for (let i = 1; i < offsets.length; i++) {
    pdf += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;

  return Buffer.from(pdf, 'latin1');
}

export function buildSeedDocuments(uploadsDir: string, orgId = 'org-global-edu'): CandidateDocument[] {
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }

  const now = new Date().toISOString();

  // 1. Passport Bio-Page + Valid ICAO TD3 MRZ (Check digits: AB1234567->4, 990412->9, 310216->6)
  const passportLines = [
    'ISLAMIC REPUBLIC OF PAKISTAN - PASSPORT',
    'Document Type: P          Issuing State: PAK',
    'Passport No: AB1234567',
    'Surname: KHAN',
    'Given Names: MUHAMMAD ALI',
    'Nationality: Pakistani',
    'Date of Birth: 1999-04-12     Sex: Male',
    'Place of Birth: Lahore, Pakistan',
    'Date of Issue: 2021-02-16     Date of Expiry: 2031-02-16',
    'Place of Issue: Islamabad',
    'National ID: 35202-1234567-1',
    '',
    'MACHINE READABLE ZONE (ICAO 9303 TD3):',
    'P<PAKKHAN<<MUHAMMAD<ALI<<<<<<<<<<<<<<<<<<<<<',
    'AB12345674PAK9904129M3102166<<<<<<<<<<<<<<02',
  ];
  const passFile = 'seed-passport-AB1234567.pdf';
  const passBuf = buildValidPdfBuffer('OFFICIAL PASSPORT BIO-PAGE EXTRACT', passportLines);
  fs.writeFileSync(path.join(uploadsDir, passFile), passBuf);

  // 2. Academic Transcript (NUST BSCS)
  const transcriptLines = [
    'NATIONAL UNIVERSITY OF SCIENCES & TECHNOLOGY (NUST)',
    'Islamabad, Pakistan - Official Academic Transcript',
    '',
    'Student Name: Muhammad Ali Khan',
    'Registration No: NUST-2017-BSCS-0412',
    'Degree Conferred: Bachelor of Science in Computer Science',
    'Major / Discipline: Computer Science',
    'Enrollment Date: 2017-09-01',
    'Graduation / Award Date: 2021-07-15',
    'Cumulative GPA: 3.82 / 4.0',
    'Overall Percentage: 88.5%',
    'Academic Standing: Graduated with Distinction',
  ];
  const transFile = 'seed-transcript-NUST-BSCS.pdf';
  const transBuf = buildValidPdfBuffer('OFFICIAL ACADEMIC TRANSCRIPT', transcriptLines);
  fs.writeFileSync(path.join(uploadsDir, transFile), transBuf);

  // 3. IELTS Academic Test Report Form
  const ieltsLines = [
    'INTERNATIONAL ENGLISH LANGUAGE TESTING SYSTEM (IELTS)',
    'Academic Test Report Form',
    '',
    'Test Report Form Number: 23PK001234KHANM',
    'Candidate Name: MUHAMMAD ALI KHAN',
    'Passport No: AB1234567',
    'Test Date: 2023-11-14',
    '',
    'Listening: 8.5',
    'Reading: 8.5',
    'Writing: 7.5',
    'Speaking: 7.5',
    'Overall Band Score: 8.0',
    'CEFR Level: C1',
  ];
  const ieltsFile = 'seed-ielts-23PK001234KHANM.pdf';
  const ieltsBuf = buildValidPdfBuffer('IELTS ACADEMIC TEST REPORT FORM', ieltsLines);
  fs.writeFileSync(path.join(uploadsDir, ieltsFile), ieltsBuf);

  return [
    {
      id: 'doc-seed-passport',
      candidateId: 'cand-ali-khan-1',
      organizationId: orgId,
      category: 'passport',
      fileName: 'Passport_Scan_AB1234567.pdf',
      portalFileName: 'Khan_MuhammadAli_Passport.pdf',
      diskFileName: passFile,
      fileSize: passBuf.byteLength,
      mimeType: 'application/pdf',
      storagePath: `/api/documents/doc-seed-passport/download`,
      extractedText: passportLines.join('\n'),
      extractionMethod: 'mrz+text',
      verificationStatus: 'verified',
      extractedFields: {
        passportNumber: {
          value: 'AB1234567',
          confidence: 0.99,
          label: 'Passport number',
          targetPath: 'passport.passportNumber',
          snippet: 'AB12345674PAK9904129M3102166<<<<<<<<<<<<<<02',
          source: 'mrz',
          verified: true,
        },
        legalGivenName: {
          value: 'Muhammad Ali',
          confidence: 0.99,
          label: 'Legal given name',
          targetPath: 'personal.legalGivenName',
          snippet: 'P<PAKKHAN<<MUHAMMAD<ALI<<<<<<<<<<<<<<<<<<<<<',
          source: 'mrz',
          verified: true,
        },
        familyName: {
          value: 'Khan',
          confidence: 0.99,
          label: 'Family surname',
          targetPath: 'personal.familyName',
          snippet: 'P<PAKKHAN<<MUHAMMAD<ALI<<<<<<<<<<<<<<<<<<<<<',
          source: 'mrz',
          verified: true,
        },
        dateOfBirth: {
          value: '1999-04-12',
          confidence: 0.99,
          label: 'Date of birth',
          targetPath: 'personal.dateOfBirth',
          snippet: 'Date of Birth: 1999-04-12',
          source: 'mrz',
          verified: true,
        },
        expiryDate: {
          value: '2031-02-16',
          confidence: 0.99,
          label: 'Passport expiry date',
          targetPath: 'passport.expiryDate',
          snippet: 'Date of Expiry: 2031-02-16',
          source: 'mrz',
          verified: true,
        },
        nationality: {
          value: 'Pakistani',
          confidence: 0.96,
          label: 'Nationality',
          targetPath: 'personal.nationality',
          snippet: 'Nationality: Pakistani',
          source: 'mrz',
          verified: true,
        },
      },
      conflicts: [],
      uploadedAt: now,
      ocrApplied: false,
    },
    {
      id: 'doc-seed-transcript',
      candidateId: 'cand-ali-khan-1',
      organizationId: orgId,
      category: 'transcript',
      fileName: 'Official_Transcript_NUST_BSCS.pdf',
      portalFileName: 'Khan_MuhammadAli_Academic_Transcript.pdf',
      diskFileName: transFile,
      fileSize: transBuf.byteLength,
      mimeType: 'application/pdf',
      storagePath: `/api/documents/doc-seed-transcript/download`,
      extractedText: transcriptLines.join('\n'),
      extractionMethod: 'text',
      verificationStatus: 'verified',
      extractedFields: {
        degreeTitle: {
          value: 'Bachelor of Science in Computer Science',
          confidence: 0.95,
          label: 'Degree title',
          targetPath: 'education[0].degreeTitle',
          snippet: 'Degree Conferred: Bachelor of Science in Computer Science',
          source: 'regex',
          verified: true,
        },
        institution: {
          value: 'National University of Sciences & Technology (NUST)',
          confidence: 0.94,
          label: 'Awarding institution',
          targetPath: 'education[0].institution',
          snippet: 'NATIONAL UNIVERSITY OF SCIENCES & TECHNOLOGY (NUST)',
          source: 'regex',
          verified: true,
        },
        gpa: {
          value: '3.82',
          confidence: 0.96,
          label: 'Cumulative GPA',
          targetPath: 'education[0].gpa',
          snippet: 'Cumulative GPA: 3.82 / 4.0',
          source: 'regex',
          verified: true,
        },
        gradingScale: {
          value: '4.0',
          confidence: 0.95,
          label: 'Grading scale',
          targetPath: 'education[0].gradingScale',
          snippet: 'Cumulative GPA: 3.82 / 4.0',
          source: 'regex',
          verified: true,
        },
        awardDate: {
          value: '2021-07-15',
          confidence: 0.93,
          label: 'Award / graduation date',
          targetPath: 'education[0].awardDate',
          snippet: 'Graduation / Award Date: 2021-07-15',
          source: 'regex',
          verified: true,
        },
      },
      conflicts: [],
      uploadedAt: now,
      ocrApplied: false,
    },
    {
      id: 'doc-seed-ielts',
      candidateId: 'cand-ali-khan-1',
      organizationId: orgId,
      category: 'english_test',
      fileName: 'IELTS_Academic_TRF.pdf',
      portalFileName: 'Khan_MuhammadAli_English_Proficiency.pdf',
      diskFileName: ieltsFile,
      fileSize: ieltsBuf.byteLength,
      mimeType: 'application/pdf',
      storagePath: `/api/documents/doc-seed-ielts/download`,
      extractedText: ieltsLines.join('\n'),
      extractionMethod: 'text',
      verificationStatus: 'verified',
      extractedFields: {
        testType: {
          value: 'IELTS',
          confidence: 0.99,
          label: 'English test type',
          targetPath: 'englishTests[0].testType',
          snippet: 'IELTS Academic Test Report Form',
          source: 'regex',
          verified: true,
        },
        referenceNumber: {
          value: '23PK001234KHANM',
          confidence: 0.98,
          label: 'TRF / report number',
          targetPath: 'englishTests[0].referenceNumber',
          snippet: 'Test Report Form Number: 23PK001234KHANM',
          source: 'regex',
          verified: true,
        },
        overallScore: {
          value: '8.0',
          confidence: 0.99,
          label: 'Overall score / band',
          targetPath: 'englishTests[0].overallScore',
          snippet: 'Overall Band Score: 8.0',
          source: 'regex',
          verified: true,
        },
        listening: {
          value: '8.5',
          confidence: 0.96,
          label: 'Listening score',
          targetPath: 'englishTests[0].listening',
          snippet: 'Listening: 8.5',
          source: 'regex',
          verified: true,
        },
        reading: {
          value: '8.5',
          confidence: 0.96,
          label: 'Reading score',
          targetPath: 'englishTests[0].reading',
          snippet: 'Reading: 8.5',
          source: 'regex',
          verified: true,
        },
        writing: {
          value: '7.5',
          confidence: 0.96,
          label: 'Writing score',
          targetPath: 'englishTests[0].writing',
          snippet: 'Writing: 7.5',
          source: 'regex',
          verified: true,
        },
        speaking: {
          value: '7.5',
          confidence: 0.96,
          label: 'Speaking score',
          targetPath: 'englishTests[0].speaking',
          snippet: 'Speaking: 7.5',
          source: 'regex',
          verified: true,
        },
      },
      conflicts: [],
      uploadedAt: now,
      ocrApplied: false,
    },
  ];
}
