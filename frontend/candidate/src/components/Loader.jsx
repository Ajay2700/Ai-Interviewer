function Loader({ label = 'Processing...' }) {
  return (
    <div className="flex items-center justify-center gap-2 text-sm text-slate-600 dark:text-slate-300">
      <span className="inline-flex h-4 w-4 animate-spin rounded-full border-2 border-primary-500 border-t-transparent" />
      <span>{label}</span>
    </div>
  );
}

export default Loader;

