import React, { useState, useEffect } from 'react';
import { Sidebar, NavTab } from './components/Sidebar';
import { Header, WorkspaceAlert } from './components/Header';
import { DashboardStats } from './components/DashboardStats';
import { CandidateList } from './components/CandidateList';
import { CandidateDetail } from './components/CandidateDetail';
import { CandidateFormModal } from './components/CandidateFormModal';
import { DocumentReview } from './components/DocumentReview';
import { ApplicationTracker } from './components/ApplicationTracker';
import { AISettingsView } from './components/AISettingsView';
import { TestFormRunner } from './components/TestFormRunner';
import { OrganizationView } from './components/OrganizationView';
import { AdminProfileView } from './components/AdminProfileView';
import { LoginModal } from './components/LoginModal';
import { ClientIntakePortal } from './components/ClientIntakePortal';
import { api } from './api';
import {
  CandidateProfile,
  CandidateDocument,
  CandidatePortalCredential,
  ApplicationRecord,
  AISettings,
  Organization,
  UserProfile,
  CountryTeam,
  DocumentCategory,
  UniversityCatalogItem,
} from 'admitpilot-shared';

export const App: React.FC = () => {
  const publicIntakeToken =
    typeof window !== 'undefined'
      ? new URLSearchParams(window.location.search).get('intake')
      : null;

  if (publicIntakeToken) {
    return <ClientIntakePortal token={publicIntakeToken} />;
  }

  const [currentTab, setCurrentTab] = useState<NavTab>('dashboard');
  const [candidates, setCandidates] = useState<CandidateProfile[]>([]);
  const [selectedCandidate, setSelectedCandidate] = useState<CandidateProfile | null>(null);
  const [candidateDocs, setCandidateDocs] = useState<CandidateDocument[]>([]);
  const [candidateCreds, setCandidateCreds] = useState<CandidatePortalCredential[]>([]);
  const [reviewDoc, setReviewDoc] = useState<CandidateDocument | null>(null);
  const [applications, setApplications] = useState<ApplicationRecord[]>([]);
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [teamMembers, setTeamMembers] = useState<UserProfile[]>([]);
  const [countryTeams, setCountryTeams] = useState<CountryTeam[]>([]);
  const [universities, setUniversities] = useState<UniversityCatalogItem[]>([]);
  const [storageStatus, setStorageStatus] = useState<{
    engine?: 'supabase_postgres' | 'local_json';
    connected?: boolean;
    host?: string;
  }>({});
  const [aiSettings, setAiSettings] = useState<AISettings>({
    provider: 'gemini',
    model: 'gemini-2.5-flash',
    privacyMode: false,
    temperature: 0.1,
  });

  const [searchTerm, setSearchTerm] = useState('');
  const [isCandidateModalOpen, setIsCandidateModalOpen] = useState(false);
  const [candidateViewMode, setCandidateViewMode] = useState<'list' | 'detail'>('list');
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [viewScope, setViewScope] = useState<'assigned' | 'all'>('all');
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    try {
      return localStorage.getItem('admitpilot-theme') === 'light' ? 'light' : 'dark';
    } catch {
      return 'dark';
    }
  });
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(() => {
    try {
      return localStorage.getItem('admitpilot-sidebar-collapsed') === 'true';
    } catch {
      return false;
    }
  });
  const [editingCandidate, setEditingCandidate] = useState<CandidateProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    try {
      localStorage.setItem('admitpilot-theme', theme);
    } catch {
      // ignore storage errors
    }
  }, [theme]);

  useEffect(() => {
    if (!currentUser || currentUser.role === 'org_admin') return;
    setViewScope('assigned');
    if (
      currentTab === 'team' ||
      currentTab === 'country-desks' ||
      currentTab === 'ai-settings' ||
      currentTab === 'agency-settings'
    ) {
      setCurrentTab('dashboard');
    }
  }, [currentUser?.id, currentUser?.role, currentTab]);

  useEffect(() => {
    loadAllData();
  }, []);

  const loadAllData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [health, cands, apps, settings, me, org, members, desks, unis] = await Promise.all([
        api.checkHealth().catch(() => null),
        api.getCandidates(),
        api.getApplications(),
        api.getAISettings().catch(() => ({
          provider: 'gemini' as const,
          model: 'gemini-2.5-flash',
          privacyMode: false,
          temperature: 0.1,
        })),
        api.getMe().catch(() => null),
        api.getOrganization().catch(() => null),
        api.getTeamMembers().catch(() => []),
        api.getCountryTeams().catch(() => []),
        api.getUniversities().catch(() => []),
      ]);
      if (health) {
        setStorageStatus({
          engine: health.storageEngine,
          connected: health.databaseConnected,
          host: health.databaseHost,
        });
      }
      setCandidates(cands);
      setApplications(apps);
      setAiSettings(settings);
      setCurrentUser(me);
      if (me?.role && me.role !== 'org_admin') {
        setViewScope('assigned');
      }
      setOrganization(org);
      setTeamMembers(members);
      setCountryTeams(desks);
      setUniversities(unis);

      if (cands.length > 0) {
        const target = selectedCandidate
          ? cands.find((c) => c.id === selectedCandidate.id) || cands[0]
          : cands[0];
        setSelectedCandidate(target);
        await loadCandidateSubresources(target.id);
      }
    } catch (err: any) {
      console.error('Failed to load dashboard data:', err);
      setError(err.message || 'Could not connect to AdmitPilot backend');
    } finally {
      setLoading(false);
    }
  };

  const refreshTeamState = async () => {
    const [me, org, members, desks] = await Promise.all([
      api.getMe().catch(() => currentUser),
      api.getOrganization().catch(() => organization),
      api.getTeamMembers().catch(() => teamMembers),
      api.getCountryTeams().catch(() => countryTeams),
    ]);
    setCurrentUser(me);
    setOrganization(org);
    setTeamMembers(members);
    setCountryTeams(desks);
  };

  const loadCandidateSubresources = async (candidateId: string) => {
    try {
      const [docs, creds] = await Promise.all([
        api.getDocuments(candidateId).catch(() => []),
        api.getCredentials(candidateId).catch(() => []),
      ]);
      setCandidateDocs(docs);
      setCandidateCreds(creds);
      setReviewDoc((prev) => {
        if (prev && docs.some((d) => d.id === prev.id)) {
          return docs.find((d) => d.id === prev.id) || docs[0] || null;
        }
        return docs[0] || null;
      });
    } catch (err) {
      console.warn('Failed to load candidate subresources:', err);
    }
  };

  const handleSelectCandidate = (c: CandidateProfile) => {
    setSelectedCandidate(c);
    setCandidateViewMode('detail');
    loadCandidateSubresources(c.id);
  };

  const handleSaveCandidate = async (
    candidateData: Partial<CandidateProfile> & { managedStudentEmailPassword?: string }
  ) => {
    try {
      if (candidateData.id && candidates.some((c) => c.id === candidateData.id)) {
        const updated = await api.updateCandidate(candidateData.id, candidateData);
        setCandidates((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
        if (selectedCandidate?.id === updated.id) {
          setSelectedCandidate(updated);
          await loadCandidateSubresources(updated.id);
        }
      } else {
        const created = await api.createCandidate(candidateData);
        setCandidates((prev) => [created, ...prev]);
        setSelectedCandidate(created);
        await loadCandidateSubresources(created.id);
      }
    } catch (err: any) {
      alert('Error saving candidate: ' + err.message);
    }
  };

  const handleAssignCandidate = async (candidateId: string, updates: Partial<CandidateProfile>) => {
    const updated = await api.updateCandidate(candidateId, updates);
    setCandidates((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
    if (selectedCandidate?.id === updated.id) {
      setSelectedCandidate(updated);
    }
  };

  const handleDeleteCandidate = async (id: string) => {
    try {
      await api.deleteCandidate(id);
      setCandidates((prev) => prev.filter((c) => c.id !== id));
      setApplications((prev) => prev.filter((a) => a.candidateId !== id));
      if (selectedCandidate?.id === id) {
        const next = candidates.find((c) => c.id !== id) || null;
        setSelectedCandidate(next);
        if (next) loadCandidateSubresources(next.id);
        else {
          setCandidateDocs([]);
          setCandidateCreds([]);
        }
      }
    } catch (err: any) {
      alert('Failed to delete candidate: ' + err.message);
    }
  };

  const handleArchiveCandidate = async (id: string) => {
    try {
      await api.archiveCandidate(id);
      setCandidates((prev) =>
        prev.map((c) => (c.id === id ? { ...c, status: 'archived' as const } : c))
      );
      if (selectedCandidate?.id === id) {
        setSelectedCandidate({ ...selectedCandidate, status: 'archived' });
      }
    } catch (err: any) {
      alert('Failed to archive candidate: ' + err.message);
    }
  };

  const handleRestoreCandidate = async (id: string) => {
    try {
      await api.restoreCandidate(id);
      setCandidates((prev) =>
        prev.map((c) => (c.id === id ? { ...c, status: 'active' as const } : c))
      );
      if (selectedCandidate?.id === id) {
        setSelectedCandidate({ ...selectedCandidate, status: 'active' });
      }
    } catch (err: any) {
      alert('Failed to restore candidate: ' + err.message);
    }
  };

  // Multi-file document upload, re-extract & delete
  const handleUploadDocuments = async (files: File[], category?: DocumentCategory | 'auto') => {
    if (!selectedCandidate) return;
    const res = await api.uploadDocuments(selectedCandidate.id, files, category);
    const uploadedList = res.documents || [res.document];
    setCandidateDocs((prev) => [...uploadedList, ...prev]);
    setReviewDoc(uploadedList[0]);
    setSelectedCandidate(res.updatedCandidate);
    setCandidates((prev) =>
      prev.map((c) => (c.id === res.updatedCandidate.id ? res.updatedCandidate : c))
    );
    setCurrentTab('documents');
  };

  const handleReextractDocument = async (docId: string, category?: DocumentCategory | 'auto') => {
    if (!selectedCandidate) return;
    const res = await api.reextractDocument(selectedCandidate.id, docId, category);
    setCandidateDocs((prev) => prev.map((d) => (d.id === res.document.id ? res.document : d)));
    setReviewDoc(res.document);
    setSelectedCandidate(res.updatedCandidate);
    setCandidates((prev) =>
      prev.map((c) => (c.id === res.updatedCandidate.id ? res.updatedCandidate : c))
    );
  };

  const handleUpdateDocumentCategory = async (docId: string, category: DocumentCategory) => {
    if (!selectedCandidate) return;
    const updatedDoc = await api.updateDocumentCategory(selectedCandidate.id, docId, category);
    setCandidateDocs((prev) => prev.map((d) => (d.id === updatedDoc.id ? updatedDoc : d)));
    setReviewDoc(updatedDoc);
  };

  const handleDeleteDocument = async (docId: string) => {
    if (!selectedCandidate) return;
    await api.deleteDocument(selectedCandidate.id, docId);
    setCandidateDocs((prev) => {
      const remaining = prev.filter((d) => d.id !== docId);
      if (reviewDoc?.id === docId) {
        setReviewDoc(remaining[0] || null);
      }
      return remaining;
    });
  };

  // Credentials vault CRUD
  const handleSaveCredential = async (
    payload: Partial<CandidatePortalCredential> & { label: string; loginEmail: string },
    credId?: string
  ) => {
    if (!selectedCandidate) return;
    if (credId) {
      await api.updateCredential(selectedCandidate.id, credId, payload);
    } else {
      await api.createCredential(selectedCandidate.id, payload);
    }
    const [freshCand, freshCreds] = await Promise.all([
      api.getCandidate(selectedCandidate.id),
      api.getCredentials(selectedCandidate.id),
    ]);
    setSelectedCandidate(freshCand);
    setCandidates((prev) => prev.map((c) => (c.id === freshCand.id ? freshCand : c)));
    setCandidateCreds(freshCreds);
  };

  const handleDeleteCredential = async (credId: string) => {
    if (!selectedCandidate) return;
    await api.deleteCredential(selectedCandidate.id, credId);
    setCandidateCreds((prev) => prev.filter((cr) => cr.id !== credId));
  };

  const handleRecordPayment = async (payload: {
    id?: string;
    title: string;
    amount: string;
    paidDate?: string;
    paymentMethod?: string;
    referenceNumber?: string;
    status?: string;
    notes?: string;
    receiptFile?: File | null;
  }) => {
    if (!selectedCandidate) return;
    const res = await api.recordCandidatePayment(selectedCandidate.id, payload);
    setSelectedCandidate(res.updatedCandidate);
    setCandidates((prev) =>
      prev.map((c) => (c.id === res.updatedCandidate.id ? res.updatedCandidate : c))
    );
    if (res.receiptDocument) {
      setCandidateDocs((prev) => [res.receiptDocument!, ...prev]);
    }
  };

  const handleDeletePayment = async (paymentId: string) => {
    if (!selectedCandidate) return;
    const res = await api.deleteCandidatePayment(selectedCandidate.id, paymentId);
    setSelectedCandidate(res.updatedCandidate);
    setCandidates((prev) =>
      prev.map((c) => (c.id === res.updatedCandidate.id ? res.updatedCandidate : c))
    );
  };

  const handleReconcileField = async (
    fieldKey: string,
    approvedValue: any,
    note?: string,
    documentId?: string
  ) => {
    if (!selectedCandidate) return;
    try {
      const updated = await api.reconcileField(
        selectedCandidate.id,
        fieldKey,
        approvedValue,
        note,
        documentId
      );
      setSelectedCandidate(updated);
      setCandidates((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
      if (documentId) {
        const docs = await api.getDocuments(selectedCandidate.id);
        setCandidateDocs(docs);
        const refreshed = docs.find((d) => d.id === documentId);
        if (refreshed) setReviewDoc(refreshed);
      }
    } catch (err: any) {
      alert('Reconciliation failed: ' + err.message);
    }
  };

  // Applications CRUD
  const handleCreateApplication = async (appData: Partial<ApplicationRecord>) => {
    const created = await api.createApplication(appData);
    setApplications((prev) => [created, ...prev]);
  };

  const handleUpdateApplication = async (
    appId: string,
    updates: Partial<ApplicationRecord> & { newTimelineNote?: string; newTimelineType?: string }
  ): Promise<ApplicationRecord> => {
    const updated = await api.updateApplication(appId, updates);
    setApplications((prev) => prev.map((a) => (a.id === appId ? updated : a)));
    return updated;
  };

  const handleDeleteApplication = async (appId: string) => {
    await api.deleteApplication(appId);
    setApplications((prev) => prev.filter((a) => a.id !== appId));
  };

  const handleBatchCreateApplications = async (payload: {
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
  }) => {
    const created = await api.batchCreateApplications(payload);
    setApplications((prev) => [...created, ...prev]);
  };

  const handleCreateUniversity = async (
    uni: Partial<UniversityCatalogItem> & { name: string; country: string }
  ) => {
    const saved = await api.createUniversity(uni);
    setUniversities((prev) => {
      const idx = prev.findIndex((u) => u.id === saved.id);
      if (idx >= 0) return prev.map((u) => (u.id === saved.id ? saved : u));
      return [saved, ...prev];
    });
  };

  const handleSaveAISettings = async (newSettings: Partial<AISettings>) => {
    const updated = await api.saveAISettings(newSettings);
    setAiSettings(updated);
  };

  // Admin & Team handlers
  const handleSaveMyProfile = async (updates: Partial<UserProfile>) => {
    const saved = await api.updateMe(updates);
    setCurrentUser(saved);
    setTeamMembers((prev) => prev.map((m) => (m.id === saved.id ? saved : m)));
  };

  const handleSaveOrganization = async (updates: Partial<Organization>) => {
    const saved = await api.updateOrganization(updates);
    setOrganization(saved);
  };

  const handleCreateMember = async (
    member: Partial<UserProfile> & { email: string; fullName: string; loginPassword?: string }
  ) => {
    await api.createTeamMember(member);
    await refreshTeamState();
  };

  const handleUpdateMember = async (id: string, updates: Partial<UserProfile>) => {
    await api.updateTeamMember(id, updates);
    await refreshTeamState();
  };

  const handleSetMemberPassword = async (userId: string, password: string) => {
    await api.setMemberPassword(userId, password);
    await refreshTeamState();
  };

  const handleLogin = async (email: string, password: string) => {
    const { user } = await api.login(email, password);
    setSelectedCandidate(null);
    setCandidateDocs([]);
    setCandidateCreds([]);
    setReviewDoc(null);
    setViewScope(user.role !== 'org_admin' ? 'assigned' : 'all');
    await loadAllData();
  };

  const handleRegisterAgency = async (payload: {
    agencyName: string;
    fullName: string;
    email: string;
    password: string;
    headquarters?: string;
    operatingCountries?: string[];
  }) => {
    await api.registerAgency(payload);
    setSelectedCandidate(null);
    setCandidateDocs([]);
    setCandidateCreds([]);
    setReviewDoc(null);
    setViewScope('all');
    setCurrentTab('dashboard');
    await loadAllData();
  };

  const handleDeleteMember = async (id: string) => {
    await api.deleteTeamMember(id);
    const [cands] = await Promise.all([api.getCandidates(), refreshTeamState()]);
    setCandidates(cands);
  };

  const handleCreateCountryTeam = async (
    team: Partial<CountryTeam> & { name: string; code: string; countries: string[]; memberIds?: string[] }
  ) => {
    await api.createCountryTeam(team);
    await refreshTeamState();
  };

  const handleUpdateCountryTeam = async (
    id: string,
    team: Partial<CountryTeam> & { memberIds?: string[] }
  ) => {
    await api.updateCountryTeam(id, team);
    await refreshTeamState();
  };

  const handleToggleDeskMember = async (
    teamId: string,
    userId: string,
    action: 'add' | 'remove'
  ) => {
    await api.updateCountryTeamMember(teamId, userId, action);
    await refreshTeamState();
  };

  const handleDeleteCountryTeam = async (id: string) => {
    await api.deleteCountryTeam(id);
    const [cands] = await Promise.all([api.getCandidates(), refreshTeamState()]);
    setCandidates(cands);
  };

  const isCandidateAssignedToMe = (c: CandidateProfile): boolean => {
    if (!currentUser) return true;
    if (c.assignedConsultantId === currentUser.id) return true;
    if (
      !c.assignedConsultantId &&
      c.countryTeamId &&
      (currentUser.countryTeamIds || []).includes(c.countryTeamId)
    ) {
      return true;
    }
    return false;
  };

  const assignedCandidates = candidates.filter(isCandidateAssignedToMe);
  const assignedCandidateIds = new Set(assignedCandidates.map((c) => c.id));
  const assignedApplications = applications.filter(
    (app) =>
      (currentUser && app.assignedConsultantId === currentUser.id) ||
      assignedCandidateIds.has(app.candidateId)
  );

  const scopedCandidates = viewScope === 'assigned' ? assignedCandidates : candidates;
  const scopedApplications = viewScope === 'assigned' ? assignedApplications : applications;

  const workspaceAlerts: WorkspaceAlert[] = (() => {
    const list: WorkspaceAlert[] = [];
    const nowMs = Date.now();
    const fourteenDaysMs = 14 * 24 * 60 * 60 * 1000;

    if (currentUser?.notifications?.conflictAlerts !== false) {
      for (const c of scopedCandidates) {
        const conflictCount = Object.keys(c.conflicts || {}).length;
        if (conflictCount > 0) {
          list.push({
            id: `conflict-${c.id}`,
            kind: 'conflict',
            title: `${c.personal.legalGivenName} ${c.personal.familyName}`,
            subtitle: `${conflictCount} field discrepanc${conflictCount === 1 ? 'y' : 'ies'} need review`,
            tone: 'negative',
            candidateId: c.id,
          });
        }
      }
    }

    if (currentUser?.notifications?.portalDeadlines !== false) {
      for (const app of scopedApplications) {
        if (!app.deadline || ['enrolled', 'rejected', 'withdrawn'].includes(app.status)) continue;
        const dueMs = Date.parse(app.deadline);
        if (!Number.isNaN(dueMs) && dueMs - nowMs <= fourteenDaysMs) {
          const daysLeft = Math.ceil((dueMs - nowMs) / (24 * 60 * 60 * 1000));
          list.push({
            id: `deadline-${app.id}`,
            kind: 'deadline',
            title: `${app.institutionName} (${app.programName})`,
            subtitle:
              daysLeft < 0
                ? `Overdue by ${Math.abs(daysLeft)} day${Math.abs(daysLeft) === 1 ? '' : 's'} (${app.deadline})`
                : daysLeft === 0
                  ? `Due today (${app.deadline})`
                  : `Due in ${daysLeft} day${daysLeft === 1 ? '' : 's'} (${app.deadline})`,
            tone: daysLeft <= 3 ? 'negative' : 'brass',
            candidateId: app.candidateId,
          });
        }
      }
    }

    return list;
  })();

  const filteredCandidates = scopedCandidates.filter((c) => {
    const q = searchTerm.toLowerCase();
    if (!q) return true;
    return (
      c.personal.legalGivenName.toLowerCase().includes(q) ||
      c.personal.familyName.toLowerCase().includes(q) ||
      c.contact.email.toLowerCase().includes(q) ||
      (c.contact.managedStudentEmail || '').toLowerCase().includes(q) ||
      c.passport?.passportNumber?.toLowerCase().includes(q) ||
      c.personal.nationality.toLowerCase().includes(q)
    );
  });

  return (
    <div className="flex h-screen overflow-hidden bg-surface-page text-ink-primary">
      {/* Sidebar */}
      <Sidebar
        currentTab={currentTab}
        onSelectTab={(tab) => {
          if (tab === 'candidates') {
            setCandidateViewMode('list');
          }
          setCurrentTab(tab);
        }}
        candidateCount={scopedCandidates.length}
        applicationCount={scopedApplications.length}
        teamCount={teamMembers.length}
        countryTeamsCount={countryTeams.length}
        conflictCount={workspaceAlerts.filter((a) => a.kind === 'conflict').length}
        organizationName={organization?.name}
        userRole={currentUser?.role}
        collapsed={sidebarCollapsed}
        onToggleCollapse={() =>
          setSidebarCollapsed((prev) => {
            const next = !prev;
            try {
              localStorage.setItem('admitpilot-sidebar-collapsed', String(next));
            } catch {
              // ignore storage errors
            }
            return next;
          })
        }
        storageStatus={storageStatus}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Header
          currentTab={currentTab}
          candidateViewMode={candidateViewMode}
          searchTerm={searchTerm}
          onSearchChange={(val) => {
            setSearchTerm(val);
            if (val && currentTab !== 'candidates') {
              setCurrentTab('candidates');
            }
          }}
          activeCandidateName={
            selectedCandidate && scopedCandidates.some((c) => c.id === selectedCandidate.id)
              ? `${selectedCandidate.personal.legalGivenName} ${selectedCandidate.personal.familyName}`
              : undefined
          }
          currentUser={currentUser}
          isAdminActive={currentTab === 'admin-profile'}
          theme={theme}
          onToggleTheme={() => setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'))}
          alerts={workspaceAlerts}
          onSelectAlert={(alert) => {
            if (alert.kind === 'deadline') {
              setCurrentTab('applications');
              return;
            }
            if (alert.candidateId) {
              const target = scopedCandidates.find((c) => c.id === alert.candidateId);
              if (target) {
                handleSelectCandidate(target);
                setCurrentTab('candidates');
              }
            }
          }}
          viewScope={viewScope}
          onChangeViewScope={setViewScope}
          assignedCount={assignedCandidates.length}
          totalCount={candidates.length}
          onOpenAdminProfile={() => setCurrentTab('admin-profile')}
          onOpenAgencySettings={() => setCurrentTab('agency-settings')}
          onSwitchAccount={() => setIsLoginModalOpen(true)}
        />

        <main className="flex-1 overflow-y-auto px-6 py-6 lg:px-8 lg:py-7">
          <div className="max-w-[1440px] mx-auto animate-panel-enter">
            {loading ? (
              <div className="flex items-center justify-center h-64 text-ink-secondary text-sm">
                <div className="flex items-center gap-3">
                  <span className="w-4 h-4 border-2 border-ink-muted border-t-ink-primary rounded-full animate-spin" />
                  <span>Loading admissions workspace</span>
                </div>
              </div>
            ) : error ? (
              <div className="p-6 rounded-xl bg-surface-card border border-hairline text-sm space-y-3 max-w-xl">
                <p className="font-medium text-tone-negative">Backend connection unavailable</p>
                <p className="text-ink-secondary text-[13px]">{error}</p>
                <button onClick={loadAllData} className="btn-secondary">
                  Retry connection
                </button>
              </div>
            ) : (
              <>
                {currentTab === 'dashboard' && (
                  <DashboardStats
                    candidates={scopedCandidates}
                    applications={scopedApplications}
                    viewScope={viewScope}
                    isOrgAdmin={currentUser?.role === 'org_admin'}
                    onSelectTab={setCurrentTab}
                    onSelectCandidate={handleSelectCandidate}
                    onNewCandidate={() => {
                      setEditingCandidate(null);
                      setIsCandidateModalOpen(true);
                    }}
                  />
                )}

                {currentTab === 'candidates' && (
                  <div className="space-y-6">
                    {candidateViewMode === 'list' || !selectedCandidate ? (
                      <CandidateList
                        candidates={filteredCandidates}
                        selectedCandidate={selectedCandidate}
                        members={teamMembers}
                        countryTeams={countryTeams}
                        onSelectCandidate={handleSelectCandidate}
                        onNewCandidate={() => {
                          setEditingCandidate(null);
                          setIsCandidateModalOpen(true);
                        }}
                      />
                    ) : (
                      <CandidateDetail
                        candidate={selectedCandidate}
                        documents={candidateDocs}
                        credentials={candidateCreds}
                        applications={scopedApplications.filter(
                          (a) => a.candidateId === selectedCandidate.id
                        )}
                        members={teamMembers}
                        countryTeams={countryTeams}
                        onBackToList={() => setCandidateViewMode('list')}
                        onOpenApplicationsTab={() => setCurrentTab('applications')}
                        onUploadDocuments={handleUploadDocuments}
                        onReextractDocument={handleReextractDocument}
                        onDeleteDocument={handleDeleteDocument}
                        onSaveCredential={handleSaveCredential}
                        onDeleteCredential={handleDeleteCredential}
                        onRecordPayment={handleRecordPayment}
                        onDeletePayment={handleDeletePayment}
                        onEditCandidate={() => {
                          setEditingCandidate(selectedCandidate);
                          setIsCandidateModalOpen(true);
                        }}
                        onUpdateRouting={(updates) =>
                          handleAssignCandidate(selectedCandidate.id, updates)
                        }
                        onCandidateUpdated={(updated) => {
                          setSelectedCandidate(updated);
                          setCandidates((prev) =>
                            prev.map((c) => (c.id === updated.id ? updated : c))
                          );
                        }}
                        onDeleteCandidate={handleDeleteCandidate}
                        onArchiveCandidate={handleArchiveCandidate}
                        onRestoreCandidate={handleRestoreCandidate}
                        onSelectReviewDoc={(doc) => {
                          setReviewDoc(doc);
                          setCurrentTab('documents');
                        }}
                      />
                    )}
                  </div>
                )}

                {currentTab === 'documents' && (
                  <DocumentReview
                    document={reviewDoc}
                    allDocuments={candidateDocs}
                    candidate={selectedCandidate}
                    candidates={scopedCandidates}
                    onSelectCandidate={(c) => {
                      setSelectedCandidate(c);
                      loadCandidateSubresources(c.id);
                    }}
                    onSelectDocument={(doc) => setReviewDoc(doc)}
                    onReconcile={handleReconcileField}
                    onReextract={handleReextractDocument}
                    onUpdateCategory={handleUpdateDocumentCategory}
                    onUploadDocuments={handleUploadDocuments}
                  />
                )}

                {currentTab === 'applications' && (
                  <ApplicationTracker
                    applications={scopedApplications}
                    candidates={scopedCandidates}
                    countryTeams={countryTeams}
                    universities={universities}
                    isOrgAdmin={currentUser?.role === 'org_admin'}
                    onCreateApplication={handleCreateApplication}
                    onBatchCreateApplications={handleBatchCreateApplications}
                    onCreateUniversity={handleCreateUniversity}
                    onUpdateApplication={handleUpdateApplication}
                    onDeleteApplication={handleDeleteApplication}
                  />
                )}

                {currentTab === 'testing' && selectedCandidate && (
                  <TestFormRunner
                    candidate={selectedCandidate}
                    candidates={scopedCandidates}
                    onSelectCandidate={(cand) => {
                      setSelectedCandidate(cand);
                      loadCandidateSubresources(cand.id);
                    }}
                    onMatchFields={api.matchFields}
                  />
                )}

                {(currentTab === 'team' || currentTab === 'country-desks') && (
                  <OrganizationView
                    mode={currentTab === 'team' ? 'directory' : 'desks'}
                    candidates={candidates}
                    applications={applications}
                    members={teamMembers}
                    countryTeams={countryTeams}
                    operatingCountries={organization?.operatingCountries}
                    currentUserId={currentUser?.id}
                    onCreateMember={handleCreateMember}
                    onUpdateMember={handleUpdateMember}
                    onSetMemberPassword={handleSetMemberPassword}
                    onDeleteMember={handleDeleteMember}
                    onCreateCountryTeam={handleCreateCountryTeam}
                    onUpdateCountryTeam={handleUpdateCountryTeam}
                    onToggleDeskMember={handleToggleDeskMember}
                    onDeleteCountryTeam={handleDeleteCountryTeam}
                    onAssignCandidate={handleAssignCandidate}
                    onSelectCandidateDossier={(cand) => {
                      handleSelectCandidate(cand);
                      setCurrentTab('candidates');
                    }}
                    onOpenAgencySettings={() => setCurrentTab('agency-settings')}
                  />
                )}

                {currentTab === 'ai-settings' && (
                  <AISettingsView settings={aiSettings} onSave={handleSaveAISettings} />
                )}

                {(currentTab === 'agency-settings' || currentTab === 'admin-profile') && (
                  <AdminProfileView
                    mode={currentTab === 'agency-settings' ? 'agency' : 'profile'}
                    currentUser={currentUser}
                    organization={organization}
                    countryTeams={countryTeams}
                    candidates={candidates}
                    aiSettings={aiSettings}
                    onSaveProfile={handleSaveMyProfile}
                    onSaveOrganization={handleSaveOrganization}
                    onOpenModelProviders={() => setCurrentTab('ai-settings')}
                    onOpenTeamDesks={() => setCurrentTab('country-desks')}
                  />
                )}
              </>
            )}
          </div>
        </main>
      </div>

      {/* Candidate Form Modal */}
      <CandidateFormModal
        isOpen={isCandidateModalOpen}
        initialData={editingCandidate}
        members={teamMembers}
        countryTeams={countryTeams}
        operatingCountries={organization?.operatingCountries}
        onClose={() => setIsCandidateModalOpen(false)}
        onSave={handleSaveCandidate}
      />

      {/* Account Login / Switcher Modal */}
      <LoginModal
        isOpen={isLoginModalOpen}
        members={teamMembers}
        currentUserId={currentUser?.id}
        onClose={() => setIsLoginModalOpen(false)}
        onLogin={handleLogin}
        onRegisterAgency={handleRegisterAgency}
      />
    </div>
  );
};
