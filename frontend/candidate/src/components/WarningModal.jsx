function WarningModal({ open, title = 'Suspicious activity detected', message, onClose }) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl border border-red-500/30 bg-white/90 p-5 shadow-2xl dark:bg-slate-900/95">
        <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-50">{title}</h3>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
          {message || 'Suspicious activity detected.'}
        </p>
        <div className="mt-4 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-full bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
          >
            Acknowledge
          </button>
        </div>
      </div>
    </div>
  );
}

export default WarningModal;

