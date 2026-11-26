import React, { useMemo, useState } from 'react';
import {
  Plus,
  ArrowUpRight,
  CalendarClock,
  AlertCircle,
  CheckCircle2,
  FileWarning,
  Globe,
  Calendar,
  X,
} from 'lucide-react';
import { CandidateProfile, ApplicationRecord } from 'admitpilot-shared';
import { VerificationStamp } from './ui/Primitives';

interface StatsProps {
  candidates: CandidateProfile[];
  applications: ApplicationRecord[];
  viewScope?: 'assigned' | 'all';
  isOrgAdmin?: boolean;
  onSelectTab: (tab: any) => void;
  onSelectCandidate: (c: CandidateProfile) => void;
  onNewCandidate: () => void;
}

function initialsOf(given?: string, family?: string): string {
  const a = (given || '').trim()[0] || '';
  const b = (family || '').trim()[0] || '';
  return (a + b).toUpperCase() || 'ST';
}

function getCandidateCountries(c: CandidateProfile): string[] {
  return c.targetCountries?.length
    ? c.targetCountries
    : c.additional?.preferredCountries || [];
}

function getCandidateIntakes(c: CandidateProfile): string[] {
  return c.additional?.preferredIntakes || [];
}

export const DashboardStats: React.FC<StatsProps> = ({
  candidates,
  applications,
  viewScope = 'all',
  isOrgAdmin = false,
  onSelectTab,
  onSelectCandidate,
  onNewCandidate,
}) => {
  const [selectedIntake, setSelectedIntake] = useState<string>('all');
  const [selectedCountry, setSelectedCountry] = useState<string>('all');

  const candidateById = useMemo(
    () => new Map(candidates.map((c) => [c.id, c])),
    [candidates]
  );

  // Collect all unique intakes & countries across candidates and applications
  const { allIntakes, allCountries } = useMemo(() => {
    const intakeSet = new Set<string>();
    const countrySet = new Set<string>();

    for (const c of candidates) {
      for (const i of getCandidateIntakes(c)) {
        if (i.trim()) intakeSet.add(i.trim());
      }
      for (const co of getCandidateCountries(c)) {
        if (co.trim()) countrySet.add(co.trim());
      }
    }
    for (const a of applications) {
      if (a.intake?.trim()) intakeSet.add(a.intake.trim());
      if (a.country?.trim()) countrySet.add(a.country.trim());
    }

    return {
      allIntakes: Array.from(intakeSet).sort(),
      allCountries: Array.from(countrySet).sort(),
    };
  }, [candidates, applications]);

  // Filter candidates & applications by selected intake + country
  const filteredCandidates = useMemo(() => {
    return candidates.filter((c) => {
      const cIntakes = getCandidateIntakes(c);
      const cCountries = getCandidateCountries(c);
      const cApps = applications.filter((a) => a.candidateId === c.id);

      const matchesIntake =
        selectedIntake === 'all' ||
        cIntakes.includes(selectedIntake) ||
        cApps.some((a) => a.intake === selectedIntake);

      const matchesCountry =
        selectedCountry === 'all' ||
        cCountries.includes(selectedCountry) ||
        cApps.some((a) => a.country === selectedCountry);

      return matchesIntake && matchesCountry;
    });
  }, [candidates, applications, selectedIntake, selectedCountry]);

  const filteredApplications = useMemo(() => {
    return applications.filter((a) => {
      const owner = candidateById.get(a.candidateId);
      const appIntake = a.intake || (owner ? getCandidateIntakes(owner)[0] : undefined);

      const matchesIntake = selectedIntake === 'all' || appIntake === selectedIntake;
      const matchesCountry = selectedCountry === 'all' || a.country === selectedCountry;
      return matchesIntake && matchesCountry;
    });
  }, [applications, candidateById, selectedIntake, selectedCountry]);

  // Intake-wise & Country-wise breakdown (always computed over full scope so user can click to filter)
  const intakeBreakdown = useMemo(() => {
    const map = new Map<
      string,
      { intake: string; candidateIds: Set<string>; appCount: number; offerCount: number }
    >();
    const ensure = (key: string) => {
      if (!map.has(key)) {
        map.set(key, { intake: key, candidateIds: new Set(), appCount: 0, offerCount: 0 });
      }
      return map.get(key)!;
    };

    for (const c of candidates) {
      const intakes = getCandidateIntakes(c);
      if (intakes.length === 0) {
        ensure('Unspecified').candidateIds.add(c.id);
      } else {
        for (const i of intakes) ensure(i).candidateIds.add(c.id);
      }
    }
    for (const a of applications) {
      const owner = candidateById.get(a.candidateId);
      const key = a.intake?.trim() || (owner && getCandidateIntakes(owner)[0]) || 'Unspecified';
      const entry = ensure(key);
      entry.candidateIds.add(a.candidateId);
      entry.appCount += 1;
      if (
        a.status === 'conditional_offer' ||
        a.status === 'unconditional_offer' ||
        a.status === 'enrolled'
      ) {
        entry.offerCount += 1;
      }
    }

    return Array.from(map.values())
      .map((item) => ({
        intake: item.intake,
        candidates: item.candidateIds.size,
        applications: item.appCount,
        offers: item.offerCount,
      }))
      .sort((a, b) => b.candidates + b.applications - (a.candidates + a.applications));
  }, [candidates, applications, candidateById]);

  const countryBreakdown = useMemo(() => {
    const map = new Map<
      string,
      { country: string; candidateIds: Set<string>; appCount: number; offerCount: number }
    >();
    const ensure = (key: string) => {
      if (!map.has(key)) {
        map.set(key, { country: key, candidateIds: new Set(), appCount: 0, offerCount: 0 });
      }
      return map.get(key)!;
    };

    for (const c of candidates) {
      const countries = getCandidateCountries(c);
      if (countries.length === 0) {
        ensure('Unspecified').candidateIds.add(c.id);
      } else {
        for (const co of countries) ensure(co).candidateIds.add(c.id);
      }
    }
    for (const a of applications) {
      const key = a.country?.trim() || 'Unspecified';
      const entry = ensure(key);
      entry.candidateIds.add(a.candidateId);
      entry.appCount += 1;
      if (
        a.status === 'conditional_offer' ||
        a.status === 'unconditional_offer' ||
        a.status === 'enrolled'
      ) {
        entry.offerCount += 1;
      }
    }

    return Array.from(map.values())
      .map((item) => ({
        country: item.country,
        candidates: item.candidateIds.size,
        applications: item.appCount,
        offers: item.offerCount,
      }))
      .sort((a, b) => b.candidates + b.applications - (a.candidates + a.applications));
  }, [candidates, applications]);

  const totalCandidates = filteredCandidates.length;
  const activeCandidates = filteredCandidates.filter((c) => c.status === 'active').length;
  const readyCandidates = filteredCandidates.filter(
    (c) => Boolean(c.passport?.passportNumber) && c.englishTests.length > 0 && c.education.length > 0
  ).length;
  const readinessPct = totalCandidates > 0 ? Math.round((readyCandidates / totalCandidates) * 100) : 0;

  const draftCount = filteredApplications.filter(
    (a) => a.status === 'draft' || a.status === 'preparing_documents' || a.status === 'ready_for_review'
  ).length;
  const inPortalCount = filteredApplications.filter((a) => a.status === 'in_progress').length;
  const submittedCount = filteredApplications.filter(
    (a) => a.status === 'submitted' || a.status === 'under_review'
  ).length;
  const offersCount = filteredApplications.filter(
    (a) =>
      a.status === 'conditional_offer' ||
      a.status === 'unconditional_offer' ||
      a.status === 'enrolled'
  ).length;
  const scheduledDeadlines = filteredApplications.filter((a) => Boolean(a.deadline)).length;
  const depositsPaidCount = filteredApplications.filter((a) => Boolean(a.depositPaid)).length;
  const activeCommissionsCount = filteredApplications.filter(
    (a) => a.commissionStatus && a.commissionStatus !== 'none'
  ).length;

  const candidateNameById = new Map(
    candidates.map((c) => [c.id, `${c.personal.legalGivenName} ${c.personal.familyName}`])
  );

  // Build workspace-wide Action Items & Upcoming Deadlines (respecting filters)
  type ActionItem = {
    id: string;
    kind: 'missing' | 'deposit' | 'deadline';
    title: string;
    subtitle: string;
    badge: string;
    tone: 'brass' | 'negative' | 'neutral';
    onClick: () => void;
  };

  const actionItems: ActionItem[] = [];

  for (const c of filteredCandidates) {
    const missing: string[] = [];
    if (!c.passport?.passportNumber) missing.push('passport');
    if (c.englishTests.length === 0) missing.push('English test');
    if (c.education.length === 0) missing.push('academic record');
    if (missing.length > 0) {
      actionItems.push({
        id: `missing-${c.id}`,
        kind: 'missing',
        title: `${c.personal.legalGivenName} ${c.personal.familyName}`,
        subtitle: `Missing ${missing.join(', ')}`,
        badge: 'Incomplete',
        tone: 'brass',
        onClick: () => {
          onSelectCandidate(c);
          onSelectTab('candidates');
        },
      });
    }
  }

  for (const a of filteredApplications) {
    const isOffer =
      a.status === 'conditional_offer' || a.status === 'unconditional_offer';
    if (isOffer && !a.depositPaid) {
      actionItems.push({
        id: `deposit-${a.id}`,
        kind: 'deposit',
        title: a.institutionName,
        subtitle: `${candidateNameById.get(a.candidateId) || 'Candidate'} · Tuition deposit unpaid`,
        badge: 'Deposit due',
        tone: 'brass',
        onClick: () => onSelectTab('applications'),
      });
    }
  }

  const upcomingDeadlines = filteredApplications
    .filter((a) => Boolean(a.deadline))
    .slice()
    .sort((a, b) => (a.deadline || '').localeCompare(b.deadline || ''));

  for (const a of upcomingDeadlines) {
    const daysLeft = a.deadline
      ? Math.ceil((new Date(a.deadline).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
      : null;
    const isUrgent = daysLeft !== null && daysLeft <= 14;
    actionItems.push({
      id: `deadline-${a.id}`,
      kind: 'deadline',
      title: `${a.institutionName} · ${a.programName}`,
      subtitle: candidateNameById.get(a.candidateId) || 'Candidate application',
      badge: a.deadline || '',
      tone: isUrgent ? 'negative' : 'neutral',
      onClick: () => onSelectTab('applications'),
    });
  }

  const stages = [
    {
      key: 'ready',
      label: 'Dossiers verified for portal fill',
      count: readyCandidates,
      total: Math.max(totalCandidates, 1),
      tone: 'brass' as const,
      targetTab: 'candidates',
    },
    {
      key: 'draft',
      label: 'Applications in preparation',
      count: draftCount,
      total: Math.max(filteredApplications.length, totalCandidates, 1),
      tone: 'neutral' as const,
      targetTab: 'applications',
    },
    {
      key: 'portal',
      label: 'Active in university portals',
      count: inPortalCount,
      total: Math.max(filteredApplications.length, totalCandidates, 1),
      tone: 'neutral' as const,
      targetTab: 'applications',
    },
    {
      key: 'submitted',
      label: 'Submitted & under faculty review',
      count: submittedCount,
      total: Math.max(filteredApplications.length, totalCandidates, 1),
      tone: 'neutral' as const,
      targetTab: 'applications',
    },
    {
      key: 'offers',
      label: 'Conditional & unconditional offers',
      count: offersCount,
      total: Math.max(filteredApplications.length, totalCandidates, 1),
      tone: 'positive' as const,
      targetTab: 'applications',
    },
  ];

  const stats = [
    {
      label: 'Active dossiers',
      value: String(activeCandidates),
      sub: `${totalCandidates} total in selection`,
      highlight: false,
      progress: undefined as number | undefined,
      targetTab: 'candidates',
    },
    {
      label: 'Verification readiness',
      value: `${readinessPct}%`,
      sub: `${readyCandidates} of ${totalCandidates} with passport & test`,
      highlight: true,
      progress: readinessPct,
      targetTab: 'candidates',
    },
    {
      label: 'University applications',
      value: String(filteredApplications.length),
      sub: `${submittedCount} submitted · ${inPortalCount} in portal`,
      highlight: false,
      progress: undefined as number | undefined,
      targetTab: 'applications',
    },
    {
      label: 'Offers received',
      value: String(offersCount),
      sub: isOrgAdmin
        ? `${depositsPaidCount} deposits paid · ${activeCommissionsCount} commissions`
        : `${scheduledDeadlines} deadlines · ${depositsPaidCount} deposits paid`,
      highlight: false,
      progress: undefined as number | undefined,
      targetTab: 'applications',
    },
  ];

  const scopeLabel =
    viewScope === 'assigned' && !isOrgAdmin
      ? 'Assigned to you'
      : viewScope === 'assigned'
      ? 'My assigned scope'
      : 'Agency-wide intake';

  const hasFilters = selectedIntake !== 'all' || selectedCountry !== 'all';

  return (
    <div className="space-y-6">
      {/* Page Title, Intake/Country Filters & Actions */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-[28px] leading-[1.15] font-medium text-ink-primary tracking-[-0.015em]">
              Intake overview
            </h1>
            <span className="px-2 py-0.5 rounded-md bg-surface-card border border-hairline text-[11px] font-medium text-ink-secondary">
              {scopeLabel}
            </span>
          </div>
          <p className="text-sm text-ink-secondary mt-1.5">
            Track dossier readiness, intake targets, and destination country pipelines
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <select
            value={selectedIntake}
            onChange={(e) => setSelectedIntake(e.target.value)}
            aria-label="Filter overview by intake"
            className="field-input h-9 w-auto text-xs"
          >
            <option value="all">All intakes</option>
            {allIntakes.map((intake) => (
              <option key={intake} value={intake}>
                {intake}
              </option>
            ))}
          </select>

          <select
            value={selectedCountry}
            onChange={(e) => setSelectedCountry(e.target.value)}
            aria-label="Filter overview by destination country"
            className="field-input h-9 w-auto text-xs"
          >
            <option value="all">All countries</option>
            {allCountries.map((country) => (
              <option key={country} value={country}>
                {country}
              </option>
            ))}
          </select>

          {hasFilters && (
            <button
              type="button"
              onClick={() => {
                setSelectedIntake('all');
                setSelectedCountry('all');
              }}
              className="h-9 px-2.5 rounded-lg border border-hairline bg-surface-card hover:border-hairline-strong text-xs text-ink-secondary hover:text-ink-primary inline-flex items-center gap-1 transition-colors"
            >
              <X className="w-3.5 h-3.5" strokeWidth={1.5} />
              <span>Reset</span>
            </button>
          )}

          <button type="button" onClick={onNewCandidate} className="btn-secondary">
            <Plus className="w-4 h-4 text-ink-secondary" strokeWidth={1.5} />
            <span>New candidate</span>
          </button>
          <button type="button" onClick={() => onSelectTab('testing')} className="btn-primary">
            <span>Open portal sandbox</span>
            <ArrowUpRight className="w-4 h-4" strokeWidth={1.5} />
          </button>
        </div>
      </div>

      {/* 4 Interactive Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((s) => (
          <button
            key={s.label}
            type="button"
            onClick={() => onSelectTab(s.targetTab)}
            className="group p-5 rounded-xl bg-surface-card border border-hairline hover:border-hairline-strong text-left flex flex-col justify-between min-h-[116px] transition-colors duration-150 ease-quart"
          >
            <div className="flex items-center justify-between gap-2 w-full">
              <span className="text-xs text-ink-muted">{s.label}</span>
              <ArrowUpRight
                className="w-3.5 h-3.5 text-ink-muted opacity-0 group-hover:opacity-100 transition-opacity duration-150"
                strokeWidth={1.5}
              />
            </div>
            <div className="mt-3 w-full">
              <p
                className={`text-[28px] leading-none font-medium tabular-nums ${
                  s.highlight ? 'text-brass' : 'text-ink-primary'
                }`}
              >
                {s.value}
              </p>
              {s.progress !== undefined && (
                <div className="h-1 w-full rounded-full bg-surface-deep mt-2.5 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-brass transition-[width] duration-300"
                    style={{ width: `${Math.max(s.progress, s.progress > 0 ? 4 : 0)}%` }}
                  />
                </div>
              )}
              <p className="text-xs text-ink-secondary mt-2 tabular-nums">{s.sub}</p>
            </div>
          </button>
        ))}
      </div>

      {/* Intake-wise & Country-wise Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* By Intake */}
        <div className="p-5 rounded-xl bg-surface-card border border-hairline space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-brass" strokeWidth={1.5} />
              <h2 className="text-sm font-medium text-ink-primary">By intake</h2>
            </div>
            <span className="text-xs text-ink-muted tabular-nums">
              {intakeBreakdown.length} {intakeBreakdown.length === 1 ? 'cycle' : 'cycles'}
            </span>
          </div>

          {intakeBreakdown.length === 0 ? (
            <p className="text-xs text-ink-muted py-2">No intake targets recorded yet.</p>
          ) : (
            <div className="space-y-2">
              {intakeBreakdown.map((row) => {
                const isSelected = selectedIntake === row.intake;
                const canFilter = row.intake !== 'Unspecified';
                return (
                  <button
                    key={row.intake}
                    type="button"
                    disabled={!canFilter}
                    onClick={() =>
                      canFilter &&
                      setSelectedIntake((prev) => (prev === row.intake ? 'all' : row.intake))
                    }
                    className={`w-full px-3 py-2 rounded-lg border text-left flex items-center justify-between gap-3 transition-colors ${
                      isSelected
                        ? 'bg-brass-soft border-brass-border'
                        : canFilter
                        ? 'bg-surface-deep/60 border-hairline hover:border-hairline-strong'
                        : 'bg-surface-deep/40 border-hairline opacity-75 cursor-default'
                    }`}
                  >
                    <span
                      className={`text-xs font-medium truncate ${
                        isSelected ? 'text-brass' : 'text-ink-primary'
                      }`}
                    >
                      {row.intake}
                    </span>
                    <div className="flex items-center gap-3 text-xs tabular-nums shrink-0">
                      <span className="text-ink-secondary">
                        <span className="font-medium text-ink-primary">{row.candidates}</span>{' '}
                        {row.candidates === 1 ? 'student' : 'students'}
                      </span>
                      <span className="text-ink-muted">·</span>
                      <span className="text-ink-secondary">
                        <span className="font-medium text-ink-primary">{row.applications}</span>{' '}
                        {row.applications === 1 ? 'app' : 'apps'}
                      </span>
                      {row.offers > 0 && (
                        <>
                          <span className="text-ink-muted">·</span>
                          <span className="text-tone-positive font-medium">
                            {row.offers} {row.offers === 1 ? 'offer' : 'offers'}
                          </span>
                        </>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* By Destination Country */}
        <div className="p-5 rounded-xl bg-surface-card border border-hairline space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Globe className="w-4 h-4 text-brass" strokeWidth={1.5} />
              <h2 className="text-sm font-medium text-ink-primary">By destination country</h2>
            </div>
            <span className="text-xs text-ink-muted tabular-nums">
              {countryBreakdown.length}{' '}
              {countryBreakdown.length === 1 ? 'country' : 'countries'}
            </span>
          </div>

          {countryBreakdown.length === 0 ? (
            <p className="text-xs text-ink-muted py-2">No destination countries recorded yet.</p>
          ) : (
            <div className="space-y-2">
              {countryBreakdown.map((row) => {
                const isSelected = selectedCountry === row.country;
                const canFilter = row.country !== 'Unspecified';
                return (
                  <button
                    key={row.country}
                    type="button"
                    disabled={!canFilter}
                    onClick={() =>
                      canFilter &&
                      setSelectedCountry((prev) => (prev === row.country ? 'all' : row.country))
                    }
                    className={`w-full px-3 py-2 rounded-lg border text-left flex items-center justify-between gap-3 transition-colors ${
                      isSelected
                        ? 'bg-brass-soft border-brass-border'
                        : canFilter
                        ? 'bg-surface-deep/60 border-hairline hover:border-hairline-strong'
                        : 'bg-surface-deep/40 border-hairline opacity-75 cursor-default'
                    }`}
                  >
                    <span
                      className={`text-xs font-medium truncate ${
                        isSelected ? 'text-brass' : 'text-ink-primary'
                      }`}
                    >
                      {row.country}
                    </span>
                    <div className="flex items-center gap-3 text-xs tabular-nums shrink-0">
                      <span className="text-ink-secondary">
                        <span className="font-medium text-ink-primary">{row.candidates}</span>{' '}
                        {row.candidates === 1 ? 'student' : 'students'}
                      </span>
                      <span className="text-ink-muted">·</span>
                      <span className="text-ink-secondary">
                        <span className="font-medium text-ink-primary">{row.applications}</span>{' '}
                        {row.applications === 1 ? 'app' : 'apps'}
                      </span>
                      {row.offers > 0 && (
                        <>
                          <span className="text-ink-muted">·</span>
                          <span className="text-tone-positive font-medium">
                            {row.offers} {row.offers === 1 ? 'offer' : 'offers'}
                          </span>
                        </>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Asymmetric Split: 8-col Main Readiness & Ledger + 4-col Workspace Action Items & Queue */}
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
                All applications ({filteredApplications.length}) →
              </button>
            </div>

            {/* Horizontal Stage Comparison Bars */}
            <div className="mt-5 space-y-2.5">
              {stages.map((st) => {
                const pct = Math.min(100, Math.round((st.count / st.total) * 100));
                const barClass =
                  st.tone === 'brass'
                    ? 'bg-brass'
                    : st.tone === 'positive'
                    ? 'bg-tone-positive'
                    : 'bg-ink-muted/55';
                const countClass =
                  st.tone === 'brass'
                    ? 'text-brass font-medium'
                    : st.tone === 'positive'
                    ? 'text-tone-positive font-medium'
                    : 'text-ink-primary font-medium';

                return (
                  <button
                    key={st.key}
                    type="button"
                    onClick={() => onSelectTab(st.targetTab)}
                    className="w-full text-left p-2 -mx-2 rounded-lg hover:bg-surface-raised/40 transition-colors duration-150 space-y-1.5 block"
                  >
                    <div className="flex items-center justify-between text-xs">
                      <span
                        className={
                          st.tone === 'brass' ? 'text-ink-primary font-medium' : 'text-ink-secondary'
                        }
                      >
                        {st.label}
                      </span>
                      <span className="tabular-nums text-ink-muted">
                        <span className={countClass}>{st.count}</span> / {st.total}
                      </span>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-surface-deep overflow-hidden">
                      <div
                        className={`h-full rounded-full ${barClass}`}
                        style={{ width: `${Math.max(pct, st.count > 0 ? 5 : 0)}%` }}
                      />
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Candidate Readiness Ledger Table */}
          <div>
            <div className="px-6 py-3.5 flex items-center justify-between border-b border-hairline">
              <span className="text-[13px] font-medium text-ink-primary">
                {selectedIntake === 'all'
                  ? 'Candidates in intake'
                  : `Candidates · ${selectedIntake}`}
              </span>
              <button
                type="button"
                onClick={() => onSelectTab('candidates')}
                className="text-xs text-ink-secondary hover:text-ink-primary transition-colors duration-150 ease-quart"
              >
                Manage dossiers ({filteredCandidates.length}) →
              </button>
            </div>

            {filteredCandidates.length === 0 ? (
              <div className="p-8 text-center space-y-3">
                <p className="text-sm text-ink-secondary">
                  {hasFilters
                    ? 'No candidates match the selected intake and country filters.'
                    : 'No candidate dossiers in this scope yet.'}
                </p>
                {hasFilters ? (
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedIntake('all');
                      setSelectedCountry('all');
                    }}
                    className="btn-secondary"
                  >
                    Clear filters
                  </button>
                ) : (
                  <button type="button" onClick={onNewCandidate} className="btn-secondary">
                    <Plus className="w-4 h-4 text-ink-secondary" strokeWidth={1.5} />
                    <span>Add first candidate</span>
                  </button>
                )}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-hairline text-xs text-ink-muted">
                      <th className="py-2.5 px-6 font-normal">Candidate</th>
                      <th className="py-2.5 px-4 font-normal">Target & intake</th>
                      <th className="py-2.5 px-4 font-normal text-right">GPA</th>
                      <th className="py-2.5 px-4 font-normal text-right">English</th>
                      <th className="py-2.5 px-6 font-normal text-right">Readiness</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-hairline text-[13px]">
                    {filteredCandidates.slice(0, 6).map((c) => {
                      const edu = c.education[0];
                      const eng = c.englishTests[0];
                      const hasPassport = Boolean(c.passport?.passportNumber);
                      const ready = hasPassport && Boolean(eng) && Boolean(edu);
                      const readinessLabel = ready
                        ? 'Ready'
                        : !hasPassport
                        ? 'Needs passport'
                        : !eng
                        ? 'Needs test'
                        : 'Needs academic';
                      const cCountries = getCandidateCountries(c);
                      const cIntakes = getCandidateIntakes(c);

                      return (
                        <tr
                          key={c.id}
                          onClick={() => {
                            onSelectCandidate(c);
                            onSelectTab('candidates');
                          }}
                          className="cursor-pointer hover:bg-surface-raised/35 transition-colors duration-150 ease-quart"
                        >
                          <td className="py-3 px-6">
                            <div className="flex items-center gap-3">
                              <span className="w-7 h-7 rounded-md bg-surface-deep border border-hairline flex items-center justify-center font-mono text-[11px] text-brass shrink-0">
                                {initialsOf(c.personal.legalGivenName, c.personal.familyName)}
                              </span>
                              <div className="min-w-0">
                                <div className="font-medium text-ink-primary truncate">
                                  {c.personal.legalGivenName} {c.personal.familyName}
                                </div>
                                <div className="text-xs text-ink-muted truncate">
                                  {c.personal.nationality}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="py-3 px-4 text-xs">
                            <div className="text-ink-primary truncate max-w-[190px]">
                              {cCountries.length > 0 ? cCountries.join(', ') : 'No destination set'}
                            </div>
                            <div className="text-[11px] text-ink-muted truncate">
                              {cIntakes[0] || 'Intake unset'}
                            </div>
                          </td>
                          <td className="py-3 px-4 text-xs tabular-nums text-ink-secondary text-right">
                            {edu?.gpa || '—'}
                          </td>
                          <td className="py-3 px-4 text-xs tabular-nums text-ink-secondary text-right">
                            {eng ? `${eng.testType} ${eng.overallScore}` : '—'}
                          </td>
                          <td className="py-3 px-6 text-right">
                            <VerificationStamp
                              tone={ready ? 'positive' : 'brass'}
                              label={readinessLabel}
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Right 1/3 Column: Workspace Action Items & Deadlines + Portal Queue */}
        <div className="lg:col-span-4 space-y-5">
          {/* Action items & deadlines */}
          <div className="p-5 rounded-xl bg-surface-card border border-hairline space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-medium text-ink-primary">Action items & deadlines</h3>
              <span className="text-xs tabular-nums text-ink-muted">
                {actionItems.length} open
              </span>
            </div>

            {actionItems.length === 0 ? (
              <div className="py-4 flex items-center gap-2.5 text-xs text-ink-secondary">
                <CheckCircle2 className="w-4 h-4 text-tone-positive shrink-0" strokeWidth={1.5} />
                <span>All dossiers and upcoming deadlines are on track.</span>
              </div>
            ) : (
              <div className="divide-y divide-hairline">
                {actionItems.slice(0, 5).map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={item.onClick}
                    className="w-full py-2.5 first:pt-0 last:pb-0 flex items-start justify-between gap-3 text-left hover:opacity-85 transition-opacity"
                  >
                    <div className="flex items-start gap-2.5 min-w-0">
                      {item.kind === 'deadline' ? (
                        <CalendarClock
                          className={`w-4 h-4 shrink-0 mt-0.5 ${
                            item.tone === 'negative' ? 'text-tone-negative' : 'text-brass'
                          }`}
                          strokeWidth={1.5}
                        />
                      ) : item.kind === 'deposit' ? (
                        <AlertCircle
                          className="w-4 h-4 text-brass shrink-0 mt-0.5"
                          strokeWidth={1.5}
                        />
                      ) : (
                        <FileWarning
                          className="w-4 h-4 text-brass shrink-0 mt-0.5"
                          strokeWidth={1.5}
                        />
                      )}
                      <div className="min-w-0">
                        <p className="text-[13px] font-medium text-ink-primary truncate">
                          {item.title}
                        </p>
                        <p className="text-xs text-ink-muted truncate">{item.subtitle}</p>
                      </div>
                    </div>
                    <span
                      className={`px-2 py-0.5 rounded-md text-[11px] font-medium tabular-nums shrink-0 ${
                        item.tone === 'negative'
                          ? 'bg-tone-negative/10 text-tone-negative'
                          : item.tone === 'brass'
                          ? 'bg-brass-soft text-brass'
                          : 'bg-surface-deep text-ink-secondary border border-hairline'
                      }`}
                    >
                      {item.badge}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Portal queue */}
          <div className="p-5 rounded-xl bg-surface-card border border-hairline space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium text-ink-primary">Portal queue</h3>
              <button
                type="button"
                onClick={() => onSelectTab('applications')}
                className="text-xs tabular-nums text-ink-muted hover:text-ink-primary transition-colors"
              >
                {filteredApplications.length} tracked →
              </button>
            </div>

            {filteredApplications.length === 0 ? (
              <div className="pt-1 space-y-3">
                <p className="text-[13px] text-ink-secondary leading-5">
                  {hasFilters
                    ? 'No applications match the active intake or country filter.'
                    : 'No university applications logged yet. Create an application record or test autofill in the portal sandbox.'}
                </p>
                {!hasFilters && (
                  <button
                    type="button"
                    onClick={() => onSelectTab('applications')}
                    className="btn-secondary w-full"
                  >
                    Track university application
                  </button>
                )}
              </div>
            ) : (
              <div className="divide-y divide-hairline">
                {filteredApplications.slice(0, 4).map((a) => {
                  const studentName = candidateNameById.get(a.candidateId);
                  return (
                    <button
                      key={a.id}
                      type="button"
                      onClick={() => onSelectTab('applications')}
                      className="w-full py-2.5 first:pt-0 last:pb-0 flex items-start justify-between gap-3 text-left hover:opacity-85 transition-opacity"
                    >
                      <div className="min-w-0">
                        <p className="text-[13px] font-medium text-ink-primary truncate">
                          {a.institutionName}
                        </p>
                        <p className="text-xs text-ink-muted truncate">
                          {a.programName} · {a.country}
                        </p>
                        {studentName && (
                          <p className="text-[11px] text-ink-secondary truncate mt-0.5">
                            {studentName}
                          </p>
                        )}
                      </div>
                      <div className="pt-0.5 shrink-0">
                        <VerificationStamp
                          tone={
                            a.status === 'submitted' ||
                            a.status === 'conditional_offer' ||
                            a.status === 'unconditional_offer' ||
                            a.status === 'enrolled'
                              ? 'positive'
                              : 'brass'
                          }
                          label={a.status.replace(/_/g, ' ').replace(/^./, (ch) => ch.toUpperCase())}
                        />
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
