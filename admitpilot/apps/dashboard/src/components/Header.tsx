import React from 'react';
import { Search, FolderOpen, Database, ArrowLeftRight } from 'lucide-react';
import { UserProfile } from 'admitpilot-shared';

interface HeaderProps {
  searchTerm: string;
  onSearchChange: (val: string) => void;
  activeCandidateName?: string;
  currentUser?: UserProfile | null;
  isAdminActive?: boolean;
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
  storageStatus,
  onOpenActiveCandidate,
  onOpenAdminProfile,
  onSwitchAccount,
}) => {
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

        <div className="pl-2.5 border-l border-hairline flex items-center gap-1.5">
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
            title="Open admin profile & workspace settings"
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
