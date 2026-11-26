import { CandidateProfile, EligibilityCheckResult, UniversityCatalogItem, UniversityProgram } from './types.js';

export function buildDefaultUniversityCatalog(organizationId: string): UniversityCatalogItem[] {
  const now = new Date().toISOString();
  return [
    {
      id: 'uni-manchester',
      organizationId,
      name: 'University of Manchester',
      country: 'United Kingdom',
      city: 'Manchester',
      portalUrl: 'https://my.manchester.ac.uk',
      isPartner: true,
      programs: [
        {
          id: 'prog-man-msc-ai',
          name: 'MSc Artificial Intelligence',
          degreeLevel: "Master's",
          intake: 'September 2027',
          deadline: '2027-03-30',
          tuitionFee: 'GBP 34,500 / yr',
          applicationFee: 'GBP 0',
          minGpa: 3.0,
          minIelts: 6.5,
          requiredDocs: ['passport', 'transcript', 'degree', 'english_test', 'cv', 'sop', 'lor'],
        },
        {
          id: 'prog-man-msc-ds',
          name: 'MSc Data Science',
          degreeLevel: "Master's",
          intake: 'September 2027',
          deadline: '2027-04-15',
          tuitionFee: 'GBP 33,000 / yr',
          applicationFee: 'GBP 0',
          minGpa: 3.0,
          minIelts: 6.5,
          requiredDocs: ['passport', 'transcript', 'degree', 'english_test', 'cv', 'sop'],
        },
      ],
      createdAt: now,
    },
    {
      id: 'uni-leeds',
      organizationId,
      name: 'University of Leeds',
      country: 'United Kingdom',
      city: 'Leeds',
      portalUrl: 'https://apply.leeds.ac.uk',
      isPartner: true,
      programs: [
        {
          id: 'prog-leeds-msc-cs',
          name: 'MSc Advanced Computer Science',
          degreeLevel: "Master's",
          intake: 'September 2027',
          deadline: '2027-06-30',
          tuitionFee: 'GBP 31,750 / yr',
          applicationFee: 'GBP 0',
          minGpa: 2.7,
          minIelts: 6.5,
          requiredDocs: ['passport', 'transcript', 'degree', 'english_test', 'cv'],
        },
        {
          id: 'prog-leeds-bsc-cs',
          name: 'BSc Computer Science',
          degreeLevel: "Bachelor's",
          intake: 'September 2027',
          deadline: '2027-01-29',
          tuitionFee: 'GBP 30,250 / yr',
          applicationFee: 'GBP 28 (UCAS)',
          minGpa: 2.8,
          minIelts: 6.0,
          requiredDocs: ['passport', 'transcript', 'english_test', 'sop'],
        },
      ],
      createdAt: now,
    },
    {
      id: 'uni-tum',
      organizationId,
      name: 'Technical University of Munich (TUM)',
      country: 'Germany',
      city: 'Munich',
      portalUrl: 'https://campus.tum.de',
      isPartner: false,
      programs: [
        {
          id: 'prog-tum-msc-info',
          name: 'MSc Informatics',
          degreeLevel: "Master's",
          intake: 'October 2027',
          deadline: '2027-05-31',
          tuitionFee: 'EUR 6,000 / semester',
          applicationFee: 'EUR 75 (uni-assist VPD)',
          minGpa: 3.1,
          minIelts: 6.5,
          requiredDocs: ['passport', 'transcript', 'degree', 'english_test', 'cv', 'sop'],
        },
      ],
      createdAt: now,
    },
    {
      id: 'uni-toronto',
      organizationId,
      name: 'University of Toronto',
      country: 'Canada',
      city: 'Toronto',
      portalUrl: 'https://apply.utoronto.ca',
      isPartner: true,
      programs: [
        {
          id: 'prog-uoft-mscac',
          name: 'MScAC Applied Computing',
          degreeLevel: "Master's",
          intake: 'September 2027',
          deadline: '2026-12-15',
          tuitionFee: 'CAD 64,810 / yr',
          applicationFee: 'CAD 125',
          minGpa: 3.3,
          minIelts: 7.0,
          requiredDocs: ['passport', 'transcript', 'degree', 'english_test', 'cv', 'sop', 'lor'],
        },
      ],
      createdAt: now,
    },
    {
      id: 'uni-asu',
      organizationId,
      name: 'Arizona State University',
      country: 'United States',
      city: 'Tempe, AZ',
      portalUrl: 'https://webapp4.asu.edu/myasu',
      isPartner: true,
      programs: [
        {
          id: 'prog-asu-ms-cs',
          name: 'MS Computer Science',
          degreeLevel: "Master's",
          intake: 'August 2027',
          deadline: '2027-03-01',
          tuitionFee: 'USD 35,430 / yr',
          applicationFee: 'USD 115',
          minGpa: 3.0,
          minIelts: 6.5,
          requiredDocs: ['passport', 'transcript', 'degree', 'english_test', 'cv', 'sop', 'lor'],
        },
      ],
      createdAt: now,
    },
    {
      id: 'uni-melbourne',
      organizationId,
      name: 'University of Melbourne',
      country: 'Australia',
      city: 'Melbourne',
      portalUrl: 'https://study.unimelb.edu.au',
      isPartner: true,
      programs: [
        {
          id: 'prog-melb-mit',
          name: 'Master of Information Technology',
          degreeLevel: "Master's",
          intake: 'July 2027',
          deadline: '2027-03-31',
          tuitionFee: 'AUD 52,800 / yr',
          applicationFee: 'AUD 130',
          minGpa: 2.8,
          minIelts: 6.5,
          requiredDocs: ['passport', 'transcript', 'degree', 'english_test', 'cv'],
        },
      ],
      createdAt: now,
    },
    {
      id: 'uni-tcd',
      organizationId,
      name: 'Trinity College Dublin',
      country: 'Ireland',
      city: 'Dublin',
      portalUrl: 'https://my.tcd.ie',
      isPartner: true,
      programs: [
        {
          id: 'prog-tcd-msc-cs',
          name: 'MSc Computer Science (Intelligent Systems)',
          degreeLevel: "Master's",
          intake: 'September 2027',
          deadline: '2027-06-30',
          tuitionFee: 'EUR 26,800 / yr',
          applicationFee: 'EUR 55',
          minGpa: 3.0,
          minIelts: 6.5,
          requiredDocs: ['passport', 'transcript', 'degree', 'english_test', 'cv', 'sop', 'lor'],
        },
      ],
      createdAt: now,
    },
  ];
}

function parseNumericGpa(candidate: CandidateProfile): number | null {
  for (const edu of candidate.education || []) {
    if (edu.gpa) {
      const m = String(edu.gpa).match(/(\d+(?:\.\d+)?)/);
      if (m) {
        const val = parseFloat(m[1]);
        if (!Number.isNaN(val) && val > 0 && val <= 4.3) return val;
      }
    }
  }
  return null;
}

function parseBestIelts(candidate: CandidateProfile): number | null {
  let best: number | null = null;
  for (const test of candidate.englishTests || []) {
    if (test.testType === 'IELTS' && test.overallScore) {
      const m = String(test.overallScore).match(/(\d+(?:\.\d+)?)/);
      if (m) {
        const val = parseFloat(m[1]);
        if (!Number.isNaN(val) && (best === null || val > best)) best = val;
      }
    }
  }
  return best;
}

export function evaluateEligibility(
  candidate: CandidateProfile,
  program: UniversityProgram
): EligibilityCheckResult {
  const checks: EligibilityCheckResult['checks'] = [];
  let hasMiss = false;
  let hasUnknown = false;

  if (typeof program.minGpa === 'number') {
    const gpa = parseNumericGpa(candidate);
    if (gpa === null) {
      hasUnknown = true;
      checks.push({
        label: `GPA ≥ ${program.minGpa.toFixed(1)}`,
        met: null,
        detail: 'No 4.0 GPA recorded on dossier',
      });
    } else {
      const met = gpa >= program.minGpa;
      if (!met) hasMiss = true;
      checks.push({
        label: `GPA ≥ ${program.minGpa.toFixed(1)}`,
        met,
        detail: `Student ${gpa.toFixed(2)} / 4.0`,
      });
    }
  }

  if (typeof program.minIelts === 'number') {
    const ielts = parseBestIelts(candidate);
    if (ielts === null) {
      hasUnknown = true;
      checks.push({
        label: `IELTS ≥ ${program.minIelts.toFixed(1)}`,
        met: null,
        detail: 'No IELTS score recorded',
      });
    } else {
      const met = ielts >= program.minIelts;
      if (!met) hasMiss = true;
      checks.push({
        label: `IELTS ≥ ${program.minIelts.toFixed(1)}`,
        met,
        detail: `Student IELTS ${ielts.toFixed(1)}`,
      });
    }
  }

  const status: EligibilityCheckResult['status'] = hasMiss
    ? 'borderline'
    : hasUnknown
      ? 'check_required'
      : 'eligible';

  return { status, checks };
}
