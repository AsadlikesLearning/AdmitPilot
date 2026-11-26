import React, { useState } from 'react';
import { X, KeyRound, AlertCircle } from 'lucide-react';
import { UserProfile, UserRole } from 'admitpilot-shared';

interface LoginModalProps {
  isOpen: boolean;
  members: UserProfile[];
  currentUserId?: string;
  onClose: () => void;
  onLogin: (email: string, password: string) => Promise<void>;
}

const ROLE_LABELS: Record<UserRole, string> = {
  org_admin: 'Agency owner',
  manager: 'Desk lead',
  consultant: 'Consultant',
  reviewer: 'Reviewer',
};

export const LoginModal: React.FC<LoginModalProps> = ({
  isOpen,
  members,
  currentUserId,
  onClose,
  onLogin,
}) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await onLogin(email.trim(), password);
      setPassword('');
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Sign in failed');
    } finally {
      setSubmitting(false);
    }
  };

  const handleQuickSwitch = async (member: UserProfile) => {
    setError(null);
    setEmail(member.email);
    setPassword('AdmitPilot!2027');
    setSubmitting(true);
    try {
      await onLogin(member.email, 'AdmitPilot!2027');
      setPassword('');
      onClose();
    } catch (err: any) {
      setError(
        err?.message ||
          'Custom password is set for this teammate. Enter their password above to sign in.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4">
      <div className="bg-surface-card border border-hairline-strong rounded-2xl w-full max-w-md overflow-hidden">
        <div className="h-14 px-6 border-b border-hairline flex items-center justify-between">
          <div className="flex items-center gap-2">
            <KeyRound className="w-4 h-4 text-brass" strokeWidth={1.5} />
            <h3 className="text-base font-medium text-ink-primary">Sign in or switch account</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="h-8 w-8 rounded-lg text-ink-muted hover:text-ink-primary hover:bg-surface-raised inline-flex items-center justify-center"
          >
            <X className="w-4 h-4" strokeWidth={1.5} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-sm">
          {error && (
            <div className="p-3 rounded-lg bg-surface-deep border border-tone-negative/40 text-xs text-tone-negative flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" strokeWidth={1.5} />
              <span>{error}</span>
            </div>
          )}

          <div>
            <label className="block text-xs text-ink-secondary mb-1.5">Work email</label>
            <input
              required
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="amina.t@globaledu.com"
              className="field-input"
            />
          </div>

          <div>
            <label className="block text-xs text-ink-secondary mb-1.5">Password</label>
            <input
              required
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter account password"
              className="field-input"
            />
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={onClose} className="btn-secondary">
              Cancel
            </button>
            <button type="submit" disabled={submitting} className="btn-primary">
              {submitting ? 'Signing in...' : 'Sign in'}
            </button>
          </div>

          {members.length > 0 && (
            <div className="pt-4 border-t border-hairline space-y-2">
              <p className="text-xs text-ink-muted">
                Quick switch (uses default workspace password unless customized)
              </p>
              <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                {members.map((m) => {
                  const isCurrent = m.id === currentUserId;
                  return (
                    <button
                      key={m.id}
                      type="button"
                      disabled={submitting}
                      onClick={() => handleQuickSwitch(m)}
                      className={`w-full px-3 py-2 rounded-lg border text-left flex items-center justify-between gap-2 transition-colors ${
                        isCurrent
                          ? 'bg-surface-raised border-brass-border'
                          : 'bg-surface-deep border-hairline hover:border-hairline-strong'
                      }`}
                    >
                      <div className="min-w-0">
                        <p className="text-xs font-medium text-ink-primary truncate">
                          {m.fullName}
                          {isCurrent && <span className="text-brass ml-1.5">(Current)</span>}
                        </p>
                        <p className="text-[11px] text-ink-muted truncate">{m.email}</p>
                      </div>
                      <span className="text-[11px] font-mono text-ink-secondary shrink-0">
                        {ROLE_LABELS[m.role] || m.role}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </form>
      </div>
    </div>
  );
};
