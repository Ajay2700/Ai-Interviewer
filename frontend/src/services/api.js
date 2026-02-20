import axios from 'axios';

function resolveBaseUrl() {
  const explicit = import.meta.env.VITE_API_URL || import.meta.env.VITE_API_BASE_URL;
  if (explicit) return explicit;
  if (typeof window !== 'undefined') {
    const host = window.location.hostname;
    if (host !== 'localhost' && host !== '127.0.0.1') {
      return '';
    }
  }
  return 'http://127.0.0.1:8010';
}

const API_BASE_URL = resolveBaseUrl();

const api = axios.create({
  baseURL: API_BASE_URL,
});

function toConfigAwareError(err) {
  if (err?.response) return err;
  const hasExplicitApi =
    !!import.meta.env.VITE_API_URL || !!import.meta.env.VITE_API_BASE_URL;
  const isLocal =
    typeof window !== 'undefined' &&
    ['localhost', '127.0.0.1'].includes(window.location.hostname);
  const detail =
    !hasExplicitApi && !isLocal
      ? 'Candidate API URL is not configured. Set VITE_API_URL in Vercel to your Render backend URL (https://<service>.onrender.com).'
      : `Unable to reach backend API (${API_BASE_URL || 'same-origin'}). Check backend health, HTTPS URL, and ALLOWED_ORIGINS.`;
  const wrapped = new Error(detail);
  wrapped.response = { data: { detail } };
  return wrapped;
}

export function setCandidateContext(userId) {
  if (!userId) {
    delete api.defaults.headers.common['x-user-id'];
    return;
  }
  api.defaults.headers.common['x-user-id'] = userId;
}

export async function startInterview(userId, role, difficulty, mode) {
  try {
    const res = await api.get('/api/interview/start', {
      params: { user_id: userId, role, difficulty, mode },
    });
    return res.data;
  } catch (err) {
    throw toConfigAwareError(err);
  }
}

export async function getNextInterviewQuestion(payload) {
  try {
    const res = await api.post('/api/interview/next', payload);
    return res.data;
  } catch (err) {
    throw toConfigAwareError(err);
  }
}

export async function submitInterviewAudio(file, question, userId) {
  const formData = new FormData();
  formData.append('audio', file);
  formData.append('question', question || '');
  formData.append('user_id', userId || '');
  try {
    const res = await api.post('/api/interview/answer', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return res.data;
  } catch (err) {
    throw toConfigAwareError(err);
  }
}

export async function getUsageSummary(userId) {
  try {
    const res = await api.get('/api/interview/usage', {
      params: { user_id: userId },
    });
    return res.data;
  } catch (err) {
    throw toConfigAwareError(err);
  }
}

export async function submitProctoringLog(payload) {
  const res = await api.post('/api/interview/proctor-log', payload);
  return res.data;
}

export async function addQuestion(data) {
  const res = await api.post('/api/admin/question', data);
  return res.data;
}

export async function getQuestions() {
  const res = await api.get('/api/admin/questions');
  return res.data;
}

export async function updateQuestion(id, data) {
  const res = await api.put(`/api/admin/question/${id}`, data);
  return res.data;
}

export async function deleteQuestion(id) {
  const res = await api.delete(`/api/admin/question/${id}`);
  return res.data;
}


