import React from 'react';
import { CandidateProfile } from 'admitpilot-shared';

export type StampTone = 'positive' | 'brass' | 'negative' | 'neutral';

const EXTRACTION_METHOD_LABELS: Record<string, string> = {
  hybrid_ai: 'Hybrid AI',
  ai_vision: 'AI Vision',
  ai: 'AI',
  'mrz+text': 'MRZ + Text',
  mrz: 'MRZ',
  ocr: 'OCR',
  text: 'Text',
  regex: 'Pattern',
  manual: 'Manual',
};

const CATEGORY_LABELS: Record<string, string> = {
  passport: 'Passport',
  cv: 'CV',
  transcript: 'Transcript',
  degree: 'Degree',
  english_test: 'English test',
  sop: 'SOP',
  lor: 'LOR',
  experience: 'Experience',
  financial: 'Financial',
  other: 'Other',
};

export function formatExtractionMethod(method?: string): string {
  if (!method) return '';
  return EXTRACTION_METHOD_LABELS[method] || method.replace(/_/g, ' ');
}

export function formatCategoryLabel(category?: string): string {
  if (!category) return '';
  return (
    CATEGORY_LABELS[category] ||
    category.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase())
  );
}

export const VerificationStamp: React.FC<{
  tone?: StampTone;
  label: string;
  meta?: string;
}> = ({ tone = 'neutral', label, meta }) => {
  const dotClass =
    tone === 'positive'
      ? 'bg-tone-positive'
      : tone === 'brass'
      ? 'bg-brass'
      : tone === 'negative'
      ? 'bg-tone-negative'
      : 'bg-ink-muted';

  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium tabular-nums text-ink-secondary whitespace-nowrap">
      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${dotClass}`} />
      <span>{label}</span>
      {meta && <span className="text-ink-muted font-normal truncate max-w-[220px]">· {meta}</span>}
    </span>
  );
};

function padMrz(str: string, len: number): string {
  const cleaned = str.toUpperCase().replace(/[^A-Z0-9]/g, '<');
  return cleaned.length >= len ? cleaned.slice(0, len) : cleaned + '<'.repeat(len - cleaned.length);
}

function formatMrzDate(iso?: string): string {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return '000101';
  return iso.slice(2, 4) + iso.slice(5, 7) + iso.slice(8, 10);
}

const ISO3_MAP: Record<string, string> = {
  pakistani: 'PAK',
  pakistan: 'PAK',
  indian: 'IND',
  india: 'IND',
  british: 'GBR',
  'united kingdom': 'GBR',
  american: 'USA',
  'united states': 'USA',
  canadian: 'CAN',
  canada: 'CAN',
  nigerian: 'NGA',
  nigeria: 'NGA',
  australian: 'AUS',
  australia: 'AUS',
  chinese: 'CHN',
  china: 'CHN',
  german: 'DEU',
  germany: 'DEU',
};

function toIso3(countryOrNat?: string): string {
  if (!countryOrNat) return 'UTO';
  const key = countryOrNat.trim().toLowerCase();
  if (ISO3_MAP[key]) return ISO3_MAP[key];
  return padMrz(countryOrNat.slice(0, 3), 3);
}

export function buildCandidateMRZ(candidate: CandidateProfile): [string, string] {
  const state = toIso3(candidate.passport?.issuingCountry || candidate.personal.nationality);
  const surname = (candidate.personal.familyName || 'APPLICANT').toUpperCase().replace(/[^A-Z]/g, '<');
  const given = (candidate.personal.legalGivenName || 'CANDIDATE')
    .toUpperCase()
    .trim()
    .replace(/\s+/g, '<')
    .replace(/[^A-Z<]/g, '');
  const line1 = padMrz(`P<${state}${surname}<<${given}`, 44);

  const passNo = padMrz(candidate.passport?.passportNumber || 'UNVERIFIED', 9);
  const nat = toIso3(candidate.personal.nationality);
  const dob = formatMrzDate(candidate.personal.dateOfBirth);
  const sex = candidate.personal.gender?.toUpperCase().startsWith('F')
    ? 'F'
    : candidate.personal.gender?.toUpperCase().startsWith('M')
    ? 'M'
    : '<';
  const exp = formatMrzDate(candidate.passport?.expiryDate || '2030-01-01');
  const line2 = padMrz(`${passNo}4${nat}${dob}9${sex}${exp}6<<<<<<<<<<<<<<02`, 44);
  return [line1, line2];
}

export const PassportCredentialCard: React.FC<{
  candidate: CandidateProfile;
  onInspectDossier?: () => void;
}> = ({ candidate, onInspectDossier }) => {
  const [mrz1, mrz2] = buildCandidateMRZ(candidate);
  const latestEdu = candidate.education[0];
  const latestTest = candidate.englishTests[0];
  const hasPassport = Boolean(candidate.passport?.passportNumber);

  return (
    <div className="rounded-xl bg-surface-card border border-brass-border overflow-hidden flex flex-col justify-between shadow-[inset_0_1px_0_rgba(212,168,83,0.14)]">
      {/* Top Passport Foil Header */}
      <div className="px-5 pt-4 pb-3 border-b border-[rgba(212,168,83,0.14)] flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          {/* Minimal consular passport emblem */}
          <svg
            viewBox="0 0 20 20"
            fill="none"
            className="w-4 h-4 text-brass shrink-0"
            stroke="currentColor"
            strokeWidth="1.4"
          >
            <rect x="3" y="2.5" width="14" height="15" rx="2" />
            <circle cx="10" cy="9" r="3" />
            <path d="M6.5 14.5h7" />
          </svg>
          <span className="font-mono text-xs text-brass whitespace-nowrap">
            Passport & credential
          </span>
        </div>
        <VerificationStamp
          tone={hasPassport ? 'positive' : 'negative'}
          label={hasPassport ? 'verified' : 'missing'}
        />
      </div>

      {/* Bio-page Grid */}
      <div className="p-5 space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-xs text-ink-muted">Applicant legal name</p>
            <p className="text-base font-medium text-ink-primary truncate mt-0.5">
              {candidate.personal.familyName}, {candidate.personal.legalGivenName}
            </p>
          </div>
          <div className="text-right shrink-0">
            <p className="text-xs text-ink-muted">Passport no</p>
            <p className="font-mono text-sm font-medium text-brass tabular-nums mt-0.5">
              {candidate.passport?.passportNumber || '—'}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3 pt-3 border-t border-[rgba(237,237,237,0.06)]">
          <div>
            <p className="text-xs text-ink-muted">Nationality</p>
            <p className="text-[13px] text-ink-primary mt-0.5 truncate">{candidate.personal.nationality}</p>
          </div>
          <div>
            <p className="text-xs text-ink-muted">Birth date</p>
            <p className="font-mono text-xs text-ink-primary tabular-nums mt-1">
              {candidate.personal.dateOfBirth}
            </p>
          </div>
          <div>
            <p className="text-xs text-ink-muted">Valid until</p>
            <p className="font-mono text-xs text-ink-primary tabular-nums mt-1">
              {candidate.passport?.expiryDate || '—'}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 pt-3 border-t border-[rgba(237,237,237,0.06)]">
          <div>
            <p className="text-xs text-ink-muted">Verified GPA</p>
            <p className="font-mono text-sm text-ink-primary tabular-nums mt-0.5">
              {latestEdu?.gpa ? `${latestEdu.gpa}${latestEdu.gradingScale ? ` / ${latestEdu.gradingScale}` : ''}` : '—'}
            </p>
            <p className="text-xs text-ink-secondary truncate mt-0.5">
              {latestEdu ? latestEdu.institution : 'No degree logged'}
            </p>
          </div>
          <div>
            <p className="text-xs text-ink-muted">Language band</p>
            <p className="font-mono text-sm text-ink-primary tabular-nums mt-0.5">
              {latestTest ? `${latestTest.testType} ${latestTest.overallScore}` : '—'}
            </p>
            <p className="text-xs text-ink-secondary truncate mt-0.5">
              {latestTest?.referenceNumber ? `TRF ${latestTest.referenceNumber}` : 'No score report'}
            </p>
          </div>
        </div>

        {onInspectDossier && (
          <div className="pt-1">
            <button
              type="button"
              onClick={onInspectDossier}
              className="text-xs text-brass hover:underline font-medium"
            >
              Open full candidate dossier →
            </button>
          </div>
        )}
      </div>

      {/* ICAO TD3 Machine Readable Zone Strip */}
      <div className="px-4 py-3 bg-surface-deep border-t border-[rgba(212,168,83,0.14)] font-mono text-[11px] leading-4 text-ink-muted tracking-normal overflow-x-auto select-all">
        <div className="whitespace-nowrap">{mrz1}</div>
        <div className="whitespace-nowrap">{mrz2}</div>
      </div>
    </div>
  );
};
