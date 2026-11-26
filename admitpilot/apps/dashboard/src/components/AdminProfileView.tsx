import React, { useState, useEffect } from 'react';
import { SlidersHorizontal, Plus, X, CheckCircle2, Globe } from 'lucide-react';
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
  mode?: 'agency' | 'profile' | 'both';
  currentUser: UserProfile | null;
  organization: Organization | null;
  countryTeams: CountryTeam[];
  candidates: CandidateProfile[];
  aiSettings: AISettings;
  onSaveProfile: (updates: Partial<UserProfile>) => Promise<void>;
  onSaveOrganization: (updates: Partial<Organization>) => Promise<void>;
  onOpenModelProviders: () => void;
  onOpenTeamDesks?: () => void;
}

const POPULAR_DESTINATIONS = [
  'United Kingdom',
  'Ireland',
  'United States',
  'Canada',
  'Australia',
  'New Zealand',
  'Germany',
  'Netherlands',
  'Sweden',
  'France',
  'Italy',
  'Spain',
  'Malaysia',
  'UAE',
  'Singapore',
  'Turkey',
  'Cyprus',
];

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
  mode = 'both',
  currentUser,
  organization,
  countryTeams,
  candidates,
  aiSettings,
  onSaveProfile,
  onSaveOrganization,
  onOpenModelProviders,
  onOpenTeamDesks,
}) => {
  // Agency & Country Catalog State
  const [orgName, setOrgName] = useState(organization?.name || 'Global EduConsultants & Associates');
  const [orgEmail, setOrgEmail] = useState(organization?.primaryEmail || '');
  const [orgPhone, setOrgPhone] = useState(organization?.phone || '');
  const [headquarters, setHeadquarters] = useState(organization?.headquarters || '');
  const [website, setWebsite] = useState(organization?.website || '');
  const [defaultIntake, setDefaultIntake] = useState(organization?.defaultIntake || 'September 2027');
  const [operatingCountries, setOperatingCountries] = useState<string[]>(
    organization?.operatingCountries || [
      'United Kingdom',
      'Ireland',
      'United States',
      'Canada',
      'Australia',
      'Germany',
    ]
  );
  const [customCountryInput, setCustomCountryInput] = useState('');
  const [autoAssignByCountry, setAutoAssignByCountry] = useState<boolean>(
    organization?.autoAssignByCountry ?? true
  );
  const [requireDualReview, setRequireDualReview] = useState<boolean>(
    organization?.requireDualReview ?? true
  );

  // Personal Owner / Admin Profile State
  const [fullName, setFullName] = useState(currentUser?.fullName || 'Sarah Jenkins');
  const [jobTitle, setJobTitle] = useState(currentUser?.jobTitle || 'Founder & Principal Consultant');
  const [email, setEmail] = useState(currentUser?.email || 'consultant@admitpilot.ai');
  const [phone, setPhone] = useState(currentUser?.phone || '');
  const [officeLocation, setOfficeLocation] = useState(currentUser?.officeLocation || '');
  const [timezone, setTimezone] = useState(currentUser?.timezone || 'Europe/London (UTC+0)');
  const [languages, setLanguages] = useState((currentUser?.languages || ['English']).join(', '));
  const [maxActiveDossiers, setMaxActiveDossiers] = useState<number>(
    currentUser?.maxActiveDossiers ?? 25
  );
  const [signatureLine, setSignatureLine] = useState(currentUser?.signatureLine || '');
  const [countryTeamIds, setCountryTeamIds] = useState<string[]>(currentUser?.countryTeamIds || []);
  const [notifications, setNotifications] = useState<UserNotificationPrefs>(
    currentUser?.notifications || {
      documentUploads: true,
      portalDeadlines: true,
      conflictAlerts: true,
      offerUpdates: true,
    }
  );

  const [savingOrg, setSavingOrg] = useState(false);
  const [savedOrg, setSavedOrg] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savedProfile, setSavedProfile] = useState(false);

  useEffect(() => {
    if (currentUser) {
      setFullName(currentUser.fullName);
      setJobTitle(currentUser.jobTitle || '');
      setEmail(currentUser.email);
      setPhone(currentUser.phone || '');
      setOfficeLocation(currentUser.officeLocation || '');
      setTimezone(currentUser.timezone || 'UTC');
      setLanguages((currentUser.languages || ['English']).join(', '));
      setMaxActiveDossiers(currentUser.maxActiveDossiers ?? 25);
      setSignatureLine(currentUser.signatureLine || '');
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
      setOperatingCountries(organization.operatingCountries || []);
      setAutoAssignByCountry(organization.autoAssignByCountry ?? true);
      setRequireDualReview(organization.requireDualReview ?? true);
    }
  }, [organization]);

  const toggleOperatingCountry = (country: string) => {
    setOperatingCountries((prev) =>
      prev.some((c) => c.toLowerCase() === country.toLowerCase())
        ? prev.filter((c) => c.toLowerCase() !== country.toLowerCase())
        : [...prev, country]
    );
  };

  const handleAddCustomCountry = () => {
    const clean = customCountryInput.trim();
    if (!clean) return;
    if (!operatingCountries.some((c) => c.toLowerCase() === clean.toLowerCase())) {
      setOperatingCountries((prev) => [...prev, clean]);
    }
    setCustomCountryInput('');
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
        operatingCountries,
        autoAssignByCountry,
        requireDualReview,
      });
      setSavedOrg(true);
      setTimeout(() => setSavedOrg(false), 3000);
    } finally {
      setSavingOrg(false);
    }
  };

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
        maxActiveDossiers: Number(maxActiveDossiers) || 25,
        signatureLine: signatureLine.trim(),
        countryTeamIds,
        notifications,
      });
      setSavedProfile(true);
      setTimeout(() => setSavedProfile(false), 3000);
    } finally {
      setSavingProfile(false);
    }
  };

  const toggleNotif = async (key: keyof UserNotificationPrefs) => {
    const next = { ...notifications, [key]: !notifications[key] };
    setNotifications(next);
    await onSaveProfile({ notifications: next });
  };

  const myAssignedCount = candidates.filter(
    (c) => c.status !== 'archived' && c.assignedConsultantId === (currentUser?.id || '')
  ).length;
  const myDesks = countryTeams.filter((t) => countryTeamIds.includes(t.id));

  const allCountryChoices = Array.from(
    new Set([...POPULAR_DESTINATIONS, ...operatingCountries])
  );

  const isOrgAdmin = currentUser?.role === 'org_admin';
  const roleLabel =
    currentUser?.role === 'org_admin'
      ? 'Agency owner'
      : currentUser?.role === 'manager'
        ? 'Desk lead'
        : currentUser?.role === 'reviewer'
          ? 'Reviewer'
          : 'Consultant';

  const pageTitle =
    mode === 'agency'
      ? 'Agency settings'
      : mode === 'profile'
        ? isOrgAdmin
          ? 'Admin profile'
          : 'My profile'
        : 'Agency setup & admin profile';
  const pageSubtitle =
    mode === 'agency'
      ? 'Configure your consultancy branding, destination countries, and dossier routing rules'
      : mode === 'profile'
        ? isOrgAdmin
          ? 'Manage your personal owner/consultant account, credential card, and alert preferences'
          : 'Manage your personal profile, assigned desk memberships, and alert preferences'
        : 'Configure your consultancy branding, destination countries, routing rules, and owner account';

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-[28px] leading-[1.15] font-medium text-ink-primary tracking-[-0.015em]">
            {pageTitle}
          </h1>
          <p className="text-sm text-ink-secondary mt-1.5">{pageSubtitle}</p>
        </div>

        <VerificationStamp
          tone="brass"
          label={currentUser?.role === 'org_admin' ? 'Agency owner' : currentUser?.role || 'Admin'}
          meta={orgName}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left 7 Columns */}
        <div className="lg:col-span-7 space-y-6">
          {/* 1. Agency Setup & Destination Countries */}
          {mode !== 'profile' && (
          <form
            onSubmit={handleOrgSubmit}
            className="p-6 rounded-xl bg-surface-card border border-hairline space-y-5 text-sm"
          >
            <div className="border-b border-hairline pb-4 flex items-center justify-between">
              <div>
                <h2 className="text-base font-medium text-ink-primary">
                  Consultancy branding & destination countries
                </h2>
                <p className="text-xs text-ink-secondary mt-0.5">
                  Set your agency name, intake cycle, and the countries your team recruits for
                </p>
              </div>
              {savedOrg && <VerificationStamp tone="positive" label="Agency saved" />}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-ink-secondary mb-1.5">Consultancy / agency name *</label>
                <input
                  required
                  value={orgName}
                  onChange={(e) => setOrgName(e.target.value)}
                  placeholder="Acme Overseas Education"
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
                <label className="block text-xs text-ink-secondary mb-1.5">Headquarters / branches</label>
                <input
                  value={headquarters}
                  onChange={(e) => setHeadquarters(e.target.value)}
                  placeholder="London · Islamabad"
                  className="field-input"
                />
              </div>
              <div>
                <label className="block text-xs text-ink-secondary mb-1.5">Agency email</label>
                <input
                  type="email"
                  value={orgEmail}
                  onChange={(e) => setOrgEmail(e.target.value)}
                  placeholder="admissions@youragency.com"
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

            <div>
              <label className="block text-xs text-ink-secondary mb-1.5">Agency website</label>
              <input
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
                placeholder="https://youragency.com"
                className="field-input font-mono text-xs"
              />
            </div>

            {/* Interactive Destination Countries Catalog */}
            <div className="space-y-3 pt-1">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-ink-primary">
                  Active destination countries ({operatingCountries.length})
                </label>
                <span className="text-xs text-ink-muted">Click to toggle or add custom country</span>
              </div>

              <div className="flex flex-wrap gap-1.5">
                {allCountryChoices.map((country) => {
                  const selected = operatingCountries.some(
                    (c) => c.toLowerCase() === country.toLowerCase()
                  );
                  return (
                    <button
                      key={country}
                      type="button"
                      onClick={() => toggleOperatingCountry(country)}
                      className={`px-2.5 py-1 rounded-md border text-xs inline-flex items-center gap-1.5 transition-colors duration-150 ease-quart ${
                        selected
                          ? 'bg-surface-raised border-brass text-ink-primary font-medium'
                          : 'bg-surface-deep border-hairline text-ink-muted hover:text-ink-primary hover:border-hairline-strong'
                      }`}
                    >
                      <span>{country}</span>
                      {selected && <X className="w-3 h-3 text-brass" strokeWidth={1.5} />}
                    </button>
                  );
                })}
              </div>

              <div className="flex items-center gap-2">
                <input
                  value={customCountryInput}
                  onChange={(e) => setCustomCountryInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddCustomCountry();
                    }
                  }}
                  placeholder="Add any other country (e.g. Finland, Japan, Austria)..."
                  className="field-input h-8 text-xs flex-1"
                />
                <button
                  type="button"
                  onClick={handleAddCustomCountry}
                  className="btn-secondary h-8 px-3 text-xs shrink-0"
                >
                  <Plus className="w-3.5 h-3.5 text-ink-muted" strokeWidth={1.5} />
                  <span>Add country</span>
                </button>
              </div>
            </div>

            {/* Governance Switches */}
            <div className="space-y-3 pt-1">
              <div className="p-3.5 rounded-lg bg-surface-deep border border-hairline flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-medium text-ink-primary">
                    Auto-assign new students by target country
                  </p>
                  <p className="text-xs text-ink-secondary mt-0.5">
                    Routes incoming students to the matching Country Desk and least-loaded consultant
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

              <div className="p-3.5 rounded-lg bg-surface-deep border border-hairline flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-medium text-ink-primary">
                    Require verification before portal submission
                  </p>
                  <p className="text-xs text-ink-secondary mt-0.5">
                    Highlights unconfirmed passport or transcript fields prior to autofill
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
                {savingOrg ? 'Saving...' : 'Save agency & countries'}
              </button>
            </div>
          </form>
          )}

          {/* 2. Personal Owner / Admin Profile */}
          {mode !== 'agency' && (
          <form
            onSubmit={handleProfileSubmit}
            className="p-6 rounded-xl bg-surface-card border border-hairline space-y-5 text-sm"
          >
            <div className="border-b border-hairline pb-4 flex items-center justify-between">
              <div>
                <h2 className="text-base font-medium text-ink-primary">
                  {isOrgAdmin ? 'Owner & admin profile' : 'My profile'}
                </h2>
                <p className="text-xs text-ink-secondary mt-0.5">
                  Your personal contact details and desk memberships
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
                <label className="block text-xs text-ink-secondary mb-1.5">Title / role</label>
                <input
                  value={jobTitle}
                  onChange={(e) => setJobTitle(e.target.value)}
                  className="field-input"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs text-ink-secondary mb-1.5">Email *</label>
                <input
                  required
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="field-input"
                />
              </div>
              <div>
                <label className="block text-xs text-ink-secondary mb-1.5">Phone</label>
                <input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="field-input font-mono"
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
                <label className="block text-xs text-ink-secondary mb-1.5">Office location</label>
                <input
                  value={officeLocation}
                  onChange={(e) => setOfficeLocation(e.target.value)}
                  className="field-input"
                />
              </div>
              <div>
                <label className="block text-xs text-ink-secondary mb-1.5">Sign-off signature</label>
                <input
                  value={signatureLine}
                  onChange={(e) => setSignatureLine(e.target.value)}
                  className="field-input"
                />
              </div>
            </div>

            {countryTeams.length > 0 && (
              <div>
                <label className="block text-xs text-ink-secondary mb-2">
                  Your country desk memberships
                </label>
                <div className="flex flex-wrap gap-2">
                  {countryTeams.map((desk) => {
                    const active = countryTeamIds.includes(desk.id);
                    return (
                      <button
                        key={desk.id}
                        type="button"
                        onClick={() =>
                          setCountryTeamIds((prev) =>
                            active ? prev.filter((id) => id !== desk.id) : [...prev, desk.id]
                          )
                        }
                        className={`px-3 py-1.5 rounded-lg border text-xs inline-flex items-center gap-2 transition-colors duration-150 ease-quart ${
                          active
                            ? 'bg-surface-raised border-brass text-ink-primary'
                            : 'bg-surface-deep border-hairline text-ink-secondary'
                        }`}
                      >
                        <span className="font-mono text-brass">{desk.code}</span>
                        <span>{desk.name}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="pt-3 border-t border-hairline flex justify-end">
              <button type="submit" disabled={savingProfile} className="btn-primary">
                {savingProfile ? 'Saving...' : 'Save admin profile'}
              </button>
            </div>
          </form>
          )}
        </div>

        {/* Right 5 Columns: Credential Card + Quick Launch Checklist + Notifications */}
        <div className="lg:col-span-5 space-y-5">
          {/* Officer Credential Card */}
          {mode !== 'agency' && (
          <div className="rounded-xl bg-surface-card border border-brass-border overflow-hidden shadow-[inset_0_1px_0_rgba(212,168,83,0.14)]">
            <div className="px-5 py-3.5 border-b border-[rgba(212,168,83,0.14)] flex items-center justify-between">
              <span className="font-mono text-xs text-brass">{roleLabel} credential</span>
              <VerificationStamp tone="positive" label="active" />
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
                  <span className="block text-ink-muted">Consultancy</span>
                  <span className="block text-ink-primary mt-0.5 truncate">{orgName}</span>
                </div>
                <div>
                  <span className="block text-ink-muted">Assigned workload</span>
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
                  <span className="block text-ink-muted">Countries active</span>
                  <span className="block font-mono text-ink-primary mt-0.5">
                    {operatingCountries.length} destinations
                  </span>
                </div>
              </div>
            </div>
          </div>
          )}

          {/* Agency Launch Checklist */}
          {mode !== 'profile' && (
          <div className="p-5 rounded-xl bg-surface-card border border-hairline space-y-3">
            <h3 className="text-sm font-medium text-ink-primary">Workspace setup checklist</h3>
            <div className="space-y-2.5 text-xs">
              {[
                {
                  done: Boolean(orgName.trim()) && operatingCountries.length > 0,
                  label: `Agency name & ${operatingCountries.length} destination countries`,
                },
                {
                  done: countryTeams.length > 0,
                  label: `${countryTeams.length} country desk${countryTeams.length === 1 ? '' : 's'} configured`,
                  action: onOpenTeamDesks,
                  actionLabel: 'Manage desks',
                },
                {
                  done: aiSettings.hasConfiguredKey || aiSettings.provider === 'ollama',
                  label: `AI engine (${aiSettings.provider} · ${aiSettings.model})`,
                  action: onOpenModelProviders,
                  actionLabel: 'Configure AI',
                },
              ].map((step, i) => (
                <div
                  key={i}
                  className="p-2.5 rounded-lg bg-surface-deep border border-hairline flex items-center justify-between gap-2"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <CheckCircle2
                      className={`w-4 h-4 shrink-0 ${
                        step.done ? 'text-tone-positive' : 'text-ink-muted'
                      }`}
                      strokeWidth={1.5}
                    />
                    <span className="text-ink-primary truncate">{step.label}</span>
                  </div>
                  {step.action && (
                    <button
                      type="button"
                      onClick={step.action}
                      className="text-brass hover:underline shrink-0"
                    >
                      {step.actionLabel}
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
          )}

          {/* Notifications */}
          {mode !== 'agency' && (
          <div className="p-5 rounded-xl bg-surface-card border border-hairline space-y-3">
            <h3 className="text-sm font-medium text-ink-primary">Workspace notifications</h3>
            <div className="divide-y divide-[rgba(237,237,237,0.06)] text-xs">
              {(
                [
                  { key: 'documentUploads', label: 'Document uploads & OCR parsing' },
                  { key: 'conflictAlerts', label: 'Field discrepancy warnings' },
                  { key: 'portalDeadlines', label: 'Upcoming intake deadlines' },
                  { key: 'offerUpdates', label: 'Offer & enrollment updates' },
                ] as const
              ).map((item) => {
                const enabled = notifications[item.key];
                return (
                  <div key={item.key} className="py-2.5 first:pt-0 last:pb-0 flex items-center justify-between gap-3">
                    <span className="text-ink-primary">{item.label}</span>
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
          )}

          {isOrgAdmin && (
            <div className="flex gap-2">
              <button
                type="button"
                onClick={onOpenTeamDesks}
                className="btn-secondary flex-1 text-xs h-9"
              >
                <Globe className="w-4 h-4 text-ink-muted" strokeWidth={1.5} />
                <span>Country desks</span>
              </button>
              <button
                type="button"
                onClick={onOpenModelProviders}
                className="btn-secondary flex-1 text-xs h-9"
              >
                <SlidersHorizontal className="w-4 h-4 text-ink-muted" strokeWidth={1.5} />
                <span>Model providers</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
