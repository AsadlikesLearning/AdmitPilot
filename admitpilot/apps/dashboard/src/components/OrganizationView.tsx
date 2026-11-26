import React, { useState, useEffect } from 'react';
import {
  Plus,
  Search,
  Edit2,
  Trash2,
  X,
  UserPlus,
  Globe,
  Users,
  SlidersHorizontal,
  KeyRound,
  FolderOpen,
  ClipboardList,
  CheckCircle2,
} from 'lucide-react';
import {
  ApplicationRecord,
  CandidateProfile,
  CountryTeam,
  MemberStatus,
  UserProfile,
  UserRole,
} from 'admitpilot-shared';
import { VerificationStamp, StampTone } from './ui/Primitives';

interface OrganizationViewProps {
  mode?: 'desks' | 'directory' | 'both';
  candidates: CandidateProfile[];
  applications?: ApplicationRecord[];
  members: UserProfile[];
  countryTeams: CountryTeam[];
  operatingCountries?: string[];
  currentUserId?: string;
  onCreateMember: (
    member: Partial<UserProfile> & { email: string; fullName: string; loginPassword?: string }
  ) => Promise<void>;
  onUpdateMember: (id: string, updates: Partial<UserProfile>) => Promise<void>;
  onSetMemberPassword?: (userId: string, password: string) => Promise<void>;
  onDeleteMember: (id: string) => Promise<void>;
  onCreateCountryTeam: (
    team: Partial<CountryTeam> & { name: string; code: string; countries: string[]; memberIds?: string[] }
  ) => Promise<void>;
  onUpdateCountryTeam: (id: string, team: Partial<CountryTeam> & { memberIds?: string[] }) => Promise<void>;
  onToggleDeskMember: (teamId: string, userId: string, action: 'add' | 'remove') => Promise<void>;
  onDeleteCountryTeam: (id: string) => Promise<void>;
  onAssignCandidate: (candidateId: string, updates: Partial<CandidateProfile>) => Promise<void>;
  onSelectCandidateDossier?: (candidate: CandidateProfile) => void;
  onOpenAgencySettings?: () => void;
}

const ROLE_LABELS: Record<UserRole, string> = {
  org_admin: 'Agency owner',
  manager: 'Desk lead',
  consultant: 'Consultant',
  reviewer: 'Reviewer',
};

const STATUS_META: Record<MemberStatus, { label: string; tone: StampTone }> = {
  active: { label: 'active', tone: 'positive' },
  on_leave: { label: 'on leave', tone: 'brass' },
  invited: { label: 'invited', tone: 'brass' },
  suspended: { label: 'suspended', tone: 'negative' },
};

const DEFAULT_COUNTRIES = [
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
];

function initialsOf(name: string): string {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase() || '')
      .join('') || 'TM'
  );
}

function suggestCode(name: string): string {
  const words = name
    .trim()
    .toUpperCase()
    .split(/[\s&,/]+/)
    .filter((w) => w && !['DESK', 'TEAM', 'AND', 'THE', 'OF'].includes(w));
  if (words.length === 0) return '';
  if (words.length === 1) return words[0].slice(0, 3);
  return words.slice(0, 2).map((w) => w.slice(0, 2)).join('-');
}

export const OrganizationView: React.FC<OrganizationViewProps> = ({
  mode = 'both',
  candidates,
  applications = [],
  members,
  countryTeams,
  operatingCountries = [],
  currentUserId,
  onCreateMember,
  onUpdateMember,
  onSetMemberPassword,
  onDeleteMember,
  onCreateCountryTeam,
  onUpdateCountryTeam,
  onToggleDeskMember,
  onDeleteCountryTeam,
  onAssignCandidate,
  onSelectCandidateDossier,
  onOpenAgencySettings,
}) => {
  const [subView, setSubView] = useState<'desks' | 'directory'>(
    mode === 'directory' ? 'directory' : 'desks'
  );
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [deskAddSelection, setDeskAddSelection] = useState<Record<string, string>>({});

  useEffect(() => {
    if (mode === 'desks' || mode === 'directory') {
      setSubView(mode);
    }
  }, [mode]);

  // Member modal state
  const [isMemberModalOpen, setIsMemberModalOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<UserProfile | null>(null);
  const [mFullName, setMFullName] = useState('');
  const [mEmail, setMEmail] = useState('');
  const [mJobTitle, setMJobTitle] = useState('');
  const [mRole, setMRole] = useState<UserRole>('consultant');
  const [mStatus, setMStatus] = useState<MemberStatus>('active');
  const [mPhone, setMPhone] = useState('');
  const [mOffice, setMOffice] = useState('');
  const [mMaxDossiers, setMMaxDossiers] = useState(25);
  const [mTeamIds, setMTeamIds] = useState<string[]>([]);
  const [mPassword, setMPassword] = useState('');

  // Teammate Profile & Workload Drawer state
  const [inspectedMember, setInspectedMember] = useState<UserProfile | null>(null);
  const [drawerPassword, setDrawerPassword] = useState('');
  const [drawerPwBusy, setDrawerPwBusy] = useState(false);
  const [drawerPwMsg, setDrawerPwMsg] = useState<string | null>(null);

  // Country Desk modal state
  const [isDeskModalOpen, setIsDeskModalOpen] = useState(false);
  const [editingDesk, setEditingDesk] = useState<CountryTeam | null>(null);
  const [dName, setDName] = useState('');
  const [dCode, setDCode] = useState('');
  const [dCountries, setDCountries] = useState<string[]>([]);
  const [dCustomCountry, setDCustomCountry] = useState('');
  const [dLeadId, setDLeadId] = useState('');
  const [dIntakeFocus, setDIntakeFocus] = useState('September & January intakes');
  const [dMemberIds, setDMemberIds] = useState<string[]>([]);

  const activeCandidates = candidates.filter((c) => c.status !== 'archived');
  const unassignedCandidates = activeCandidates.filter((c) => !c.assignedConsultantId);

  const countryChoices = Array.from(
    new Set([...operatingCountries, ...countryTeams.flatMap((t) => t.countries), ...DEFAULT_COUNTRIES])
  );

  const openMemberModal = (member?: UserProfile) => {
    if (member) {
      setEditingMember(member);
      setMFullName(member.fullName);
      setMEmail(member.email);
      setMJobTitle(member.jobTitle || '');
      setMRole(member.role);
      setMStatus(member.status || 'active');
      setMPhone(member.phone || '');
      setMOffice(member.officeLocation || '');
      setMMaxDossiers(member.maxActiveDossiers ?? 25);
      setMTeamIds(member.countryTeamIds || []);
      setMPassword('');
    } else {
      setEditingMember(null);
      setMFullName('');
      setMEmail('');
      setMJobTitle('Admissions Consultant');
      setMRole('consultant');
      setMStatus('active');
      setMPhone('');
      setMOffice('');
      setMMaxDossiers(25);
      setMTeamIds(countryTeams[0] ? [countryTeams[0].id] : []);
      setMPassword('');
    }
    setIsMemberModalOpen(true);
  };

  const handleSaveMember = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      fullName: mFullName.trim(),
      email: mEmail.trim(),
      jobTitle: mJobTitle.trim(),
      role: mRole,
      status: mStatus,
      phone: mPhone.trim(),
      officeLocation: mOffice.trim(),
      maxActiveDossiers: Number(mMaxDossiers) || 25,
      countryTeamIds: mTeamIds,
    };

    if (editingMember) {
      await onUpdateMember(editingMember.id, payload);
      if (mPassword.trim().length >= 6 && onSetMemberPassword) {
        await onSetMemberPassword(editingMember.id, mPassword.trim());
      }
    } else {
      await onCreateMember({
        ...payload,
        ...(mPassword.trim().length >= 6 ? { loginPassword: mPassword.trim() } : {}),
      });
    }
    setMPassword('');
    setIsMemberModalOpen(false);
  };

  const openDeskModal = (desk?: CountryTeam) => {
    if (desk) {
      setEditingDesk(desk);
      setDName(desk.name);
      setDCode(desk.code);
      setDCountries(desk.countries || []);
      setDLeadId(desk.leadUserId || '');
      setDIntakeFocus(desk.intakeFocus || 'September & January intakes');
      setDMemberIds(
        members.filter((m) => (m.countryTeamIds || []).includes(desk.id)).map((m) => m.id)
      );
    } else {
      setEditingDesk(null);
      setDName('');
      setDCode('');
      setDCountries([]);
      setDLeadId(members[0]?.id || '');
      setDIntakeFocus('September & January intakes');
      setDMemberIds(members[0] ? [members[0].id] : []);
    }
    setDCustomCountry('');
    setIsDeskModalOpen(true);
  };

  const handleSaveDesk = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      name: dName.trim(),
      code: (dCode.trim() || suggestCode(dName) || 'DESK').toUpperCase(),
      countries: dCountries,
      leadUserId: dLeadId || undefined,
      intakeFocus: dIntakeFocus.trim(),
      memberIds: dMemberIds,
    };
    if (editingDesk) {
      await onUpdateCountryTeam(editingDesk.id, payload);
    } else {
      await onCreateCountryTeam(payload);
    }
    setIsDeskModalOpen(false);
  };

  const filteredDesks = countryTeams.filter((t) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      t.name.toLowerCase().includes(q) ||
      t.code.toLowerCase().includes(q) ||
      t.countries.some((c) => c.toLowerCase().includes(q))
    );
  });

  const filteredMembers = members.filter((m) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return `${m.fullName} ${m.email} ${m.jobTitle || ''} ${(m.assignedCountries || []).join(' ')}`
      .toLowerCase()
      .includes(q);
  });

  const pageTitle =
    mode === 'directory'
      ? 'Team'
      : mode === 'desks'
        ? 'Country desks'
        : 'Team & country desks';
  const pageSubtitle =
    mode === 'directory'
      ? 'Manage consultant profiles, login credentials, and assigned student workloads'
      : mode === 'desks'
        ? 'Organize destination country desks and route student dossiers automatically'
        : 'Organize consultants by destination country and route student dossiers automatically';

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

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {mode !== 'directory' && onOpenAgencySettings && (
            <button type="button" onClick={onOpenAgencySettings} className="btn-secondary">
              <SlidersHorizontal className="w-4 h-4 text-ink-muted" strokeWidth={1.5} />
              <span>Agency countries</span>
            </button>
          )}
          {mode !== 'directory' && (
            <button type="button" onClick={() => openDeskModal()} className="btn-secondary">
              <Globe className="w-4 h-4 text-ink-muted" strokeWidth={1.5} />
              <span>New country desk</span>
            </button>
          )}
          {mode !== 'desks' && (
            <button type="button" onClick={() => openMemberModal()} className="btn-primary">
              <UserPlus className="w-4 h-4 text-[#141415]" strokeWidth={1.5} />
              <span>Add teammate</span>
            </button>
          )}
        </div>
      </div>

      {/* View Switcher & Search */}
      <div className="p-3 rounded-xl bg-surface-card border border-hairline flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        {mode === 'both' ? (
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setSubView('desks')}
              className={`h-8 px-3 rounded-lg text-xs inline-flex items-center gap-2 transition-colors duration-150 ease-quart ${
                subView === 'desks'
                  ? 'bg-surface-raised border border-hairline-strong text-ink-primary font-medium'
                  : 'text-ink-secondary hover:text-ink-primary border border-transparent'
              }`}
            >
              <Globe className="w-4 h-4 text-ink-muted" strokeWidth={1.5} />
              <span>Country desks ({countryTeams.length})</span>
            </button>
            <button
              type="button"
              onClick={() => setSubView('directory')}
              className={`h-8 px-3 rounded-lg text-xs inline-flex items-center gap-2 transition-colors duration-150 ease-quart ${
                subView === 'directory'
                  ? 'bg-surface-raised border border-hairline-strong text-ink-primary font-medium'
                  : 'text-ink-secondary hover:text-ink-primary border border-transparent'
              }`}
            >
              <Users className="w-4 h-4 text-ink-muted" strokeWidth={1.5} />
              <span>Team members ({members.length})</span>
            </button>
          </div>
        ) : (
          <div className="text-xs text-ink-secondary px-1">
            {mode === 'directory'
              ? `${members.length} team member${members.length === 1 ? '' : 's'} · click a teammate to inspect credentials & workload`
              : `${countryTeams.length} country desk${countryTeams.length === 1 ? '' : 's'} active`}
          </div>
        )}

        <div className="relative w-full sm:w-64">
          <Search
            className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted pointer-events-none"
            strokeWidth={1.5}
          />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Filter desks, countries, or staff..."
            className="h-8 w-full pl-9 pr-3 bg-surface-deep border border-hairline rounded-lg text-xs text-ink-primary placeholder:text-ink-muted focus:outline-none focus:border-brass"
          />
        </div>
      </div>

      {/* Unassigned Students Quick-Assign Strip */}
      {unassignedCandidates.length > 0 && (
        <div className="p-4 rounded-xl bg-surface-card border border-brass-border flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div>
            <span className="font-medium text-brass">
              {unassignedCandidates.length} student dossier{unassignedCandidates.length === 1 ? '' : 's'} awaiting consultant assignment
            </span>
            <p className="text-ink-secondary mt-0.5">
              Assign a student to a country desk or consultant directly
            </p>
          </div>
          <div className="flex items-center gap-2">
            <select
              defaultValue=""
              onChange={(e) => {
                const cand = unassignedCandidates[0];
                if (cand && e.target.value) {
                  onAssignCandidate(cand.id, { assignedConsultantId: e.target.value });
                }
              }}
              className="field-input h-8 w-auto text-xs"
            >
              <option value="">
                Assign {unassignedCandidates[0].personal.legalGivenName}...
              </option>
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.fullName}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

      {/* SUBVIEW 1: COUNTRY DESKS */}
      {subView === 'desks' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {filteredDesks.map((desk) => {
            const deskMembers = members.filter((m) => (m.countryTeamIds || []).includes(desk.id));
            const availableToAdd = members.filter((m) => !(m.countryTeamIds || []).includes(desk.id));
            const deskCandidates = activeCandidates.filter(
              (c) =>
                c.countryTeamId === desk.id ||
                (c.targetCountries || []).some((tc) => desk.countries.includes(tc))
            );
            const selectedAddId = deskAddSelection[desk.id] || '';

            return (
              <div
                key={desk.id}
                className="p-5 rounded-xl bg-surface-card border border-hairline flex flex-col justify-between gap-4"
              >
                <div className="space-y-3.5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded bg-surface-deep border border-brass-border font-mono text-xs text-brass">
                          {desk.code}
                        </span>
                        <h3 className="text-base font-medium text-ink-primary">{desk.name}</h3>
                      </div>
                      <p className="text-xs text-ink-muted mt-1">
                        {desk.intakeFocus || 'All intakes'} · {deskCandidates.length} student
                        {deskCandidates.length === 1 ? '' : 's'}
                      </p>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => openDeskModal(desk)}
                        className="h-8 w-8 rounded-lg text-ink-muted hover:text-ink-primary hover:bg-surface-raised inline-flex items-center justify-center"
                        title="Edit country desk"
                      >
                        <Edit2 className="w-4 h-4" strokeWidth={1.5} />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (window.confirm(`Delete country desk "${desk.name}"?`)) {
                            onDeleteCountryTeam(desk.id);
                          }
                        }}
                        className="h-8 w-8 rounded-lg text-ink-muted hover:text-tone-negative hover:bg-surface-raised inline-flex items-center justify-center"
                        title="Delete country desk"
                      >
                        <Trash2 className="w-4 h-4" strokeWidth={1.5} />
                      </button>
                    </div>
                  </div>

                  {/* Destination Countries */}
                  <div className="flex flex-wrap gap-1.5">
                    {desk.countries.map((country) => (
                      <span
                        key={country}
                        className="px-2.5 py-0.5 rounded-md bg-surface-deep border border-hairline text-xs text-ink-primary"
                      >
                        {country}
                      </span>
                    ))}
                    {desk.countries.length === 0 && (
                      <span className="text-xs text-ink-muted">No countries assigned yet</span>
                    )}
                  </div>

                  {/* Assigned Consultants */}
                  <div className="pt-3 border-t border-hairline space-y-2.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-ink-muted">
                        Assigned consultants ({deskMembers.length})
                      </span>
                      <select
                        value={desk.leadUserId || ''}
                        onChange={(e) =>
                          onUpdateCountryTeam(desk.id, {
                            ...desk,
                            leadUserId: e.target.value || undefined,
                          })
                        }
                        className="bg-surface-deep border border-hairline rounded px-2 py-0.5 text-xs text-ink-secondary focus:outline-none focus:border-brass"
                        title="Desk lead"
                      >
                        <option value="">No desk lead</option>
                        {members.map((m) => (
                          <option key={m.id} value={m.id}>
                            Lead: {m.fullName}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="flex flex-wrap gap-1.5">
                      {deskMembers.map((m) => (
                        <span
                          key={m.id}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-surface-deep border border-hairline text-xs text-ink-primary"
                        >
                          <span className="font-mono text-[11px] text-brass">
                            {initialsOf(m.fullName)}
                          </span>
                          <span>{m.fullName}</span>
                          <button
                            type="button"
                            onClick={() => onToggleDeskMember(desk.id, m.id, 'remove')}
                            className="text-ink-muted hover:text-tone-negative ml-0.5"
                            title="Remove from desk"
                          >
                            <X className="w-3 h-3" strokeWidth={1.5} />
                          </button>
                        </span>
                      ))}
                      {deskMembers.length === 0 && (
                        <span className="text-xs text-ink-muted">No consultants on this desk</span>
                      )}
                    </div>

                    {availableToAdd.length > 0 && (
                      <div className="flex items-center gap-2 pt-1">
                        <select
                          value={selectedAddId}
                          onChange={(e) => {
                            const val = e.target.value;
                            setDeskAddSelection((prev) => ({ ...prev, [desk.id]: '' }));
                            if (val) onToggleDeskMember(desk.id, val, 'add');
                          }}
                          className="field-input h-8 text-xs flex-1"
                        >
                          <option value="">+ Add teammate to {desk.code}...</option>
                          {availableToAdd.map((m) => (
                            <option key={m.id} value={m.id}>
                              {m.fullName} ({ROLE_LABELS[m.role]})
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* SUBVIEW 2: TEAM MEMBERS */}
      {subView === 'directory' && (
        <div className="bg-surface-card border border-hairline rounded-xl overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-hairline text-ink-muted">
                <th className="py-3 px-4 font-normal">Consultant</th>
                <th className="py-3 px-4 font-normal">Role & status</th>
                <th className="py-3 px-4 font-normal">Country desks (click to toggle)</th>
                <th className="py-3 px-4 font-normal text-right">Dossiers</th>
                <th className="py-3 px-4 font-normal text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[rgba(237,237,237,0.06)]">
              {filteredMembers.map((member) => {
                const load = activeCandidates.filter((c) => c.assignedConsultantId === member.id).length;
                const statusInfo = STATUS_META[member.status || 'active'] || STATUS_META.active;
                const isSelf = member.id === currentUserId;

                return (
                  <tr key={member.id} className="hover:bg-surface-deep/50">
                    <td className="py-3.5 px-4">
                      <button
                        type="button"
                        onClick={() => {
                          setInspectedMember(member);
                          setDrawerPassword('');
                          setDrawerPwMsg(null);
                        }}
                        className="flex items-center gap-3 text-left group"
                      >
                        <span className="w-8 h-8 rounded-md bg-surface-deep border border-hairline font-mono text-xs text-brass flex items-center justify-center shrink-0">
                          {initialsOf(member.fullName)}
                        </span>
                        <div>
                          <p className="text-sm font-medium text-ink-primary group-hover:text-brass transition-colors">
                            {member.fullName}
                            {isSelf && <span className="text-xs text-brass ml-1.5">(You)</span>}
                          </p>
                          <p className="text-ink-secondary">{member.email}</p>
                        </div>
                      </button>
                    </td>

                    <td className="py-3.5 px-4 space-y-1">
                      <div className="text-ink-primary font-medium">{ROLE_LABELS[member.role]}</div>
                      <VerificationStamp tone={statusInfo.tone} label={statusInfo.label} />
                    </td>

                    <td className="py-3.5 px-4">
                      <div className="flex flex-wrap gap-1.5">
                        {countryTeams.map((desk) => {
                          const active = (member.countryTeamIds || []).includes(desk.id);
                          return (
                            <button
                              key={desk.id}
                              type="button"
                              onClick={() =>
                                onToggleDeskMember(desk.id, member.id, active ? 'remove' : 'add')
                              }
                              className={`px-2 py-0.5 rounded border font-mono text-[11px] transition-colors ${
                                active
                                  ? 'bg-surface-raised border-brass text-brass'
                                  : 'bg-surface-deep border-hairline text-ink-muted hover:text-ink-primary'
                              }`}
                            >
                              {desk.code}
                            </button>
                          );
                        })}
                      </div>
                    </td>

                    <td className="py-3.5 px-4 text-right font-mono tabular-nums text-ink-primary">
                      {load} / {member.maxActiveDossiers || 25}
                    </td>

                    <td className="py-3.5 px-4 text-right">
                      <div className="inline-flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => {
                            setInspectedMember(member);
                            setDrawerPassword('');
                            setDrawerPwMsg(null);
                          }}
                          className="h-8 px-2.5 rounded-lg bg-surface-deep border border-hairline hover:border-hairline-strong text-ink-secondary hover:text-ink-primary inline-flex items-center gap-1.5 text-xs"
                          title="Inspect assigned students, admissions process & login credentials"
                        >
                          <KeyRound className="w-3.5 h-3.5 text-brass" strokeWidth={1.5} />
                          <span className="hidden sm:inline">Profile & workload</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => openMemberModal(member)}
                          className="h-8 w-8 rounded-lg text-ink-muted hover:text-ink-primary hover:bg-surface-raised inline-flex items-center justify-center"
                          title="Edit teammate"
                        >
                          <Edit2 className="w-4 h-4" strokeWidth={1.5} />
                        </button>
                        {!isSelf && (
                          <button
                            type="button"
                            onClick={() => {
                              if (window.confirm(`Remove ${member.fullName} from workspace?`)) {
                                onDeleteMember(member.id);
                              }
                            }}
                            className="h-8 w-8 rounded-lg text-ink-muted hover:text-tone-negative hover:bg-surface-raised inline-flex items-center justify-center"
                            title="Remove teammate"
                          >
                            <Trash2 className="w-4 h-4" strokeWidth={1.5} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal: Add / Edit Country Desk */}
      {isDeskModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4">
          <div className="bg-surface-card border border-hairline-strong rounded-2xl w-full max-w-lg overflow-hidden">
            <div className="h-14 px-6 border-b border-hairline flex items-center justify-between">
              <h3 className="text-base font-medium text-ink-primary">
                {editingDesk ? `Edit ${editingDesk.name}` : 'Create country desk'}
              </h3>
              <button
                type="button"
                onClick={() => setIsDeskModalOpen(false)}
                className="h-8 w-8 rounded-lg text-ink-muted hover:text-ink-primary hover:bg-surface-raised inline-flex items-center justify-center"
              >
                <X className="w-4 h-4" strokeWidth={1.5} />
              </button>
            </div>

            <form onSubmit={handleSaveDesk} className="p-6 space-y-4 max-h-[82vh] overflow-y-auto text-sm">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-xs text-ink-secondary mb-1.5">Country desk name *</label>
                  <input
                    required
                    value={dName}
                    onChange={(e) => {
                      const val = e.target.value;
                      setDName(val);
                      if (!editingDesk) setDCode(suggestCode(val));
                    }}
                    placeholder="United Kingdom & Ireland Desk"
                    className="field-input"
                  />
                </div>
                <div>
                  <label className="block text-xs text-ink-secondary mb-1.5">Short code *</label>
                  <input
                    required
                    value={dCode}
                    onChange={(e) => setDCode(e.target.value.toUpperCase())}
                    placeholder="UK-IE"
                    className="field-input font-mono uppercase"
                  />
                </div>
              </div>

              {/* Clickable Country Selector */}
              <div className="space-y-2">
                <label className="block text-xs text-ink-secondary">
                  Countries handled by this desk ({dCountries.length})
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {countryChoices.map((c) => {
                    const active = dCountries.some((dc) => dc.toLowerCase() === c.toLowerCase());
                    return (
                      <button
                        key={c}
                        type="button"
                        onClick={() =>
                          setDCountries((prev) =>
                            active
                              ? prev.filter((item) => item.toLowerCase() !== c.toLowerCase())
                              : [...prev, c]
                          )
                        }
                        className={`px-2.5 py-1 rounded-md border text-xs transition-colors ${
                          active
                            ? 'bg-surface-raised border-brass text-ink-primary font-medium'
                            : 'bg-surface-deep border-hairline text-ink-muted hover:text-ink-primary'
                        }`}
                      >
                        {c}
                      </button>
                    );
                  })}
                </div>
                <div className="flex items-center gap-2 pt-1">
                  <input
                    value={dCustomCountry}
                    onChange={(e) => setDCustomCountry(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        const clean = dCustomCountry.trim();
                        if (clean && !dCountries.includes(clean)) {
                          setDCountries((prev) => [...prev, clean]);
                        }
                        setDCustomCountry('');
                      }
                    }}
                    placeholder="Or type custom country name..."
                    className="field-input h-8 text-xs flex-1"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const clean = dCustomCountry.trim();
                      if (clean && !dCountries.includes(clean)) {
                        setDCountries((prev) => [...prev, clean]);
                      }
                      setDCustomCountry('');
                    }}
                    className="btn-secondary h-8 px-3 text-xs"
                  >
                    Add
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-ink-secondary mb-1.5">Desk lead</label>
                  <select
                    value={dLeadId}
                    onChange={(e) => setDLeadId(e.target.value)}
                    className="field-input"
                  >
                    <option value="">Unassigned</option>
                    {members.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.fullName}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-ink-secondary mb-1.5">Intake focus</label>
                  <input
                    value={dIntakeFocus}
                    onChange={(e) => setDIntakeFocus(e.target.value)}
                    className="field-input"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs text-ink-secondary mb-2">Assign teammates</label>
                <div className="flex flex-wrap gap-1.5">
                  {members.map((m) => {
                    const checked = dMemberIds.includes(m.id);
                    return (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() =>
                          setDMemberIds((prev) =>
                            checked ? prev.filter((id) => id !== m.id) : [...prev, m.id]
                          )
                        }
                        className={`px-2.5 py-1 rounded-md border text-xs transition-colors ${
                          checked
                            ? 'bg-surface-raised border-brass text-ink-primary'
                            : 'bg-surface-deep border-hairline text-ink-secondary'
                        }`}
                      >
                        {m.fullName}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="flex justify-end gap-2.5 pt-3 border-t border-hairline">
                <button type="button" onClick={() => setIsDeskModalOpen(false)} className="btn-secondary">
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
                  Save country desk
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Add / Edit Teammate */}
      {isMemberModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4">
          <div className="bg-surface-card border border-hairline-strong rounded-2xl w-full max-w-lg overflow-hidden">
            <div className="h-14 px-6 border-b border-hairline flex items-center justify-between">
              <h3 className="text-base font-medium text-ink-primary">
                {editingMember ? `Edit ${editingMember.fullName}` : 'Add team member'}
              </h3>
              <button
                type="button"
                onClick={() => setIsMemberModalOpen(false)}
                className="h-8 w-8 rounded-lg text-ink-muted hover:text-ink-primary hover:bg-surface-raised inline-flex items-center justify-center"
              >
                <X className="w-4 h-4" strokeWidth={1.5} />
              </button>
            </div>

            <form onSubmit={handleSaveMember} className="p-6 space-y-4 max-h-[82vh] overflow-y-auto text-sm">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-ink-secondary mb-1.5">Full name *</label>
                  <input
                    required
                    value={mFullName}
                    onChange={(e) => setMFullName(e.target.value)}
                    placeholder="Ayesha Malik"
                    className="field-input"
                  />
                </div>
                <div>
                  <label className="block text-xs text-ink-secondary mb-1.5">Work email *</label>
                  <input
                    required
                    type="email"
                    value={mEmail}
                    onChange={(e) => setMEmail(e.target.value)}
                    placeholder="ayesha@youragency.com"
                    className="field-input"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs text-ink-secondary mb-1.5">Role</label>
                  <select
                    value={mRole}
                    onChange={(e) => setMRole(e.target.value as UserRole)}
                    className="field-input"
                  >
                    <option value="consultant">Consultant</option>
                    <option value="manager">Desk lead</option>
                    <option value="reviewer">Reviewer</option>
                    <option value="org_admin">Agency owner / admin</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-ink-secondary mb-1.5">Status</label>
                  <select
                    value={mStatus}
                    onChange={(e) => setMStatus(e.target.value as MemberStatus)}
                    className="field-input"
                  >
                    <option value="active">Active</option>
                    <option value="invited">Invited</option>
                    <option value="on_leave">On leave</option>
                    <option value="suspended">Suspended</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-ink-secondary mb-1.5">Dossier limit</label>
                  <input
                    type="number"
                    min={1}
                    max={200}
                    value={mMaxDossiers}
                    onChange={(e) => setMMaxDossiers(Number(e.target.value))}
                    className="field-input font-mono tabular-nums"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-ink-secondary mb-1.5">Job title</label>
                  <input
                    value={mJobTitle}
                    onChange={(e) => setMJobTitle(e.target.value)}
                    className="field-input"
                  />
                </div>
                <div>
                  <label className="block text-xs text-ink-secondary mb-1.5">Branch / office</label>
                  <input
                    value={mOffice}
                    onChange={(e) => setMOffice(e.target.value)}
                    placeholder="Lahore / London"
                    className="field-input"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs text-ink-secondary mb-1.5">
                  {editingMember ? 'Reset login password (optional)' : 'Login password (optional)'}
                </label>
                <input
                  type="password"
                  minLength={6}
                  value={mPassword}
                  onChange={(e) => setMPassword(e.target.value)}
                  placeholder={
                    editingMember
                      ? 'Leave blank to keep current password (min 6 chars)'
                      : 'Min 6 characters (defaults to AdmitPilot!2027 if blank)'
                  }
                  className="field-input"
                />
              </div>

              <div>
                <label className="block text-xs text-ink-secondary mb-2">Assign to country desks</label>
                <div className="flex flex-wrap gap-1.5">
                  {countryTeams.map((desk) => {
                    const checked = mTeamIds.includes(desk.id);
                    return (
                      <button
                        key={desk.id}
                        type="button"
                        onClick={() =>
                          setMTeamIds((prev) =>
                            checked ? prev.filter((id) => id !== desk.id) : [...prev, desk.id]
                          )
                        }
                        className={`px-2.5 py-1 rounded-md border text-xs inline-flex items-center gap-1.5 transition-colors ${
                          checked
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

              <div className="flex justify-end gap-2.5 pt-3 border-t border-hairline">
                <button type="button" onClick={() => setIsMemberModalOpen(false)} className="btn-secondary">
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
                  Save teammate
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Drawer: Teammate Profile, Login Credentials & Assigned Workload */}
      {inspectedMember && (() => {
        const liveMember = members.find((m) => m.id === inspectedMember.id) || inspectedMember;
        const memberTeamIds = new Set(liveMember.countryTeamIds || []);
        const memberDesks = countryTeams.filter((d) => memberTeamIds.has(d.id));
        const memberStudents = activeCandidates.filter(
          (c) =>
            c.assignedConsultantId === liveMember.id ||
            (!c.assignedConsultantId &&
              c.countryTeamId &&
              memberTeamIds.has(c.countryTeamId))
        );
        const memberStudentIds = new Set(memberStudents.map((s) => s.id));
        const memberApps = applications.filter(
          (a) => a.assignedConsultantId === liveMember.id || memberStudentIds.has(a.candidateId)
        );
        const statusInfo = STATUS_META[liveMember.status || 'active'] || STATUS_META.active;

        return (
          <div className="fixed inset-0 z-50 bg-black/75 flex justify-end">
            <div className="bg-surface-card border-l border-hairline-strong w-full max-w-xl h-full flex flex-col">
              <div className="h-14 px-6 border-b border-hairline flex items-center justify-between shrink-0">
                <div className="flex items-center gap-3 min-w-0">
                  <span className="w-8 h-8 rounded-md bg-surface-deep border border-hairline font-mono text-xs text-brass flex items-center justify-center shrink-0">
                    {initialsOf(liveMember.fullName)}
                  </span>
                  <div className="min-w-0">
                    <h3 className="text-sm font-medium text-ink-primary truncate">
                      {liveMember.fullName}
                    </h3>
                    <p className="text-xs text-ink-muted truncate">
                      {ROLE_LABELS[liveMember.role]} · {liveMember.email}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      setInspectedMember(null);
                      openMemberModal(liveMember);
                    }}
                    className="btn-secondary h-8 px-2.5 text-xs"
                  >
                    <Edit2 className="w-3.5 h-3.5" strokeWidth={1.5} />
                    <span>Edit</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setInspectedMember(null)}
                    className="h-8 w-8 rounded-lg text-ink-muted hover:text-ink-primary hover:bg-surface-raised inline-flex items-center justify-center"
                  >
                    <X className="w-4 h-4" strokeWidth={1.5} />
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-6 text-sm">
                {/* Profile & Desks */}
                <div className="p-4 rounded-xl bg-surface-deep border border-hairline space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-medium text-ink-secondary">
                      Profile & country desks
                    </span>
                    <VerificationStamp tone={statusInfo.tone} label={statusInfo.label} />
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <span className="text-ink-muted block">Job title</span>
                      <span className="text-ink-primary">
                        {liveMember.jobTitle || ROLE_LABELS[liveMember.role]}
                      </span>
                    </div>
                    <div>
                      <span className="text-ink-muted block">Branch / office</span>
                      <span className="text-ink-primary">
                        {liveMember.officeLocation || 'Main office'}
                      </span>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {memberDesks.length > 0 ? (
                      memberDesks.map((d) => (
                        <span
                          key={d.id}
                          className="px-2 py-0.5 rounded bg-surface-raised border border-brass-border text-xs text-ink-primary inline-flex items-center gap-1.5"
                        >
                          <span className="font-mono text-brass">{d.code}</span>
                          <span>{d.name}</span>
                        </span>
                      ))
                    ) : (
                      <span className="text-xs text-ink-muted">No country desks assigned</span>
                    )}
                  </div>
                </div>

                {/* Login Credentials */}
                <div className="p-4 rounded-xl bg-surface-deep border border-hairline space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <KeyRound className="w-4 h-4 text-brass" strokeWidth={1.5} />
                      <span className="text-xs font-medium text-ink-primary">
                        Login credentials
                      </span>
                    </div>
                    <VerificationStamp
                      tone={liveMember.hasLoginPassword ? 'positive' : 'brass'}
                      label={liveMember.hasLoginPassword ? 'custom password' : 'default password'}
                    />
                  </div>
                  <div className="text-xs text-ink-secondary">
                    Sign-in email: <span className="font-mono text-ink-primary">{liveMember.email}</span>
                  </div>
                  {onSetMemberPassword && (
                    <form
                      onSubmit={async (e) => {
                        e.preventDefault();
                        if (drawerPassword.trim().length < 6) return;
                        setDrawerPwBusy(true);
                        setDrawerPwMsg(null);
                        try {
                          await onSetMemberPassword(liveMember.id, drawerPassword.trim());
                          setDrawerPassword('');
                          setDrawerPwMsg('Login password updated.');
                        } finally {
                          setDrawerPwBusy(false);
                        }
                      }}
                      className="flex items-center gap-2 pt-1"
                    >
                      <input
                        type="password"
                        minLength={6}
                        required
                        value={drawerPassword}
                        onChange={(e) => setDrawerPassword(e.target.value)}
                        placeholder="Set new password (min 6 chars)"
                        className="field-input h-8 text-xs flex-1"
                      />
                      <button
                        type="submit"
                        disabled={drawerPwBusy}
                        className="btn-primary h-8 px-3 text-xs shrink-0"
                      >
                        {drawerPwBusy ? 'Saving...' : 'Update password'}
                      </button>
                    </form>
                  )}
                  {drawerPwMsg && (
                    <p className="text-xs text-tone-positive flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5" strokeWidth={1.5} />
                      <span>{drawerPwMsg}</span>
                    </p>
                  )}
                </div>

                {/* Assigned Students */}
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <FolderOpen className="w-4 h-4 text-ink-muted" strokeWidth={1.5} />
                      <h4 className="text-xs font-medium text-ink-primary">
                        Assigned students ({memberStudents.length})
                      </h4>
                    </div>
                  </div>
                  {memberStudents.length === 0 ? (
                    <div className="p-4 rounded-xl bg-surface-deep border border-hairline text-xs text-ink-muted">
                      No student dossiers assigned to {liveMember.fullName} yet.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {memberStudents.map((student) => (
                        <button
                          key={student.id}
                          type="button"
                          onClick={() => {
                            setInspectedMember(null);
                            onSelectCandidateDossier?.(student);
                          }}
                          className="w-full p-3 rounded-xl bg-surface-deep border border-hairline hover:border-hairline-strong text-left flex items-center justify-between gap-3 transition-colors"
                        >
                          <div className="min-w-0">
                            <p className="text-xs font-medium text-ink-primary truncate">
                              {student.personal.legalGivenName} {student.personal.familyName}
                            </p>
                            <p className="text-[11px] text-ink-muted truncate">
                              {(student.targetCountries || []).join(', ') || student.personal.nationality} ·{' '}
                              {student.assignedConsultantId === liveMember.id
                                ? 'Direct owner'
                                : 'Via country desk'}
                            </p>
                          </div>
                          <span className="font-mono text-xs text-brass shrink-0">
                            {student.status}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Admissions Process (Applications) */}
                <div className="space-y-2.5">
                  <div className="flex items-center gap-2">
                    <ClipboardList className="w-4 h-4 text-ink-muted" strokeWidth={1.5} />
                    <h4 className="text-xs font-medium text-ink-primary">
                      Admissions process ({memberApps.length} applications)
                    </h4>
                  </div>
                  {memberApps.length === 0 ? (
                    <div className="p-4 rounded-xl bg-surface-deep border border-hairline text-xs text-ink-muted">
                      No active university applications under {liveMember.fullName} yet.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {memberApps.map((app) => {
                        const student = candidates.find((c) => c.id === app.candidateId);
                        return (
                          <div
                            key={app.id}
                            className="p-3 rounded-xl bg-surface-deep border border-hairline flex items-center justify-between gap-3"
                          >
                            <div className="min-w-0">
                              <p className="text-xs font-medium text-ink-primary truncate">
                                {app.institutionName}
                              </p>
                              <p className="text-[11px] text-ink-muted truncate">
                                {app.programName}
                                {student
                                  ? ` · ${student.personal.legalGivenName} ${student.personal.familyName}`
                                  : ''}
                              </p>
                            </div>
                            <div className="text-right shrink-0 space-y-1">
                              <VerificationStamp
                                tone={
                                  app.status === 'unconditional_offer' ||
                                  app.status === 'conditional_offer' ||
                                  app.status === 'enrolled'
                                    ? 'positive'
                                    : app.status === 'rejected'
                                      ? 'negative'
                                      : 'brass'
                                }
                                label={app.status.replace(/_/g, ' ')}
                              />
                              {app.deadline && (
                                <p className="text-[11px] font-mono text-ink-muted">
                                  Due {app.deadline}
                                </p>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
};
