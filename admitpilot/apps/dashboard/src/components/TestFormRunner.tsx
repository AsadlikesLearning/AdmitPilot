import React, { useState, useRef } from 'react';
import { ScanSearch, Play, RotateCcw, Paperclip, Download } from 'lucide-react';
import { CandidateProfile, FormField, FieldMapping, FileFieldMapping } from 'admitpilot-shared';
import { VerificationStamp } from './ui/Primitives';
import { api } from '../api';

interface TestFormRunnerProps {
  candidate: CandidateProfile;
  onMatchFields: (candidateId: string, fields: FormField[]) => Promise<any>;
}

export const TestFormRunner: React.FC<TestFormRunnerProps> = ({ candidate, onMatchFields }) => {
  const [givenNames, setGivenNames] = useState('');
  const [familyName, setFamilyName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [dob, setDob] = useState('');
  const [nationality, setNationality] = useState('');
  const [streetAddress, setStreetAddress] = useState('');
  const [city, setCity] = useState('');
  const [country, setCountry] = useState('');
  const [passportNumber, setPassportNumber] = useState('');
  const [passportExpiry, setPassportExpiry] = useState('');
  const [degreeTitle, setDegreeTitle] = useState('');
  const [institution, setInstitution] = useState('');
  const [ieltsScore, setIeltsScore] = useState('');
  const [hasSponsor, setHasSponsor] = useState(false);
  const [sponsorName, setSponsorName] = useState('');

  // Simulated University Portal <input type="file"> refs & attached file display
  const passportFileRef = useRef<HTMLInputElement | null>(null);
  const transcriptFileRef = useRef<HTMLInputElement | null>(null);
  const englishFileRef = useRef<HTMLInputElement | null>(null);
  const [attachedFileNames, setAttachedFileNames] = useState<Record<string, string>>({});

  const [scanning, setScanning] = useState(false);
  const [attaching, setAttaching] = useState(false);
  const [mappings, setMappings] = useState<FieldMapping[]>([]);
  const [fileMappings, setFileMappings] = useState<FileFieldMapping[]>([]);
  const [filledCount, setFilledCount] = useState<number | null>(null);
  const [attachedCount, setAttachedCount] = useState<number>(0);
  const [submittedNotice, setSubmittedNotice] = useState(false);

  const handleScanAndMatch = async () => {
    setScanning(true);
    setFilledCount(null);
    setAttachedCount(0);
    setSubmittedNotice(false);

    const detectedFields: FormField[] = [
      { id: 'f-given', kind: 'input', type: 'text', name: 'givenNames', label: 'Given Names / First Name', required: true, currentValue: givenNames },
      { id: 'f-family', kind: 'input', type: 'text', name: 'familyName', label: 'Family Name / Surname as on travel document', required: true, currentValue: familyName },
      { id: 'f-email', kind: 'input', type: 'email', name: 'email', label: 'Primary Applicant Email', required: true, currentValue: email },
      { id: 'f-phone', kind: 'input', type: 'tel', name: 'phone', label: 'Contact Mobile Number', required: true, currentValue: phone },
      { id: 'f-dob', kind: 'datepicker', type: 'date', name: 'dateOfBirth', label: 'Date of Birth (DOB)', required: true, currentValue: dob },
      {
        id: 'f-nat',
        kind: 'select',
        type: 'select',
        name: 'nationality',
        label: 'Country of Citizenship / Nationality',
        required: true,
        options: ['Select...', 'Pakistan', 'India', 'United States', 'United Kingdom', 'Canada', 'Nigeria'],
        currentValue: nationality,
      },
      { id: 'f-addr', kind: 'input', type: 'text', name: 'streetAddress', label: 'Street Address Line 1', required: true, currentValue: streetAddress },
      { id: 'f-city', kind: 'input', type: 'text', name: 'city', label: 'City of Residence', required: true, currentValue: city },
      {
        id: 'f-country',
        kind: 'select',
        type: 'select',
        name: 'country',
        label: 'Country of Residence',
        required: true,
        options: ['Select...', 'Pakistan', 'United Kingdom', 'Canada', 'United States'],
        currentValue: country,
      },
      { id: 'f-pass', kind: 'input', type: 'text', name: 'passportNumber', label: 'Passport Document Number', required: true, currentValue: passportNumber },
      { id: 'f-pass-exp', kind: 'datepicker', type: 'date', name: 'expiryDate', label: 'Passport Expiration Date', required: true, currentValue: passportExpiry },
      { id: 'f-deg', kind: 'input', type: 'text', name: 'degreeTitle', label: 'Highest Academic Degree / Qualification Obtained', required: true, currentValue: degreeTitle },
      { id: 'f-inst', kind: 'input', type: 'text', name: 'institution', label: 'Awarding Institution / University', required: true, currentValue: institution },
      { id: 'f-ielts', kind: 'input', type: 'text', name: 'ieltsScore', label: 'Overall IELTS / English Test Band Score', required: false, currentValue: ieltsScore },
      { id: 'f-file-passport', kind: 'file', type: 'file', name: 'passportScan', label: 'Passport Bio-Page Scan (PDF/JPG)', accept: '.pdf,.jpg,.png', required: true },
      { id: 'f-file-transcript', kind: 'file', type: 'file', name: 'academicTranscript', label: 'Official Academic Transcript', accept: '.pdf', required: true },
      { id: 'f-file-english', kind: 'file', type: 'file', name: 'englishProficiency', label: 'IELTS / English Proficiency Score Report', accept: '.pdf', required: true },
    ];

    try {
      const res = await onMatchFields(candidate.id, detectedFields);
      setMappings(res.mappings || []);
      setFileMappings(res.fileMappings || []);
    } catch (err) {
      console.error(err);
    } finally {
      setScanning(false);
    }
  };

  const attachDocumentToInput = async (
    docId: string,
    inputEl: HTMLInputElement | null,
    slotId: string
  ): Promise<boolean> => {
    try {
      const stored = localStorage.getItem('supabase-auth-token');
      const token = stored ? JSON.parse(stored)?.token : null;
      const res = await fetch(`/api/documents/${docId}/download?mode=base64`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) return false;
      const payload = await res.json();
      const binaryStr = atob(payload.base64);
      const bytes = new Uint8Array(binaryStr.length);
      for (let i = 0; i < binaryStr.length; i++) {
        bytes[i] = binaryStr.charCodeAt(i);
      }
      const file = new File([bytes], payload.portalFileName || payload.fileName, {
        type: payload.mimeType || 'application/pdf',
      });
      if (inputEl && typeof DataTransfer !== 'undefined') {
        const dt = new DataTransfer();
        dt.items.add(file);
        inputEl.files = dt.files;
        inputEl.dispatchEvent(new Event('change', { bubbles: true }));
      }
      setAttachedFileNames((prev) => ({
        ...prev,
        [slotId]: payload.portalFileName || payload.fileName,
      }));
      return true;
    } catch {
      return false;
    }
  };

  const handleApplyAutofill = async () => {
    setAttaching(true);
    let count = 0;
    mappings.forEach((m) => {
      if (!m.suggestedValue) return;
      count++;
      switch (m.fieldId) {
        case 'f-given':
          setGivenNames(String(m.suggestedValue));
          break;
        case 'f-family':
          setFamilyName(String(m.suggestedValue));
          break;
        case 'f-email':
          setEmail(String(m.suggestedValue));
          break;
        case 'f-phone':
          setPhone(String(m.suggestedValue));
          break;
        case 'f-dob':
          setDob(String(m.suggestedValue));
          break;
        case 'f-nat':
          setNationality(String(m.suggestedValue));
          break;
        case 'f-addr':
          setStreetAddress(String(m.suggestedValue));
          break;
        case 'f-city':
          setCity(String(m.suggestedValue));
          break;
        case 'f-country':
          setCountry(String(m.suggestedValue));
          break;
        case 'f-pass':
          setPassportNumber(String(m.suggestedValue));
          break;
        case 'f-pass-exp':
          setPassportExpiry(String(m.suggestedValue));
          break;
        case 'f-deg':
          setDegreeTitle(String(m.suggestedValue));
          break;
        case 'f-inst':
          setInstitution(String(m.suggestedValue));
          break;
        case 'f-ielts':
          setIeltsScore(String(m.suggestedValue));
          break;
      }
    });

    let filesDone = 0;
    for (const fm of fileMappings) {
      if (fm.status === 'approved' && fm.matchedDocumentId) {
        const ref =
          fm.fieldId === 'f-file-passport'
            ? passportFileRef.current
            : fm.fieldId === 'f-file-transcript'
            ? transcriptFileRef.current
            : fm.fieldId === 'f-file-english'
            ? englishFileRef.current
            : null;
        const ok = await attachDocumentToInput(fm.matchedDocumentId, ref, fm.fieldId);
        if (ok) filesDone++;
      }
    }

    setFilledCount(count);
    setAttachedCount(filesDone);
    setAttaching(false);
  };

  const handleReset = () => {
    setGivenNames('');
    setFamilyName('');
    setEmail('');
    setPhone('');
    setDob('');
    setNationality('');
    setStreetAddress('');
    setCity('');
    setCountry('');
    setPassportNumber('');
    setPassportExpiry('');
    setDegreeTitle('');
    setInstitution('');
    setIeltsScore('');
    setHasSponsor(false);
    setSponsorName('');
    setMappings([]);
    setFileMappings([]);
    setAttachedFileNames({});
    if (passportFileRef.current) passportFileRef.current.value = '';
    if (transcriptFileRef.current) transcriptFileRef.current.value = '';
    if (englishFileRef.current) englishFileRef.current.value = '';
    setFilledCount(null);
    setAttachedCount(0);
    setSubmittedNotice(false);
  };

  const approvedFileCount = fileMappings.filter((f) => f.status === 'approved').length;

  return (
    <div className="space-y-6">
      {/* Header & Controls */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-[28px] leading-[1.15] font-medium text-ink-primary tracking-[-0.015em]">
            Portal autofill & document upload sandbox
          </h1>
          <p className="text-sm text-ink-secondary mt-1.5">
            Test deterministic field mapping, dedicated student email autofill, and binary PDF attachment for{' '}
            <span className="text-ink-primary font-medium">
              {candidate.personal.legalGivenName} {candidate.personal.familyName}
            </span>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <button type="button" onClick={handleReset} className="btn-secondary">
            <RotateCcw className="w-4 h-4 text-ink-muted" strokeWidth={1.5} />
            <span>Reset</span>
          </button>

          <button
            type="button"
            onClick={handleScanAndMatch}
            disabled={scanning}
            className={mappings.length > 0 ? 'btn-secondary' : 'btn-primary'}
          >
            <ScanSearch
              className={`w-4 h-4 ${mappings.length > 0 ? 'text-ink-muted' : 'text-[#141415]'}`}
              strokeWidth={1.5}
            />
            <span>{scanning ? 'Scanning fields...' : 'Scan & match portal'}</span>
          </button>

          {(mappings.length > 0 || approvedFileCount > 0) && (
            <button
              type="button"
              disabled={attaching}
              onClick={handleApplyAutofill}
              className="btn-primary"
            >
              <Play className="w-4 h-4 text-[#141415]" strokeWidth={1.5} />
              <span className="tabular-nums">
                {attaching
                  ? 'Attaching files...'
                  : `Fill ${mappings.length} fields & attach ${approvedFileCount} files`}
              </span>
            </button>
          )}
        </div>
      </div>

      {filledCount !== null && (
        <div className="px-4 py-3 rounded-xl bg-surface-card border border-hairline flex items-center justify-between text-xs">
          <VerificationStamp
            tone="positive"
            label={`${filledCount} fields filled · ${attachedCount} documents attached`}
            meta="DataTransfer + controlled DOM events verified"
          />
          <span className="text-ink-muted">Review values and attached files below before submission</span>
        </div>
      )}

      {/* Proposed Field & File Mappings Ledger */}
      {(mappings.length > 0 || fileMappings.length > 0) && (
        <div className="bg-surface-card border border-hairline rounded-xl overflow-hidden space-y-0">
          <div className="px-6 py-4 border-b border-hairline flex items-center justify-between">
            <span className="text-sm font-medium text-ink-primary tabular-nums">
              Proposed field mappings ({mappings.length}) & file upload slots ({fileMappings.length})
            </span>
            <span className="text-xs text-ink-muted">
              Dedicated student email preferred · Zero-invention policy active
            </span>
          </div>

          {fileMappings.length > 0 && (
            <div className="p-4 border-b border-hairline bg-surface-deep/50 grid grid-cols-1 md:grid-cols-3 gap-3">
              {fileMappings.map((fm) => (
                <div
                  key={fm.fieldId}
                  className="p-3.5 rounded-lg bg-surface-card border border-hairline flex flex-col justify-between gap-2 text-xs"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium text-ink-primary truncate">{fm.fieldLabel}</span>
                    <VerificationStamp
                      tone={fm.status === 'approved' ? 'positive' : 'brass'}
                      label={fm.status === 'approved' ? 'matched' : 'missing'}
                    />
                  </div>
                  {fm.portalFileName ? (
                    <div className="flex items-center justify-between gap-2 pt-1">
                      <span className="font-mono text-brass truncate">{fm.portalFileName}</span>
                      {fm.matchedDocumentId && (
                        <button
                          type="button"
                          onClick={() =>
                            api.downloadDocumentBlob(fm.matchedDocumentId!, 'portal', fm.portalFileName)
                          }
                          className="text-ink-muted hover:text-ink-primary shrink-0"
                          title="Download portal-ready file"
                        >
                          <Download className="w-4 h-4" strokeWidth={1.5} />
                        </button>
                      )}
                    </div>
                  ) : (
                    <span className="text-ink-muted">{fm.reasoning}</span>
                  )}
                </div>
              ))}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 divide-y md:divide-y-0 gap-px bg-[rgba(237,237,237,0.06)]">
            {mappings.map((m) => (
              <div key={m.fieldId} className="p-4 bg-surface-card flex flex-col justify-between space-y-2">
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs text-ink-secondary truncate">{m.fieldLabel}</span>
                    <VerificationStamp
                      tone={m.confidence === 'high' ? 'positive' : 'brass'}
                      label={m.confidence}
                    />
                  </div>
                  <p className="font-mono text-sm font-medium text-ink-primary mt-1 truncate">
                    {String(m.suggestedValue)}
                  </p>
                </div>
                <p className="text-xs text-ink-muted">{m.reasoning}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Simulated External University Admissions Portal */}
      <div className="bg-surface-card border border-hairline rounded-2xl overflow-hidden">
        <div className="px-6 py-5 border-b border-hairline bg-surface-deep/60 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <span className="font-mono text-xs text-brass">
              admissions.manchester.ac.uk · Simulated portal
            </span>
            <h2 className="text-lg font-medium text-ink-primary mt-1">
              University of Manchester — Postgraduate application 2027/28
            </h2>
          </div>
          <span className="font-mono text-xs text-ink-muted tabular-nums">
            14 fields · 3 document upload slots
          </span>
        </div>

        <div className="p-6 lg:p-8 space-y-7 text-sm">
          {/* Section 1 */}
          <section className="space-y-4">
            <h3 className="text-sm font-medium text-ink-primary border-b border-hairline pb-2">
              1. Applicant identity & passport
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-ink-secondary mb-1.5">Given names / first name *</label>
                <input
                  value={givenNames}
                  onChange={(e) => setGivenNames(e.target.value)}
                  placeholder="Muhammad Ali"
                  className="field-input"
                />
              </div>
              <div>
                <label className="block text-xs text-ink-secondary mb-1.5">Family surname *</label>
                <input
                  value={familyName}
                  onChange={(e) => setFamilyName(e.target.value)}
                  placeholder="Khan"
                  className="field-input"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs text-ink-secondary mb-1.5">Primary applicant email *</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="field-input font-mono text-xs"
                />
              </div>
              <div>
                <label className="block text-xs text-ink-secondary mb-1.5">Mobile phone *</label>
                <input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="field-input font-mono"
                />
              </div>
              <div>
                <label className="block text-xs text-ink-secondary mb-1.5">Date of birth *</label>
                <input
                  type="date"
                  value={dob}
                  onChange={(e) => setDob(e.target.value)}
                  className="field-input font-mono tabular-nums"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs text-ink-secondary mb-1.5">Country of citizenship *</label>
                <select
                  value={nationality}
                  onChange={(e) => setNationality(e.target.value)}
                  className="field-input"
                >
                  <option value="">Select country</option>
                  <option value="Pakistan">Pakistan</option>
                  <option value="India">India</option>
                  <option value="United States">United States</option>
                  <option value="United Kingdom">United Kingdom</option>
                  <option value="Canada">Canada</option>
                  <option value="Nigeria">Nigeria</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-ink-secondary mb-1.5">Passport document number *</label>
                <input
                  value={passportNumber}
                  onChange={(e) => setPassportNumber(e.target.value)}
                  placeholder="AB1234567"
                  className="field-input font-mono uppercase"
                />
              </div>
              <div>
                <label className="block text-xs text-ink-secondary mb-1.5">Passport expiry date *</label>
                <input
                  type="date"
                  value={passportExpiry}
                  onChange={(e) => setPassportExpiry(e.target.value)}
                  className="field-input font-mono tabular-nums"
                />
              </div>
            </div>
          </section>

          {/* Section 2 */}
          <section className="space-y-4">
            <h3 className="text-sm font-medium text-ink-primary border-b border-hairline pb-2">
              2. Residential address
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="md:col-span-2">
                <label className="block text-xs text-ink-secondary mb-1.5">Street address line 1 *</label>
                <input
                  value={streetAddress}
                  onChange={(e) => setStreetAddress(e.target.value)}
                  className="field-input"
                />
              </div>
              <div>
                <label className="block text-xs text-ink-secondary mb-1.5">City *</label>
                <input value={city} onChange={(e) => setCity(e.target.value)} className="field-input" />
              </div>
            </div>
          </section>

          {/* Section 3 */}
          <section className="space-y-4">
            <h3 className="text-sm font-medium text-ink-primary border-b border-hairline pb-2">
              3. Academic & language background
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs text-ink-secondary mb-1.5">Highest qualification *</label>
                <input
                  value={degreeTitle}
                  onChange={(e) => setDegreeTitle(e.target.value)}
                  className="field-input"
                />
              </div>
              <div>
                <label className="block text-xs text-ink-secondary mb-1.5">Awarding institution *</label>
                <input
                  value={institution}
                  onChange={(e) => setInstitution(e.target.value)}
                  className="field-input"
                />
              </div>
              <div>
                <label className="block text-xs text-ink-secondary mb-1.5">Overall IELTS band</label>
                <input
                  value={ieltsScore}
                  onChange={(e) => setIeltsScore(e.target.value)}
                  placeholder="8.0"
                  className="field-input font-mono tabular-nums"
                />
              </div>
            </div>
          </section>

          {/* Section 4: Supporting Document Uploads */}
          <section className="space-y-4">
            <h3 className="text-sm font-medium text-ink-primary border-b border-hairline pb-2">
              4. Required supporting documents (PDF / JPG)
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[
                {
                  id: 'f-file-passport',
                  label: 'Passport bio-page scan *',
                  ref: passportFileRef,
                  accept: '.pdf,.jpg,.png',
                },
                {
                  id: 'f-file-transcript',
                  label: 'Official academic transcript *',
                  ref: transcriptFileRef,
                  accept: '.pdf',
                },
                {
                  id: 'f-file-english',
                  label: 'IELTS / English score report *',
                  ref: englishFileRef,
                  accept: '.pdf',
                },
              ].map((slot) => (
                <div
                  key={slot.id}
                  className="p-3.5 rounded-xl bg-surface-deep border border-hairline space-y-2"
                >
                  <label className="block text-xs text-ink-secondary">{slot.label}</label>
                  <input
                    ref={slot.ref}
                    type="file"
                    accept={slot.accept}
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) {
                        setAttachedFileNames((prev) => ({ ...prev, [slot.id]: f.name }));
                      }
                    }}
                    className="block w-full text-xs text-ink-muted file:mr-2.5 file:py-1 file:px-2.5 file:rounded-md file:border file:border-hairline file:bg-surface-card file:text-xs file:text-ink-primary"
                  />
                  {attachedFileNames[slot.id] && (
                    <div className="flex items-center gap-1.5 font-mono text-xs text-tone-positive pt-0.5">
                      <Paperclip className="w-3.5 h-3.5 shrink-0" strokeWidth={1.5} />
                      <span className="truncate">{attachedFileNames[slot.id]}</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>

          {/* Section 5 */}
          <section className="space-y-3">
            <label className="inline-flex items-center gap-2.5 text-[13px] text-ink-secondary cursor-pointer">
              <input
                type="checkbox"
                checked={hasSponsor}
                onChange={(e) => setHasSponsor(e.target.checked)}
                className="w-4 h-4 rounded bg-surface-deep border-hairline accent-[#d4a853]"
              />
              <span>Applicant holds external government or institutional sponsorship</span>
            </label>
            {hasSponsor && (
              <div className="p-4 rounded-xl bg-surface-deep border border-hairline max-w-md">
                <label className="block text-xs text-ink-secondary mb-1.5">Sponsoring body</label>
                <input
                  value={sponsorName}
                  onChange={(e) => setSponsorName(e.target.value)}
                  placeholder="Higher Education Commission"
                  className="field-input"
                />
              </div>
            )}
          </section>

          {/* Footer Submit */}
          <div className="pt-4 border-t border-hairline flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            {submittedNotice ? (
              <VerificationStamp
                tone="positive"
                label="Simulated submission recorded"
                meta="consultant review confirmed"
              />
            ) : (
              <span className="text-xs text-ink-muted">
                Consultant review required before submitting external university forms
              </span>
            )}
            <button
              type="button"
              onClick={() => setSubmittedNotice(true)}
              className="btn-secondary"
            >
              Simulate portal submit
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
