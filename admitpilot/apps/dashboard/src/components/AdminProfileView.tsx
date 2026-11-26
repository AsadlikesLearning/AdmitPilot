import React, { useState, useEffect } from 'react';
import { SlidersHorizontal } from 'lucide-react';
import {
  AISettings,
  CandidateProfile,
  CountryTeam,
  Organization,
  UserNotificationPrefs,
  UserProfile,
} from 'admitpilot-shared';
import { VerificationStamp } from './ui/Primitives';

interface AdminProfileViewProps {
  currentUser: UserProfile | null;
  organization: Organization | null;
  countryTeams: CountryTeam[];
  candidates: CandidateProfile[];
  aiSettings: AISettings;
  onSaveProfile: (updates: Partial<UserProfile>) => Promise<void>;
  onSaveOrganization: (updates: Partial<Organization>) => Promise<void>;
  onOpenModelProviders: () => void;
}

function initialsOf(name?: string): string {
  if (!name) return 'AD';
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase() || '')
      .join('') || 'AD'
  );
}

export const AdminProfileView: React.FC<AdminProfileViewProps> = ({
  currentUser,
  organization,
  countryTeams,
  candidates,
  aiSettings,
  onSaveProfile,
  onSaveOrganization,
  onOpenModelProviders,
}) => {
  // Personal Admin Profile State
  const [fullName, setFullName] = useState(currentUser?.fullName || 'Sarah Jenkins');
  const [jobTitle, setJobTitle] = useState(currentUser?.jobTitle || 'Senior Admissions Director');
  const [email, setEmail] = useState(currentUser?.email || 'consultant@admitpilot.ai');
  const [phone, setPhone] = useState(currentUser?.phone || '');
  const [officeLocation, setOfficeLocation] = useState(currentUser?.officeLocation || '');
  const [timezone, setTimezone] = useState(currentUser?.timezone || 'Europe/London (UTC+0)');
  const [languages, setLanguages] = useState((currentUser?.languages || ['English']).join(', '));
  const [specializations, setSpecializations] = useState(
    (currentUser?.specializations || []).join(', ')
  );
  const [maxActiveDossiers, setMaxActiveDossiers] = useState<number>(
    currentUser?.maxActiveDossiers ?? 25
  );
  const [signatureLine, setSignatureLine] = useState(currentUser?.signatureLine || '');
  const [bio, setBio] = useState(currentUser?.bio || '');
  const [countryTeamIds, setCountryTeamIds] = useState<string[]>(currentUser?.countryTeamIds || []);
  const [notifications, setNotifications] = useState<UserNotificationPrefs>(
    currentUser?.notifications || {
      documentUploads: true,
      portalDeadlines: true,
      conflictAlerts: true,
      offerUpdates: true,
    }
  );

  // Organization & Governance State
  const [orgName, setOrgName] = useState(organization?.name || 'Global EduConsultants & Associates');
  const [orgEmail, setOrgEmail] = useState(organization?.primaryEmail || '');
  const [orgPhone, setOrgPhone] = useState(organization?.phone || '');
  const [headquarters, setHeadquarters] = useState(organization?.headquarters || '');
  const [website, setWebsite] = useState(organization?.website || '');
  const [defaultIntake, setDefaultIntake] = useState(organization?.defaultIntake || 'September 2027');
  const [operatingCountries, setOperatingCountries] = useState(
    (organization?.operatingCountries || []).join(', ')
  );
  const [autoAssignByCountry, setAutoAssignByCountry] = useState<boolean>(
    organization?.autoAssignByCountry ?? true
  );
  const [requireDualReview, setRequireDualReview] = useState<boolean>(
    organization?.requireDualReview ?? true
  );

  const [savingProfile, setSavingProfile] = useState(false);
  const [savedProfile, setSavedProfile] = useState(false);
  const [savingOrg, setSavingOrg] = useState(false);
  const [savedOrg, setSavedOrg] = useState(false);

  useEffect(() => {
    if (currentUser) {
      setFullName(currentUser.fullName);
      setJobTitle(currentUser.jobTitle || '');
      setEmail(currentUser.email);
      setPhone(currentUser.phone || '');
      setOfficeLocation(currentUser.officeLocation || '');
      setTimezone(currentUser.timezone || 'UTC');
      setLanguages((currentUser.languages || ['English']).join(', '));
      setSpecializations((currentUser.specializations || []).join(', '));
      setMaxActiveDossiers(currentUser.maxActiveDossiers ?? 25);
      setSignatureLine(currentUser.signatureLine || '');
      setBio(currentUser.bio || '');
      setCountryTeamIds(currentUser.countryTeamIds || []);
      if (currentUser.notifications) setNotifications(currentUser.notifications);
    }
  }, [currentUser]);

  useEffect(() => {
    if (organization) {
      setOrgName(organization.name);
      setOrgEmail(organization.primaryEmail || '');
      setOrgPhone(organization.phone || '');
      setHeadquarters(organization.headquarters || '');
      setWebsite(organization.website || '');
      setDefaultIntake(organization.defaultIntake || 'September 2027');
      setOperatingCountries((organization.operatingCountries || []).join(', '));
      setAutoAssignByCountry(organization.autoAssignByCountry ?? true);
      setRequireDualReview(organization.requireDualReview ?? true);
    }
  }, [organization]);

  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingProfile(true);
    try {
      await onSaveProfile({
        fullName: fullName.trim(),
        jobTitle: jobTitle.trim(),
        email: email.trim(),
        phone: phone.trim(),
        officeLocation: officeLocation.trim(),
        timezone: timezone.trim(),
        languages: languages
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
        specializations: specializations
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
        maxActiveDossiers: Number(maxActiveDossiers) || 25,
        signatureLine: signatureLine.trim(),
        bio: bio.trim(),
        countryTeamIds,
        notifications,
      });
      setSavedProfile(true);
      setTimeout(() => setSavedProfile(false), 3000);
    } finally {
      setSavingProfile(false);
    }
  };

  const handleOrgSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingOrg(true);
    try {
      await onSaveOrganization({
        name: orgName.trim(),
        primaryEmail: orgEmail.trim(),
        phone: orgPhone.trim(),
        headquarters: headquarters.trim(),
        website: website.trim(),
        defaultIntake: defaultIntake.trim(),
        operatingCountries: operatingCountries
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
        autoAssignByCountry,
        requireDualReview,
      });
      setSavedOrg(true);
      setTimeout(() => setSavedOrg(false), 3000);
    } finally {
      setSavingOrg(false);
    }
  };

  const toggleNotif = async (key: keyof UserNotificationPrefs) => {
    const next = { ...notifications, [key]: !notifications[key] };
    setNotifications(next);
    await onSaveProfile({ notifications: next });
  };

  const myAssignedCount = candidates.filter(
    (c) => c.status !== 'archived' && c.assignedConsultantId === (currentUser?.id || 'usr-admin-1')
  ).length;

  const myDesks = countryTeams.filter((t) => countryTeamIds.includes(t.id));

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-[28px] leading-[1.15] font-medium text-ink-primary tracking-[-0.015em]">
            Admin profile & settings
          </h1>
          <p className="text-sm text-ink-secondary mt-1.5">
            Personal consultant credentials, country desk assignments, notification rules, and agency governance
          </p>
        </div>

        <VerificationStamp
          tone="brass"
          label={currentUser?.role === 'org_admin' ? 'Org admin' : currentUser?.role || 'Admin'}
          meta={organization?.id || 'org-global-edu'}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left 7 Columns: Personal Admin Profile + Agency Settings Forms */}
        <div className="lg:col-span-7 space-y-6">
          {/* 1. Personal Administrator Profile */}
          <form
            onSubmit={handleProfileSubmit}
            className="p-6 rounded-xl bg-surface-card border border-hairline space-y-5 text-sm"
          >
            <div className="border-b border-hairline pb-4 flex items-center justify-between">
              <div>
                <h2 className="text-base font-medium text-ink-primary">Administrator profile</h2>
                <p className="text-xs text-ink-secondary mt-0.5">
                  Shown across assigned student dossiers, audit logs, and team rosters
                </p>
              </div>
              {savedProfile && <VerificationStamp tone="positive" label="Profile saved" />}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-ink-secondary mb-1.5">Full name *</label>
                <input
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="field-input"
                />
              </div>
              <div>
                <label className="block text-xs text-ink-secondary mb-1.5">Title / designation</label>
                <input
                  value={jobTitle}
                  onChange={(e) => setJobTitle(e.target.value)}
                  className="field-input"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-ink-secondary mb-1.5">Email address *</label>
                <input
                  required
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="field-input"
                />
              </div>
              <div>
                <label className="block text-xs text-ink-secondary mb-1.5">Direct phone</label>
                <input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="field-input font-mono"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs text-ink-secondary mb-1.5">Office location</label>
                <input
                  value={officeLocation}
                  onChange={(e) => setOfficeLocation(e.target.value)}
                  className="field-input"
                />
              </div>
              <div>
                <label className="block text-xs text-ink-secondary mb-1.5">Timezone</label>
                <input
                  value={timezone}
                  onChange={(e) => setTimezone(e.target.value)}
                  className="field-input font-mono text-xs"
                />
              </div>
              <div>
                <label className="block text-xs text-ink-secondary mb-1.5">Dossier capacity</label>
                <input
                  type="number"
                  min={1}
                  max={200}
                  value={maxActiveDossiers}
                  onChange={(e) => setMaxActiveDossiers(Number(e.target.value))}
                  className="field-input font-mono tabular-nums"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-ink-secondary mb-1.5">
                  Spoken languages (comma-separated)
                </label>
                <input
                  value={languages}
                  onChange={(e) => setLanguages(e.target.value)}
                  className="field-input"
                />
              </div>
              <div>
                <label className="block text-xs text-ink-secondary mb-1.5">
                  Specializations (comma-separated)
                </label>
                <input
                  value={specializations}
                  onChange={(e) => setSpecializations(e.target.value)}
                  className="field-input"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs text-ink-secondary mb-2">
                Personal country desk memberships
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {countryTeams.map((desk) => {
                  const active = countryTeamIds.includes(desk.id);
                  return (
                    <label
                      key={desk.id}
                      className={`px-3 py-2 rounded-lg border text-xs flex items-center gap-2.5 cursor-pointer transition-colors duration-150 ease-quart ${
                        active
                          ? 'bg-surface-raised border-brass-border text-ink-primary'
                          : 'bg-surface-deep border-hairline text-ink-secondary'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={active}
                        onChange={() =>
                          setCountryTeamIds((prev) =>
                            active ? prev.filter((id) => id !== desk.id) : [...prev, desk.id]
                          )
                        }
                        className="w-4 h-4 rounded accent-[#d4a853]"
                      />
                      <span className="font-mono text-brass whitespace-nowrap shrink-0">{desk.code}</span>
                      <span className="truncate">{desk.name}</span>
                    </label>
                  );
                })}
              </div>
            </div>

            <div>
              <label className="block text-xs text-ink-secondary mb-1.5">
                Verification sign-off line
              </label>
              <input
                value={signatureLine}
                onChange={(e) => setSignatureLine(e.target.value)}
                placeholder="Sarah Jenkins · Senior Admissions Director"
                className="field-input"
              />
            </div>

            <div>
              <label className="block text-xs text-ink-secondary mb-1.5">Bio & remit</label>
              <textarea
                rows={2}
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                className="field-input h-auto py-2"
              />
            </div>

            <div className="pt-3 border-t border-hairline flex justify-end">
              <button type="submit" disabled={savingProfile} className="btn-primary">
                {savingProfile ? 'Saving...' : 'Save admin profile'}
              </button>
            </div>
          </form>

          {/* 2. Agency & Governance Settings */}
          <form
            onSubmit={handleOrgSubmit}
            className="p-6 rounded-xl bg-surface-card border border-hairline space-y-5 text-sm"
          >
            <div className="border-b border-hairline pb-4 flex items-center justify-between">
              <div>
                <h2 className="text-base font-medium text-ink-primary">
                  Agency & routing governance
                </h2>
                <p className="text-xs text-ink-secondary mt-0.5">
                  Organization-wide defaults for country routing and submission sign-off
                </p>
              </div>
              {savedOrg && <VerificationStamp tone="positive" label="Settings saved" />}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-ink-secondary mb-1.5">Agency legal name *</label>
                <input
                  required
                  value={orgName}
                  onChange={(e) => setOrgName(e.target.value)}
                  className="field-input"
                />
              </div>
              <div>
                <label className="block text-xs text-ink-secondary mb-1.5">Default intake cycle</label>
                <input
                  value={defaultIntake}
                  onChange={(e) => setDefaultIntake(e.target.value)}
                  placeholder="September 2027"
                  className="field-input"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs text-ink-secondary mb-1.5">Headquarters</label>
                <input
                  value={headquarters}
                  onChange={(e) => setHeadquarters(e.target.value)}
                  className="field-input"
                />
              </div>
              <div>
                <label className="block text-xs text-ink-secondary mb-1.5">Operations email</label>
                <input
                  type="email"
                  value={orgEmail}
                  onChange={(e) => setOrgEmail(e.target.value)}
                  className="field-input"
                />
              </div>
              <div>
                <label className="block text-xs text-ink-secondary mb-1.5">Agency phone</label>
                <input
                  value={orgPhone}
                  onChange={(e) => setOrgPhone(e.target.value)}
                  className="field-input font-mono"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-ink-secondary mb-1.5">Website</label>
                <input
                  value={website}
                  onChange={(e) => setWebsite(e.target.value)}
                  className="field-input font-mono text-xs"
                />
              </div>
              <div>
                <label className="block text-xs text-ink-secondary mb-1.5">
                  Operating destination countries (comma-separated)
                </label>
                <input
                  value={operatingCountries}
                  onChange={(e) => setOperatingCountries(e.target.value)}
                  className="field-input"
                />
              </div>
            </div>

            {/* Governance Switches */}
            <div className="space-y-3 pt-1">
              <div className="p-4 rounded-lg bg-surface-deep border border-hairline flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-medium text-ink-primary">
                    Auto-route new dossiers by destination country
                  </p>
                  <p className="text-xs text-ink-secondary mt-0.5">
                    Assigns incoming candidates to the matching country desk and least-loaded active consultant
                  </p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={autoAssignByCountry}
                  onClick={() => setAutoAssignByCountry(!autoAssignByCountry)}
                  className={`relative inline-flex h-6 w-11 shrink-0 rounded-full border transition-colors duration-150 ease-quart ${
                    autoAssignByCountry
                      ? 'bg-brass border-brass'
                      : 'bg-surface-raised border-hairline-strong'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 rounded-full mt-0.5 transition-transform duration-150 ease-quart ${
                      autoAssignByCountry
                        ? 'translate-x-5 bg-[#141415]'
                        : 'translate-x-1 bg-ink-secondary'
                    }`}
                  />
                </button>
              </div>

              <div className="p-4 rounded-lg bg-surface-deep border border-hairline flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-medium text-ink-primary">
                    Require reviewer verification before submission
                  </p>
                  <p className="text-xs text-ink-secondary mt-0.5">
                    Flags unverified passport or transcript fields prior to external portal autofill
                  </p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={requireDualReview}
                  onClick={() => setRequireDualReview(!requireDualReview)}
                  className={`relative inline-flex h-6 w-11 shrink-0 rounded-full border transition-colors duration-150 ease-quart ${
                    requireDualReview
                      ? 'bg-brass border-brass'
                      : 'bg-surface-raised border-hairline-strong'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 rounded-full mt-0.5 transition-transform duration-150 ease-quart ${
                      requireDualReview
                        ? 'translate-x-5 bg-[#141415]'
                        : 'translate-x-1 bg-ink-secondary'
                    }`}
                  />
                </button>
              </div>
            </div>

            <div className="pt-3 border-t border-hairline flex justify-end">
              <button type="submit" disabled={savingOrg} className="btn-primary">
                {savingOrg ? 'Saving...' : 'Save agency settings'}
              </button>
            </div>
          </form>
        </div>

        {/* Right 5 Columns: Tactile Admin Credential Card + Notification Switches + System Status */}
        <div className="lg:col-span-5 space-y-5">
          {/* Tactile Consular Officer Credential Card */}
          <div className="rounded-xl bg-[#1b1a17] border border-brass-border overflow-hidden shadow-[inset_0_1px_0_rgba(212,168,83,0.14)]">
            <div className="px-5 py-3.5 border-b border-[rgba(212,168,83,0.14)] flex items-center justify-between">
              <span className="font-mono text-xs text-brass">Authorized officer credential</span>
              <VerificationStamp tone="positive" label="verified" />
            </div>

            <div className="p-5 space-y-4">
              <div className="flex items-center gap-3.5">
                <div className="w-12 h-12 rounded-lg bg-surface-deep border border-brass-border font-mono text-base font-medium text-brass flex items-center justify-center shrink-0">
                  {initialsOf(fullName)}
                </div>
                <div className="min-w-0">
                  <p className="text-base font-medium text-ink-primary truncate">{fullName}</p>
                  <p className="text-xs text-ink-secondary truncate mt-0.5">{jobTitle}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-3 border-t border-[rgba(237,237,237,0.06)] text-xs">
                <div>
                  <span className="block text-ink-muted">Organization</span>
                  <span className="block text-ink-primary mt-0.5 truncate">{orgName}</span>
                </div>
                <div>
                  <span className="block text-ink-muted">Active workload</span>
                  <span className="block font-mono tabular-nums text-brass mt-0.5">
                    {myAssignedCount} / {maxActiveDossiers} dossiers
                  </span>
                </div>
                <div>
                  <span className="block text-ink-muted">Country desks</span>
                  <span className="block font-mono text-ink-primary mt-0.5">
                    {myDesks.length > 0 ? myDesks.map((d) => d.code).join(', ') : 'All desks'}
                  </span>
                </div>
                <div>
                  <span className="block text-ink-muted">Office</span>
                  <span className="block text-ink-primary mt-0.5 truncate">
                    {officeLocation || 'Global'}
                  </span>
                </div>
              </div>

              {signatureLine && (
                <div className="pt-3 border-t border-[rgba(237,237,237,0.06)]">
                  <span className="block text-xs text-ink-muted">Verification stamp signature</span>
                  <p className="font-mono text-xs text-ink-secondary mt-1">{signatureLine}</p>
                </div>
              )}
            </div>
          </div>

          {/* Notification Rules */}
          <div className="p-5 rounded-xl bg-surface-card border border-hairline space-y-4">
            <div>
              <h3 className="text-sm font-medium text-ink-primary">Workspace notifications</h3>
              <p className="text-xs text-ink-secondary mt-0.5">
                Choose which dossier and portal events raise alerts for your account
              </p>
            </div>

            <div className="divide-y divide-[rgba(237,237,237,0.06)] text-xs">
              {(
                [
                  {
                    key: 'documentUploads',
                    label: 'Document uploads & OCR extraction',
                    desc: 'When passports, transcripts, or language scores finish parsing',
                  },
                  {
                    key: 'conflictAlerts',
                    label: 'Field discrepancy warnings',
                    desc: 'When an uploaded document differs from an existing dossier value',
                  },
                  {
                    key: 'portalDeadlines',
                    label: 'Upcoming intake deadlines',
                    desc: '14-day and 48-hour reminders on active university applications',
                  },
                  {
                    key: 'offerUpdates',
                    label: 'Offer & enrollment updates',
                    desc: 'Conditional and unconditional university decisions',
                  },
                ] as const
              ).map((item) => {
                const enabled = notifications[item.key];
                return (
                  <div
                    key={item.key}
                    className="py-3 first:pt-0 last:pb-0 flex items-center justify-between gap-3"
                  >
                    <div>
                      <p className="text-[13px] text-ink-primary">{item.label}</p>
                      <p className="text-ink-muted mt-0.5">{item.desc}</p>
                    </div>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={enabled}
                      onClick={() => toggleNotif(item.key)}
                      className={`relative inline-flex h-5 w-9 shrink-0 rounded-full border transition-colors duration-150 ease-quart ${
                        enabled
                          ? 'bg-brass border-brass'
                          : 'bg-surface-raised border-hairline-strong'
                      }`}
                    >
                      <span
                        className={`inline-block h-3.5 w-3.5 rounded-full mt-0.5 transition-transform duration-150 ease-quart ${
                          enabled
                            ? 'translate-x-4 bg-[#141415]'
                            : 'translate-x-0.5 bg-ink-secondary'
                        }`}
                      />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Model Provider Quick Card */}
          <div className="p-5 rounded-xl bg-surface-card border border-hairline space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-ink-primary">Inference engine</span>
              <VerificationStamp
                tone={aiSettings.hasConfiguredKey || aiSettings.provider === 'ollama' ? 'positive' : 'brass'}
                label={`${aiSettings.provider} · ${aiSettings.model}`}
              />
            </div>
            <p className="text-xs text-ink-secondary">
              {aiSettings.privacyMode
                ? 'Strict local privacy mode is enabled — external cloud LLM calls are blocked'
                : 'Hybrid deterministic + model-assisted matching is active'}
            </p>
            <button
              type="button"
              onClick={onOpenModelProviders}
              className="btn-secondary w-full text-xs h-8"
            >
              <SlidersHorizontal className="w-4 h-4 text-ink-muted" strokeWidth={1.5} />
              <span>Configure Gemini / DeepSeek providers</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
