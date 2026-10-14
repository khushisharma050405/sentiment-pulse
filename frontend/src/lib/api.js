const rawBase = import.meta.env.VITE_API_URL;
const BASE = (typeof rawBase === 'string' && rawBase.trim().length > 0
  ? rawBase
  : (import.meta.env.DEV ? 'http://localhost:8000' : '')
).replace(/\/$/, '');
const KEY = 'sp-token';
const USER_KEY = 'sp-user';
export const requireAuth = import.meta.env.VITE_REQUIRE_AUTH !== 'false';
export const getToken = () => { try { return localStorage.getItem(KEY); } catch { return null; } };
export const setToken = t => { try { t ? localStorage.setItem(KEY, t) : localStorage.removeItem(KEY); } catch {} };
export const getUser = () => { try { const u = localStorage.getItem(USER_KEY); return u ? JSON.parse(u) : null; } catch { return null; } };
export const setUser = u => { try { u ? localStorage.setItem(USER_KEY, JSON.stringify(u)) : localStorage.removeItem(USER_KEY); } catch {} };
export const isAuthed = () => !!getToken();

async function req(path, body, method = 'POST') {
  let r;
  try {
    r = await fetch(BASE + path, {
      method,
      headers: { 'Content-Type': 'application/json', ...(getToken() ? { Authorization: 'Bearer ' + getToken() } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new Error(`Cannot reach the API${BASE ? ' at ' + BASE : ''}. Check if the backend is running.`);
  }
  const d = await r.json().catch(() => ({}));
  if (!r.ok) {
    if (r.status === 401 && getToken()) { setToken(null); setUser(null); window.location.hash = '#/login'; }
    const m = typeof d.detail === 'string' ? d.detail : Array.isArray(d.detail) ? d.detail.map(x => x.msg).join(', ') : '';
    throw new Error(m || `Request failed (${r.status})`);
  }
  return d;
}

export const login = async (email, password) => {
  const d = await req('/auth/login', { email, password });
  setToken(d.access_token);
  if (d.user) setUser(d.user);
  return d;
};
export const register = async (name, email, password) => {
  const d = await req('/auth/register', { name, email, password });
  setToken(d.access_token);
  if (d.user) setUser(d.user);
  return d;
};
export const logout = () => { setToken(null); setUser(null); window.location.hash = '#/login'; };
export const analyzeText = text => req('/api/sentiment', { text });
export const analyzeBatch = posts => req('/api/sentiment/batch', { posts });
export const history = () => req('/api/history', null, 'GET');
export const stats = () => req('/api/stats', null, 'GET');
export const trends = (days = 30) => req('/api/trends?days=' + days, null, 'GET');
export const topics = () => req('/api/topics', null, 'GET');
export const uploadFiles = async files => {
  const formData = new FormData();
  for (const f of files) {
    formData.append('files', f);
  }
  let r;
  try {
    r = await fetch(BASE + '/api/upload', {
      method: 'POST',
      headers: {
        ...(getToken() ? { Authorization: 'Bearer ' + getToken() } : {}),
      },
      body: formData,
    });
  } catch {
    throw new Error(`Cannot reach the API${BASE ? ' at ' + BASE : ''}. Check if the backend is running.`);
  }
  const d = await r.json().catch(() => ({}));
  if (!r.ok) {
    if (r.status === 401 && getToken()) { setToken(null); setUser(null); window.location.hash = '#/login'; }
    const m = typeof d.detail === 'string' ? d.detail : Array.isArray(d.detail) ? d.detail.map(x => x.msg).join(', ') : '';
    throw new Error(m || `Upload failed (${r.status})`);
  }
  return d;
};

