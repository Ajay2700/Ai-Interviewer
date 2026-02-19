function ScoreCircle({ score, confidence }) {
  const safeScore = Math.max(0, Math.min(10, score ?? 0));
  const angle = (safeScore / 10) * 360;
  const color = safeScore >= 7 ? '#10b981' : safeScore >= 4 ? '#f59e0b' : '#ef4444';
  return (
    <div className="flex items-center gap-5">
      <div className="relative h-32 w-32">
        <div
          className="absolute inset-0 rounded-full"
          style={{ background: `conic-gradient(${color} ${angle}deg, rgba(148,163,184,0.22) ${angle}deg)` }}
        />
        <div className="absolute inset-[16%] rounded-full bg-white dark:bg-slate-950" />
        <div className="relative flex h-full flex-col items-center justify-center">
          <p className="text-3xl font-semibold text-slate-900 dark:text-slate-100">{safeScore}</p>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">/ 10</p>
        </div>
      </div>
      <div className="text-sm text-slate-600 dark:text-slate-300">
        <p>Confidence: {confidence ?? 0}%</p>
      </div>
    </div>
  );
}

function Section({ title, items }) {
  return (
    <div className="rounded-2xl border border-slate-200/70 bg-white/80 p-4 dark:border-slate-800 dark:bg-slate-950/70">
      <h3 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
        {title}
      </h3>
      <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-700 dark:text-slate-200">
        {items?.map((item, idx) => <li key={`${title}-${idx}`}>{item}</li>)}
      </ul>
    </div>
  );
}

function Result({ report, onRestart }) {
  if (!report) return null;
  const latest = report.answers[report.answers.length - 1];
  const avgScore = report.answers.length
    ? Math.round((report.answers.reduce((sum, item) => sum + (item.evaluation?.score || 0), 0) / report.answers.length) * 10) / 10
    : 0;

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-slate-200/70 bg-white/80 p-5 shadow-sm dark:border-slate-800 dark:bg-slate-950/70">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
              Interview Completed
            </p>
            <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
              {report.role} - Final Verdict: {report.finalVerdict.toUpperCase()}
            </h2>
          </div>
          <button
            type="button"
            onClick={onRestart}
            className="rounded-full bg-primary-600 px-4 py-2 text-sm font-semibold text-white"
          >
            Restart Interview
          </button>
        </div>
      </div>

      <div className="grid gap-5 md:grid-cols-[1.5fr,1fr]">
        <div className="space-y-4">
          <div className="rounded-2xl border border-slate-200/70 bg-white/80 p-5 dark:border-slate-800 dark:bg-slate-950/70">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Latest feedback</h3>
            <p className="mt-2 text-sm leading-relaxed text-slate-700 dark:text-slate-200">
              {latest?.evaluation?.feedback}
            </p>
            <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
              Last verdict: {latest?.evaluation?.verdict}
            </p>
          </div>
          <Section title="Strengths" items={latest?.evaluation?.strengths || []} />
          <Section title="Weaknesses" items={latest?.evaluation?.weaknesses || []} />
          <Section title="Improvements" items={latest?.evaluation?.improvements || []} />
        </div>
        <div className="space-y-4">
          <div className="rounded-2xl border border-slate-200/70 bg-white/80 p-5 dark:border-slate-800 dark:bg-slate-950/70">
            <p className="text-xs text-slate-500 dark:text-slate-400">Average score</p>
            <ScoreCircle score={avgScore} confidence={latest?.evaluation?.confidence || 0} />
          </div>
        </div>
      </div>
    </div>
  );
}

export default Result;

