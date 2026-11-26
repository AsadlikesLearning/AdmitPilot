import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import '../style.css';
import {
  GraduationCap,
  FileSearch,
  ScanSearch,
  AlertTriangle,
  Play,
  MessageSquare,
  Send,
  ShieldCheck,
  Check,
  X,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Globe,
  Info,
  RefreshCw,
  Edit2,
  CheckCircle,
  KeyRound,
  Copy,
  Paperclip,
  Download,
  FileText,
} from 'lucide-react';
import {
  CandidateProfile,
  CandidateDocument,
  CandidatePortalCredential,
  FormField,
  FieldMapping,
  FileFieldMapping,
  UniversityRequirementReport,
  UserProfile,
} from 'admitpilot-shared';
import { apiFetch, getExtensionMe, loginExtension, logAutofillAudit } from '../lib/api';

export const SidePanel: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [authOpen, setAuthOpen] = useState<boolean>(false);
  const [authEmail, setAuthEmail] = useState<string>('');
  const [authPassword, setAuthPassword] = useState<string>('');
  const [authBusy, setAuthBusy] = useState<boolean>(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const [candidates, setCandidates] = useState<CandidateProfile[]>([]);
  const [activeCandidate, setActiveCandidate] = useState<CandidateProfile | null>(null);
  const [candidateDocs, setCandidateDocs] = useState<CandidateDocument[]>([]);
  const [candidateCreds, setCandidateCreds] = useState<CandidatePortalCredential[]>([]);

  // Tab & connection state
  const [currentTabInfo, setCurrentTabInfo] = useState<{
    id?: number;
    url?: string;
    title?: string;
    hostname?: string;
  }>({});
  const [backendStatus, setBackendStatus] = useState<'checking' | 'connected' | 'offline'>('checking');
  const [contentScriptReady, setContentScriptReady] = useState<boolean>(false);
  const [aiEngineLabel, setAiEngineLabel] = useState<string>('Gemini 2.5 Flash');

  // Analysis & Scan state
  const [requirementReport, setRequirementReport] = useState<UniversityRequirementReport | null>(null);
  const [scannedFields, setScannedFields] = useState<FormField[]>([]);
  const [mappings, setMappings] = useState<FieldMapping[]>([]);
  const [fileMappings, setFileMappings] = useState<FileFieldMapping[]>([]);
  const [editingFieldId, setEditingFieldId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState<string>('');
  const [filledCount, setFilledCount] = useState<number | null>(null);
  const [attachedCount, setAttachedCount] = useState<number | null>(null);

  // Vault UI toggles & clipboard state
  const [vaultOpen, setVaultOpen] = useState<boolean>(true);
  const [docsOpen, setDocsOpen] = useState<boolean>(true);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Loading & notification states
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [inlineNotice, setInlineNotice] = useState<{
    type: 'success' | 'error' | 'info';
    message: string;
  } | null>(null);

  // AI Chat state
  const [chatMessages, setChatMessages] = useState<
    Array<{ sender: 'user' | 'agent'; text: string; tool?: string }>
  >([
    {
      sender: 'agent',
      text: 'AdmitPilot agent ready. Scan this portal to autofill fields, attach verified documents, or copy dedicated student credentials.',
    },
  ]);
  const [chatInput, setChatInput] = useState('');
  const [chatSending, setChatSending] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);

  const loadExtensionWorkspace = async () => {
    getExtensionMe()
      .then((me) => setCurrentUser(me))
      .catch(() => {});

    apiFetch('/settings/ai')
      .then((r) => (r.ok ? r.json() : null))
      .then((s) => {
        if (s?.provider && s?.model) {
          setAiEngineLabel(`${String(s.provider).toUpperCase()} · ${s.model}`);
        }
      })
      .catch(() => {});

    apiFetch('/candidates')
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((data: CandidateProfile[]) => {
        if (!Array.isArray(data)) throw new Error('Invalid candidates payload');
        setCandidates(data);
        setBackendStatus('connected');
        if (data.length > 0) {
          chrome.storage?.local?.get(['admitpilot_activeCandidate'], (res) => {
            const found = data.find((c) => c.id === res?.admitpilot_activeCandidate) || data[0];
            setActiveCandidate(found);
          });
        } else {
          setActiveCandidate(null);
          setCandidateDocs([]);
          setCandidateCreds([]);
        }
      })
      .catch(() => {
        setBackendStatus('offline');
        chrome.storage?.local?.get(['admitpilot_candidates', 'admitpilot_activeCandidate'], (res) => {
          if (res?.admitpilot_candidates?.length) {
            setCandidates(res.admitpilot_candidates);
            const found =
              res.admitpilot_candidates.find((c: any) => c.id === res?.admitpilot_activeCandidate) ||
              res.admitpilot_candidates[0];
            setActiveCandidate(found);
          }
        });
      });
  };

  useEffect(() => {
    if (chrome.tabs?.query) {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]) {
          const u = tabs[0].url || '';
          let host = '';
          try {
            if (u.startsWith('http')) host = new URL(u).hostname;
            else if (u.includes('admission-portal.html')) host = 'admission-portal.html';
            else host = 'Active tab';
          } catch {
            host = 'Active tab';
          }
          setCurrentTabInfo({
            id: tabs[0].id,
            url: tabs[0].url,
            title: tabs[0].title,
            hostname: host,
          });

          if (tabs[0].id) {
            chrome.tabs.sendMessage(tabs[0].id, { action: 'PING' }, (resp) => {
              if (chrome.runtime.lastError || !resp?.success) {
                setContentScriptReady(false);
              } else {
                setContentScriptReady(true);
              }
            });
          }
        }
      });
    }

    loadExtensionWorkspace();
  }, []);

  const handleExtensionLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setAuthBusy(true);
    try {
      const { user } = await loginExtension(authEmail, authPassword);
      setCurrentUser(user);
      setAuthPassword('');
      setAuthOpen(false);
      await loadExtensionWorkspace();
      showNotice('success', `Signed in as ${user.fullName}`);
    } catch (err: any) {
      setAuthError(err?.message || 'Sign in failed');
    } finally {
      setAuthBusy(false);
    }
  };

  // Load documents & portal credentials whenever activeCandidate changes
  useEffect(() => {
    if (!activeCandidate?.id || backendStatus === 'offline') return;

    Promise.all([
      apiFetch(`/candidates/${activeCandidate.id}/documents`).then((r) => (r.ok ? r.json() : [])),
      apiFetch(`/candidates/${activeCandidate.id}/credentials`).then((r) => (r.ok ? r.json() : [])),
    ])
      .then(([docs, creds]) => {
        setCandidateDocs(Array.isArray(docs) ? docs : []);
        setCandidateCreds(Array.isArray(creds) ? creds : []);
      })
      .catch(() => {
        setCandidateDocs([]);
        setCandidateCreds([]);
      });
  }, [activeCandidate?.id, backendStatus]);

  const showNotice = (type: 'success' | 'error' | 'info', message: string) => {
    setInlineNotice({ type, message });
    setTimeout(() => setInlineNotice(null), 5500);
  };

  const copyText = async (val: string, key: string) => {
    try {
      await navigator.clipboard.writeText(val);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey((prev) => (prev === key ? null : prev)), 2000);
    } catch {
      // ignore
    }
  };

  const handleCopyPassword = async (cred: CandidatePortalCredential) => {
    if (!activeCandidate) return;
    try {
      const res = await apiFetch(`/candidates/${activeCandidate.id}/credentials/${cred.id}/reveal`);
      if (!res.ok) throw new Error('Reveal failed');
      const data = await res.json();
      if (data.password) {
        await copyText(data.password, `pwd-${cred.id}`);
        showNotice('info', `Copied password for ${cred.label}`);
      }
    } catch {
      showNotice('error', 'Could not retrieve decrypted password');
    }
  };

  const handleDownloadDocument = async (doc: CandidateDocument) => {
    try {
      const res = await apiFetch(`/documents/${doc.id}/download?mode=portal`);
      if (!res.ok) throw new Error('Download failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = doc.portalFileName || doc.fileName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
    } catch {
      showNotice('error', `Could not download ${doc.fileName}`);
    }
  };

  const handleSelectCandidate = (candId: string) => {
    const c = candidates.find((cand) => cand.id === candId) || null;
    setActiveCandidate(c);
    chrome.storage?.local?.set({ admitpilot_activeCandidate: candId });
    setMappings([]);
    setFileMappings([]);
    setFilledCount(null);
    setAttachedCount(null);
    showNotice('info', `Active dossier switched to ${c?.personal.legalGivenName} ${c?.personal.familyName}`);
  };

  const handleAnalyzeWebsite = async () => {
    if (!activeCandidate || !currentTabInfo.id) return;
    setLoadingAction('analyzing_site');
    setInlineNotice(null);

    chrome.tabs.sendMessage(currentTabInfo.id, { action: 'ANALYZE_PAGE' }, async (response) => {
      if (chrome.runtime.lastError || !response?.success) {
        setLoadingAction(null);
        showNotice('error', 'Could not read webpage DOM. Refresh the portal tab and try again.');
        return;
      }

      setContentScriptReady(true);

      try {
        const res = await apiFetch('/ai/analyze-website', {
          method: 'POST',
          body: JSON.stringify({
            candidateId: activeCandidate.id,
            pageInfo: response.pageInfo,
          }),
        });

        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const report: UniversityRequirementReport = await res.json();
        setRequirementReport(report);
        showNotice('success', `Requirements analyzed for ${report.institutionName}`);
      } catch (err: any) {
        showNotice('error', `Requirement analysis failed: ${err.message}`);
      } finally {
        setLoadingAction(null);
      }
    });
  };

  const handleScanAndMatch = async () => {
    if (!activeCandidate || !currentTabInfo.id) return;

    setLoadingAction('scanning_form');
    setFilledCount(null);
    setAttachedCount(null);
    setInlineNotice(null);

    chrome.tabs.sendMessage(currentTabInfo.id, { action: 'SCAN_FORM' }, async (response) => {
      if (chrome.runtime.lastError || !response?.success) {
        setLoadingAction(null);
        showNotice('error', 'Content script not responding. Refresh this tab and retry.');
        return;
      }

      setContentScriptReady(true);
      const fields: FormField[] = response.fields || [];
      setScannedFields(fields);

      if (fields.length === 0) {
        setLoadingAction(null);
        showNotice('info', 'No interactive form fields or file slots detected on this page.');
        return;
      }

      try {
        const res = await apiFetch('/ai/match-fields', {
          method: 'POST',
          body: JSON.stringify({
            candidateId: activeCandidate.id,
            fields,
          }),
        });

        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        setMappings(data.mappings || []);
        setFileMappings(data.fileMappings || []);
        const matchedFiles = (data.fileMappings || []).filter((f: FileFieldMapping) => f.status === 'approved').length;
        showNotice(
          'success',
          `Matched ${data.mappings?.length || 0} fields and ${matchedFiles} document upload slots`
        );
      } catch (err: any) {
        showNotice('error', `Field matching error: ${err.message}`);
      } finally {
        setLoadingAction(null);
      }
    });
  };

  const handleFillForm = () => {
    if (!currentTabInfo.id) return;
    const approved = mappings.filter((m) => m.status === 'approved' && m.suggestedValue !== null);
    if (approved.length === 0) {
      showNotice('info', 'No approved text fields selected.');
      return;
    }

    setLoadingAction('filling_form');
    chrome.tabs.sendMessage(currentTabInfo.id, { action: 'FILL_FORM', mappings: approved }, (response) => {
      setLoadingAction(null);
      if (chrome.runtime.lastError || !response?.success) {
        showNotice('error', `Autofill failed: ${response?.error || 'Element detached'}`);
      } else {
        const count = response.result?.filledCount ?? approved.length;
        setFilledCount(count);
        showNotice('success', `Populated ${count} portal field${count === 1 ? '' : 's'}`);
        if (activeCandidate?.id) {
          logAutofillAudit({
            candidateId: activeCandidate.id,
            portalUrl: currentTabInfo.url,
            hostname: currentTabInfo.hostname,
            pageTitle: currentTabInfo.title,
            filledCount: count,
          });
        }
      }
    });
  };

  const handleAttachMatchedFiles = async () => {
    if (!currentTabInfo.id) return;
    const approvedSlots = fileMappings.filter(
      (fm) => fm.status === 'approved' && fm.matchedDocumentId
    );
    if (approvedSlots.length === 0) {
      showNotice('info', 'No matched file upload slots available on this page.');
      return;
    }

    setLoadingAction('attaching_files');
    try {
      const attachments: Array<{
        fieldId: string;
        fileName: string;
        mimeType: string;
        base64: string;
      }> = [];

      for (const slot of approvedSlots) {
        const res = await apiFetch(`/documents/${slot.matchedDocumentId}/download?mode=base64`);
        if (!res.ok) continue;
        const payload = await res.json();
        attachments.push({
          fieldId: slot.fieldId,
          fileName: payload.portalFileName || payload.fileName,
          mimeType: payload.mimeType || 'application/pdf',
          base64: payload.base64,
        });
      }

      chrome.tabs.sendMessage(
        currentTabInfo.id,
        { action: 'ATTACH_FILES', attachments },
        (response) => {
          setLoadingAction(null);
          if (chrome.runtime.lastError || !response?.success) {
            showNotice('error', `File attachment failed: ${response?.error || 'Input unavailable'}`);
          } else {
            const count = response.result?.attachedCount ?? 0;
            setAttachedCount(count);
            showNotice(
              'success',
              `Attached ${count} document${count === 1 ? '' : 's'} directly to portal file inputs`
            );
            if (activeCandidate?.id && count > 0) {
              logAutofillAudit({
                candidateId: activeCandidate.id,
                portalUrl: currentTabInfo.url,
                hostname: currentTabInfo.hostname,
                pageTitle: currentTabInfo.title,
                attachedCount: count,
              });
            }
          }
        }
      );
    } catch (err: any) {
      setLoadingAction(null);
      showNotice('error', `Document fetch failed: ${err.message}`);
    }
  };

  const toggleMappingStatus = (fieldId: string) => {
    setMappings((prev) =>
      prev.map((m) =>
        m.fieldId === fieldId
          ? { ...m, status: m.status === 'approved' ? 'rejected' : 'approved' }
          : m
      )
    );
  };

  const handleSaveEdit = (fieldId: string) => {
    setMappings((prev) =>
      prev.map((m) => (m.fieldId === fieldId ? { ...m, suggestedValue: editValue, status: 'approved' } : m))
    );
    setEditingFieldId(null);
  };

  const handleSendChat = async (e?: React.FormEvent, presetQuery?: string) => {
    if (e) e.preventDefault();
    const query = presetQuery || chatInput.trim();
    if (!query || !activeCandidate || chatSending) return;

    setChatInput('');
    setChatMessages((prev) => [...prev, { sender: 'user', text: query }]);
    setChatSending(true);

    try {
      const res = await apiFetch('/ai/agent-chat', {
        method: 'POST',
        body: JSON.stringify({
          message: query,
          candidateId: activeCandidate.id,
          pageStructure: currentTabInfo,
          scannedFields,
          requirements: requirementReport,
        }),
      });

      if (!res.ok) throw new Error('Chat error');
      const data = await res.json();
      setChatMessages((prev) => [
        ...prev,
        { sender: 'agent', text: data.reply, tool: data.toolUsed },
      ]);
    } catch {
      setChatMessages((prev) => [
        ...prev,
        { sender: 'agent', text: 'Backend unreachable. Ensure AdmitPilot server is running on port 3001.' },
      ]);
    } finally {
      setChatSending(false);
    }
  };

  const approvedFileSlots = fileMappings.filter((f) => f.status === 'approved');

  return (
    <div className="flex flex-col h-screen w-full bg-[#141415] text-[#ededed] text-xs overflow-hidden select-none">
      {/* Header */}
      <header className="px-3.5 py-2.5 bg-[#0f0f10] border-b border-[rgba(237,237,237,0.08)] flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-md bg-[#19191b] border border-[rgba(212,168,83,0.4)] flex items-center justify-center text-[#d4a853]">
            <GraduationCap className="w-4 h-4" strokeWidth={1.5} />
          </div>
          <div>
            <h1 className="font-medium text-xs text-[#ededed]">AdmitPilot</h1>
            <p className="text-[10px] text-[#6b6b72] leading-tight">Portal autofill & vault</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 font-mono text-[10px] text-[#a0a0a6]">
            <span
              className={`w-2 h-2 rounded-full ${
                backendStatus === 'connected' ? 'bg-[#3ea87a]' : 'bg-[#d4a853]'
              }`}
            />
            <span>{backendStatus}</span>
          </div>

          <a
            href="http://localhost:5173"
            target="_blank"
            rel="noreferrer"
            className="p-1.5 rounded-md bg-[#19191b] border border-[rgba(237,237,237,0.08)] hover:border-[rgba(237,237,237,0.18)] text-[#a0a0a6] hover:text-[#ededed]"
            title="Open AdmitPilot Dashboard"
          >
            <ExternalLink className="w-3.5 h-3.5" strokeWidth={1.5} />
          </a>
        </div>
      </header>

      {/* Connected Portal Host Banner */}
      <div className="px-3.5 py-1.5 bg-[#19191b] border-b border-[rgba(237,237,237,0.08)] flex items-center justify-between text-[11px] shrink-0">
        <div className="flex items-center gap-1.5 truncate max-w-[220px]">
          <Globe className="w-3.5 h-3.5 text-[#6b6b72] shrink-0" strokeWidth={1.5} />
          <span className="truncate font-mono text-[#a0a0a6]">
            {currentTabInfo.hostname || 'Detecting portal'}
          </span>
        </div>
        <span
          className={`px-1.5 py-0.5 rounded font-mono text-[10px] border ${
            contentScriptReady
              ? 'text-[#3ea87a] border-[rgba(62,168,122,0.3)] bg-[#141415]'
              : 'text-[#6b6b72] border-[rgba(237,237,237,0.08)] bg-[#141415]'
          }`}
        >
          {contentScriptReady ? 'DOM active' : 'DOM idle'}
        </span>
      </div>

      {/* Inline Notice */}
      {inlineNotice && (
        <div
          className={`mx-3 mt-2.5 p-2.5 rounded-lg border text-[11px] flex items-start justify-between gap-2 shrink-0 bg-[#19191b] ${
            inlineNotice.type === 'success'
              ? 'border-[rgba(62,168,122,0.4)] text-[#ededed]'
              : inlineNotice.type === 'error'
              ? 'border-[rgba(229,100,100,0.4)] text-[#e56464]'
              : 'border-[rgba(212,168,83,0.4)] text-[#ededed]'
          }`}
        >
          <div className="flex items-start gap-1.5">
            {inlineNotice.type === 'success' ? (
              <CheckCircle className="w-3.5 h-3.5 text-[#3ea87a] shrink-0 mt-0.5" strokeWidth={1.5} />
            ) : inlineNotice.type === 'error' ? (
              <AlertTriangle className="w-3.5 h-3.5 text-[#e56464] shrink-0 mt-0.5" strokeWidth={1.5} />
            ) : (
              <Info className="w-3.5 h-3.5 text-[#d4a853] shrink-0 mt-0.5" strokeWidth={1.5} />
            )}
            <span className="leading-snug">{inlineNotice.message}</span>
          </div>
          <button onClick={() => setInlineNotice(null)} className="text-[#6b6b72] hover:text-[#ededed]">
            <X className="w-3.5 h-3.5" strokeWidth={1.5} />
          </button>
        </div>
      )}

      {/* Consultant Auth & Active Candidate Selector */}
      <div className="p-3 bg-[#19191b] border-b border-[rgba(237,237,237,0.08)] shrink-0 space-y-2">
        <div className="flex items-center justify-between gap-2 text-[11px] pb-1.5 border-b border-[rgba(237,237,237,0.06)]">
          <div className="min-w-0 truncate">
            <span className="text-[#ededed] font-medium">
              {currentUser?.fullName || 'Consultant'}
            </span>
            {currentUser?.role && (
              <span className="text-[#85858b] ml-1.5">· {currentUser.role}</span>
            )}
          </div>
          <button
            type="button"
            onClick={() => {
              setAuthOpen((o) => !o);
              setAuthError(null);
            }}
            className="text-[11px] text-[#d4a853] hover:underline shrink-0"
          >
            {authOpen ? 'Cancel' : 'Switch account'}
          </button>
        </div>

        {authOpen && (
          <form onSubmit={handleExtensionLogin} className="space-y-1.5 pb-1.5 border-b border-[rgba(237,237,237,0.06)]">
            {authError && (
              <p className="text-[11px] text-[#e56464]">{authError}</p>
            )}
            <input
              required
              type="email"
              value={authEmail}
              onChange={(e) => setAuthEmail(e.target.value)}
              placeholder="Work email"
              className="w-full bg-[#0f0f10] border border-[rgba(237,237,237,0.12)] rounded px-2 py-1 text-[11px] text-[#ededed]"
            />
            <div className="flex items-center gap-1.5">
              <input
                required
                type="password"
                value={authPassword}
                onChange={(e) => setAuthPassword(e.target.value)}
                placeholder="Password"
                className="flex-1 bg-[#0f0f10] border border-[rgba(237,237,237,0.12)] rounded px-2 py-1 text-[11px] text-[#ededed]"
              />
              <button
                type="submit"
                disabled={authBusy}
                className="px-2.5 py-1 rounded bg-[#ededed] text-[#141415] text-[11px] font-medium shrink-0"
              >
                {authBusy ? '...' : 'Sign in'}
              </button>
            </div>
          </form>
        )}

        <div className="flex items-center justify-between text-[11px]">
          <span className="text-[#6b6b72]">Active dossier ({candidates.length})</span>
          {activeCandidate?.passport?.passportNumber && (
            <span className="font-mono text-[#d4a853]">
              {activeCandidate.passport.passportNumber}
            </span>
          )}
        </div>

        <select
          value={activeCandidate?.id || ''}
          onChange={(e) => handleSelectCandidate(e.target.value)}
          className="w-full bg-[#0f0f10] border border-[rgba(237,237,237,0.12)] rounded-lg px-2.5 py-1.5 text-xs text-[#ededed] focus:outline-none focus:border-[#d4a853]"
        >
          {candidates.length === 0 ? (
            <option value="">No assigned dossiers</option>
          ) : (
            candidates.map((c) => (
              <option key={c.id} value={c.id}>
                {c.personal.legalGivenName} {c.personal.familyName} ({c.personal.nationality})
              </option>
            ))
          )}
        </select>
      </div>

      {/* Main Scrollable Workspace */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {/* Primary Actions: Analyze & Scan */}
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={handleAnalyzeWebsite}
            disabled={loadingAction === 'analyzing_site'}
            className="p-2.5 rounded-lg bg-[#19191b] hover:bg-[#232325] border border-[rgba(237,237,237,0.08)] text-left transition-colors disabled:opacity-50"
          >
            <div className="flex items-center gap-1.5 text-[#ededed] font-medium mb-0.5">
              {loadingAction === 'analyzing_site' ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin text-[#d4a853]" strokeWidth={1.5} />
              ) : (
                <FileSearch className="w-3.5 h-3.5 text-[#a0a0a6]" strokeWidth={1.5} />
              )}
              <span>Analyze page</span>
            </div>
            <p className="text-[10px] text-[#6b6b72]">Check portal requirements</p>
          </button>

          <button
            onClick={handleScanAndMatch}
            disabled={loadingAction === 'scanning_form'}
            className="p-2.5 rounded-lg bg-[#ededed] hover:bg-white text-[#141415] text-left transition-colors disabled:opacity-50"
          >
            <div className="flex items-center gap-1.5 font-medium mb-0.5">
              {loadingAction === 'scanning_form' ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin text-[#141415]" strokeWidth={1.5} />
              ) : (
                <ScanSearch className="w-3.5 h-3.5 text-[#141415]" strokeWidth={1.5} />
              )}
              <span>Scan & match</span>
            </div>
            <p className="text-[10px] text-[#141415]/70">Fields & upload slots</p>
          </button>
        </div>

        {/* Matched File Upload Slots (Auto-Attach to <input type="file">) */}
        {fileMappings.length > 0 && (
          <div className="p-3 rounded-lg bg-[#19191b] border border-[rgba(212,168,83,0.35)] space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="font-medium text-[#ededed] text-[11px]">
                Portal document upload slots ({approvedFileSlots.length}/{fileMappings.length})
              </span>
              <Paperclip className="w-3.5 h-3.5 text-[#d4a853]" strokeWidth={1.5} />
            </div>

            <div className="space-y-1.5">
              {fileMappings.map((fm) => (
                <div
                  key={fm.fieldId}
                  className="p-2 rounded bg-[#0f0f10] border border-[rgba(237,237,237,0.08)] flex items-center justify-between gap-2"
                >
                  <div className="min-w-0">
                    <p className="text-[10px] text-[#a0a0a6] truncate">{fm.fieldLabel}</p>
                    <p className="font-mono text-[10px] text-[#d4a853] truncate">
                      {fm.portalFileName || 'Missing in dossier'}
                    </p>
                  </div>
                  <span
                    className={`font-mono text-[9px] px-1.5 py-0.5 rounded shrink-0 ${
                      fm.status === 'approved'
                        ? 'text-[#3ea87a] bg-[#19191b]'
                        : 'text-[#6b6b72] bg-[#19191b]'
                    }`}
                  >
                    {fm.status === 'approved' ? 'ready' : 'missing'}
                  </span>
                </div>
              ))}
            </div>

            {approvedFileSlots.length > 0 && (
              <button
                onClick={handleAttachMatchedFiles}
                disabled={loadingAction === 'attaching_files'}
                className="w-full py-2 rounded-lg bg-[#ededed] hover:bg-white text-[#141415] font-medium text-xs flex items-center justify-center gap-1.5 disabled:opacity-50"
              >
                {loadingAction === 'attaching_files' ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" strokeWidth={1.5} />
                ) : (
                  <Paperclip className="w-3.5 h-3.5" strokeWidth={1.5} />
                )}
                <span>Attach {approvedFileSlots.length} matched documents to page</span>
              </button>
            )}

            {attachedCount !== null && (
              <p className="font-mono text-[10px] text-[#3ea87a]">
                {attachedCount} document{attachedCount === 1 ? '' : 's'} attached via DataTransfer
              </p>
            )}
          </div>
        )}

        {/* Matched Text / Select / Date Form Fields */}
        {mappings.length > 0 && (
          <div className="p-3 rounded-lg bg-[#19191b] border border-[rgba(237,237,237,0.08)] space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="font-medium text-[#ededed] text-[11px]">
                Matched form fields ({mappings.filter((m) => m.status === 'approved').length}/{mappings.length})
              </span>
              <span className="font-mono text-[10px] text-[#3ea87a]">zero guesses</span>
            </div>

            <div className="space-y-1.5 max-h-52 overflow-y-auto pr-0.5">
              {mappings.map((m) => {
                const isApproved = m.status === 'approved';
                const isEditing = editingFieldId === m.fieldId;

                return (
                  <div
                    key={m.fieldId}
                    className={`p-2 rounded-lg border ${
                      isApproved
                        ? 'bg-[#0f0f10] border-[rgba(237,237,237,0.08)]'
                        : 'bg-[#0f0f10]/50 border-transparent opacity-55'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-[10px] text-[#a0a0a6] truncate max-w-[175px]">
                        {m.fieldLabel}
                      </span>
                      <div className="flex items-center gap-1">
                        <span className="font-mono text-[9px] text-[#d4a853]">{m.confidence}</span>
                        <button
                          onClick={() => toggleMappingStatus(m.fieldId)}
                          className="p-0.5 rounded text-[#a0a0a6] hover:text-[#ededed]"
                        >
                          {isApproved ? (
                            <Check className="w-3 h-3 text-[#3ea87a]" strokeWidth={1.5} />
                          ) : (
                            <X className="w-3 h-3" strokeWidth={1.5} />
                          )}
                        </button>
                      </div>
                    </div>

                    {isEditing ? (
                      <div className="flex items-center gap-1 mt-1.5">
                        <input
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          className="flex-1 bg-[#19191b] border border-[#d4a853] rounded px-1.5 py-0.5 font-mono text-[11px] text-[#ededed] focus:outline-none"
                        />
                        <button
                          onClick={() => handleSaveEdit(m.fieldId)}
                          className="p-1 bg-[#ededed] text-[#141415] rounded"
                        >
                          <Check className="w-3 h-3" strokeWidth={1.5} />
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between mt-1">
                        <p className="font-mono text-[11px] text-[#ededed] truncate max-w-[195px]">
                          {String(m.suggestedValue)}
                        </p>
                        <button
                          onClick={() => {
                            setEditingFieldId(m.fieldId);
                            setEditValue(String(m.suggestedValue || ''));
                          }}
                          className="p-0.5 text-[#6b6b72] hover:text-[#ededed]"
                        >
                          <Edit2 className="w-3 h-3" strokeWidth={1.5} />
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <button
              onClick={handleFillForm}
              disabled={loadingAction === 'filling_form'}
              className="w-full py-2 bg-[#ededed] hover:bg-white text-[#141415] rounded-lg font-medium text-xs flex items-center justify-center gap-1.5 disabled:opacity-50"
            >
              {loadingAction === 'filling_form' ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin" strokeWidth={1.5} />
              ) : (
                <Play className="w-3.5 h-3.5" strokeWidth={1.5} />
              )}
              <span>Fill {mappings.filter((m) => m.status === 'approved').length} approved fields</span>
            </button>

            {filledCount !== null && (
              <p className="font-mono text-[10px] text-[#3ea87a]">
                {filledCount} DOM controls populated
              </p>
            )}
          </div>
        )}

        {/* Requirement Analysis Card */}
        {requirementReport && (
          <div className="p-3 rounded-lg bg-[#19191b] border border-[rgba(237,237,237,0.08)] space-y-2">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3 className="font-medium text-[#ededed] text-[11px]">
                  {requirementReport.institutionName}
                </h3>
                <p className="text-[10px] text-[#a0a0a6]">
                  {requirementReport.programName || 'Admissions checklist'}
                </p>
              </div>
              <span className="font-mono text-[10px] text-[#d4a853]">
                {requirementReport.overallReadiness}
              </span>
            </div>
            <p className="text-[10px] text-[#a0a0a6]">{requirementReport.summary}</p>
          </div>
        )}

        {/* Consultant-Managed Student Emails & Portal Logins Vault */}
        <div className="rounded-lg bg-[#19191b] border border-[rgba(237,237,237,0.08)] overflow-hidden">
          <button
            type="button"
            onClick={() => setVaultOpen(!vaultOpen)}
            className="w-full p-2.5 flex items-center justify-between hover:bg-[#232325]"
          >
            <div className="flex items-center gap-1.5 text-[#ededed] font-medium text-[11px]">
              <KeyRound className="w-3.5 h-3.5 text-[#d4a853]" strokeWidth={1.5} />
              <span>Student email & portal logins ({candidateCreds.length})</span>
            </div>
            {vaultOpen ? (
              <ChevronUp className="w-3.5 h-3.5 text-[#6b6b72]" strokeWidth={1.5} />
            ) : (
              <ChevronDown className="w-3.5 h-3.5 text-[#6b6b72]" strokeWidth={1.5} />
            )}
          </button>

          {vaultOpen && (
            <div className="p-2.5 pt-0 space-y-1.5">
              {candidateCreds.length === 0 ? (
                <p className="text-[10px] text-[#6b6b72] py-1">
                  No saved student credentials yet. Add them in the candidate dossier.
                </p>
              ) : (
                candidateCreds.map((cred) => (
                  <div
                    key={cred.id}
                    className="p-2 rounded bg-[#0f0f10] border border-[rgba(237,237,237,0.08)] space-y-1.5"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[10px] font-medium text-[#ededed] truncate">
                        {cred.label}
                      </span>
                      {cred.isPrimaryStudentEmail && (
                        <span className="font-mono text-[9px] text-[#d4a853] shrink-0">inbox</span>
                      )}
                    </div>
                    <div className="flex items-center justify-between gap-1.5">
                      <span className="font-mono text-[10px] text-[#a0a0a6] truncate">
                        {cred.loginEmail}
                      </span>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => copyText(cred.loginEmail, `em-${cred.id}`)}
                          className="px-1.5 py-0.5 rounded bg-[#19191b] hover:bg-[#232325] border border-[rgba(237,237,237,0.08)] text-[10px] text-[#ededed] inline-flex items-center gap-1"
                          title="Copy login email"
                        >
                          {copiedKey === `em-${cred.id}` ? (
                            <Check className="w-3 h-3 text-[#3ea87a]" strokeWidth={1.5} />
                          ) : (
                            <Copy className="w-3 h-3 text-[#a0a0a6]" strokeWidth={1.5} />
                          )}
                          <span>Email</span>
                        </button>
                        {cred.hasPassword && (
                          <button
                            type="button"
                            onClick={() => handleCopyPassword(cred)}
                            className="px-1.5 py-0.5 rounded bg-[#19191b] hover:bg-[#232325] border border-[rgba(237,237,237,0.08)] text-[10px] text-[#ededed] inline-flex items-center gap-1"
                            title="Copy decrypted password"
                          >
                            {copiedKey === `pwd-${cred.id}` ? (
                              <Check className="w-3 h-3 text-[#3ea87a]" strokeWidth={1.5} />
                            ) : (
                              <Copy className="w-3 h-3 text-[#d4a853]" strokeWidth={1.5} />
                            )}
                            <span>Pwd</span>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {/* Candidate Document Vault (1-Click Portal-Named Downloads) */}
        <div className="rounded-lg bg-[#19191b] border border-[rgba(237,237,237,0.08)] overflow-hidden">
          <button
            type="button"
            onClick={() => setDocsOpen(!docsOpen)}
            className="w-full p-2.5 flex items-center justify-between hover:bg-[#232325]"
          >
            <div className="flex items-center gap-1.5 text-[#ededed] font-medium text-[11px]">
              <FileText className="w-3.5 h-3.5 text-[#a0a0a6]" strokeWidth={1.5} />
              <span>Candidate documents ({candidateDocs.length})</span>
            </div>
            {docsOpen ? (
              <ChevronUp className="w-3.5 h-3.5 text-[#6b6b72]" strokeWidth={1.5} />
            ) : (
              <ChevronDown className="w-3.5 h-3.5 text-[#6b6b72]" strokeWidth={1.5} />
            )}
          </button>

          {docsOpen && (
            <div className="p-2.5 pt-0 space-y-1.5">
              {candidateDocs.length === 0 ? (
                <p className="text-[10px] text-[#6b6b72] py-1">No candidate files uploaded yet.</p>
              ) : (
                candidateDocs.map((doc) => (
                  <div
                    key={doc.id}
                    className="p-2 rounded bg-[#0f0f10] border border-[rgba(237,237,237,0.08)] flex items-center justify-between gap-2"
                  >
                    <div className="min-w-0">
                      <p className="font-mono text-[10px] text-[#ededed] truncate">
                        {doc.portalFileName || doc.fileName}
                      </p>
                      <p className="font-mono text-[9px] text-[#6b6b72]">
                        {doc.category.replace(/_/g, ' ')} · {(doc.fileSize / 1024).toFixed(0)} KB
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDownloadDocument(doc)}
                      className="px-2 py-1 rounded bg-[#19191b] hover:bg-[#232325] border border-[rgba(237,237,237,0.08)] text-[10px] text-[#ededed] inline-flex items-center gap-1 shrink-0"
                      title="Download portal-named file"
                    >
                      <Download className="w-3 h-3 text-[#d4a853]" strokeWidth={1.5} />
                      <span>Save</span>
                    </button>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {/* AI Assistant Chat */}
        <div className="rounded-lg bg-[#19191b] border border-[rgba(237,237,237,0.08)] overflow-hidden">
          <button
            type="button"
            onClick={() => setChatOpen(!chatOpen)}
            className="w-full p-2.5 flex items-center justify-between hover:bg-[#232325]"
          >
            <div className="flex items-center gap-1.5 text-[#ededed] font-medium text-[11px]">
              <MessageSquare className="w-3.5 h-3.5 text-[#a0a0a6]" strokeWidth={1.5} />
              <span>Admissions agent chat</span>
            </div>
            {chatOpen ? (
              <ChevronUp className="w-3.5 h-3.5 text-[#6b6b72]" strokeWidth={1.5} />
            ) : (
              <ChevronDown className="w-3.5 h-3.5 text-[#6b6b72]" strokeWidth={1.5} />
            )}
          </button>

          {chatOpen && (
            <div className="p-2.5 pt-0 space-y-2">
              <div className="space-y-1.5 max-h-36 overflow-y-auto p-2 rounded bg-[#0f0f10] border border-[rgba(237,237,237,0.08)]">
                {chatMessages.map((msg, i) => (
                  <div
                    key={i}
                    className={`p-2 rounded text-[10px] leading-relaxed ${
                      msg.sender === 'user'
                        ? 'bg-[#232325] text-[#ededed] ml-4'
                        : 'bg-[#19191b] text-[#a0a0a6] mr-2'
                    }`}
                  >
                    {msg.text}
                  </div>
                ))}
              </div>

              <form onSubmit={handleSendChat} className="flex gap-1.5">
                <input
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  placeholder="Ask about requirements or dossier..."
                  className="flex-1 bg-[#0f0f10] border border-[rgba(237,237,237,0.12)] rounded-lg px-2.5 py-1.5 text-[11px] text-[#ededed] focus:outline-none focus:border-[#d4a853]"
                />
                <button
                  type="submit"
                  disabled={chatSending || !chatInput.trim()}
                  className="px-2.5 py-1.5 bg-[#ededed] text-[#141415] rounded-lg disabled:opacity-50"
                >
                  <Send className="w-3 h-3" strokeWidth={1.5} />
                </button>
              </form>
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <footer className="px-3.5 py-2 bg-[#0f0f10] border-t border-[rgba(237,237,237,0.08)] flex items-center justify-between text-[10px] text-[#6b6b72] shrink-0">
        <span className="flex items-center gap-1 text-[#3ea87a]">
          <ShieldCheck className="w-3 h-3" strokeWidth={1.5} />
          Zero-invention active
        </span>
        <span className="font-mono text-[#a0a0a6] truncate max-w-[165px]" title={aiEngineLabel}>
          {aiEngineLabel}
        </span>
      </footer>
    </div>
  );
};

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <SidePanel />
  </React.StrictMode>
);
