import React, { useState } from 'react';
import { Plus, Search, Download, ChevronRight } from 'lucide-react';
import { CandidateProfile, CountryTeam, UserProfile } from 'admitpilot-shared';
import { VerificationStamp } from './ui/Primitives';

interface CandidateListProps {
  candidates: CandidateProfile[];
  selectedCandidate: CandidateProfile | null;
  members?: UserProfile[];
  countryTeams?: CountryTeam[];
  onSelectCandidate: (c: CandidateProfile) => void;
  onNewCandidate: () => void;
  onExportCandidates?: (candidates: CandidateProfile[]) => void;
}

export const CandidateList: React.FC<CandidateListProps> = ({
  candidates,
  selectedCandidate,
  members = [],
  countryTeams = [],
  onSelectCandidate,
  onNewCandidate,
  onExportCandidates,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [deskFilter, setDeskFilter] = useState('all');

  const filtered = candidates.filter((c) => {
    const q = searchTerm.toLowerCase();
    const fullName = `${c.personal.legalGivenName} ${c.personal.familyName}`.toLowerCase();
    const email = (c.contact?.email || '').toLowerCase();
    const passport = (c.passport?.passportNumber || '').toLowerCase();
    const id = c.id.toLowerCase();

    const matchesSearch = !q || fullName.includes(q) || email.includes(q) || passport.includes(q) || id.includes(q);
    const matchesStatus = statusFilter === 'all' || c.status === statusFilter;
    const matchesDesk =
      deskFilter === 'all' ||
      (deskFilter === 'unassigned' ? !c.countryTeamId : c.countryTeamId === deskFilter);

    return matchesSearch && matchesStatus && matchesDesk;
  });

  const handleExportCSV = () => {
    if (onExportCandidates) {
      onExportCandidates(filtered);
      return;
    }
    const headers = [
      'ID',
      'Given Name',
      'Family Name',
      'Nationality',
      'DOB',
      'Email',
      'Passport Number',
      'Country Desk',
      'Consultant',
      'Status',
    ];
    const rows = filtered.map((c) => {
      const desk = countryTeams.find((t) => t.id === c.countryTeamId);
      const consultant = members.find((m) => m.id === c.assignedConsultantId);
      return [
        c.id,
        `"${c.personal.legalGivenName}"`,
        `"${c.personal.familyName}"`,
        `"${c.personal.nationality}"`,
        c.personal.dateOfBirth,
        `"${c.contact.email}"`,
        `"${c.passport?.passportNumber || ''}"`,
        `"${desk?.code || ''}"`,
        `"${consultant?.fullName || ''}"`,
        c.status,
      ];
    });
    const csvContent =
      'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `admitpilot_candidates_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-5">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-[28px] leading-[1.15] font-medium text-ink-primary tracking-[-0.015em]">
            Candidate dossiers
          </h1>
          <p className="text-sm text-ink-secondary mt-1.5 tabular-nums">
            {filtered.length} {filtered.length === 1 ? 'record' : 'records'} in current view
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <button type="button" onClick={handleExportCSV} className="btn-secondary">
            <Download className="w-4 h-4 text-ink-muted" strokeWidth={1.5} />
            <span>Export CSV</span>
          </button>
          <button type="button" onClick={onNewCandidate} className="btn-primary">
            <Plus className="w-4 h-4" strokeWidth={1.5} />
            <span>Add candidate</span>
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="p-3 rounded-xl bg-surface-card border border-hairline flex flex-col md:flex-row items-center gap-3">
        <div className="relative flex-1 w-full">
          <Search
            className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted pointer-events-none"
            strokeWidth={1.5}
          />
          <input
            type="text"
            placeholder="Filter by name, email, or passport number"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="field-input pl-9"
          />
        </div>

        <div className="flex items-center gap-2.5 w-full md:w-auto">
          <select
            value={deskFilter}
            onChange={(e) => setDeskFilter(e.target.value)}
            className="field-input md:w-48"
          >
            <option value="all">All country desks</option>
            {countryTeams.map((desk) => (
              <option key={desk.id} value={desk.id}>
                {desk.code} · {desk.name}
              </option>
            ))}
            <option value="unassigned">Unassigned desk</option>
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="field-input md:w-36"
          >
            <option value="all">All statuses</option>
            <option value="active">Active</option>
            <option value="archived">Archived</option>
            <option value="on_hold">On hold</option>
          </select>
        </div>
      </div>

      {/* Dossier Table */}
      <div className="bg-surface-card border border-hairline rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-hairline text-xs text-ink-muted">
                <th className="py-3 px-5 font-normal">Candidate</th>
                <th className="py-3 px-3 font-normal">Passport</th>
                <th className="py-3 px-3 font-normal">Country desk & consultant</th>
                <th className="py-3 px-3 font-normal">Qualification</th>
                <th className="py-3 px-3 font-normal text-right">Language</th>
                <th className="py-3 px-3 font-normal">Status</th>
                <th className="py-3 px-5 font-normal text-right">Dossier</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-hairline text-[13px]">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-ink-muted text-sm">
                    No candidates match the selected filters
                  </td>
                </tr>
              ) : (
                filtered.map((c) => {
                  const isSelected = selectedCandidate?.id === c.id;
                  const latestEdu = c.education[0];
                  const latestEng = c.englishTests[0];
                  const desk = countryTeams.find((t) => t.id === c.countryTeamId);
                  const consultant = members.find((m) => m.id === c.assignedConsultantId);

                  return (
                    <tr
                      key={c.id}
                      onClick={() => onSelectCandidate(c)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          onSelectCandidate(c);
                        }
                      }}
                      tabIndex={0}
                      className={`cursor-pointer transition-colors duration-150 ease-quart focus-visible:outline-none focus-visible:bg-surface-raised ${
                        isSelected
                          ? 'bg-surface-raised shadow-[inset_2px_0_0_#d4a853]'
                          : 'hover:bg-surface-raised/50'
                      }`}
                    >
                      <td className="py-3 px-5">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-md bg-surface-deep border border-hairline font-mono text-xs text-ink-secondary flex items-center justify-center shrink-0">
                            {c.personal.legalGivenName[0] || 'C'}
                            {c.personal.familyName[0] || 'P'}
                          </div>
                          <div className="min-w-0">
                            <span className="font-medium text-ink-primary block truncate">
                              {c.personal.legalGivenName} {c.personal.familyName}
                            </span>
                            <span className="text-xs text-ink-muted block truncate">
                              {c.personal.nationality} · {c.contact.email}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-3 font-mono text-xs tabular-nums">
                        {c.passport?.passportNumber ? (
                          <span className="text-ink-primary">{c.passport.passportNumber}</span>
                        ) : (
                          <span className="text-tone-negative">Missing</span>
                        )}
                      </td>
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-2">
                          {desk ? (
                            <span className="px-1.5 py-0.5 rounded bg-surface-deep border border-brass-border font-mono text-xs text-brass">
                              {desk.code}
                            </span>
                          ) : (
                            <span className="text-xs text-ink-muted">No desk</span>
                          )}
                          <span className="text-xs text-ink-secondary truncate">
                            {consultant ? consultant.fullName : 'Unassigned'}
                          </span>
                        </div>
                      </td>
                      <td className="py-3 px-3 text-ink-secondary tabular-nums">
                        {latestEdu ? (
                          <span>
                            {latestEdu.qualificationLevel}
                            {latestEdu.gpa ? ` · ${latestEdu.gpa}` : ''}
                          </span>
                        ) : (
                          <span className="text-ink-muted">—</span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-right font-mono text-xs tabular-nums text-ink-secondary">
                        {latestEng ? `${latestEng.testType} ${latestEng.overallScore}` : '—'}
                      </td>
                      <td className="py-3 px-3">
                        <VerificationStamp
                          tone={c.status === 'active' ? 'positive' : 'brass'}
                          label={c.status.replace(/_/g, ' ')}
                        />
                      </td>
                      <td className="py-3 px-5 text-right">
                        <span className="inline-flex items-center gap-1 text-xs text-ink-secondary">
                          <span>Inspect</span>
                          <ChevronRight className="w-4 h-4 text-ink-muted" strokeWidth={1.5} />
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
