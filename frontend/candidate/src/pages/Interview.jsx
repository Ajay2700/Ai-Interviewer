import { useMemo, useState } from 'react';
import Recorder from '../components/Recorder.jsx';
import Loader from '../components/Loader.jsx';
import CameraMonitor from '../components/CameraMonitor.jsx';

function Interview({
  role,
  setRole,
  roles,
  difficulty,
  setDifficulty,
  question,
  questionIndex,
  totalQuestions,
  timerLeft,
  onStartInterview,
  onSubmitAudio,
  onSkipQuestion,
  evaluating,
  proctoring,
  currentState,
}) {
  const [audioBlob, setAudioBlob] = useState(null);
  const [localError, setLocalError] = useState('');
  const { violations, faceStatus, setFaceStatus, onViolation, terminationThreshold } = proctoring;

  const timerColor = useMemo(() => {
    if (timerLeft <= 20) return 'text-red-500';
    if (timerLeft <= 40) return 'text-amber-500';
    return 'text-emerald-500';
  }, [timerLeft]);

  const submit = async () => {
    if (!audioBlob) {
      setLocalError('Record an answer or use "Skip to next question".');
      return;
    }
    setLocalError('');
    await onSubmitAudio(audioBlob);
    setAudioBlob(null);
  };

  if (currentState === 'ready') {
    return (
      <div className="space-y-6">
        <div className="rounded-2xl border border-slate-200/70 bg-white/80 p-6 text-center shadow-sm backdrop-blur-sm dark:border-slate-800 dark:bg-slate-950/70">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
            Ready State
          </p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-50">
            Immersive interview mode
          </h2>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
            Fullscreen, anti-cheating checks, and strict sequential evaluation are enabled.
          </p>
          <div className="mt-5 flex items-center justify-center gap-3">
            <select
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
            >
              {roles.map((item) => (
                <option key={item}>{item}</option>
              ))}
            </select>
            <select
              value={difficulty}
              onChange={(e) => setDifficulty(e.target.value)}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
            >
              <option value="easy">easy</option>
              <option value="medium">medium</option>
              <option value="hard">hard</option>
            </select>
            <button
              type="button"
              onClick={onStartInterview}
              className="rounded-full bg-gradient-to-r from-primary-500 to-indigo-500 px-4 py-2 text-sm font-semibold text-white"
            >
              Start Interview
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative space-y-5">
      <div className="absolute right-0 top-0 z-20 w-44 sm:w-52 md:w-56">
        <div className="rounded-2xl border border-slate-200/70 bg-white/85 p-2 shadow-lg backdrop-blur-sm dark:border-slate-700 dark:bg-slate-950/80">
          <CameraMonitor active onStatusChange={setFaceStatus} onViolation={onViolation} />
          <div className="mt-2 rounded-xl border border-slate-200/70 bg-white/70 p-2 text-[11px] dark:border-slate-800 dark:bg-slate-900/70">
            <p className="font-semibold text-slate-900 dark:text-slate-100">Proctoring</p>
            <ul className="mt-1 space-y-0.5 text-slate-600 dark:text-slate-300">
              <li>Violations: {violations} / {terminationThreshold}</li>
              <li>Face: {faceStatus.faceCount}</li>
              <li>Away: {faceStatus.lookingAway ? 'Yes' : 'No'}</li>
            </ul>
          </div>
        </div>
      </div>

      <div className="grid gap-5">
        <section className="rounded-2xl border border-slate-200/70 bg-white/80 p-6 pr-6 shadow-sm backdrop-blur-sm dark:border-slate-800 dark:bg-slate-950/70 md:pr-64">
          <div className="mb-4 flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
              Question {questionIndex + 1} / {totalQuestions}
            </p>
            <p className={`text-sm font-semibold ${timerColor}`}>Time left: {timerLeft}s</p>
          </div>
          <p className="rounded-2xl border border-slate-200/80 bg-slate-50/80 p-5 text-lg leading-relaxed text-slate-800 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-100">
            {question || 'Loading question...'}
          </p>

          <div className="mt-6 flex flex-col items-center gap-4">
            <Recorder
              isDisabled={evaluating || !question}
              onRecorded={setAudioBlob}
              maxSeconds={120}
            />
            <button
              type="button"
              disabled={evaluating}
              onClick={submit}
              className="rounded-full bg-emerald-600 px-5 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              {evaluating ? <Loader label="Evaluating..." /> : 'Submit Mandatory Answer'}
            </button>
            <button
              type="button"
              disabled={evaluating}
              onClick={onSkipQuestion}
              className="rounded-full border border-slate-300 bg-white px-5 py-2 text-sm font-semibold text-slate-700 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
            >
              Skip to next question
            </button>
            {localError && <p className="text-sm text-red-500">{localError}</p>}
          </div>
        </section>
      </div>
    </div>
  );
}

export default Interview;

