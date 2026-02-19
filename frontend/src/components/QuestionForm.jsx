import { useState } from 'react';

const ROLES = ['Frontend Developer', 'Backend Developer', 'Full Stack Engineer', 'AI / ML Engineer'];
const DIFFICULTIES = ['easy', 'medium', 'hard'];

function QuestionForm({ onSubmit, initialValue, submitLabel = 'Add Question', onCancel }) {
  const [form, setForm] = useState(
    initialValue || { role: ROLES[0], difficulty: DIFFICULTIES[0], question: '' },
  );

  const submit = (e) => {
    e.preventDefault();
    if (!form.question.trim()) return;
    onSubmit({ ...form, question: form.question.trim() });
    if (!initialValue) {
      setForm({ role: ROLES[0], difficulty: DIFFICULTIES[0], question: '' });
    }
  };

  return (
    <form onSubmit={submit} className="space-y-3">
      <div className="grid gap-3 md:grid-cols-2">
        <select
          value={form.role}
          onChange={(e) => setForm((prev) => ({ ...prev, role: e.target.value }))}
          className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
        >
          {ROLES.map((role) => (
            <option key={role}>{role}</option>
          ))}
        </select>
        <select
          value={form.difficulty}
          onChange={(e) => setForm((prev) => ({ ...prev, difficulty: e.target.value }))}
          className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
        >
          {DIFFICULTIES.map((difficulty) => (
            <option key={difficulty}>{difficulty}</option>
          ))}
        </select>
      </div>
      <textarea
        value={form.question}
        onChange={(e) => setForm((prev) => ({ ...prev, question: e.target.value }))}
        placeholder="Enter interview question..."
        rows={4}
        className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
      />
      <div className="flex items-center gap-2">
        <button
          type="submit"
          className="rounded-full bg-primary-600 px-4 py-2 text-sm font-semibold text-white"
        >
          {submitLabel}
        </button>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="rounded-full border border-slate-300 px-4 py-2 text-sm dark:border-slate-700"
          >
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}

export default QuestionForm;

