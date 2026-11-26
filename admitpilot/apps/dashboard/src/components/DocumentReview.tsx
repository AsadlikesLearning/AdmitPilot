import React, { useState, useEffect, useRef } from 'react';
import {
  FileText,
  Edit2,
  Check,
  X,
  Download,
  RefreshCw,
  AlertTriangle,
  Eye,
  Code2,
  Upload,
  CheckCircle2,
  ChevronDown,
  Search,
} from 'lucide-react';
import { CandidateDocument, CandidateProfile, DocumentCategory } from 'admitpilot-shared';
import { VerificationStamp, formatExtractionMethod, formatCategoryLabel } from './ui/Primitives';
import { api } from '../api';

interface DocumentReviewProps {
  document: CandidateDocument | null;
  allDocuments?: CandidateDocument[];
  candidate: CandidateProfile | null;
  candidates?: CandidateProfile[];
  onSelectCandidate?: (candidate: CandidateProfile) => void;
  onSelectDocument?: (doc: CandidateDocument) => void;
  onReconcile: (fieldKey: string, approvedValue: any, note?: string, documentId?: string) => void;
  onReextract?: (docId: string, category?: DocumentCategory | 'auto') => Promise<void>;
  onUpdateCategory?: (docId: string, category: DocumentCategory) => Promise<void>;
  onUploadDocuments?: (files: File[], category?: DocumentCategory | 'auto') => Promise<void>;
  onClose?: () => void;
}

const CATEGORY_OPTIONS: { value: DocumentCategory; label: string }[] = [
  { value: 'passport', label: 'Passport' },
  { value: 'transcript', label: 'Transcript' },
  { value: 'degree', label: 'Degree' },
  { value: 'english_test', label: 'English test' },
  { value: 'cv', label: 'CV / Resume' },
  { value: 'sop', label: 'SOP' },
  { value: 'lor', label: 'LOR' },
  { value: 'financial', label: 'Financial' },
  { value: 'experience', label: 'Experience' },
  { value: 'other', label: 'Other' },
];

export const DocumentReview: React.FC<DocumentReviewProps> = ({
  document,
  allDocuments = [],
  candidate,
  candidates = [],
  onSelectCandidate,
  onSelectDocument,
  onReconcile,
  onReextract,
  onUpdateCategory,
  onUploadDocuments,
  onClose,
}) => {
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editValue, setEditValue] = useState<string>('');
  const [leftMode, setLeftMode] = useState<'preview' | 'text'>('preview');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewMime, setPreviewMime] = useState<string>('application/pdf');
  const [previewLoading, setPreviewLoading] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<DocumentCategory>('passport');
  const [reextracting, setReextracting] = useState(false);
  const [updatingCategory, setUpdatingCategory] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [showApproveDiff, setShowApproveDiff] = useState(false);
  const [fieldFilter, setFieldFilter] = useState<'all' | 'pending' | 'confirmed'>('all');
  const [candidateMenuOpen, setCandidateMenuOpen] = useState(false);
  const [candidateSearch, setCandidateSearch] = useState('');
  const [statusBanner, setStatusBanner] = useState<{
    tone: 'positive' | 'negative';
    text: string;
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!document) {
      setPreviewUrl(null);
      return;
    }
    setSelectedCategory(document.category);
    let activeUrl: string | null = null;
    let cancelled = false;

    setPreviewLoading(true);
    api
      .fetchDocumentPreviewUrl(document.id)
      .then(({ objectUrl, mimeType }) => {
        if (cancelled) {
          URL.revokeObjectURL(objectUrl);
          return;
        }
        activeUrl = objectUrl;
        setPreviewUrl(objectUrl);
        setPreviewMime(mimeType);
      })
      .catch(() => {
        if (!cancelled) {
          setPreviewUrl(null);
          setLeftMode('text');
        }
      })
      .finally(() => {
        if (!cancelled) setPreviewLoading(false);
      });

    return () => {
      cancelled = true;
      if (activeUrl) URL.revokeObjectURL(activeUrl);
    };
  }, [document?.id]);

  const showBanner = (tone: 'positive' | 'negative', text: string) => {
    setStatusBanner({ tone, text });
    setTimeout(() => setStatusBanner((prev) => (prev?.text === text ? null : prev)), 4500);
  };

  const handleCategoryChange = async (newCategory: DocumentCategory) => {
    setSelectedCategory(newCategory);
    if (!document || newCategory === document.category) return;

    setUpdatingCategory(true);
    try {
      if (onUpdateCategory) {
        await onUpdateCategory(document.id, newCategory);
        showBanner('positive', `Category set to ${formatCategoryLabel(newCategory)}`);
      }
      if (onReextract) {
        setReextracting(true);
        await onReextract(document.id, newCategory);
        showBanner(
          'positive',
          `Re-classified as ${formatCategoryLabel(newCategory)} and refreshed extracted fields`
        );
      }
    } catch (err: any) {
      showBanner('negative', err?.message || 'Failed to update category');
    } finally {
      setUpdatingCategory(false);
      setReextracting(false);
    }
  };

  const handleReextractClick = async () => {
    if (!document || !onReextract) return;
    setReextracting(true);
    try {
      await onReextract(document.id, selectedCategory);
      showBanner('positive', `Extraction refreshed as ${formatCategoryLabel(selectedCategory)}`);
    } catch (err: any) {
      showBanner('negative', err?.message || 'Re-extraction failed');
    } finally {
      setReextracting(false);
    }
  };

  const initialsOf = (c: CandidateProfile) =>
    `${c.personal.legalGivenName?.[0] || ''}${c.personal.familyName?.[0] || ''}`.toUpperCase() || 'ST';

  const renderCandidateSwitcher = () => {
    if (candidates.length === 0 || !onSelectCandidate) return null;
    const filteredCands = candidates.filter((c) => {
      if (!candidateSearch.trim()) return true;
      const q = candidateSearch.toLowerCase();
      return `${c.personal.legalGivenName} ${c.personal.familyName} ${c.personal.nationality} ${
        c.passport?.passportNumber || ''
      }`
        .toLowerCase()
        .includes(q);
    });

    return (
      <div className="relative">
        <button
          type="button"
          onClick={() => {
            setCandidateMenuOpen((o) => !o);
            setCandidateSearch('');
          }}
          aria-label="Switch student in Document Review"
          className="h-9 px-3 rounded-lg bg-surface-card border border-hairline hover:border-hairline-strong inline-flex items-center gap-2.5 text-xs transition-colors"
        >
          <span className="w-5 h-5 rounded bg-surface-deep border border-hairline font-mono text-[10px] text-brass flex items-center justify-center shrink-0">
            {candidate ? initialsOf(candidate) : 'ST'}
          </span>
          <span className="font-medium text-ink-primary truncate max-w-[160px]">
            {candidate
              ? `${candidate.personal.legalGivenName} ${candidate.personal.familyName}`
              : 'Select student'}
          </span>
          <ChevronDown className="w-3.5 h-3.5 text-ink-muted shrink-0" strokeWidth={1.5} />
        </button>

        {candidateMenuOpen && (
          <div className="absolute right-0 mt-2 w-72 rounded-xl bg-surface-card border border-hairline-strong shadow-xl z-50 overflow-hidden">
            <div className="p-2.5 border-b border-hairline">
              <div className="relative">
                <Search
                  className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-muted pointer-events-none"
                  strokeWidth={1.5}
                />
                <input
                  type="text"
                  autoFocus
                  value={candidateSearch}
                  onChange={(e) => setCandidateSearch(e.target.value)}
                  placeholder="Search student, nationality, passport..."
                  className="field-input h-8 pl-8 text-xs"
                />
              </div>
            </div>
            <div className="max-h-60 overflow-y-auto divide-y divide-hairline">
              {filteredCands.length === 0 ? (
                <div className="p-3 text-xs text-ink-muted text-center">No matching students</div>
              ) : (
                filteredCands.map((c) => {
                  const active = candidate?.id === c.id;
                  const conflictsLen = Object.keys(c.conflicts || {}).length;
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => {
                        setCandidateMenuOpen(false);
                        setCandidateSearch('');
                        onSelectCandidate(c);
                      }}
                      className={`w-full px-3 py-2.5 text-left flex items-center justify-between gap-2.5 transition-colors ${
                        active ? 'bg-surface-raised' : 'hover:bg-surface-deep/60'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className="w-7 h-7 rounded-md bg-surface-deep border border-hairline font-mono text-[11px] text-brass flex items-center justify-center shrink-0">
                          {initialsOf(c)}
                        </span>
                        <div className="min-w-0">
                          <p className="text-xs font-medium text-ink-primary truncate">
                            {c.personal.legalGivenName} {c.personal.familyName}
                          </p>
                          <p className="text-[11px] text-ink-muted truncate">
                            {c.personal.nationality}
                            {c.passport?.passportNumber ? ` · ${c.passport.passportNumber}` : ''}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {conflictsLen > 0 && (
                          <span className="px-1.5 py-0.5 rounded bg-tone-negative/15 text-tone-negative font-mono text-[10px]">
                            {conflictsLen}
                          </span>
                        )}
                        {active && <Check className="w-3.5 h-3.5 text-brass" strokeWidth={1.5} />}
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        )}
      </div>
    );
  };

  if (!document || !candidate) {
    return (
      <div className="space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <h1 className="text-[28px] leading-[1.15] font-medium text-ink-primary tracking-[-0.015em]">
              Document review
            </h1>
            <p className="text-sm text-ink-secondary mt-1.5">
              Side-by-side source preview, extraction audit, and portal-ready downloads
            </p>
          </div>

          <div className="flex items-center gap-2">
            {renderCandidateSwitcher()}
            {onUploadDocuments && (
              <>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept=".pdf,.png,.jpg,.jpeg,.webp,.docx,.txt"
                  className="hidden"
                  onChange={async (e) => {
                    const files = Array.from(e.target.files || []);
                    if (files.length > 0) await onUploadDocuments(files, 'auto');
                    e.target.value = '';
                  }}
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="btn-primary"
                >
                  <Upload className="w-4 h-4" strokeWidth={1.5} />
                  <span>Upload document</span>
                </button>
              </>
            )}
          </div>
        </div>

        <div className="p-12 rounded-xl bg-surface-card border border-hairline text-center space-y-2">
          <FileText className="w-4 h-4 text-ink-muted mx-auto" strokeWidth={1.5} />
          <p className="text-sm font-medium text-ink-primary">No document selected</p>
          <p className="text-[13px] text-ink-secondary max-w-md mx-auto">
            Upload or choose a passport, academic transcript, or language score report to inspect and verify extracted fields
          </p>
        </div>
      </div>
    );
  }

  const fields = document.extractedFields || {};
  const entries = Object.entries(fields);
  const filteredEntries = entries.filter(([, valObj]: [string, any]) => {
    const isVerified = Boolean(valObj?.verified);
    if (fieldFilter === 'pending') return !isVerified;
    if (fieldFilter === 'confirmed') return isVerified;
    return true;
  });
  const pendingCount = entries.filter(([, v]: [string, any]) => !v?.verified).length;
  const confirmedCount = entries.length - pendingCount;
  const conflicts = document.conflicts || [];
  const portalName = document.portalFileName || document.fileName;

  const startEdit = (key: string, currentVal: any) => {
    setEditingKey(key);
    setEditValue(String(currentVal || ''));
  };

  const saveEdit = (key: string) => {
    onReconcile(key, editValue, 'Manual consultant correction', document.id);
    setEditingKey(null);
    showBanner('positive', 'Updated field value on student dossier');
  };

  const handleDownloadPortalFile = async () => {
    setDownloading(true);
    try {
      await api.downloadDocumentBlob(document.id, 'portal', portalName);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Header & Student / Action Controls */}
      <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
        <div className="space-y-2 min-w-0">
          <h1 className="text-[28px] leading-[1.15] font-medium text-ink-primary tracking-[-0.015em]">
            Document review
          </h1>
          <p className="text-sm text-ink-secondary leading-relaxed">
            Verifying{' '}
            <span className="text-ink-primary font-medium break-all">{document.fileName}</span>{' '}
            for{' '}
            <span className="text-ink-primary font-medium">
              {candidate.personal.legalGivenName} {candidate.personal.familyName}
            </span>
          </p>
          <div className="flex flex-wrap items-center gap-2 pt-0.5">
            {document.extractionMethod && (
              <span className="inline-flex items-center px-2.5 py-1 rounded-md bg-surface-card border border-hairline">
                <VerificationStamp
                  tone="positive"
                  label={formatExtractionMethod(document.extractionMethod)}
                />
              </span>
            )}
            {document.ocrApplied && (
              <span className="inline-flex items-center px-2.5 py-1 rounded-md bg-surface-card border border-hairline">
                <VerificationStamp tone="brass" label="OCR applied" />
              </span>
            )}
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-surface-card border border-hairline text-xs text-ink-muted max-w-full">
              <span className="shrink-0">Portal file:</span>
              <span className="font-mono text-ink-primary truncate">{portalName}</span>
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {renderCandidateSwitcher()}

          {onUploadDocuments && (
            <>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept=".pdf,.png,.jpg,.jpeg,.webp,.docx,.txt"
                className="hidden"
                onChange={async (e) => {
                  const files = Array.from(e.target.files || []);
                  if (files.length > 0) await onUploadDocuments(files, 'auto');
                  e.target.value = '';
                }}
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="btn-secondary"
              >
                <Upload className="w-4 h-4 text-ink-muted" strokeWidth={1.5} />
                <span>Upload</span>
              </button>
            </>
          )}

          <button
            type="button"
            onClick={handleDownloadPortalFile}
            disabled={downloading}
            className="btn-secondary"
            title={`Download standardized portal file: ${portalName}`}
          >
            <Download className="w-4 h-4 text-ink-muted" strokeWidth={1.5} />
            <span className="hidden sm:inline">Download</span>
          </button>

          {entries.length > 0 && (
            <button
              type="button"
              onClick={() => setShowApproveDiff(true)}
              className="btn-primary"
            >
              Approve all ({entries.length})
            </button>
          )}
          {onClose && (
            <button type="button" onClick={onClose} className="btn-secondary">
              Close
            </button>
          )}
        </div>
      </div>

      {/* Inline Status Banner */}
      {statusBanner && (
        <div
          className={`px-4 py-2.5 rounded-xl border text-xs flex items-center justify-between gap-2 ${
            statusBanner.tone === 'positive'
              ? 'bg-surface-card border-tone-positive/40 text-tone-positive'
              : 'bg-surface-card border-tone-negative/40 text-tone-negative'
          }`}
        >
          <span className="flex items-center gap-2">
            {statusBanner.tone === 'positive' ? (
              <CheckCircle2 className="w-4 h-4 shrink-0" strokeWidth={1.5} />
            ) : (
              <AlertTriangle className="w-4 h-4 shrink-0" strokeWidth={1.5} />
            )}
            <span>{statusBanner.text}</span>
          </span>
          <button
            type="button"
            onClick={() => setStatusBanner(null)}
            className="text-ink-muted hover:text-ink-primary"
          >
            <X className="w-3.5 h-3.5" strokeWidth={1.5} />
          </button>
        </div>
      )}

      {/* Document Queue Strip (1-Click Switching Across Student Documents) */}
      {allDocuments.length > 0 && onSelectDocument && (
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          {allDocuments.map((d) => {
            const active = d.id === document.id;
            const tone =
              d.verificationStatus === 'conflict'
                ? 'negative'
                : d.verificationStatus === 'verified'
                  ? 'positive'
                  : 'brass';
            return (
              <button
                key={d.id}
                type="button"
                onClick={() => onSelectDocument(d)}
                className={`px-3 py-2 rounded-lg border text-left shrink-0 transition-colors max-w-[240px] ${
                  active
                    ? 'bg-surface-raised border-brass-border'
                    : 'bg-surface-card border-hairline hover:border-hairline-strong'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <VerificationStamp tone={tone} label={formatCategoryLabel(d.category)} />
                  <span className="font-mono text-[10px] text-ink-muted">
                    {Object.keys(d.extractedFields || {}).length}f
                  </span>
                </div>
                <p className="text-xs text-ink-primary truncate mt-1">{d.fileName}</p>
              </button>
            );
          })}
        </div>
      )}

      {/* Interactive Category Selector Pills & Re-Run Extraction Bar */}
      {(onUpdateCategory || onReextract) && (
        <div className="p-3.5 rounded-xl bg-surface-card border border-hairline flex flex-col lg:flex-row lg:items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-ink-muted mr-1 shrink-0">Category:</span>
            {CATEGORY_OPTIONS.map((opt) => {
              const active = selectedCategory === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  disabled={updatingCategory || reextracting}
                  onClick={() => handleCategoryChange(opt.value)}
                  className={`px-2.5 py-1 rounded-md border transition-colors ${
                    active
                      ? 'bg-surface-raised border-brass text-ink-primary font-medium'
                      : 'bg-surface-deep border-hairline text-ink-secondary hover:text-ink-primary'
                  }`}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
          {onReextract && (
            <button
              type="button"
              onClick={handleReextractClick}
              disabled={reextracting || updatingCategory}
              className="btn-secondary h-8 px-3 text-xs shrink-0 self-start lg:self-auto"
            >
              <RefreshCw
                className={`w-4 h-4 text-ink-muted ${reextracting ? 'animate-spin' : ''}`}
                strokeWidth={1.5}
              />
              <span>{reextracting ? 'Re-running parser...' : 'Re-run extraction'}</span>
            </button>
          )}
        </div>
      )}

      {/* Discrepancy / Conflict Resolution Alerts */}
      {conflicts.length > 0 && (
        <div className="p-4 rounded-xl bg-surface-card border border-brass-border space-y-3">
          <div className="flex items-center gap-2 text-sm font-medium text-brass">
            <AlertTriangle className="w-4 h-4 shrink-0" strokeWidth={1.5} />
            <span>Field discrepancies detected against candidate profile ({conflicts.length})</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {conflicts.map((conf, idx) => (
              <div
                key={`${conf.fieldKey}-${idx}`}
                className="p-3.5 rounded-lg bg-surface-deep border border-hairline flex items-center justify-between gap-3 text-xs"
              >
                <div className="space-y-1 min-w-0">
                  <p className="font-medium text-ink-primary">{conf.label || conf.fieldKey}</p>
                  <p className="font-mono text-ink-muted truncate">
                    Dossier: <span className="text-ink-secondary">{conf.candidateValue}</span> · Document:{' '}
                    <span className="text-brass">{conf.documentValue}</span>
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    onReconcile(
                      conf.fieldKey,
                      conf.documentValue,
                      `Accepted value from ${document.fileName}`,
                      document.id
                    )
                  }
                  className="btn-secondary h-8 px-2.5 text-xs shrink-0"
                >
                  Use document value
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Split View: Source Preview / Text Stream (Left) + Structured Fields (Right) */}
      <div className="bg-surface-card border border-hairline rounded-xl overflow-hidden grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-hairline min-h-[540px]">
        {/* Left: Live PDF/Image Viewer + Raw Text Toggle */}
        <div className="p-6 flex flex-col justify-between bg-surface-deep/40">
          <div>
            <div className="flex items-center justify-between mb-3 gap-2">
              <div className="inline-flex rounded-lg bg-surface-deep border border-hairline p-0.5">
                <button
                  type="button"
                  onClick={() => setLeftMode('preview')}
                  className={`h-7 px-2.5 rounded-md text-xs inline-flex items-center gap-1.5 transition-colors duration-150 ease-quart ${
                    leftMode === 'preview'
                      ? 'bg-surface-raised text-ink-primary font-medium'
                      : 'text-ink-muted hover:text-ink-primary'
                  }`}
                >
                  <Eye className="w-4 h-4" strokeWidth={1.5} />
                  <span>Source preview</span>
                </button>
                <button
                  type="button"
                  onClick={() => setLeftMode('text')}
                  className={`h-7 px-2.5 rounded-md text-xs inline-flex items-center gap-1.5 transition-colors duration-150 ease-quart ${
                    leftMode === 'text'
                      ? 'bg-surface-raised text-ink-primary font-medium'
                      : 'text-ink-muted hover:text-ink-primary'
                  }`}
                >
                  <Code2 className="w-4 h-4" strokeWidth={1.5} />
                  <span>Extracted text</span>
                </button>
              </div>

              <span className="font-mono text-xs text-ink-muted tabular-nums">
                {(document.fileSize / 1024).toFixed(0)} KB · {new Date(document.uploadedAt).toISOString().slice(0, 10)}
              </span>
            </div>

            {leftMode === 'preview' ? (
              <div className="rounded-lg bg-surface-deep border border-hairline overflow-hidden h-[450px] flex items-center justify-center">
                {previewLoading ? (
                  <span className="text-xs text-ink-muted">Loading document preview...</span>
                ) : previewUrl && previewMime.includes('pdf') ? (
                  <iframe
                    src={previewUrl}
                    title={document.fileName}
                    className={`w-full h-full border-0 bg-white ${showApproveDiff ? 'invisible' : ''}`}
                  />
                ) : previewUrl && previewMime.startsWith('image/') ? (
                  <img
                    src={previewUrl}
                    alt={document.fileName}
                    className="max-h-full max-w-full object-contain"
                  />
                ) : (
                  <div className="text-center p-6 space-y-2 text-xs text-ink-muted">
                    <p>Inline preview unavailable for this file type</p>
                    <button
                      type="button"
                      onClick={() => setLeftMode('text')}
                      className="btn-secondary h-8 text-xs"
                    >
                      View extracted text
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <pre className="p-4 rounded-lg bg-surface-deep border border-hairline font-mono text-xs text-ink-secondary whitespace-pre-wrap leading-relaxed h-[450px] overflow-y-auto">
                {document.extractedText || 'No raw text stream extracted from this file'}
              </pre>
            )}
          </div>
        </div>

        {/* Right: Extracted Fields & Audit Trail */}
        <div className="p-6 flex flex-col">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
            <h3 className="text-xs font-medium text-ink-secondary">
              Extracted dossier fields ({filteredEntries.length} of {entries.length})
            </h3>
            {entries.length > 0 && (
              <div className="inline-flex rounded-lg bg-surface-deep border border-hairline p-0.5 text-[11px]">
                <button
                  type="button"
                  onClick={() => setFieldFilter('all')}
                  className={`px-2 py-0.5 rounded ${
                    fieldFilter === 'all' ? 'bg-surface-raised text-ink-primary' : 'text-ink-muted'
                  }`}
                >
                  All ({entries.length})
                </button>
                <button
                  type="button"
                  onClick={() => setFieldFilter('pending')}
                  className={`px-2 py-0.5 rounded ${
                    fieldFilter === 'pending' ? 'bg-surface-raised text-ink-primary' : 'text-ink-muted'
                  }`}
                >
                  Pending ({pendingCount})
                </button>
                <button
                  type="button"
                  onClick={() => setFieldFilter('confirmed')}
                  className={`px-2 py-0.5 rounded ${
                    fieldFilter === 'confirmed' ? 'bg-surface-raised text-ink-primary' : 'text-ink-muted'
                  }`}
                >
                  Confirmed ({confirmedCount})
                </button>
              </div>
            )}
          </div>

          <div className="flex-1">
            {filteredEntries.length === 0 ? (
              <div className="py-12 text-center text-ink-muted text-sm">
                {entries.length === 0
                  ? 'No structured fields extracted from this document'
                  : 'No fields match this filter'}
              </div>
            ) : (
              <div className="space-y-2.5 max-h-[465px] overflow-y-auto pr-1">
                {filteredEntries.map(([key, valObj]: [string, any]) => {
                  const val = valObj?.value ?? valObj;
                  const confidence = typeof valObj?.confidence === 'number' ? valObj.confidence : 0.92;
                  const isVerified = Boolean(valObj?.verified);
                  const sourceTag = valObj?.source || 'regex';
                  const targetPath = valObj?.targetPath || key;
                  const isEditing = editingKey === key;
                  const humanKey =
                    valObj?.label ||
                    key.replace(/([A-Z])/g, ' $1').replace(/^./, (s) => s.toUpperCase());

                  return (
                    <div
                      key={key}
                      className="p-3.5 rounded-lg bg-surface-deep border border-hairline space-y-2"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-xs font-medium text-ink-primary truncate">{humanKey}</span>
                          <span className="font-mono text-[11px] text-ink-muted truncate">
                            {targetPath}
                          </span>
                        </div>
                        <VerificationStamp
                          tone={isVerified || confidence >= 0.9 ? 'positive' : 'brass'}
                          label={isVerified ? 'verified' : `${(confidence * 100).toFixed(0)}%`}
                          meta={formatExtractionMethod(sourceTag)}
                        />
                      </div>

                      {isEditing ? (
                        <div className="flex items-center gap-2">
                          <input
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            className="field-input h-8 text-xs font-mono"
                          />
                          <button
                            type="button"
                            onClick={() => saveEdit(key)}
                            className="btn-primary h-8 w-8 p-0 shrink-0"
                          >
                            <Check className="w-4 h-4" strokeWidth={1.5} />
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingKey(null)}
                            className="h-8 w-8 rounded-lg bg-surface-raised border border-hairline text-ink-secondary inline-flex items-center justify-center shrink-0"
                          >
                            <X className="w-4 h-4" strokeWidth={1.5} />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between gap-3">
                          <p className="font-mono text-sm text-ink-primary truncate">{String(val)}</p>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <button
                              type="button"
                              onClick={() => startEdit(key, val)}
                              className="h-7 w-7 rounded-md text-ink-muted hover:text-ink-primary hover:bg-surface-raised inline-flex items-center justify-center transition-colors duration-150 ease-quart"
                              title="Edit value"
                            >
                              <Edit2 className="w-4 h-4" strokeWidth={1.5} />
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                onReconcile(key, val, 'Consultant verified', document.id);
                                showBanner('positive', `Confirmed ${humanKey}`);
                              }}
                              className="h-7 px-2.5 rounded-md bg-surface-raised border border-hairline hover:border-hairline-strong text-xs text-ink-primary transition-colors duration-150 ease-quart"
                            >
                              {isVerified ? 'Confirmed' : 'Confirm'}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Approve All Diff Preview Modal */}
      {showApproveDiff && (
        <div className="fixed inset-0 z-[100] bg-black/75 flex items-center justify-center p-4">
          <div className="bg-surface-card border border-hairline-strong rounded-2xl w-full max-w-xl max-h-[85vh] flex flex-col overflow-hidden">
            <div className="h-14 px-6 border-b border-hairline flex items-center justify-between shrink-0">
              <h3 className="text-base font-medium text-ink-primary">
                Confirm dossier updates ({entries.length} fields)
              </h3>
              <button
                type="button"
                onClick={() => setShowApproveDiff(false)}
                className="h-8 w-8 rounded-lg text-ink-muted hover:text-ink-primary hover:bg-surface-raised inline-flex items-center justify-center"
              >
                <X className="w-4 h-4" strokeWidth={1.5} />
              </button>
            </div>
            <div className="p-6 space-y-3 flex-1 overflow-y-auto text-xs">
              <p className="text-ink-secondary">
                Review the extracted values from{' '}
                <span className="font-medium text-ink-primary">{document.fileName}</span> before
                applying them to{' '}
                <span className="font-medium text-ink-primary">
                  {candidate.personal.legalGivenName} {candidate.personal.familyName}
                </span>
                .
              </p>
              <div className="space-y-2">
                {entries.map(([key, valObj]: [string, any]) => {
                  const nextVal = String(valObj?.value ?? valObj ?? '');
                  const targetPath = valObj?.targetPath || key;
                  const humanKey =
                    valObj?.label ||
                    key.replace(/([A-Z])/g, ' $1').replace(/^./, (s) => s.toUpperCase());
                  const conflictMatch = conflicts.find(
                    (c) => c.fieldKey === key || c.fieldKey === targetPath
                  );
                  return (
                    <div
                      key={key}
                      className="p-3 rounded-lg bg-surface-deep border border-hairline flex items-center justify-between gap-3"
                    >
                      <div className="min-w-0">
                        <p className="font-medium text-ink-primary truncate">{humanKey}</p>
                        <p className="font-mono text-[11px] text-ink-muted truncate">{targetPath}</p>
                      </div>
                      <div className="text-right font-mono shrink-0 max-w-[55%]">
                        {conflictMatch && (
                          <span className="block text-[11px] text-ink-muted line-through truncate">
                            {conflictMatch.candidateValue}
                          </span>
                        )}
                        <span className="block text-xs text-tone-positive truncate">{nextVal}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="px-6 py-4 border-t border-hairline flex justify-end gap-2.5 shrink-0">
              <button
                type="button"
                onClick={() => setShowApproveDiff(false)}
                className="btn-secondary"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  for (const [k, v] of entries) {
                    onReconcile(k, (v as any).value ?? v, 'Batch consultant approved', document.id);
                  }
                  setShowApproveDiff(false);
                  showBanner('positive', `Applied ${entries.length} fields to dossier`);
                }}
                className="btn-primary"
              >
                Apply all ({entries.length})
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
