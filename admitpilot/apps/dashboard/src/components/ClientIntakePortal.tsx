import React, { useEffect, useRef, useState } from 'react';
import {
  Upload,
  CheckCircle2,
  Clock,
  ShieldCheck,
  FileText,
  AlertCircle,
  Loader2,
  Lock,
} from 'lucide-react';
import { DocumentCategory, PublicIntakePortalInfo } from 'admitpilot-shared';
import { api } from '../api';

interface ClientIntakePortalProps {
  token: string;
}

export const ClientIntakePortal: React.FC<ClientIntakePortalProps> = ({ token }) => {
  const [portal, setPortal] = useState<PublicIntakePortalInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pinRequired, setPinRequired] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [activePin, setActivePin] = useState<string | undefined>(undefined);
  const [gateMeta, setGateMeta] = useState<{ agencyName?: string; firstName?: string }>({});
  const [uploadingCategory, setUploadingCategory] = useState<string | null>(null);
  const [uploadNotice, setUploadNotice] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [pendingCategory, setPendingCategory] = useState<DocumentCategory | 'auto'>('auto');

  const loadPortal = async (pinToUse?: string) => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getPublicIntakePortal(token, pinToUse);
      setPortal(data);
      setPinRequired(false);
      if (pinToUse) setActivePin(pinToUse);
    } catch (err: any) {
      if (err?.pinRequired) {
        setPinRequired(true);
        setGateMeta({ agencyName: err.agencyName, firstName: err.candidateFirstName });
        if (pinToUse) {
          setError(err.message || 'Incorrect 4-digit PIN.');
        }
      } else {
        setPinRequired(false);
        setError(err.message || 'This upload link is invalid or has been revoked.');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPortal();
  }, [token]);

  const handlePinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = pinInput.trim();
    if (!/^\d{4}$/.test(cleaned)) {
      setError('Please enter the 4-digit access PIN.');
      return;
    }
    loadPortal(cleaned);
  };

  const handleTriggerUpload = (category: DocumentCategory | 'auto') => {
    setPendingCategory(category);
    setUploadNotice(null);
    fileInputRef.current?.click();
  };

  const handleFilesSelected = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const list = Array.from(files);
    setUploadingCategory(pendingCategory);
    setError(null);
    setUploadNotice(null);
    try {
      const res = await api.uploadPublicIntakeDocument(token, list, pendingCategory, activePin);
      setPortal(res.portal);
      setUploadNotice(
        `${res.uploadedCount} ${res.uploadedCount === 1 ? 'file' : 'files'} uploaded and sent to your consultant for verification.`
      );
    } catch (err: any) {
      setError(err.message || 'Upload failed. Please try again.');
    } finally {
      setUploadingCategory(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const completionPct = portal
    ? Math.round((portal.requiredCompleted / Math.max(portal.requiredTotal, 1)) * 100)
    : 0;

  return (
    <div className="min-h-screen bg-surface-page text-ink-primary px-4 py-8 sm:py-12">
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept=".pdf,.png,.jpg,.jpeg,.webp"
        className="hidden"
        onChange={(e) => handleFilesSelected(e.target.files)}
      />

      <div className="max-w-3xl mx-auto space-y-6">
        {/* Top Brand + Security Strip */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <svg
              viewBox="0 0 20 20"
              fill="none"
              className="w-5 h-5 text-brass shrink-0"
              stroke="currentColor"
              strokeWidth="1.6"
            >
              <path d="M4 3.5h9.5L16.5 6.5V16.5H4V3.5Z" />
              <path d="M13 3.5V7h3.5" />
              <path d="M7 11h6M7 13.5h4" />
            </svg>
            <span className="text-base font-medium text-ink-primary">
              {portal?.agencyName || gateMeta.agencyName || 'AdmitPilot'}
            </span>
          </div>
          <span className="inline-flex items-center gap-1.5 text-xs text-ink-secondary">
            <ShieldCheck className="w-4 h-4 text-tone-positive" strokeWidth={1.5} />
            <span>Encrypted student upload portal</span>
          </span>
        </div>

        {loading ? (
          <div className="p-12 rounded-2xl bg-surface-card border border-hairline flex items-center justify-center gap-3 text-sm text-ink-secondary">
            <Loader2 className="w-4 h-4 animate-spin text-brass" strokeWidth={1.5} />
            <span>Loading your document checklist...</span>
          </div>
        ) : pinRequired && !portal ? (
          <form
            onSubmit={handlePinSubmit}
            className="max-w-md mx-auto p-6 rounded-2xl bg-surface-card border border-hairline space-y-4"
          >
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-lg bg-brass-soft border border-brass-border flex items-center justify-center">
                <Lock className="w-4 h-4 text-brass" strokeWidth={1.5} />
              </div>
              <div>
                <h1 className="text-base font-medium text-ink-primary">Enter 4-digit access PIN</h1>
                <p className="text-xs text-ink-secondary">
                  {gateMeta.firstName
                    ? `Hi ${gateMeta.firstName}, enter the PIN shared by your consultant.`
                    : 'Enter the PIN shared by your admissions consultant.'}
                </p>
              </div>
            </div>

            {error && (
              <div className="px-3 py-2 rounded-lg bg-tone-negative/10 border border-tone-negative/30 text-xs text-tone-negative">
                {error}
              </div>
            )}

            <input
              type="text"
              inputMode="numeric"
              maxLength={4}
              value={pinInput}
              onChange={(e) => setPinInput(e.target.value.replace(/\D/g, '').slice(0, 4))}
              placeholder="4-digit PIN"
              autoFocus
              className="field-input font-mono text-center tracking-[0.35em] text-base"
            />

            <button type="submit" className="btn-primary w-full">
              Unlock document checklist
            </button>
          </form>
        ) : error && !portal ? (
          <div className="p-8 rounded-2xl bg-surface-card border border-hairline text-center space-y-3">
            <AlertCircle className="w-8 h-8 text-tone-negative mx-auto" strokeWidth={1.5} />
            <h1 className="text-lg font-medium text-ink-primary">Upload link unavailable</h1>
            <p className="text-sm text-ink-secondary max-w-md mx-auto">{error}</p>
            <p className="text-xs text-ink-muted">
              Please contact your admissions consultant for a fresh upload link.
            </p>
          </div>
        ) : portal ? (
          <>
            {/* Welcome & Progress Header */}
            <div className="p-6 rounded-2xl bg-surface-card border border-hairline space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs text-brass font-medium">Student document intake</span>
                    {portal.expiresAt && (
                      <span className="text-[11px] text-ink-muted">
                        · Expires {new Date(portal.expiresAt).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                  <h1 className="text-2xl font-medium text-ink-primary mt-1">
                    {portal.candidateFullName}
                  </h1>
                  <p className="text-sm text-ink-secondary mt-1">
                    Upload clear scans or PDFs below (max 12 MB per file). Files are verified automatically and routed to{' '}
                    <span className="text-ink-primary font-medium">{portal.agencyName}</span>.
                  </p>
                  {(portal.targetCountries.length > 0 || portal.targetIntake) && (
                    <div className="flex flex-wrap items-center gap-2 mt-3 text-xs text-ink-secondary">
                      {portal.targetIntake && (
                        <span className="px-2 py-0.5 rounded-md bg-brass-soft border border-brass-border text-brass font-medium">
                          {portal.targetIntake}
                        </span>
                      )}
                      {portal.targetCountries.map((country) => (
                        <span
                          key={country}
                          className="px-2 py-0.5 rounded-md bg-surface-deep border border-hairline"
                        >
                          {country}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <button
                  type="button"
                  disabled={uploadingCategory !== null}
                  onClick={() => handleTriggerUpload('auto')}
                  className="btn-primary shrink-0"
                >
                  {uploadingCategory === 'auto' ? (
                    <Loader2 className="w-4 h-4 animate-spin" strokeWidth={1.5} />
                  ) : (
                    <Upload className="w-4 h-4" strokeWidth={1.5} />
                  )}
                  <span>
                    {uploadingCategory === 'auto' ? 'Uploading...' : 'Quick upload any file'}
                  </span>
                </button>
              </div>

              {/* Required Progress Bar */}
              <div className="pt-3 border-t border-hairline space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-ink-secondary">
                    Required documents:{' '}
                    <span className="font-medium text-ink-primary tabular-nums">
                      {portal.requiredCompleted} of {portal.requiredTotal}
                    </span>{' '}
                    uploaded
                  </span>
                  <span className="tabular-nums text-ink-muted">
                    {portal.totalUploaded} total {portal.totalUploaded === 1 ? 'file' : 'files'}
                  </span>
                </div>
                <div className="h-1.5 w-full rounded-full bg-surface-deep overflow-hidden">
                  <div
                    className="h-full rounded-full bg-tone-positive transition-[width] duration-300"
                    style={{ width: `${completionPct}%` }}
                  />
                </div>
              </div>
            </div>

            {uploadNotice && (
              <div className="px-4 py-3 rounded-xl bg-surface-card border border-tone-positive/40 flex items-center gap-2.5 text-xs text-ink-primary">
                <CheckCircle2 className="w-4 h-4 text-tone-positive shrink-0" strokeWidth={1.5} />
                <span>{uploadNotice}</span>
              </div>
            )}

            {error && (
              <div className="px-4 py-3 rounded-xl bg-surface-card border border-tone-negative/40 flex items-center gap-2.5 text-xs text-tone-negative">
                <AlertCircle className="w-4 h-4 shrink-0" strokeWidth={1.5} />
                <span>{error}</span>
              </div>
            )}

            {/* Document Checklist */}
            <div className="rounded-2xl bg-surface-card border border-hairline overflow-hidden">
              <div className="px-6 py-4 border-b border-hairline flex items-center justify-between">
                <h2 className="text-sm font-medium text-ink-primary">Document checklist</h2>
                <span className="text-xs text-ink-muted">PDF, PNG, JPG, or WEBP (max 12 MB)</span>
              </div>

              <div className="divide-y divide-hairline">
                {portal.checklist.map((item) => {
                  const isDone = item.uploadedCount > 0;
                  const isBusy = uploadingCategory === item.category;
                  return (
                    <div
                      key={item.category}
                      className="px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                    >
                      <div className="flex items-start gap-3 min-w-0">
                        {isDone ? (
                          <CheckCircle2
                            className="w-5 h-5 text-tone-positive shrink-0 mt-0.5"
                            strokeWidth={1.5}
                          />
                        ) : (
                          <Clock
                            className={`w-5 h-5 shrink-0 mt-0.5 ${
                              item.required ? 'text-brass' : 'text-ink-muted'
                            }`}
                            strokeWidth={1.5}
                          />
                        )}
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-sm font-medium text-ink-primary">
                              {item.label}
                            </span>
                            <span
                              className={`px-1.5 py-0.5 rounded text-[11px] font-medium ${
                                item.required
                                  ? 'bg-brass-soft text-brass'
                                  : 'bg-surface-deep text-ink-muted border border-hairline'
                              }`}
                            >
                              {item.required ? 'Required' : 'Optional'}
                            </span>
                          </div>
                          <p className="text-xs text-ink-secondary mt-0.5">{item.description}</p>
                          {item.latestFileName && (
                            <p className="text-xs text-tone-positive mt-1.5 inline-flex items-center gap-1.5">
                              <FileText className="w-3.5 h-3.5 shrink-0" strokeWidth={1.5} />
                              <span className="truncate max-w-[320px]">{item.latestFileName}</span>
                              {item.uploadedCount > 1 && (
                                <span className="text-ink-muted">
                                  (+{item.uploadedCount - 1} more)
                                </span>
                              )}
                            </p>
                          )}
                        </div>
                      </div>

                      <button
                        type="button"
                        disabled={uploadingCategory !== null}
                        onClick={() => handleTriggerUpload(item.category)}
                        className={`${isDone ? 'btn-secondary' : 'btn-primary'} shrink-0`}
                      >
                        {isBusy ? (
                          <Loader2 className="w-4 h-4 animate-spin" strokeWidth={1.5} />
                        ) : (
                          <Upload className="w-4 h-4" strokeWidth={1.5} />
                        )}
                        <span>
                          {isBusy ? 'Uploading...' : isDone ? 'Upload another' : 'Upload file'}
                        </span>
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
};
