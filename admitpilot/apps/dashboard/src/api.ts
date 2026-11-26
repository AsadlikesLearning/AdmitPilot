import {
  CandidateProfile,
  CandidateDocument,
  CandidatePortalCredential,
  ApplicationRecord,
  AISettings,
  Organization,
  UserProfile,
  CountryTeam,
  DocumentCategory,
} from 'admitpilot-shared';

const API_BASE = '/api';

const fetchFreshDevToken = async (): Promise<string | null> => {
  try {
    const devRes = await fetch(`${API_BASE}/auth/dev-session`, { method: 'POST' });
    if (devRes.ok) {
      const data = await devRes.json();
      if (data?.token) {
        localStorage.setItem('supabase-auth-token', JSON.stringify({ token: data.token }));
        return data.token;
      }
    }
  } catch (e) {
    console.error('Failed to bootstrap dev session:', e);
  }
  return null;
};

const getAuthToken = async (): Promise<string | null> => {
  try {
    const stored = localStorage.getItem('supabase-auth-token');
    if (stored) {
      const parsed = JSON.parse(stored);
      if (parsed?.token) {
        return parsed.token;
      }
    }
    return await fetchFreshDevToken();
  } catch {
    return await fetchFreshDevToken();
  }
};

const authFetch = async (
  url: string,
  init: RequestInit = {},
  includeJsonContentType = true
): Promise<Response> => {
  const buildHeaders = async (token: string | null): Promise<Record<string, string>> => {
    const h: Record<string, string> = {
      ...((init.headers as Record<string, string>) || {}),
    };
    if (includeJsonContentType && !h['Content-Type']) {
      h['Content-Type'] = 'application/json';
    }
    if (token) {
      h['Authorization'] = `Bearer ${token}`;
    }
    return h;
  };

  let token = await getAuthToken();
  let res = await fetch(url, {
    ...init,
    headers: await buildHeaders(token),
    credentials: 'include',
  });

  if (res.status === 401 || res.status === 403) {
    localStorage.removeItem('supabase-auth-token');
    token = await fetchFreshDevToken();
    if (token) {
      res = await fetch(url, {
        ...init,
        headers: await buildHeaders(token),
        credentials: 'include',
      });
    }
  }

  return res;
};

export const api = {
  // Health & Database Storage Engine Status
  checkHealth: async (): Promise<{
    status: string;
    storageEngine?: 'supabase_postgres' | 'local_json';
    databaseConnected?: boolean;
    databaseHost?: string;
  }> => {
    const res = await fetch(`${API_BASE}/health`);
    return res.json();
  },

  // Candidates
  getCandidates: async (): Promise<CandidateProfile[]> => {
    const res = await authFetch(`${API_BASE}/candidates`);
    if (!res.ok) throw new Error('Failed to fetch candidates');
    return res.json();
  },

  getCandidate: async (id: string): Promise<CandidateProfile> => {
    const res = await authFetch(`${API_BASE}/candidates/${id}`);
    if (!res.ok) throw new Error('Failed to fetch candidate');
    return res.json();
  },

  createCandidate: async (
    cand: Partial<CandidateProfile> & { managedStudentEmailPassword?: string }
  ): Promise<CandidateProfile> => {
    const res = await authFetch(`${API_BASE}/candidates`, {
      method: 'POST',
      body: JSON.stringify(cand),
    });
    if (!res.ok) throw new Error('Failed to create candidate');
    return res.json();
  },

  updateCandidate: async (id: string, cand: Partial<CandidateProfile>): Promise<CandidateProfile> => {
    const res = await authFetch(`${API_BASE}/candidates/${id}`, {
      method: 'PUT',
      body: JSON.stringify(cand),
    });
    if (!res.ok) throw new Error('Failed to update candidate');
    return res.json();
  },

  deleteCandidate: async (id: string): Promise<{ success: boolean }> => {
    const res = await authFetch(`${API_BASE}/candidates/${id}`, {
      method: 'DELETE',
    });
    if (!res.ok) throw new Error('Failed to delete candidate');
    return res.json();
  },

  archiveCandidate: async (id: string): Promise<{ success: boolean; status: string }> => {
    const res = await authFetch(`${API_BASE}/candidates/${id}/archive`, {
      method: 'POST',
    });
    if (!res.ok) throw new Error('Failed to archive candidate');
    return res.json();
  },

  restoreCandidate: async (id: string): Promise<{ success: boolean; status: string }> => {
    const res = await authFetch(`${API_BASE}/candidates/${id}/restore`, {
      method: 'POST',
    });
    if (!res.ok) throw new Error('Failed to restore candidate');
    return res.json();
  },

  // Consultant-Managed Student Emails & Portal Credentials
  getCredentials: async (candidateId: string): Promise<CandidatePortalCredential[]> => {
    const res = await authFetch(`${API_BASE}/candidates/${candidateId}/credentials`);
    if (!res.ok) throw new Error('Failed to fetch candidate credentials');
    return res.json();
  },

  createCredential: async (
    candidateId: string,
    payload: Partial<CandidatePortalCredential> & { label: string; loginEmail: string }
  ): Promise<CandidatePortalCredential> => {
    const res = await authFetch(`${API_BASE}/candidates/${candidateId}/credentials`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to save credential');
    }
    return res.json();
  },

  updateCredential: async (
    candidateId: string,
    credId: string,
    payload: Partial<CandidatePortalCredential>
  ): Promise<CandidatePortalCredential> => {
    const res = await authFetch(`${API_BASE}/candidates/${candidateId}/credentials/${credId}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error('Failed to update credential');
    return res.json();
  },

  revealCredential: async (
    candidateId: string,
    credId: string
  ): Promise<{
    id: string;
    loginEmail: string;
    username?: string;
    password: string;
    pinOrSecurityNote?: string;
  }> => {
    const res = await authFetch(`${API_BASE}/candidates/${candidateId}/credentials/${credId}/reveal`);
    if (!res.ok) throw new Error('Failed to reveal credential');
    return res.json();
  },

  deleteCredential: async (candidateId: string, credId: string): Promise<{ success: boolean }> => {
    const res = await authFetch(`${API_BASE}/candidates/${candidateId}/credentials/${credId}`, {
      method: 'DELETE',
    });
    if (!res.ok) throw new Error('Failed to delete credential');
    return res.json();
  },

  // Documents: Multi-Upload, Preview, Download, Re-Extract & Delete
  getDocuments: async (candidateId: string): Promise<CandidateDocument[]> => {
    const res = await authFetch(`${API_BASE}/candidates/${candidateId}/documents`);
    if (!res.ok) throw new Error('Failed to fetch documents');
    return res.json();
  },

  uploadDocuments: async (
    candidateId: string,
    files: File[],
    category?: DocumentCategory | 'auto'
  ): Promise<{
    document: CandidateDocument;
    documents: CandidateDocument[];
    extraction: any;
    extractions: any[];
    updatedCandidate: CandidateProfile;
  }> => {
    const formData = new FormData();
    files.forEach((f) => formData.append('files', f));
    if (category) formData.append('category', category);

    const res = await authFetch(
      `${API_BASE}/candidates/${candidateId}/documents/upload`,
      {
        method: 'POST',
        body: formData,
      },
      false
    );
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to upload documents');
    }
    return res.json();
  },

  uploadDocument: async (
    candidateId: string,
    file: File,
    category?: string
  ): Promise<{
    document: CandidateDocument;
    documents?: CandidateDocument[];
    extraction: any;
    updatedCandidate: CandidateProfile;
  }> => {
    return api.uploadDocuments(candidateId, [file], (category as DocumentCategory | 'auto') || 'auto');
  },

  reextractDocument: async (
    candidateId: string,
    docId: string,
    category?: DocumentCategory | 'auto'
  ): Promise<{ document: CandidateDocument; extraction: any; updatedCandidate: CandidateProfile }> => {
    const res = await authFetch(
      `${API_BASE}/candidates/${candidateId}/documents/${docId}/reextract`,
      {
        method: 'POST',
        body: JSON.stringify({ category }),
      }
    );
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to re-extract document');
    }
    return res.json();
  },

  deleteDocument: async (candidateId: string, docId: string): Promise<{ success: boolean }> => {
    const res = await authFetch(`${API_BASE}/candidates/${candidateId}/documents/${docId}`, {
      method: 'DELETE',
    });
    if (!res.ok) throw new Error('Failed to delete document');
    return res.json();
  },

  downloadDocumentBlob: async (
    docId: string,
    mode: 'portal' | 'original' = 'portal',
    fallbackFileName = 'Document.pdf'
  ): Promise<void> => {
    const res = await authFetch(`${API_BASE}/documents/${docId}/download?mode=${mode}`, {}, false);
    if (!res.ok) throw new Error('Document download failed');

    let filename = fallbackFileName;
    const disp = res.headers.get('Content-Disposition');
    if (disp) {
      const utf8Match = disp.match(/filename\*=UTF-8''([^;]+)/i);
      const asciiMatch = disp.match(/filename="([^"]+)"/i);
      if (utf8Match?.[1]) filename = decodeURIComponent(utf8Match[1]);
      else if (asciiMatch?.[1]) filename = asciiMatch[1];
    }

    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  },

  fetchDocumentPreviewUrl: async (
    docId: string
  ): Promise<{ objectUrl: string; mimeType: string }> => {
    const res = await authFetch(`${API_BASE}/documents/${docId}/download?mode=inline`, {}, false);
    if (!res.ok) throw new Error('Failed to load document preview');
    const mimeType = res.headers.get('Content-Type') || 'application/pdf';
    const blob = await res.blob();
    const objectUrl = URL.createObjectURL(blob);
    return { objectUrl, mimeType };
  },

  reconcileField: async (
    candidateId: string,
    fieldKey: string,
    approvedValue: any,
    note?: string,
    documentId?: string
  ): Promise<CandidateProfile> => {
    const res = await authFetch(`${API_BASE}/candidates/${candidateId}/reconcile`, {
      method: 'POST',
      body: JSON.stringify({ fieldKey, approvedValue, note, documentId }),
    });
    if (!res.ok) throw new Error('Failed to reconcile field');
    return res.json();
  },

  // Applications
  getApplications: async (candidateId?: string): Promise<ApplicationRecord[]> => {
    const url = candidateId
      ? `${API_BASE}/applications?candidateId=${candidateId}`
      : `${API_BASE}/applications`;
    const res = await authFetch(url);
    if (!res.ok) throw new Error('Failed to fetch applications');
    return res.json();
  },

  createApplication: async (appData: Partial<ApplicationRecord>): Promise<ApplicationRecord> => {
    const res = await authFetch(`${API_BASE}/applications`, {
      method: 'POST',
      body: JSON.stringify(appData),
    });
    if (!res.ok) throw new Error('Failed to create application');
    return res.json();
  },

  updateApplication: async (
    id: string,
    appData: Partial<ApplicationRecord> & { newTimelineNote?: string; newTimelineType?: string }
  ): Promise<ApplicationRecord> => {
    const res = await authFetch(`${API_BASE}/applications/${id}`, {
      method: 'PUT',
      body: JSON.stringify(appData),
    });
    if (!res.ok) throw new Error('Failed to update application');
    return res.json();
  },

  deleteApplication: async (id: string): Promise<{ success: boolean }> => {
    const res = await authFetch(`${API_BASE}/applications/${id}`, {
      method: 'DELETE',
    });
    if (!res.ok) throw new Error('Failed to delete application');
    return res.json();
  },

  // AI & Form Matching
  matchFields: async (candidateId: string, fields: any[]): Promise<any> => {
    const res = await authFetch(`${API_BASE}/ai/match-fields`, {
      method: 'POST',
      body: JSON.stringify({ candidateId, fields }),
    });
    if (!res.ok) throw new Error('Failed to match fields');
    return res.json();
  },

  analyzeWebsite: async (candidateId: string, pageInfo: any): Promise<any> => {
    const res = await authFetch(`${API_BASE}/ai/analyze-website`, {
      method: 'POST',
      body: JSON.stringify({ candidateId, pageInfo }),
    });
    if (!res.ok) throw new Error('Failed to analyze website');
    return res.json();
  },

  // Settings
  getAISettings: async (): Promise<AISettings> => {
    const res = await authFetch(`${API_BASE}/settings/ai`);
    if (!res.ok) throw new Error('Failed to get AI settings');
    return res.json();
  },

  saveAISettings: async (settings: Partial<AISettings>): Promise<AISettings> => {
    const res = await authFetch(`${API_BASE}/settings/ai`, {
      method: 'POST',
      body: JSON.stringify(settings),
    });
    if (!res.ok) throw new Error('Failed to save AI settings');
    return res.json();
  },

  testAIConnection: async (
    settings: Partial<AISettings>
  ): Promise<{ ok: boolean; provider: string; model: string; latencyMs?: number; message: string }> => {
    const res = await authFetch(`${API_BASE}/settings/ai/test`, {
      method: 'POST',
      body: JSON.stringify(settings),
    });
    return res.json();
  },

  // Admin Profile & Organization Settings
  getMe: async (): Promise<UserProfile> => {
    const res = await authFetch(`${API_BASE}/me`);
    if (!res.ok) throw new Error('Failed to fetch current user profile');
    return res.json();
  },

  updateMe: async (updates: Partial<UserProfile>): Promise<UserProfile> => {
    const res = await authFetch(`${API_BASE}/me`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
    if (!res.ok) throw new Error('Failed to update profile');
    return res.json();
  },

  getOrganization: async (): Promise<Organization> => {
    const res = await authFetch(`${API_BASE}/organization`);
    if (!res.ok) throw new Error('Failed to fetch organization');
    return res.json();
  },

  updateOrganization: async (updates: Partial<Organization>): Promise<Organization> => {
    const res = await authFetch(`${API_BASE}/organization`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
    if (!res.ok) throw new Error('Failed to update organization');
    return res.json();
  },

  // Auth & Session
  login: async (
    email: string,
    password: string
  ): Promise<{ token: string; user: UserProfile }> => {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.error || 'Invalid email or password');
    }
    if (data?.token) {
      localStorage.setItem('supabase-auth-token', JSON.stringify({ token: data.token }));
    }
    return data;
  },

  logout: (): void => {
    localStorage.removeItem('supabase-auth-token');
  },

  // Teammates & Country Desks
  getTeamMembers: async (): Promise<UserProfile[]> => {
    const res = await authFetch(`${API_BASE}/team/members`);
    if (!res.ok) throw new Error('Failed to fetch team members');
    return res.json();
  },

  createTeamMember: async (
    member: Partial<UserProfile> & { email: string; fullName: string; loginPassword?: string }
  ): Promise<UserProfile> => {
    const res = await authFetch(`${API_BASE}/team/members`, {
      method: 'POST',
      body: JSON.stringify(member),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to create team member');
    }
    return res.json();
  },

  setMemberPassword: async (
    userId: string,
    password: string
  ): Promise<{ success: boolean }> => {
    const res = await authFetch(`${API_BASE}/team/members/${userId}/credentials`, {
      method: 'POST',
      body: JSON.stringify({ password }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to update login password');
    }
    return res.json();
  },

  updateTeamMember: async (id: string, updates: Partial<UserProfile>): Promise<UserProfile> => {
    const res = await authFetch(`${API_BASE}/team/members/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
    if (!res.ok) throw new Error('Failed to update team member');
    return res.json();
  },

  deleteTeamMember: async (id: string): Promise<{ success: boolean }> => {
    const res = await authFetch(`${API_BASE}/team/members/${id}`, {
      method: 'DELETE',
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to delete team member');
    }
    return res.json();
  },

  getCountryTeams: async (): Promise<CountryTeam[]> => {
    const res = await authFetch(`${API_BASE}/team/countries`);
    if (!res.ok) throw new Error('Failed to fetch country desks');
    return res.json();
  },

  createCountryTeam: async (
    team: Partial<CountryTeam> & { name: string; code: string; countries: string[]; memberIds?: string[] }
  ): Promise<CountryTeam> => {
    const res = await authFetch(`${API_BASE}/team/countries`, {
      method: 'POST',
      body: JSON.stringify(team),
    });
    if (!res.ok) throw new Error('Failed to create country desk');
    return res.json();
  },

  updateCountryTeam: async (
    id: string,
    team: Partial<CountryTeam> & { memberIds?: string[] }
  ): Promise<CountryTeam> => {
    const res = await authFetch(`${API_BASE}/team/countries/${id}`, {
      method: 'PUT',
      body: JSON.stringify(team),
    });
    if (!res.ok) throw new Error('Failed to update country desk');
    return res.json();
  },

  updateCountryTeamMember: async (
    teamId: string,
    userId: string,
    action: 'add' | 'remove'
  ): Promise<UserProfile> => {
    const res = await authFetch(`${API_BASE}/team/countries/${teamId}/members`, {
      method: 'POST',
      body: JSON.stringify({ userId, action }),
    });
    if (!res.ok) throw new Error('Failed to update desk membership');
    return res.json();
  },

  deleteCountryTeam: async (id: string): Promise<{ success: boolean }> => {
    const res = await authFetch(`${API_BASE}/team/countries/${id}`, {
      method: 'DELETE',
    });
    if (!res.ok) throw new Error('Failed to delete country desk');
    return res.json();
  },
};
