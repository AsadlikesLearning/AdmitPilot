import React, { useState, useEffect } from 'react';
import {
  Plus,
  ExternalLink,
  Calendar,
  X,
  LayoutGrid,
  List,
  Search,
  KeyRound,
  Copy,
  Check,
  Download,
  Trash2,
  FileCheck2,
  Clock,
  Send,
  Building2,
  Sparkles,
  CheckCircle2,
} from 'lucide-react';
import {
  ApplicationRecord,
  CandidateProfile,
  ApplicationStatus,
  CandidateDocument,
  CandidatePortalCredential,
  CountryTeam,
  ApplicationPriority,
  ApplicationFeeStatus,
  ScholarshipStatus,
  CasStatus,
  VisaStatus,
  CommissionStatus,
  DocumentCategory,
  UniversityCatalogItem,
  evaluateEligibility,
} from 'admitpilot-shared';
import { VerificationStamp, StampTone } from './ui/Primitives';
import { api } from '../api';

interface AppTrackerProps {
  applications: ApplicationRecord[];
  candidates: CandidateProfile[];
  countryTeams?: CountryTeam[];
  universities?: UniversityCatalogItem[];
  isOrgAdmin?: boolean;
  onCreateApplication: (app: Partial<ApplicationRecord>) => Promise<void>;
  onBatchCreateApplications?: (payload: {
    candidateId: string;
    items: Array<{
      institutionName: string;
      programName: string;
      degreeLevel?: ApplicationRecord['degreeLevel'];
      country: string;
      intake?: string;
      deadline?: string;
      portalUrl?: string;
      applicationFee?: string;
      tuitionFee?: string;
      requiredDocs?: DocumentCategory[];
    }>;
  }) => Promise<void>;
  onCreateUniversity?: (
    uni: Partial<UniversityCatalogItem> & { name: string; country: string }
  ) => Promise<void>;
  onUpdateApplication: (
    appId: string,
    updates: Partial<ApplicationRecord> & { newTimelineNote?: string; newTimelineType?: string }
  ) => Promise<ApplicationRecord>;
  onDeleteApplication?: (appId: string) => Promise<void>;
}

const STATUS_META: Record<ApplicationStatus, { label: string; tone: StampTone }> = {
  draft: { label: 'Draft', tone: 'neutral' },
  preparing_documents: { label: 'Preparing docs', tone: 'brass' },
  ready_for_review: { label: 'Ready for review', tone: 'brass' },
  in_progress: { label: 'In portal', tone: 'brass' },
  submitted: { label: 'Submitted', tone: 'positive' },
  under_review: { label: 'Faculty review', tone: 'brass' },
  conditional_offer: { label: 'Conditional offer', tone: 'positive' },
  unconditional_offer: { label: 'Unconditional offer', tone: 'positive' },
  rejected: { label: 'Rejected', tone: 'negative' },
  withdrawn: { label: 'Withdrawn', tone: 'neutral' },
  enrolled: { label: 'Enrolled', tone: 'positive' },
};

const BOARD_COLUMNS: Array<{
  id: string;
  title: string;
  statuses: ApplicationStatus[];
}> = [
  {
    id: 'prep',
    title: 'Preparation & audit',
    statuses: ['draft', 'preparing_documents', 'ready_for_review'],
  },
  {
    id: 'portal',
    title: 'Active in portal',
    statuses: ['in_progress'],
  },
  {
    id: 'submitted',
    title: 'Submitted & under review',
    statuses: ['submitted', 'under_review'],
  },
  {
    id: 'offers',
    title: 'Offers & enrolment',
    statuses: ['conditional_offer', 'unconditional_offer', 'enrolled'],
  },
  {
    id: 'closed',
    title: 'Closed',
    statuses: ['rejected', 'withdrawn'],
  },
];

export const ApplicationTracker: React.FC<AppTrackerProps> = ({
  applications,
  candidates,
  countryTeams = [],
  universities = [],
  isOrgAdmin = false,
  onCreateApplication,
  onBatchCreateApplications,
  onCreateUniversity,
  onUpdateApplication,
  onDeleteApplication,
}) => {
  const [viewMode, setViewMode] = useState<'board' | 'table' | 'universities'>('board');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCountry, setFilterCountry] = useState('all');
  const [filterPriority, setFilterPriority] = useState('all');
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isShortlistOpen, setIsShortlistOpen] = useState(false);
  const [isAddUniOpen, setIsAddUniOpen] = useState(false);
  const [selectedAppId, setSelectedAppId] = useState<string | null>(null);

  // Shortlist & Catalog state
  const [shortlistCandidateId, setShortlistCandidateId] = useState(candidates[0]?.id || '');
  const [shortlistSelectedKeys, setShortlistSelectedKeys] = useState<string[]>([]);
  const [shortlistBusy, setShortlistBusy] = useState(false);
  const [selectedCatalogUniId, setSelectedCatalogUniId] = useState('');
  const [selectedCatalogProgId, setSelectedCatalogProgId] = useState('');
  const [showAdvancedCreate, setShowAdvancedCreate] = useState(false);

  // Custom University state
  const [uName, setUName] = useState('');
  const [uCountry, setUCountry] = useState('United Kingdom');
  const [uCity, setUCity] = useState('');
  const [uPortalUrl, setUPortalUrl] = useState('');
  const [uProgName, setUProgName] = useState('');
  const [uProgDegree, setUProgDegree] = useState<ApplicationRecord['degreeLevel']>("Master's");
  const [uProgIntake, setUProgIntake] = useState('September 2027');
  const [uProgDeadline, setUProgDeadline] = useState('2027-05-31');
  const [uProgTuition, setUProgTuition] = useState('');
  const [uProgMinGpa, setUProgMinGpa] = useState('3.0');
  const [uProgMinIelts, setUProgMinIelts] = useState('6.5');

  // Create form state
  const [candidateId, setCandidateId] = useState(candidates[0]?.id || '');
  const [institutionName, setInstitutionName] = useState('');
  const [programName, setProgramName] = useState('');
  const [degreeLevel, setDegreeLevel] = useState<ApplicationRecord['degreeLevel']>("Master's");
  const [campus, setCampus] = useState('');
  const [country, setCountry] = useState('United Kingdom');
  const [intake, setIntake] = useState('September 2027');
  const [priority, setPriority] = useState<ApplicationPriority>('high');
  const [portalUrl, setPortalUrl] = useState('');
  const [referenceNumber, setReferenceNumber] = useState('');
  const [deadline, setDeadline] = useState('2027-03-31');
  const [tuitionFee, setTuitionFee] = useState('');
  const [applicationFee, setApplicationFee] = useState('');
  const [applicationFeeStatus, setApplicationFeeStatus] = useState<ApplicationFeeStatus>('unpaid');
  const [scholarshipName, setScholarshipName] = useState('');
  const [portalCredentialId, setPortalCredentialId] = useState('');
  const [notes, setNotes] = useState('');
  const [createCredOptions, setCreateCredOptions] = useState<CandidatePortalCredential[]>([]);

  // Active drawer candidate credentials & documents
  const selectedApp = applications.find((a) => a.id === selectedAppId) || null;
  const [detailCreds, setDetailCreds] = useState<CandidatePortalCredential[]>([]);
  const [detailDocs, setDetailDocs] = useState<CandidateDocument[]>([]);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [newConditionText, setNewConditionText] = useState('');
  const [newChecklistLabel, setNewChecklistLabel] = useState('');
  const [newChecklistCategory, setNewChecklistCategory] = useState<DocumentCategory>('other');
  const [timelineInput, setTimelineInput] = useState('');

  useEffect(() => {
    if (!candidateId && candidates[0]?.id) {
      setCandidateId(candidates[0].id);
    }
  }, [candidates, candidateId]);

  useEffect(() => {
    if (!isCreateOpen || !candidateId) return;
    api
      .getCredentials(candidateId)
      .then((creds) => {
        setCreateCredOptions(creds);
        const primary = creds.find((c) => c.isPrimaryStudentEmail) || creds[0];
        if (primary) setPortalCredentialId(primary.id);
      })
      .catch(() => setCreateCredOptions([]));
  }, [isCreateOpen, candidateId]);

  useEffect(() => {
    if (!selectedApp) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSelectedAppId(null);
    };
    window.addEventListener('keydown', onKeyDown);
    Promise.all([
      api.getCredentials(selectedApp.candidateId).catch(() => []),
      api.getDocuments(selectedApp.candidateId).catch(() => []),
    ]).then(([creds, docs]) => {
      setDetailCreds(creds);
      setDetailDocs(docs);
    });
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [selectedApp?.id, selectedApp?.candidateId]);

  const copyText = async (val: string, key: string) => {
    try {
      await navigator.clipboard.writeText(val);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey((prev) => (prev === key ? null : prev)), 2000);
    } catch {
      // ignore
    }
  };

  const handleCopyCredPassword = async (candId: string, credId: string) => {
    const res = await api.revealCredential(candId, credId);
    if (res.password) {
      await copyText(res.password, `app-pwd-${credId}`);
    }
  };

  const countriesList = Array.from(new Set(applications.map((a) => a.country).filter(Boolean)));

  const filtered = applications.filter((a) => {
    if (filterCountry !== 'all' && a.country !== filterCountry) return false;
    if (filterPriority !== 'all' && (a.priority || 'medium') !== filterPriority) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const cand = candidates.find((c) => c.id === a.candidateId);
      const candName = cand
        ? `${cand.personal.legalGivenName} ${cand.personal.familyName}`.toLowerCase()
        : '';
      return (
        a.institutionName.toLowerCase().includes(q) ||
        a.programName.toLowerCase().includes(q) ||
        (a.referenceNumber || '').toLowerCase().includes(q) ||
        candName.includes(q)
      );
    }
    return true;
  });

  const offersCount = applications.filter((a) =>
    ['conditional_offer', 'unconditional_offer', 'enrolled'].includes(a.status)
  ).length;
  const activeSubmittedCount = applications.filter((a) =>
    ['in_progress', 'submitted', 'under_review'].includes(a.status)
  ).length;
  const pendingConditionsCount = applications.reduce(
    (sum, a) => sum + (a.offerConditions || []).filter((c) => !c.met).length,
    0
  );

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const matchedDesk = countryTeams.find((t) =>
      t.countries.some((c) => c.toLowerCase() === country.toLowerCase())
    );
    await onCreateApplication({
      candidateId,
      institutionName: institutionName.trim(),
      programName: programName.trim(),
      degreeLevel,
      campus: campus.trim() || undefined,
      country: country.trim(),
      countryTeamId: matchedDesk?.id,
      intake: intake.trim(),
      priority,
      portalUrl: portalUrl.trim() || undefined,
      portalCredentialId: portalCredentialId || undefined,
      referenceNumber: referenceNumber.trim() || undefined,
      deadline: deadline || undefined,
      tuitionFee: tuitionFee.trim() || undefined,
      applicationFee: applicationFee.trim() || undefined,
      applicationFeeStatus,
      scholarshipName: scholarshipName.trim() || undefined,
      scholarshipStatus: scholarshipName.trim() ? 'eligible' : 'none',
      notes: notes.trim() || undefined,
      status: 'preparing_documents',
    });
    setInstitutionName('');
    setProgramName('');
    setCampus('');
    setPortalUrl('');
    setReferenceNumber('');
    setTuitionFee('');
    setApplicationFee('');
    setScholarshipName('');
    setNotes('');
    setIsCreateOpen(false);
  };

  const toggleChecklistItem = async (itemId: string) => {
    if (!selectedApp) return;
    const nextList = (selectedApp.documentChecklist || []).map((item) =>
      item.id === itemId ? { ...item, submitted: !item.submitted } : item
    );
    await onUpdateApplication(selectedApp.id, { documentChecklist: nextList });
  };

  const handleAddChecklistItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedApp || !newChecklistLabel.trim()) return;
    const matchingDoc = detailDocs.find((d) => d.category === newChecklistCategory);
    const nextList = [
      ...(selectedApp.documentChecklist || []),
      {
        id: `chk-${Date.now()}`,
        category: newChecklistCategory,
        label: newChecklistLabel.trim(),
        required: true,
        submitted: Boolean(matchingDoc),
        documentId: matchingDoc?.id,
      },
    ];
    await onUpdateApplication(selectedApp.id, { documentChecklist: nextList });
    setNewChecklistLabel('');
  };

  const toggleOfferCondition = async (condId: string) => {
    if (!selectedApp) return;
    const nextConds = (selectedApp.offerConditions || []).map((c) =>
      c.id === condId ? { ...c, met: !c.met } : c
    );
    await onUpdateApplication(selectedApp.id, { offerConditions: nextConds });
  };

  const handleAddCondition = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedApp || !newConditionText.trim()) return;
    const nextConds = [
      ...(selectedApp.offerConditions || []),
      {
        id: `cond-${Date.now()}`,
        text: newConditionText.trim(),
        met: false,
      },
    ];
    await onUpdateApplication(selectedApp.id, { offerConditions: nextConds });
    setNewConditionText('');
  };

  const handleAddTimelineLog = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedApp || !timelineInput.trim()) return;
    await onUpdateApplication(selectedApp.id, {
      newTimelineNote: timelineInput.trim(),
      newTimelineType: 'note',
    });
    setTimelineInput('');
  };

  const linkedCred = selectedApp
    ? detailCreds.find((c) => c.id === selectedApp.portalCredentialId) ||
      detailCreds.find((c) => c.isPrimaryStudentEmail) ||
      null
    : null;

  return (
    <div className="space-y-5">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-[28px] leading-[1.15] font-medium text-ink-primary tracking-[-0.015em]">
            Admissions pipeline & tracker
          </h1>
          <p className="text-sm text-ink-secondary mt-1.5">
            University portal logins, document checklists, offer conditions, deposits, and CAS / visa milestones
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <div className="inline-flex rounded-lg bg-surface-card border border-hairline p-0.5">
            <button
              type="button"
              onClick={() => setViewMode('board')}
              className={`h-8 px-2.5 rounded-md text-xs inline-flex items-center gap-1.5 transition-colors duration-150 ease-quart ${
                viewMode === 'board'
                  ? 'bg-surface-raised text-ink-primary font-medium'
                  : 'text-ink-muted hover:text-ink-primary'
              }`}
            >
              <LayoutGrid className="w-4 h-4" strokeWidth={1.5} />
              <span>Board</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('table')}
              className={`h-8 px-2.5 rounded-md text-xs inline-flex items-center gap-1.5 transition-colors duration-150 ease-quart ${
                viewMode === 'table'
                  ? 'bg-surface-raised text-ink-primary font-medium'
                  : 'text-ink-muted hover:text-ink-primary'
              }`}
            >
              <List className="w-4 h-4" strokeWidth={1.5} />
              <span>Table</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('universities')}
              className={`h-8 px-2.5 rounded-md text-xs inline-flex items-center gap-1.5 transition-colors duration-150 ease-quart ${
                viewMode === 'universities'
                  ? 'bg-surface-raised text-ink-primary font-medium'
                  : 'text-ink-muted hover:text-ink-primary'
              }`}
            >
              <Building2 className="w-4 h-4" strokeWidth={1.5} />
              <span>By university</span>
            </button>
          </div>

          {onBatchCreateApplications && (
            <button
              type="button"
              onClick={() => {
                setShortlistCandidateId(candidates[0]?.id || '');
                setShortlistSelectedKeys([]);
                setIsShortlistOpen(true);
              }}
              className="btn-secondary"
            >
              <Sparkles className="w-4 h-4 text-brass" strokeWidth={1.5} />
              <span>Shortlist universities</span>
            </button>
          )}

          {isOrgAdmin && onCreateUniversity && viewMode === 'universities' && (
            <button
              type="button"
              onClick={() => setIsAddUniOpen(true)}
              className="btn-secondary"
            >
              <Plus className="w-4 h-4 text-ink-muted" strokeWidth={1.5} />
              <span>Add university</span>
            </button>
          )}

          <button type="button" onClick={() => setIsCreateOpen(true)} className="btn-primary">
            <Plus className="w-4 h-4 text-[#141415]" strokeWidth={1.5} />
            <span>New application</span>
          </button>
        </div>
      </div>

      {/* 4-Metric Pipeline Summary Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'Total applications', value: applications.length, sub: `${countriesList.length || 1} destination countries` },
          { label: 'In portal & submitted', value: activeSubmittedCount, sub: 'Awaiting admissions decision' },
          { label: 'Offers & enrolled', value: offersCount, sub: 'Conditional, unconditional & enrolled' },
          { label: 'Open offer conditions', value: pendingConditionsCount, sub: 'Deposits, attestations & CAS checks' },
        ].map((stat) => (
          <div key={stat.label} className="p-4 rounded-xl bg-surface-card border border-hairline">
            <span className="block text-xs text-ink-muted">{stat.label}</span>
            <span className="block font-mono text-2xl font-medium text-ink-primary tabular-nums mt-1">
              {stat.value}
            </span>
            <span className="block text-xs text-ink-secondary mt-1">{stat.sub}</span>
          </div>
        ))}
      </div>

      {/* Filter Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="relative w-full sm:max-w-xs">
          <Search
            className="w-4 h-4 text-ink-muted absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
            strokeWidth={1.5}
          />
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Filter university, program, ref, or student"
            className="field-input pl-9 h-9 text-xs"
          />
        </div>

        <div className="flex items-center gap-2">
          <select
            value={filterCountry}
            onChange={(e) => setFilterCountry(e.target.value)}
            className="field-input h-9 w-auto text-xs"
          >
            <option value="all">All countries</option>
            {countriesList.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>

          <select
            value={filterPriority}
            onChange={(e) => setFilterPriority(e.target.value)}
            className="field-input h-9 w-auto text-xs"
          >
            <option value="all">All priorities</option>
            <option value="high">High priority</option>
            <option value="medium">Medium priority</option>
            <option value="low">Backup / low</option>
          </select>
        </div>
      </div>

      {/* Financial, Deposit & Commission Summary Strip */}
      {applications.length > 0 && (() => {
        const depositsPaid = applications.filter((a) => Boolean(a.depositPaid)).length;
        const depositsPending = applications.filter(
          (a) => Boolean(a.depositAmount) && !a.depositPaid
        ).length;
        const scholarshipsAwarded = applications.filter(
          (a) => a.scholarshipStatus === 'awarded'
        ).length;
        const commPending = applications.filter((a) => a.commissionStatus === 'pending').length;
        const commInvoiced = applications.filter((a) => a.commissionStatus === 'invoiced').length;
        const commReceived = applications.filter((a) => a.commissionStatus === 'received').length;

        return (
          <div className="px-4 py-2.5 rounded-xl bg-surface-card border border-hairline flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex flex-wrap items-center gap-4">
              <span className="text-ink-muted">
                Deposits:{' '}
                <span className="font-mono text-tone-positive">{depositsPaid} paid</span>
                {depositsPending > 0 && (
                  <span className="font-mono text-brass"> · {depositsPending} due</span>
                )}
              </span>
              <span className="text-ink-muted">
                Scholarships:{' '}
                <span className="font-mono text-ink-primary">{scholarshipsAwarded} awarded</span>
              </span>
            </div>
            {isOrgAdmin && (
              <div className="flex flex-wrap items-center gap-3 font-mono">
                <span className="text-ink-muted">Commissions:</span>
                <span className="text-brass">{commPending} pending</span>
                <span className="text-ink-primary">{commInvoiced} invoiced</span>
                <span className="text-tone-positive">{commReceived} received</span>
              </div>
            )}
          </div>
        );
      })()}

      {/* Pipeline Kanban Board View */}
      {viewMode === 'board' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-3.5 items-start">
          {BOARD_COLUMNS.map((col) => {
            const colApps = filtered.filter((a) => col.statuses.includes(a.status));
            return (
              <div
                key={col.id}
                className="rounded-xl bg-surface-card border border-hairline overflow-hidden flex flex-col"
              >
                <div className="px-4 py-3 border-b border-hairline bg-surface-deep/50 flex items-center justify-between">
                  <span className="text-xs font-medium text-ink-primary">{col.title}</span>
                  <span className="font-mono text-xs text-ink-muted tabular-nums">{colApps.length}</span>
                </div>

                <div className="p-2.5 space-y-2.5 min-h-[180px]">
                  {colApps.length === 0 ? (
                    <div className="py-8 text-center text-xs text-ink-muted">No records</div>
                  ) : (
                    colApps.map((app) => {
                      const cand = candidates.find((c) => c.id === app.candidateId);
                      const meta = STATUS_META[app.status] || STATUS_META.draft;
                      const docsTotal = app.documentChecklist?.length || 0;
                      const docsDone = (app.documentChecklist || []).filter((d) => d.submitted).length;
                      const condsPending = (app.offerConditions || []).filter((c) => !c.met).length;

                      return (
                        <div
                          key={app.id}
                          onClick={() => setSelectedAppId(app.id)}
                          className="p-3.5 rounded-lg bg-surface-deep border border-hairline hover:border-brass-border cursor-pointer transition-colors duration-150 ease-quart space-y-2.5"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-[11px] text-ink-muted truncate">{app.country}</span>
                            <VerificationStamp tone={meta.tone} label={meta.label} />
                          </div>

                          <div>
                            <h3 className="text-sm font-medium text-ink-primary leading-snug">
                              {app.institutionName}
                            </h3>
                            <p className="text-xs text-ink-secondary mt-0.5 line-clamp-1">
                              {app.programName}
                            </p>
                          </div>

                          <div className="pt-2 border-t border-hairline space-y-1 text-xs">
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-ink-muted">Student</span>
                              <span className="text-ink-primary truncate font-medium">
                                {cand
                                  ? `${cand.personal.legalGivenName} ${cand.personal.familyName}`
                                  : 'Unassigned'}
                              </span>
                            </div>
                            {app.deadline && (
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-ink-muted">Deadline</span>
                                <span className="font-mono text-brass tabular-nums">{app.deadline}</span>
                              </div>
                            )}
                            {docsTotal > 0 && (
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-ink-muted">Docs uploaded</span>
                                <span className="font-mono text-ink-secondary tabular-nums">
                                  {docsDone}/{docsTotal}
                                </span>
                              </div>
                            )}
                            {condsPending > 0 && (
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-ink-muted">Open conditions</span>
                                <span className="font-mono text-brass tabular-nums">{condsPending}</span>
                              </div>
                            )}
                          </div>

                          <div
                            onClick={(e) => e.stopPropagation()}
                            className="pt-2 border-t border-hairline flex items-center justify-between gap-2"
                          >
                            <select
                              value={app.status}
                              onChange={(e) =>
                                onUpdateApplication(app.id, {
                                  status: e.target.value as ApplicationStatus,
                                })
                              }
                              aria-label={`Change stage for ${app.institutionName}`}
                              className="h-7 w-full rounded bg-surface-card border border-hairline px-2 text-[11px] text-ink-secondary focus:outline-none focus:border-brass"
                            >
                              {(Object.keys(STATUS_META) as ApplicationStatus[]).map((st) => (
                                <option key={st} value={st}>
                                  {STATUS_META[st].label}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : viewMode === 'table' ? (
        /* Table View */
        <div className="bg-surface-card border border-hairline rounded-xl overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-hairline text-ink-muted">
                <th className="py-3 px-4 font-normal">Institution & program</th>
                <th className="py-3 px-4 font-normal">Student</th>
                <th className="py-3 px-4 font-normal">Intake & ref</th>
                <th className="py-3 px-4 font-normal">Docs & fees</th>
                <th className="py-3 px-4 font-normal">Deadline</th>
                <th className="py-3 px-4 font-normal">Stage</th>
                <th className="py-3 px-4 font-normal text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[rgba(237,237,237,0.06)]">
              {filtered.map((app) => {
                const cand = candidates.find((c) => c.id === app.candidateId);
                const meta = STATUS_META[app.status] || STATUS_META.draft;
                const docsTotal = app.documentChecklist?.length || 0;
                const docsDone = (app.documentChecklist || []).filter((d) => d.submitted).length;

                return (
                  <tr
                    key={app.id}
                    onClick={() => setSelectedAppId(app.id)}
                    className="hover:bg-surface-deep/60 cursor-pointer"
                  >
                    <td className="py-3.5 px-4">
                      <p className="text-sm font-medium text-ink-primary">{app.institutionName}</p>
                      <p className="text-ink-secondary mt-0.5">
                        {app.programName} · {app.country}
                      </p>
                    </td>
                    <td className="py-3.5 px-4 text-ink-primary">
                      {cand ? `${cand.personal.legalGivenName} ${cand.personal.familyName}` : '—'}
                    </td>
                    <td className="py-3.5 px-4 font-mono text-ink-secondary tabular-nums">
                      <div>{app.intake || '—'}</div>
                      {app.referenceNumber && <div className="text-ink-muted">{app.referenceNumber}</div>}
                    </td>
                    <td className="py-3.5 px-4 font-mono tabular-nums text-ink-secondary">
                      <div>Docs {docsDone}/{docsTotal}</div>
                      {app.applicationFeeStatus && (
                        <div className="text-ink-muted">Fee: {app.applicationFeeStatus}</div>
                      )}
                    </td>
                    <td className="py-3.5 px-4 font-mono tabular-nums text-brass">
                      {app.deadline || '—'}
                    </td>
                    <td className="py-3.5 px-4">
                      <VerificationStamp tone={meta.tone} label={meta.label} />
                    </td>
                    <td className="py-3.5 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        onClick={() => setSelectedAppId(app.id)}
                        className="btn-secondary h-7 px-2.5 text-xs"
                      >
                        Manage
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (() => {
        const grouped = new Map<string, ApplicationRecord[]>();
        for (const app of filtered) {
          const key = app.institutionName;
          grouped.set(key, [...(grouped.get(key) || []), app]);
        }
        for (const uni of universities) {
          if (filterCountry !== 'all' && uni.country !== filterCountry) continue;
          if (searchQuery && !uni.name.toLowerCase().includes(searchQuery.toLowerCase())) continue;
          if (!grouped.has(uni.name)) grouped.set(uni.name, []);
        }
        const entries = Array.from(grouped.entries()).sort((a, b) => b[1].length - a[1].length);

        return (
          <div className="space-y-4">
            {entries.map(([uniName, uniApps]) => {
              const catalogUni = universities.find(
                (u) => u.name.toLowerCase() === uniName.toLowerCase()
              );
              const offerCount = uniApps.filter(
                (a) =>
                  a.status === 'conditional_offer' ||
                  a.status === 'unconditional_offer' ||
                  a.status === 'enrolled'
              ).length;
              const enrolledCount = uniApps.filter((a) => a.status === 'enrolled').length;

              return (
                <div
                  key={uniName}
                  className="p-5 rounded-xl bg-surface-card border border-hairline space-y-4"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-hairline">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2.5 flex-wrap">
                        <h3 className="text-base font-medium text-ink-primary">{uniName}</h3>
                        {catalogUni?.isPartner && (
                          <VerificationStamp tone="brass" label="Partner university" />
                        )}
                        <span className="text-xs text-ink-muted">
                          {catalogUni?.country || uniApps[0]?.country || 'International'}
                          {catalogUni?.city ? ` · ${catalogUni.city}` : ''}
                        </span>
                      </div>
                      {catalogUni?.programs && catalogUni.programs.length > 0 && (
                        <p className="text-xs text-ink-secondary mt-1 truncate">
                          Catalog programs:{' '}
                          {catalogUni.programs
                            .map(
                              (p) =>
                                `${p.name}${p.minIelts ? ` (IELTS ${p.minIelts})` : ''}${
                                  p.minGpa ? ` · GPA ${p.minGpa}` : ''
                                }`
                            )
                            .join(' | ')}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-3 shrink-0 text-xs font-mono">
                      <span className="px-2.5 py-1 rounded-md bg-surface-deep border border-hairline text-ink-primary">
                        {uniApps.length} applicant{uniApps.length === 1 ? '' : 's'}
                      </span>
                      <span className="px-2.5 py-1 rounded-md bg-surface-deep border border-hairline text-tone-positive">
                        {offerCount} offer{offerCount === 1 ? '' : 's'}
                      </span>
                      {enrolledCount > 0 && (
                        <span className="px-2.5 py-1 rounded-md bg-surface-deep border border-brass-border text-brass">
                          {enrolledCount} enrolled
                        </span>
                      )}
                      {catalogUni?.portalUrl && (
                        <a
                          href={catalogUni.portalUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="btn-secondary h-8 px-2.5 text-xs"
                        >
                          <span>Portal</span>
                          <ExternalLink className="w-3.5 h-3.5 text-ink-muted" strokeWidth={1.5} />
                        </a>
                      )}
                    </div>
                  </div>

                  {uniApps.length === 0 ? (
                    <div className="text-xs text-ink-muted flex items-center justify-between">
                      <span>No active applications yet for this intake.</span>
                      {onBatchCreateApplications && (
                        <button
                          type="button"
                          onClick={() => {
                            setShortlistCandidateId(candidates[0]?.id || '');
                            setShortlistSelectedKeys(
                              catalogUni?.programs[0]
                                ? [`${catalogUni.id}::${catalogUni.programs[0].id}`]
                                : []
                            );
                            setIsShortlistOpen(true);
                          }}
                          className="text-brass hover:underline font-medium"
                        >
                          + Shortlist student here
                        </button>
                      )}
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                      {uniApps.map((app) => {
                        const cand = candidates.find((c) => c.id === app.candidateId);
                        const meta = STATUS_META[app.status] || STATUS_META.draft;
                        return (
                          <div
                            key={app.id}
                            onClick={() => setSelectedAppId(app.id)}
                            className="p-3.5 rounded-lg bg-surface-deep border border-hairline hover:border-hairline-strong cursor-pointer space-y-2 transition-colors"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <p className="text-xs font-medium text-ink-primary truncate">
                                  {cand
                                    ? `${cand.personal.legalGivenName} ${cand.personal.familyName}`
                                    : 'Candidate'}
                                </p>
                                <p className="text-[11px] text-ink-secondary truncate">
                                  {app.programName}
                                </p>
                              </div>
                              <VerificationStamp tone={meta.tone} label={meta.label} />
                            </div>
                            <div className="flex items-center justify-between text-[11px] font-mono text-ink-muted">
                              <span>{app.intake || '2027 intake'}</span>
                              {app.deadline && <span>Due {app.deadline}</span>}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        );
      })()}

      {/* Rich Application Detail Workspace Modal */}
      {selectedApp && (
        <div
          onClick={() => setSelectedAppId(null)}
          className="fixed inset-0 z-50 bg-black/75 flex items-center justify-end"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-surface-card border-l border-hairline-strong w-full max-w-3xl h-full flex flex-col overflow-hidden"
          >
            {/* Drawer Header */}
            <div className="px-6 py-4 border-b border-hairline flex items-start justify-between gap-4 bg-surface-deep/60">
              <div className="min-w-0">
                <div className="flex items-center gap-2.5 flex-wrap">
                  <span className="text-xs text-ink-muted">{selectedApp.country}</span>
                  {selectedApp.referenceNumber && (
                    <span className="font-mono text-xs text-brass">{selectedApp.referenceNumber}</span>
                  )}
                  <VerificationStamp
                    tone={(STATUS_META[selectedApp.status] || STATUS_META.draft).tone}
                    label={(STATUS_META[selectedApp.status] || STATUS_META.draft).label}
                  />
                </div>
                <h2 className="text-xl font-medium text-ink-primary mt-1 truncate">
                  {selectedApp.institutionName}
                </h2>
                <p className="text-sm text-ink-secondary">
                  {selectedApp.programName}
                  {selectedApp.intake ? ` · ${selectedApp.intake}` : ''}
                </p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {selectedApp.portalUrl && (
                  <a
                    href={selectedApp.portalUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="btn-secondary h-8 px-3 text-xs"
                  >
                    <span>Open portal</span>
                    <ExternalLink className="w-4 h-4 text-ink-muted" strokeWidth={1.5} />
                  </a>
                )}
                {onDeleteApplication && (
                  <button
                    type="button"
                    onClick={async () => {
                      if (window.confirm(`Delete application for ${selectedApp.institutionName}?`)) {
                        await onDeleteApplication(selectedApp.id);
                        setSelectedAppId(null);
                      }
                    }}
                    className="h-8 w-8 rounded-lg text-ink-muted hover:text-tone-negative hover:bg-surface-raised inline-flex items-center justify-center"
                    title="Delete application"
                  >
                    <Trash2 className="w-4 h-4" strokeWidth={1.5} />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setSelectedAppId(null)}
                  className="h-8 w-8 rounded-lg text-ink-muted hover:text-ink-primary hover:bg-surface-raised inline-flex items-center justify-center"
                >
                  <X className="w-4 h-4" strokeWidth={1.5} />
                </button>
              </div>
            </div>

            {/* Drawer Scrollable Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6 text-sm">
              {/* 1. Stage, Priority, Fees & CAS / Visa Controls */}
              <div className="p-4 rounded-xl bg-surface-deep border border-hairline grid grid-cols-2 sm:grid-cols-4 gap-3.5 text-xs">
                <div>
                  <label className="block text-ink-muted mb-1">Application stage</label>
                  <select
                    value={selectedApp.status}
                    onChange={(e) =>
                      onUpdateApplication(selectedApp.id, {
                        status: e.target.value as ApplicationStatus,
                      })
                    }
                    className="field-input h-8 text-xs"
                  >
                    {(Object.keys(STATUS_META) as ApplicationStatus[]).map((k) => (
                      <option key={k} value={k}>
                        {STATUS_META[k].label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-ink-muted mb-1">Application fee</label>
                  <select
                    value={selectedApp.applicationFeeStatus || 'unpaid'}
                    onChange={(e) =>
                      onUpdateApplication(selectedApp.id, {
                        applicationFeeStatus: e.target.value as ApplicationFeeStatus,
                      })
                    }
                    className="field-input h-8 text-xs"
                  >
                    <option value="unpaid">Unpaid {selectedApp.applicationFee ? `(${selectedApp.applicationFee})` : ''}</option>
                    <option value="paid">Paid {selectedApp.applicationFee ? `(${selectedApp.applicationFee})` : ''}</option>
                    <option value="waived">Fee waived</option>
                  </select>
                </div>

                <div>
                  <label className="block text-ink-muted mb-1">CAS / I-20 / CoE</label>
                  <select
                    value={selectedApp.casStatus || 'not_started'}
                    onChange={(e) =>
                      onUpdateApplication(selectedApp.id, {
                        casStatus: e.target.value as CasStatus,
                      })
                    }
                    className="field-input h-8 text-xs"
                  >
                    <option value="not_started">Not started</option>
                    <option value="documents_pending">Docs pending</option>
                    <option value="requested">Requested</option>
                    <option value="issued">Issued</option>
                  </select>
                </div>

                <div>
                  <label className="block text-ink-muted mb-1">Student visa</label>
                  <select
                    value={selectedApp.visaStatus || 'not_started'}
                    onChange={(e) =>
                      onUpdateApplication(selectedApp.id, {
                        visaStatus: e.target.value as VisaStatus,
                      })
                    }
                    className="field-input h-8 text-xs"
                  >
                    <option value="not_started">Not started</option>
                    <option value="preparing">Preparing file</option>
                    <option value="lodged">Lodged</option>
                    <option value="biometrics_done">Biometrics done</option>
                    <option value="granted">Visa granted</option>
                    <option value="refused">Refused</option>
                  </select>
                </div>
              </div>

              {/* 1b. Tuition Deposit, Scholarship & Agency Commission */}
              <div className="p-4 rounded-xl bg-surface-deep border border-hairline space-y-3.5 text-xs">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium text-ink-primary">
                    Tuition deposit, scholarship & agency commission
                  </span>
                  <VerificationStamp
                    tone={selectedApp.depositPaid ? 'positive' : 'brass'}
                    label={selectedApp.depositPaid ? 'Deposit paid' : 'Deposit unpaid'}
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-ink-muted mb-1">Tuition deposit amount</label>
                    <input
                      defaultValue={selectedApp.depositAmount || ''}
                      key={`dep-amt-${selectedApp.id}`}
                      onBlur={(e) => {
                        const val = e.target.value.trim();
                        if (val !== (selectedApp.depositAmount || '')) {
                          onUpdateApplication(selectedApp.id, { depositAmount: val || undefined });
                        }
                      }}
                      placeholder="GBP 2,000"
                      className="field-input h-8 font-mono text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-ink-muted mb-1">Deposit due date</label>
                    <input
                      type="date"
                      value={selectedApp.depositDeadline || ''}
                      onChange={(e) =>
                        onUpdateApplication(selectedApp.id, {
                          depositDeadline: e.target.value || undefined,
                        })
                      }
                      className="field-input h-8 font-mono text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-ink-muted mb-1">Deposit status</label>
                    <select
                      value={selectedApp.depositPaid ? 'paid' : 'unpaid'}
                      onChange={(e) =>
                        onUpdateApplication(selectedApp.id, {
                          depositPaid: e.target.value === 'paid',
                        })
                      }
                      className="field-input h-8 text-xs"
                    >
                      <option value="unpaid">Unpaid</option>
                      <option value="paid">Paid</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-hairline">
                  <div>
                    <label className="block text-ink-muted mb-1">Scholarship name</label>
                    <input
                      defaultValue={selectedApp.scholarshipName || ''}
                      key={`sch-name-${selectedApp.id}`}
                      onBlur={(e) => {
                        const val = e.target.value.trim();
                        if (val !== (selectedApp.scholarshipName || '')) {
                          onUpdateApplication(selectedApp.id, { scholarshipName: val || undefined });
                        }
                      }}
                      placeholder="Merit Bursary"
                      className="field-input h-8 text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-ink-muted mb-1">Scholarship amount</label>
                    <input
                      defaultValue={selectedApp.scholarshipAmount || ''}
                      key={`sch-amt-${selectedApp.id}`}
                      onBlur={(e) => {
                        const val = e.target.value.trim();
                        if (val !== (selectedApp.scholarshipAmount || '')) {
                          onUpdateApplication(selectedApp.id, {
                            scholarshipAmount: val || undefined,
                          });
                        }
                      }}
                      placeholder="GBP 5,000"
                      className="field-input h-8 font-mono text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-ink-muted mb-1">Scholarship status</label>
                    <select
                      value={selectedApp.scholarshipStatus || 'none'}
                      onChange={(e) =>
                        onUpdateApplication(selectedApp.id, {
                          scholarshipStatus: e.target.value as ScholarshipStatus,
                        })
                      }
                      className="field-input h-8 text-xs"
                    >
                      <option value="none">None</option>
                      <option value="eligible">Eligible</option>
                      <option value="applied">Applied</option>
                      <option value="awarded">Awarded</option>
                      <option value="rejected">Rejected</option>
                    </select>
                  </div>
                </div>

                {isOrgAdmin && (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-hairline">
                    <div>
                      <label className="block text-ink-muted mb-1">Commission rate</label>
                      <input
                        defaultValue={selectedApp.commissionRate || ''}
                        key={`com-rate-${selectedApp.id}`}
                        onBlur={(e) => {
                          const val = e.target.value.trim();
                          if (val !== (selectedApp.commissionRate || '')) {
                            onUpdateApplication(selectedApp.id, {
                              commissionRate: val || undefined,
                            });
                          }
                        }}
                        placeholder="15%"
                        className="field-input h-8 font-mono text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-ink-muted mb-1">Expected commission</label>
                      <input
                        defaultValue={selectedApp.commissionAmount || ''}
                        key={`com-amt-${selectedApp.id}`}
                        onBlur={(e) => {
                          const val = e.target.value.trim();
                          if (val !== (selectedApp.commissionAmount || '')) {
                            onUpdateApplication(selectedApp.id, {
                              commissionAmount: val || undefined,
                            });
                          }
                        }}
                        placeholder="GBP 4,800"
                        className="field-input h-8 font-mono text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-ink-muted mb-1">Commission status</label>
                      <select
                        value={selectedApp.commissionStatus || 'none'}
                        onChange={(e) =>
                          onUpdateApplication(selectedApp.id, {
                            commissionStatus: e.target.value as CommissionStatus,
                          })
                        }
                        className="field-input h-8 text-xs"
                      >
                        <option value="none">Not applicable</option>
                        <option value="pending">Pending enrolment</option>
                        <option value="invoiced">Invoiced</option>
                        <option value="received">Received</option>
                      </select>
                    </div>
                  </div>
                )}
              </div>

              {/* 2. Linked Student Dedicated Email & Portal Credentials */}
              <div className="p-4 rounded-xl bg-surface-deep border border-hairline space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <KeyRound className="w-4 h-4 text-brass" strokeWidth={1.5} />
                    <span className="text-sm font-medium text-ink-primary">
                      Linked student email & portal login
                    </span>
                  </div>
                  {detailCreds.length > 0 && (
                    <select
                      value={selectedApp.portalCredentialId || ''}
                      onChange={(e) =>
                        onUpdateApplication(selectedApp.id, {
                          portalCredentialId: e.target.value || undefined,
                        })
                      }
                      className="field-input h-8 w-auto text-xs"
                    >
                      <option value="">Select saved login</option>
                      {detailCreds.map((cr) => (
                        <option key={cr.id} value={cr.id}>
                          {cr.label} ({cr.loginEmail})
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                {linkedCred ? (
                  <div className="p-3.5 rounded-lg bg-surface-card border border-hairline flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                    <div className="space-y-1 min-w-0">
                      <p className="font-medium text-ink-primary">{linkedCred.label}</p>
                      <p className="font-mono text-ink-secondary truncate">
                        Email: <span className="text-ink-primary">{linkedCred.loginEmail}</span>
                        {linkedCred.username ? ` · ID: ${linkedCred.username}` : ''}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => copyText(linkedCred.loginEmail, `app-email-${linkedCred.id}`)}
                        className="btn-secondary h-8 px-2.5 text-xs"
                      >
                        {copiedKey === `app-email-${linkedCred.id}` ? (
                          <Check className="w-3.5 h-3.5 text-tone-positive" strokeWidth={1.5} />
                        ) : (
                          <Copy className="w-3.5 h-3.5 text-ink-muted" strokeWidth={1.5} />
                        )}
                        <span>Copy email</span>
                      </button>
                      {linkedCred.hasPassword && (
                        <button
                          type="button"
                          onClick={() => handleCopyCredPassword(selectedApp.candidateId, linkedCred.id)}
                          className="btn-secondary h-8 px-2.5 text-xs"
                        >
                          {copiedKey === `app-pwd-${linkedCred.id}` ? (
                            <Check className="w-3.5 h-3.5 text-tone-positive" strokeWidth={1.5} />
                          ) : (
                            <Copy className="w-3.5 h-3.5 text-ink-muted" strokeWidth={1.5} />
                          )}
                          <span>Copy password</span>
                        </button>
                      )}
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-ink-muted">
                    No saved login linked yet. Add student email or portal credentials in the candidate dossier.
                  </p>
                )}
              </div>

              {/* 3. Portal Document Submission Checklist (with 1-click portal download) */}
              <div className="p-4 rounded-xl bg-surface-deep border border-hairline space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FileCheck2 className="w-4 h-4 text-ink-muted" strokeWidth={1.5} />
                    <span className="text-sm font-medium text-ink-primary">
                      Portal document submission checklist
                    </span>
                  </div>
                  <span className="font-mono text-xs text-ink-muted tabular-nums">
                    {(selectedApp.documentChecklist || []).filter((i) => i.submitted).length}/
                    {(selectedApp.documentChecklist || []).length} uploaded
                  </span>
                </div>

                <div className="space-y-2">
                  {(selectedApp.documentChecklist || []).map((item) => {
                    const matchedDoc =
                      detailDocs.find((d) => d.id === item.documentId) ||
                      detailDocs.find((d) => d.category === item.category);
                    return (
                      <div
                        key={item.id}
                        className="px-3.5 py-2.5 rounded-lg bg-surface-card border border-hairline flex items-center justify-between gap-3 text-xs"
                      >
                        <label className="inline-flex items-center gap-2.5 cursor-pointer min-w-0">
                          <input
                            type="checkbox"
                            checked={item.submitted}
                            onChange={() => toggleChecklistItem(item.id)}
                            className="w-4 h-4 rounded bg-surface-deep border-hairline accent-[#d4a853]"
                          />
                          <span
                            className={`truncate ${
                              item.submitted ? 'text-ink-primary' : 'text-ink-secondary'
                            }`}
                          >
                            {item.label}
                          </span>
                        </label>

                        <div className="flex items-center gap-2 shrink-0">
                          {matchedDoc ? (
                            <button
                              type="button"
                              onClick={() =>
                                api.downloadDocumentBlob(
                                  matchedDoc.id,
                                  'portal',
                                  matchedDoc.portalFileName || matchedDoc.fileName
                                )
                              }
                              className="h-7 px-2 rounded bg-surface-raised border border-hairline hover:border-hairline-strong font-mono text-[11px] text-ink-primary inline-flex items-center gap-1.5"
                              title="Download standardized file for university portal upload"
                            >
                              <Download className="w-3.5 h-3.5 text-brass" strokeWidth={1.5} />
                              <span>{matchedDoc.portalFileName || matchedDoc.category}</span>
                            </button>
                          ) : (
                            <VerificationStamp tone="brass" label="not in dossier" />
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                <form onSubmit={handleAddChecklistItem} className="flex items-center gap-2 pt-1">
                  <select
                    value={newChecklistCategory}
                    onChange={(e) => setNewChecklistCategory(e.target.value as DocumentCategory)}
                    className="field-input h-8 w-36 text-xs"
                  >
                    <option value="passport">Passport</option>
                    <option value="transcript">Transcript</option>
                    <option value="degree">Degree</option>
                    <option value="english_test">English test</option>
                    <option value="cv">CV</option>
                    <option value="sop">SOP</option>
                    <option value="lor">LOR</option>
                    <option value="financial">Financial</option>
                    <option value="other">Other</option>
                  </select>
                  <input
                    value={newChecklistLabel}
                    onChange={(e) => setNewChecklistLabel(e.target.value)}
                    placeholder="Add required portal document..."
                    className="field-input h-8 text-xs flex-1"
                  />
                  <button type="submit" className="btn-secondary h-8 px-3 text-xs">
                    Add
                  </button>
                </form>
              </div>

              {/* 4. Offer Conditions, Scholarship & Deposit Tracker */}
              <div className="p-4 rounded-xl bg-surface-deep border border-hairline space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-ink-primary">
                    Offer conditions, scholarship & deposit
                  </span>
                  {selectedApp.tuitionFee && (
                    <span className="font-mono text-xs text-brass">
                      Tuition: {selectedApp.tuitionFee}
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                  <div className="p-3 rounded-lg bg-surface-card border border-hairline">
                    <span className="block text-ink-muted mb-1">Scholarship</span>
                    <select
                      value={selectedApp.scholarshipStatus || 'none'}
                      onChange={(e) =>
                        onUpdateApplication(selectedApp.id, {
                          scholarshipStatus: e.target.value as ScholarshipStatus,
                        })
                      }
                      className="field-input h-7 text-xs"
                    >
                      <option value="none">None</option>
                      <option value="eligible">Eligible</option>
                      <option value="applied">Applied</option>
                      <option value="awarded">Awarded</option>
                      <option value="rejected">Not awarded</option>
                    </select>
                    {selectedApp.scholarshipName && (
                      <p className="text-ink-secondary mt-1.5 truncate">
                        {selectedApp.scholarshipName}
                        {selectedApp.scholarshipAmount ? ` (${selectedApp.scholarshipAmount})` : ''}
                      </p>
                    )}
                  </div>

                  <div className="p-3 rounded-lg bg-surface-card border border-hairline">
                    <span className="block text-ink-muted mb-1">Acceptance deposit</span>
                    <input
                      value={selectedApp.depositAmount || ''}
                      onChange={(e) =>
                        onUpdateApplication(selectedApp.id, { depositAmount: e.target.value })
                      }
                      placeholder="e.g. GBP 2,000"
                      className="field-input h-7 font-mono text-xs"
                    />
                  </div>

                  <div className="p-3 rounded-lg bg-surface-card border border-hairline flex flex-col justify-between">
                    <span className="block text-ink-muted mb-1">Deposit status</span>
                    <label className="inline-flex items-center gap-2 cursor-pointer py-1">
                      <input
                        type="checkbox"
                        checked={Boolean(selectedApp.depositPaid)}
                        onChange={(e) =>
                          onUpdateApplication(selectedApp.id, { depositPaid: e.target.checked })
                        }
                        className="w-4 h-4 rounded bg-surface-deep border-hairline accent-[#d4a853]"
                      />
                      <span className="text-ink-primary">
                        {selectedApp.depositPaid ? 'Deposit paid' : 'Awaiting payment'}
                      </span>
                    </label>
                  </div>
                </div>

                {(selectedApp.offerConditions || []).length > 0 && (
                  <div className="space-y-1.5 pt-1">
                    {(selectedApp.offerConditions || []).map((cond) => (
                      <label
                        key={cond.id}
                        className="px-3 py-2 rounded-lg bg-surface-card border border-hairline flex items-center justify-between gap-3 text-xs cursor-pointer"
                      >
                        <span className="inline-flex items-center gap-2.5">
                          <input
                            type="checkbox"
                            checked={cond.met}
                            onChange={() => toggleOfferCondition(cond.id)}
                            className="w-4 h-4 rounded bg-surface-deep border-hairline accent-[#d4a853]"
                          />
                          <span className={cond.met ? 'line-through text-ink-muted' : 'text-ink-primary'}>
                            {cond.text}
                          </span>
                        </span>
                        {cond.dueDate && (
                          <span className="font-mono text-ink-muted tabular-nums shrink-0">
                            Due {cond.dueDate}
                          </span>
                        )}
                      </label>
                    ))}
                  </div>
                )}

                <form onSubmit={handleAddCondition} className="flex items-center gap-2">
                  <input
                    value={newConditionText}
                    onChange={(e) => setNewConditionText(e.target.value)}
                    placeholder="Add conditional offer requirement (e.g. Final transcript attestation)..."
                    className="field-input h-8 text-xs flex-1"
                  />
                  <button type="submit" className="btn-secondary h-8 px-3 text-xs">
                    Add condition
                  </button>
                </form>
              </div>

              {/* 5. Chronological Activity Timeline */}
              <div className="p-4 rounded-xl bg-surface-deep border border-hairline space-y-3">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-ink-muted" strokeWidth={1.5} />
                  <span className="text-sm font-medium text-ink-primary">Admissions activity log</span>
                </div>

                <form onSubmit={handleAddTimelineLog} className="flex items-center gap-2">
                  <input
                    value={timelineInput}
                    onChange={(e) => setTimelineInput(e.target.value)}
                    placeholder="Log portal update, interview date, or email from admissions..."
                    className="field-input h-8 text-xs flex-1"
                  />
                  <button type="submit" className="btn-primary h-8 px-3 text-xs">
                    <Send className="w-3.5 h-3.5 text-[#141415]" strokeWidth={1.5} />
                    <span>Log</span>
                  </button>
                </form>

                <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                  {[...(selectedApp.timeline || [])].reverse().map((ev) => (
                    <div
                      key={ev.id}
                      className="p-3 rounded-lg bg-surface-card border border-hairline text-xs space-y-1"
                    >
                      <div className="flex items-center justify-between text-ink-muted font-mono">
                        <span>{ev.actor || 'Consultant'}</span>
                        <span>{new Date(ev.timestamp).toISOString().replace('T', ' ').slice(0, 16)}</span>
                      </div>
                      <p className="text-ink-primary">{ev.text}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Create Application Modal */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4">
          <div className="bg-surface-card border border-hairline-strong rounded-2xl w-full max-w-xl overflow-hidden">
            <div className="h-14 px-6 border-b border-hairline flex items-center justify-between">
              <h3 className="text-base font-medium text-ink-primary">New university application</h3>
              <button
                type="button"
                onClick={() => setIsCreateOpen(false)}
                className="h-8 w-8 rounded-lg text-ink-muted hover:text-ink-primary hover:bg-surface-raised inline-flex items-center justify-center"
              >
                <X className="w-4 h-4" strokeWidth={1.5} />
              </button>
            </div>

            <form onSubmit={handleCreate} className="p-6 space-y-4 max-h-[82vh] overflow-y-auto text-sm">
              <div>
                <label className="block text-xs text-ink-secondary mb-1.5">Student *</label>
                <select
                  required
                  value={candidateId}
                  onChange={(e) => setCandidateId(e.target.value)}
                  className="field-input"
                >
                  {candidates.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.personal.legalGivenName} {c.personal.familyName} ({c.personal.nationality})
                    </option>
                  ))}
                </select>
              </div>

              {universities.length > 0 && (() => {
                const chosenUni = universities.find((u) => u.id === selectedCatalogUniId);
                const chosenProg = chosenUni?.programs.find((p) => p.id === selectedCatalogProgId);
                const chosenCand = candidates.find((c) => c.id === candidateId);
                const eligibility =
                  chosenCand && chosenProg ? evaluateEligibility(chosenCand, chosenProg) : null;

                return (
                  <div className="p-3.5 rounded-xl bg-surface-deep border border-hairline space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-ink-primary flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5 text-brass" strokeWidth={1.5} />
                        <span>Quick-fill from university catalog</span>
                      </span>
                      {eligibility && (
                        <VerificationStamp
                          tone={
                            eligibility.status === 'eligible'
                              ? 'positive'
                              : eligibility.status === 'borderline'
                                ? 'negative'
                                : 'brass'
                          }
                          label={
                            eligibility.status === 'eligible'
                              ? 'Meets entry requirements'
                              : eligibility.status === 'borderline'
                                ? 'Borderline / check reqs'
                                : 'Check missing scores'
                          }
                        />
                      )}
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <select
                        value={selectedCatalogUniId}
                        onChange={(e) => {
                          const uid = e.target.value;
                          setSelectedCatalogUniId(uid);
                          const uni = universities.find((u) => u.id === uid);
                          if (uni) {
                            setInstitutionName(uni.name);
                            setCountry(uni.country);
                            if (uni.portalUrl) setPortalUrl(uni.portalUrl);
                            const p = uni.programs[0];
                            if (p) {
                              setSelectedCatalogProgId(p.id);
                              setProgramName(p.name);
                              setDegreeLevel(p.degreeLevel);
                              if (p.intake) setIntake(p.intake);
                              if (p.deadline) setDeadline(p.deadline);
                              if (p.tuitionFee) setTuitionFee(p.tuitionFee);
                              if (p.applicationFee) setApplicationFee(p.applicationFee);
                            } else {
                              setSelectedCatalogProgId('');
                            }
                          }
                        }}
                        className="field-input h-8 text-xs"
                      >
                        <option value="">Choose catalog university...</option>
                        {universities.map((u) => (
                          <option key={u.id} value={u.id}>
                            {u.name} ({u.country})
                          </option>
                        ))}
                      </select>

                      <select
                        value={selectedCatalogProgId}
                        disabled={!chosenUni}
                        onChange={(e) => {
                          const pid = e.target.value;
                          setSelectedCatalogProgId(pid);
                          const p = chosenUni?.programs.find((pr) => pr.id === pid);
                          if (p) {
                            setProgramName(p.name);
                            setDegreeLevel(p.degreeLevel);
                            if (p.intake) setIntake(p.intake);
                            if (p.deadline) setDeadline(p.deadline);
                            if (p.tuitionFee) setTuitionFee(p.tuitionFee);
                            if (p.applicationFee) setApplicationFee(p.applicationFee);
                          }
                        }}
                        className="field-input h-8 text-xs"
                      >
                        <option value="">Choose program...</option>
                        {(chosenUni?.programs || []).map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name} ({p.degreeLevel})
                          </option>
                        ))}
                      </select>
                    </div>
                    {eligibility && eligibility.checks.length > 0 && (
                      <div className="flex flex-wrap gap-2 text-[11px] font-mono">
                        {eligibility.checks.map((chk, idx) => (
                          <span
                            key={idx}
                            className={`px-2 py-0.5 rounded border ${
                              chk.met === true
                                ? 'border-tone-positive/30 text-tone-positive bg-surface-card'
                                : chk.met === false
                                  ? 'border-tone-negative/30 text-tone-negative bg-surface-card'
                                  : 'border-hairline text-ink-muted bg-surface-card'
                            }`}
                          >
                            {chk.label}: {chk.detail}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })()}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-ink-secondary mb-1.5">University name *</label>
                  <input
                    required
                    value={institutionName}
                    onChange={(e) => setInstitutionName(e.target.value)}
                    placeholder="University of Edinburgh"
                    className="field-input"
                  />
                </div>
                <div>
                  <label className="block text-xs text-ink-secondary mb-1.5">Program title *</label>
                  <input
                    required
                    value={programName}
                    onChange={(e) => setProgramName(e.target.value)}
                    placeholder="MSc Artificial Intelligence"
                    className="field-input"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs text-ink-secondary mb-1.5">Country</label>
                  <input
                    value={country}
                    onChange={(e) => setCountry(e.target.value)}
                    className="field-input"
                  />
                </div>
                <div>
                  <label className="block text-xs text-ink-secondary mb-1.5">Intake</label>
                  <input
                    value={intake}
                    onChange={(e) => setIntake(e.target.value)}
                    className="field-input"
                  />
                </div>
                <div>
                  <label className="block text-xs text-ink-secondary mb-1.5">Deadline</label>
                  <input
                    type="date"
                    value={deadline}
                    onChange={(e) => setDeadline(e.target.value)}
                    className="field-input font-mono tabular-nums text-xs"
                  />
                </div>
              </div>

              <div className="pt-1">
                <button
                  type="button"
                  onClick={() => setShowAdvancedCreate((s) => !s)}
                  className="text-xs text-brass hover:underline font-medium"
                >
                  {showAdvancedCreate
                    ? '− Hide optional portal, fee & note details'
                    : '+ Optional portal, fee, priority & note details'}
                </button>
              </div>

              {showAdvancedCreate && (
                <div className="p-4 rounded-xl bg-surface-deep border border-hairline space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs text-ink-secondary mb-1.5">Degree level</label>
                      <select
                        value={degreeLevel}
                        onChange={(e) => setDegreeLevel(e.target.value as any)}
                        className="field-input"
                      >
                        <option value="Master's">Master's</option>
                        <option value="Bachelor's">Bachelor's</option>
                        <option value="Doctorate">Doctorate</option>
                        <option value="Foundation">Foundation</option>
                        <option value="Diploma">Diploma</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs text-ink-secondary mb-1.5">Priority</label>
                      <select
                        value={priority}
                        onChange={(e) => setPriority(e.target.value as ApplicationPriority)}
                        className="field-input"
                      >
                        <option value="high">High (First choice)</option>
                        <option value="medium">Medium (Target)</option>
                        <option value="low">Low (Safe / backup)</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs text-ink-secondary mb-1.5">Portal URL</label>
                      <input
                        value={portalUrl}
                        onChange={(e) => setPortalUrl(e.target.value)}
                        placeholder="https://admissions.ed.ac.uk"
                        className="field-input font-mono text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-ink-secondary mb-1.5">
                        Linked student portal login
                      </label>
                      <select
                        value={portalCredentialId}
                        onChange={(e) => setPortalCredentialId(e.target.value)}
                        className="field-input text-xs"
                      >
                        <option value="">None selected</option>
                        {createCredOptions.map((cr) => (
                          <option key={cr.id} value={cr.id}>
                            {cr.label} ({cr.loginEmail})
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs text-ink-secondary mb-1.5">Tuition fee</label>
                      <input
                        value={tuitionFee}
                        onChange={(e) => setTuitionFee(e.target.value)}
                        placeholder="GBP 34,000 / yr"
                        className="field-input font-mono text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-ink-secondary mb-1.5">App fee</label>
                      <input
                        value={applicationFee}
                        onChange={(e) => setApplicationFee(e.target.value)}
                        placeholder="GBP 60"
                        className="field-input font-mono text-xs"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs text-ink-secondary mb-1.5">Portal reference ID</label>
                      <input
                        value={referenceNumber}
                        onChange={(e) => setReferenceNumber(e.target.value)}
                        placeholder="Optional"
                        className="field-input font-mono text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-ink-secondary mb-1.5">Target scholarship</label>
                      <input
                        value={scholarshipName}
                        onChange={(e) => setScholarshipName(e.target.value)}
                        placeholder="Global Excellence Award"
                        className="field-input text-xs"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs text-ink-secondary mb-1.5">Consultant notes</label>
                    <textarea
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      rows={2}
                      className="field-input h-auto py-2"
                    />
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-2.5 pt-3 border-t border-hairline">
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
                  className="btn-secondary"
                >
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
                  Create application
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Bulk Shortlist Universities Modal */}
      {isShortlistOpen && onBatchCreateApplications && (() => {
        const targetCand = candidates.find((c) => c.id === shortlistCandidateId) || candidates[0];
        return (
          <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4">
            <div className="bg-surface-card border border-hairline-strong rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden">
              <div className="h-14 px-6 border-b border-hairline flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-brass" strokeWidth={1.5} />
                  <h3 className="text-base font-medium text-ink-primary">
                    Shortlist universities for student
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setIsShortlistOpen(false)}
                  className="h-8 w-8 rounded-lg text-ink-muted hover:text-ink-primary hover:bg-surface-raised inline-flex items-center justify-center"
                >
                  <X className="w-4 h-4" strokeWidth={1.5} />
                </button>
              </div>

              <div className="p-6 space-y-4 flex-1 overflow-y-auto text-sm">
                <div>
                  <label className="block text-xs text-ink-secondary mb-1.5">Select student *</label>
                  <select
                    value={shortlistCandidateId}
                    onChange={(e) => setShortlistCandidateId(e.target.value)}
                    className="field-input"
                  >
                    {candidates.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.personal.legalGivenName} {c.personal.familyName} ({c.personal.nationality})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2.5">
                  <p className="text-xs text-ink-secondary">
                    Select one or more university programs (live eligibility shown per student):
                  </p>
                  {universities.map((uni) => (
                    <div
                      key={uni.id}
                      className="p-3.5 rounded-xl bg-surface-deep border border-hairline space-y-2"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-medium text-ink-primary">
                          {uni.name}{' '}
                          <span className="text-ink-muted font-normal">· {uni.country}</span>
                        </span>
                        {uni.isPartner && <VerificationStamp tone="brass" label="Partner" />}
                      </div>
                      <div className="space-y-1.5">
                        {uni.programs.map((prog) => {
                          const key = `${uni.id}::${prog.id}`;
                          const checked = shortlistSelectedKeys.includes(key);
                          const elig = targetCand ? evaluateEligibility(targetCand, prog) : null;
                          return (
                            <button
                              key={prog.id}
                              type="button"
                              onClick={() =>
                                setShortlistSelectedKeys((prev) =>
                                  checked ? prev.filter((k) => k !== key) : [...prev, key]
                                )
                              }
                              className={`w-full p-2.5 rounded-lg border text-left flex items-center justify-between gap-3 transition-colors ${
                                checked
                                  ? 'bg-surface-raised border-brass'
                                  : 'bg-surface-card border-hairline hover:border-hairline-strong'
                              }`}
                            >
                              <div className="min-w-0">
                                <p className="text-xs font-medium text-ink-primary truncate">
                                  {prog.name}
                                </p>
                                <p className="text-[11px] font-mono text-ink-muted truncate">
                                  {prog.degreeLevel}
                                  {prog.intake ? ` · ${prog.intake}` : ''}
                                  {prog.tuitionFee ? ` · ${prog.tuitionFee}` : ''}
                                </p>
                              </div>
                              <div className="flex items-center gap-2 shrink-0">
                                {elig && (
                                  <VerificationStamp
                                    tone={
                                      elig.status === 'eligible'
                                        ? 'positive'
                                        : elig.status === 'borderline'
                                          ? 'negative'
                                          : 'brass'
                                    }
                                    label={
                                      elig.status === 'eligible'
                                        ? 'Eligible'
                                        : elig.status === 'borderline'
                                          ? 'Borderline'
                                          : 'Check reqs'
                                    }
                                  />
                                )}
                                <CheckCircle2
                                  className={`w-4 h-4 ${
                                    checked ? 'text-brass' : 'text-ink-muted/30'
                                  }`}
                                  strokeWidth={1.5}
                                />
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="px-6 py-4 border-t border-hairline flex items-center justify-between gap-3 shrink-0">
                <span className="text-xs font-mono text-ink-muted">
                  {shortlistSelectedKeys.length} program{shortlistSelectedKeys.length === 1 ? '' : 's'} selected
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsShortlistOpen(false)}
                    className="btn-secondary"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={shortlistBusy || shortlistSelectedKeys.length === 0 || !targetCand}
                    onClick={async () => {
                      if (!targetCand) return;
                      setShortlistBusy(true);
                      try {
                        const items = shortlistSelectedKeys
                          .map((key) => {
                            const [uid, pid] = key.split('::');
                            const uni = universities.find((u) => u.id === uid);
                            const prog = uni?.programs.find((p) => p.id === pid);
                            if (!uni || !prog) return null;
                            return {
                              institutionName: uni.name,
                              programName: prog.name,
                              degreeLevel: prog.degreeLevel,
                              country: uni.country,
                              intake: prog.intake,
                              deadline: prog.deadline,
                              portalUrl: uni.portalUrl,
                              applicationFee: prog.applicationFee,
                              tuitionFee: prog.tuitionFee,
                              requiredDocs: prog.requiredDocs,
                            };
                          })
                          .filter(Boolean) as any[];
                        if (items.length > 0) {
                          await onBatchCreateApplications({
                            candidateId: targetCand.id,
                            items,
                          });
                        }
                        setIsShortlistOpen(false);
                      } finally {
                        setShortlistBusy(false);
                      }
                    }}
                    className="btn-primary"
                  >
                    {shortlistBusy
                      ? 'Creating...'
                      : `Create ${shortlistSelectedKeys.length} application${
                          shortlistSelectedKeys.length === 1 ? '' : 's'
                        }`}
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Add Custom Partner University Modal */}
      {isAddUniOpen && onCreateUniversity && (
        <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4">
          <div className="bg-surface-card border border-hairline-strong rounded-2xl w-full max-w-lg overflow-hidden">
            <div className="h-14 px-6 border-b border-hairline flex items-center justify-between">
              <h3 className="text-base font-medium text-ink-primary">Add university to catalog</h3>
              <button
                type="button"
                onClick={() => setIsAddUniOpen(false)}
                className="h-8 w-8 rounded-lg text-ink-muted hover:text-ink-primary hover:bg-surface-raised inline-flex items-center justify-center"
              >
                <X className="w-4 h-4" strokeWidth={1.5} />
              </button>
            </div>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                await onCreateUniversity({
                  name: uName.trim(),
                  country: uCountry.trim(),
                  city: uCity.trim() || undefined,
                  portalUrl: uPortalUrl.trim() || undefined,
                  isPartner: true,
                  programs: [
                    {
                      id: `prog-${Date.now()}`,
                      name: uProgName.trim() || 'MSc Computer Science',
                      degreeLevel: uProgDegree || "Master's",
                      intake: uProgIntake.trim() || undefined,
                      deadline: uProgDeadline || undefined,
                      tuitionFee: uProgTuition.trim() || undefined,
                      minGpa: uProgMinGpa ? Number(uProgMinGpa) : undefined,
                      minIelts: uProgMinIelts ? Number(uProgMinIelts) : undefined,
                      requiredDocs: ['passport', 'transcript', 'degree', 'english_test', 'cv'],
                    },
                  ],
                });
                setUName('');
                setUCity('');
                setUPortalUrl('');
                setUProgName('');
                setUProgTuition('');
                setIsAddUniOpen(false);
              }}
              className="p-6 space-y-3.5 text-sm max-h-[80vh] overflow-y-auto"
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-ink-secondary mb-1">University name *</label>
                  <input
                    required
                    value={uName}
                    onChange={(e) => setUName(e.target.value)}
                    placeholder="University of Glasgow"
                    className="field-input"
                  />
                </div>
                <div>
                  <label className="block text-xs text-ink-secondary mb-1">Country *</label>
                  <input
                    required
                    value={uCountry}
                    onChange={(e) => setUCountry(e.target.value)}
                    className="field-input"
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-ink-secondary mb-1">City</label>
                  <input
                    value={uCity}
                    onChange={(e) => setUCity(e.target.value)}
                    placeholder="Glasgow"
                    className="field-input"
                  />
                </div>
                <div>
                  <label className="block text-xs text-ink-secondary mb-1">Portal URL</label>
                  <input
                    value={uPortalUrl}
                    onChange={(e) => setUPortalUrl(e.target.value)}
                    placeholder="https://apply.gla.ac.uk"
                    className="field-input font-mono text-xs"
                  />
                </div>
              </div>
              <div className="pt-2 border-t border-hairline grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-ink-secondary mb-1">Primary program *</label>
                  <input
                    required
                    value={uProgName}
                    onChange={(e) => setUProgName(e.target.value)}
                    placeholder="MSc Data Science"
                    className="field-input"
                  />
                </div>
                <div>
                  <label className="block text-xs text-ink-secondary mb-1">Degree level</label>
                  <select
                    value={uProgDegree}
                    onChange={(e) => setUProgDegree(e.target.value as any)}
                    className="field-input"
                  >
                    <option value="Master's">Master's</option>
                    <option value="Bachelor's">Bachelor's</option>
                    <option value="Doctorate">Doctorate</option>
                    <option value="Foundation">Foundation</option>
                    <option value="Diploma">Diploma</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <label className="block text-xs text-ink-secondary mb-1">Intake</label>
                  <input
                    value={uProgIntake}
                    onChange={(e) => setUProgIntake(e.target.value)}
                    className="field-input text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs text-ink-secondary mb-1">Deadline</label>
                  <input
                    type="date"
                    value={uProgDeadline}
                    onChange={(e) => setUProgDeadline(e.target.value)}
                    className="field-input font-mono text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs text-ink-secondary mb-1">Min GPA</label>
                  <input
                    type="number"
                    step="0.1"
                    value={uProgMinGpa}
                    onChange={(e) => setUProgMinGpa(e.target.value)}
                    className="field-input font-mono text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs text-ink-secondary mb-1">Min IELTS</label>
                  <input
                    type="number"
                    step="0.5"
                    value={uProgMinIelts}
                    onChange={(e) => setUProgMinIelts(e.target.value)}
                    className="field-input font-mono text-xs"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs text-ink-secondary mb-1">Tuition fee</label>
                <input
                  value={uProgTuition}
                  onChange={(e) => setUProgTuition(e.target.value)}
                  placeholder="GBP 31,800 / yr"
                  className="field-input font-mono text-xs"
                />
              </div>
              <div className="flex justify-end gap-2 pt-3 border-t border-hairline">
                <button type="button" onClick={() => setIsAddUniOpen(false)} className="btn-secondary">
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
                  Save university
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
