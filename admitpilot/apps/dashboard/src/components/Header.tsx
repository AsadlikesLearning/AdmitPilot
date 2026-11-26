import React, { useEffect, useRef, useState } from 'react';
import {
  Search,
  ArrowLeftRight,
  Sun,
  Moon,
  Bell,
  AlertTriangle,
  CalendarClock,
  ChevronDown,
  UserCog,
  Building2,
  X,
} from 'lucide-react';
import { UserProfile } from 'admitpilot-shared';
import type { NavTab } from './Sidebar';

export interface WorkspaceAlert {
  id: string;
  kind: 'deadline' | 'conflict';
  title: string;
  subtitle: string;
  tone: 'negative' | 'brass';
  candidateId?: string;
}

interface HeaderProps {
  currentTab?: NavTab;
  candidateViewMode?: 'list' | 'detail';
  searchTerm: string;
  onSearchChange: (val: string) => void;
  activeCandidateName?: string;
  currentUser?: UserProfile | null;
  isAdminActive?: boolean;
  theme?: 'dark' | 'light';
  onToggleTheme?: () => void;
  alerts?: WorkspaceAlert[];
  onSelectAlert?: (alert: WorkspaceAlert) => void;
  viewScope?: 'assigned' | 'all';
  onChangeViewScope?: (scope: 'assigned' | 'all') => void;
  assignedCount?: number;
  totalCount?: number;
  onOpenAdminProfile?: () => void;
  onOpenAgencySettings?: () => void;
  onSwitchAccount?: () => void;
}

const ROLE_SHORT: Record<string, string> = {
  org_admin: 'Org admin',
  manager: 'Desk lead',
  consultant: 'Consultant',
  reviewer: 'Reviewer',
};

const TAB_META: Record<NavTab, { group: string; label: string }> = {
  dashboard: { group: 'Dossiers & portals', label: 'Overview' },
  candidates: { group: 'Dossiers & portals', label: 'Candidates' },
  documents: { group: 'Dossiers & portals', label: 'Document review' },
  applications: { group: 'Dossiers & portals', label: 'Applications' },
  testing: { group: 'Dossiers & portals', label: 'Portal sandbox' },
  team: { group: 'Workspace', label: 'Team' },
  'country-desks': { group: 'Workspace', label: 'Country desks' },
  'ai-settings': { group: 'Workspace', label: 'Model providers' },
  'agency-settings': { group: 'Workspace', label: 'Agency settings' },
  'admin-profile': { group: 'Workspace', label: 'Profile' },
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
  currentTab = 'dashboard',
  candidateViewMode = 'list',
  searchTerm,
  onSearchChange,
  activeCandidateName,
  currentUser,
  isAdminActive,
  theme = 'dark',
  onToggleTheme,
  alerts = [],
  onSelectAlert,
  viewScope,
  onChangeViewScope,
  assignedCount = 0,
  totalCount = 0,
  onOpenAdminProfile,
  onOpenAgencySettings,
  onSwitchAccount,
}) => {
  const [alertsOpen, setAlertsOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const alertsRef = useRef<HTMLDivElement>(null);
  const accountRef = useRef<HTMLDivElement>(null);

  const displayName = currentUser?.fullName || 'Sarah Jenkins';
  const displayRole = ROLE_SHORT[currentUser?.role || 'org_admin'] || 'Org admin';
  const isOrgAdmin = currentUser?.role === 'org_admin';
  const showScopeToggle =
    currentUser &&
    onChangeViewScope &&
    (currentTab === 'dashboard' || currentTab === 'candidates' || currentTab === 'applications');

  const meta = TAB_META[currentTab];

  // Focus search on '/' when not typing in an input, and close menus on outside click / Escape
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setAlertsOpen(false);
        setAccountOpen(false);
        if (document.activeElement === searchInputRef.current) {
          searchInputRef.current?.blur();
        }
        return;
      }
      if (e.key === '/' && !e.metaKey && !e.ctrlKey && !e.altKey) {
        const tag = (e.target as HTMLElement)?.tagName?.toLowerCase();
        if (tag === 'input' || tag === 'textarea' || tag === 'select') return;
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    const onMouseDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (alertsRef.current && !alertsRef.current.contains(target)) {
        setAlertsOpen(false);
      }
      if (accountRef.current && !accountRef.current.contains(target)) {
        setAccountOpen(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('mousedown', onMouseDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('mousedown', onMouseDown);
    };
  }, []);

  return (
    <header className="h-14 shrink-0 border-b border-hairline bg-surface-page px-6 lg:px-8 flex items-center justify-between gap-4">
      {/* Left: Section Breadcrumb + Search */}
      <div className="flex items-center gap-4 min-w-0 flex-1">
        <div className="hidden xl:flex items-center gap-1.5 text-xs shrink-0">
          <span className="text-ink-muted">{meta.group}</span>
          <span className="text-ink-muted">/</span>
          <span className="text-ink-primary font-medium">{meta.label}</span>
          {currentTab === 'candidates' && candidateViewMode === 'detail' && activeCandidateName && (
            <>
              <span className="text-ink-muted">/</span>
              <span className="text-ink-secondary truncate max-w-[160px]">
                {activeCandidateName}
              </span>
            </>
          )}
        </div>

        <div className="relative w-full max-w-[290px]">
          <Search
            className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted pointer-events-none"
            strokeWidth={1.5}
          />
          <input
            ref={searchInputRef}
            type="text"
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search candidates, emails, passports"
            className="h-8 w-full pl-8 pr-8 bg-surface-card border border-hairline rounded-lg text-xs text-ink-primary placeholder:text-ink-muted focus:outline-none focus:border-brass transition-colors duration-150 ease-quart"
          />
          {searchTerm ? (
            <button
              type="button"
              onClick={() => onSearchChange('')}
              aria-label="Clear search"
              className="absolute right-2 top-1/2 -translate-y-1/2 text-ink-muted hover:text-ink-primary p-0.5"
            >
              <X className="w-3.5 h-3.5" strokeWidth={1.5} />
            </button>
          ) : (
            <kbd className="hidden sm:inline-flex items-center justify-center absolute right-2 top-1/2 -translate-y-1/2 px-1.5 py-0.5 text-[10px] font-mono text-ink-muted bg-surface-deep border border-hairline rounded pointer-events-none">
              /
            </kbd>
          )}
        </div>
      </div>

      {/* Right: Scope Segmented Control, Active Dossier, Notifications, Theme & Account Menu */}
      <div className="flex items-center gap-2 shrink-0">
        {showScopeToggle && (
          <div className="hidden md:inline-flex items-center bg-surface-card border border-hairline rounded-lg p-0.5">
            {isOrgAdmin ? (
              <>
                <button
                  type="button"
                  onClick={() => onChangeViewScope('assigned')}
                  className={`h-7 px-2.5 rounded-md text-xs transition-colors duration-150 ease-quart ${
                    viewScope === 'assigned'
                      ? 'bg-surface-raised text-ink-primary font-medium'
                      : 'text-ink-secondary hover:text-ink-primary'
                  }`}
                >
                  My assigned <span className="font-mono text-[11px] text-ink-muted">({assignedCount})</span>
                </button>
                <button
                  type="button"
                  onClick={() => onChangeViewScope('all')}
                  className={`h-7 px-2.5 rounded-md text-xs transition-colors duration-150 ease-quart ${
                    viewScope === 'all'
                      ? 'bg-surface-raised text-ink-primary font-medium'
                      : 'text-ink-secondary hover:text-ink-primary'
                  }`}
                >
                  All agency <span className="font-mono text-[11px] text-ink-muted">({totalCount})</span>
                </button>
              </>
            ) : (
              <span className="h-7 px-2.5 rounded-md text-xs text-ink-secondary inline-flex items-center gap-1.5">
                <span>Assigned</span>
                <span className="font-mono text-[11px] text-brass">{assignedCount}</span>
              </span>
            )}
          </div>
        )}

        <div className="h-4 w-px bg-hairline mx-0.5 hidden sm:block" />

        {/* Alerts */}
        <div ref={alertsRef} className="relative">
          <button
            type="button"
            onClick={() => {
              setAlertsOpen((o) => !o);
              setAccountOpen(false);
            }}
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

        {/* Theme toggle */}
        {onToggleTheme && (
          <button
            type="button"
            role="switch"
            aria-checked={theme === 'light'}
            aria-label={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
            onClick={onToggleTheme}
            title={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
            className="h-8 w-8 rounded-lg bg-surface-card border border-hairline hover:border-hairline-strong text-ink-secondary hover:text-ink-primary inline-flex items-center justify-center transition-colors duration-150 ease-quart"
          >
            {theme === 'light' ? (
              <Moon className="w-4 h-4 text-brass" strokeWidth={1.5} />
            ) : (
              <Sun className="w-4 h-4 text-brass" strokeWidth={1.5} />
            )}
          </button>
        )}

        {/* Account Menu */}
        <div ref={accountRef} className="relative">
          <button
            type="button"
            onClick={() => {
              setAccountOpen((o) => !o);
              setAlertsOpen(false);
            }}
            aria-expanded={accountOpen}
            aria-label="Account menu"
            className={`h-8 pl-1.5 pr-2 rounded-lg border inline-flex items-center gap-2 transition-colors duration-150 ease-quart focus:outline-none ${
              isAdminActive || accountOpen
                ? 'bg-surface-raised border-brass-border'
                : 'bg-surface-card border-hairline hover:border-hairline-strong'
            }`}
          >
            <span className="w-5 h-5 rounded bg-surface-deep border border-hairline flex items-center justify-center font-mono text-[10px] text-brass">
              {initialsOf(displayName)}
            </span>
            <span className="hidden md:inline text-xs font-medium text-ink-primary whitespace-nowrap">
              {displayName}
            </span>
            <ChevronDown className="w-3.5 h-3.5 text-ink-muted" strokeWidth={1.5} />
          </button>

          {accountOpen && (
            <div className="absolute right-0 mt-2 w-56 rounded-xl bg-surface-card border border-hairline-strong shadow-xl z-50 overflow-hidden">
              <div className="px-3.5 py-2.5 border-b border-hairline">
                <p className="text-xs font-medium text-ink-primary truncate">{displayName}</p>
                <p className="text-[11px] text-ink-muted truncate">
                  {displayRole}
                  {currentUser?.email ? ` · ${currentUser.email}` : ''}
                </p>
              </div>
              <div className="p-1.5 space-y-0.5">
                <button
                  type="button"
                  onClick={() => {
                    setAccountOpen(false);
                    onOpenAdminProfile?.();
                  }}
                  className="w-full px-2.5 py-1.5 rounded-lg text-xs text-ink-secondary hover:text-ink-primary hover:bg-surface-raised flex items-center gap-2 transition-colors"
                >
                  <UserCog className="w-3.5 h-3.5 text-ink-muted" strokeWidth={1.5} />
                  <span>{isOrgAdmin ? 'Admin profile' : 'My profile'}</span>
                </button>
                {isOrgAdmin && onOpenAgencySettings && (
                  <button
                    type="button"
                    onClick={() => {
                      setAccountOpen(false);
                      onOpenAgencySettings();
                    }}
                    className="w-full px-2.5 py-1.5 rounded-lg text-xs text-ink-secondary hover:text-ink-primary hover:bg-surface-raised flex items-center gap-2 transition-colors"
                  >
                    <Building2 className="w-3.5 h-3.5 text-ink-muted" strokeWidth={1.5} />
                    <span>Agency settings</span>
                  </button>
                )}
                {onSwitchAccount && (
                  <>
                    <div className="my-1 border-t border-hairline" />
                    <button
                      type="button"
                      onClick={() => {
                        setAccountOpen(false);
                        onSwitchAccount();
                      }}
                      className="w-full px-2.5 py-1.5 rounded-lg text-xs text-ink-secondary hover:text-ink-primary hover:bg-surface-raised flex items-center gap-2 transition-colors"
                    >
                      <ArrowLeftRight className="w-3.5 h-3.5 text-ink-muted" strokeWidth={1.5} />
                      <span>Switch account</span>
                    </button>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
