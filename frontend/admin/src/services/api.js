import axios from 'axios';

const BASE_URL =
  import.meta.env.VITE_API_URL ||
  import.meta.env.VITE_API_BASE_URL ||
  'http://127.0.0.1:8010';
const ADMIN_KEY = import.meta.env.VITE_ADMIN_KEY || 'admin@123';
const ADMIN_TOKEN_KEY = 'admin_access_token';

function getStorage() {
  if (typeof window === 'undefined') return null;
  return window.sessionStorage;
}

const api = axios.create({
  baseURL: BASE_URL,
});

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
  const res = await api.post('/api/admin/auth/request-code', { email });
  return res.data;
}

export async function verifyAdminLoginCode(email, code) {
  const res = await api.post('/api/admin/auth/verify-code', { email, code });
  return res.data;
}

export async function smtpTest(email) {
  const res = await api.post('/api/admin/auth/smtp-test', { email });
  return res.data;
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

