import axios from 'axios';

const API_BASE_URL =
  import.meta.env.VITE_API_URL ||
  import.meta.env.VITE_API_BASE_URL ||
  (window?.location?.hostname === 'localhost'
    ? 'http://127.0.0.1:8010'
    : `${window.location.protocol}//${window.location.hostname}:8010`);

const api = axios.create({
  baseURL: API_BASE_URL,
});

export function setCandidateContext(userId) {
  if (!userId) {
    delete api.defaults.headers.common['x-user-id'];
    return;
  }
  api.defaults.headers.common['x-user-id'] = userId;
}

export async function startInterview(userId, role, difficulty, mode) {
  const res = await api.get('/api/interview/start', {
    params: { user_id: userId, role, difficulty, mode },
  });
  return res.data;
}

export async function getNextInterviewQuestion(payload) {
  const res = await api.post('/api/interview/next', payload);
  return res.data;
}

export async function submitInterviewAudio(file, question, userId) {
  const formData = new FormData();
  formData.append('audio', file);
  formData.append('question', question || '');
  formData.append('user_id', userId || '');
  const res = await api.post('/api/interview/answer', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return res.data;
}

export async function getUsageSummary(userId) {
  const res = await api.get('/api/interview/usage', {
    params: { user_id: userId },
  });
  return res.data;
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


