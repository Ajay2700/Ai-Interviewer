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

const CANDIDATE_STORAGE_KEY = 'ai-interviewer-candidate-id';
let currentContext = {
  userId: '',
  role: '',
  difficulty: 'easy',
  mode: 'hybrid',
  questionIndex: 0,
  sessionId: '',
};

function getOrCreateCandidateId() {
  const existing = window.localStorage.getItem(CANDIDATE_STORAGE_KEY);
  if (existing) return existing;
  const generated =
    (window.crypto?.randomUUID && window.crypto.randomUUID()) || `candidate-${Date.now()}`;
  window.localStorage.setItem(CANDIDATE_STORAGE_KEY, generated);
  return generated;
}

export async function startInterview(role, difficulty) {
  const userId = getOrCreateCandidateId();
  currentContext = {
    userId,
    role,
    difficulty,
    mode: 'hybrid',
    questionIndex: 0,
    sessionId: '',
  };
  api.defaults.headers.common['x-user-id'] = userId;

  const res = await api.get('/api/interview/start', {
    params: { user_id: userId, role, difficulty, mode: currentContext.mode },
  });
  currentContext.sessionId = res.data.session_id || '';
  currentContext.questionIndex = Number(res.data.question_index ?? 0);

  // Preserve backward compatibility with old candidate app contract.
  return {
    ...res.data,
    interview_id: res.data.session_id,
  };
}

export async function getNextInterviewQuestion(payload) {
  const nextPayload = {
    user_id: currentContext.userId,
    session_id: payload?.interview_id || currentContext.sessionId,
    mode: currentContext.mode,
    role: currentContext.role,
    difficulty: currentContext.difficulty,
    previous_question: payload?.previous_question || '',
    user_answer: payload?.user_answer || '',
    question_index: currentContext.questionIndex,
  };
  const res = await api.post('/api/interview/next', nextPayload);
  currentContext.questionIndex = Number(res.data.question_index ?? currentContext.questionIndex + 1);
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

