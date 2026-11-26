import React, { useState, useEffect } from 'react';
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
} from 'lucide-react';
import { CandidateDocument, CandidateProfile, DocumentCategory } from 'admitpilot-shared';
import { VerificationStamp, formatExtractionMethod, formatCategoryLabel } from './ui/Primitives';
import { api } from '../api';

interface DocumentReviewProps {
  document: CandidateDocument | null;
  allDocuments?: CandidateDocument[];
  candidate: CandidateProfile | null;
  onSelectDocument?: (doc: CandidateDocument) => void;
  onReconcile: (fieldKey: string, approvedValue: any, note?: string, documentId?: string) => void;
  onReextract?: (docId: string, category?: DocumentCategory | 'auto') => Promise<void>;
  onClose?: () => void;
}

const CATEGORY_OPTIONS: { value: DocumentCategory; label: string }[] = [
  { value: 'passport', label: 'Passport / travel document' },
  { value: 'transcript', label: 'Academic transcript' },
  { value: 'degree', label: 'Degree certificate' },
  { value: 'english_test', label: 'English test report' },
  { value: 'cv', label: 'CV / resume' },
  { value: 'sop', label: 'Statement of purpose' },
  { value: 'lor', label: 'Letter of recommendation' },
  { value: 'financial', label: 'Financial statement' },
  { value: 'experience', label: 'Employment letter' },
  { value: 'other', label: 'Other supporting document' },
];

export const DocumentReview: React.FC<DocumentReviewProps> = ({
  document,
  allDocuments = [],
  candidate,
  onSelectDocument,
  onReconcile,
  onReextract,
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
  const [downloading, setDownloading] = useState(false);
  const [showApproveDiff, setShowApproveDiff] = useState(false);

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

  if (!document || !candidate) {
    return (
      <div className="space-y-5">
        <div>
          <h1 className="text-[28px] leading-[1.15] font-medium text-ink-primary tracking-[-0.015em]">
            Document review
          </h1>
          <p className="text-sm text-ink-secondary mt-1.5">
            Side-by-side source preview, extraction audit, and portal-ready downloads
          </p>
        </div>

        <div className="p-12 rounded-xl bg-surface-card border border-hairline text-center space-y-2">
          <FileText className="w-4 h-4 text-ink-muted mx-auto" strokeWidth={1.5} />
          <p className="text-sm font-medium text-ink-primary">No document selected</p>
          <p className="text-[13px] text-ink-secondary max-w-md mx-auto">
            Upload or choose a passport, academic transcript, or language score report under a candidate dossier to inspect and verify extracted fields
          </p>
        </div>
      </div>
    );
  }

  const fields = document.extractedFields || {};
  const entries = Object.entries(fields);
  const conflicts = document.conflicts || [];
  const portalName = document.portalFileName || document.fileName;

  const startEdit = (key: string, currentVal: any) => {
    setEditingKey(key);
    setEditValue(String(currentVal || ''));
  };

  const saveEdit = (key: string) => {
    onReconcile(key, editValue, 'Manual consultant correction', document.id);
    setEditingKey(null);
  };

  const handleDownloadPortalFile = async () => {
    setDownloading(true);
    try {
      await api.downloadDocumentBlob(document.id, 'portal', portalName);
    } finally {
      setDownloading(false);
    }
  };

  const handleReextractClick = async () => {
    if (!onReextract) return;
    setReextracting(true);
    try {
      await onReextract(document.id, selectedCategory);
    } finally {
      setReextracting(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Header & Document Switcher */}
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
          {allDocuments.length > 1 && onSelectDocument && (
            <select
              value={document.id}
              onChange={(e) => {
                const target = allDocuments.find((d) => d.id === e.target.value);
                if (target) onSelectDocument(target);
              }}
              className="field-input h-9 w-auto max-w-[300px] text-xs"
            >
              {allDocuments.map((d) => (
                <option key={d.id} value={d.id}>
                  {formatCategoryLabel(d.category)} · {d.fileName}
                </option>
              ))}
            </select>
          )}

          <button
            type="button"
            onClick={handleDownloadPortalFile}
            disabled={downloading}
            className="btn-secondary"
            title={`Download standardized portal file: ${portalName}`}
          >
            <Download className="w-4 h-4 text-ink-muted" strokeWidth={1.5} />
            <span className="font-mono text-xs">{portalName}</span>
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

      {/* Category Re-Classification & Re-Extraction Bar */}
      {onReextract && (
        <div className="p-3.5 rounded-xl bg-surface-card border border-hairline flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-ink-muted">Document category:</span>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value as DocumentCategory)}
              className="field-input h-8 w-auto text-xs"
            >
              {CATEGORY_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <span className="text-ink-muted">
              Portal upload filename: <span className="font-mono text-ink-primary">{portalName}</span>
            </span>
          </div>
          <button
            type="button"
            onClick={handleReextractClick}
            disabled={reextracting}
            className="btn-secondary h-8 px-3 text-xs self-start sm:self-auto"
          >
            <RefreshCw className={`w-4 h-4 text-ink-muted ${reextracting ? 'animate-spin' : ''}`} strokeWidth={1.5} />
            <span>{reextracting ? 'Re-running parser...' : 'Re-run extraction'}</span>
          </button>
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
                  <span>Document preview</span>
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
                    className="max-w-full max-h-full object-contain"
                  />
                ) : (
                  <div className="p-6 font-mono text-xs text-ink-secondary leading-relaxed whitespace-pre-wrap w-full h-full overflow-y-auto">
                    {document.extractedText || 'Preview unavailable for this file format'}
                  </div>
                )}
              </div>
            ) : (
              <div className="p-4 rounded-lg bg-surface-deep border border-hairline font-mono text-xs text-ink-secondary leading-relaxed whitespace-pre-wrap h-[450px] overflow-y-auto">
                {document.extractedText || 'No raw text stream extracted from this file'}
              </div>
            )}
          </div>

          <p className="mt-4 text-xs text-ink-muted">
            Confirmed values record source document provenance and consultant timestamp without altering unverified fields
          </p>
        </div>

        {/* Right: Extracted Structured Fields */}
        <div className="p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium text-ink-primary">Extracted dossier fields</span>
              <span className="font-mono text-xs text-ink-muted tabular-nums">{entries.length} detected</span>
            </div>

            {entries.length === 0 ? (
              <div className="py-12 text-center text-ink-muted text-sm">
                No structured fields extracted from this document
              </div>
            ) : (
              <div className="space-y-2.5 max-h-[465px] overflow-y-auto pr-1">
                {entries.map(([key, valObj]: [string, any]) => {
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
                              onClick={() =>
                                onReconcile(key, val, 'Consultant verified', document.id)
                              }
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
                Review the extracted values from <span className="font-medium text-ink-primary">{document.fileName}</span> before applying them to{' '}
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
            <div className="px-6 py-4 border-t border-hairline flex justify-end gap-2.5">
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
