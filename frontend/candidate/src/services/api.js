import axios from 'axios';

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ||
  (window?.location?.hostname === 'localhost'
    ? 'http://127.0.0.1:8010'
    : `${window.location.protocol}//${window.location.hostname}:8010`);

const api = axios.create({
  baseURL: API_BASE_URL,
});

export async function startInterview(role, difficulty) {
  const res = await api.get('/api/interview/start', {
    params: { role, difficulty },
  });
  return res.data;
}

export async function getNextInterviewQuestion(payload) {
  const res = await api.post('/api/interview/next', payload);
  return res.data;
}

export async function submitInterviewAudio(file, question) {
  const formData = new FormData();
  formData.append('audio', file);
  formData.append('question', question || '');
  const res = await api.post('/api/interview/answer', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return res.data;
}

