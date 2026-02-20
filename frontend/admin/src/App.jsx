import Dashboard from './pages/Dashboard.jsx';
import ManageQuestions from './pages/ManageQuestions.jsx';
import {
  getAdminToken,
  requestAdminLoginCode,
  smtpTest,
  setAdminToken,
  verifyAdminLoginCode,
} from './services/api.js';
import { useEffect, useState } from 'react';

const THEME_KEY = 'admin-ui-theme';

function getErrorDetail(err, fallback) {
  const detail = err?.response?.data?.detail;
  if (typeof detail === 'string' && detail.trim()) return detail.trim();
  const message = err?.message;
  if (typeof message === 'string' && message.trim()) return message.trim();
  return fallback;
}

function App() {
  const [darkMode, setDarkMode] = useState(() => {
    if (typeof window === 'undefined') return true;
    const stored = localStorage.getItem(THEME_KEY);
    if (stored) return stored === 'dark';
    return window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? true;
  });
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [sent, setSent] = useState(false);
  const [authError, setAuthError] = useState('');
  const [authInfo, setAuthInfo] = useState('');
  const [loading, setLoading] = useState(false);
  const [authed, setAuthed] = useState(() => !!getAdminToken());

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
      document.body.classList.add('dark');
      localStorage.setItem(THEME_KEY, 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      document.body.classList.remove('dark');
      localStorage.setItem(THEME_KEY, 'light');
    }
  }, [darkMode]);

  useEffect(() => {
    // Security requirement: logging out when leaving this page.
    const handleExit = () => {
      setAdminToken('');
    };
    window.addEventListener('beforeunload', handleExit);
    window.addEventListener('pagehide', handleExit);
    return () => {
      window.removeEventListener('beforeunload', handleExit);
      window.removeEventListener('pagehide', handleExit);
    };
  }, []);

  const sendCode = async (event) => {
    event.preventDefault();
    setLoading(true);
    setAuthError('');
    setAuthInfo('');
    try {
      await requestAdminLoginCode(email);
      setSent(true);
      setAuthInfo('Verification code sent to your email.');
    } catch (err) {
      setAuthError(getErrorDetail(err, 'Failed to send verification code.'));
    } finally {
      setLoading(false);
    }
  };

  const verifyCode = async (event) => {
    event.preventDefault();
    setLoading(true);
    setAuthError('');
    setAuthInfo('');
    try {
      const res = await verifyAdminLoginCode(email, code);
      setAdminToken(res.access_token);
      setAuthed(true);
    } catch (err) {
      setAuthError(getErrorDetail(err, 'Invalid verification code.'));
    } finally {
      setLoading(false);
    }
  };

  const runSmtpTest = async () => {
    setLoading(true);
    setAuthError('');
    setAuthInfo('');
    try {
      const res = await smtpTest(email);
      setAuthInfo(res?.message || 'SMTP test email sent successfully.');
    } catch (err) {
      setAuthError(getErrorDetail(err, 'SMTP test failed.'));
    } finally {
      setLoading(false);
    }
  };

  if (!authed) {
    return (
      <div className="relative min-h-screen overflow-hidden bg-gradient-to-br from-slate-100 via-white to-slate-100 p-6 dark:bg-gradient-to-br dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,_rgba(59,130,246,0.18),_transparent_40%),radial-gradient(circle_at_bottom_left,_rgba(99,102,241,0.18),_transparent_45%)] dark:bg-[radial-gradient(circle_at_top_right,_rgba(59,130,246,0.2),_transparent_38%),radial-gradient(circle_at_bottom_left,_rgba(99,102,241,0.16),_transparent_45%)]" />
        <div className="relative mx-auto max-w-xl space-y-4">
          <header className="rounded-3xl border border-white/70 bg-white/70 p-6 shadow-[0_20px_70px_rgba(15,23,42,0.12)] backdrop-blur-xl dark:border-slate-800/70 dark:bg-slate-900/70">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="inline-flex rounded-full bg-slate-900/5 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:bg-slate-800 dark:text-slate-300">
                  AI Interviewer Access
                </p>
                <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-900 dark:text-slate-50">AI Interviewer Admin Login</h1>
                <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                  Enter your approved admin email to receive a one-time verification code.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setDarkMode((prev) => !prev)}
                className="rounded-full border border-slate-300 bg-white/90 px-4 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-white dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
              >
                Switch to {darkMode ? 'Light' : 'Dark'}
              </button>
            </div>
          </header>

          <section className="rounded-3xl border border-white/70 bg-white/75 p-6 shadow-[0_20px_70px_rgba(15,23,42,0.12)] backdrop-blur-xl dark:border-slate-800/70 dark:bg-slate-900/75">
            <form className="space-y-4" onSubmit={sent ? verifyCode : sendCode}>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-2xl border border-slate-200 bg-white/90 px-4 py-3 text-sm text-slate-800 shadow-sm outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-200 dark:border-slate-700 dark:bg-slate-800/90 dark:text-slate-100 dark:focus:border-indigo-400 dark:focus:ring-indigo-900/50"
                placeholder="admin@company.com"
                required
                disabled={sent}
              />
              {sent && (
                <input
                  type="text"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  className="w-full rounded-2xl border border-slate-200 bg-white/90 px-4 py-3 text-sm text-slate-800 shadow-sm outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-200 dark:border-slate-700 dark:bg-slate-800/90 dark:text-slate-100 dark:focus:border-indigo-400 dark:focus:ring-indigo-900/50"
                  placeholder="Enter OTP code"
                  required
                />
              )}
              <div className="flex flex-wrap gap-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="rounded-full bg-gradient-to-r from-blue-600 to-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-blue-500/30 transition hover:opacity-95 disabled:opacity-60"
                >
                  {loading ? 'Please wait...' : sent ? 'Verify Code' : 'Send Login Code'}
                </button>
                <button
                  type="button"
                  disabled={loading || !email}
                  onClick={runSmtpTest}
                  className="rounded-full border border-slate-300 bg-white/90 px-5 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-white disabled:opacity-60 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                >
                  SMTP Test
                </button>
              </div>
              {authInfo && <p className="text-sm text-emerald-600">{authInfo}</p>}
              {authError && <p className="text-sm text-red-600">{authError}</p>}
            </form>
          </section>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-gradient-to-br from-slate-100 via-white to-slate-100 p-6 dark:bg-gradient-to-br dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,_rgba(59,130,246,0.18),_transparent_40%),radial-gradient(circle_at_bottom_left,_rgba(99,102,241,0.18),_transparent_45%)] dark:bg-[radial-gradient(circle_at_top_right,_rgba(59,130,246,0.2),_transparent_38%),radial-gradient(circle_at_bottom_left,_rgba(99,102,241,0.16),_transparent_45%)]" />
      <div className="relative mx-auto max-w-6xl space-y-5">
        <header className="rounded-3xl border border-white/70 bg-white/75 p-6 shadow-[0_20px_70px_rgba(15,23,42,0.12)] backdrop-blur-xl dark:border-slate-800/70 dark:bg-slate-900/75">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="inline-flex rounded-full bg-slate-900/5 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:bg-slate-800 dark:text-slate-300">
                Proctored Interview Platform
              </p>
              <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-900 dark:text-slate-50">AI Interviewer Admin Console</h1>
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                Secure interviewer-side question management. Candidate UI has no admin controls.
              </p>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setDarkMode((prev) => !prev)}
                className="rounded-full border border-slate-300 bg-white/90 px-4 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-white dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
              >
                Switch to {darkMode ? 'Light' : 'Dark'}
              </button>
              <button
                type="button"
                className="rounded-full border border-slate-300 bg-white/90 px-4 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-white dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                onClick={() => {
                  setAdminToken('');
                  setAuthed(false);
                  setSent(false);
                  setCode('');
                }}
              >
                Logout
              </button>
            </div>
          </div>
        </header>
        <Dashboard />
        <ManageQuestions />
      </div>
    </div>
  );
}

export default App;

