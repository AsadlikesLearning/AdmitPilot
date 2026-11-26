import React, { useState } from 'react';
import { X, KeyRound, AlertCircle, Building2 } from 'lucide-react';
import { UserProfile, UserRole } from 'admitpilot-shared';

interface LoginModalProps {
  isOpen: boolean;
  members: UserProfile[];
  currentUserId?: string;
  onClose: () => void;
  onLogin: (email: string, password: string) => Promise<void>;
  onRegisterAgency?: (payload: {
    agencyName: string;
    fullName: string;
    email: string;
    password: string;
    headquarters?: string;
    operatingCountries?: string[];
  }) => Promise<void>;
}

const ROLE_LABELS: Record<UserRole, string> = {
  org_admin: 'Agency owner',
  manager: 'Desk lead',
  consultant: 'Consultant',
  reviewer: 'Reviewer',
};

const COUNTRY_CHOICES = [
  'United Kingdom',
  'Canada',
  'United States',
  'Australia',
  'Germany',
  'Ireland',
  'New Zealand',
  'Netherlands',
];

export const LoginModal: React.FC<LoginModalProps> = ({
  isOpen,
  members,
  currentUserId,
  onClose,
  onLogin,
  onRegisterAgency,
}) => {
  const [mode, setMode] = useState<'signin' | 'register'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // Agency Sign-Up state
  const [agencyName, setAgencyName] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [headquarters, setHeadquarters] = useState('');
  const [regCountries, setRegCountries] = useState<string[]>(['United Kingdom', 'Canada']);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmitSignIn = async (e: React.FormEvent) => {
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

  const handleSubmitRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!onRegisterAgency) return;
    setError(null);
    setSubmitting(true);
    try {
      await onRegisterAgency({
        agencyName: agencyName.trim(),
        fullName: ownerName.trim(),
        email: email.trim(),
        password,
        headquarters: headquarters.trim() || undefined,
        operatingCountries: regCountries,
      });
      setPassword('');
      setAgencyName('');
      setOwnerName('');
      setHeadquarters('');
      setMode('signin');
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Agency registration failed');
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
            {mode === 'register' ? (
              <Building2 className="w-4 h-4 text-brass" strokeWidth={1.5} />
            ) : (
              <KeyRound className="w-4 h-4 text-brass" strokeWidth={1.5} />
            )}
            <h3 className="text-base font-medium text-ink-primary">
              {mode === 'register' ? 'Create new agency workspace' : 'Sign in or switch account'}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="h-8 w-8 rounded-lg text-ink-muted hover:text-ink-primary hover:bg-surface-raised inline-flex items-center justify-center"
          >
            <X className="w-4 h-4" strokeWidth={1.5} />
          </button>
        </div>

        {onRegisterAgency && (
          <div className="px-6 pt-4 flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => {
                setMode('signin');
                setError(null);
              }}
              className={`h-8 px-3 rounded-lg text-xs flex-1 transition-colors ${
                mode === 'signin'
                  ? 'bg-surface-raised border border-brass-border text-ink-primary font-medium'
                  : 'bg-surface-deep border border-hairline text-ink-secondary hover:text-ink-primary'
              }`}
            >
              Sign in
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('register');
                setError(null);
              }}
              className={`h-8 px-3 rounded-lg text-xs flex-1 transition-colors ${
                mode === 'register'
                  ? 'bg-surface-raised border border-brass-border text-ink-primary font-medium'
                  : 'bg-surface-deep border border-hairline text-ink-secondary hover:text-ink-primary'
              }`}
            >
              Create new agency
            </button>
          </div>
        )}

        {mode === 'signin' ? (
          <form onSubmit={handleSubmitSignIn} className="p-6 space-y-4 text-sm">
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
                <div className="space-y-1.5 max-h-44 overflow-y-auto pr-1">
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
        ) : (
          <form onSubmit={handleSubmitRegister} className="p-6 space-y-3.5 text-sm max-h-[75vh] overflow-y-auto">
            {error && (
              <div className="p-3 rounded-lg bg-surface-deep border border-tone-negative/40 text-xs text-tone-negative flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" strokeWidth={1.5} />
                <span>{error}</span>
              </div>
            )}

            <div>
              <label className="block text-xs text-ink-secondary mb-1.5">Consultancy / agency name *</label>
              <input
                required
                value={agencyName}
                onChange={(e) => setAgencyName(e.target.value)}
                placeholder="Apex Overseas Education"
                className="field-input"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-ink-secondary mb-1.5">Owner full name *</label>
                <input
                  required
                  value={ownerName}
                  onChange={(e) => setOwnerName(e.target.value)}
                  placeholder="Ayesha Khan"
                  className="field-input"
                />
              </div>
              <div>
                <label className="block text-xs text-ink-secondary mb-1.5">Headquarters</label>
                <input
                  value={headquarters}
                  onChange={(e) => setHeadquarters(e.target.value)}
                  placeholder="Lahore / London"
                  className="field-input"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs text-ink-secondary mb-1.5">Admin work email *</label>
              <input
                required
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="owner@apexoverseas.com"
                className="field-input"
              />
            </div>

            <div>
              <label className="block text-xs text-ink-secondary mb-1.5">Password (min 6 chars) *</label>
              <input
                required
                minLength={6}
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Create a strong password"
                className="field-input"
              />
            </div>

            <div>
              <label className="block text-xs text-ink-secondary mb-1.5">Destination countries</label>
              <div className="flex flex-wrap gap-1.5">
                {COUNTRY_CHOICES.map((country) => {
                  const active = regCountries.includes(country);
                  return (
                    <button
                      key={country}
                      type="button"
                      onClick={() =>
                        setRegCountries((prev) =>
                          active ? prev.filter((c) => c !== country) : [...prev, country]
                        )
                      }
                      className={`px-2 py-1 rounded border text-xs transition-colors ${
                        active
                          ? 'bg-surface-raised border-brass text-ink-primary'
                          : 'bg-surface-deep border-hairline text-ink-muted hover:text-ink-primary'
                      }`}
                    >
                      {country}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-hairline">
              <button type="button" onClick={onClose} className="btn-secondary">
                Cancel
              </button>
              <button type="submit" disabled={submitting} className="btn-primary">
                {submitting ? 'Creating workspace...' : 'Create agency'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
