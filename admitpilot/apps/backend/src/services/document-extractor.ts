import fs from 'fs/promises';
import path from 'path';
import mammoth from 'mammoth';
import { createWorker } from 'tesseract.js';
import {
  DocumentCategory,
  CandidateProfile,
  FieldEvidence,
  ExtractedFieldMeta,
  DocumentConflict,
  normalizeDate,
  cleanText,
  parseMRZTD3,
} from 'admitpilot-shared';

export interface ExtractionOutput {
  category: DocumentCategory;
  rawText: string;
  fields: Record<string, any>;
  structuredFields: Record<string, ExtractedFieldMeta>;
  evidence: Record<string, FieldEvidence>;
  conflicts: DocumentConflict[];
  ocrApplied: boolean;
  mrzDetected: boolean;
  extractionMethod: 'text' | 'ocr' | 'mrz+text' | 'ai_vision' | 'hybrid_ai';
  inlineMedia?: { mimeType: string; base64Data: string };
}

export const FIELD_TARGET_MAP: Record<string, { targetPath: string; label: string }> = {
  passportNumber: { targetPath: 'passport.passportNumber', label: 'Passport number' },
  fullName: { targetPath: 'passport.fullName', label: 'Full name on passport' },
  legalGivenName: { targetPath: 'personal.legalGivenName', label: 'Legal given name' },
  familyName: { targetPath: 'personal.familyName', label: 'Family surname' },
  dateOfBirth: { targetPath: 'personal.dateOfBirth', label: 'Date of birth' },
  gender: { targetPath: 'personal.gender', label: 'Gender' },
  nationality: { targetPath: 'personal.nationality', label: 'Nationality' },
  issuingCountry: { targetPath: 'passport.issuingCountry', label: 'Issuing country' },
  placeOfIssue: { targetPath: 'passport.placeOfIssue', label: 'Place of issue' },
  issueDate: { targetPath: 'passport.issueDate', label: 'Passport issue date' },
  expiryDate: { targetPath: 'passport.expiryDate', label: 'Passport expiry date' },
  nationalId: { targetPath: 'personal.nationalId', label: 'National ID' },

  testType: { targetPath: 'englishTests[0].testType', label: 'English test type' },
  testDate: { targetPath: 'englishTests[0].testDate', label: 'Test date' },
  referenceNumber: { targetPath: 'englishTests[0].referenceNumber', label: 'TRF / report number' },
  overallScore: { targetPath: 'englishTests[0].overallScore', label: 'Overall score / band' },
  listening: { targetPath: 'englishTests[0].listening', label: 'Listening score' },
  reading: { targetPath: 'englishTests[0].reading', label: 'Reading score' },
  writing: { targetPath: 'englishTests[0].writing', label: 'Writing score' },
  speaking: { targetPath: 'englishTests[0].speaking', label: 'Speaking score' },

  qualificationLevel: { targetPath: 'education[0].qualificationLevel', label: 'Qualification level' },
  degreeTitle: { targetPath: 'education[0].degreeTitle', label: 'Degree title' },
  major: { targetPath: 'education[0].major', label: 'Major / discipline' },
  institution: { targetPath: 'education[0].institution', label: 'Awarding institution' },
  gpa: { targetPath: 'education[0].gpa', label: 'Cumulative GPA' },
  gradingScale: { targetPath: 'education[0].gradingScale', label: 'Grading scale' },
  percentage: { targetPath: 'education[0].percentage', label: 'Percentage marks' },
  awardDate: { targetPath: 'education[0].awardDate', label: 'Award / graduation date' },
  startDate: { targetPath: 'education[0].startDate', label: 'Start date' },
  endDate: { targetPath: 'education[0].endDate', label: 'Completion date' },

  email: { targetPath: 'contact.email', label: 'Email address' },
  phone: { targetPath: 'contact.phone', label: 'Phone number' },
  city: { targetPath: 'contact.city', label: 'City' },
  country: { targetPath: 'contact.country', label: 'Country' },

  company: { targetPath: 'employment[0].company', label: 'Employer / company' },
  jobTitle: { targetPath: 'employment[0].jobTitle', label: 'Job title' },
  employmentType: { targetPath: 'employment[0].employmentType', label: 'Employment type' },

  sponsorName: { targetPath: 'additional.sponsorDetails', label: 'Sponsor / account holder' },
  closingBalance: { targetPath: 'additional.financialSupport', label: 'Verified financial balance' },
  targetInstitution: { targetPath: 'additional.notes', label: 'SOP target university' },
  targetProgram: { targetPath: 'additional.preferredCourses[0]', label: 'Target program' },
  recommenderName: { targetPath: 'additional.notes', label: 'Referee name' },
};

export class DocumentExtractorService {
  /**
   * Main entry point to extract text, MRZ, OCR, and structured fields from an uploaded document
   */
  async extractDocument(
    filePath: string,
    mimeType: string,
    originalName: string,
    candidate: CandidateProfile,
    categoryHint?: DocumentCategory | 'auto'
  ): Promise<ExtractionOutput> {
    let rawText = '';
    let preserveLineText = '';
    let ocrApplied = false;
    let inlineMedia: { mimeType: string; base64Data: string } | undefined;

    const ext = path.extname(originalName).toLowerCase();

    // 1. Extract raw text stream depending on file format
    if (ext === '.docx' || mimeType.includes('wordprocessingml')) {
      const buffer = await fs.readFile(filePath);
      const res = await mammoth.extractRawText({ buffer });
      preserveLineText = res.value || '';
      rawText = preserveLineText;
    } else if (ext === '.pdf' || mimeType.includes('pdf')) {
      try {
        const pdfParseModule = await import('pdf-parse');
        const pdfParse = (pdfParseModule.default || pdfParseModule) as any;
        const dataBuffer = await fs.readFile(filePath);
        const data = await pdfParse(dataBuffer);
        preserveLineText = data.text || '';
        rawText = preserveLineText;
      } catch (err) {
        console.warn('[AdmitPilot Extractor] PDF text extraction fallback:', (err as Error).message);
      }

      if (rawText.trim().length < 40) {
        // Attempt plain ASCII stream scan (handles minimal / custom generated PDFs cleanly)
        try {
          const buf = await fs.readFile(filePath, 'latin1');
          const tjMatches = Array.from(buf.matchAll(/\(([^()\\]{2,200})\)\s*Tj/g)).map((m) => m[1]);
          if (tjMatches.length > 0) {
            preserveLineText = tjMatches.join('\n');
            rawText = preserveLineText;
          }
        } catch {
          // ignore
        }
      }
    } else if (['.png', '.jpg', '.jpeg', '.webp'].includes(ext) || mimeType.startsWith('image/')) {
      try {
        const imgBuf = await fs.readFile(filePath);
        if (imgBuf.byteLength <= 10 * 1024 * 1024) {
          const resolvedMime =
            mimeType && mimeType.startsWith('image/')
              ? mimeType
              : ext === '.png'
              ? 'image/png'
              : ext === '.webp'
              ? 'image/webp'
              : 'image/jpeg';
          inlineMedia = {
            mimeType: resolvedMime,
            base64Data: imgBuf.toString('base64'),
          };
        }
      } catch {
        // ignore
      }

      try {
        preserveLineText = await this.performOCR(filePath);
        rawText = preserveLineText;
        ocrApplied = true;
      } catch (ocrErr) {
        console.warn('[AdmitPilot Extractor] Image OCR fallback:', (ocrErr as Error).message);
      }
    } else if (['.txt', '.csv', '.md', '.rtf', '.html'].includes(ext) || mimeType.startsWith('text/')) {
      preserveLineText = await fs.readFile(filePath, 'utf-8');
      if (ext === '.html') {
        preserveLineText = preserveLineText.replace(/<[^>]+>/g, ' ');
      }
      rawText = preserveLineText;
    }

    const cleanedSingleLine = cleanText(rawText);
    const effectiveHint = categoryHint && categoryHint !== 'auto' ? categoryHint : undefined;

    // 2. Auto-detect document category using weighted filename + content signals
    const category = effectiveHint || this.detectCategory(preserveLineText || cleanedSingleLine, originalName);

    // 3. Extract structured fields (preserving line breaks for MRZ & multi-line regexes)
    const { fields, structuredFields, evidence, mrzDetected } = this.extractStructuredFields(
      preserveLineText || cleanedSingleLine,
      category,
      originalName
    );

    // 4. Detect discrepancies against verified candidate record
    const conflicts = this.detectConflicts(fields, candidate, originalName);

    const extractionMethod: ExtractionOutput['extractionMethod'] = mrzDetected
      ? 'mrz+text'
      : ocrApplied
      ? 'ocr'
      : 'text';

    return {
      category,
      rawText: preserveLineText.trim() || cleanedSingleLine,
      fields,
      structuredFields,
      evidence,
      conflicts,
      ocrApplied,
      mrzDetected,
      extractionMethod,
      inlineMedia,
    };
  }

  private async performOCR(filePath: string): Promise<string> {
    const worker = await createWorker('eng');
    try {
      const ret = await worker.recognize(filePath);
      return ret.data.text || '';
    } finally {
      await worker.terminate();
    }
  }

  /**
   * Weighted category classifier so CVs mentioning "IELTS" or "University" aren't misclassified
   */
  public detectCategory(text: string, filename: string): DocumentCategory {
    const fn = filename.toLowerCase();
    const t = text.toLowerCase();

    // Strong filename cues first
    if (/passport|travel[_-\s]?doc|mrz/.test(fn) || /p<[a-z]{3}[a-z<]{10,}/i.test(text)) {
      return 'passport';
    }
    if (/ielts|toefl|pte|duolingo|trf/.test(fn)) return 'english_test';
    if (/transcript|marksheet|mark[_-\s]?sheet|grade[_-\s]?report/.test(fn)) return 'transcript';
    if (/degree|diploma|graduation[_-\s]?cert/.test(fn)) return 'degree';
    if (/\b(cv|resume|curriculum[_-\s]?vitae)\b/.test(fn)) return 'cv';
    if (/\b(sop|personal[_-\s]?statement|motivation)\b/.test(fn)) return 'sop';
    if (/\b(lor|recommendation|reference[_-\s]?letter)\b/.test(fn)) return 'lor';
    if (/bank|financial|sponsorship|affidavit|funds/.test(fn)) return 'financial';
    if (/experience[_-\s]?letter|employment[_-\s]?cert/.test(fn)) return 'experience';

    // Content scoring
    if (
      t.includes('test report form') ||
      (t.includes('overall band score') && t.includes('listening')) ||
      t.includes('pearson test of english') ||
      t.includes('toefl ibt score') ||
      t.includes('duolingo english test')
    ) {
      return 'english_test';
    }
    if (t.includes('passport') && (t.includes('date of expiry') || t.includes('issuing') || t.includes('surname'))) {
      return 'passport';
    }
    if (t.includes('official transcript') || t.includes('academic transcript') || (t.includes('semester') && t.includes('gpa'))) {
      return 'transcript';
    }
    if (t.includes('conferred the degree of') || t.includes('awarded the degree of') || t.includes('bachelor of') && t.includes('convocation')) {
      return 'degree';
    }
    if (t.includes('statement of purpose') || t.includes('personal statement')) return 'sop';
    if (t.includes('letter of recommendation') || t.includes('to whom it may concern') && t.includes('recommend')) {
      return 'lor';
    }
    if (t.includes('bank statement') || t.includes('closing balance') || t.includes('account balance')) {
      return 'financial';
    }
    if (t.includes('curriculum vitae') || (t.includes('work experience') && t.includes('skills'))) {
      return 'cv';
    }
    if (t.includes('this is to certify that') && t.includes('employed')) {
      return 'experience';
    }

    return 'other';
  }

  /**
   * Extract structured fields + provenance metadata across all admissions document types
   */
  public extractStructuredFields(
    text: string,
    category: DocumentCategory,
    docName: string
  ): {
    fields: Record<string, any>;
    structuredFields: Record<string, ExtractedFieldMeta>;
    evidence: Record<string, FieldEvidence>;
    mrzDetected: boolean;
  } {
    const fields: Record<string, any> = {};
    const structuredFields: Record<string, ExtractedFieldMeta> = {};
    const evidence: Record<string, FieldEvidence> = {};
    let mrzDetected = false;

    const addField = (
      key: string,
      val: any,
      confidence: number,
      snippet: string,
      source: ExtractedFieldMeta['source'] = 'regex'
    ) => {
      if (val === undefined || val === null || !String(val).trim()) return;
      const trimmed = typeof val === 'string' ? val.trim() : val;
      const mapping = FIELD_TARGET_MAP[key];
      const targetPath = mapping?.targetPath || key;
      const label = mapping?.label || key.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase());

      fields[key] = trimmed;
      structuredFields[key] = {
        value: trimmed,
        confidence,
        label,
        targetPath,
        snippet: cleanText(snippet).slice(0, 160),
        source,
      };
      evidence[targetPath] = {
        sourceDocumentName: docName,
        snippet: cleanText(snippet).slice(0, 160),
        confidence,
        status: confidence >= 0.9 ? 'verified' : 'extracted',
        extractedAt: new Date().toISOString(),
      };
    };

    const normText = cleanText(text);

    // -------------------------------------------------------------------
    // 1. PASSPORT (ICAO TD3 MRZ + Visual Inspection Zone)
    // -------------------------------------------------------------------
    if (category === 'passport') {
      const mrz = parseMRZTD3(text);
      if (mrz && mrz.valid) {
        mrzDetected = true;
        const baseConf = mrz.checkDigitsValid ? 0.99 : 0.94;
        addField('passportNumber', mrz.passportNumber, baseConf, mrz.rawLines[1], 'mrz');
        if (mrz.givenNames) addField('legalGivenName', this.toTitleCase(mrz.givenNames), baseConf, mrz.rawLines[0], 'mrz');
        if (mrz.familyName) addField('familyName', this.toTitleCase(mrz.familyName), baseConf, mrz.rawLines[0], 'mrz');
        if (mrz.fullName) addField('fullName', mrz.fullName, baseConf, mrz.rawLines[0], 'mrz');
        if (mrz.dateOfBirth) addField('dateOfBirth', mrz.dateOfBirth, baseConf, mrz.rawLines[1], 'mrz');
        if (mrz.expiryDate) addField('expiryDate', mrz.expiryDate, baseConf, mrz.rawLines[1], 'mrz');
        if (mrz.sex && mrz.sex !== 'Unspecified') addField('gender', mrz.sex, 0.96, mrz.rawLines[1], 'mrz');
        if (mrz.nationalityAdjective) addField('nationality', mrz.nationalityAdjective, 0.96, mrz.rawLines[1], 'mrz');
        if (mrz.issuingCountryName) addField('issuingCountry', mrz.issuingCountryName, 0.96, mrz.rawLines[0], 'mrz');
        if (mrz.personalNumber) addField('nationalId', mrz.personalNumber, 0.92, mrz.rawLines[1], 'mrz');
      }

      // Supplement any visual-only fields (Issue Date, Place of Issue, or fallback if no MRZ)
      if (!fields.passportNumber) {
        const passNumMatch =
          normText.match(/(?:passport\s*(?:no|number)|document\s*(?:no|number))[.:\s#]*([A-Z]{1,2}[0-9]{6,9})/i) ||
          normText.match(/\b([A-Z]{2}[0-9]{7})\b/);
        if (passNumMatch) addField('passportNumber', passNumMatch[1].toUpperCase(), 0.94, passNumMatch[0]);
      }

      if (!fields.familyName) {
        const surMatch = text.match(/(?:surname|family\s*name)[.:\s]+([A-Z][A-Za-z\s-]{1,30})/i);
        if (surMatch) addField('familyName', cleanText(surMatch[1].split('\n')[0]), 0.91, surMatch[0]);
      }
      if (!fields.legalGivenName) {
        const givMatch = text.match(/(?:given\s*names?|first\s*name)[.:\s]+([A-Z][A-Za-z\s-]{1,35})/i);
        if (givMatch) addField('legalGivenName', cleanText(givMatch[1].split('\n')[0]), 0.91, givMatch[0]);
      }
      if (!fields.fullName && (fields.legalGivenName || fields.familyName)) {
        addField(
          'fullName',
          [fields.legalGivenName, fields.familyName].filter(Boolean).join(' ').toUpperCase(),
          0.92,
          'Derived from given + surname'
        );
      }

      if (!fields.dateOfBirth) {
        const dobMatch = normText.match(
          /(?:date\s*of\s*birth|dob|birth\s*date)[.:\s]*([0-9]{1,2}[-\/.][0-9]{1,2}[-\/.][0-9]{2,4}|[0-9]{4}-[0-9]{2}-[0-9]{2}|[0-9]{1,2}\s+[A-Za-z]{3,9}\s+[0-9]{4})/i
        );
        const norm = dobMatch ? normalizeDate(dobMatch[1]) : null;
        if (norm && dobMatch) addField('dateOfBirth', norm, 0.94, dobMatch[0]);
      }

      if (!fields.nationality) {
        const natMatch = text.match(/(?:nationality|citizenship)[.:\s]+([A-Za-z]{4,24})/i);
        if (natMatch) addField('nationality', cleanText(natMatch[1]), 0.92, natMatch[0]);
      }

      const issDateMatch = normText.match(
        /(?:date\s*of\s*issue|issue\s*date|issued\s*on)[.:\s]*([0-9]{1,2}[-\/.][0-9]{1,2}[-\/.][0-9]{2,4}|[0-9]{4}-[0-9]{2}-[0-9]{2}|[0-9]{1,2}\s+[A-Za-z]{3,9}\s+[0-9]{4})/i
      );
      if (issDateMatch) {
        const norm = normalizeDate(issDateMatch[1]);
        if (norm) addField('issueDate', norm, 0.93, issDateMatch[0]);
      }

      if (!fields.expiryDate) {
        const expMatch = normText.match(
          /(?:date\s*of\s*expiry|expiry\s*date|expiration\s*date|valid\s*until)[.:\s]*([0-9]{1,2}[-\/.][0-9]{1,2}[-\/.][0-9]{2,4}|[0-9]{4}-[0-9]{2}-[0-9]{2}|[0-9]{1,2}\s+[A-Za-z]{3,9}\s+[0-9]{4})/i
        );
        const norm = expMatch ? normalizeDate(expMatch[1]) : null;
        if (norm && expMatch) addField('expiryDate', norm, 0.95, expMatch[0]);
      }

      const placeMatch = text.match(/(?:place\s*of\s*issue|authority)[.:\s]+([A-Za-z\s,]{3,30})/i);
      if (placeMatch) {
        addField('placeOfIssue', cleanText(placeMatch[1].split('\n')[0]), 0.89, placeMatch[0]);
      }
    }

    // -------------------------------------------------------------------
    // 2. ENGLISH PROFICIENCY (IELTS, TOEFL iBT, PTE Academic, Duolingo)
    // -------------------------------------------------------------------
    if (category === 'english_test') {
      let testType = 'IELTS';
      if (/toefl/i.test(normText)) testType = 'TOEFL';
      else if (/pearson|\bpte\b/i.test(normText)) testType = 'PTE';
      else if (/duolingo/i.test(normText)) testType = 'Duolingo';
      addField('testType', testType, 0.98, testType);

      const trfMatch =
        normText.match(
          /(?:test\s*report\s*form\s*(?:\(trf\s*number\))?|trf\s*(?:no|number)|registration\s*(?:no|number)|score\s*report\s*code|appointment\s*number)[.:\s#]*([A-Z0-9-]{6,22})/i
        ) || normText.match(/\b([0-9]{2}[A-Z]{2}[0-9A-Z]{8,14})\b/);
      if (trfMatch) addField('referenceNumber', trfMatch[1].toUpperCase(), 0.97, trfMatch[0]);

      const dateMatch = normText.match(
        /(?:test\s*date|date\s*of\s*test|exam\s*date)[.:\s]*([0-9]{1,2}[-\/.][0-9]{1,2}[-\/.][0-9]{2,4}|[0-9]{4}-[0-9]{2}-[0-9]{2}|[0-9]{1,2}\s+[A-Za-z]{3,9}\s+[0-9]{4})/i
      );
      if (dateMatch) {
        const norm = normalizeDate(dateMatch[1]);
        if (norm) addField('testDate', norm, 0.95, dateMatch[0]);
      }

      const bandMatch =
        normText.match(/(?:overall\s*band\s*score|overall\s*score|total\s*score)[.:\s]*([0-9]{1,3}(?:\.[0-9])?)/i) ||
        normText.match(/\boverall\s*([4-9](?:\.[05])?|[1-9][0-9]|1[0-6][0-9])\b/i);
      if (bandMatch) addField('overallScore', bandMatch[1], 0.98, bandMatch[0]);

      for (const comp of ['listening', 'reading', 'writing', 'speaking'] as const) {
        const m = normText.match(new RegExp(`${comp}[.:\\s]*([0-9]{1,3}(?:\\.[0-9])?)`, 'i'));
        if (m) addField(comp, m[1], 0.95, m[0]);
      }
    }

    // -------------------------------------------------------------------
    // 3. ACADEMIC TRANSCRIPT & DEGREE CERTIFICATE
    // -------------------------------------------------------------------
    if (category === 'transcript' || category === 'degree') {
      let qualLevel = "Bachelor's";
      if (/master|msc|mba|m\.phil|postgraduate/i.test(normText)) qualLevel = "Master's";
      else if (/doctorate|phd|doctor\s*of\s*philosophy/i.test(normText)) qualLevel = 'Doctorate';
      else if (/associate/i.test(normText)) qualLevel = 'Associate';
      else if (/diploma/i.test(normText)) qualLevel = 'Diploma';
      else if (/high\s*school|higher\s*secondary|a-level|intermediate/i.test(normText)) qualLevel = 'High School';
      addField('qualificationLevel', qualLevel, 0.91, qualLevel);

      const degMatch =
        text.match(/(?:degree\s*of|conferred\s*the\s*degree\s*of|program|qualification)[.:\s]+([A-Za-z\s()&-]{5,65})/i) ||
        normText.match(/\b((?:Bachelor|Master|Doctor)\s+of\s+[A-Za-z\s]{3,45})\b/i);
      if (degMatch) addField('degreeTitle', cleanText(degMatch[1].split('\n')[0]), 0.92, degMatch[0]);

      const gpaMatch = normText.match(
        /(?:cgpa|cumulative\s*gpa|gpa|grade\s*point\s*average)[.:\s]*([0-9]\.[0-9]{1,3})(?:\s*(?:\/|out\s*of)\s*([0-9](?:\.[0-9])?))?/i
      );
      if (gpaMatch) {
        addField('gpa', gpaMatch[1], 0.96, gpaMatch[0]);
        if (gpaMatch[2]) addField('gradingScale', gpaMatch[2], 0.95, gpaMatch[0]);
      }

      const pctMatch = normText.match(/(?:percentage|overall\s*marks)[.:\s]*([0-9]{2}(?:\.[0-9]{1,2})?)\s*%/i);
      if (pctMatch) addField('percentage', pctMatch[1], 0.93, pctMatch[0]);

      const instMatch = text.match(
        /((?:National\s+)?(?:University|Institute|College)[A-Za-z\s,&()-]{4,65}|[A-Za-z\s,&-]{3,45}\s+(?:University|Institute\s+of\s+Technology|College))/i
      );
      if (instMatch) addField('institution', cleanText(instMatch[1].split('\n')[0]), 0.9, instMatch[0]);

      const majorMatch = text.match(/(?:major|discipline|department|field\s*of\s*study)[.:\s]+([A-Za-z\s&]{3,45})/i);
      if (majorMatch) addField('major', cleanText(majorMatch[1].split('\n')[0]), 0.91, majorMatch[0]);

      const awardMatch = normText.match(
        /(?:awarded\s*on|conferred\s*on|graduation\s*date|date\s*of\s*completion|date\s*of\s*issue)[.:\s]*([0-9]{1,2}[-\/.][0-9]{1,2}[-\/.][0-9]{2,4}|[0-9]{4}-[0-9]{2}-[0-9]{2}|[0-9]{1,2}\s+[A-Za-z]{3,9}\s+[0-9]{4})/i
      );
      if (awardMatch) {
        const norm = normalizeDate(awardMatch[1]);
        if (norm) addField('awardDate', norm, 0.93, awardMatch[0]);
      }
    }

    // -------------------------------------------------------------------
    // 4. CV / RESUME & EXPERIENCE LETTER
    // -------------------------------------------------------------------
    if (category === 'cv' || category === 'experience') {
      const emailMatch = normText.match(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,7}\b/);
      if (emailMatch) addField('email', emailMatch[0], 0.96, emailMatch[0]);

      const phoneMatch = normText.match(/(?:\+\d{1,3}[\s.-]?)?\(?\d{2,4}\)?[\s.-]?\d{3,4}[\s.-]?\d{3,4}/);
      if (phoneMatch && phoneMatch[0].replace(/\D/g, '').length >= 9) {
        addField('phone', cleanText(phoneMatch[0]), 0.89, phoneMatch[0]);
      }

      const roleMatch = text.match(
        /(?:designation|position|role|job\s*title)[.:\s]+([A-Za-z\s/-]{3,45})/i
      ) || normText.match(/\b((?:Senior|Associate|Junior|Lead)?\s*(?:Software\s*Engineer|Data\s*Scientist|Data\s*Analyst|Product\s*Manager|Research\s*Assistant|Developer|Consultant|Engineer))\b/i);
      if (roleMatch) addField('jobTitle', cleanText(roleMatch[1].split('\n')[0]), 0.86, roleMatch[0]);

      const compMatch = text.match(/(?:company|employer|organization)[.:\s]+([A-Za-z0-9\s.,&-]{3,50})/i);
      if (compMatch) addField('company', cleanText(compMatch[1].split('\n')[0]), 0.88, compMatch[0]);
    }

    // -------------------------------------------------------------------
    // 5. FINANCIAL STATEMENT / SPONSORSHIP
    // -------------------------------------------------------------------
    if (category === 'financial') {
      const balMatch = normText.match(
        /(?:closing\s*balance|available\s*balance|account\s*balance|total\s*funds)[.:\s]*((?:USD|GBP|EUR|CAD|AUD|PKR|\$|£|€)\s*[0-9,]+(?:\.[0-9]{2})?|[0-9,]+\s*(?:USD|GBP|EUR|CAD|AUD|PKR))/i
      );
      if (balMatch) addField('closingBalance', cleanText(balMatch[1]), 0.94, balMatch[0]);

      const holderMatch = text.match(/(?:account\s*title|account\s*holder|sponsor\s*name)[.:\s]+([A-Za-z\s.]{4,45})/i);
      if (holderMatch) addField('sponsorName', cleanText(holderMatch[1].split('\n')[0]), 0.9, holderMatch[0]);
    }

    // -------------------------------------------------------------------
    // 6. STATEMENT OF PURPOSE & RECOMMENDATION LETTER
    // -------------------------------------------------------------------
    if (category === 'sop') {
      const progMatch = normText.match(
        /(?:applying\s*(?:for|to)\s*(?:the\s*)?|pursue\s*(?:a\s*|the\s*)?)((?:MSc|M\.Sc|Master\s*of\s*[A-Za-z\s]+|BSc|PhD)[A-Za-z\s]{3,45})/i
      );
      if (progMatch) addField('targetProgram', cleanText(progMatch[1]), 0.85, progMatch[0]);
    }

    if (category === 'lor') {
      const refEmail = normText.match(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,7}\b/);
      if (refEmail) addField('recommenderEmail', refEmail[0], 0.92, refEmail[0]);
      const profMatch = text.match(/((?:Prof\.|Professor|Dr\.)\s+[A-Z][A-Za-z\s.]{3,35})/);
      if (profMatch) addField('recommenderName', cleanText(profMatch[1].split('\n')[0]), 0.88, profMatch[0]);
    }

    return { fields, structuredFields, evidence, mrzDetected };
  }

  private toTitleCase(str: string): string {
    return str
      .toLowerCase()
      .replace(/\b\w/g, (ch) => ch.toUpperCase());
  }

  /**
   * Conflict detection: compare newly extracted values against established candidate records
   */
  public detectConflicts(
    extractedFields: Record<string, any>,
    candidate: CandidateProfile,
    docName: string
  ): DocumentConflict[] {
    const conflicts: DocumentConflict[] = [];

    const checkMismatch = (
      fieldKey: string,
      label: string,
      candVal: string | undefined,
      extVal: any
    ) => {
      if (!candVal || !extVal) return;
      const c = cleanText(candVal).toLowerCase();
      const e = cleanText(String(extVal)).toLowerCase();
      if (c && e && c !== e) {
        conflicts.push({
          fieldKey,
          label,
          candidateValue: candVal,
          documentValue: String(extVal),
          documentName: docName,
          resolved: false,
        });
      }
    };

    if (extractedFields.passportNumber) {
      checkMismatch(
        'passport.passportNumber',
        'Passport number',
        candidate.passport?.passportNumber,
        extractedFields.passportNumber
      );
    }
    if (extractedFields.dateOfBirth) {
      checkMismatch(
        'personal.dateOfBirth',
        'Date of birth',
        candidate.personal.dateOfBirth,
        extractedFields.dateOfBirth
      );
    }
    if (extractedFields.nationality) {
      checkMismatch(
        'personal.nationality',
        'Nationality',
        candidate.personal.nationality,
        extractedFields.nationality
      );
    }
    if (extractedFields.familyName) {
      checkMismatch(
        'personal.familyName',
        'Family surname',
        candidate.personal.familyName,
        extractedFields.familyName
      );
    }
    if (extractedFields.email) {
      checkMismatch('contact.email', 'Email address', candidate.contact?.email, extractedFields.email);
    }

    return conflicts;
  }
}
