import React, { useState, useEffect } from 'react';
import { Sidebar, NavTab } from './components/Sidebar';
import { Header } from './components/Header';
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
} from 'admitpilot-shared';

export const App: React.FC = () => {
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
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [viewScope, setViewScope] = useState<'assigned' | 'all'>('all');
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    try {
      return localStorage.getItem('admitpilot-theme') === 'light' ? 'light' : 'dark';
    } catch {
      return 'dark';
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
    loadAllData();
  }, []);

  const loadAllData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [health, cands, apps, settings, me, org, members, desks] = await Promise.all([
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
    setViewScope(user.role !== 'org_admin' ? 'assigned' : 'all');
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
        onSelectTab={setCurrentTab}
        candidateCount={scopedCandidates.length}
        applicationCount={scopedApplications.length}
        teamCount={teamMembers.length}
        organizationName={organization?.name}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Header
          searchTerm={searchTerm}
          onSearchChange={(val) => {
            setSearchTerm(val);
            if (val && currentTab !== 'candidates') {
              setCurrentTab('candidates');
            }
          }}
          activeCandidateName={
            selectedCandidate
              ? `${selectedCandidate.personal.legalGivenName} ${selectedCandidate.personal.familyName}`
              : undefined
          }
          currentUser={currentUser}
          isAdminActive={currentTab === 'admin-profile'}
          theme={theme}
          onToggleTheme={() => setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'))}
          storageStatus={storageStatus}
          onOpenActiveCandidate={() => setCurrentTab('candidates')}
          onOpenAdminProfile={() => setCurrentTab('admin-profile')}
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
                {currentUser &&
                  (currentTab === 'dashboard' ||
                    currentTab === 'candidates' ||
                    currentTab === 'applications') && (
                    <div className="mb-5 p-2.5 rounded-xl bg-surface-card border border-hairline flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-center gap-2 text-xs text-ink-secondary">
                        <span>
                          Signed in as{' '}
                          <span className="text-ink-primary font-medium">{currentUser.fullName}</span>
                        </span>
                        <span className="text-ink-muted">·</span>
                        <span className="font-mono text-brass">
                          {assignedCandidates.length} assigned students · {assignedApplications.length}{' '}
                          applications
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => setViewScope('assigned')}
                          className={`h-7 px-3 rounded-lg text-xs transition-colors ${
                            viewScope === 'assigned'
                              ? 'bg-surface-raised border border-brass-border text-ink-primary font-medium'
                              : 'text-ink-secondary hover:text-ink-primary border border-transparent'
                          }`}
                        >
                          My assigned ({assignedCandidates.length})
                        </button>
                        <button
                          type="button"
                          onClick={() => setViewScope('all')}
                          className={`h-7 px-3 rounded-lg text-xs transition-colors ${
                            viewScope === 'all'
                              ? 'bg-surface-raised border border-brass-border text-ink-primary font-medium'
                              : 'text-ink-secondary hover:text-ink-primary border border-transparent'
                          }`}
                        >
                          All agency ({candidates.length})
                        </button>
                      </div>
                    </div>
                  )}

                {currentTab === 'dashboard' && (
                  <DashboardStats
                    candidates={scopedCandidates}
                    applications={scopedApplications}
                    selectedCandidate={
                      (selectedCandidate &&
                        scopedCandidates.find((c) => c.id === selectedCandidate.id)) ||
                      scopedCandidates[0] ||
                      null
                    }
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

                    {selectedCandidate && (
                      <CandidateDetail
                        candidate={selectedCandidate}
                        documents={candidateDocs}
                        credentials={candidateCreds}
                        members={teamMembers}
                        countryTeams={countryTeams}
                        onUploadDocuments={handleUploadDocuments}
                        onReextractDocument={handleReextractDocument}
                        onDeleteDocument={handleDeleteDocument}
                        onSaveCredential={handleSaveCredential}
                        onDeleteCredential={handleDeleteCredential}
                        onEditCandidate={() => {
                          setEditingCandidate(selectedCandidate);
                          setIsCandidateModalOpen(true);
                        }}
                        onUpdateRouting={(updates) =>
                          handleAssignCandidate(selectedCandidate.id, updates)
                        }
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
                    onSelectDocument={(doc) => setReviewDoc(doc)}
                    onReconcile={handleReconcileField}
                    onReextract={handleReextractDocument}
                  />
                )}

                {currentTab === 'applications' && (
                  <ApplicationTracker
                    applications={scopedApplications}
                    candidates={scopedCandidates}
                    countryTeams={countryTeams}
                    onCreateApplication={handleCreateApplication}
                    onUpdateApplication={handleUpdateApplication}
                    onDeleteApplication={handleDeleteApplication}
                  />
                )}

                {currentTab === 'testing' && selectedCandidate && (
                  <TestFormRunner
                    candidate={selectedCandidate}
                    onMatchFields={api.matchFields}
                  />
                )}

                {currentTab === 'organization' && (
                  <OrganizationView
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
                    onOpenAgencySettings={() => setCurrentTab('admin-profile')}
                  />
                )}

                {currentTab === 'ai-settings' && (
                  <AISettingsView settings={aiSettings} onSave={handleSaveAISettings} />
                )}

                {currentTab === 'admin-profile' && (
                  <AdminProfileView
                    currentUser={currentUser}
                    organization={organization}
                    countryTeams={countryTeams}
                    candidates={candidates}
                    aiSettings={aiSettings}
                    onSaveProfile={handleSaveMyProfile}
                    onSaveOrganization={handleSaveOrganization}
                    onOpenModelProviders={() => setCurrentTab('ai-settings')}
                    onOpenTeamDesks={() => setCurrentTab('organization')}
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
      />
    </div>
  );
};
