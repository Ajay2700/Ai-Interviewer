import { useEffect } from 'react';
import CameraMonitor from '../components/CameraMonitor.jsx';

function CheckItem({ ok, label }) {
  return (
    <li className="flex items-center justify-between rounded-xl border border-slate-200/70 bg-white/70 px-3 py-2 text-sm dark:border-slate-800 dark:bg-slate-900/60">
      <span className="text-slate-700 dark:text-slate-200">{label}</span>
      <span
        className={`text-xs font-semibold ${ok ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}`}
      >
        {ok ? 'PASS' : 'PENDING'}
      </span>
    </li>
  );
}

function EnvironmentCheck({ proctoring, onContinue }) {
  const { runMicCheck, micReady, faceStatus, setFaceStatus, onViolation, environmentReady } = proctoring;

  useEffect(() => {
    runMicCheck();
  }, [runMicCheck]);

  return (
    <div className="grid gap-6 md:grid-cols-[1.3fr,1fr]">
      <section className="rounded-2xl border border-slate-200/70 bg-white/80 p-5 shadow-sm backdrop-blur-sm dark:border-slate-800 dark:bg-slate-950/70">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
          Environment Check
        </p>
        <h2 className="mt-2 text-xl font-semibold tracking-tight text-slate-900 dark:text-slate-50">
          Prepare your interview setup
        </h2>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
          Camera, microphone, face visibility and basic lighting must pass before interview can start.
        </p>

        <ul className="mt-4 space-y-2">
          <CheckItem ok={faceStatus.cameraReady} label="Camera working" />
          <CheckItem ok={micReady} label="Microphone working" />
          <CheckItem ok={faceStatus.faceCount === 1} label="Single face detected" />
          <CheckItem ok={faceStatus.lightingGood} label="Good lighting" />
        </ul>

        <div className="mt-5 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={runMicCheck}
            className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
          >
            Re-check microphone
          </button>
          <button
            type="button"
            disabled={!environmentReady}
            onClick={onContinue}
            className="rounded-full bg-gradient-to-r from-primary-500 to-indigo-500 px-4 py-2 text-sm font-semibold text-white shadow-sm disabled:cursor-not-allowed disabled:opacity-50"
          >
            Continue to interview
          </button>
        </div>
      </section>

      <section className="space-y-4">
        <CameraMonitor
          active
          onStatusChange={setFaceStatus}
          onViolation={(message) => onViolation(message, { count: false })}
        />
        <div className="rounded-2xl border border-slate-200/70 bg-white/80 p-4 text-xs text-slate-600 dark:border-slate-800 dark:bg-slate-950/70 dark:text-slate-300">
          {/* Browser security limitations are unavoidable at web-app level. */}
          <p>
            Best-effort proctoring is enabled. Browsers cannot fully block extensions, OS-level screen
            recording, or all external cheating methods.
          </p>
        </div>
      </section>
    </div>
  );
}

export default EnvironmentCheck;

