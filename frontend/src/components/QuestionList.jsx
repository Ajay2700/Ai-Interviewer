import { useState } from 'react';
import QuestionForm from './QuestionForm.jsx';

function QuestionList({ questions, onDelete, onUpdate }) {
  const [editingId, setEditingId] = useState(null);

  return (
    <div className="space-y-3">
      {questions.map((item) => (
        <div
          key={item.id}
          className="rounded-2xl border border-slate-200/70 bg-white/80 p-4 shadow-sm dark:border-slate-800 dark:bg-slate-950/70"
        >
          {editingId === item.id ? (
            <QuestionForm
              initialValue={item}
              submitLabel="Update"
              onSubmit={(data) => {
                onUpdate(item.id, data);
                setEditingId(null);
              }}
              onCancel={() => setEditingId(null)}
            />
          ) : (
            <>
              <div className="mb-2 flex items-center justify-between gap-3">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
                  {item.role} • {item.difficulty}
                </p>
                <div className="flex items-center gap-2 text-xs">
                  <button
                    type="button"
                    onClick={() => setEditingId(item.id)}
                    className="rounded-full border border-slate-300 px-3 py-1 dark:border-slate-700"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => onDelete(item.id)}
                    className="rounded-full bg-red-600 px-3 py-1 text-white"
                  >
                    Delete
                  </button>
                </div>
              </div>
              <p className="text-sm text-slate-700 dark:text-slate-200">{item.question}</p>
            </>
          )}
        </div>
      ))}
      {!questions.length && (
        <p className="rounded-xl border border-dashed border-slate-300 p-4 text-sm text-slate-500 dark:border-slate-700">
          No questions added yet.
        </p>
      )}
    </div>
  );
}

export default QuestionList;

