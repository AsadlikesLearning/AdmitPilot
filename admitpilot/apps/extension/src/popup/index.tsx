import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import '../style.css';
import {
  GraduationCap,
  PanelRightOpen,
  Users,
  ExternalLink,
  ShieldCheck,
  CheckCircle,
} from 'lucide-react';
import { CandidateProfile } from 'admitpilot-shared';
import { apiFetch } from '../lib/api';

export const Popup: React.FC = () => {
  const [candidates, setCandidates] = useState<CandidateProfile[]>([]);
  const [activeCandidateId, setActiveCandidateId] = useState<string | null>(null);
  const [backendStatus, setBackendStatus] = useState<'checking' | 'online' | 'offline'>('checking');

  useEffect(() => {
    // 1. Fetch from chrome.storage
    chrome.storage?.local?.get(['admitpilot_activeCandidate', 'admitpilot_candidates'], (res) => {
      if (res?.admitpilot_activeCandidate) {
        setActiveCandidateId(res.admitpilot_activeCandidate);
      }
      if (res?.admitpilot_candidates) {
        setCandidates(res.admitpilot_candidates);
      }
    });

    // 2. Fetch fresh candidates from backend
    apiFetch('/candidates')
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((data) => {
        if (!Array.isArray(data)) throw new Error('Invalid candidates payload');
        setCandidates(data);
        setBackendStatus('online');
        chrome.storage?.local?.set({ admitpilot_candidates: data });
        if (data.length > 0 && !activeCandidateId) {
          setActiveCandidateId(data[0].id);
          chrome.storage?.local?.set({ admitpilot_activeCandidate: data[0].id });
        }
      })
      .catch(() => {
        setBackendStatus('offline');
      });
  }, []);

  const handleSelectCandidate = (id: string) => {
    setActiveCandidateId(id);
    chrome.storage?.local?.set({ admitpilot_activeCandidate: id });
  };

  const openSidePanel = () => {
    chrome.runtime.sendMessage({ action: 'OPEN_SIDE_PANEL' }, () => {
      window.close();
    });
  };

  const activeCand = candidates.find((c) => c.id === activeCandidateId) || candidates[0];

  return (
    <div className="p-4 bg-slate-950 text-slate-100 w-80 text-xs border border-slate-800">
      {/* Brand Header */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-3">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-indigo-600 flex items-center justify-center text-white">
            <GraduationCap className="w-4 h-4" />
          </div>
          <div>
            <h1 className="font-bold text-white text-xs">AdmitPilot AI</h1>
            <p className="text-[10px] text-slate-400">Intelligent Admissions Agent</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 text-[10px]">
          <span
            className={`w-2 h-2 rounded-full ${
              backendStatus === 'online' ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'
            }`}
          ></span>
          <span className="text-slate-400 capitalize">{backendStatus}</span>
        </div>
      </div>

      {/* Active Candidate Pill */}
      <div className="my-3 p-2.5 rounded-xl bg-slate-900 border border-slate-800">
        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
          Active Student Profile
        </span>
        {candidates.length === 0 ? (
          <p className="text-slate-400 italic text-[11px]">No candidate profiles found.</p>
        ) : (
          <select
            value={activeCand?.id || ''}
            onChange={(e) => handleSelectCandidate(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 text-slate-200 text-xs rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-indigo-500 font-medium"
          >
            {candidates.map((c) => (
              <option key={c.id} value={c.id}>
                {c.personal.legalGivenName} {c.personal.familyName} ({c.personal.nationality})
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Main Action: Open Side Panel */}
      <div className="space-y-2">
        <button
          onClick={openSidePanel}
          className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-semibold shadow-md shadow-indigo-600/30 flex items-center justify-center gap-2 transition-colors"
        >
          <PanelRightOpen className="w-4 h-4" />
          Open Admissions Side Panel
        </button>

        <a
          href="http://localhost:5173"
          target="_blank"
          rel="noreferrer"
          className="w-full py-2 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 rounded-xl font-medium flex items-center justify-center gap-1.5 transition-colors text-[11px]"
        >
          <ExternalLink className="w-3.5 h-3.5" />
          Open Full Consultant Dashboard
        </a>
      </div>

      <div className="mt-3 pt-2 border-t border-slate-800/80 text-[10px] text-slate-400 flex items-center justify-between">
        <span className="flex items-center gap-1 text-emerald-400 font-medium">
          <ShieldCheck className="w-3 h-3" />
          Zero-Invention Policy
        </span>
        <span>MV3 v2.8</span>
      </div>
    </div>
  );
};

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Popup />
  </React.StrictMode>
);

