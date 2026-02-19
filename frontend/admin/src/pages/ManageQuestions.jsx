import { useEffect, useState } from 'react';
import { addQuestion, deleteQuestion, getQuestions, updateQuestion } from '../services/api.js';

const ROLES = ['Frontend Developer', 'Backend Developer', 'Full Stack Engineer', 'AI / ML Engineer'];
const DIFFICULTIES = ['easy', 'medium', 'hard'];

function EmptyQuestion() {
  return { company: 'General', role: ROLES[0], difficulty: DIFFICULTIES[0], question: '' };
}

function ManageQuestions() {
  const [questions, setQuestions] = useState([]);
  const [form, setForm] = useState(EmptyQuestion());
  const [editingId, setEditingId] = useState(null);
  const [error, setError] = useState('');

  const load = async () => {
    setError('');
    try {
      const data = await getQuestions();
      setQuestions(data);
    } catch (err) {
      setError(err?.response?.data?.detail || 'Failed to load questions');
    }
  };

  useEffect(() => {
    load();
  }, []);

  const submit = async (e) => {
    e.preventDefault();
    if (!form.question.trim()) return;
    try {
      if (editingId) {
        await updateQuestion(editingId, form);
      } else {
        await addQuestion(form);
      }
      setEditingId(null);
      setForm(EmptyQuestion());
      await load();
    } catch (err) {
      setError(err?.response?.data?.detail || 'Failed to save question');
    }
  };

  return (
    <div className="space-y-5">
      <section className="rounded-3xl border border-white/70 bg-white/75 p-6 shadow-[0_20px_70px_rgba(15,23,42,0.1)] backdrop-blur-xl dark:border-slate-800/70 dark:bg-slate-900/75">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-xl font-semibold tracking-tight text-slate-900 dark:text-slate-50">Manage Questions</h2>
          <p className="rounded-full border border-slate-200 bg-white/90 px-3 py-1 text-xs font-semibold text-slate-600 dark:border-slate-700 dark:bg-slate-800/90 dark:text-slate-300">
            {editingId ? 'Editing Existing Question' : 'Create New Question'}
          </p>
        </div>
        <form onSubmit={submit} className="mt-4 space-y-4">
          <div className="grid gap-3 md:grid-cols-2">
            <input
              value={form.company}
              onChange={(e) => setForm((prev) => ({ ...prev, company: e.target.value }))}
              className="rounded-2xl border border-slate-200 bg-white/90 px-4 py-3 text-sm text-slate-800 shadow-sm outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-200 dark:border-slate-700 dark:bg-slate-800/90 dark:text-slate-100 dark:focus:border-indigo-400 dark:focus:ring-indigo-900/50"
              placeholder="Company (e.g. Tesla)"
            />
            <select
              value={form.role}
              onChange={(e) => setForm((prev) => ({ ...prev, role: e.target.value }))}
              className="rounded-2xl border border-slate-200 bg-white/90 px-4 py-3 text-sm text-slate-800 shadow-sm outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-200 dark:border-slate-700 dark:bg-slate-800/90 dark:text-slate-100 dark:focus:border-indigo-400 dark:focus:ring-indigo-900/50"
            >
              {ROLES.map((role) => (
                <option key={role}>{role}</option>
              ))}
            </select>
            <select
              value={form.difficulty}
              onChange={(e) => setForm((prev) => ({ ...prev, difficulty: e.target.value }))}
              className="rounded-2xl border border-slate-200 bg-white/90 px-4 py-3 text-sm text-slate-800 shadow-sm outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-200 dark:border-slate-700 dark:bg-slate-800/90 dark:text-slate-100 dark:focus:border-indigo-400 dark:focus:ring-indigo-900/50"
            >
              {DIFFICULTIES.map((difficulty) => (
                <option key={difficulty}>{difficulty}</option>
              ))}
            </select>
          </div>
          <textarea
            value={form.question}
            onChange={(e) => setForm((prev) => ({ ...prev, question: e.target.value }))}
            rows={4}
            className="w-full rounded-2xl border border-slate-200 bg-white/90 px-4 py-3 text-sm text-slate-800 shadow-sm outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-200 dark:border-slate-700 dark:bg-slate-800/90 dark:text-slate-100 dark:focus:border-indigo-400 dark:focus:ring-indigo-900/50"
            placeholder="Write interview question..."
          />
          <div className="flex flex-wrap gap-2">
            <button
              type="submit"
              className="rounded-full bg-gradient-to-r from-blue-600 to-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-blue-500/30 transition hover:opacity-95"
            >
              {editingId ? 'Update Question' : 'Add Question'}
            </button>
            {editingId && (
              <button
                type="button"
                onClick={() => {
                  setEditingId(null);
                  setForm(EmptyQuestion());
                }}
                className="rounded-full border border-slate-300 bg-white/90 px-5 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-white dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
              >
                Cancel
              </button>
            )}
          </div>
        </form>
      </section>

      {error && <p className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-900/20 dark:text-red-300">{error}</p>}

      <section className="space-y-3">
        {questions.length === 0 && (
          <div className="rounded-3xl border border-dashed border-slate-300 bg-white/70 p-8 text-center text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-300">
            No questions yet. Add your first company question above.
          </div>
        )}
        {questions.map((item) => (
          <div
            key={item.id}
            className="rounded-3xl border border-white/70 bg-white/80 p-5 shadow-[0_12px_40px_rgba(15,23,42,0.08)] backdrop-blur-xl dark:border-slate-800/70 dark:bg-slate-900/75"
          >
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                {item.company} • {item.role} • {item.difficulty}
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  className="rounded-full border border-slate-300 bg-white px-3.5 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                  onClick={() => {
                    setEditingId(item.id);
                    setForm({
                      company: item.company || 'General',
                      role: item.role,
                      difficulty: item.difficulty,
                      question: item.question,
                    });
                  }}
                >
                  Edit
                </button>
                <button
                  type="button"
                  className="rounded-full bg-red-600 px-3.5 py-1.5 text-xs font-semibold text-white transition hover:bg-red-700"
                  onClick={async () => {
                    await deleteQuestion(item.id);
                    await load();
                  }}
                >
                  Delete
                </button>
              </div>
            </div>
            <p className="mt-3 rounded-2xl border border-slate-200/80 bg-slate-50/80 p-4 text-sm leading-relaxed text-slate-700 dark:border-slate-700 dark:bg-slate-800/80 dark:text-slate-200">
              {item.question}
            </p>
          </div>
        ))}
      </section>
    </div>
  );
}

export default ManageQuestions;

