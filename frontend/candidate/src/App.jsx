import { useEffect, useMemo, useState } from 'react';
import Interview from './pages/Interview.jsx';
import Result from './pages/Result.jsx';
import EnvironmentCheck from './pages/EnvironmentCheck.jsx';
import WarningModal from './components/WarningModal.jsx';
import useProctoring from './hooks/useProctoring.js';
import useFullscreen from './hooks/useFullscreen.js';
import {
  getNextInterviewQuestion,
  startInterview as startInterviewApi,
  submitInterviewAudio,
} from './services/api.js';

const THEME_KEY = 'ai-interviewer-theme';
const STATES = {
  environment_check: 'environment_check',
  ready: 'ready',
  interviewing: 'interviewing',
  evaluating: 'evaluating',
  completed: 'completed',
};
const ROLES = ['Frontend Developer', 'Backend Developer', 'Full Stack Engineer', 'AI / ML Engineer'];
const TOTAL_QUESTIONS = 3;
const QUESTION_SECONDS = 120;

function App() {
  const [darkMode, setDarkMode] = useState(() => {
    if (typeof window === 'undefined') return true;
    return localStorage.getItem(THEME_KEY) === 'dark';
  });

  const [state, setState] = useState(STATES.environment_check);
  const [role, setRole] = useState(ROLES[0]);
  const [difficulty, setDifficulty] = useState('easy');
  const [question, setQuestion] = useState('');
  const [timerLeft, setTimerLeft] = useState(QUESTION_SECONDS);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState([]);
  const [error, setError] = useState('');
  const [historyPayload, setHistoryPayload] = useState([]);
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const [pendingSkipCompletion, setPendingSkipCompletion] = useState(null);
  const [interviewId, setInterviewId] = useState('');

  const proctoring = useProctoring({ active: state === STATES.interviewing || state === STATES.evaluating });
  const { warning, clearWarning, onViolation, violations, terminated, terminationThreshold } = proctoring;
  const fullscreen = useFullscreen({
    active: state === STATES.interviewing || state === STATES.evaluating,
    onViolation,
  });

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem(THEME_KEY, 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem(THEME_KEY, 'light');
    }
  }, [darkMode]);

  useEffect(() => {
    if (state !== STATES.interviewing) return undefined;
    if (timerLeft <= 0) {
      onViolation('Time limit exceeded. Submit your answer promptly.');
      setTimerLeft(QUESTION_SECONDS);
      return undefined;
    }
    const t = window.setTimeout(() => setTimerLeft((prev) => prev - 1), 1000);
    return () => window.clearTimeout(t);
  }, [state, timerLeft, onViolation]);

  useEffect(() => {
    if (terminated) {
      setState(STATES.completed);
      setError('Interview auto-terminated due to suspicious activity.');
    }
  }, [terminated]);

  const startInterview = async () => {
    setError('');
    await fullscreen.requestFullscreen();
    setState(STATES.interviewing);
    setQuestionIndex(0);
    setTimerLeft(QUESTION_SECONDS);
    setAnswers([]);
    setHistoryPayload([]);
    try {
      const res = await startInterviewApi(role, difficulty);
      setInterviewId(res.interview_id);
      setQuestion(res.question);
    } catch (err) {
      const detail = err?.response?.data?.detail;
      setError(detail ? `Failed to fetch question: ${detail}` : 'Failed to fetch question.');
      setState(STATES.ready);
    }
  };

  const submitAudio = async (audioBlob) => {
    setState(STATES.evaluating);
    setError('');
    try {
      const file = new File([audioBlob], `answer-${Date.now()}.webm`, { type: 'audio/webm' });
      const answerData = await submitInterviewAudio(file, question);
      const res = await getNextInterviewQuestion({
        interview_id: interviewId,
        previous_question: question,
        user_answer: answerData.transcript,
      });
      const nextEntry = {
        question,
        transcript: answerData.transcript,
        evaluation: answerData.evaluation,
      };
      const nextAnswers = [...answers, nextEntry];
      setAnswers(nextAnswers);
      setHistoryPayload((prev) => [...prev, nextEntry]);

      const done = nextAnswers.length >= TOTAL_QUESTIONS;
      if (done) {
        setState(STATES.completed);
        return;
      }
      setQuestion(res.question || '');
      setQuestionIndex((prev) => prev + 1);
      setTimerLeft(QUESTION_SECONDS);
      setState(STATES.interviewing);
    } catch (err) {
      const detail = err?.response?.data?.detail;
      setError(detail ? `Failed to submit answer: ${detail}` : 'Failed to submit answer.');
      setState(STATES.interviewing);
    }
  };

  const skipQuestion = async () => {
    if (state === STATES.evaluating) return;
    setError('');
    const skippedEntry = {
      question,
      transcript: '[Skipped by candidate]',
      evaluation: {
        score: 0,
        confidence: 100,
        strengths: [],
        weaknesses: ['Candidate skipped this question.'],
        improvements: ['Provide an answer instead of skipping to maximize score.'],
        verdict: 'fail',
        feedback: 'This question was skipped. No technical evaluation was possible.',
      },
    };
    const nextAnswers = [...answers, skippedEntry];

    if (nextAnswers.length >= TOTAL_QUESTIONS) {
      setPendingSkipCompletion(nextAnswers);
      setShowExitConfirm(true);
      return;
    }

    setAnswers(nextAnswers);
    setQuestionIndex((prev) => prev + 1);
    setTimerLeft(QUESTION_SECONDS);
    try {
      const res = await getNextInterviewQuestion({
        interview_id: interviewId,
        previous_question: question,
        user_answer: '[Skipped by candidate]',
      });
      setQuestion(res.question || '');
      setState(STATES.interviewing);
    } catch (err) {
      const detail = err?.response?.data?.detail;
      setError(detail ? `Failed to fetch next question: ${detail}` : 'Failed to fetch next question.');
      setState(STATES.interviewing);
    }
  };

  const finalVerdict = useMemo(() => {
    if (!answers.length) return 'fail';
    const avg = answers.reduce((sum, item) => sum + (item.evaluation?.score || 0), 0) / answers.length;
    return avg >= 7 && violations < terminationThreshold ? 'pass' : 'fail';
  }, [answers, violations, terminationThreshold]);

  const interviewActive = useMemo(
    () => [STATES.ready, STATES.interviewing, STATES.evaluating].includes(state),
    [state],
  );

  useEffect(() => {
    if (!interviewActive) return undefined;
    const onBeforeUnload = (event) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [interviewActive]);

  const confirmExitTest = () => {
    setShowExitConfirm(false);
    if (pendingSkipCompletion) {
      setAnswers(pendingSkipCompletion);
      setPendingSkipCompletion(null);
      setState(STATES.completed);
      setError('');
      return;
    }
    setState(STATES.completed);
    setError('Interview ended by candidate.');
  };

  return (
    <div
      className={`min-h-screen w-full ${
        darkMode
          ? 'dark bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950'
          : 'bg-gradient-to-br from-slate-900/5 via-indigo-100/60 to-slate-900/5'
      } transition-colors duration-500`}
    >
      <div className="flex min-h-screen w-full">
        <div className="relative flex min-h-screen w-full flex-col overflow-hidden border border-white/10 bg-white/70 p-5 shadow-[0_24px_80px_rgba(15,23,42,0.35)] backdrop-blur-2xl transition-transform duration-500 dark:border-slate-800/60 dark:bg-slate-950/70 sm:p-7 md:p-8">
          <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top,_rgba(129,140,248,0.18),_transparent_55%),_radial-gradient(circle_at_bottom,_rgba(56,189,248,0.16),_transparent_55%)]" />

          <header className="mb-6 flex items-start justify-between gap-4 sm:mb-8">
            <div>
              <p className="inline-flex items-center rounded-full bg-slate-900/5 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.18em] text-slate-500 ring-1 ring-slate-900/5 dark:bg-slate-900/60 dark:text-slate-300 dark:ring-slate-50/10">
                Proctored AI Interview Platform
              </p>
              <h1 className="mt-3 text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl dark:text-slate-50">
                AI Interviewer
              </h1>
              <p className="mt-1 text-sm leading-relaxed text-slate-600 sm:text-[15px] dark:text-slate-300/80">
                Controlled interview environment with anti-cheating safeguards and strict deterministic
                AI evaluation.
              </p>
            </div>
            <div className="flex items-start gap-3">
              <div className="rounded-full border border-slate-200 bg-white/70 px-3 py-1 text-xs text-slate-600 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-300">
                State: {state.replace('_', ' ')}
              </div>
              {interviewActive && (
                <button
                  type="button"
                  onClick={() => setShowExitConfirm(true)}
                  className="inline-flex items-center rounded-full border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-100 dark:border-red-900/50 dark:bg-red-900/20 dark:text-red-300"
                >
                  Exit test
                </button>
              )}
              <button
                type="button"
                onClick={() => setDarkMode((prev) => !prev)}
                className="inline-flex items-center rounded-full border border-slate-900/10 bg-white/80 px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm backdrop-blur hover:bg-white dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-100 dark:hover:bg-slate-900"
              >
                <span className="mr-2 text-lg" aria-hidden="true">
                  {darkMode ? '🌙' : '☀️'}
                </span>
                {darkMode ? 'Dark' : 'Light'} mode
              </button>
            </div>
          </header>

          <main className="flex-1">
            {state === STATES.environment_check && (
              <EnvironmentCheck
                proctoring={proctoring}
                onContinue={() => setState(STATES.ready)}
              />
            )}
            {(state === STATES.ready || state === STATES.interviewing || state === STATES.evaluating) && (
              <Interview
                role={role}
                setRole={setRole}
                roles={ROLES}
                difficulty={difficulty}
                setDifficulty={setDifficulty}
                question={question}
                questionIndex={questionIndex}
                totalQuestions={TOTAL_QUESTIONS}
                timerLeft={timerLeft}
                onStartInterview={startInterview}
                onSubmitAudio={submitAudio}
                onSkipQuestion={skipQuestion}
                evaluating={state === STATES.evaluating}
                proctoring={proctoring}
                currentState={state}
              />
            )}
            {state === STATES.completed && (
              <Result
                report={{
                  role,
                  answers,
                  finalVerdict,
                  violations,
                  terminated,
                }}
                onRestart={() => {
                  setState(STATES.environment_check);
                  setQuestion('');
                  setAnswers([]);
                  setQuestionIndex(0);
                  setTimerLeft(QUESTION_SECONDS);
                  setHistoryPayload([]);
                  setError('');
                }}
              />
            )}
            {error && <p className="mt-4 text-sm text-red-500">{error}</p>}
          </main>

          <footer className="mt-7 border-t border-slate-900/5 pt-4 text-[11px] text-slate-500 dark:border-slate-800 dark:text-slate-400">
            <p>
              Best-effort security only: browsers cannot fully block extensions, screen recording, or
              OS-level cheating.
            </p>
          </footer>
        </div>
      </div>
      <WarningModal open={!!warning} message={warning} onClose={clearWarning} />
      {showExitConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl dark:border-slate-700 dark:bg-slate-900">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-50">
              Are you sure you want to exit the test?
            </h3>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
              Exiting now will end this interview session.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setShowExitConfirm(false);
                  setPendingSkipCompletion(null);
                }}
                className="rounded-full border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 dark:border-slate-700 dark:text-slate-200"
              >
                Continue test
              </button>
              <button
                type="button"
                onClick={confirmExitTest}
                className="rounded-full bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
              >
                Yes, exit
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
