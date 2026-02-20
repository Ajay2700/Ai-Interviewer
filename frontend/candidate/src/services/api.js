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
  const generated = generateCandidateId();
  window.localStorage.setItem(CANDIDATE_STORAGE_KEY, generated);
  return generated;
}

function generateCandidateId() {
  return (window.crypto?.randomUUID && window.crypto.randomUUID()) || `candidate-${Date.now()}`;
}

export async function startInterview(role, difficulty) {
  let userId = getOrCreateCandidateId();
  currentContext = {
    userId,
    role,
    difficulty,
    mode: 'hybrid',
    questionIndex: 0,
    sessionId: '',
  };
  api.defaults.headers.common['x-user-id'] = userId;

  let res;
  try {
    res = await api.get('/api/interview/start', {
      params: { user_id: userId, role, difficulty, mode: currentContext.mode },
    });
  } catch (err) {
    const normalized = toConfigAwareError(err);
    const detail = normalized?.response?.data?.detail || '';
    if (String(detail).includes('Question limit reached')) {
      // Anonymous candidate flow: rotate browser-local ID for a fresh test run.
      userId = generateCandidateId();
      window.localStorage.setItem(CANDIDATE_STORAGE_KEY, userId);
      currentContext.userId = userId;
      api.defaults.headers.common['x-user-id'] = userId;
      try {
        res = await api.get('/api/interview/start', {
          params: { user_id: userId, role, difficulty, mode: currentContext.mode },
        });
      } catch (retryErr) {
        throw toConfigAwareError(retryErr);
      }
    } else {
      throw normalized;
    }
  }
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
  let res;
  try {
    res = await api.post('/api/interview/next', nextPayload);
  } catch (err) {
    throw toConfigAwareError(err);
  }
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

