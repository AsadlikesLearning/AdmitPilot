import React, { useState } from 'react';
import { X, Upload, FileText, AlertCircle, Trash2 } from 'lucide-react';
import { DocumentCategory } from 'admitpilot-shared';

interface DocumentUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUpload: (files: File[], category: DocumentCategory | 'auto') => Promise<void>;
}

const CATEGORIES: { value: DocumentCategory | 'auto'; label: string; desc: string }[] = [
  {
    value: 'auto',
    label: 'Auto-detect category (MRZ, content & filename)',
    desc: 'Classifies each file automatically and runs ICAO MRZ, regex, OCR, or Gemini Vision extraction',
  },
  { value: 'passport', label: 'Passport / travel document', desc: 'Bio-page with ICAO MRZ lines, full name, and birth date' },
  { value: 'transcript', label: 'Academic transcript', desc: 'Coursework marks, grading scale, and cumulative GPA' },
  { value: 'degree', label: 'Degree certificate', desc: 'Conferred qualification title and award date' },
  { value: 'english_test', label: 'English test report (IELTS / PTE / TOEFL)', desc: 'Overall band and listening, reading, writing, speaking subscores' },
  { value: 'cv', label: 'CV / resume', desc: 'Employment history, contact details, and institutions' },
  { value: 'sop', label: 'Statement of purpose', desc: 'Applicant motivation statement' },
  { value: 'lor', label: 'Letter of recommendation', desc: 'Academic or employer reference letter' },
  { value: 'financial', label: 'Financial statement', desc: 'Bank balance or sponsorship affidavit' },
  { value: 'experience', label: 'Employment letter', desc: 'Role verification or experience certificate' },
  { value: 'other', label: 'Other supporting document', desc: 'Additional admissions attachment' },
];

export const DocumentUploadModal: React.FC<DocumentUploadModalProps> = ({
  isOpen,
  onClose,
  onUpload,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<DocumentCategory | 'auto'>('auto');
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);

  if (!isOpen) return null;

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const addValidatedFiles = (fileList: FileList | File[]) => {
    setErrorMsg(null);
    const validExtensions = ['.pdf', '.docx', '.png', '.jpg', '.jpeg', '.txt'];
    const accepted: File[] = [];

    for (const file of Array.from(fileList)) {
      const hasValidExt = validExtensions.some((ext) => file.name.toLowerCase().endsWith(ext));
      if (!hasValidExt) {
        setErrorMsg(`Unsupported format (${file.name}). Allowed: PDF, DOCX, PNG, JPG, JPEG, TXT`);
        continue;
      }
      if (file.size > 25 * 1024 * 1024) {
        setErrorMsg(`${file.name} exceeds the 25 MB maximum size`);
        continue;
      }
      accepted.push(file);
    }

    if (accepted.length > 0) {
      setSelectedFiles((prev) => {
        const existingNames = new Set(prev.map((f) => `${f.name}-${f.size}`));
        return [...prev, ...accepted.filter((f) => !existingNames.has(`${f.name}-${f.size}`))];
      });
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files?.length) {
      addValidatedFiles(e.dataTransfer.files);
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.length) {
      addValidatedFiles(e.target.files);
      e.target.value = '';
    }
  };

  const removeFileAt = (index: number) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedFiles.length === 0) {
      setErrorMsg('Select at least one document file to upload');
      return;
    }
    try {
      setIsUploading(true);
      setErrorMsg(null);
      await onUpload(selectedFiles, selectedCategory);
      setSelectedFiles([]);
      setIsUploading(false);
      onClose();
    } catch (err: any) {
      setIsUploading(false);
      setErrorMsg(err.message || 'Upload and extraction failed');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75">
      <div className="bg-surface-card border border-hairline-strong rounded-2xl w-full max-w-xl overflow-hidden flex flex-col">
        <div className="h-14 px-6 border-b border-hairline flex items-center justify-between">
          <div>
            <h3 className="text-base font-medium text-ink-primary">Upload candidate documents</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isUploading}
            className="h-8 w-8 rounded-lg text-ink-muted hover:text-ink-primary hover:bg-surface-raised inline-flex items-center justify-center transition-colors duration-150 ease-quart"
          >
            <X className="w-4 h-4" strokeWidth={1.5} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5 text-sm">
          {errorMsg && (
            <div className="p-3 rounded-lg bg-surface-deep border border-tone-negative/40 text-tone-negative text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" strokeWidth={1.5} />
              <span>{errorMsg}</span>
            </div>
          )}

          <div>
            <label className="block text-xs text-ink-secondary mb-1.5">Classification mode</label>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value as DocumentCategory | 'auto')}
              className="field-input"
            >
              {CATEGORIES.map((cat) => (
                <option key={cat.value} value={cat.value}>
                  {cat.label}
                </option>
              ))}
            </select>
            <p className="text-xs text-ink-muted mt-1.5">
              {CATEGORIES.find((c) => c.value === selectedCategory)?.desc}
            </p>
          </div>

          <div>
            <label className="block text-xs text-ink-secondary mb-1.5">
              Source files (single or batch upload)
            </label>
            <div
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
              onClick={() => document.getElementById('modal-doc-file-input')?.click()}
              className={`border border-dashed rounded-xl p-6 text-center transition-colors duration-150 ease-quart cursor-pointer ${
                dragActive
                  ? 'border-brass bg-brass-soft'
                  : 'border-hairline hover:border-hairline-strong bg-surface-deep/60'
              }`}
            >
              <input
                id="modal-doc-file-input"
                type="file"
                multiple
                className="hidden"
                accept=".pdf,.docx,.png,.jpg,.jpeg,.txt"
                onChange={handleFileInput}
              />
              <Upload className="w-4 h-4 text-ink-muted mx-auto mb-2" strokeWidth={1.5} />
              <p className="text-sm font-medium text-ink-primary">
                Drop passport, transcript, IELTS, CV, or SOP files here
              </p>
              <p className="text-xs text-ink-muted mt-1">
                PDF, DOCX, PNG, JPG, TXT up to 25 MB each · Stored in Supabase cloud vault
              </p>
            </div>
          </div>

          {selectedFiles.length > 0 && (
            <div className="space-y-2 max-h-44 overflow-y-auto pr-1">
              <div className="flex items-center justify-between text-xs text-ink-muted">
                <span>Queued for extraction ({selectedFiles.length})</span>
                <button
                  type="button"
                  onClick={() => setSelectedFiles([])}
                  className="text-ink-muted hover:text-ink-primary"
                >
                  Clear queue
                </button>
              </div>
              {selectedFiles.map((file, idx) => (
                <div
                  key={`${file.name}-${idx}`}
                  className="px-3 py-2 rounded-lg bg-surface-deep border border-hairline flex items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <FileText className="w-4 h-4 text-brass shrink-0" strokeWidth={1.5} />
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-ink-primary truncate">{file.name}</p>
                      <p className="font-mono text-[11px] text-ink-muted tabular-nums">
                        {(file.size / 1024).toFixed(1)} KB
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeFileAt(idx)}
                    disabled={isUploading}
                    className="h-7 w-7 rounded-md text-ink-muted hover:text-tone-negative hover:bg-surface-raised inline-flex items-center justify-center"
                  >
                    <Trash2 className="w-4 h-4" strokeWidth={1.5} />
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-hairline">
            <button type="button" onClick={onClose} disabled={isUploading} className="btn-secondary">
              Cancel
            </button>
            <button
              type="submit"
              disabled={isUploading || selectedFiles.length === 0}
              className="btn-primary"
            >
              {isUploading
                ? `Extracting ${selectedFiles.length} file${selectedFiles.length > 1 ? 's' : ''}...`
                : `Upload & extract (${selectedFiles.length})`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
