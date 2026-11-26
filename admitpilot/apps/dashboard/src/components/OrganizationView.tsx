import React, { useState } from 'react';
import {
  Plus,
  Search,
  Edit2,
  Trash2,
  X,
  UserPlus,
  Globe,
  Users,
  FolderOpen,
} from 'lucide-react';
import {
  CandidateProfile,
  CountryTeam,
  MemberStatus,
  UserProfile,
  UserRole,
} from 'admitpilot-shared';
import { VerificationStamp, StampTone } from './ui/Primitives';

interface OrganizationViewProps {
  candidates: CandidateProfile[];
  members: UserProfile[];
  countryTeams: CountryTeam[];
  currentUserId?: string;
  onCreateMember: (member: Partial<UserProfile> & { email: string; fullName: string }) => Promise<void>;
  onUpdateMember: (id: string, updates: Partial<UserProfile>) => Promise<void>;
  onDeleteMember: (id: string) => Promise<void>;
  onCreateCountryTeam: (
    team: Partial<CountryTeam> & { name: string; code: string; countries: string[]; memberIds?: string[] }
  ) => Promise<void>;
  onUpdateCountryTeam: (id: string, team: Partial<CountryTeam> & { memberIds?: string[] }) => Promise<void>;
  onToggleDeskMember: (teamId: string, userId: string, action: 'add' | 'remove') => Promise<void>;
  onDeleteCountryTeam: (id: string) => Promise<void>;
  onAssignCandidate: (candidateId: string, updates: Partial<CandidateProfile>) => Promise<void>;
  onSelectCandidateDossier?: (candidate: CandidateProfile) => void;
}

const ROLE_LABELS: Record<UserRole, string> = {
  org_admin: 'Org admin',
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

export const OrganizationView: React.FC<OrganizationViewProps> = ({
  candidates,
  members,
  countryTeams,
  currentUserId,
  onCreateMember,
  onUpdateMember,
  onDeleteMember,
  onCreateCountryTeam,
  onUpdateCountryTeam,
  onToggleDeskMember,
  onDeleteCountryTeam,
  onAssignCandidate,
  onSelectCandidateDossier,
}) => {
  const [subView, setSubView] = useState<'desks' | 'directory'>('desks');
  const [countryFilter, setCountryFilter] = useState<string>('all');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedMemberId, setSelectedMemberId] = useState<string>(members[0]?.id || '');

  // Inline desk member add selection state per desk
  const [deskAddSelection, setDeskAddSelection] = useState<Record<string, string>>({});
  const [candidateToAssign, setCandidateToAssign] = useState<string>('');

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
  const [mTimezone, setMTimezone] = useState('UTC');
  const [mLanguages, setMLanguages] = useState('English');
  const [mSpecs, setMSpecs] = useState('');
  const [mMaxDossiers, setMMaxDossiers] = useState(25);
  const [mBio, setMBio] = useState('');
  const [mTeamIds, setMTeamIds] = useState<string[]>([]);

  // Country Desk modal state
  const [isDeskModalOpen, setIsDeskModalOpen] = useState(false);
  const [editingDesk, setEditingDesk] = useState<CountryTeam | null>(null);
  const [dName, setDName] = useState('');
  const [dCode, setDCode] = useState('');
  const [dCountries, setDCountries] = useState('');
  const [dLeadId, setDLeadId] = useState('');
  const [dIntakeFocus, setDIntakeFocus] = useState('');
  const [dDesc, setDDesc] = useState('');
  const [dMemberIds, setDMemberIds] = useState<string[]>([]);

  // Derived metrics
  const activeCandidates = candidates.filter((c) => c.status !== 'archived');
  const assignedCandidatesCount = activeCandidates.filter((c) => Boolean(c.assignedConsultantId)).length;
  const unassignedCount = activeCandidates.length - assignedCandidatesCount;
  const totalCapacity = members.reduce((sum, m) => sum + (m.maxActiveDossiers || 25), 0);
  const utilizationPct = totalCapacity > 0 ? Math.round((assignedCandidatesCount / totalCapacity) * 100) : 0;

  const allCountries = Array.from(
    new Set(countryTeams.flatMap((t) => t.countries))
  ).sort();

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
      setMTimezone(member.timezone || 'UTC');
      setMLanguages((member.languages || ['English']).join(', '));
      setMSpecs((member.specializations || []).join(', '));
      setMMaxDossiers(member.maxActiveDossiers ?? 25);
      setMBio(member.bio || '');
      setMTeamIds(member.countryTeamIds || []);
    } else {
      setEditingMember(null);
      setMFullName('');
      setMEmail('');
      setMJobTitle('Destination Admissions Consultant');
      setMRole('consultant');
      setMStatus('active');
      setMPhone('');
      setMOffice('');
      setMTimezone('Europe/London (UTC+0)');
      setMLanguages('English');
      setMSpecs('');
      setMMaxDossiers(25);
      setMBio('');
      setMTeamIds(countryTeams[0] ? [countryTeams[0].id] : []);
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
      timezone: mTimezone.trim(),
      languages: mLanguages
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
      specializations: mSpecs
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
      maxActiveDossiers: Number(mMaxDossiers) || 25,
      bio: mBio.trim(),
      countryTeamIds: mTeamIds,
    };

    if (editingMember) {
      await onUpdateMember(editingMember.id, payload);
    } else {
      await onCreateMember(payload);
    }
    setIsMemberModalOpen(false);
  };

  const openDeskModal = (desk?: CountryTeam) => {
    if (desk) {
      setEditingDesk(desk);
      setDName(desk.name);
      setDCode(desk.code);
      setDCountries(desk.countries.join(', '));
      setDLeadId(desk.leadUserId || '');
      setDIntakeFocus(desk.intakeFocus || '');
      setDDesc(desk.description || '');
      setDMemberIds(
        members.filter((m) => (m.countryTeamIds || []).includes(desk.id)).map((m) => m.id)
      );
    } else {
      setEditingDesk(null);
      setDName('');
      setDCode('');
      setDCountries('');
      setDLeadId(members[0]?.id || '');
      setDIntakeFocus('Fall & Spring intakes');
      setDDesc('');
      setDMemberIds([]);
    }
    setIsDeskModalOpen(true);
  };

  const handleSaveDesk = async (e: React.FormEvent) => {
    e.preventDefault();
    const countries = dCountries
      .split(',')
      .map((c) => c.trim())
      .filter(Boolean);
    const payload = {
      name: dName.trim(),
      code: dCode.trim().toUpperCase(),
      countries,
      leadUserId: dLeadId || undefined,
      intakeFocus: dIntakeFocus.trim(),
      description: dDesc.trim(),
      memberIds: dMemberIds,
    };
    if (editingDesk) {
      await onUpdateCountryTeam(editingDesk.id, payload);
    } else {
      await onCreateCountryTeam(payload);
    }
    setIsDeskModalOpen(false);
  };

  // Filtered desks & members
  const filteredDesks = countryTeams.filter((t) => {
    if (countryFilter !== 'all' && !t.countries.includes(countryFilter)) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const deskMembers = members.filter((m) => (m.countryTeamIds || []).includes(t.id));
      const matchName =
        t.name.toLowerCase().includes(q) ||
        t.code.toLowerCase().includes(q) ||
        t.countries.some((c) => c.toLowerCase().includes(q)) ||
        deskMembers.some((m) => m.fullName.toLowerCase().includes(q));
      if (!matchName) return false;
    }
    return true;
  });

  const filteredMembers = members.filter((m) => {
    if (roleFilter !== 'all' && m.role !== roleFilter) return false;
    if (countryFilter !== 'all') {
      const memberCountries = m.assignedCountries || [];
      const memberTeamCountries = countryTeams
        .filter((t) => (m.countryTeamIds || []).includes(t.id))
        .flatMap((t) => t.countries);
      if (!memberCountries.includes(countryFilter) && !memberTeamCountries.includes(countryFilter)) {
        return false;
      }
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const hay = `${m.fullName} ${m.email} ${m.jobTitle || ''} ${m.officeLocation || ''} ${(
        m.specializations || []
      ).join(' ')}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  const selectedMember =
    members.find((m) => m.id === selectedMemberId) || filteredMembers[0] || members[0] || null;

  const selectedMemberDossiers = selectedMember
    ? activeCandidates.filter((c) => c.assignedConsultantId === selectedMember.id)
    : [];

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-[28px] leading-[1.15] font-medium text-ink-primary tracking-[-0.015em]">
            Team & country desks
          </h1>
          <p className="text-sm text-ink-secondary mt-1.5">
            Country-wise admissions desks, consultant profiles, specializations, and dossier workload routing
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <button type="button" onClick={() => openDeskModal()} className="btn-secondary">
            <Globe className="w-4 h-4 text-ink-muted" strokeWidth={1.5} />
            <span>New country desk</span>
          </button>
          <button type="button" onClick={() => openMemberModal()} className="btn-primary">
            <UserPlus className="w-4 h-4 text-[#141415]" strokeWidth={1.5} />
            <span>Add teammate</span>
          </button>
        </div>
      </div>

      {/* 4 Compact Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 rounded-xl bg-surface-card border border-hairline flex flex-col justify-between min-h-[108px]">
          <span className="text-xs text-ink-muted">Teammates</span>
          <div className="mt-3">
            <p className="text-[28px] leading-none font-medium tabular-nums text-ink-primary">
              {members.length}
            </p>
            <p className="text-xs text-ink-secondary mt-2 tabular-nums">
              {members.filter((m) => (m.status || 'active') === 'active').length} active in workspace
            </p>
          </div>
        </div>

        <div className="p-5 rounded-xl bg-surface-card border border-hairline flex flex-col justify-between min-h-[108px]">
          <span className="text-xs text-ink-muted">Country desks</span>
          <div className="mt-3">
            <p className="text-[28px] leading-none font-medium tabular-nums text-brass">
              {countryTeams.length}
            </p>
            <p className="text-xs text-ink-secondary mt-2 tabular-nums">
              {allCountries.length} destination countries covered
            </p>
          </div>
        </div>

        <div className="p-5 rounded-xl bg-surface-card border border-hairline flex flex-col justify-between min-h-[108px]">
          <span className="text-xs text-ink-muted">Assigned dossiers</span>
          <div className="mt-3">
            <p className="text-[28px] leading-none font-medium tabular-nums text-ink-primary">
              {assignedCandidatesCount}
            </p>
            <p className="text-xs text-ink-secondary mt-2 tabular-nums">
              {unassignedCount === 0 ? 'All active dossiers assigned' : `${unassignedCount} awaiting assignment`}
            </p>
          </div>
        </div>

        <div className="p-5 rounded-xl bg-surface-card border border-hairline flex flex-col justify-between min-h-[108px]">
          <span className="text-xs text-ink-muted">Desk utilization</span>
          <div className="mt-3">
            <p className="text-[28px] leading-none font-medium tabular-nums text-ink-primary">
              {utilizationPct}%
            </p>
            <p className="text-xs text-ink-secondary mt-2 tabular-nums">
              {assignedCandidatesCount} of {totalCapacity} dossier slots
            </p>
          </div>
        </div>
      </div>

      {/* View Switcher + Search & Country Filter */}
      <div className="p-3 rounded-xl bg-surface-card border border-hairline flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setSubView('desks')}
            className={`h-8 px-3 rounded-lg text-xs inline-flex items-center gap-2 focus:outline-none transition-colors duration-150 ease-quart ${
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
            className={`h-8 px-3 rounded-lg text-xs inline-flex items-center gap-2 focus:outline-none transition-colors duration-150 ease-quart ${
              subView === 'directory'
                ? 'bg-surface-raised border border-hairline-strong text-ink-primary font-medium'
                : 'text-ink-secondary hover:text-ink-primary border border-transparent'
            }`}
          >
            <Users className="w-4 h-4 text-ink-muted" strokeWidth={1.5} />
            <span>Teammate profiles ({members.length})</span>
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <div className="relative w-full sm:w-60">
            <Search
              className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted pointer-events-none"
              strokeWidth={1.5}
            />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search desks, countries, or staff"
              className="field-input pl-9 h-8 text-xs"
            />
          </div>

          <select
            value={countryFilter}
            onChange={(e) => setCountryFilter(e.target.value)}
            className="field-input h-8 text-xs w-auto min-w-[152px]"
          >
            <option value="all">All countries</option>
            {allCountries.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>

          {subView === 'directory' && (
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="field-input h-8 text-xs w-auto min-w-[136px]"
            >
              <option value="all">All roles</option>
              <option value="org_admin">Org admin</option>
              <option value="manager">Desk lead</option>
              <option value="consultant">Consultant</option>
              <option value="reviewer">Reviewer</option>
            </select>
          )}
        </div>
      </div>

      {/* ================================================================= */}
      {/* SUBVIEW 1: COUNTRY DESKS (Country-wise Teams & Teammate Assignment) */}
      {/* ================================================================= */}
      {subView === 'desks' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {filteredDesks.map((desk) => {
            const deskMembers = members.filter((m) => (m.countryTeamIds || []).includes(desk.id));
            const availableToAdd = members.filter((m) => !(m.countryTeamIds || []).includes(desk.id));
            const lead = members.find((m) => m.id === desk.leadUserId);
            const deskDossiers = activeCandidates.filter(
              (c) =>
                c.countryTeamId === desk.id ||
                (c.targetCountries || c.additional?.preferredCountries || []).some((tc) =>
                  desk.countries.includes(tc)
                )
            );
            const selectedAddUserId = deskAddSelection[desk.id] || availableToAdd[0]?.id || '';

            return (
              <div
                key={desk.id}
                className="rounded-xl bg-surface-card border border-hairline flex flex-col justify-between overflow-hidden"
              >
                {/* Desk Header */}
                <div>
                  <div className="px-5 py-4 border-b border-hairline flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2.5">
                        <span className="px-2 py-0.5 rounded bg-surface-deep border border-brass-border font-mono text-xs text-brass">
                          {desk.code}
                        </span>
                        <h3 className="text-base font-medium text-ink-primary truncate">{desk.name}</h3>
                      </div>
                      {desk.description && (
                        <p className="text-xs text-ink-secondary mt-1.5 leading-relaxed">{desk.description}</p>
                      )}
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => openDeskModal(desk)}
                        className="h-8 w-8 rounded-lg text-ink-muted hover:text-ink-primary hover:bg-surface-raised inline-flex items-center justify-center transition-colors duration-150 ease-quart"
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
                        className="h-8 w-8 rounded-lg text-ink-muted hover:text-tone-negative hover:bg-surface-raised inline-flex items-center justify-center transition-colors duration-150 ease-quart"
                        title="Delete country desk"
                      >
                        <Trash2 className="w-4 h-4" strokeWidth={1.5} />
                      </button>
                    </div>
                  </div>

                  {/* Destination Countries & Meta */}
                  <div className="px-5 py-3 bg-surface-deep/40 border-b border-hairline flex flex-wrap items-center justify-between gap-2 text-xs">
                    <div className="flex flex-wrap items-center gap-1.5">
                      {desk.countries.map((country) => (
                        <span
                          key={country}
                          className="px-2 py-0.5 rounded bg-surface-raised border border-hairline text-ink-primary"
                        >
                          {country}
                        </span>
                      ))}
                    </div>
                    <div className="font-mono text-ink-muted tabular-nums">
                      {deskDossiers.length} {deskDossiers.length === 1 ? 'dossier' : 'dossiers'}
                      {lead ? ` · Lead ${lead.fullName.split(' ')[0]}` : ''}
                    </div>
                  </div>

                  {/* Assigned Teammates Roster */}
                  <div className="p-5 space-y-2.5">
                    <div className="flex items-center justify-between text-xs text-ink-muted">
                      <span>Assigned desk teammates ({deskMembers.length})</span>
                      {desk.intakeFocus && <span>{desk.intakeFocus}</span>}
                    </div>

                    {deskMembers.length === 0 ? (
                      <p className="py-4 text-center text-xs text-ink-muted bg-surface-deep rounded-lg border border-hairline">
                        No teammates assigned to this country desk yet
                      </p>
                    ) : (
                      <div className="divide-y divide-[rgba(237,237,237,0.06)] rounded-lg bg-surface-deep border border-hairline">
                        {deskMembers.map((member) => {
                          const load = activeCandidates.filter(
                            (c) => c.assignedConsultantId === member.id
                          ).length;
                          const isLead = desk.leadUserId === member.id;
                          return (
                            <div
                              key={member.id}
                              className="px-3.5 py-2.5 flex items-center justify-between gap-3"
                            >
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedMemberId(member.id);
                                  setSubView('directory');
                                }}
                                className="flex items-center gap-2.5 min-w-0 text-left hover:opacity-90"
                              >
                                <span className="w-7 h-7 rounded bg-surface-raised border border-hairline font-mono text-xs text-ink-secondary flex items-center justify-center shrink-0">
                                  {initialsOf(member.fullName)}
                                </span>
                                <div className="min-w-0">
                                  <span className="text-[13px] font-medium text-ink-primary truncate block">
                                    {member.fullName}
                                    {isLead && (
                                      <span className="ml-2 font-mono text-xs text-brass font-normal">
                                        lead
                                      </span>
                                    )}
                                  </span>
                                  <span className="text-xs text-ink-muted truncate block">
                                    {ROLE_LABELS[member.role]}
                                    {member.officeLocation ? ` · ${member.officeLocation}` : ''}
                                  </span>
                                </div>
                              </button>

                              <div className="flex items-center gap-2.5 shrink-0">
                                <span className="font-mono text-xs tabular-nums text-ink-secondary">
                                  {load}/{member.maxActiveDossiers || 25}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => onToggleDeskMember(desk.id, member.id, 'remove')}
                                  className="h-6 w-6 rounded text-ink-muted hover:text-tone-negative hover:bg-surface-raised inline-flex items-center justify-center transition-colors duration-150 ease-quart"
                                  title={`Remove ${member.fullName} from ${desk.name}`}
                                >
                                  <X className="w-3.5 h-3.5" strokeWidth={1.5} />
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>

                {/* Inline Add Teammate to Country Desk */}
                <div className="px-5 py-3.5 border-t border-hairline bg-surface-deep/40 flex items-center gap-2">
                  {availableToAdd.length === 0 ? (
                    <span className="text-xs text-ink-muted">
                      All workspace teammates are assigned to this desk
                    </span>
                  ) : (
                    <>
                      <select
                        value={selectedAddUserId}
                        onChange={(e) =>
                          setDeskAddSelection((prev) => ({ ...prev, [desk.id]: e.target.value }))
                        }
                        className="field-input h-8 text-xs flex-1"
                      >
                        {availableToAdd.map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.fullName} ({ROLE_LABELS[m.role]})
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={() => {
                          const uid = selectedAddUserId || availableToAdd[0]?.id;
                          if (uid) {
                            onToggleDeskMember(desk.id, uid, 'add');
                          }
                        }}
                        className="btn-secondary h-8 px-3 text-xs shrink-0"
                      >
                        <Plus className="w-4 h-4 text-ink-muted" strokeWidth={1.5} />
                        <span>Add to desk</span>
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ================================================================= */}
      {/* SUBVIEW 2: TEAMMATE DIRECTORY & SELECTED PROFILE INSPECTOR        */}
      {/* ================================================================= */}
      {subView === 'directory' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left 7 Cols: Directory Table */}
          <div className="lg:col-span-7 bg-surface-card border border-hairline rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-hairline text-xs text-ink-muted">
                    <th className="py-3 px-5 font-normal">Teammate</th>
                    <th className="py-3 px-3 font-normal">Role</th>
                    <th className="py-3 px-3 font-normal">Country desks</th>
                    <th className="py-3 px-3 font-normal text-right">Load</th>
                    <th className="py-3 px-5 font-normal text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[rgba(237,237,237,0.06)] text-[13px]">
                  {filteredMembers.map((m) => {
                    const isSelected = selectedMember?.id === m.id;
                    const load = activeCandidates.filter((c) => c.assignedConsultantId === m.id).length;
                    const memberDesks = countryTeams.filter((t) => (m.countryTeamIds || []).includes(t.id));
                    const st = STATUS_META[m.status || 'active'];

                    return (
                      <tr
                        key={m.id}
                        onClick={() => setSelectedMemberId(m.id)}
                        className={`cursor-pointer transition-colors duration-150 ease-quart ${
                          isSelected
                            ? 'bg-surface-raised shadow-[inset_2px_0_0_#d4a853]'
                            : 'hover:bg-surface-raised/40'
                        }`}
                      >
                        <td className="py-3.5 px-5">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-md bg-surface-deep border border-hairline font-mono text-xs text-ink-secondary flex items-center justify-center shrink-0">
                              {initialsOf(m.fullName)}
                            </div>
                            <div className="min-w-0">
                              <p className="font-medium text-ink-primary truncate">
                                {m.fullName}
                                {m.id === currentUserId && (
                                  <span className="ml-1.5 font-mono text-xs text-brass font-normal">you</span>
                                )}
                              </p>
                              <p className="text-xs text-ink-muted truncate">
                                {m.jobTitle || m.email}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="py-3.5 px-3 text-ink-secondary whitespace-nowrap">
                          {ROLE_LABELS[m.role]}
                        </td>
                        <td className="py-3.5 px-3">
                          <div className="flex flex-wrap gap-1">
                            {memberDesks.length > 0 ? (
                              memberDesks.map((d) => (
                                <span
                                  key={d.id}
                                  className="px-1.5 py-0.5 rounded bg-surface-deep border border-hairline font-mono text-xs text-ink-secondary whitespace-nowrap shrink-0"
                                >
                                  {d.code}
                                </span>
                              ))
                            ) : (
                              <span className="text-xs text-ink-muted">—</span>
                            )}
                          </div>
                        </td>
                        <td className="py-3.5 px-3 text-right font-mono text-xs tabular-nums text-ink-primary">
                          {load}/{m.maxActiveDossiers || 25}
                        </td>
                        <td className="py-3.5 px-5 text-right">
                          <VerificationStamp tone={st.tone} label={st.label} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Right 5 Cols: Selected Teammate Full Profile Card */}
          {selectedMember && (
            <div className="lg:col-span-5 rounded-xl bg-surface-card border border-hairline overflow-hidden">
              <div className="p-5 border-b border-hairline flex items-start justify-between gap-3">
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className="w-11 h-11 rounded-lg bg-surface-deep border border-brass-border font-mono text-sm font-medium text-brass flex items-center justify-center shrink-0">
                    {initialsOf(selectedMember.fullName)}
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-base font-medium text-ink-primary truncate">
                      {selectedMember.fullName}
                    </h3>
                    <p className="text-xs text-ink-secondary truncate mt-0.5">
                      {selectedMember.jobTitle || ROLE_LABELS[selectedMember.role]}
                    </p>
                    <div className="mt-1.5">
                      <VerificationStamp
                        tone={STATUS_META[selectedMember.status || 'active'].tone}
                        label={ROLE_LABELS[selectedMember.role]}
                        meta={STATUS_META[selectedMember.status || 'active'].label}
                      />
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => openMemberModal(selectedMember)}
                    className="btn-secondary h-8 px-3 text-xs"
                  >
                    Edit
                  </button>
                  {selectedMember.id !== currentUserId && (
                    <button
                      type="button"
                      onClick={() => {
                        if (window.confirm(`Remove ${selectedMember.fullName} from workspace?`)) {
                          onDeleteMember(selectedMember.id);
                        }
                      }}
                      className="h-8 w-8 rounded-lg bg-surface-raised border border-hairline text-ink-muted hover:text-tone-negative inline-flex items-center justify-center transition-colors duration-150 ease-quart"
                      title="Remove teammate"
                    >
                      <Trash2 className="w-4 h-4" strokeWidth={1.5} />
                    </button>
                  )}
                </div>
              </div>

              <div className="p-5 space-y-5 text-xs">
                {selectedMember.bio && (
                  <p className="text-[13px] text-ink-secondary leading-relaxed">{selectedMember.bio}</p>
                )}

                {/* Contact & Office Metadata */}
                <div className="grid grid-cols-2 gap-3.5 p-4 rounded-lg bg-surface-deep border border-hairline">
                  <div>
                    <span className="block text-ink-muted">Email</span>
                    <span className="block text-ink-primary mt-0.5 truncate">{selectedMember.email}</span>
                  </div>
                  <div>
                    <span className="block text-ink-muted">Direct phone</span>
                    <span className="block font-mono text-ink-primary mt-0.5">
                      {selectedMember.phone || '—'}
                    </span>
                  </div>
                  <div>
                    <span className="block text-ink-muted">Office</span>
                    <span className="block text-ink-primary mt-0.5">
                      {selectedMember.officeLocation || '—'}
                    </span>
                  </div>
                  <div>
                    <span className="block text-ink-muted">Timezone</span>
                    <span className="block font-mono text-ink-secondary mt-0.5 truncate">
                      {selectedMember.timezone || 'UTC'}
                    </span>
                  </div>
                  <div>
                    <span className="block text-ink-muted">Languages</span>
                    <span className="block text-ink-primary mt-0.5">
                      {(selectedMember.languages || ['English']).join(', ')}
                    </span>
                  </div>
                  <div>
                    <span className="block text-ink-muted">Active capacity</span>
                    <span className="block font-mono tabular-nums text-brass mt-0.5">
                      {selectedMemberDossiers.length} / {selectedMember.maxActiveDossiers || 25} dossiers
                    </span>
                  </div>
                </div>

                {/* Specializations */}
                {(selectedMember.specializations || []).length > 0 && (
                  <div>
                    <span className="block text-ink-muted mb-2">Specializations</span>
                    <div className="flex flex-wrap gap-1.5">
                      {(selectedMember.specializations || []).map((sp) => (
                        <span
                          key={sp}
                          className="px-2.5 py-1 rounded-md bg-surface-deep border border-hairline text-ink-secondary"
                        >
                          {sp}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Country Desk Assignments — One-click toggle */}
                <div>
                  <span className="block text-ink-muted mb-2">Country desk memberships</span>
                  <div className="space-y-1.5">
                    {countryTeams.map((desk) => {
                      const inDesk = (selectedMember.countryTeamIds || []).includes(desk.id);
                      return (
                        <label
                          key={desk.id}
                          className={`px-3 py-2 rounded-lg border flex items-center justify-between cursor-pointer transition-colors duration-150 ease-quart ${
                            inDesk
                              ? 'bg-surface-raised border-brass-border text-ink-primary'
                              : 'bg-surface-deep border-hairline text-ink-secondary hover:border-hairline-strong'
                          }`}
                        >
                          <span className="flex items-center gap-2.5 min-w-0">
                            <input
                              type="checkbox"
                              checked={inDesk}
                              onChange={() =>
                                onToggleDeskMember(desk.id, selectedMember.id, inDesk ? 'remove' : 'add')
                              }
                              className="w-4 h-4 rounded accent-[#d4a853]"
                            />
                            <span className="font-mono text-brass whitespace-nowrap shrink-0">{desk.code}</span>
                            <span className="truncate">{desk.name}</span>
                          </span>
                          <span className="text-ink-muted shrink-0 ml-2">
                            {desk.countries.join(', ')}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </div>

                {/* Assigned Candidate Dossiers + Quick Assign */}
                <div className="pt-2 border-t border-hairline space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-ink-muted">
                      Assigned candidate dossiers ({selectedMemberDossiers.length})
                    </span>
                  </div>

                  {selectedMemberDossiers.length > 0 && (
                    <div className="space-y-1.5">
                      {selectedMemberDossiers.map((cand) => (
                        <div
                          key={cand.id}
                          className="px-3 py-2 rounded-lg bg-surface-deep border border-hairline flex items-center justify-between gap-2"
                        >
                          <div className="min-w-0">
                            <p className="text-ink-primary font-medium truncate">
                              {cand.personal.legalGivenName} {cand.personal.familyName}
                            </p>
                            <p className="text-ink-muted truncate">
                              {cand.personal.nationality}
                              {(cand.targetCountries || []).length > 0
                                ? ` → ${(cand.targetCountries || []).join(', ')}`
                                : ''}
                            </p>
                          </div>
                          {onSelectCandidateDossier && (
                            <button
                              type="button"
                              onClick={() => onSelectCandidateDossier(cand)}
                              className="text-brass hover:underline inline-flex items-center gap-1 shrink-0"
                            >
                              <FolderOpen className="w-3.5 h-3.5" strokeWidth={1.5} />
                              <span>Open</span>
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Assign another candidate to this teammate */}
                  {activeCandidates.some((c) => c.assignedConsultantId !== selectedMember.id) && (
                    <div className="flex items-center gap-2 pt-1">
                      <select
                        value={candidateToAssign}
                        onChange={(e) => setCandidateToAssign(e.target.value)}
                        className="field-input h-8 text-xs flex-1"
                      >
                        <option value="">Assign candidate dossier...</option>
                        {activeCandidates
                          .filter((c) => c.assignedConsultantId !== selectedMember.id)
                          .map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.personal.legalGivenName} {c.personal.familyName} ({c.personal.nationality})
                            </option>
                          ))}
                      </select>
                      <button
                        type="button"
                        disabled={!candidateToAssign}
                        onClick={async () => {
                          if (!candidateToAssign) return;
                          await onAssignCandidate(candidateToAssign, {
                            assignedConsultantId: selectedMember.id,
                            countryTeamId: selectedMember.countryTeamIds?.[0],
                          });
                          setCandidateToAssign('');
                        }}
                        className="btn-secondary h-8 px-3 text-xs shrink-0"
                      >
                        Assign
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ================================================================= */}
      {/* ADD / EDIT TEAMMATE MODAL                                         */}
      {/* ================================================================= */}
      {isMemberModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4">
          <div className="bg-surface-card border border-hairline-strong rounded-2xl w-full max-w-xl overflow-hidden">
            <div className="h-14 px-6 border-b border-hairline flex items-center justify-between">
              <h3 className="text-base font-medium text-ink-primary">
                {editingMember ? `Edit profile · ${editingMember.fullName}` : 'Add agency teammate'}
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
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-ink-secondary mb-1.5">Full name *</label>
                  <input
                    required
                    value={mFullName}
                    onChange={(e) => setMFullName(e.target.value)}
                    placeholder="Omar Farooq"
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
                    placeholder="omar.f@globaledu.com"
                    className="field-input"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs text-ink-secondary mb-1.5">Job title</label>
                  <input
                    value={mJobTitle}
                    onChange={(e) => setMJobTitle(e.target.value)}
                    placeholder="UK Admissions Specialist"
                    className="field-input"
                  />
                </div>
                <div>
                  <label className="block text-xs text-ink-secondary mb-1.5">Access role</label>
                  <select
                    value={mRole}
                    onChange={(e) => setMRole(e.target.value as UserRole)}
                    className="field-input"
                  >
                    <option value="org_admin">Org admin</option>
                    <option value="manager">Desk lead / manager</option>
                    <option value="consultant">Consultant</option>
                    <option value="reviewer">Document reviewer</option>
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
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs text-ink-secondary mb-1.5">Phone</label>
                  <input
                    value={mPhone}
                    onChange={(e) => setMPhone(e.target.value)}
                    placeholder="+44 20 7946 0899"
                    className="field-input font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs text-ink-secondary mb-1.5">Office location</label>
                  <input
                    value={mOffice}
                    onChange={(e) => setMOffice(e.target.value)}
                    placeholder="Lahore, Pakistan"
                    className="field-input"
                  />
                </div>
                <div>
                  <label className="block text-xs text-ink-secondary mb-1.5">Max dossier capacity</label>
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

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-ink-secondary mb-1.5">Timezone</label>
                  <input
                    value={mTimezone}
                    onChange={(e) => setMTimezone(e.target.value)}
                    placeholder="Asia/Karachi (UTC+5)"
                    className="field-input font-mono text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs text-ink-secondary mb-1.5">Languages (comma-separated)</label>
                  <input
                    value={mLanguages}
                    onChange={(e) => setMLanguages(e.target.value)}
                    placeholder="English, Urdu"
                    className="field-input"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs text-ink-secondary mb-1.5">
                  Specializations (comma-separated)
                </label>
                <input
                  value={mSpecs}
                  onChange={(e) => setMSpecs(e.target.value)}
                  placeholder="Russell Group, UCAS, STEM Scholarships"
                  className="field-input"
                />
              </div>

              {/* Assign to Country Desks */}
              <div>
                <label className="block text-xs text-ink-secondary mb-2">
                  Assign to country desks
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {countryTeams.map((desk) => {
                    const checked = mTeamIds.includes(desk.id);
                    return (
                      <label
                        key={desk.id}
                        className={`px-3 py-2 rounded-lg border text-xs flex items-center gap-2.5 cursor-pointer ${
                          checked
                            ? 'bg-surface-raised border-brass-border text-ink-primary'
                            : 'bg-surface-deep border-hairline text-ink-secondary'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() =>
                            setMTeamIds((prev) =>
                              checked ? prev.filter((id) => id !== desk.id) : [...prev, desk.id]
                            )
                          }
                          className="w-4 h-4 rounded accent-[#d4a853]"
                        />
                        <span className="font-mono text-brass">{desk.code}</span>
                        <span className="truncate">{desk.name}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block text-xs text-ink-secondary mb-1.5">Profile bio / scope notes</label>
                <textarea
                  rows={2}
                  value={mBio}
                  onChange={(e) => setMBio(e.target.value)}
                  className="field-input h-auto py-2"
                />
              </div>

              <div className="pt-3 border-t border-hairline flex justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsMemberModalOpen(false)}
                  className="btn-secondary"
                >
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
                  {editingMember ? 'Save teammate' : 'Add teammate'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================================================================= */}
      {/* CREATE / EDIT COUNTRY DESK MODAL                                  */}
      {/* ================================================================= */}
      {isDeskModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4">
          <div className="bg-surface-card border border-hairline-strong rounded-2xl w-full max-w-lg overflow-hidden">
            <div className="h-14 px-6 border-b border-hairline flex items-center justify-between">
              <h3 className="text-base font-medium text-ink-primary">
                {editingDesk ? `Edit ${editingDesk.name}` : 'New country admissions desk'}
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
              <div className="grid grid-cols-3 gap-4">
                <div className="col-span-2">
                  <label className="block text-xs text-ink-secondary mb-1.5">Desk name *</label>
                  <input
                    required
                    value={dName}
                    onChange={(e) => setDName(e.target.value)}
                    placeholder="Nordics & Benelux Desk"
                    className="field-input"
                  />
                </div>
                <div>
                  <label className="block text-xs text-ink-secondary mb-1.5">Desk code *</label>
                  <input
                    required
                    maxLength={8}
                    value={dCode}
                    onChange={(e) => setDCode(e.target.value.toUpperCase())}
                    placeholder="NORD"
                    className="field-input font-mono uppercase"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs text-ink-secondary mb-1.5">
                  Destination countries (comma-separated) *
                </label>
                <input
                  required
                  value={dCountries}
                  onChange={(e) => setDCountries(e.target.value)}
                  placeholder="Sweden, Finland, Denmark"
                  className="field-input"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
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
                        {m.fullName} ({ROLE_LABELS[m.role]})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-ink-secondary mb-1.5">Intake focus</label>
                  <input
                    value={dIntakeFocus}
                    onChange={(e) => setDIntakeFocus(e.target.value)}
                    placeholder="Autumn & Spring intakes"
                    className="field-input"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs text-ink-secondary mb-1.5">Portal & compliance scope</label>
                <textarea
                  rows={2}
                  value={dDesc}
                  onChange={(e) => setDDesc(e.target.value)}
                  placeholder="UniversityAdmissions.se, Studielink, and residence permit checklists"
                  className="field-input h-auto py-2"
                />
              </div>

              <div>
                <label className="block text-xs text-ink-secondary mb-2">
                  Teammates assigned to this desk
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-40 overflow-y-auto">
                  {members.map((m) => {
                    const checked = dMemberIds.includes(m.id);
                    return (
                      <label
                        key={m.id}
                        className={`px-3 py-2 rounded-lg border text-xs flex items-center gap-2.5 cursor-pointer ${
                          checked
                            ? 'bg-surface-raised border-brass-border text-ink-primary'
                            : 'bg-surface-deep border-hairline text-ink-secondary'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() =>
                            setDMemberIds((prev) =>
                              checked ? prev.filter((id) => id !== m.id) : [...prev, m.id]
                            )
                          }
                          className="w-4 h-4 rounded accent-[#d4a853]"
                        />
                        <span className="truncate">{m.fullName}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="pt-3 border-t border-hairline flex justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsDeskModalOpen(false)}
                  className="btn-secondary"
                >
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
                  {editingDesk ? 'Save country desk' : 'Create country desk'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
