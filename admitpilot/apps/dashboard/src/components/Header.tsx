import React, { useState } from 'react';
import {
  Search,
  FolderOpen,
  Database,
  ArrowLeftRight,
  Sun,
  Moon,
  Bell,
  AlertTriangle,
  CalendarClock,
} from 'lucide-react';
import { UserProfile } from 'admitpilot-shared';

export interface WorkspaceAlert {
  id: string;
  kind: 'deadline' | 'conflict';
  title: string;
  subtitle: string;
  tone: 'negative' | 'brass';
  candidateId?: string;
}

interface HeaderProps {
  searchTerm: string;
  onSearchChange: (val: string) => void;
  activeCandidateName?: string;
  currentUser?: UserProfile | null;
  isAdminActive?: boolean;
  theme?: 'dark' | 'light';
  onToggleTheme?: () => void;
  alerts?: WorkspaceAlert[];
  onSelectAlert?: (alert: WorkspaceAlert) => void;
  storageStatus?: {
    engine?: 'supabase_postgres' | 'local_json';
    connected?: boolean;
    host?: string;
  };
  onOpenActiveCandidate?: () => void;
  onOpenAdminProfile?: () => void;
  onSwitchAccount?: () => void;
}

const ROLE_SHORT: Record<string, string> = {
  org_admin: 'Org admin',
  manager: 'Desk lead',
  consultant: 'Consultant',
  reviewer: 'Reviewer',
};

function initialsOf(name?: string): string {
  if (!name) return 'SJ';
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase() || '')
      .join('') || 'SJ'
  );
}

export const Header: React.FC<HeaderProps> = ({
  searchTerm,
  onSearchChange,
  activeCandidateName,
  currentUser,
  isAdminActive,
  theme = 'dark',
  onToggleTheme,
  alerts = [],
  onSelectAlert,
  storageStatus,
  onOpenActiveCandidate,
  onOpenAdminProfile,
  onSwitchAccount,
}) => {
  const [alertsOpen, setAlertsOpen] = useState(false);
  const displayName = currentUser?.fullName || 'Sarah Jenkins';
  const displayRole = ROLE_SHORT[currentUser?.role || 'org_admin'] || 'Org admin';
  const isSupabase =
    storageStatus?.engine === 'supabase_postgres' && storageStatus?.connected;

  return (
    <header className="h-14 shrink-0 border-b border-hairline bg-surface-page px-6 lg:px-8 flex items-center justify-between gap-4">
      {/* Search */}
      <div className="relative w-full max-w-[320px]">
        <Search
          className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted pointer-events-none"
          strokeWidth={1.5}
        />
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search candidates, emails, or passports"
          className="h-9 w-full pl-9 pr-3 bg-surface-card border border-hairline rounded-lg text-sm text-ink-primary placeholder:text-ink-muted focus:outline-none focus:border-brass transition-colors duration-150 ease-quart"
        />
      </div>

      {/* Right Context, Supabase DB Status & Admin Profile Button */}
      <div className="flex items-center gap-2.5 min-w-0 shrink-0">
        {storageStatus && (
          <div
            title={
              isSupabase
                ? `Connected to live Supabase PostgreSQL (${storageStatus.host || 'cloud'})`
                : 'Local JSON fallback storage'
            }
            className="hidden lg:inline-flex items-center gap-1.5 h-8 px-2.5 rounded-lg bg-surface-card border border-hairline font-mono text-xs text-ink-secondary"
          >
            <Database
              className={`w-3.5 h-3.5 ${isSupabase ? 'text-tone-positive' : 'text-brass'}`}
              strokeWidth={1.5}
            />
            <span>{isSupabase ? 'Supabase PG' : 'Local store'}</span>
          </div>
        )}

        {activeCandidateName && (
          <button
            type="button"
            onClick={onOpenActiveCandidate}
            className="hidden sm:inline-flex items-center gap-2 h-8 px-3 rounded-lg bg-surface-card border border-hairline hover:border-hairline-strong text-xs text-ink-secondary transition-colors duration-150 ease-quart max-w-[260px]"
          >
            <FolderOpen className="w-4 h-4 text-ink-muted shrink-0" strokeWidth={1.5} />
            <span className="text-ink-muted shrink-0">Active dossier</span>
            <span className="text-ink-primary font-medium truncate">{activeCandidateName}</span>
          </button>
        )}

        <div className="pl-2.5 border-l border-hairline flex items-center gap-1.5 relative">
          <div className="relative">
            <button
              type="button"
              onClick={() => setAlertsOpen((o) => !o)}
              title="Notifications: deadlines & document conflicts"
              aria-label="Workspace notifications"
              className="relative h-8 w-8 rounded-lg bg-surface-card border border-hairline hover:border-hairline-strong text-ink-secondary hover:text-ink-primary inline-flex items-center justify-center transition-colors duration-150 ease-quart"
            >
              <Bell className="w-4 h-4" strokeWidth={1.5} />
              {alerts.length > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full bg-brass text-[#141415] font-mono text-[10px] font-semibold flex items-center justify-center">
                  {alerts.length > 9 ? '9+' : alerts.length}
                </span>
              )}
            </button>

            {alertsOpen && (
              <div className="absolute right-0 mt-2 w-80 rounded-xl bg-surface-card border border-hairline-strong shadow-xl z-50 overflow-hidden">
                <div className="px-4 py-2.5 border-b border-hairline flex items-center justify-between">
                  <span className="text-xs font-medium text-ink-primary">
                    Workspace alerts ({alerts.length})
                  </span>
                  <button
                    type="button"
                    onClick={() => setAlertsOpen(false)}
                    className="text-[11px] text-ink-muted hover:text-ink-primary"
                  >
                    Close
                  </button>
                </div>
                {alerts.length === 0 ? (
                  <div className="p-4 text-xs text-ink-muted text-center">
                    No upcoming 14-day deadlines or field conflicts
                  </div>
                ) : (
                  <div className="max-h-72 overflow-y-auto divide-y divide-hairline">
                    {alerts.map((alert) => (
                      <button
                        key={alert.id}
                        type="button"
                        onClick={() => {
                          setAlertsOpen(false);
                          onSelectAlert?.(alert);
                        }}
                        className="w-full px-4 py-2.5 text-left hover:bg-surface-deep/60 flex items-start gap-2.5 transition-colors"
                      >
                        {alert.kind === 'conflict' ? (
                          <AlertTriangle
                            className="w-4 h-4 text-tone-negative shrink-0 mt-0.5"
                            strokeWidth={1.5}
                          />
                        ) : (
                          <CalendarClock
                            className={`w-4 h-4 shrink-0 mt-0.5 ${
                              alert.tone === 'negative' ? 'text-tone-negative' : 'text-brass'
                            }`}
                            strokeWidth={1.5}
                          />
                        )}
                        <div className="min-w-0">
                          <p className="text-xs font-medium text-ink-primary truncate">
                            {alert.title}
                          </p>
                          <p className="text-[11px] text-ink-secondary truncate">{alert.subtitle}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {onToggleTheme && (
            <button
              type="button"
              role="switch"
              aria-checked={theme === 'light'}
              aria-label="Toggle light mode"
              onClick={onToggleTheme}
              title={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
              className="h-8 px-2.5 rounded-lg bg-surface-card border border-hairline hover:border-hairline-strong text-xs text-ink-secondary hover:text-ink-primary inline-flex items-center gap-1.5 transition-colors duration-150 ease-quart"
            >
              {theme === 'light' ? (
                <Moon className="w-3.5 h-3.5 text-brass" strokeWidth={1.5} />
              ) : (
                <Sun className="w-3.5 h-3.5 text-brass" strokeWidth={1.5} />
              )}
              <span className="hidden sm:inline">
                {theme === 'light' ? 'Dark mode' : 'Light mode'}
              </span>
            </button>
          )}
          {onSwitchAccount && (
            <button
              type="button"
              onClick={onSwitchAccount}
              title="Sign in or switch team account"
              className="h-8 px-2.5 rounded-lg bg-surface-card border border-hairline hover:border-hairline-strong text-xs text-ink-secondary hover:text-ink-primary inline-flex items-center gap-1.5 transition-colors duration-150 ease-quart"
            >
              <ArrowLeftRight className="w-3.5 h-3.5 text-ink-muted" strokeWidth={1.5} />
              <span className="hidden xl:inline">Switch account</span>
            </button>
          )}
          <button
            type="button"
            onClick={onOpenAdminProfile}
            title={
              currentUser?.role === 'org_admin'
                ? 'Open admin profile & workspace settings'
                : 'Open my profile'
            }
            className={`h-9 px-2.5 rounded-lg border inline-flex items-center gap-2.5 transition-colors duration-150 ease-quart focus:outline-none ${
              isAdminActive
                ? 'bg-surface-raised border-brass-border'
                : 'bg-transparent border-transparent hover:bg-surface-card hover:border-hairline'
            }`}
          >
            <span className="w-7 h-7 rounded-md bg-surface-raised border border-hairline flex items-center justify-center font-mono text-xs text-brass">
              {initialsOf(displayName)}
            </span>
            <span className="hidden md:flex items-center gap-1.5 text-xs whitespace-nowrap">
              <span className="font-medium text-ink-primary">{displayName}</span>
              <span className="text-ink-muted">· {displayRole}</span>
            </span>
          </button>
        </div>
      </div>
    </header>
  );
};
