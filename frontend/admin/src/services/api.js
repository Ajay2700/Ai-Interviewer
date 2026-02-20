import axios from 'axios';

function resolveBaseUrl() {
  const explicit = import.meta.env.VITE_API_URL || import.meta.env.VITE_API_BASE_URL;
  if (explicit) return explicit;
  if (typeof window !== 'undefined') {
    const host = window.location.hostname;
    if (host !== 'localhost' && host !== '127.0.0.1') {
      // In deployment, fallback to same-origin route (if proxy/rewrite exists).
      return '';
    }
  }
  return 'http://127.0.0.1:8010';
}

const BASE_URL = resolveBaseUrl();
const ADMIN_KEY = import.meta.env.VITE_ADMIN_KEY || 'admin@123';
const ADMIN_TOKEN_KEY = 'admin_access_token';

function getStorage() {
  if (typeof window === 'undefined') return null;
  return window.sessionStorage;
}

const api = axios.create({
  baseURL: BASE_URL,
});

function toConfigAwareError(err) {
  const hasExplicitApi =
    !!import.meta.env.VITE_API_URL || !!import.meta.env.VITE_API_BASE_URL;
  const isLocal =
    typeof window !== 'undefined' &&
    ['localhost', '127.0.0.1'].includes(window.location.hostname);
  if (err?.response) {
    const status = Number(err.response.status || 0);
    if (status === 404) {
      const detail =
        !hasExplicitApi && !isLocal
          ? 'Admin API URL is missing in deployment. Set VITE_API_URL to your Render backend URL (https://<service>.onrender.com) and redeploy this admin app.'
          : `Admin API endpoint not found (404) at ${BASE_URL || 'same-origin'}. Check VITE_API_URL and confirm backend exposes /api/admin/auth/request-code.`;
      err.response.data = { ...(err.response.data || {}), detail };
    }
    return err;
  }
  const detail =
    !hasExplicitApi && !isLocal
      ? 'Admin API URL is not configured. Set VITE_API_URL in Vercel to your Render backend URL (https://<service>.onrender.com).'
      : `Unable to reach backend API (${BASE_URL || 'same-origin'}). Check Render health, HTTPS URL, and ALLOWED_ORIGINS.`;
  const wrapped = new Error(detail);
  wrapped.response = { data: { detail } };
  return wrapped;
}

api.interceptors.request.use((config) => {
  const token = getStorage()?.getItem(ADMIN_TOKEN_KEY) || '';
  config.headers = config.headers || {};
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  } else if (ADMIN_KEY) {
    // Backward-compatible fallback for local/dev usage.
    config.headers['x-admin-key'] = ADMIN_KEY;
  }
  return config;
});

export function setAdminToken(token) {
  const storage = getStorage();
  if (!storage) return;
  if (token) {
    storage.setItem(ADMIN_TOKEN_KEY, token);
  } else {
    storage.removeItem(ADMIN_TOKEN_KEY);
  }
}

export function getAdminToken() {
  const storage = getStorage();
  return storage?.getItem(ADMIN_TOKEN_KEY) || '';
}

export async function requestAdminLoginCode(email) {
  try {
    const res = await api.post('/api/admin/auth/request-code', { email });
    return res.data;
  } catch (err) {
    throw toConfigAwareError(err);
  }
}

export async function verifyAdminLoginCode(email, code) {
  try {
    const res = await api.post('/api/admin/auth/verify-code', { email, code });
    return res.data;
  } catch (err) {
    throw toConfigAwareError(err);
  }
}

export async function smtpTest(email) {
  try {
    const res = await api.post('/api/admin/auth/smtp-test', { email });
    return res.data;
  } catch (err) {
    throw toConfigAwareError(err);
  }
}

export async function getQuestions() {
  const res = await api.get('/api/admin/questions');
  return res.data;
}

export async function addQuestion(payload) {
  const res = await api.post('/api/admin/question', payload);
  return res.data;
}

export async function updateQuestion(id, payload) {
  const res = await api.put(`/api/admin/question/${id}`, payload);
  return res.data;
}

export async function deleteQuestion(id) {
  const res = await api.delete(`/api/admin/question/${id}`);
  return res.data;
}

