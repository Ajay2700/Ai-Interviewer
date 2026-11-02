# AI Interviewer Deployment Guide

Stack: Vercel (frontend) + Render (backend) + Supabase PostgreSQL

---

## 1) Supabase — Get the Correct DATABASE_URL

> **Most common error:** `FATAL: Tenant or user not found`  
> **Cause:** The username in the pooler URL is wrong.

### Steps

1. Go to [Supabase dashboard](https://supabase.com) → your project.
2. Click **Settings → Database → Connection string → URI**.
3. Choose **Transaction pooler** (port 6543) — best for serverless/Render.
4. The URL looks like:

```
postgresql://postgres.YOURPROJECTREF:YOURPASSWORD@aws-1-ap-northeast-1.pooler.supabase.com:6543/postgres
```

5. **Critical:** The username **must** be `postgres.YOURPROJECTREF` (with the dot + project ref).  
   If you copy just `postgres` without the project ref, you get "Tenant or user not found".
6. Prefix with the SQLAlchemy driver:

```
DATABASE_URL=postgresql+psycopg2://postgres.YOURPROJECTREF:YOURPASSWORD@aws-1-ap-northeast-1.pooler.supabase.com:6543/postgres?sslmode=require
```

> **Note:** If DATABASE_URL is wrong or missing, the backend automatically falls back to SQLite  
> (ephemeral on Render — data is lost on redeploy). Fix DATABASE_URL for persistence.

---

## 2) Backend on Render

1. Create a **Web Service**.
2. Connect your GitHub repo.
3. **Root directory:** `backend`
4. **Build command:**

```bash
pip install -r requirements.txt
```

5. **Start command:**

```bash
uvicorn main:app --host 0.0.0.0 --port 10000
```

6. Add these **environment variables**:

| Variable | Value |
|---|---|
| `OPENAI_API_KEY` | Your OpenAI key |
| `DATABASE_URL` | Supabase URL from step 1 |
| `ADMIN_API_KEY` | Any secret string |
| `ADMIN_AUTH_SECRET` | Any random secret |
| `ADMIN_ALLOWED_EMAIL` | Email for admin OTP login |
| `ALLOWED_ORIGINS` | Comma-separated Vercel URLs (see step 4) |
| `SMTP_HOST` | e.g. `smtp.gmail.com` |
| `SMTP_PORT` | `587` |
| `SMTP_USER` | Your email |
| `SMTP_PASSWORD` | App password |
| `SMTP_FROM_EMAIL` | Your email |
| `DAILY_TOKENS_FREE` | `1500` |
| `DAILY_QUESTIONS_FREE` | `10` |
| `MAX_QUESTIONS_PER_INTERVIEW` | `10` |
| `REQUEST_LIMIT_PER_MINUTE` | `10` |
| `WINDOWS_BROWSER_ONLY` | `false` (set `true` only if you want Windows-only access) |
| `SEED_DEFAULT_QUESTIONS` | `true` (fills an empty question bank with 3 starter questions per role and difficulty) |

7. **Verify the backend is running:**  
   Visit `https://your-render-app.onrender.com/health` — you should see `{"status":"ok","db":"ok","db_type":"postgresql"}`.  
   If `db_type` is `sqlite`, the DATABASE_URL is wrong — check step 1 and the `db_fallback_reason` field (see Troubleshooting).

---

## 3) Frontend on Vercel

Deploy both apps:

| App | Root directory |
|---|---|
| Candidate | `frontend` |
| Admin | `frontend/admin` |

Set this env var for **each** Vercel deployment:

```
VITE_API_URL=https://your-render-app.onrender.com
```

---

## 4) CORS

In Render, set:

```
ALLOWED_ORIGINS=https://your-candidate-app.vercel.app,https://your-admin-app.vercel.app
```

If you add both apps and still get CORS errors, also add the preview URLs Vercel creates per branch.

---

## 5) Local Development

```bash
# Backend (uses SQLite automatically — no DATABASE_URL needed locally)
cd backend
pip install -r requirements.txt
uvicorn main:app --reload --port 8010

# Frontend (proxies /api to localhost:8010 automatically)
cd frontend
npm install
npm run dev
```

Open `http://localhost:5173`.

---

## 6) Production Notes

- Token + question limits control OpenAI costs.
- Rate limiting blocks request spikes/abuse.
- The backend falls back to SQLite if PostgreSQL is unavailable — useful as a safety net but not a substitute for a real DB in production.
- An empty question bank is seeded with starter questions on startup, so Company and Hybrid modes work without calling OpenAI for questions. Admin-curated banks are never touched.
- For high traffic: replace in-memory AI cache with Redis, add a worker queue (Celery/RQ).

---

## 7) Troubleshooting

`/health` reports why the backend's two outside dependencies are failing:

| `/health` shows | What candidates see | Cause | Fix |
|---|---|---|---|
| `"ai_last_error": "billing_not_active"` or `"insufficient_quota"` | "AI … is temporarily unavailable" (HTTP 503) | The OpenAI account has no active billing or credits | Add a payment method or credits at platform.openai.com → Settings → Billing, then retry. No redeploy needed. |
| `"ai_last_error": "invalid_api_key"` or `"missing_api_key"` | Same 503 message | `OPENAI_API_KEY` in Render is wrong or unset | Set a valid key in Render → Environment; Render redeploys automatically |
| `"db_type": "sqlite"` with `"db_fallback_reason": "auth_failed"` | Works, but data resets on every deploy | Supabase rejected the login: wrong pooler username/password, or the project is paused/deleted | Restore the project in Supabase (free projects pause after a week of inactivity) or create a new one, then update `DATABASE_URL` (step 1) |
| `"db_fallback_reason": "host_not_found"` or `"unreachable"` | Same as above | Wrong host in `DATABASE_URL`, or the project no longer exists | Copy the connection string again from Supabase (step 1) |

`ai_last_error` clears itself after the next successful OpenAI call.
