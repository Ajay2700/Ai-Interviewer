# AI Interviewer Deployment Guide

This guide deploys the stack with low-cost free tiers:

- Frontend (candidate/admin): Vercel
- Backend API: Render
- Database: Supabase PostgreSQL

## 1) Prepare Environment Variables

Copy values from `backend/env.example` into your Render environment variables.

Minimum required:

- `OPENAI_API_KEY`
- `DATABASE_URL` (Supabase connection string)
- `ADMIN_API_KEY`
- `ADMIN_AUTH_SECRET`
- `ADMIN_ALLOWED_EMAIL` (email allowed to receive OTP and login)
- `ALLOWED_ORIGINS` (comma separated deployed frontend URLs)
- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_USER`
- `SMTP_PASSWORD`
- `SMTP_FROM_EMAIL`

For cost controls:

- `DAILY_TOKENS_FREE=1500`
- `DAILY_QUESTIONS_FREE=10`
- `MAX_QUESTIONS_PER_INTERVIEW=10`
- `MAX_AI_QUESTIONS_PER_INTERVIEW=5`
- `NEXT_QUESTION_COOLDOWN_SECONDS=5`
- `REQUEST_LIMIT_PER_MINUTE=10`
- `WINDOWS_BROWSER_ONLY=true` (enforce Windows desktop browser only)

## 2) Supabase / PostgreSQL

1. Create a Supabase project.
2. Copy the connection URL and set `DATABASE_URL` in Render.
3. Start backend once; SQLAlchemy creates tables automatically.

## 3) Backend on Render

1. Create a new **Web Service**.
2. Connect your GitHub repo.
3. Root directory: `backend`
4. Build command:

```bash
pip install -r requirements.txt
```

5. Start command:

```bash
uvicorn main:app --host 0.0.0.0 --port 10000
```

6. Add environment variables from step 1.

## 4) Frontend on Vercel

Deploy both frontend apps:

- Candidate app root: `frontend`
- Admin app root: `frontend/admin`

Set env var for each:

- `VITE_API_URL=https://your-render-backend.onrender.com`

## 5) CORS

Set backend:

- `ALLOWED_ORIGINS=https://candidate-app.vercel.app,https://admin-app.vercel.app`

## 6) Production Notes

- Token limits and question limits control OpenAI costs.
- Rate limiting blocks request spikes/abuse.
- SQLAlchemy + PostgreSQL enables horizontal backend scaling.
- For 1M users, replace in-memory AI cache with Redis and add worker queue (Celery/RQ).
