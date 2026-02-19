import { useEffect, useState } from 'react';
import QuestionForm from '../components/QuestionForm.jsx';
import QuestionList from '../components/QuestionList.jsx';
import { addQuestion, deleteQuestion, getQuestions, updateQuestion } from '../services/api.js';

function Admin() {
  const [questions, setQuestions] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const loadQuestions = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await getQuestions();
      setQuestions(data);
    } catch (err) {
      const detail = err?.response?.data?.detail;
      setError(detail || 'Failed to load questions');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadQuestions();
  }, []);

  const create = async (payload) => {
    await addQuestion(payload);
    await loadQuestions();
  };

  const remove = async (id) => {
    await deleteQuestion(id);
    await loadQuestions();
  };

  const update = async (id, payload) => {
    await updateQuestion(id, payload);
    await loadQuestions();
  };

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-slate-200/70 bg-white/80 p-5 shadow-sm dark:border-slate-800 dark:bg-slate-950/70">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
          Admin Panel
        </p>
        <h2 className="mt-2 text-xl font-semibold text-slate-900 dark:text-slate-100">
          Question Management
        </h2>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
          Add curated role+difficulty questions. Interview flow uses DB first, AI as fallback.
        </p>
        <div className="mt-4">
          <QuestionForm onSubmit={create} />
        </div>
      </section>

      {error && <p className="text-sm text-red-500">{error}</p>}

      <section>
        {loading ? (
          <p className="text-sm text-slate-500">Loading questions...</p>
        ) : (
          <QuestionList questions={questions} onDelete={remove} onUpdate={update} />
        )}
      </section>
    </div>
  );
}

export default Admin;

