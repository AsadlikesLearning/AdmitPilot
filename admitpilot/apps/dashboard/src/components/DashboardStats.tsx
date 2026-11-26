import React from 'react';
import { Plus, ArrowUpRight } from 'lucide-react';
import { CandidateProfile, ApplicationRecord } from 'admitpilot-shared';
import { PassportCredentialCard, VerificationStamp } from './ui/Primitives';

interface StatsProps {
  candidates: CandidateProfile[];
  applications: ApplicationRecord[];
  selectedCandidate: CandidateProfile | null;
  isOrgAdmin?: boolean;
  onSelectTab: (tab: any) => void;
  onSelectCandidate: (c: CandidateProfile) => void;
  onNewCandidate: () => void;
}

export const DashboardStats: React.FC<StatsProps> = ({
  candidates,
  applications,
  selectedCandidate,
  isOrgAdmin = false,
  onSelectTab,
  onSelectCandidate,
  onNewCandidate,
}) => {
  const totalCandidates = candidates.length;
  const activeCandidates = candidates.filter((c) => c.status === 'active').length;
  const readyCandidates = candidates.filter(
    (c) => Boolean(c.passport?.passportNumber) && c.englishTests.length > 0 && c.education.length > 0
  ).length;
  const readinessPct = totalCandidates > 0 ? Math.round((readyCandidates / totalCandidates) * 100) : 0;

  const draftCount = applications.filter(
    (a) => a.status === 'draft' || a.status === 'preparing_documents' || a.status === 'ready_for_review'
  ).length;
  const inPortalCount = applications.filter((a) => a.status === 'in_progress').length;
  const submittedCount = applications.filter(
    (a) => a.status === 'submitted' || a.status === 'under_review'
  ).length;
  const offersCount = applications.filter(
    (a) =>
      a.status === 'conditional_offer' ||
      a.status === 'unconditional_offer' ||
      a.status === 'enrolled'
  ).length;
  const scheduledDeadlines = applications.filter((a) => Boolean(a.deadline)).length;
  const depositsPaidCount = applications.filter((a) => Boolean(a.depositPaid)).length;
  const activeCommissionsCount = applications.filter(
    (a) => a.commissionStatus && a.commissionStatus !== 'none'
  ).length;

  const stages = [
    { key: 'ready', label: 'Dossiers verified for portal fill', count: readyCandidates, total: Math.max(totalCandidates, 1), accent: true },
    { key: 'draft', label: 'Applications in preparation', count: draftCount, total: Math.max(applications.length, totalCandidates, 1), accent: false },
    { key: 'portal', label: 'Active in university portals', count: inPortalCount, total: Math.max(applications.length, totalCandidates, 1), accent: false },
    { key: 'submitted', label: 'Submitted & under faculty review', count: submittedCount, total: Math.max(applications.length, totalCandidates, 1), accent: false },
    { key: 'offers', label: 'Conditional & unconditional offers', count: offersCount, total: Math.max(applications.length, totalCandidates, 1), accent: false },
  ];

  const stats = [
    {
      label: 'Active dossiers',
      value: String(activeCandidates),
      sub: `${totalCandidates} total in workspace`,
      highlight: false,
    },
    {
      label: 'Verification readiness',
      value: `${readinessPct}%`,
      sub: `${readyCandidates} of ${totalCandidates} with passport & test`,
      highlight: true,
    },
    {
      label: 'University applications',
      value: String(applications.length),
      sub: `${submittedCount} submitted · ${inPortalCount} in portal`,
      highlight: false,
    },
    {
      label: 'Offers received',
      value: String(offersCount),
      sub: isOrgAdmin
        ? `${depositsPaidCount} deposits paid · ${activeCommissionsCount} commissions`
        : `${scheduledDeadlines} deadlines · ${depositsPaidCount} deposits paid`,
      highlight: false,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Page Title & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-[28px] leading-[1.15] font-medium text-ink-primary tracking-[-0.015em]">
            Intake overview
          </h1>
          <p className="text-sm text-ink-secondary mt-1.5">
            Verified student dossiers, document provenance, and university portal submissions
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <button type="button" onClick={onNewCandidate} className="btn-secondary">
            <Plus className="w-4 h-4 text-ink-secondary" strokeWidth={1.5} />
            <span>New candidate</span>
          </button>
          <button type="button" onClick={() => onSelectTab('testing')} className="btn-primary">
            <span>Open portal sandbox</span>
            <ArrowUpRight className="w-4 h-4 text-[#141415]" strokeWidth={1.5} />
          </button>
        </div>
      </div>

      {/* 4 Compact Stat Cards — numbers only, uniform height */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((s) => (
          <div
            key={s.label}
            className="p-5 rounded-xl bg-surface-card border border-hairline flex flex-col justify-between min-h-[112px]"
          >
            <span className="text-xs text-ink-muted">{s.label}</span>
            <div className="mt-3">
              <p
                className={`text-[28px] leading-none font-medium tabular-nums ${
                  s.highlight ? 'text-brass' : 'text-ink-primary'
                }`}
              >
                {s.value}
              </p>
              <p className="text-xs text-ink-secondary mt-2 tabular-nums">{s.sub}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Asymmetric Split: 8-col Main Readiness & Ledger + 4-col Credential Card */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Main 2/3 Column: Intake Pipeline Chart + Candidate Readiness Table */}
        <div className="lg:col-span-8 rounded-xl bg-surface-card border border-hairline overflow-hidden">
          <div className="p-6 border-b border-hairline">
            <div className="flex items-baseline justify-between gap-4">
              <div>
                <h2 className="text-base font-medium text-ink-primary">
                  Intake pipeline & dossier readiness
                </h2>
                <p className="text-[13px] text-ink-secondary mt-0.5">
                  Completion across verification and university submission stages
                </p>
              </div>
              <button
                type="button"
                onClick={() => onSelectTab('applications')}
                className="text-xs text-ink-secondary hover:text-ink-primary transition-colors duration-150 ease-quart shrink-0"
              >
                All applications ({applications.length}) →
              </button>
            </div>

            {/* Horizontal Stage Comparison Bars on Muted Grid */}
            <div className="mt-5 space-y-3">
              {stages.map((st) => {
                const pct = Math.min(100, Math.round((st.count / st.total) * 100));
                return (
                  <div key={st.key} className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className={st.accent ? 'text-ink-primary font-medium' : 'text-ink-secondary'}>
                        {st.label}
                      </span>
                      <span className="font-mono tabular-nums text-ink-muted">
                        <span className={st.accent ? 'text-brass font-medium' : 'text-ink-primary'}>
                          {st.count}
                        </span>{' '}
                        / {st.total}
                      </span>
                    </div>
                    <div className="h-2 w-full rounded bg-surface-deep border border-hairline overflow-hidden">
                      <div
                        className={`h-full rounded ${
                          st.accent ? 'bg-brass' : 'bg-[#3a3a3f]'
                        }`}
                        style={{ width: `${Math.max(pct, st.count > 0 ? 6 : 0)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Candidate Readiness Ledger Table */}
          <div>
            <div className="px-6 py-3.5 flex items-center justify-between border-b border-hairline">
              <span className="text-[13px] font-medium text-ink-primary">Candidates in intake</span>
              <button
                type="button"
                onClick={() => onSelectTab('candidates')}
                className="text-xs text-ink-secondary hover:text-ink-primary transition-colors duration-150 ease-quart"
              >
                Manage dossiers ({candidates.length}) →
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-hairline text-xs text-ink-muted">
                    <th className="py-2.5 px-6 font-normal">Candidate</th>
                    <th className="py-2.5 px-4 font-normal">Passport</th>
                    <th className="py-2.5 px-4 font-normal text-right">GPA</th>
                    <th className="py-2.5 px-4 font-normal text-right">English</th>
                    <th className="py-2.5 px-6 font-normal text-right">Readiness</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[rgba(237,237,237,0.06)] text-[13px]">
                  {candidates.slice(0, 6).map((c) => {
                    const isSelected = selectedCandidate?.id === c.id;
                    const edu = c.education[0];
                    const eng = c.englishTests[0];
                    const ready = Boolean(c.passport?.passportNumber) && Boolean(eng);
                    return (
                      <tr
                        key={c.id}
                        onClick={() => {
                          onSelectCandidate(c);
                          onSelectTab('candidates');
                        }}
                        className={`cursor-pointer transition-colors duration-150 ease-quart ${
                          isSelected ? 'bg-surface-raised/70' : 'hover:bg-surface-raised/40'
                        }`}
                      >
                        <td className="py-3 px-6">
                          <div className="font-medium text-ink-primary">
                            {c.personal.legalGivenName} {c.personal.familyName}
                          </div>
                          <div className="text-xs text-ink-muted">{c.personal.nationality}</div>
                        </td>
                        <td className="py-3 px-4 font-mono text-xs tabular-nums text-ink-secondary">
                          {c.passport?.passportNumber || 'Missing'}
                        </td>
                        <td className="py-3 px-4 font-mono text-xs tabular-nums text-ink-secondary text-right">
                          {edu?.gpa || '—'}
                        </td>
                        <td className="py-3 px-4 font-mono text-xs tabular-nums text-ink-secondary text-right">
                          {eng ? `${eng.testType} ${eng.overallScore}` : '—'}
                        </td>
                        <td className="py-3 px-6 text-right">
                          <VerificationStamp
                            tone={ready ? 'positive' : 'brass'}
                            label={ready ? 'ready' : 'incomplete'}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Right 1/3 Column: Tactile Passport & Academic Credential Object + Deadlines */}
        <div className="lg:col-span-4 space-y-5">
          {selectedCandidate && (
            <PassportCredentialCard
              candidate={selectedCandidate}
              onInspectDossier={() => onSelectTab('candidates')}
            />
          )}

          <div className="p-5 rounded-xl bg-surface-card border border-hairline space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium text-ink-primary">Portal queue</h3>
              <span className="font-mono text-xs tabular-nums text-ink-muted">
                {applications.length} tracked
              </span>
            </div>

            {applications.length === 0 ? (
              <div className="pt-1 space-y-3">
                <p className="text-[13px] text-ink-secondary leading-5">
                  No university applications logged yet. Create an application record or test autofill in the portal sandbox.
                </p>
                <button
                  type="button"
                  onClick={() => onSelectTab('applications')}
                  className="btn-secondary w-full"
                >
                  Track university application
                </button>
              </div>
            ) : (
              <div className="divide-y divide-[rgba(237,237,237,0.06)]">
                {applications.slice(0, 4).map((a) => (
                  <div key={a.id} className="py-2.5 first:pt-0 last:pb-0 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[13px] font-medium text-ink-primary truncate">{a.institutionName}</p>
                      <p className="text-xs text-ink-muted truncate">{a.programName}</p>
                    </div>
                    <VerificationStamp
                      tone={
                        a.status === 'submitted' ||
                        a.status === 'conditional_offer' ||
                        a.status === 'unconditional_offer'
                          ? 'positive'
                          : 'brass'
                      }
                      label={a.status.replace(/_/g, ' ')}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
