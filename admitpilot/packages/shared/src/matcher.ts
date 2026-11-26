import {
  FormField,
  CandidateProfile,
  CandidateDocument,
  DocumentCategory,
  FieldMapping,
  FileFieldMapping,
  MatchConfidence,
} from './types.js';
import { normalizeComparable, normalizeDate, nationalityToCountry } from './normalizer.js';

interface RuleMatch {
  candidateKey: string;
  getValue: (p: CandidateProfile) => any;
  confidence: MatchConfidence;
  confidenceScore: number;
  reasoning: string;
}

// Deterministic rules mapping normalized keywords to candidate profile paths
const RULES: Array<{
  patterns: RegExp[];
  excludePatterns?: RegExp[];
  match: (p: CandidateProfile, field: FormField) => RuleMatch | null;
}> = [
  // First Name / Given Names
  {
    patterns: [
      /\bfirst\s*name\b/i,
      /\bgiven\s*names?\b/i,
      /\bforename\b/i,
      /\blegal\s*given\b/i,
    ],
    excludePatterns: [/\blast\b/i, /\bfamily\b/i, /\bsurname\b/i, /\bfather\b/i, /\bmother\b/i, /\bemergency\b/i, /\breferee\b/i],
    match: (p) => {
      const val = p.personal?.legalGivenName;
      if (!val) return null;
      return {
        candidateKey: 'personal.legalGivenName',
        getValue: () => val,
        confidence: 'high',
        confidenceScore: 0.98,
        reasoning: 'Unambiguous match for applicant given name',
      };
    },
  },

  // Last Name / Family Name / Surname
  {
    patterns: [
      /\blast\s*name\b/i,
      /\bfamily\s*name\b/i,
      /\bsurname\b/i,
      /\blegal\s*family\b/i,
      /travel\s*document.*surname/i,
    ],
    excludePatterns: [/\bfirst\b/i, /\bgiven\b/i, /\bfather\b/i, /\bmother\b/i, /\breferee\b/i],
    match: (p) => {
      const val = p.personal?.familyName || p.passport?.fullName?.split(' ').pop();
      if (!val) return null;
      return {
        candidateKey: 'personal.familyName',
        getValue: () => val,
        confidence: 'high',
        confidenceScore: 0.98,
        reasoning: 'Unambiguous match for applicant surname / family name',
      };
    },
  },

  // Full Name
  {
    patterns: [
      /\bfull\s*name\b/i,
      /\bapplicant\s*name\b/i,
      /\bcandidate\s*name\b/i,
      /\bname\s*as\s*(shown|printed|displayed)\s*on\s*passport\b/i,
    ],
    excludePatterns: [/\breferee\b/i, /\bemergency\b/i, /\bfather\b/i, /\bmother\b/i, /\bsponsor\b/i],
    match: (p) => {
      const val = p.passport?.fullName || `${p.personal?.legalGivenName} ${p.personal?.familyName}`.trim();
      if (!val) return null;
      return {
        candidateKey: 'passport.fullName',
        getValue: () => val,
        confidence: 'high',
        confidenceScore: 0.95,
        reasoning: 'Matched candidate full name as specified on legal documents',
      };
    },
  },

  // Date of Birth
  {
    patterns: [
      /\b(date\s*of\s*birth|birth\s*date|dob)\b/i,
      /\bbirthdate\b/i,
    ],
    match: (p) => {
      const val = p.personal?.dateOfBirth || p.passport?.dateOfBirth;
      if (!val) return null;
      return {
        candidateKey: 'personal.dateOfBirth',
        getValue: () => val,
        confidence: 'high',
        confidenceScore: 0.99,
        reasoning: 'Verified applicant birth date',
      };
    },
  },

  // Gender
  {
    patterns: [/\bgender\b/i, /\bsex\b/i],
    match: (p) => {
      const val = p.personal?.gender;
      if (!val) return null;
      return {
        candidateKey: 'personal.gender',
        getValue: () => val,
        confidence: 'high',
        confidenceScore: 0.95,
        reasoning: 'Applicant gender identity',
      };
    },
  },

  // Nationality / Country of Citizenship
  {
    patterns: [
      /\bnationality\b/i,
      /\bcountry\s*of\s*citizenship\b/i,
      /\bcitizenship\b/i,
    ],
    excludePatterns: [/\bbirth\b/i, /\bresidence\b/i],
    match: (p, field) => {
      let val = p.personal?.nationality || p.passport?.nationality;
      if (!val) return null;

      // If dropdown options exist, see if country name matches (e.g. "Pakistan" vs "Pakistani")
      if (field.options && field.options.length) {
        const countryName = nationalityToCountry(val);
        const matchOpt = field.options.find(
          (o) =>
            normalizeComparable(o) === normalizeComparable(val) ||
            normalizeComparable(o) === normalizeComparable(countryName)
        );
        if (matchOpt) val = matchOpt;
      }

      return {
        candidateKey: 'personal.nationality',
        getValue: () => val,
        confidence: 'high',
        confidenceScore: 0.95,
        reasoning: 'Applicant legal nationality / citizenship',
      };
    },
  },

  // Country of Birth (strictly distinguished from nationality)
  {
    patterns: [/\bcountry\s*of\s*birth\b/i, /\bbirth\s*country\b/i],
    match: (p) => {
      const val = p.personal?.countryOfBirth;
      if (!val) return null;
      return {
        candidateKey: 'personal.countryOfBirth',
        getValue: () => val,
        confidence: 'high',
        confidenceScore: 0.95,
        reasoning: 'Applicant country of birth',
      };
    },
  },

  // Passport Number
  {
    patterns: [
      /\bpassport\s*number\b/i,
      /\bpassport\s*no\b/i,
      /\btravel\s*doc(ument)?\s*no\b/i,
    ],
    match: (p) => {
      const val = p.passport?.passportNumber;
      if (!val) return null;
      return {
        candidateKey: 'passport.passportNumber',
        getValue: () => val,
        confidence: 'high',
        confidenceScore: 0.99,
        reasoning: 'Verified passport document number',
      };
    },
  },

  // Passport Expiry Date
  {
    patterns: [
      /\bpassport\s*expir(y|ation)\b/i,
      /\bpassport\s*valid\s*until\b/i,
    ],
    match: (p) => {
      const val = p.passport?.expiryDate;
      if (!val) return null;
      return {
        candidateKey: 'passport.expiryDate',
        getValue: () => val,
        confidence: 'high',
        confidenceScore: 0.99,
        reasoning: 'Verified passport expiration date',
      };
    },
  },

  // Passport Issue Date
  {
    patterns: [
      /\bpassport\s*issue\s*date\b/i,
      /\bdate\s*of\s*issue\b/i,
    ],
    match: (p) => {
      const val = p.passport?.issueDate;
      if (!val) return null;
      return {
        candidateKey: 'passport.issueDate',
        getValue: () => val,
        confidence: 'high',
        confidenceScore: 0.98,
        reasoning: 'Passport date of issue',
      };
    },
  },

  // Email
  {
    patterns: [
      /\bemail\b/i,
      /\be-mail\b/i,
      /\bemail\s*address\b/i,
    ],
    excludePatterns: [/\bagent\b/i, /\bconsultant\b/i, /\breferee\b/i, /\bemergency\b/i, /\balternative\b/i],
    match: (p) => {
      const managed = p.contact?.managedStudentEmail?.trim();
      const val = managed || p.contact?.email;
      if (!val) return null;
      return {
        candidateKey: managed ? 'contact.managedStudentEmail' : 'contact.email',
        getValue: () => val,
        confidence: 'high',
        confidenceScore: 0.99,
        reasoning: managed
          ? 'Consultant-managed dedicated student application email'
          : 'Applicant primary email address',
      };
    },
  },

  // Phone / Mobile
  {
    patterns: [
      /\b(mobile|cell|phone|telephone)\b/i,
      /\bcontact\s*number\b/i,
    ],
    excludePatterns: [/\bagent\b/i, /\bemergency\b/i, /\breferee\b/i, /\balternative\b/i, /\bfax\b/i],
    match: (p) => {
      const val = p.contact?.phone;
      if (!val) return null;
      return {
        candidateKey: 'contact.phone',
        getValue: () => val,
        confidence: 'high',
        confidenceScore: 0.95,
        reasoning: 'Applicant direct phone number',
      };
    },
  },

  // Street Address Line 1
  {
    patterns: [
      /\baddress\s*line\s*1\b/i,
      /\bstreet\s*address\b/i,
      /\bcurrent\s*address\b/i,
      /\bresidential\s*address\b/i,
    ],
    excludePatterns: [/\bline\s*2\b/i, /\bcity\b/i, /\bstate\b/i, /\bpostal\b/i, /\bzip\b/i],
    match: (p) => {
      const val = p.contact?.currentAddress;
      if (!val) return null;
      return {
        candidateKey: 'contact.currentAddress',
        getValue: () => val,
        confidence: 'high',
        confidenceScore: 0.95,
        reasoning: 'Applicant street address line 1',
      };
    },
  },

  // City
  {
    patterns: [/\bcity\b/i, /\btown\b/i],
    excludePatterns: [/\bbirth\b/i, /\bissue\b/i],
    match: (p) => {
      const val = p.contact?.city;
      if (!val) return null;
      return {
        candidateKey: 'contact.city',
        getValue: () => val,
        confidence: 'high',
        confidenceScore: 0.96,
        reasoning: 'Applicant residential city',
      };
    },
  },

  // State / Province
  {
    patterns: [/\bstate\b/i, /\bprovince\b/i, /\bregion\b/i],
    match: (p) => {
      const val = p.contact?.state;
      if (!val) return null;
      return {
        candidateKey: 'contact.state',
        getValue: () => val,
        confidence: 'high',
        confidenceScore: 0.95,
        reasoning: 'Applicant state or province',
      };
    },
  },

  // Postal / Zip Code
  {
    patterns: [/\b(postal\s*code|zip\s*code|postcode|zip)\b/i],
    match: (p) => {
      const val = p.contact?.postalCode;
      if (!val) return null;
      return {
        candidateKey: 'contact.postalCode',
        getValue: () => val,
        confidence: 'high',
        confidenceScore: 0.97,
        reasoning: 'Applicant postal/ZIP code',
      };
    },
  },

  // Country of Residence
  {
    patterns: [
      /\bcountry\s*of\s*residence\b/i,
      /\bcurrent\s*country\b/i,
      /\baddress\s*country\b/i,
    ],
    match: (p) => {
      const val = p.contact?.country;
      if (!val) return null;
      return {
        candidateKey: 'contact.country',
        getValue: () => val,
        confidence: 'high',
        confidenceScore: 0.95,
        reasoning: 'Applicant current country of residence',
      };
    },
  },

  // English Proficiency Overall Band / Score
  {
    patterns: [
      /\bielts\s*(overall|band|score)\b/i,
      /\benglish\s*test\s*score\b/i,
      /\boverall\s*band\b/i,
      /\boverall\s*ielts\b/i,
    ],
    match: (p) => {
      const test = p.englishTests?.[0];
      if (!test?.overallScore) return null;
      return {
        candidateKey: 'englishTests[0].overallScore',
        getValue: () => test.overallScore,
        confidence: 'high',
        confidenceScore: 0.95,
        reasoning: `${test.testType} overall score (${test.overallScore})`,
      };
    },
  },

  // Highest Qualification / Degree Title
  {
    patterns: [
      /\bdegree\s*title\b/i,
      /\bqualification\s*(title|obtained|name)\b/i,
      /\bmajor\b/i,
      /\bfield\s*of\s*study\b/i,
    ],
    match: (p) => {
      const edu = p.education?.[0];
      if (!edu?.degreeTitle) return null;
      return {
        candidateKey: 'education[0].degreeTitle',
        getValue: () => edu.degreeTitle,
        confidence: 'medium',
        confidenceScore: 0.85,
        reasoning: `Applicant most recent degree: ${edu.degreeTitle} in ${edu.major}`,
      };
    },
  },

  // University / Previous Institution
  {
    patterns: [
      /\b(previous\s*institution|undergraduate\s*university|awarding\s*institution|school\s*name)\b/i,
    ],
    match: (p) => {
      const edu = p.education?.[0];
      if (!edu?.institution) return null;
      return {
        candidateKey: 'education[0].institution',
        getValue: () => edu.institution,
        confidence: 'high',
        confidenceScore: 0.92,
        reasoning: `Applicant recent institution: ${edu.institution}`,
      };
    },
  },

  // CGPA / GPA
  {
    patterns: [/\b(cgpa|gpa|grade\s*point\s*average)\b/i],
    match: (p) => {
      const edu = p.education?.[0];
      if (!edu?.gpa) return null;
      return {
        candidateKey: 'education[0].gpa',
        getValue: () => edu.gpa,
        confidence: 'medium',
        confidenceScore: 0.88,
        reasoning: `Recorded GPA (${edu.gpa}${edu.gradingScale ? ' on ' + edu.gradingScale + ' scale' : ''}) without conversion`,
      };
    },
  },
];

/**
 * Match a form field deterministically against candidate records
 */
export function matchFieldDeterministically(field: FormField, candidate: CandidateProfile): FieldMapping | null {
  const labelText = field.label || '';
  const nameText = field.name || '';
  const placeholderText = field.placeholder || '';
  const combined = `${labelText} ${nameText} ${placeholderText}`.trim();

  for (const rule of RULES) {
    const isExcluded = rule.excludePatterns?.some((p) => p.test(combined));
    if (isExcluded) continue;

    const isMatch = rule.patterns.some((p) => p.test(combined));
    if (isMatch) {
      const res = rule.match(candidate, field);
      if (res) {
        let suggestedVal = res.getValue(candidate);

        // Date formatting if field is date
        if (field.kind === 'datepicker' || field.type === 'date') {
          suggestedVal = normalizeDate(suggestedVal) || suggestedVal;
        }

        // Option matching for selects
        if ((field.kind === 'select' || field.kind === 'combobox') && field.options?.length) {
          const normVal = normalizeComparable(String(suggestedVal));
          const matchedOpt = field.options.find((o) => normalizeComparable(o) === normVal);
          if (matchedOpt) {
            suggestedVal = matchedOpt;
          }
        }

        return {
          fieldId: field.id,
          fieldLabel: field.label || field.name,
          candidateFieldKey: res.candidateKey,
          suggestedValue: suggestedVal,
          confidence: res.confidence,
          confidenceScore: res.confidenceScore,
          reasoning: res.reasoning,
          status: 'approved',
          isConfirmedFact: res.confidence === 'high',
        };
      }
    }
  }

  return null;
}

/**
 * Batch match all fields: uses deterministic match first, tags remaining fields for AI or manual review
 */
export function matchFormFields(
  fields: FormField[],
  candidate: CandidateProfile
): {
  mappings: FieldMapping[];
  unmatchedFields: FormField[];
} {
  const mappings: FieldMapping[] = [];
  const unmatchedFields: FormField[] = [];

  for (const field of fields) {
    if (field.kind === 'file' || field.type === 'file') {
      continue;
    }
    const detMatch = matchFieldDeterministically(field, candidate);
    if (detMatch) {
      mappings.push(detMatch);
    } else {
      unmatchedFields.push(field);
    }
  }

  return { mappings, unmatchedFields };
}

const CATEGORY_FILE_SLUGS: Record<DocumentCategory, string> = {
  passport: 'Passport',
  transcript: 'Academic_Transcript',
  degree: 'Degree_Certificate',
  english_test: 'English_Proficiency',
  cv: 'CV_Resume',
  sop: 'Statement_of_Purpose',
  lor: 'Recommendation_Letter',
  financial: 'Financial_Statement',
  experience: 'Employment_Letter',
  other: 'Supporting_Document',
};

/**
 * Generates a standardized, university-portal-safe filename for downloading & uploading
 * e.g. "Khan_MuhammadAli_Passport.pdf"
 */
export function buildPortalFileName(
  candidate: CandidateProfile,
  category: DocumentCategory,
  originalFileName: string
): string {
  const extMatch = originalFileName.match(/\.[a-zA-Z0-9]{2,5}$/);
  const ext = extMatch ? extMatch[0].toLowerCase() : '.pdf';
  const family = (candidate.personal.familyName || 'Applicant').replace(/[^a-zA-Z0-9]/g, '');
  const given = (candidate.personal.legalGivenName || 'Candidate').replace(/[^a-zA-Z0-9]/g, '');
  const slug = CATEGORY_FILE_SLUGS[category] || 'Document';
  return `${family}_${given}_${slug}${ext}`;
}

const FILE_SLOT_RULES: Array<{
  category: DocumentCategory;
  label: string;
  patterns: RegExp[];
}> = [
  {
    category: 'passport',
    label: 'Passport / travel document',
    patterns: [/\bpassport\b/i, /\btravel\s*doc/i, /\bio[- ]?page\b/i, /\bidentity\s*doc/i, /\bnational\s*id\b/i],
  },
  {
    category: 'transcript',
    label: 'Academic transcript',
    patterns: [/\btranscript/i, /\bmark\s*sheet/i, /\bacademic\s*record/i, /\bgrade\s*report/i],
  },
  {
    category: 'degree',
    label: 'Degree certificate / diploma',
    patterns: [/\bdegree\s*(cert|diploma)/i, /\bgraduation\s*cert/i, /\bdiploma\b/i, /\baward\s*cert/i],
  },
  {
    category: 'english_test',
    label: 'English proficiency score report',
    patterns: [/\bielts\b/i, /\btoefl\b/i, /\bpte\b/i, /\bduolingo\b/i, /\benglish\s*(proficiency|test|score|cert)/i, /\blanguage\s*(cert|test|score)/i],
  },
  {
    category: 'cv',
    label: 'Curriculum vitae / resume',
    patterns: [/\b(cv|c\.v\.|resume|curriculum\s*vitae)\b/i],
  },
  {
    category: 'sop',
    label: 'Statement of purpose / personal statement',
    patterns: [/\bstatement\s*of\s*purpose\b/i, /\bpersonal\s*statement\b/i, /\bmotivation\s*letter\b/i, /\bsop\b/i, /\bessay\b/i],
  },
  {
    category: 'lor',
    label: 'Letter of recommendation',
    patterns: [/\brecommendation\b/i, /\breference\s*letter\b/i, /\blor\b/i, /\breferee\b/i],
  },
  {
    category: 'financial',
    label: 'Financial / sponsorship proof',
    patterns: [/\bfinancial\b/i, /\bbank\s*statement\b/i, /\bsponsorship\b/i, /\bproof\s*of\s*funds\b/i],
  },
  {
    category: 'experience',
    label: 'Work experience letter',
    patterns: [/\bexperience\s*letter\b/i, /\bemployment\s*(cert|letter|proof)\b/i],
  },
];

/**
 * Matches `<input type="file">` fields on university portals to candidate's uploaded documents
 */
export function matchFileUploadFields(
  fields: FormField[],
  documents: CandidateDocument[],
  candidate: CandidateProfile
): FileFieldMapping[] {
  const fileFields = fields.filter((f) => f.kind === 'file' || f.type === 'file');
  const results: FileFieldMapping[] = [];

  for (const field of fileFields) {
    const combined = `${field.label || ''} ${field.name || ''} ${field.placeholder || ''} ${field.sectionHeading || ''}`.trim();
    let expectedCategory: DocumentCategory = 'other';
    let categoryLabel = 'Supporting document';

    for (const rule of FILE_SLOT_RULES) {
      if (rule.patterns.some((p) => p.test(combined))) {
        expectedCategory = rule.category;
        categoryLabel = rule.label;
        break;
      }
    }

    const candidatesForSlot = documents.filter((d) => d.category === expectedCategory);
    // Fallback: if degree certificate requested and only transcript uploaded (or vice versa), don't invent, keep strict category match
    const matchedDoc = candidatesForSlot[0];

    if (matchedDoc) {
      const portalName =
        matchedDoc.portalFileName ||
        buildPortalFileName(candidate, matchedDoc.category, matchedDoc.fileName);

      results.push({
        fieldId: field.id,
        fieldLabel: field.label || field.name || categoryLabel,
        required: field.required,
        accept: field.accept,
        expectedCategory,
        matchedDocumentId: matchedDoc.id,
        matchedFileName: matchedDoc.fileName,
        portalFileName: portalName,
        mimeType: matchedDoc.mimeType,
        fileSize: matchedDoc.fileSize,
        confidence: 'high',
        reasoning: `Matched verified ${categoryLabel} (${matchedDoc.fileName})`,
        status: 'approved',
      });
    } else {
      results.push({
        fieldId: field.id,
        fieldLabel: field.label || field.name || categoryLabel,
        required: field.required,
        accept: field.accept,
        expectedCategory,
        confidence: 'low',
        reasoning: `No ${categoryLabel.toLowerCase()} uploaded in candidate dossier yet`,
        status: 'missing',
      });
    }
  }

  return results;
}

