function Dashboard() {
  return (
    <section className="rounded-3xl border border-white/70 bg-white/75 p-6 shadow-[0_20px_70px_rgba(15,23,42,0.1)] backdrop-blur-xl dark:border-slate-800/70 dark:bg-slate-900/75">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-semibold tracking-tight text-slate-900 dark:text-slate-50">Interviewer Dashboard</h2>
        <div className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-900/20 dark:text-emerald-300">
          Secure Access Active
        </div>
      </div>
      <p className="mt-3 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
        Admin and candidate systems are separated to improve security and scalability. This panel is
        only for interviewer-side question management.
      </p>
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-slate-200/80 bg-white/90 p-3 dark:border-slate-700 dark:bg-slate-800/90">
          <p className="text-[11px] uppercase tracking-[0.15em] text-slate-500 dark:text-slate-400">Security</p>
          <p className="mt-1 text-sm font-semibold text-slate-800 dark:text-slate-100">Email OTP + Token</p>
        </div>
        <div className="rounded-2xl border border-slate-200/80 bg-white/90 p-3 dark:border-slate-700 dark:bg-slate-800/90">
          <p className="text-[11px] uppercase tracking-[0.15em] text-slate-500 dark:text-slate-400">Question Source</p>
          <p className="mt-1 text-sm font-semibold text-slate-800 dark:text-slate-100">Company-managed DB</p>
        </div>
        <div className="rounded-2xl border border-slate-200/80 bg-white/90 p-3 dark:border-slate-700 dark:bg-slate-800/90">
          <p className="text-[11px] uppercase tracking-[0.15em] text-slate-500 dark:text-slate-400">Flow</p>
          <p className="mt-1 text-sm font-semibold text-slate-800 dark:text-slate-100">Structured + Scalable</p>
        </div>
      </div>
    </section>
  );
}

export default Dashboard;

