export const BACKEND_URL = 'http://localhost:3001/api';

const TOKEN_STORAGE_KEY = 'admitpilot_auth_token';

async function getStoredToken(): Promise<string | null> {
  return new Promise((resolve) => {
    if (!chrome?.storage?.local) {
      resolve(null);
      return;
    }
    chrome.storage.local.get([TOKEN_STORAGE_KEY], (res) => {
      resolve(res?.[TOKEN_STORAGE_KEY] || null);
    });
  });
}

async function setStoredToken(token: string): Promise<void> {
  return new Promise((resolve) => {
    if (!chrome?.storage?.local) {
      resolve();
      return;
    }
    chrome.storage.local.set({ [TOKEN_STORAGE_KEY]: token }, () => resolve());
  });
}

async function fetchDevToken(): Promise<string | null> {
  try {
    const res = await fetch(`${BACKEND_URL}/auth/dev-session`, { method: 'POST' });
    if (!res.ok) return null;
    const data = await res.json();
    if (data?.token) {
      await setStoredToken(data.token);
      return data.token;
    }
  } catch {
    // Backend offline
  }
  return null;
}

export async function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  let token = (await getStoredToken()) || (await fetchDevToken());

  const doRequest = (bearer: string | null) => {
    const headers: Record<string, string> = {
      ...(init.headers as Record<string, string> | undefined),
    };
    if (init.body && typeof init.body === 'string' && !headers['Content-Type']) {
      headers['Content-Type'] = 'application/json';
    }
    if (bearer) {
      headers['Authorization'] = `Bearer ${bearer}`;
    }
    return fetch(`${BACKEND_URL}${path}`, { ...init, headers });
  };

  let res = await doRequest(token);
  if (res.status === 401 || res.status === 403) {
    token = await fetchDevToken();
    if (token) {
      res = await doRequest(token);
    }
  }
  return res;
}
