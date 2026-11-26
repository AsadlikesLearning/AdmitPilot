import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { CandidateProfile, CountryTeam, UserProfile } from 'admitpilot-shared';

interface CandidateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (candidate: Partial<CandidateProfile> & { managedStudentEmailPassword?: string }) => void;
  initialData?: CandidateProfile | null;
  members?: UserProfile[];
  countryTeams?: CountryTeam[];
  operatingCountries?: string[];
}

const DEFAULT_DESTINATIONS = [
  'United Kingdom',
  'Ireland',
  'United States',
  'Canada',
  'Australia',
  'New Zealand',
  'Germany',
  'Netherlands',
];

export const CandidateFormModal: React.FC<CandidateModalProps> = ({
  isOpen,
  onClose,
  onSave,
  initialData,
  members = [],
  countryTeams = [],
  operatingCountries,
}) => {
  const [legalGivenName, setLegalGivenName] = useState('');
  const [middleName, setMiddleName] = useState('');
  const [familyName, setFamilyName] = useState('');
  const [email, setEmail] = useState('');
  const [managedStudentEmail, setManagedStudentEmail] = useState('');
  const [managedStudentEmailPassword, setManagedStudentEmailPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [nationality, setNationality] = useState('Pakistani');
  const [dateOfBirth, setDateOfBirth] = useState('2000-01-01');
  const [gender, setGender] = useState('Male');
  const [maritalStatus, setMaritalStatus] = useState('Single');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [country, setCountry] = useState('Pakistan');

  const [passportNumber, setPassportNumber] = useState('');
  const [passportExpiry, setPassportExpiry] = useState('2032-01-01');
  const [degreeTitle, setDegreeTitle] = useState('');
  const [institution, setInstitution] = useState('');
  const [gpa, setGpa] = useState('');
  const [gradingScale, setGradingScale] = useState('4.0');
  const [englishTestType, setEnglishTestType] = useState<'IELTS' | 'TOEFL' | 'PTE' | 'Duolingo' | ''>('IELTS');
  const [englishOverall, setEnglishOverall] = useState('');

  // Routing & Team Assignment
  const [targetCountries, setTargetCountries] = useState<string[]>([]);
  const [countryTeamId, setCountryTeamId] = useState<string>('');
  const [assignedConsultantId, setAssignedConsultantId] = useState<string>('');
  const [preferredIntake, setPreferredIntake] = useState('September 2027');

  useEffect(() => {
    if (!isOpen) return;
    setLegalGivenName(initialData?.personal.legalGivenName || '');
    setMiddleName(initialData?.personal.middleName || '');
    setFamilyName(initialData?.personal.familyName || '');
    setEmail(initialData?.contact.email || '');
    setManagedStudentEmail(initialData?.contact.managedStudentEmail || '');
    setManagedStudentEmailPassword('');
    setPhone(initialData?.contact.phone || '');
    setNationality(initialData?.personal.nationality || 'Pakistani');
    setDateOfBirth(initialData?.personal.dateOfBirth || '2000-01-01');
    setGender(initialData?.personal.gender || 'Male');
    setMaritalStatus(initialData?.personal.maritalStatus || 'Single');
    setAddress(initialData?.contact.currentAddress || '');
    setCity(initialData?.contact.city || '');
    setState(initialData?.contact.state || '');
    setPostalCode(initialData?.contact.postalCode || '');
    setCountry(initialData?.contact.country || 'Pakistan');

    setPassportNumber(initialData?.passport?.passportNumber || '');
    setPassportExpiry(initialData?.passport?.expiryDate || '2032-01-01');
    setDegreeTitle(initialData?.education?.[0]?.degreeTitle || '');
    setInstitution(initialData?.education?.[0]?.institution || '');
    setGpa(initialData?.education?.[0]?.gpa || '');
    setGradingScale(initialData?.education?.[0]?.gradingScale || '4.0');
    setEnglishTestType((initialData?.englishTests?.[0]?.testType as any) || 'IELTS');
    setEnglishOverall(initialData?.englishTests?.[0]?.overallScore || '');

    setTargetCountries(
      initialData?.targetCountries || initialData?.additional?.preferredCountries || []
    );
    setCountryTeamId(initialData?.countryTeamId || '');
    setAssignedConsultantId(initialData?.assignedConsultantId || '');
    setPreferredIntake(initialData?.additional?.preferredIntakes?.[0] || 'September 2027');
  }, [isOpen, initialData]);

  if (!isOpen) return null;

  const destinationChoices =
    operatingCountries && operatingCountries.length > 0
      ? operatingCountries
      : DEFAULT_DESTINATIONS;

  const toggleTargetCountry = (dest: string) => {
    const next = targetCountries.includes(dest)
      ? targetCountries.filter((c) => c !== dest)
      : [...targetCountries, dest];
    setTargetCountries(next);

    if (!countryTeamId && next.length > 0) {
      const matched = countryTeams.find((t) =>
        t.countries.some((c) => next.includes(c))
      );
      if (matched) {
        setCountryTeamId(matched.id);
        if (!assignedConsultantId && matched.leadUserId) {
          setAssignedConsultantId(matched.leadUserId);
        }
      }
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const payload: Partial<CandidateProfile> & { managedStudentEmailPassword?: string } = {
      ...(initialData?.id ? { id: initialData.id } : {}),
      status: initialData?.status || 'active',
      targetCountries,
      countryTeamId: countryTeamId || undefined,
      assignedConsultantId: assignedConsultantId || undefined,
      managedStudentEmailPassword: managedStudentEmailPassword.trim() || undefined,
      personal: {
        legalGivenName: legalGivenName.trim(),
        middleName: middleName.trim(),
        familyName: familyName.trim(),
        preferredName: `${legalGivenName} ${familyName}`.trim(),
        dateOfBirth,
        gender,
        maritalStatus,
        nationality: nationality.trim(),
        countryOfBirth: initialData?.personal.countryOfBirth || country,
        cityOfBirth: initialData?.personal.cityOfBirth || city,
      },
      contact: {
        email: email.trim(),
        managedStudentEmail: managedStudentEmail.trim() || undefined,
        phone: phone.trim(),
        currentAddress: address.trim() || 'Current Address',
        city: city.trim() || 'City',
        state: state.trim() || 'Province',
        postalCode: postalCode.trim() || '00000',
        country: country.trim(),
      },
      passport: passportNumber.trim()
        ? {
            passportNumber: passportNumber.trim().toUpperCase(),
            fullName: [legalGivenName, middleName, familyName]
              .filter(Boolean)
              .join(' ')
              .toUpperCase(),
            nationality: nationality.trim(),
            dateOfBirth,
            issuingCountry: initialData?.passport?.issuingCountry || country,
            expiryDate: passportExpiry || '2032-01-01',
          }
        : initialData?.passport,
      education: degreeTitle.trim()
        ? [
            {
              id: initialData?.education?.[0]?.id || '',
              qualificationLevel: initialData?.education?.[0]?.qualificationLevel || "Bachelor's",
              degreeTitle: degreeTitle.trim(),
              major:
                initialData?.education?.[0]?.major ||
                (degreeTitle.toLowerCase().includes('computer') ? 'Computer Science' : 'General'),
              institution: institution.trim() || 'University',
              country,
              gpa: gpa.trim() || undefined,
              gradingScale: gradingScale.trim() || undefined,
              status: 'Completed',
            },
            ...(initialData?.education?.slice(1) || []),
          ]
        : initialData?.education || [],
      englishTests:
        englishTestType && englishOverall.trim()
          ? [
              {
                id: initialData?.englishTests?.[0]?.id || '',
                testType: englishTestType,
                testDate:
                  initialData?.englishTests?.[0]?.testDate ||
                  new Date().toISOString().slice(0, 10),
                overallScore: englishOverall.trim(),
                listening: initialData?.englishTests?.[0]?.listening,
                reading: initialData?.englishTests?.[0]?.reading,
                writing: initialData?.englishTests?.[0]?.writing,
                speaking: initialData?.englishTests?.[0]?.speaking,
                referenceNumber: initialData?.englishTests?.[0]?.referenceNumber,
              },
              ...(initialData?.englishTests?.slice(1) || []),
            ]
          : initialData?.englishTests || [],
      employment: initialData?.employment || [],
      additional: {
        ...(initialData?.additional || {}),
        preferredCountries: targetCountries,
        preferredIntakes: preferredIntake ? [preferredIntake] : [],
      },
      evidence: initialData?.evidence || {},
      conflicts: initialData?.conflicts || {},
    };

    onSave(payload);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4">
      <div className="bg-surface-card border border-hairline-strong rounded-2xl w-full max-w-2xl overflow-hidden">
        <div className="h-14 px-6 border-b border-hairline flex items-center justify-between">
          <h3 className="text-base font-medium text-ink-primary">
            {initialData ? 'Edit candidate profile' : 'New candidate profile'}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="h-8 w-8 rounded-lg text-ink-muted hover:text-ink-primary hover:bg-surface-raised inline-flex items-center justify-center transition-colors duration-150 ease-quart"
          >
            <X className="w-4 h-4" strokeWidth={1.5} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6 max-h-[82vh] overflow-y-auto text-sm">
          {/* Section 1: Personal & Contact */}
          <div className="space-y-4">
            <h4 className="text-xs font-medium text-ink-muted border-b border-hairline pb-1.5">
              1. Legal identity, personal contact & dedicated admissions email
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs text-ink-secondary mb-1.5">Legal given name *</label>
                <input
                  required
                  value={legalGivenName}
                  onChange={(e) => setLegalGivenName(e.target.value)}
                  className="field-input"
                />
              </div>
              <div>
                <label className="block text-xs text-ink-secondary mb-1.5">Middle name</label>
                <input
                  value={middleName}
                  onChange={(e) => setMiddleName(e.target.value)}
                  className="field-input"
                />
              </div>
              <div>
                <label className="block text-xs text-ink-secondary mb-1.5">Family surname *</label>
                <input
                  required
                  value={familyName}
                  onChange={(e) => setFamilyName(e.target.value)}
                  className="field-input"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs text-ink-secondary mb-1.5">Date of birth *</label>
                <input
                  required
                  type="date"
                  value={dateOfBirth}
                  onChange={(e) => setDateOfBirth(e.target.value)}
                  className="field-input font-mono tabular-nums"
                />
              </div>
              <div>
                <label className="block text-xs text-ink-secondary mb-1.5">Gender</label>
                <select value={gender} onChange={(e) => setGender(e.target.value)} className="field-input">
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-ink-secondary mb-1.5">Marital status</label>
                <select
                  value={maritalStatus}
                  onChange={(e) => setMaritalStatus(e.target.value)}
                  className="field-input"
                >
                  <option value="Single">Single</option>
                  <option value="Married">Married</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-ink-secondary mb-1.5">Nationality *</label>
                <input
                  required
                  value={nationality}
                  onChange={(e) => setNationality(e.target.value)}
                  className="field-input"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-ink-secondary mb-1.5">Personal student email *</label>
                <input
                  required
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="field-input"
                />
              </div>
              <div>
                <label className="block text-xs text-ink-secondary mb-1.5">Mobile phone *</label>
                <input
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="field-input font-mono"
                />
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-surface-deep border border-hairline grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-brass mb-1.5">
                  Consultant-created student email (for portals)
                </label>
                <input
                  type="email"
                  value={managedStudentEmail}
                  onChange={(e) => setManagedStudentEmail(e.target.value)}
                  placeholder="student.admissions2027@gmail.com"
                  className="field-input font-mono text-xs"
                />
              </div>
              {!initialData && (
                <div>
                  <label className="block text-xs text-ink-secondary mb-1.5">
                    Dedicated email password (encrypted at rest)
                  </label>
                  <input
                    type="password"
                    value={managedStudentEmailPassword}
                    onChange={(e) => setManagedStudentEmailPassword(e.target.value)}
                    placeholder="Optional initial inbox password"
                    className="field-input font-mono text-xs"
                  />
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
              <div className="sm:col-span-2">
                <label className="block text-xs text-ink-secondary mb-1.5">Street address</label>
                <input value={address} onChange={(e) => setAddress(e.target.value)} className="field-input" />
              </div>
              <div>
                <label className="block text-xs text-ink-secondary mb-1.5">City</label>
                <input value={city} onChange={(e) => setCity(e.target.value)} className="field-input" />
              </div>
              <div>
                <label className="block text-xs text-ink-secondary mb-1.5">Country of residence</label>
                <input value={country} onChange={(e) => setCountry(e.target.value)} className="field-input" />
              </div>
            </div>
          </div>

          {/* Section 2: Destination Country Desk & Consultant Routing */}
          <div className="space-y-4">
            <h4 className="text-xs font-medium text-ink-muted border-b border-hairline pb-1.5">
              2. Destination countries & team assignment
            </h4>

            <div>
              <label className="block text-xs text-ink-secondary mb-2">
                Target study destinations
              </label>
              <div className="flex flex-wrap gap-1.5">
                {destinationChoices.map((dest) => {
                  const selected = targetCountries.includes(dest);
                  return (
                    <button
                      key={dest}
                      type="button"
                      onClick={() => toggleTargetCountry(dest)}
                      className={`px-2.5 py-1 rounded-md border text-xs transition-colors duration-150 ease-quart ${
                        selected
                          ? 'bg-surface-raised border-brass text-ink-primary font-medium'
                          : 'bg-surface-deep border-hairline text-ink-secondary hover:border-hairline-strong'
                      }`}
                    >
                      {dest}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs text-ink-secondary mb-1.5">Country desk</label>
                <select
                  value={countryTeamId}
                  onChange={(e) => setCountryTeamId(e.target.value)}
                  className="field-input"
                >
                  <option value="">Auto-route by destination</option>
                  {countryTeams.map((desk) => (
                    <option key={desk.id} value={desk.id}>
                      {desk.code} · {desk.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-ink-secondary mb-1.5">Assigned consultant</label>
                <select
                  value={assignedConsultantId}
                  onChange={(e) => setAssignedConsultantId(e.target.value)}
                  className="field-input"
                >
                  <option value="">Auto-assign from desk</option>
                  {members.map((m) => {
                    const inSelectedDesk =
                      !countryTeamId || (m.countryTeamIds || []).includes(countryTeamId);
                    return (
                      <option key={m.id} value={m.id}>
                        {m.fullName}
                        {inSelectedDesk && countryTeamId ? ' (On desk)' : ''}
                      </option>
                    );
                  })}
                </select>
              </div>
              <div>
                <label className="block text-xs text-ink-secondary mb-1.5">Target intake</label>
                <input
                  value={preferredIntake}
                  onChange={(e) => setPreferredIntake(e.target.value)}
                  placeholder="September 2027"
                  className="field-input"
                />
              </div>
            </div>
          </div>

          {/* Section 3: Passport, Academic & Language Summary */}
          <div className="space-y-4">
            <h4 className="text-xs font-medium text-ink-muted border-b border-hairline pb-1.5">
              3. Travel, academic & language summary
            </h4>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="col-span-1 sm:col-span-2">
                <label className="block text-xs text-ink-secondary mb-1.5">Passport number</label>
                <input
                  value={passportNumber}
                  onChange={(e) => setPassportNumber(e.target.value)}
                  placeholder="AB1234567"
                  className="field-input font-mono uppercase"
                />
              </div>
              <div className="col-span-1 sm:col-span-2">
                <label className="block text-xs text-ink-secondary mb-1.5">Passport expiry date</label>
                <input
                  type="date"
                  value={passportExpiry}
                  onChange={(e) => setPassportExpiry(e.target.value)}
                  className="field-input font-mono tabular-nums"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-ink-secondary mb-1.5">Highest degree title</label>
                <input
                  value={degreeTitle}
                  onChange={(e) => setDegreeTitle(e.target.value)}
                  placeholder="Bachelor of Science in Computer Science"
                  className="field-input"
                />
              </div>
              <div>
                <label className="block text-xs text-ink-secondary mb-1.5">Awarding institution</label>
                <input
                  value={institution}
                  onChange={(e) => setInstitution(e.target.value)}
                  placeholder="National University of Sciences & Technology"
                  className="field-input"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs text-ink-secondary mb-1.5">GPA</label>
                <input
                  value={gpa}
                  onChange={(e) => setGpa(e.target.value)}
                  placeholder="3.82"
                  className="field-input font-mono tabular-nums"
                />
              </div>
              <div>
                <label className="block text-xs text-ink-secondary mb-1.5">Scale</label>
                <input
                  value={gradingScale}
                  onChange={(e) => setGradingScale(e.target.value)}
                  placeholder="4.0"
                  className="field-input font-mono tabular-nums"
                />
              </div>
              <div>
                <label className="block text-xs text-ink-secondary mb-1.5">English exam</label>
                <select
                  value={englishTestType}
                  onChange={(e) => setEnglishTestType(e.target.value as any)}
                  className="field-input"
                >
                  <option value="IELTS">IELTS</option>
                  <option value="TOEFL">TOEFL</option>
                  <option value="PTE">PTE</option>
                  <option value="Duolingo">Duolingo</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-ink-secondary mb-1.5">Overall score</label>
                <input
                  value={englishOverall}
                  onChange={(e) => setEnglishOverall(e.target.value)}
                  placeholder="8.0"
                  className="field-input font-mono tabular-nums"
                />
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-hairline flex justify-end gap-2.5">
            <button type="button" onClick={onClose} className="btn-secondary">
              Cancel
            </button>
            <button type="submit" className="btn-primary">
              Save candidate profile
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
