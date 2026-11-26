import React from 'react';
import {
  Users,
  FileText,
  GraduationCap,
  SlidersHorizontal,
  LayoutDashboard,
  FlaskConical,
  Globe,
  UserCog,
  Building2,
} from 'lucide-react';

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
  organizationName?: string;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  onSelectTab,
  candidateCount,
  applicationCount,
  teamCount,
  countryTeamsCount,
  organizationName,
}) => {
  const primaryItems: Array<{ id: NavTab; label: string; icon: React.ComponentType<any>; count?: number }> = [
    { id: 'dashboard', label: 'Overview', icon: LayoutDashboard },
    { id: 'candidates', label: 'Candidates', icon: Users, count: candidateCount },
    { id: 'documents', label: 'Document review', icon: FileText },
    { id: 'applications', label: 'Applications', icon: GraduationCap, count: applicationCount },
    { id: 'testing', label: 'Portal sandbox', icon: FlaskConical },
  ];

  const workspaceItems: Array<{ id: NavTab; label: string; icon: React.ComponentType<any>; count?: number }> = [
    { id: 'team', label: 'Team', icon: Users, count: teamCount },
    { id: 'country-desks', label: 'Country desks', icon: Globe, count: countryTeamsCount },
    { id: 'ai-settings', label: 'Model providers', icon: SlidersHorizontal },
    { id: 'agency-settings', label: 'Agency settings', icon: Building2 },
    { id: 'admin-profile', label: 'Admin profile', icon: UserCog },
  ];

  const renderRow = (item: { id: NavTab; label: string; icon: React.ComponentType<any>; count?: number }) => {
    const Icon = item.icon;
    const active = currentTab === item.id;
    return (
      <button
        key={item.id}
        type="button"
        onClick={() => onSelectTab(item.id)}
        className={`relative w-full h-9 px-3 rounded-lg text-sm flex items-center justify-between focus:outline-none focus-visible:ring-1 focus-visible:ring-brass/60 transition-colors duration-150 ease-quart ${
          active
            ? 'bg-surface-raised text-ink-primary font-medium shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]'
            : 'text-ink-secondary hover:text-ink-primary hover:bg-surface-card'
        }`}
      >
        {active && (
          <span className="absolute left-0 top-2 bottom-2 w-0.5 rounded-r bg-brass" aria-hidden="true" />
        )}
        <span className="flex items-center gap-2.5 min-w-0">
          <Icon
            className={`w-4 h-4 shrink-0 ${active ? 'text-ink-primary' : 'text-ink-muted'}`}
            strokeWidth={1.5}
          />
          <span className="truncate">{item.label}</span>
        </span>
        {item.count !== undefined && (
          <span className="font-mono text-xs tabular-nums text-ink-muted pl-2">{item.count}</span>
        )}
      </button>
    );
  };

  return (
    <aside className="w-[248px] shrink-0 bg-surface-deep border-r border-hairline flex flex-col h-screen select-none">
      {/* Brand Row */}
      <div className="h-14 px-4 border-b border-hairline flex items-center justify-between">
        <div className="flex items-center gap-2.5">
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
          <span className="text-base font-medium text-ink-primary tracking-[-0.01em]">AdmitPilot</span>
        </div>
        <span className="font-mono text-xs text-ink-muted">v2.8</span>
      </div>

      {/* Navigation Groups */}
      <nav className="flex-1 px-3 py-4 overflow-y-auto">
        <div className="px-3 mb-2 text-xs text-ink-muted">Dossiers & portals</div>
        <div className="space-y-0.5">{primaryItems.map(renderRow)}</div>

        <div className="px-3 mt-6 mb-2 text-xs text-ink-muted">Workspace</div>
        <div className="space-y-0.5">{workspaceItems.map(renderRow)}</div>
      </nav>

      {/* Quiet Footer Meta */}
      <div className="px-4 py-3 border-t border-hairline flex items-center justify-between gap-2 text-xs text-ink-muted">
        <span className="truncate">{organizationName || 'Global EduConsultants'}</span>
        <span className="font-mono tabular-nums shrink-0">MV3</span>
      </div>
    </aside>
  );
};
