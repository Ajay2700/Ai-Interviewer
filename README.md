# AI Interviewer

> **Production-grade AI-powered technical interview platform with voice capture, real-time proctoring, deterministic AI evaluation, and full admin control — deployed on Vercel + Render + Supabase.**

<p align="left">
  <img src="https://img.shields.io/badge/Python-3.11-blue?logo=python" alt="Python 3.11"/>
  <img src="https://img.shields.io/badge/FastAPI-0.115-green?logo=fastapi" alt="FastAPI"/>
  <img src="https://img.shields.io/badge/React-18-61DAFB?logo=react" alt="React 18"/>
  <img src="https://img.shields.io/badge/OpenAI-GPT--4o--mini-412991?logo=openai" alt="OpenAI"/>
  <img src="https://img.shields.io/badge/PostgreSQL-Supabase-3ECF8E?logo=supabase" alt="Supabase"/>
  <img src="https://img.shields.io/badge/Deployed-Render%20%2B%20Vercel-brightgreen" alt="Deployed"/>
</p>

---

## Live Demo

| Service | URL |
|---|---|
| Candidate App | https://ai-interviewer-theta-tan.vercel.app/ |
| Admin Console | https://ai-interviewer-onoh.vercel.app/ |
| Backend API Docs | https://ai-interviewer-4po6.onrender.com/docs |
| Health Check | https://ai-interviewer-4po6.onrender.com/health |

---

## Screenshots

<img width="1881" alt="Ready State" src="https://github.com/user-attachments/assets/8a4da277-e421-4df1-afe7-99adceefb3ee" />
<img width="1901" alt="Interview Active" src="https://github.com/user-attachments/assets/56166ded-a2a2-487d-85a2-a72337223cb0" />
<img width="1889" alt="Evaluation Results" src="https://github.com/user-attachments/assets/78fe153c-fa50-49f4-bb0f-f777c3c66e97" />
<img width="1889" alt="Admin Console" src="https://github.com/user-attachments/assets/393a9831-0de6-4208-b94a-746caba2cd98" />
<img width="1896" alt="Proctoring Panel" src="https://github.com/user-attachments/assets/32a03667-b647-4db0-8994-c479502d34b5" />

---
## MINDMAP

<img width="3136" height="8136" alt="NotebookLM Mind Map" src="https://github.com/user-attachments/assets/6e92075a-f452-41ac-9c75-944c51dbcc79" />


## Table of Contents

- [Features](#features)
- [Overall Architecture](#overall-architecture)
- [Data Model](#data-model)
- [API Reference](#api-reference)
- [AI Pipeline](#ai-pipeline)
- [Interview State Machine](#interview-state-machine)
- [Proctoring System](#proctoring-system)
- [Security & Cost Controls](#security--cost-controls)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Local Development](#local-development)
- [Environment Variables](#environment-variables)
- [Production Deployment](#production-deployment)
- [Resilience & Observability](#resilience--observability)
- [Roadmap](#roadmap)

---

## Features

| Category | Capability |
|---|---|
| **Interview Modes** | Company-only, AI-only, Hybrid (DB-first + AI follow-ups) |
| **Question Bank** | Admin-managed curated Q&A with company, role, difficulty tagging |
| **Voice Capture** | Browser MediaRecorder API → WebM audio → Whisper transcription |
| **AI Evaluation** | Deterministic rubric scoring (0–10), verdict, strengths, weaknesses, feedback |
| **Proctoring** | Face detection, gaze tracking, tab-switch, blur, shortcut blocking, fullscreen enforcement |
| **Usage Control** | Daily token + question quotas, per-session caps, request rate limiting |
| **Admin Panel** | OTP email login, signed token auth, question CRUD |
| **Resilience** | SQLite automatic fallback if PostgreSQL is unavailable |
| **Observability** | Structured logging, `/health` endpoint, proctoring JSONL audit log |

---

## Overall Architecture

```
+--------------------------------------------------------------------------+
|                         BROWSER (Client Layer)                           |
|                                                                          |
|  +------------------------------+   +----------------------------------+ |
|  |     Candidate App            |   |         Admin Console            | |
|  |  React + Vite + Tailwind     |   |   React + Vite + Tailwind        | |
|  |                              |   |                                  | |
|  |  * EnvironmentCheck          |   |  * OTP Login Flow                | |
|  |  * CameraMonitor (MediaPipe) |   |  * Question CRUD Dashboard       | |
|  |  * useFaceTracking           |   |  * SMTP Test Utility             | |
|  |  * useProctoring             |   |                                  | |
|  |  * useFullscreen             |   |  Auth: Email OTP -> Bearer Token | |
|  |  * Recorder (WebM audio)     |   |                                  | |
|  |  * Interview state machine   |   |                                  | |
|  +---------------+--------------+   +------------------+---------------+ |
+------------------|-----------------------------------------|-------------+
                   | HTTPS/REST (Axios)                       | HTTPS/REST
                   v                                          v
+--------------------------------------------------------------------------+
|                    BACKEND API (FastAPI on Render)                       |
|                                                                          |
|  +--------------------------------------------------------------------+  |
|  |                     HTTP Middleware Stack                          |  |
|  |  Rate Limiter (per-user/IP, 60 s window, RequestLog table)        |  |
|  |  CORS Guard (explicit allowed origins from env)                   |  |
|  +-------------------------+------------------------------------------+  |
|                            |                                             |
|           +----------------+----------------+                           |
|           v                                 v                           |
|  +------------------+           +----------------------+               |
|  |  Candidate Router|           |    Admin Router      |               |
|  |  /api/interview/ |           |    /api/admin/       |               |
|  |                  |           |                      |               |
|  |  GET  /start     |           |  POST /auth/request- |               |
|  |  POST /next      |           |       code           |               |
|  |  POST /answer    |           |  POST /auth/verify-  |               |
|  |  GET  /usage     |           |       code           |               |
|  |  POST /proctor-  |           |  GET  /questions     |               |
|  |       log        |           |  POST /question      |               |
|  +--------+---------+           |  PUT  /question/:id  |               |
|           |                    |  DELETE /question/:id|               |
|           |                    +----------------------+               |
|           |                                                             |
|  +--------v------------------------------------------------------------+  |
|  |                       Service Layer                                 |  |
|  |                                                                     |  |
|  |  +-----------------+  +----------------+  +------------------+     |  |
|  |  | openai_service  |  | usage_service  |  | question_service |     |  |
|  |  |                 |  |                |  |                  |     |  |
|  |  | generate_ai_    |  | ensure_user()  |  | get_company_     |     |  |
|  |  | question()      |  | check_token_   |  | questions()      |     |  |
|  |  |                 |  | limit()        |  |                  |     |  |
|  |  | generate_       |  | check_question_|  | create/update/   |     |  |
|  |  | followup_       |  | limit()        |  | delete/list      |     |  |
|  |  | question()      |  |                |  |                  |     |  |
|  |  |                 |  | increment_     |  +------------------+     |  |
|  |  | evaluate_       |  | question_      |                           |  |
|  |  | answer()        |  | usage()        |  +------------------+     |  |
|  |  |                 |  |                |  | speech_service   |     |  |
|  |  | In-memory TTL   |  | Session CRUD:  |  |                  |     |  |
|  |  | question cache  |  | create/        |  | transcribe_      |     |  |
|  |  | (180s)          |  | validate/      |  | audio()          |     |  |
|  |  |                 |  | advance/       |  | (Whisper API)    |     |  |
|  |  |                 |  | enforce        |  |                  |     |  |
|  |  +--------+--------+  +-------+--------+  +--------+---------+     |  |
|  +------------|-------------------|----------------------|-------------+  |
+---------------|-------------------|----------------------|--------------+
                |                   |                      |
                v                   v                      v
+-------------------+  +---------------------+  +----------------------+
|   OpenAI Platform |  | PostgreSQL (Supabase|  |  Whisper API (OpenAI)|
|                   |  | or SQLite fallback) |  |                      |
|  gpt-4o-mini      |  |                     |  |  whisper-1 model     |
|  * Question gen   |  |  Tables:            |  |  Audio -> text       |
|  * Answer eval    |  |  * users            |  |  Max 5 MB upload     |
|  * Follow-up gen  |  |  * questions        |  |  WebM / MP3 / WAV    |
|                   |  |  * interview_       |  |                      |
|  Token tracking   |  |    sessions         |  +----------------------+
|  per request      |  |  * usage_logs       |
+-------------------+  |  * request_logs     |
                        +---------------------+
```

### Request Lifecycle — Start Interview

```
Browser                  FastAPI                      OpenAI / DB
  |                          |                              |
  |-- GET /api/interview/    |                              |
  |   start?user_id&role&    |                              |
  |   difficulty&mode ------>|                              |
  |                          |-- Rate limit check           |
  |                          |   (RequestLog table) ------->|
  |                          |-- check_question_limit()     |
  |                          |   (users table) ------------>|
  |                          |-- get_company_questions()    |
  |                          |   (questions table) -------->|
  |                          |                              |
  |                          |-- [hybrid/ai mode]           |
  |                          |   generate_ai_question()     |
  |                          |   (gpt-4o-mini, cached 3m)->|
  |                          |                              |
  |                          |-- create_or_reset_session()  |
  |                          |   (interview_sessions) ----->|
  |                          |-- increment_question_usage() |
  |                          |   (users table) ------------>|
  |<-- InterviewStartResponse|                              |
  |    {session_id, question,|                              |
  |     mode, source, index} |                              |
```

### Request Lifecycle — Submit Answer

```
Browser                  FastAPI                      OpenAI
  |                          |                              |
  |-- POST /api/interview/   |                              |
  |   answer (multipart) --->|                              |
  |   audio, question,       |                              |
  |   user_id                |                              |
  |                          |-- validate file type         |
  |                          |-- write temp file            |
  |                          |-- transcribe_audio() ------->|
  |                          |   (Whisper API)              |
  |                          |<-- transcript text ----------|
  |                          |-- evaluate_answer() -------->|
  |                          |   (gpt-4o-mini, rubric)      |
  |                          |<-- JSON evaluation ----------|
  |                          |-- update_usage()             |
  |                          |   (token tracking) --------->|
  |<-- AnswerResponse -------|                              |
  |    {transcript,          |                              |
  |     evaluation}          |                              |
```

---

## Data Model

```
+----------------------+     +---------------------------+
|        users         |     |        questions          |
+----------------------+     +---------------------------+
| id          VARCHAR  |     | id            SERIAL PK   |
| created_at  DATETIME |     | company       VARCHAR      |
| plan        VARCHAR  |     | role          VARCHAR      |
| total_tokens_used INT|     | difficulty    VARCHAR      |
| daily_tokens_used INT|     | question      TEXT         |
| daily_questions_  INT|     | created_at    DATETIME     |
|   used              |     +---------------------------+
| questions_        INT|
|   attempted         |     +---------------------------+
| last_usage_day  STR |     |    interview_sessions     |
+----------------------+     +---------------------------+
                             | session_id   VARCHAR PK   |
+----------------------+     | user_id      VARCHAR      |
|      usage_logs      |     | role         VARCHAR      |
+----------------------+     | difficulty   VARCHAR      |
| id           SERIAL  |     | mode         VARCHAR      |
| user_id      VARCHAR |     | question_index  INT       |
| tokens_used  INT     |     | ai_questions_used INT     |
| endpoint     VARCHAR |     | status       VARCHAR      |
| timestamp    DATETIME|     | last_question_at DATETIME |
+----------------------+     | created_at   DATETIME     |
                             +---------------------------+
+----------------------+
|     request_logs     |     Daily reset logic:
+----------------------+     daily_tokens_used and
| id           SERIAL  |     daily_questions_used reset
| requester_key VARCHAR|     automatically at midnight UTC
| endpoint     VARCHAR |     via _reset_daily_if_needed()
| timestamp    DATETIME|     called on every usage check.
+----------------------+
```

---

## API Reference

### Candidate Endpoints

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/api/interview/start` | — | Start interview, returns first question |
| `POST` | `/api/interview/next` | — | Submit answer context, get next question |
| `POST` | `/api/interview/answer` | — | Upload audio → transcript + evaluation |
| `GET` | `/api/interview/usage` | — | Get daily quota status for a user |
| `POST` | `/api/interview/proctor-log` | — | Persist proctoring event log |

### Admin Endpoints

| Method | Path | Auth | Description |
|---|---|---|---|
| `POST` | `/api/admin/auth/request-code` | — | Send OTP to allowed admin email |
| `POST` | `/api/admin/auth/verify-code` | — | Verify OTP → issue bearer token |
| `POST` | `/api/admin/auth/smtp-test` | API Key header | Test SMTP/Resend connectivity |
| `GET` | `/api/admin/questions` | Bearer token | List all questions |
| `POST` | `/api/admin/question` | Bearer token | Create question |
| `PUT` | `/api/admin/question/:id` | Bearer token | Update question |
| `DELETE` | `/api/admin/question/:id` | Bearer token | Delete question |

### System

| Method | Path | Description |
|---|---|---|
| `GET` | `/health` | Returns `{status, db, db_type}` |
| `GET` | `/docs` | Swagger UI (FastAPI auto-generated) |

---

## AI Pipeline

### Question Generation

```
Input:  role, difficulty
         |
         v
Check in-memory TTL cache (180 s per role+difficulty key)
         |
     [cache hit] -----------------------> return cached question
         |
     [cache miss]
         |
         v
gpt-4o-mini call
  system: "You generate concise technical interview questions."
  user:   "Generate one {difficulty} question for {role}.
           Return only the question."
  temperature: 0.3  |  max_tokens: 150
         |
         v
Store in cache -> return question
```

### Answer Evaluation

```
Input:  question (str), transcript (str)
         |
         v
gpt-4o-mini with deterministic EVALUATION_PROMPT rubric
  JSON output enforced:
    {
      score:        0-10   (FAANG-style strict grading)
      confidence:   0-100  (model confidence in rating)
      strengths:    [str]  (what was good)
      weaknesses:   [str]  (what was missing)
      improvements: [str]  (actionable next steps)
      verdict:      "pass" | "fail"
      feedback:     detailed explanation
    }

  Scoring guidance:
    0-3  : weak, incorrect, vague, or irrelevant
    4-6  : partially correct but missing depth/precision
    7-8  : solid and mostly complete with minor gaps
    9-10 : highly accurate, complete, and clear
         |
         v
Token usage tracked -> update_usage() persisted to DB
```

### Conversation Follow-up (AI / Hybrid mode)

```
Input:  previous_question, user_answer, role, history[]
         |
         v
CONVERSATION_FOLLOWUP_PROMPT
  Full interview history for context
  Constraints: ONE question, no answer hints, role-scoped
         |
         v
gpt-4o-mini -> next contextual question
```

### Audio Transcription (Whisper)

```
Browser WebM audio (<= 5 MB)
         |
         v
POST /api/interview/answer (multipart/form-data)
         |
         v
File type + size validation
         |
         v
Write to tmp_uploads/ (UUID filename)
         |
         v
OpenAI Whisper API (whisper-1, response_format="text")
         |
         v
Temp file deleted -> transcript string returned
```

---

## Interview State Machine

```
          +------------------+
          | environment_check| <-- Initial state
          +--------+---------+
                   |  Camera + mic pass
                   v
          +------------------+
          |      ready       | <-- User selects role/difficulty/mode
          +--------+---------+
                   |  "Start Interview" -> API /start
                   v
          +------------------+
     +--> |   interviewing   | <-- Question displayed, timer running
     |    +--------+---------+
     |             |  Audio recorded -> Submit
     |             v
     |    +------------------+
     |    |   evaluating     | <-- Whisper + GPT processing
     |    +--------+---------+
     |             |  Result received
     |             |
     |    more questions?
     |      YES ---+ (-> API /next -> back to interviewing)
     |      NO  ------------------------------------------------->
     |                                                            |
     |                                               +-----------v------+
     |                                               |    completed     |
     |                                               +------------------+
     |
     violation threshold (10) hit at any state
     OR user exits
     |
     +---------------------------------------------------> completed
                                                           (terminated=true)
```

---

## Proctoring System

The proctoring layer runs entirely in the browser using **MediaPipe Face Mesh** (loaded from CDN).

```
CameraMonitor component
         |
         v
useFaceTracking hook (MediaPipe Face Mesh)
    * 468 facial landmarks detected per frame
    * maxNumFaces: 2  (to detect multiple people)
    * refineLandmarks: true  (enables iris tracking)
    |
    +-- Face presence check
    |     faceCount === 0  ->  violation: "Face not detected"
    |     faceCount > 1   ->  violation: "Multiple faces detected"
    |
    +-- Gaze / head turn detection
    |     Iris center vs eye center offset (x, y)
    |     Head turn: nose vs face center X delta > 0.08
    |     Sustained away > 2000 ms -> violation logged
    |
    +-- Blink rate monitoring
    |     EAR (Eye Aspect Ratio) < 0.2 -> blink
    |     > 30 blinks in 60 s -> suspicious
    |
    +-- Lighting check
          Frame brightness average from 80x60 canvas sample
          avg < 45/255 -> lightingGood = false (warning, not blocker)

useProctoring hook (behavioral layer)
    +-- Tab visibility change  ->  violation
    +-- Window blur            ->  violation
    +-- Right-click blocked    ->  violation
    +-- Copy / paste / cut     ->  violation
    +-- F12, Ctrl+Shift+I/J/C  ->  violation
    +-- Ctrl+C/V/X/U           ->  violation
    +-- isExtendedScreen       ->  violation (15 s check)

useFullscreen hook
    +-- Exits fullscreen during interview -> violation

Termination threshold: 10 violations
    -> state = completed + terminated = true
    -> proctoring log uploaded to /api/interview/proctor-log
    -> stored as JSONL: logs/proctoring/<candidate_id>.jsonl
```

---

## Security & Cost Controls

### Usage Limits (configurable via env)

| Control | Default | Env Var |
|---|---|---|
| Daily tokens per user | 1,500 | `DAILY_TOKENS_FREE` |
| Daily questions per user | 10 | `DAILY_QUESTIONS_FREE` |
| Questions per interview session | 10 | `MAX_QUESTIONS_PER_INTERVIEW` |
| AI follow-ups per session | 5 | `MAX_AI_QUESTIONS_PER_INTERVIEW` |
| Cooldown between questions | 5 s | `NEXT_QUESTION_COOLDOWN_SECONDS` |
| API requests per minute (per user/IP) | 10 | `REQUEST_LIMIT_PER_MINUTE` |
| Max audio upload size | 5 MB | `MAX_AUDIO_UPLOAD_BYTES` |

### Authentication

| Surface | Mechanism |
|---|---|
| Admin login | Email OTP → HMAC-SHA256 signed bearer token (1 h TTL) |
| Admin API calls | `Authorization: Bearer <token>` header verified on every request |
| Admin local dev | Static API key fallback (`ALLOW_ADMIN_KEY_FALLBACK=true`) |
| Candidate access | Anonymous `user_id` (UUID stored in localStorage) |
| Windows-only enforcement | User-Agent + `sec-ch-ua-platform` header check (optional) |

### CORS & Network

- Explicit `ALLOWED_ORIGINS` list — no wildcard in production.
- All origins must be HTTPS in production.
- Rate limiting via database-backed `request_logs` (no Redis required).

---

## Tech Stack

### Frontend

| Technology | Purpose |
|---|---|
| React 18 + Vite | Component framework and dev tooling |
| Tailwind CSS | Utility-first styling |
| Axios | HTTP client |
| MediaPipe Face Mesh | Real-time facial landmark detection (468 points) |
| MediaRecorder API | Browser-native WebM audio capture |
| Browser Fullscreen API | Fullscreen enforcement for proctoring |

### Backend

| Technology | Purpose |
|---|---|
| FastAPI 0.115 | Async REST API framework |
| Python 3.11 | Runtime |
| SQLAlchemy 2.0 | ORM with declarative models |
| Pydantic v2 | Request/response validation |
| psycopg2-binary | PostgreSQL driver |
| python-multipart | Multipart form (audio upload) |
| uvicorn[standard] | ASGI server |
| httpx | Async HTTP client (Resend email fallback) |

### AI Services

| Service | Model | Purpose |
|---|---|---|
| OpenAI | `gpt-4o-mini` | Question generation, answer evaluation, follow-ups |
| OpenAI | `whisper-1` | Speech-to-text transcription |

### Infrastructure

| Service | Role |
|---|---|
| Supabase (PostgreSQL) | Primary persistent database |
| SQLite | Automatic local/fallback database |
| Vercel | Candidate + admin frontend hosting |
| Render | Backend API hosting |
| Gmail SMTP / Resend | Admin OTP email delivery |

---

## Project Structure

```
Ai-Interviewer/
|
+-- backend/                          # FastAPI application
|   +-- api/
|   |   +-- admin/
|   |   |   +-- routes.py             # Admin CRUD + auth endpoints
|   |   +-- candidate/
|   |       +-- routes.py             # Interview + proctoring endpoints
|   +-- core/
|   |   +-- config.py                 # Settings dataclass (env-driven)
|   |   +-- database.py               # SQLAlchemy engine, models, init_db()
|   +-- models/
|   |   +-- schemas.py                # Pydantic request/response schemas
|   +-- services/
|   |   +-- admin_auth_service.py     # OTP generation, email, token signing
|   |   +-- openai_service.py         # GPT question gen + evaluation
|   |   +-- question_service.py       # DB question CRUD
|   |   +-- speech_service.py         # Whisper transcription
|   |   +-- usage_service.py          # Quota tracking, session management
|   +-- utils/
|   |   +-- prompts.py                # All LLM prompt templates
|   +-- logs/
|   |   +-- proctoring/               # Per-candidate JSONL audit logs
|   +-- env.example                   # All env vars documented
|   +-- requirements.txt              # Pinned Python dependencies
|   +-- runtime.txt                   # Python version for Render
|   +-- main.py                       # App factory, CORS, middleware, health
|
+-- frontend/                         # Candidate React app
|   +-- src/
|       +-- components/
|       |   +-- CameraMonitor.jsx     # Camera feed + MediaPipe overlay
|       |   +-- Recorder.jsx          # Audio recording UI
|       |   +-- Loader.jsx            # Spinner component
|       +-- hooks/
|       |   +-- useFaceTracking.js    # MediaPipe Face Mesh + EAR/gaze
|       |   +-- useProctoring.js      # Behavioral violation tracking
|       |   +-- useFullscreen.js      # Fullscreen request + change events
|       +-- pages/
|       |   +-- EnvironmentCheck.jsx  # Pre-interview camera/mic setup
|       |   +-- Interview.jsx         # Question display + recording UI
|       |   +-- Result.jsx            # Final score report
|       +-- services/
|       |   +-- api.js                # Axios client + all API calls
|       +-- App.jsx                   # Root state machine + routing
|
+-- frontend/admin/                   # Admin console React app
|   +-- src/
|       +-- pages/
|       |   +-- Dashboard.jsx         # Stats overview
|       |   +-- ManageQuestions.jsx   # Question CRUD table
|       +-- services/
|       |   +-- api.js                # Admin API client + token management
|       +-- App.jsx                   # OTP login + admin layout
|
+-- DEPLOYMENT.md                     # Step-by-step production guide
+-- package.json                      # Root dev scripts
+-- README.md
```

---

## Local Development

### Prerequisites

- Python 3.11+
- Node.js 18+
- An OpenAI API key

No database setup needed locally — SQLite is used automatically when `DATABASE_URL` is not set.

### 1. Clone

```bash
git clone https://github.com/Ajay2700/Ai-Interviewer.git
cd Ai-Interviewer
```

### 2. Backend

```bash
cd backend
python -m venv .venv

# Windows PowerShell
.\.venv\Scripts\Activate.ps1

# macOS / Linux
source .venv/bin/activate

pip install -r requirements.txt
```

Create `backend/.env`:

```env
OPENAI_API_KEY=sk-...
# Leave DATABASE_URL blank to auto-use SQLite
ADMIN_API_KEY=localdev123
ADMIN_AUTH_SECRET=any-random-32-char-secret
ADMIN_ALLOWED_EMAIL=you@example.com
ALLOW_ADMIN_KEY_FALLBACK=true
WINDOWS_BROWSER_ONLY=false
```

Start the backend:

```bash
uvicorn main:app --reload --port 8010
# Swagger UI: http://localhost:8010/docs
# Health:     http://localhost:8010/health
```

### 3. Candidate Frontend

```bash
cd frontend
npm install
npm run dev
# http://localhost:5173
```

### 4. Admin Frontend

```bash
cd frontend/admin
npm install
npm run dev
# http://localhost:5174
```

The Vite dev server proxies all `/api` requests to `http://127.0.0.1:8010` automatically — no extra config needed.

---

## Environment Variables

### Backend (`backend/.env`)

```env
# ── Required ────────────────────────────────────────────────────────────────
OPENAI_API_KEY=sk-...

# PostgreSQL (Supabase transaction pooler)
# Username MUST be postgres.<project-ref> (not just postgres) for pooler port 6543
# Leave blank to use SQLite automatically
DATABASE_URL=postgresql+psycopg2://postgres.YOURPROJECTREF:PASSWORD@aws-0-ap-northeast-1.pooler.supabase.com:6543/postgres?sslmode=require

# Admin panel
ADMIN_API_KEY=your-secret-key
ADMIN_AUTH_SECRET=random-secret-min-32-chars
ADMIN_ALLOWED_EMAIL=admin@yourdomain.com

# CORS (comma-separated, no trailing slash)
ALLOWED_ORIGINS=https://candidate.vercel.app,https://admin.vercel.app

# ── Email (OTP delivery) ─────────────────────────────────────────────────────
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=you@gmail.com
SMTP_PASSWORD=your-app-password        # Google: App Password, not account password
SMTP_FROM_EMAIL=you@gmail.com
SMTP_SECURITY=starttls                 # options: starttls | ssl | none

# Resend as fallback (recommended on Render — port 587 is often blocked)
RESEND_API_KEY=re_xxxxxxxxxxxxx
RESEND_FROM_EMAIL=noreply@yourdomain.com

# ── Cost controls (defaults shown) ──────────────────────────────────────────
DAILY_TOKENS_FREE=1500
DAILY_QUESTIONS_FREE=10
MAX_QUESTIONS_PER_INTERVIEW=10
MAX_AI_QUESTIONS_PER_INTERVIEW=5
NEXT_QUESTION_COOLDOWN_SECONDS=5
REQUEST_LIMIT_PER_MINUTE=10
MAX_AUDIO_UPLOAD_BYTES=5242880         # 5 MB

# ── Optional ─────────────────────────────────────────────────────────────────
WINDOWS_BROWSER_ONLY=false             # true = block non-Windows browsers
ALLOW_ADMIN_KEY_FALLBACK=false         # true = allow x-admin-key header (dev only)
LOG_LEVEL=INFO
ADMIN_OTP_TTL_SECONDS=300
```

### Frontend

```env
# frontend/.env  AND  frontend/admin/.env
VITE_API_URL=https://your-render-backend.onrender.com
```

In local dev, leave `VITE_API_URL` unset — Vite's proxy handles `/api` routing automatically.

---

## Production Deployment

See [`DEPLOYMENT.md`](./DEPLOYMENT.md) for full step-by-step instructions.

### Quick Reference

| Component | Platform | Notes |
|---|---|---|
| Candidate frontend | Vercel | Root dir: `frontend` · Set `VITE_API_URL` |
| Admin frontend | Vercel | Root dir: `frontend/admin` · Set `VITE_API_URL` |
| Backend API | Render (Web Service) | Root: `backend` · Start: `uvicorn main:app --host 0.0.0.0 --port 10000` |
| Database | Supabase PostgreSQL | Use transaction pooler URL (port 6543) |

### Email for Admin OTP on Render

Render's free tier blocks outbound SMTP port 587. Use one of:

1. **Resend.com** (recommended) — set `RESEND_API_KEY` + `RESEND_FROM_EMAIL`. Free tier: 3,000 emails/month.
2. **Gmail App Password** — may work if your Render region allows port 587 egress.

The backend attempts SMTP first, then falls back to Resend automatically.

---

## Resilience & Observability

### Database Resilience

```
On startup:
  1. Try PostgreSQL connection (SELECT 1 connectivity test)
  2. If fails -> log warning -> switch engine to SQLite
  3. init_db() creates all tables in active engine
  4. SessionLocal global updated atomically

Result: Backend NEVER crashes due to DB misconfiguration.
```

### Health Endpoint

```
GET /health
-> {"status": "ok", "db": "ok", "db_type": "postgresql"}

db_type = "sqlite"  means PostgreSQL unreachable (check DATABASE_URL)
db = "error: ..."   means both DB connections failed
```

### Structured Logging

Key log events:

| Log message | Meaning |
|---|---|
| `Database ready: <host>` | Successful PostgreSQL connection |
| `Primary database unreachable ... Falling back to SQLite` | Auto-fallback triggered |
| `request path=... requester=... hits_last_min=...` | Every API call |
| `start_interview failed` / `answer failed` | Exception with full traceback |

### Proctoring Audit Log

Every completed/terminated session appends to:

```
backend/logs/proctoring/<candidate_id>.jsonl
```

Sample record:

```json
{
  "server_received_at": "2026-04-09T10:00:00Z",
  "candidate_id": "uuid-...",
  "session_id": "uuid-...",
  "role": "Frontend Developer",
  "difficulty": "easy",
  "mode": "hybrid",
  "status": "completed",
  "violations": 2,
  "terminated": false,
  "events": [
    {
      "timestamp": "2026-04-09T09:58:12Z",
      "type": "violation",
      "message": "Tab switching detected.",
      "counted": true
    }
  ]
}
```

---

## Roadmap

| Priority | Feature |
|---|---|
| High | Redis-backed question cache + distributed rate limiting |
| High | Celery/RQ worker queue for async Whisper + GPT tasks |
| Medium | Multi-tenant organization support (company isolation) |
| Medium | Adaptive difficulty based on live performance trajectory |
| Medium | Interviewer analytics dashboard (funnel, score distribution, drift detection) |
| Low | Video recording with server-side storage (S3 / R2) |
| Low | Webhook notifications on interview completion |
| Low | Resume parsing to auto-generate role-specific questions |

---

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/your-feature`
3. Commit with clear messages following [Conventional Commits](https://www.conventionalcommits.org/): `feat:`, `fix:`, `docs:`, `refactor:`
4. Open a pull request with description and testing notes

Please keep changes production-focused. Large features should include a design note in the PR description.

---

## Engineering Notes

This project demonstrates end-to-end production engineering across:

- **AI integration** — prompt engineering, deterministic rubric scoring, token cost governance, in-memory TTL response caching
- **Backend architecture** — stateless FastAPI with DB-backed session management, layered service design, graceful fallback patterns, PgBouncer-aware connection pooling
- **Frontend engineering** — browser API orchestration (MediaPipe, MediaRecorder, Fullscreen API), complex React state machine, real-time proctoring pipeline running at frame rate
- **Security design** — OTP + HMAC-signed token auth, CORS hardening, per-user rate limiting, usage quotas with daily reset
- **Production operations** — zero-crash startup under bad config, structured logging, health endpoints, JSONL audit trail, complete deployment runbooks for Render + Vercel + Supabase

---

*Built with FastAPI · React · OpenAI · Supabase · Vercel · Render*
