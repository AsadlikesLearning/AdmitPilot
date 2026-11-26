import React from 'react';
import {
  Users,
  UsersRound,
  FileText,
  GraduationCap,
  SlidersHorizontal,
  LayoutDashboard,
  FlaskConical,
  Globe,
  UserCog,
  Building2,
  PanelLeftClose,
  PanelLeftOpen,
} from 'lucide-react';

import { UserRole } from 'admitpilot-shared';

export type NavTab =
  | 'dashboard'
  | 'candidates'
  | 'documents'
  | 'applications'
  | 'testing'
  | 'team'
  | 'country-desks'
  | 'ai-settings'
  | 'agency-settings'
  | 'admin-profile';

interface SidebarProps {
  currentTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  candidateCount: number;
  applicationCount: number;
  teamCount?: number;
  countryTeamsCount?: number;
  conflictCount?: number;
  organizationName?: string;
  userRole?: UserRole;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
  storageStatus?: {
    engine?: 'supabase_postgres' | 'local_json';
    connected?: boolean;
    host?: string;
  };
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  onSelectTab,
  candidateCount,
  applicationCount,
  teamCount,
  countryTeamsCount,
  conflictCount = 0,
  organizationName,
  userRole = 'org_admin',
  collapsed = false,
  onToggleCollapse,
  storageStatus,
}) => {
  const isOrgAdmin = userRole === 'org_admin';
  const isSupabase =
    storageStatus?.engine === 'supabase_postgres' && storageStatus?.connected;

  const primaryItems: Array<{
    id: NavTab;
    label: string;
    icon: React.ComponentType<any>;
    count?: number;
    alertDot?: boolean;
  }> = [
    { id: 'dashboard', label: 'Overview', icon: LayoutDashboard },
    { id: 'candidates', label: 'Candidates', icon: Users, count: candidateCount },
    {
      id: 'documents',
      label: 'Document review',
      icon: FileText,
      count: conflictCount > 0 ? conflictCount : undefined,
      alertDot: conflictCount > 0,
    },
    { id: 'applications', label: 'Applications', icon: GraduationCap, count: applicationCount },
    { id: 'testing', label: 'Portal sandbox', icon: FlaskConical },
  ];

  const workspaceItems: Array<{
    id: NavTab;
    label: string;
    icon: React.ComponentType<any>;
    count?: number;
  }> = isOrgAdmin
    ? [
        { id: 'team', label: 'Team', icon: UsersRound, count: teamCount },
        { id: 'country-desks', label: 'Country desks', icon: Globe, count: countryTeamsCount },
        { id: 'ai-settings', label: 'Model providers', icon: SlidersHorizontal },
        { id: 'agency-settings', label: 'Agency settings', icon: Building2 },
        { id: 'admin-profile', label: 'Admin profile', icon: UserCog },
      ]
    : [{ id: 'admin-profile', label: 'My profile', icon: UserCog }];

  const renderRow = (item: {
    id: NavTab;
    label: string;
    icon: React.ComponentType<any>;
    count?: number;
    alertDot?: boolean;
  }) => {
    const Icon = item.icon;
    const active = currentTab === item.id;
    return (
      <button
        key={item.id}
        type="button"
        title={collapsed ? item.label : undefined}
        aria-label={item.label}
        onClick={() => onSelectTab(item.id)}
        className={`relative w-full h-9 rounded-lg text-sm flex items-center focus:outline-none focus-visible:ring-1 focus-visible:ring-brass/60 transition-colors duration-150 ease-quart ${
          collapsed ? 'justify-center px-0' : 'justify-between px-3'
        } ${
          active
            ? 'bg-surface-raised text-ink-primary font-medium shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]'
            : 'text-ink-secondary hover:text-ink-primary hover:bg-surface-card'
        }`}
      >
        {active && (
          <span className="absolute left-0 top-2 bottom-2 w-0.5 rounded-r bg-brass" aria-hidden="true" />
        )}
        <span className={`flex items-center min-w-0 ${collapsed ? 'justify-center' : 'gap-2.5'}`}>
          <Icon
            className={`w-4 h-4 shrink-0 ${active ? 'text-ink-primary' : 'text-ink-muted'}`}
            strokeWidth={1.5}
          />
          {!collapsed && <span className="truncate">{item.label}</span>}
        </span>
        {!collapsed && item.count !== undefined && (
          <span
            className={`font-mono text-xs tabular-nums pl-2 ${
              item.alertDot ? 'text-brass font-medium' : 'text-ink-muted'
            }`}
          >
            {item.count}
          </span>
        )}
        {collapsed && item.alertDot && (
          <span className="absolute top-1.5 right-2 w-1.5 h-1.5 rounded-full bg-brass" />
        )}
      </button>
    );
  };

  return (
    <aside
      className={`${
        collapsed ? 'w-[68px]' : 'w-[248px]'
      } shrink-0 bg-surface-deep border-r border-hairline flex flex-col h-screen select-none transition-[width] duration-200 ease-quart`}
    >
      {/* Brand Row */}
      <div
        className={`h-14 border-b border-hairline flex items-center ${
          collapsed ? 'justify-center px-2' : 'justify-between px-4'
        }`}
      >
        {!collapsed ? (
          <>
            <div className="flex items-center gap-2.5 min-w-0">
              <svg
                viewBox="0 0 20 20"
                fill="none"
                className="w-4 h-4 text-brass shrink-0"
                stroke="currentColor"
                strokeWidth="1.6"
              >
                <path d="M4 3.5h9.5L16.5 6.5V16.5H4V3.5Z" />
                <path d="M13 3.5V7h3.5" />
                <path d="M7 11h6M7 13.5h4" />
              </svg>
              <span className="text-base font-medium text-ink-primary tracking-[-0.01em] truncate">
                AdmitPilot
              </span>
              <span className="font-mono text-[11px] text-ink-muted">v2.8</span>
            </div>
            {onToggleCollapse && (
              <button
                type="button"
                onClick={onToggleCollapse}
                title="Collapse sidebar"
                aria-label="Collapse sidebar"
                className="w-7 h-7 rounded-md text-ink-muted hover:text-ink-primary hover:bg-surface-card inline-flex items-center justify-center transition-colors duration-150 ease-quart"
              >
                <PanelLeftClose className="w-4 h-4" strokeWidth={1.5} />
              </button>
            )}
          </>
        ) : (
          <button
            type="button"
            onClick={onToggleCollapse}
            title="Expand sidebar"
            aria-label="Expand sidebar"
            className="w-9 h-9 rounded-lg text-ink-muted hover:text-ink-primary hover:bg-surface-card inline-flex items-center justify-center transition-colors duration-150 ease-quart"
          >
            <PanelLeftOpen className="w-4 h-4" strokeWidth={1.5} />
          </button>
        )}
      </div>

      {/* Navigation Groups */}
      <nav className="flex-1 px-3 py-4 overflow-y-auto">
        {!collapsed && (
          <div className="px-3 mb-2 text-xs text-ink-muted">Dossiers & portals</div>
        )}
        <div className="space-y-0.5">{primaryItems.map(renderRow)}</div>

        {collapsed ? (
          <div className="my-3 mx-2 border-t border-hairline" />
        ) : (
          <div className="px-3 mt-6 mb-2 text-xs text-ink-muted">Workspace</div>
        )}
        <div className="space-y-0.5">{workspaceItems.map(renderRow)}</div>
      </nav>

      {/* Quiet Footer Meta + Storage Status */}
      <div
        className={`border-t border-hairline py-3 text-xs text-ink-muted ${
          collapsed ? 'px-2 flex justify-center' : 'px-4 space-y-1.5'
        }`}
      >
        {!collapsed ? (
          <>
            <div className="flex items-center justify-between gap-2">
              <span className="truncate text-ink-secondary font-medium">
                {organizationName || 'Global EduConsultants'}
              </span>
              <span className="font-mono text-[11px] tabular-nums shrink-0">MV3</span>
            </div>
            {storageStatus && (
              <div
                title={
                  isSupabase
                    ? `Connected to live Supabase PostgreSQL (${storageStatus.host || 'cloud'})`
                    : 'Local JSON fallback storage'
                }
                className="flex items-center gap-1.5 text-[11px] text-ink-muted"
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                    isSupabase ? 'bg-tone-positive' : 'bg-brass'
                  }`}
                />
                <span className="font-mono truncate">
                  {isSupabase ? 'Supabase PG' : 'Local store'}
                </span>
              </div>
            )}
          </>
        ) : (
          <span
            title={`${organizationName || 'Global EduConsultants'} · ${
              isSupabase ? 'Supabase PG' : 'Local store'
            }`}
            className={`w-2 h-2 rounded-full ${isSupabase ? 'bg-tone-positive' : 'bg-brass'}`}
          />
        )}
      </div>
    </aside>
  );
};
