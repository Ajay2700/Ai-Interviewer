import { useEffect, useRef, useState } from 'react';
import Recorder from '../components/Recorder.jsx';
import Loader from '../components/Loader.jsx';
import { conversationalTurn, getQuestion } from '../services/api.js';

const ROLES = [
  'Frontend Developer',
  'Backend Developer',
  'Full Stack Engineer',
  'AI / ML Engineer',
  'DevOps Engineer',
];

function Conversation() {
  const [role, setRole] = useState(ROLES[0]);
  const [messages, setMessages] = useState([]);
  const [isBootstrapping, setIsBootstrapping] = useState(false);
  const [isTurnInFlight, setIsTurnInFlight] = useState(false);
  const [history, setHistory] = useState([]);
  const [error, setError] = useState('');
  const chatEndRef = useRef(null);

  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }
  }, [messages]);

  const ensureFirstQuestion = async () => {
    setError('');
    if (messages.some((m) => m.type === 'question')) return;
    setIsBootstrapping(true);
    try {
      const data = await getQuestion(role);
      setMessages((prev) => [
        ...prev,
        {
          id: `q-${Date.now()}`,
          from: 'ai',
          type: 'question',
          text: data.question,
        },
      ]);
    } catch (err) {
      console.error(err);
      const detail = err?.response?.data?.detail;
      setError(
        detail
          ? `Failed to start the interview: ${detail}`
          : 'Failed to start the interview. Please check that the backend is running.',
      );
    } finally {
      setIsBootstrapping(false);
    }
  };

  const handleRecorded = async (blob) => {
    if (!messages.some((m) => m.type === 'question')) {
      await ensureFirstQuestion();
    }
    if (isTurnInFlight) return;
    setError('');
    setIsTurnInFlight(true);
    try {
      const file = new File([blob], 'turn.webm', { type: 'audio/webm' });
      const lastQuestion =
        [...messages]
          .reverse()
          .find((m) => m.type === 'question' && m.from === 'ai')?.text || '';

      const payloadHistory = history.length
        ? history
        : lastQuestion
        ? [{ question: lastQuestion, answer: '', score: null }]
        : [];

      const data = await conversationalTurn({
        file,
        role,
        history: payloadHistory,
      });

      const userMessage = {
        id: `u-${Date.now()}`,
        from: 'user',
        type: 'answer',
        text: data.transcript,
      };

      const feedbackMessage = {
        id: `f-${Date.now()}`,
        from: 'ai',
        type: 'feedback',
        text: data.evaluation?.overall_feedback ?? '',
        score: data.evaluation?.score ?? 0,
      };

      const nextQuestionMessage = {
        id: `q-${Date.now() + 1}`,
        from: 'ai',
        type: 'question',
        text: data.next_question,
      };

      setMessages((prev) => [...prev, userMessage, feedbackMessage, nextQuestionMessage]);
      setHistory(data.history ?? []);
    } catch (err) {
      console.error(err);
      const detail = err?.response?.data?.detail;
      setError(detail ? `Failed to process this turn: ${detail}` : 'Failed to process this turn. Please try again.');
    } finally {
      setIsTurnInFlight(false);
    }
  };

  const hasStarted = messages.length > 0;

  return (
    <div className="grid h-full gap-6 md:grid-rows-[auto,1fr,auto]">
      <section className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
            Conversational interview
          </p>
          <p className="text-sm text-slate-600 dark:text-slate-300">
            AI asks follow-up questions based on everything you&apos;ve said so far.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={role}
            onChange={(e) => setRole(e.target.value)}
            className="rounded-xl border border-slate-200/80 bg-white/90 px-3 py-1.5 text-xs font-medium text-slate-900 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/30 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-100"
          >
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
          {!hasStarted && (
            <button
              type="button"
              onClick={ensureFirstQuestion}
              disabled={isBootstrapping}
              className="inline-flex items-center rounded-full bg-gradient-to-r from-primary-500 to-indigo-500 px-3.5 py-1.5 text-xs font-semibold text-white shadow-sm hover:from-primary-600 hover:to-indigo-600 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 dark:focus:ring-offset-slate-950"
            >
              {isBootstrapping ? 'Preparing...' : 'Start interview'}
            </button>
          )}
        </div>
      </section>

      <section className="relative min-h-[260px] overflow-hidden rounded-2xl border border-slate-200/70 bg-slate-50/70 p-4 text-sm shadow-inner backdrop-blur-sm dark:border-slate-800/80 dark:bg-slate-950/60">
        <div className="absolute inset-x-4 top-0 h-10 bg-gradient-to-b from-slate-100/80 to-transparent dark:from-slate-900/80" />
        <div className="absolute inset-x-4 bottom-0 h-10 bg-gradient-to-t from-slate-100/80 to-transparent dark:from-slate-900/80" />
        <div className="relative flex h-full flex-col gap-3 overflow-y-auto pb-4 pt-2">
          {messages.length === 0 && (
            <div className="mx-auto mt-8 max-w-xs text-center text-xs text-slate-500 dark:text-slate-400">
              <p>Click &quot;Start interview&quot; and answer with your voice. New questions will adapt to your previous answers.</p>
            </div>
          )}

          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex ${msg.from === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[80%] rounded-2xl px-3 py-2 text-xs leading-relaxed shadow-sm transition ${
                  msg.from === 'user'
                    ? 'bg-primary-600 text-white rounded-br-sm'
                    : msg.type === 'feedback'
                    ? 'bg-emerald-50/90 text-emerald-900 rounded-bl-sm dark:bg-emerald-900/30 dark:text-emerald-100'
                    : 'bg-white/95 text-slate-900 rounded-bl-sm dark:bg-slate-900/90 dark:text-slate-100'
                }`}
              >
                {msg.type === 'feedback' && typeof msg.score === 'number' && (
                  <p className="mb-1 text-[11px] font-semibold text-emerald-700 dark:text-emerald-200">
                    Score: {msg.score}/10
                  </p>
                )}
                <p>{msg.text}</p>
              </div>
            </div>
          ))}
          <div ref={chatEndRef} />
        </div>
      </section>

      <section className="flex flex-col gap-2 border-t border-slate-200/70 pt-3 text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400">
        <div className="flex items-center justify-between gap-3">
          <p>Hold a natural conversation. Pause briefly between answers to let the AI respond.</p>
          {isTurnInFlight && <Loader label="Evaluating answer..." />}
        </div>
        <Recorder
          onRecorded={handleRecorded}
          isDisabled={isBootstrapping || isTurnInFlight}
          maxSeconds={180}
        />
        {error && (
          <p className="mt-1 text-xs text-red-600 dark:text-red-400" role="alert">
            {error}
          </p>
        )}
      </section>
    </div>
  );
}

export default Conversation;

