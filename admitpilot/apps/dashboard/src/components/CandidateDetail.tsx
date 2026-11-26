import React, { useState } from 'react';
import {
  User,
  FileText,
  GraduationCap,
  Upload,
  Mail,
  Shield,
  Edit,
  Trash2,
  Archive,
  RefreshCw,
  KeyRound,
  Copy,
  Check,
  Eye,
  EyeOff,
  ExternalLink,
  Plus,
  Download,
  X,
  ArrowLeft,
  ClipboardList,
  Receipt,
  Link2,
} from 'lucide-react';
import {
  ApplicationRecord,
  CandidateProfile,
  CandidateDocument,
  CandidatePortalCredential,
  CandidatePaymentStatus,
  PortalCredentialType,
  DocumentCategory,
  CountryTeam,
  UserProfile,
} from 'admitpilot-shared';
import { DocumentUploadModal } from './DocumentUploadModal';
import {
  PassportCredentialCard,
  VerificationStamp,
  formatExtractionMethod,
  formatCategoryLabel,
} from './ui/Primitives';
import { api } from '../api';

interface CandidateDetailProps {
  candidate: CandidateProfile;
  documents: CandidateDocument[];
  credentials: CandidatePortalCredential[];
  applications?: ApplicationRecord[];
  members?: UserProfile[];
  countryTeams?: CountryTeam[];
  onBackToList?: () => void;
  onOpenApplicationsTab?: () => void;
  onUploadDocuments: (files: File[], category?: DocumentCategory | 'auto') => Promise<void>;
  onReextractDocument?: (docId: string, category?: DocumentCategory | 'auto') => Promise<void>;
  onDeleteDocument?: (docId: string) => Promise<void>;
  onSaveCredential: (
    payload: Partial<CandidatePortalCredential> & { label: string; loginEmail: string },
    credId?: string
  ) => Promise<void>;
  onDeleteCredential: (credId: string) => Promise<void>;
  onRecordPayment?: (payload: {
    id?: string;
    title: string;
    amount: string;
    paidDate?: string;
    paymentMethod?: string;
    referenceNumber?: string;
    status?: string;
    notes?: string;
    receiptFile?: File | null;
  }) => Promise<void>;
  onDeletePayment?: (paymentId: string) => Promise<void>;
  onEditCandidate: () => void;
  onUpdateRouting?: (updates: Partial<CandidateProfile>) => Promise<void>;
  onCandidateUpdated?: (updated: CandidateProfile) => void;
  onDeleteCandidate: (id: string) => void;
  onArchiveCandidate?: (id: string) => void;
  onRestoreCandidate?: (id: string) => void;
  onSelectReviewDoc?: (doc: CandidateDocument) => void;
}

const PORTAL_TYPE_LABELS: Record<PortalCredentialType, string> = {
  dedicated_email: 'Dedicated student email',
  university_portal: 'University portal',
  ucas: 'UCAS',
  common_app: 'Common App',
  uni_assist: 'uni-assist',
  studielink: 'Studielink',
  visa_portal: 'Visa / immigration portal',
  english_test: 'Language exam account',
  other: 'Other portal',
};

export const CandidateDetail: React.FC<CandidateDetailProps> = ({
  candidate,
  documents,
  credentials,
  applications = [],
  members = [],
  countryTeams = [],
  onBackToList,
  onOpenApplicationsTab,
  onUploadDocuments,
  onReextractDocument,
  onDeleteDocument,
  onSaveCredential,
  onDeleteCredential,
  onRecordPayment,
  onDeletePayment,
  onEditCandidate,
  onUpdateRouting,
  onCandidateUpdated,
  onDeleteCandidate,
  onArchiveCandidate,
  onRestoreCandidate,
  onSelectReviewDoc,
}) => {
  const [activeTab, setActiveTab] = useState<
    | 'overview'
    | 'applications'
    | 'payments'
    | 'documents'
    | 'academics'
    | 'identity'
    | 'credentials'
  >('overview');

  // Student Payment modal state
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [payTitle, setPayTitle] = useState('Consultancy Retainer Fee');
  const [payAmount, setPayAmount] = useState('');
  const [payDate, setPayDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [payMethod, setPayMethod] = useState('Bank transfer');
  const [payRef, setPayRef] = useState('');
  const [payStatus, setPayStatus] = useState<CandidatePaymentStatus>('paid');
  const [payNotes, setPayNotes] = useState('');
  const [payReceiptFile, setPayReceiptFile] = useState<File | null>(null);
  const [savingPayment, setSavingPayment] = useState(false);

  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [shareLoading, setShareLoading] = useState(false);
  const [shareError, setShareError] = useState<string | null>(null);
  const [sharePinDraft, setSharePinDraft] = useState(candidate.intakeSharePin || '');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const shareUrl = candidate.intakeShareToken
    ? `${window.location.origin}/?intake=${encodeURIComponent(candidate.intakeShareToken)}`
    : '';

  const handleOpenShareModal = async () => {
    setIsShareModalOpen(true);
    setShareError(null);
    setSharePinDraft(candidate.intakeSharePin || '');
    if (!candidate.intakeShareToken) {
      setShareLoading(true);
      try {
        const res = await api.createIntakeLink(candidate.id, false);
        onCandidateUpdated?.(res.updatedCandidate);
      } catch (err: any) {
        setShareError(err.message || 'Could not generate upload link');
      } finally {
        setShareLoading(false);
      }
    }
  };

  const handleSaveSharePin = async (pinValue: string) => {
    setShareLoading(true);
    setShareError(null);
    try {
      const res = await api.createIntakeLink(candidate.id, false, pinValue);
      setSharePinDraft(res.pin || '');
      onCandidateUpdated?.(res.updatedCandidate);
    } catch (err: any) {
      setShareError(err.message || 'Could not update access PIN');
    } finally {
      setShareLoading(false);
    }
  };

  const handleRegenerateShareLink = async () => {
    setShareLoading(true);
    setShareError(null);
    try {
      const res = await api.createIntakeLink(candidate.id, true);
      onCandidateUpdated?.(res.updatedCandidate);
    } catch (err: any) {
      setShareError(err.message || 'Could not regenerate upload link');
    } finally {
      setShareLoading(false);
    }
  };

  const handleRevokeShareLink = async () => {
    setShareLoading(true);
    setShareError(null);
    try {
      const res = await api.revokeIntakeLink(candidate.id);
      onCandidateUpdated?.(res.updatedCandidate);
    } catch (err: any) {
      setShareError(err.message || 'Could not revoke upload link');
    } finally {
      setShareLoading(false);
    }
  };
  const [revealedMap, setRevealedMap] = useState<
    Record<string, { password: string; pinOrSecurityNote?: string }>
  >({});
  const [busyDocId, setBusyDocId] = useState<string | null>(null);

  // Credential Form Modal state
  const [isCredModalOpen, setIsCredModalOpen] = useState(false);
  const [editingCred, setEditingCred] = useState<CandidatePortalCredential | null>(null);
  const [credLabel, setCredLabel] = useState('');
  const [credType, setCredType] = useState<PortalCredentialType>('university_portal');
  const [credUrl, setCredUrl] = useState('');
  const [credEmail, setCredEmail] = useState('');
  const [credUsername, setCredUsername] = useState('');
  const [credPassword, setCredPassword] = useState('');
  const [credRecoveryEmail, setCredRecoveryEmail] = useState('');
  const [credRecoveryPhone, setCredRecoveryPhone] = useState('');
  const [credPinNote, setCredPinNote] = useState('');
  const [credPrimaryEmail, setCredPrimaryEmail] = useState(false);
  const [credNotes, setCredNotes] = useState('');
  const [savingCred, setSavingCred] = useState(false);

  const copyText = async (text: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey((prev) => (prev === key ? null : prev)), 2000);
    } catch {
      // Clipboard fallback ignored
    }
  };

  const handleToggleReveal = async (cred: CandidatePortalCredential) => {
    if (revealedMap[cred.id]) {
      setRevealedMap((prev) => {
        const next = { ...prev };
        delete next[cred.id];
        return next;
      });
      return;
    }
    const secret = await api.revealCredential(candidate.id, cred.id);
    setRevealedMap((prev) => ({
      ...prev,
      [cred.id]: { password: secret.password, pinOrSecurityNote: secret.pinOrSecurityNote },
    }));
  };

  const handleCopyPassword = async (cred: CandidatePortalCredential) => {
    let pwd = revealedMap[cred.id]?.password;
    if (pwd === undefined) {
      const secret = await api.revealCredential(candidate.id, cred.id);
      pwd = secret.password;
    }
    if (pwd) {
      await copyText(pwd, `pwd-${cred.id}`);
    }
  };

  const openNewCredModal = (presetType: PortalCredentialType = 'university_portal') => {
    setEditingCred(null);
    setCredType(presetType);
    setCredLabel(
      presetType === 'dedicated_email'
        ? 'Dedicated Student Admissions Email'
        : ''
    );
    setCredUrl(presetType === 'dedicated_email' ? 'https://mail.google.com' : '');
    setCredEmail(
      candidate.contact.managedStudentEmail ||
        credentials.find((c) => c.isPrimaryStudentEmail)?.loginEmail ||
        ''
    );
    setCredUsername('');
    setCredPassword('');
    setCredRecoveryEmail('');
    setCredRecoveryPhone('');
    setCredPinNote('');
    setCredPrimaryEmail(presetType === 'dedicated_email');
    setCredNotes('');
    setIsCredModalOpen(true);
  };

  const openEditCredModal = (cred: CandidatePortalCredential) => {
    setEditingCred(cred);
    setCredType(cred.portalType);
    setCredLabel(cred.label);
    setCredUrl(cred.portalUrl || '');
    setCredEmail(cred.loginEmail);
    setCredUsername(cred.username || '');
    setCredPassword('');
    setCredRecoveryEmail(cred.recoveryEmail || '');
    setCredRecoveryPhone(cred.recoveryPhone || '');
    setCredPinNote('');
    setCredPrimaryEmail(Boolean(cred.isPrimaryStudentEmail));
    setCredNotes(cred.notes || '');
    setIsCredModalOpen(true);
  };

  const handleSubmitCredential = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingCred(true);
    try {
      await onSaveCredential(
        {
          label: credLabel.trim(),
          portalType: credType,
          portalUrl: credUrl.trim() || undefined,
          loginEmail: credEmail.trim(),
          username: credUsername.trim() || undefined,
          ...(credPassword ? { password: credPassword } : {}),
          recoveryEmail: credRecoveryEmail.trim() || undefined,
          recoveryPhone: credRecoveryPhone.trim() || undefined,
          ...(credPinNote ? { pinOrSecurityNote: credPinNote } : {}),
          isPrimaryStudentEmail: credPrimaryEmail,
          notes: credNotes.trim() || undefined,
        },
        editingCred?.id
      );
      setIsCredModalOpen(false);
    } finally {
      setSavingCred(false);
    }
  };

  const [downloadingPacket, setDownloadingPacket] = useState(false);
  const [isDragOverDocs, setIsDragOverDocs] = useState(false);

  const handleDownloadAllDocs = async () => {
    setDownloadingPacket(true);
    try {
      const safeLast = (candidate.personal.familyName || 'Student').replace(/[^a-zA-Z0-9_-]/g, '');
      const safeFirst = (candidate.personal.legalGivenName || 'Dossier').replace(/[^a-zA-Z0-9_-]/g, '');
      await api.downloadPortalPacket(candidate.id, `${safeLast}_${safeFirst}_Portal_Packet.zip`);
    } finally {
      setDownloadingPacket(false);
    }
  };

  const handleDropDocs = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOverDocs(false);
    const files = Array.from(e.dataTransfer.files || []);
    if (files.length > 0) {
      await onUploadDocuments(files, 'auto');
    }
  };

  const primaryStudentEmail =
    credentials.find((c) => c.isPrimaryStudentEmail)?.loginEmail ||
    candidate.contact.managedStudentEmail;

  const FieldCell: React.FC<{ label: string; value?: string | null; mono?: boolean }> = ({
    label,
    value,
    mono,
  }) => (
    <div className="min-w-0">
      <span className="block text-xs text-ink-muted">{label}</span>
      <span
        className={`block mt-1 text-sm text-ink-primary break-words ${
          mono ? 'font-mono tabular-nums break-all' : 'font-normal'
        }`}
      >
        {value && String(value).trim() ? value : '—'}
      </span>
    </div>
  );

  const hasDocCat = (cat: DocumentCategory) => documents.some((d) => d.category === cat);
  const conflictCount = Object.keys(candidate.conflicts || {}).length;
  const readinessChecks = [
    {
      id: 'passport',
      label: 'Passport',
      ready: hasDocCat('passport') || Boolean(candidate.passport?.passportNumber),
      onClick: () => setIsUploadModalOpen(true),
    },
    {
      id: 'transcript',
      label: 'Transcript',
      ready: hasDocCat('transcript') || candidate.education.length > 0,
      onClick: () => setIsUploadModalOpen(true),
    },
    {
      id: 'english',
      label: 'English test',
      ready: hasDocCat('english_test') || candidate.englishTests.length > 0,
      onClick: () => setIsUploadModalOpen(true),
    },
    {
      id: 'cv',
      label: 'CV / SOP',
      ready: hasDocCat('cv') || hasDocCat('sop'),
      onClick: () => setIsUploadModalOpen(true),
    },
    {
      id: 'inbox',
      label: 'Portal inbox',
      ready: Boolean(primaryStudentEmail),
      onClick: () => {
        setActiveTab('credentials');
        if (!primaryStudentEmail) openNewCredModal('dedicated_email');
      },
    },
    {
      id: 'conflicts',
      label: conflictCount > 0 ? `${conflictCount} conflict${conflictCount === 1 ? '' : 's'}` : '0 conflicts',
      ready: conflictCount === 0,
      isNegative: conflictCount > 0,
      onClick: () => {
        if (documents[0] && onSelectReviewDoc) onSelectReviewDoc(documents[0]);
        else setActiveTab('documents');
      },
    },
  ];
  const readyScore = Math.round(
    (readinessChecks.filter((c) => c.ready).length / readinessChecks.length) * 100
  );

  return (
    <div className="bg-surface-card border border-hairline rounded-xl overflow-hidden">
      {onBackToList && (
        <div className="px-6 py-2.5 border-b border-hairline bg-surface-deep/40 flex items-center justify-between">
          <button
            type="button"
            onClick={onBackToList}
            className="text-xs text-ink-secondary hover:text-ink-primary inline-flex items-center gap-1.5 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" strokeWidth={1.5} />
            <span>Back to candidates</span>
          </button>
          <span className="font-mono text-[11px] text-ink-muted">
            Portal readiness {readyScore}%
          </span>
        </div>
      )}

      {/* Top Dossier Header */}
      <div className="p-6 border-b border-hairline flex flex-col xl:flex-row xl:items-center justify-between gap-4">
        <div className="flex items-center gap-4 min-w-0">
          <div className="w-12 h-12 rounded-lg bg-surface-deep border border-hairline font-mono text-base font-medium text-brass flex items-center justify-center shrink-0">
            {candidate.personal.legalGivenName[0] || 'C'}
            {candidate.personal.familyName[0] || 'P'}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-3 flex-wrap">
              <h2 className="text-xl font-medium text-ink-primary truncate">
                {candidate.personal.legalGivenName} {candidate.personal.familyName}
              </h2>
              <VerificationStamp
                tone={candidate.status === 'active' ? 'positive' : 'brass'}
                label={candidate.status.replace(/_/g, ' ')}
              />
            </div>
            <p className="text-[13px] text-ink-secondary mt-1 tabular-nums flex flex-wrap items-center gap-x-2 gap-y-1">
              <span>{candidate.personal.nationality}</span>
              <span>· DOB {candidate.personal.dateOfBirth}</span>
              <span>
                · Passport{' '}
                <span className="font-mono text-ink-primary">
                  {candidate.passport?.passportNumber || 'unverified'}
                </span>
              </span>
              {primaryStudentEmail && (
                <span>
                  · Portal inbox{' '}
                  <button
                    type="button"
                    onClick={() => copyText(primaryStudentEmail, 'hdr-email')}
                    className="font-mono text-brass hover:underline inline-flex items-center gap-1"
                    title="Copy dedicated student application email"
                  >
                    <span>{primaryStudentEmail}</span>
                    {copiedKey === 'hdr-email' ? (
                      <Check className="w-3.5 h-3.5 text-tone-positive" strokeWidth={1.5} />
                    ) : (
                      <Copy className="w-3.5 h-3.5" strokeWidth={1.5} />
                    )}
                  </button>
                </span>
              )}
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setIsUploadModalOpen(true)}
            className="btn-primary"
          >
            <Upload className="w-4 h-4" strokeWidth={1.5} />
            <span>Upload documents</span>
          </button>
          <button
            type="button"
            onClick={handleOpenShareModal}
            className="btn-secondary"
            title="Generate shareable upload link for this student"
          >
            <Link2 className="w-4 h-4 text-brass" strokeWidth={1.5} />
            <span>Share upload link</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab('credentials');
              openNewCredModal('university_portal');
            }}
            className="btn-secondary"
          >
            <KeyRound className="w-4 h-4 text-ink-muted" strokeWidth={1.5} />
            <span>Add login</span>
          </button>
          <button type="button" onClick={onEditCandidate} className="btn-secondary">
            <Edit className="w-4 h-4 text-ink-muted" strokeWidth={1.5} />
            <span>Edit</span>
          </button>
          {candidate.status === 'active' && onArchiveCandidate && (
            <button
              type="button"
              onClick={() => onArchiveCandidate(candidate.id)}
              className="h-9 w-9 rounded-lg bg-surface-raised border border-hairline hover:border-hairline-strong text-ink-muted hover:text-ink-primary inline-flex items-center justify-center transition-colors duration-150 ease-quart"
              title="Archive dossier"
            >
              <Archive className="w-4 h-4" strokeWidth={1.5} />
            </button>
          )}
          {candidate.status === 'archived' && onRestoreCandidate && (
            <button
              type="button"
              onClick={() => onRestoreCandidate(candidate.id)}
              className="h-9 w-9 rounded-lg bg-surface-raised border border-hairline hover:border-hairline-strong text-ink-muted hover:text-tone-positive inline-flex items-center justify-center transition-colors duration-150 ease-quart"
              title="Restore dossier"
            >
              <RefreshCw className="w-4 h-4" strokeWidth={1.5} />
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              if (window.confirm(`Permanently delete dossier for ${candidate.personal.legalGivenName}?`)) {
                onDeleteCandidate(candidate.id);
              }
            }}
            className="h-9 w-9 rounded-lg bg-surface-raised border border-hairline hover:border-hairline-strong text-ink-muted hover:text-tone-negative inline-flex items-center justify-center transition-colors duration-150 ease-quart"
            title="Delete dossier"
          >
            <Trash2 className="w-4 h-4" strokeWidth={1.5} />
          </button>
        </div>
      </div>

      {/* Portal Readiness Checklist */}
      <div className="px-6 py-2.5 border-b border-hairline bg-surface-deep/25 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
          {readinessChecks.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={item.onClick}
              title={item.ready ? `${item.label} verified` : `Click to resolve ${item.label}`}
              className="inline-flex items-center text-xs hover:opacity-80 transition-opacity"
            >
              <VerificationStamp
                tone={item.isNegative ? 'negative' : item.ready ? 'positive' : 'brass'}
                label={item.label}
              />
            </button>
          ))}
        </div>
        {!onBackToList && (
          <span className="text-[11px] tabular-nums text-ink-muted shrink-0">
            Portal readiness {readyScore}%
          </span>
        )}
      </div>

      {/* Sub-navigation Tabs (7 clean tabs — zero horizontal overflow) */}
      <div className="flex border-b border-hairline px-6 bg-surface-deep/50 overflow-x-auto">
        {[
          { id: 'overview', label: 'Summary', icon: User },
          { id: 'applications', label: 'Applications', count: applications.length, icon: ClipboardList },
          { id: 'payments', label: 'Payments', count: (candidate.payments || []).length, icon: Receipt },
          { id: 'documents', label: 'Documents', count: documents.length, icon: FileText },
          {
            id: 'academics',
            label: 'Academics',
            count: candidate.education.length + candidate.englishTests.length,
            icon: GraduationCap,
          },
          { id: 'identity', label: 'Identity & MRZ', icon: Shield },
          { id: 'credentials', label: 'Logins', count: credentials.length, icon: KeyRound },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id as any)}
              className={`h-10 px-3.5 border-b-2 text-[13px] whitespace-nowrap inline-flex items-center gap-2 transition-colors duration-150 ease-quart ${
                isActive
                  ? 'border-brass text-ink-primary font-medium'
                  : 'border-transparent text-ink-secondary hover:text-ink-primary'
              }`}
            >
              <Icon
                className={`w-4 h-4 shrink-0 ${isActive ? 'text-ink-primary' : 'text-ink-muted'}`}
                strokeWidth={1.5}
              />
              <span>{tab.label}</span>
              {tab.count !== undefined && (
                <span className="font-mono text-xs tabular-nums text-ink-muted">{tab.count}</span>
              )}
            </button>
          );
        })}
      </div>

      {/* Tab Body */}
      <div className="p-6">
        {activeTab === 'overview' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-8 space-y-5">
              <div className="p-5 rounded-xl bg-surface-deep border border-hairline">
                <h3 className="text-sm font-medium text-ink-primary mb-4">Identity & contact record</h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-5">
                  <FieldCell
                    label="Legal name"
                    value={`${candidate.personal.legalGivenName} ${candidate.personal.familyName}`}
                  />
                  <FieldCell label="Date of birth" value={candidate.personal.dateOfBirth} mono />
                  <FieldCell label="Nationality" value={candidate.personal.nationality} />
                  <FieldCell label="Personal email" value={candidate.contact.email} />
                  <FieldCell label="Dedicated portal email" value={primaryStudentEmail} mono />
                  <FieldCell label="Phone" value={candidate.contact.phone} mono />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-5 rounded-xl bg-surface-deep border border-hairline space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-ink-muted">Latest qualification</span>
                    {candidate.education[0]?.status && (
                      <VerificationStamp tone="positive" label={candidate.education[0].status.toLowerCase()} />
                    )}
                  </div>
                  {candidate.education.length > 0 ? (
                    <>
                      <p className="text-sm font-medium text-ink-primary">{candidate.education[0].degreeTitle}</p>
                      <p className="text-[13px] text-ink-secondary">{candidate.education[0].institution}</p>
                      <p className="font-mono text-xs tabular-nums text-brass pt-1">
                        GPA {candidate.education[0].gpa || '—'}
                        {candidate.education[0].gradingScale ? ` / ${candidate.education[0].gradingScale}` : ''}
                      </p>
                    </>
                  ) : (
                    <p className="text-[13px] text-ink-muted pt-1">No academic degrees recorded</p>
                  )}
                </div>

                <div className="p-5 rounded-xl bg-surface-deep border border-hairline space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-ink-muted">Language proficiency</span>
                    {candidate.englishTests[0] && (
                      <span className="font-mono text-xs tabular-nums text-brass">
                        Overall {candidate.englishTests[0].overallScore}
                      </span>
                    )}
                  </div>
                  {candidate.englishTests.length > 0 ? (
                    <>
                      <p className="text-sm font-medium text-ink-primary">
                        {candidate.englishTests[0].testType} Academic
                      </p>
                      <p className="font-mono text-xs tabular-nums text-ink-secondary">
                        Tested {candidate.englishTests[0].testDate}
                      </p>
                      <div className="flex gap-4 font-mono text-xs tabular-nums text-ink-muted pt-1">
                        <span>L {candidate.englishTests[0].listening || '—'}</span>
                        <span>R {candidate.englishTests[0].reading || '—'}</span>
                        <span>W {candidate.englishTests[0].writing || '—'}</span>
                        <span>S {candidate.englishTests[0].speaking || '—'}</span>
                      </div>
                    </>
                  ) : (
                    <p className="text-[13px] text-ink-muted pt-1">No score report recorded</p>
                  )}
                </div>
              </div>
            </div>

            {/* Right column: Routing + Document & Credential Readiness */}
            <div className="lg:col-span-4 space-y-4">
              {countryTeams.length > 0 && (
                <div className="p-5 rounded-xl bg-surface-deep border border-hairline space-y-3.5">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-medium text-ink-primary">Desk & consultant routing</h3>
                    {candidate.countryTeamId && (
                      <span className="px-1.5 py-0.5 rounded bg-surface-card border border-brass-border font-mono text-xs text-brass">
                        {countryTeams.find((t) => t.id === candidate.countryTeamId)?.code || 'DESK'}
                      </span>
                    )}
                  </div>

                  {(candidate.additional?.preferredIntakes || []).length > 0 && (
                    <div>
                      <span className="block text-xs text-ink-muted mb-1.5">Target intake</span>
                      <div className="flex flex-wrap gap-1.5">
                        {(candidate.additional?.preferredIntakes || []).map((intake) => (
                          <span
                            key={intake}
                            className="px-2 py-0.5 rounded bg-brass-soft border border-brass-border text-xs text-brass font-medium"
                          >
                            {intake}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {(candidate.targetCountries || candidate.additional?.preferredCountries || []).length > 0 && (
                    <div>
                      <span className="block text-xs text-ink-muted mb-1.5">Target destinations</span>
                      <div className="flex flex-wrap gap-1.5">
                        {(candidate.targetCountries || candidate.additional?.preferredCountries || []).map(
                          (dest) => (
                            <span
                              key={dest}
                              className="px-2 py-0.5 rounded bg-surface-card border border-hairline text-xs text-ink-secondary"
                            >
                              {dest}
                            </span>
                          )
                        )}
                      </div>
                    </div>
                  )}

                  <div>
                    <label className="block text-xs text-ink-muted mb-1">Country desk</label>
                    <select
                      value={candidate.countryTeamId || ''}
                      onChange={(e) =>
                        onUpdateRouting?.({ countryTeamId: e.target.value || undefined })
                      }
                      className="field-input h-8 text-xs"
                    >
                      <option value="">Unassigned desk</option>
                      {countryTeams.map((desk) => (
                        <option key={desk.id} value={desk.id}>
                          {desk.code} · {desk.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs text-ink-muted mb-1">Assigned consultant</label>
                    <select
                      value={candidate.assignedConsultantId || ''}
                      onChange={(e) =>
                        onUpdateRouting?.({ assignedConsultantId: e.target.value || undefined })
                      }
                      className="field-input h-8 text-xs"
                    >
                      <option value="">Unassigned</option>
                      {members.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.fullName} ({m.role.replace('_', ' ')})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              <div className="p-5 rounded-xl bg-surface-deep border border-hairline space-y-3.5">
                <h3 className="text-sm font-medium text-ink-primary">Portal readiness</h3>
                <div className="space-y-2.5 text-[13px]">
                  <div className="flex items-center justify-between">
                    <span className="text-ink-secondary">Dedicated student email</span>
                    <VerificationStamp
                      tone={primaryStudentEmail ? 'positive' : 'brass'}
                      label={primaryStudentEmail ? 'active' : 'not set'}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-ink-secondary">Saved portal logins</span>
                    <span className="font-mono text-xs text-ink-primary tabular-nums">
                      {credentials.length}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-ink-secondary">Passport bio-page</span>
                    <VerificationStamp
                      tone={candidate.passport?.passportNumber ? 'positive' : 'negative'}
                      label={candidate.passport?.passportNumber ? 'verified' : 'missing'}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-ink-secondary">Academic transcript</span>
                    <VerificationStamp
                      tone={documents.some((d) => d.category === 'transcript') ? 'positive' : 'brass'}
                      label={documents.some((d) => d.category === 'transcript') ? 'uploaded' : 'pending'}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-ink-secondary">Language certificate</span>
                    <VerificationStamp
                      tone={
                        documents.some((d) => d.category === 'english_test') || candidate.englishTests.length > 0
                          ? 'positive'
                          : 'brass'
                      }
                      label={
                        documents.some((d) => d.category === 'english_test')
                          ? 'uploaded'
                          : candidate.englishTests.length > 0
                          ? 'recorded'
                          : 'pending'
                      }
                    />
                  </div>
                </div>

                <div className="pt-3 border-t border-hairline grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setIsUploadModalOpen(true)}
                    className="btn-secondary text-xs px-2.5"
                  >
                    <Upload className="w-4 h-4 text-ink-muted" strokeWidth={1.5} />
                    <span>Upload file</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab('credentials')}
                    className="btn-secondary text-xs px-2.5"
                  >
                    <KeyRound className="w-4 h-4 text-ink-muted" strokeWidth={1.5} />
                    <span>Logins ({credentials.length})</span>
                  </button>
                </div>
              </div>

              {(candidate.additional?.financialSupport ||
                candidate.additional?.emergencyContacts ||
                candidate.additional?.notes) && (
                <div className="p-5 rounded-xl bg-surface-deep border border-hairline space-y-3">
                  <h3 className="text-sm font-medium text-ink-primary">Advisory & notes</h3>
                  {candidate.additional?.financialSupport && (
                    <div>
                      <span className="block text-[11px] text-ink-muted">Financial sponsorship</span>
                      <p className="text-xs text-ink-secondary mt-0.5">
                        {candidate.additional.financialSupport}
                      </p>
                    </div>
                  )}
                  {candidate.additional?.emergencyContacts && (
                    <div>
                      <span className="block text-[11px] text-ink-muted">Emergency contact</span>
                      <p className="text-xs text-ink-secondary mt-0.5">
                        {candidate.additional.emergencyContacts}
                      </p>
                    </div>
                  )}
                  {candidate.additional?.notes && (
                    <div>
                      <span className="block text-[11px] text-ink-muted">Consultant notes</span>
                      <p className="text-xs text-ink-secondary mt-0.5">
                        {candidate.additional.notes}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Consultant-Managed Student Emails & Portal Credentials Vault */}
        {activeTab === 'credentials' && (
          <div className="space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-medium text-ink-primary">
                  Student dedicated email & university portal credentials
                </h3>
                <p className="text-xs text-ink-muted mt-0.5">
                  Encrypted at rest (AES-256-GCM) in Supabase PostgreSQL · Shared with the Chrome extension autofill vault
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => openNewCredModal('dedicated_email')}
                  className="btn-secondary"
                >
                  <Mail className="w-4 h-4 text-ink-muted" strokeWidth={1.5} />
                  <span>New dedicated email</span>
                </button>
                <button
                  type="button"
                  onClick={() => openNewCredModal('university_portal')}
                  className="btn-primary"
                >
                  <Plus className="w-4 h-4 text-[#141415]" strokeWidth={1.5} />
                  <span>Add portal login</span>
                </button>
              </div>
            </div>

            {credentials.length === 0 ? (
              <div className="p-10 rounded-xl bg-surface-deep border border-hairline text-center space-y-3">
                <KeyRound className="w-4 h-4 text-ink-muted mx-auto" strokeWidth={1.5} />
                <p className="text-sm font-medium text-ink-primary">
                  No student email or portal accounts stored yet
                </p>
                <p className="text-xs text-ink-secondary max-w-md mx-auto">
                  Record the dedicated Gmail/Outlook inbox created for this student plus UCAS, uni-assist, Common App, or university portal logins
                </p>
                <div className="pt-1">
                  <button
                    type="button"
                    onClick={() => openNewCredModal('dedicated_email')}
                    className="btn-primary"
                  >
                    Create dedicated email record
                  </button>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {credentials.map((cred) => {
                  const revealed = revealedMap[cred.id];
                  return (
                    <div
                      key={cred.id}
                      className={`p-5 rounded-xl bg-surface-deep border space-y-4 ${
                        cred.isPrimaryStudentEmail ? 'border-brass-border' : 'border-hairline'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-medium text-ink-primary truncate">
                              {cred.label}
                            </span>
                            {cred.isPrimaryStudentEmail && (
                              <VerificationStamp tone="brass" label="primary student email" />
                            )}
                          </div>
                          <p className="text-xs text-ink-muted mt-0.5">
                            {PORTAL_TYPE_LABELS[cred.portalType] || cred.portalType}
                            {cred.username ? ` · ID ${cred.username}` : ''}
                          </p>
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          {cred.portalUrl && (
                            <a
                              href={cred.portalUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="h-7 w-7 rounded-md text-ink-muted hover:text-ink-primary hover:bg-surface-card inline-flex items-center justify-center"
                              title="Open portal URL"
                            >
                              <ExternalLink className="w-4 h-4" strokeWidth={1.5} />
                            </a>
                          )}
                          <button
                            type="button"
                            onClick={() => openEditCredModal(cred)}
                            className="h-7 w-7 rounded-md text-ink-muted hover:text-ink-primary hover:bg-surface-card inline-flex items-center justify-center"
                            title="Edit credential"
                          >
                            <Edit className="w-4 h-4" strokeWidth={1.5} />
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              if (window.confirm(`Delete saved credential "${cred.label}"?`)) {
                                onDeleteCredential(cred.id);
                              }
                            }}
                            className="h-7 w-7 rounded-md text-ink-muted hover:text-tone-negative hover:bg-surface-card inline-flex items-center justify-center"
                            title="Delete credential"
                          >
                            <Trash2 className="w-4 h-4" strokeWidth={1.5} />
                          </button>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 rounded-lg bg-surface-card border border-hairline text-xs">
                        <div className="min-w-0">
                          <span className="block text-ink-muted mb-1">Login email</span>
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-mono text-ink-primary truncate">{cred.loginEmail}</span>
                            <button
                              type="button"
                              onClick={() => copyText(cred.loginEmail, `email-${cred.id}`)}
                              className="text-ink-muted hover:text-ink-primary shrink-0"
                              title="Copy email"
                            >
                              {copiedKey === `email-${cred.id}` ? (
                                <Check className="w-3.5 h-3.5 text-tone-positive" strokeWidth={1.5} />
                              ) : (
                                <Copy className="w-3.5 h-3.5" strokeWidth={1.5} />
                              )}
                            </button>
                          </div>
                        </div>

                        <div className="min-w-0">
                          <span className="block text-ink-muted mb-1">Password</span>
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-mono text-ink-primary truncate">
                              {revealed
                                ? revealed.password || '—'
                                : cred.passwordMasked || (cred.hasPassword ? '••••••••••' : 'Not set')}
                            </span>
                            {cred.hasPassword && (
                              <div className="flex items-center gap-1.5 shrink-0">
                                <button
                                  type="button"
                                  onClick={() => handleToggleReveal(cred)}
                                  className="text-ink-muted hover:text-ink-primary"
                                  title={revealed ? 'Hide password' : 'Reveal password'}
                                >
                                  {revealed ? (
                                    <EyeOff className="w-3.5 h-3.5" strokeWidth={1.5} />
                                  ) : (
                                    <Eye className="w-3.5 h-3.5" strokeWidth={1.5} />
                                  )}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleCopyPassword(cred)}
                                  className="text-ink-muted hover:text-ink-primary"
                                  title="Copy decrypted password"
                                >
                                  {copiedKey === `pwd-${cred.id}` ? (
                                    <Check className="w-3.5 h-3.5 text-tone-positive" strokeWidth={1.5} />
                                  ) : (
                                    <Copy className="w-3.5 h-3.5" strokeWidth={1.5} />
                                  )}
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      {(cred.recoveryEmail || cred.recoveryPhone || revealed?.pinOrSecurityNote || cred.notes) && (
                        <div className="space-y-1 text-xs text-ink-secondary">
                          {(cred.recoveryEmail || cred.recoveryPhone) && (
                            <p className="font-mono text-ink-muted">
                              Recovery: {cred.recoveryEmail || '—'}
                              {cred.recoveryPhone ? ` · ${cred.recoveryPhone}` : ''}
                            </p>
                          )}
                          {revealed?.pinOrSecurityNote && (
                            <p className="font-mono text-brass">
                              2FA / security note: {revealed.pinOrSecurityNote}
                            </p>
                          )}
                          {cred.notes && <p className="text-ink-secondary">{cred.notes}</p>}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Upgraded Documents Vault with Portal Packet ZIP Download, Drag-Drop, Preview, Re-Extract & Delete */}
        {activeTab === 'documents' && (
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragOverDocs(true);
            }}
            onDragLeave={() => setIsDragOverDocs(false)}
            onDrop={handleDropDocs}
            className={`space-y-4 rounded-xl transition-colors ${
              isDragOverDocs ? 'ring-2 ring-brass bg-brass-soft/30 p-2 -m-2' : ''
            }`}
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-medium text-ink-primary">
                  Candidate document vault & portal upload packet
                </h3>
                <p className="text-xs text-ink-muted mt-0.5">
                  Drag & drop PDFs or images anywhere here, or export a single standardized .zip packet
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {documents.length > 0 && (
                  <button
                    type="button"
                    onClick={handleDownloadAllDocs}
                    disabled={downloadingPacket}
                    className="btn-secondary"
                  >
                    <Download className="w-4 h-4 text-ink-muted" strokeWidth={1.5} />
                    <span>
                      {downloadingPacket
                        ? 'Building ZIP...'
                        : `Portal packet (.zip · ${documents.length})`}
                    </span>
                  </button>
                )}
                <button type="button" onClick={() => setIsUploadModalOpen(true)} className="btn-primary">
                  <Upload className="w-4 h-4 text-[#141415]" strokeWidth={1.5} />
                  <span>Upload documents</span>
                </button>
              </div>
            </div>

            {documents.length === 0 ? (
              <div className="p-8 rounded-xl bg-surface-deep border border-hairline text-center text-sm text-ink-muted">
                No source documents uploaded yet
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3.5">
                {documents.map((doc) => {
                  const portalName = doc.portalFileName || doc.fileName;
                  const fieldCount = Object.keys(doc.extractedFields || {}).length;
                  const isBusy = busyDocId === doc.id;

                  return (
                    <div
                      key={doc.id}
                      className="p-4 rounded-xl bg-surface-deep border border-hairline flex flex-col justify-between gap-3.5"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-3 min-w-0">
                          <FileText className="w-4 h-4 text-brass shrink-0 mt-0.5" strokeWidth={1.5} />
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-ink-primary truncate">{doc.fileName}</p>
                            <p className="font-mono text-xs text-brass truncate mt-0.5">
                              Portal file: {portalName}
                            </p>
                            <p className="font-mono text-xs text-ink-muted tabular-nums mt-1">
                              {formatCategoryLabel(doc.category)} · {(doc.fileSize / 1024).toFixed(0)} KB ·{' '}
                              {fieldCount} extracted field{fieldCount === 1 ? '' : 's'}
                            </p>
                          </div>
                        </div>
                        <VerificationStamp
                          tone={
                            doc.verificationStatus === 'conflict'
                              ? 'negative'
                              : doc.verificationStatus === 'verified'
                              ? 'positive'
                              : 'brass'
                          }
                          label={
                            doc.verificationStatus === 'needs_review'
                              ? 'Needs review'
                              : doc.verificationStatus === 'conflict'
                              ? 'Conflict'
                              : 'Verified'
                          }
                          meta={formatExtractionMethod(doc.extractionMethod)}
                        />
                      </div>

                      <div className="pt-3 border-t border-hairline flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => api.downloadDocumentBlob(doc.id, 'portal', portalName)}
                            className="btn-secondary h-8 px-2.5 text-xs"
                            title={`Download ${portalName}`}
                          >
                            <Download className="w-4 h-4 text-ink-muted" strokeWidth={1.5} />
                            <span>Download</span>
                          </button>
                          {onSelectReviewDoc && (
                            <button
                              type="button"
                              onClick={() => onSelectReviewDoc(doc)}
                              className="btn-secondary h-8 px-2.5 text-xs"
                            >
                              <Eye className="w-4 h-4 text-ink-muted" strokeWidth={1.5} />
                              <span>Preview & review</span>
                            </button>
                          )}
                        </div>

                        <div className="flex items-center gap-1">
                          {onReextractDocument && (
                            <button
                              type="button"
                              disabled={isBusy}
                              onClick={async () => {
                                setBusyDocId(doc.id);
                                try {
                                  await onReextractDocument(doc.id, doc.category);
                                } finally {
                                  setBusyDocId(null);
                                }
                              }}
                              className="h-8 w-8 rounded-lg text-ink-muted hover:text-ink-primary hover:bg-surface-card inline-flex items-center justify-center"
                              title="Re-extract fields"
                            >
                              <RefreshCw
                                className={`w-4 h-4 ${isBusy ? 'animate-spin' : ''}`}
                                strokeWidth={1.5}
                              />
                            </button>
                          )}
                          {onDeleteDocument && (
                            <button
                              type="button"
                              disabled={isBusy}
                              onClick={() => {
                                if (window.confirm(`Delete document "${doc.fileName}"?`)) {
                                  onDeleteDocument(doc.id);
                                }
                              }}
                              className="h-8 w-8 rounded-lg text-ink-muted hover:text-tone-negative hover:bg-surface-card inline-flex items-center justify-center"
                              title="Delete document"
                            >
                              <Trash2 className="w-4 h-4" strokeWidth={1.5} />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {activeTab === 'identity' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              <div className="lg:col-span-7 p-5 rounded-xl bg-surface-deep border border-hairline">
                <h3 className="text-sm font-medium text-ink-primary mb-4">Travel document fields</h3>
                {candidate.passport ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                    <FieldCell label="Passport number" value={candidate.passport.passportNumber} mono />
                    <FieldCell label="Name on document" value={candidate.passport.fullName} />
                    <FieldCell label="Issuing country" value={candidate.passport.issuingCountry} />
                    <FieldCell label="Place of issue" value={candidate.passport.placeOfIssue} />
                    <FieldCell label="Issue date" value={candidate.passport.issueDate} mono />
                    <FieldCell label="Expiry date" value={candidate.passport.expiryDate} mono />
                  </div>
                ) : (
                  <div className="py-6 space-y-3">
                    <p className="text-sm text-ink-secondary">No passport scan attached to this dossier</p>
                    <button type="button" onClick={() => setIsUploadModalOpen(true)} className="btn-primary">
                      Upload passport scan
                    </button>
                  </div>
                )}
              </div>
              <div className="lg:col-span-5">
                <PassportCredentialCard candidate={candidate} />
              </div>
            </div>

            <div className="p-5 rounded-xl bg-surface-deep border border-hairline">
              <h3 className="text-sm font-medium text-ink-primary mb-4">Legal identity</h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
                <FieldCell label="Given names" value={candidate.personal.legalGivenName} />
                <FieldCell label="Middle name" value={candidate.personal.middleName} />
                <FieldCell label="Family surname" value={candidate.personal.familyName} />
                <FieldCell label="Date of birth" value={candidate.personal.dateOfBirth} mono />
                <FieldCell label="Gender" value={candidate.personal.gender} />
                <FieldCell label="Marital status" value={candidate.personal.maritalStatus} />
                <FieldCell label="Primary nationality" value={candidate.personal.nationality} />
                <FieldCell label="Country of birth" value={candidate.personal.countryOfBirth} />
                <FieldCell label="National ID" value={candidate.personal.nationalId} mono />
              </div>
            </div>

            <div className="p-5 rounded-xl bg-surface-deep border border-hairline">
              <h3 className="text-sm font-medium text-ink-primary mb-4">Residential & contact details</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <FieldCell label="Personal email" value={candidate.contact.email} />
                <FieldCell label="Dedicated student portal email" value={primaryStudentEmail} mono />
                <FieldCell label="Mobile phone" value={candidate.contact.phone} mono />
                <FieldCell label="WhatsApp" value={candidate.contact.whatsapp || candidate.contact.phone} mono />
                <FieldCell label="Street address" value={candidate.contact.currentAddress} />
                <FieldCell
                  label="City, state & postal code"
                  value={`${candidate.contact.city}, ${candidate.contact.state} ${candidate.contact.postalCode}`}
                />
                <FieldCell label="Country of residence" value={candidate.contact.country} />
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <h3 className="text-sm font-medium text-ink-primary">Field provenance & audit ledger</h3>
                <p className="text-[13px] text-ink-secondary mt-0.5">
                  Source document, extraction confidence, and consultant verification state per field
                </p>
              </div>
              <div className="bg-surface-deep border border-hairline rounded-xl overflow-hidden">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-hairline text-xs text-ink-muted">
                      <th className="py-2.5 px-4 font-normal">Field key</th>
                      <th className="py-2.5 px-4 font-normal">Source document</th>
                      <th className="py-2.5 px-4 font-normal text-right">Confidence</th>
                      <th className="py-2.5 px-4 font-normal text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-hairline text-[13px]">
                    {Object.entries(candidate.evidence || {}).map(([key, ev]) => (
                      <tr key={key} className="hover:bg-surface-card">
                        <td className="py-2.5 px-4 font-mono text-xs text-ink-primary">{key}</td>
                        <td className="py-2.5 px-4 text-ink-secondary">{ev.sourceDocumentName || 'Manual entry'}</td>
                        <td className="py-2.5 px-4 font-mono text-xs tabular-nums text-ink-primary text-right">
                          {(ev.confidence * 100).toFixed(0)}%
                        </td>
                        <td className="py-2.5 px-4 text-right">
                          <VerificationStamp
                            tone={ev.status === 'verified' ? 'positive' : 'brass'}
                            label={ev.status}
                          />
                        </td>
                      </tr>
                    ))}
                    {Object.keys(candidate.evidence || {}).length === 0 && (
                      <tr>
                        <td colSpan={4} className="py-8 text-center text-ink-muted text-sm">
                          No provenance entries recorded
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'academics' && (
          <div className="space-y-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium text-ink-primary">Academic qualifications</h3>
                <button type="button" onClick={() => setIsUploadModalOpen(true)} className="btn-secondary">
                  Upload transcript
                </button>
              </div>
              {candidate.education.length === 0 ? (
                <div className="p-8 rounded-xl bg-surface-deep border border-hairline text-center text-sm text-ink-muted">
                  No academic records logged yet
                </div>
              ) : (
                <div className="space-y-3">
                  {candidate.education.map((edu, idx) => (
                    <div key={edu.id || idx} className="p-5 rounded-xl bg-surface-deep border border-hairline">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="text-base font-medium text-ink-primary">{edu.degreeTitle}</p>
                          <p className="text-[13px] text-ink-secondary mt-0.5">
                            {edu.institution} · {edu.country}
                          </p>
                        </div>
                        <VerificationStamp tone="positive" label={edu.qualificationLevel} meta={edu.status} />
                      </div>
                      <div className="flex flex-wrap gap-6 mt-4 pt-3 border-t border-hairline text-xs text-ink-secondary tabular-nums">
                        <span>Major: {edu.major}</span>
                        <span>GPA / Grade: {edu.gpa || '—'}</span>
                        {edu.awardDate && <span>Awarded: {edu.awardDate}</span>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium text-ink-primary">English proficiency scores</h3>
                <button type="button" onClick={() => setIsUploadModalOpen(true)} className="btn-secondary">
                  Upload score report
                </button>
              </div>
              {candidate.englishTests.length === 0 ? (
                <div className="p-8 rounded-xl bg-surface-deep border border-hairline text-center text-sm text-ink-muted">
                  No language certificates recorded
                </div>
              ) : (
                <div className="space-y-3">
                  {candidate.englishTests.map((test, idx) => (
                    <div key={test.id || idx} className="p-5 rounded-xl bg-surface-deep border border-hairline">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-base font-medium text-ink-primary">{test.testType}</p>
                          <p className="text-xs text-ink-muted tabular-nums mt-0.5">
                            Date {test.testDate}
                            {test.referenceNumber ? ` · TRF ${test.referenceNumber}` : ''}
                          </p>
                        </div>
                        <span className="text-lg font-medium text-brass tabular-nums">
                          Band {test.overallScore}
                        </span>
                      </div>
                      <div className="grid grid-cols-4 gap-3 mt-4 pt-3 border-t border-hairline">
                        {[
                          { label: 'Listening', val: test.listening },
                          { label: 'Reading', val: test.reading },
                          { label: 'Writing', val: test.writing },
                          { label: 'Speaking', val: test.speaking },
                        ].map((sub) => (
                          <div key={sub.label} className="p-2.5 rounded-lg bg-surface-card border border-hairline">
                            <span className="block text-xs text-ink-muted">{sub.label}</span>
                            <span className="block text-sm font-medium text-ink-primary tabular-nums mt-0.5">
                              {sub.val || '—'}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-3">
              <h3 className="text-sm font-medium text-ink-primary">Employment history</h3>
              {candidate.employment.length === 0 ? (
                <div className="p-8 rounded-xl bg-surface-deep border border-hairline text-center text-sm text-ink-muted">
                  No employment records logged
                </div>
              ) : (
                candidate.employment.map((emp, idx) => (
                  <div key={emp.id || idx} className="p-5 rounded-xl bg-surface-deep border border-hairline">
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-base font-medium text-ink-primary">{emp.jobTitle}</span>
                      <span className="text-[13px] text-ink-secondary">{emp.company}</span>
                    </div>
                    <p className="text-xs text-ink-muted tabular-nums mt-1">
                      {emp.startDate} — {emp.endDate || (emp.isCurrent ? 'Present' : '—')} · {emp.employmentType}
                      {emp.location ? ` · ${emp.location}` : ''}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {activeTab === 'applications' && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-medium text-ink-primary">
                  University applications for {candidate.personal.legalGivenName}{' '}
                  {candidate.personal.familyName}
                </h3>
                <p className="text-xs text-ink-muted mt-0.5">
                  Live offer stages, intake deadlines, CAS/visa progress, and Chrome extension autofill history
                </p>
              </div>
              {onOpenApplicationsTab && (
                <button type="button" onClick={onOpenApplicationsTab} className="btn-secondary shrink-0">
                  <ExternalLink className="w-4 h-4 text-ink-muted" strokeWidth={1.5} />
                  <span>Open applications tracker</span>
                </button>
              )}
            </div>

            {applications.length === 0 ? (
              <div className="p-8 rounded-xl bg-surface-deep border border-hairline text-center space-y-2">
                <p className="text-sm text-ink-muted">No university applications linked to this student yet</p>
                {onOpenApplicationsTab && (
                  <button type="button" onClick={onOpenApplicationsTab} className="btn-primary text-xs">
                    <Plus className="w-4 h-4" strokeWidth={1.5} />
                    <span>Create application</span>
                  </button>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                {applications.map((app) => (
                  <div
                    key={app.id}
                    className="p-4 rounded-xl bg-surface-deep border border-hairline space-y-3"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-medium text-ink-primary">{app.institutionName}</p>
                        <p className="text-xs text-ink-secondary mt-0.5">
                          {app.programName} · {app.country}
                          {app.intake ? ` · ${app.intake}` : ''}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
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
                          meta={app.deadline ? `Due ${app.deadline}` : undefined}
                        />
                      </div>
                    </div>

                    {(app.casStatus || app.visaStatus || app.portalUrl) && (
                      <div className="flex flex-wrap items-center gap-3 text-xs text-ink-muted pt-1 border-t border-hairline">
                        {app.casStatus && (
                          <span className="inline-flex items-center gap-1.5">
                            <span>CAS/I-20</span>
                            <span className="font-medium text-ink-primary capitalize">
                              {app.casStatus.replace(/_/g, ' ')}
                            </span>
                          </span>
                        )}
                        {app.visaStatus && (
                          <span className="inline-flex items-center gap-1.5">
                            <span>Visa</span>
                            <span className="font-medium text-ink-primary capitalize">
                              {app.visaStatus.replace(/_/g, ' ')}
                            </span>
                          </span>
                        )}
                        {app.portalUrl && (
                          <a
                            href={app.portalUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="text-brass hover:underline inline-flex items-center gap-1 ml-auto"
                          >
                            <span>Open portal</span>
                            <ExternalLink className="w-3 h-3" strokeWidth={1.5} />
                          </a>
                        )}
                      </div>
                    )}

                    {app.timeline && app.timeline.length > 0 && (
                      <div className="pt-2 border-t border-hairline space-y-1.5">
                        <span className="text-xs font-medium text-ink-muted">Recent activity</span>
                        {app.timeline.slice(0, 3).map((ev) => (
                          <div key={ev.id} className="text-xs flex items-start justify-between gap-2">
                            <span className="text-ink-secondary">{ev.text}</span>
                            <span className="text-[11px] tabular-nums text-ink-muted shrink-0">
                              {ev.actor ? `${ev.actor} · ` : ''}
                              {new Date(ev.timestamp).toLocaleDateString()}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'payments' && (() => {
          const paymentsList = candidate.payments || [];
          return (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-medium text-ink-primary">
                    Student payments & fee receipts
                  </h3>
                  <p className="text-xs text-ink-muted mt-0.5">
                    Record consultancy fees, processing charges, and deposit receipts paid by{' '}
                    {candidate.personal.legalGivenName} to your agency
                  </p>
                </div>
                {onRecordPayment && (
                  <button
                    type="button"
                    onClick={() => {
                      setPayTitle('Consultancy Retainer Fee');
                      setPayAmount('');
                      setPayDate(new Date().toISOString().slice(0, 10));
                      setPayMethod('Bank transfer');
                      setPayRef('');
                      setPayStatus('paid');
                      setPayNotes('');
                      setPayReceiptFile(null);
                      setIsPaymentModalOpen(true);
                    }}
                    className="btn-primary shrink-0"
                  >
                    <Plus className="w-4 h-4 text-[#141415]" strokeWidth={1.5} />
                    <span>Record payment</span>
                  </button>
                )}
              </div>

              {paymentsList.length === 0 ? (
                <div className="p-8 rounded-xl bg-surface-deep border border-hairline text-center text-sm text-ink-muted">
                  No payments recorded from this student yet
                </div>
              ) : (
                <div className="space-y-2.5">
                  {paymentsList.map((pay) => (
                    <div
                      key={pay.id}
                      className="p-4 rounded-xl bg-surface-deep border border-hairline flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                    >
                      <div className="space-y-1 min-w-0">
                        <div className="flex items-center gap-2.5 flex-wrap">
                          <span className="text-sm font-medium text-ink-primary">{pay.title}</span>
                          <span className="font-mono text-sm font-medium text-brass">
                            {pay.amount}
                          </span>
                          <VerificationStamp
                            tone={
                              pay.status === 'paid'
                                ? 'positive'
                                : pay.status === 'refunded'
                                  ? 'negative'
                                  : 'brass'
                            }
                            label={pay.status}
                          />
                        </div>
                        <p className="text-xs text-ink-muted font-mono">
                          Paid {pay.paidDate} · {pay.paymentMethod || 'Bank transfer'}
                          {pay.referenceNumber ? ` · Ref: ${pay.referenceNumber}` : ''}
                          {pay.recordedBy ? ` · Recorded by ${pay.recordedBy}` : ''}
                        </p>
                        {pay.notes && <p className="text-xs text-ink-secondary">{pay.notes}</p>}
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {pay.receiptDocumentId && (
                          <button
                            type="button"
                            onClick={() =>
                              api.downloadDocumentBlob(
                                pay.receiptDocumentId!,
                                'original',
                                pay.receiptFileName || 'Payment_Receipt.pdf'
                              )
                            }
                            className="btn-secondary h-8 px-2.5 text-xs"
                            title={`Download receipt: ${pay.receiptFileName || 'Receipt'}`}
                          >
                            <Download className="w-3.5 h-3.5 text-ink-muted" strokeWidth={1.5} />
                            <span>Receipt</span>
                          </button>
                        )}
                        {onDeletePayment && (
                          <button
                            type="button"
                            onClick={() => {
                              if (window.confirm(`Delete payment "${pay.title}" (${pay.amount})?`)) {
                                onDeletePayment(pay.id);
                              }
                            }}
                            className="h-8 w-8 rounded-lg text-ink-muted hover:text-tone-negative hover:bg-surface-raised inline-flex items-center justify-center"
                            title="Delete payment record"
                          >
                            <Trash2 className="w-4 h-4" strokeWidth={1.5} />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })()}
      </div>

      {/* Record Student Payment Modal */}
      {isPaymentModalOpen && onRecordPayment && (
        <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4">
          <div className="bg-surface-card border border-hairline-strong rounded-2xl w-full max-w-lg overflow-hidden">
            <div className="h-14 px-6 border-b border-hairline flex items-center justify-between">
              <h3 className="text-base font-medium text-ink-primary">Record student payment</h3>
              <button
                type="button"
                onClick={() => setIsPaymentModalOpen(false)}
                className="h-8 w-8 rounded-lg text-ink-muted hover:text-ink-primary hover:bg-surface-raised inline-flex items-center justify-center"
              >
                <X className="w-4 h-4" strokeWidth={1.5} />
              </button>
            </div>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                setSavingPayment(true);
                try {
                  await onRecordPayment({
                    title: payTitle.trim(),
                    amount: payAmount.trim(),
                    paidDate: payDate,
                    paymentMethod: payMethod,
                    referenceNumber: payRef.trim() || undefined,
                    status: payStatus,
                    notes: payNotes.trim() || undefined,
                    receiptFile: payReceiptFile,
                  });
                  setIsPaymentModalOpen(false);
                } finally {
                  setSavingPayment(false);
                }
              }}
              className="p-6 space-y-4 text-sm max-h-[82vh] overflow-y-auto"
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-ink-secondary mb-1.5">Payment description *</label>
                  <input
                    required
                    value={payTitle}
                    onChange={(e) => setPayTitle(e.target.value)}
                    placeholder="Consultancy Retainer Fee"
                    className="field-input"
                  />
                </div>
                <div>
                  <label className="block text-xs text-ink-secondary mb-1.5">Amount paid *</label>
                  <input
                    required
                    value={payAmount}
                    onChange={(e) => setPayAmount(e.target.value)}
                    placeholder="PKR 75,000 / GBP 500"
                    className="field-input font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs text-ink-secondary mb-1.5">Payment date</label>
                  <input
                    type="date"
                    value={payDate}
                    onChange={(e) => setPayDate(e.target.value)}
                    className="field-input font-mono text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs text-ink-secondary mb-1.5">Method</label>
                  <select
                    value={payMethod}
                    onChange={(e) => setPayMethod(e.target.value)}
                    className="field-input text-xs"
                  >
                    <option value="Bank transfer">Bank transfer</option>
                    <option value="Cash">Cash</option>
                    <option value="Card">Card</option>
                    <option value="Online / Wise">Online / Wise</option>
                    <option value="Cheque">Cheque</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-ink-secondary mb-1.5">Status</label>
                  <select
                    value={payStatus}
                    onChange={(e) => setPayStatus(e.target.value as CandidatePaymentStatus)}
                    className="field-input text-xs"
                  >
                    <option value="paid">Paid</option>
                    <option value="partial">Partial</option>
                    <option value="pending">Pending</option>
                    <option value="refunded">Refunded</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs text-ink-secondary mb-1.5">
                  Transaction / receipt reference #
                </label>
                <input
                  value={payRef}
                  onChange={(e) => setPayRef(e.target.value)}
                  placeholder="TXN-984712"
                  className="field-input font-mono text-xs"
                />
              </div>

              <div>
                <label className="block text-xs text-ink-secondary mb-1.5">
                  Attach payment receipt (PDF or image)
                </label>
                <input
                  type="file"
                  accept=".pdf,.png,.jpg,.jpeg,.webp"
                  onChange={(e) => setPayReceiptFile(e.target.files?.[0] || null)}
                  className="block w-full text-xs text-ink-secondary file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border file:border-hairline file:bg-surface-deep file:text-xs file:text-ink-primary hover:file:border-hairline-strong"
                />
              </div>

              <div>
                <label className="block text-xs text-ink-secondary mb-1.5">Notes</label>
                <textarea
                  value={payNotes}
                  onChange={(e) => setPayNotes(e.target.value)}
                  rows={2}
                  className="field-input h-auto py-2"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-hairline">
                <button
                  type="button"
                  onClick={() => setIsPaymentModalOpen(false)}
                  className="btn-secondary"
                >
                  Cancel
                </button>
                <button type="submit" disabled={savingPayment} className="btn-primary">
                  {savingPayment ? 'Saving payment...' : 'Save payment & receipt'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Multi-file Document Upload Modal */}
      <DocumentUploadModal
        isOpen={isUploadModalOpen}
        onClose={() => setIsUploadModalOpen(false)}
        onUpload={async (files, category) => {
          await onUploadDocuments(files, category);
        }}
      />

      {/* Add / Edit Student Email or Portal Credential Modal */}
      {isCredModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4">
          <div className="bg-surface-card border border-hairline-strong rounded-2xl w-full max-w-lg overflow-hidden">
            <div className="h-14 px-6 border-b border-hairline flex items-center justify-between">
              <h3 className="text-base font-medium text-ink-primary">
                {editingCred ? 'Edit saved login' : 'Save student email or portal login'}
              </h3>
              <button
                type="button"
                onClick={() => setIsCredModalOpen(false)}
                className="h-8 w-8 rounded-lg text-ink-muted hover:text-ink-primary hover:bg-surface-raised inline-flex items-center justify-center"
              >
                <X className="w-4 h-4" strokeWidth={1.5} />
              </button>
            </div>

            <form onSubmit={handleSubmitCredential} className="p-6 space-y-4 max-h-[82vh] overflow-y-auto text-sm">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-ink-secondary mb-1.5">Account type</label>
                  <select
                    value={credType}
                    onChange={(e) => {
                      const val = e.target.value as PortalCredentialType;
                      setCredType(val);
                      if (val === 'dedicated_email' && !editingCred) {
                        setCredPrimaryEmail(true);
                      }
                    }}
                    className="field-input"
                  >
                    {(Object.keys(PORTAL_TYPE_LABELS) as PortalCredentialType[]).map((k) => (
                      <option key={k} value={k}>
                        {PORTAL_TYPE_LABELS[k]}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-ink-secondary mb-1.5">Account label *</label>
                  <input
                    required
                    value={credLabel}
                    onChange={(e) => setCredLabel(e.target.value)}
                    placeholder="University of Edinburgh EUCLID"
                    className="field-input"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-ink-secondary mb-1.5">Login email *</label>
                  <input
                    required
                    type="email"
                    value={credEmail}
                    onChange={(e) => setCredEmail(e.target.value)}
                    placeholder="student.admissions2027@gmail.com"
                    className="field-input font-mono text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs text-ink-secondary mb-1.5">
                    Username / applicant ID
                  </label>
                  <input
                    value={credUsername}
                    onChange={(e) => setCredUsername(e.target.value)}
                    placeholder="UUN / UCAS ID"
                    className="field-input font-mono text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-ink-secondary mb-1.5">
                    Password {editingCred ? '(leave blank to keep)' : ''}
                  </label>
                  <input
                    type="password"
                    value={credPassword}
                    onChange={(e) => setCredPassword(e.target.value)}
                    placeholder="Encrypted with AES-256-GCM"
                    className="field-input font-mono text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs text-ink-secondary mb-1.5">Portal login URL</label>
                  <input
                    value={credUrl}
                    onChange={(e) => setCredUrl(e.target.value)}
                    placeholder="https://admissions.ed.ac.uk"
                    className="field-input font-mono text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-ink-secondary mb-1.5">Recovery email</label>
                  <input
                    value={credRecoveryEmail}
                    onChange={(e) => setCredRecoveryEmail(e.target.value)}
                    placeholder="agency-recovery@globaledu.com"
                    className="field-input font-mono text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs text-ink-secondary mb-1.5">Recovery phone</label>
                  <input
                    value={credRecoveryPhone}
                    onChange={(e) => setCredRecoveryPhone(e.target.value)}
                    placeholder="+44 20 7946 0821"
                    className="field-input font-mono text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs text-ink-secondary mb-1.5">
                  2FA backup code / security question answer (encrypted)
                </label>
                <input
                  value={credPinNote}
                  onChange={(e) => setCredPinNote(e.target.value)}
                  placeholder="Security Q: First school -> Beaconhouse"
                  className="field-input font-mono text-xs"
                />
              </div>

              <label className="inline-flex items-center gap-2.5 text-xs text-ink-secondary cursor-pointer">
                <input
                  type="checkbox"
                  checked={credPrimaryEmail}
                  onChange={(e) => setCredPrimaryEmail(e.target.checked)}
                  className="w-4 h-4 rounded bg-surface-deep border-hairline accent-[#d4a853]"
                />
                <span>
                  Use this email as the student's primary application email during portal autofill
                </span>
              </label>

              <div>
                <label className="block text-xs text-ink-secondary mb-1.5">Consultant notes</label>
                <textarea
                  value={credNotes}
                  onChange={(e) => setCredNotes(e.target.value)}
                  rows={2}
                  className="field-input h-auto py-2"
                />
              </div>

              <div className="flex justify-end gap-2.5 pt-3 border-t border-hairline">
                <button
                  type="button"
                  onClick={() => setIsCredModalOpen(false)}
                  className="btn-secondary"
                >
                  Cancel
                </button>
                <button type="submit" disabled={savingCred} className="btn-primary">
                  {savingCred ? 'Encrypting & saving...' : 'Save credential'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Shareable Student Intake Upload Link Modal */}
      {isShareModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4">
          <div className="bg-surface-card border border-hairline-strong rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl">
            <div className="px-6 py-4 border-b border-hairline flex items-center justify-between">
              <div>
                <h3 className="text-base font-medium text-ink-primary">
                  Student document upload link
                </h3>
                <p className="text-xs text-ink-secondary mt-0.5">
                  Send this link to {candidate.personal.legalGivenName} so they can upload missing documents directly.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsShareModalOpen(false)}
                className="text-ink-muted hover:text-ink-primary p-1"
              >
                <X className="w-4 h-4" strokeWidth={1.5} />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {shareError && (
                <div className="px-3 py-2 rounded-lg bg-tone-negative/10 border border-tone-negative/30 text-xs text-tone-negative">
                  {shareError}
                </div>
              )}

              {shareLoading ? (
                <div className="py-6 text-center text-xs text-ink-secondary">
                  Updating secure upload link...
                </div>
              ) : shareUrl ? (
                <>
                  <div>
                    <label className="block text-xs text-ink-secondary mb-1.5">
                      Shareable student portal URL
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        readOnly
                        value={shareUrl}
                        onClick={(e) => (e.target as HTMLInputElement).select()}
                        className="field-input font-mono text-xs flex-1"
                      />
                      <button
                        type="button"
                        onClick={() => copyText(shareUrl, 'share-url')}
                        className="btn-primary shrink-0"
                      >
                        {copiedKey === 'share-url' ? (
                          <Check className="w-4 h-4" strokeWidth={1.5} />
                        ) : (
                          <Copy className="w-4 h-4" strokeWidth={1.5} />
                        )}
                        <span>{copiedKey === 'share-url' ? 'Copied' : 'Copy link'}</span>
                      </button>
                    </div>
                    {candidate.intakeShareExpiresAt && (
                      <p className="text-[11px] text-ink-muted mt-1.5">
                        14-day link · Expires{' '}
                        {new Date(candidate.intakeShareExpiresAt).toLocaleDateString()}
                      </p>
                    )}
                  </div>

                  {/* Optional 4-digit Access PIN */}
                  <div className="p-3.5 rounded-xl bg-surface-deep border border-hairline space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <label className="text-xs font-medium text-ink-primary">
                        Optional 4-digit access PIN
                      </label>
                      {candidate.intakeSharePin ? (
                        <span className="text-[11px] text-tone-positive font-medium">
                          PIN active ({candidate.intakeSharePin})
                        </span>
                      ) : (
                        <span className="text-[11px] text-ink-muted">No PIN set</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        inputMode="numeric"
                        maxLength={4}
                        value={sharePinDraft}
                        onChange={(e) =>
                          setSharePinDraft(e.target.value.replace(/\D/g, '').slice(0, 4))
                        }
                        placeholder="e.g. 4829"
                        className="field-input font-mono text-xs w-32"
                      />
                      <button
                        type="button"
                        disabled={
                          sharePinDraft.length > 0 && sharePinDraft.length !== 4
                        }
                        onClick={() => handleSaveSharePin(sharePinDraft)}
                        className="btn-secondary text-xs"
                      >
                        {candidate.intakeSharePin ? 'Update PIN' : 'Set PIN'}
                      </button>
                      {candidate.intakeSharePin && (
                        <button
                          type="button"
                          onClick={() => handleSaveSharePin('')}
                          className="btn-secondary text-xs text-ink-muted"
                        >
                          Remove PIN
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() =>
                        copyText(
                          `Hi ${candidate.personal.legalGivenName}, please upload your admissions documents securely using this link: ${shareUrl}${
                            candidate.intakeSharePin ? ` (Access PIN: ${candidate.intakeSharePin})` : ''
                          }`,
                          'share-wa'
                        )
                      }
                      className="btn-secondary text-xs"
                    >
                      {copiedKey === 'share-wa' ? (
                        <Check className="w-3.5 h-3.5 text-tone-positive" strokeWidth={1.5} />
                      ) : (
                        <Copy className="w-3.5 h-3.5 text-ink-muted" strokeWidth={1.5} />
                      )}
                      <span>
                        {copiedKey === 'share-wa' ? 'Message copied' : 'Copy WhatsApp message'}
                      </span>
                    </button>

                    <a
                      href={shareUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="btn-secondary text-xs"
                    >
                      <ExternalLink className="w-3.5 h-3.5 text-ink-muted" strokeWidth={1.5} />
                      <span>Open portal</span>
                    </a>

                    <button
                      type="button"
                      onClick={handleRegenerateShareLink}
                      className="btn-secondary text-xs"
                    >
                      <RefreshCw className="w-3.5 h-3.5 text-ink-muted" strokeWidth={1.5} />
                      <span>Regenerate</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleRevokeShareLink}
                      className="btn-secondary text-xs text-tone-negative ml-auto"
                    >
                      <span>Revoke</span>
                    </button>
                  </div>
                </>
              ) : (
                <div className="py-4 text-center space-y-3">
                  <p className="text-xs text-ink-secondary">
                    No active upload link for this candidate.
                  </p>
                  <button
                    type="button"
                    onClick={handleRegenerateShareLink}
                    className="btn-primary"
                  >
                    Generate upload link
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
