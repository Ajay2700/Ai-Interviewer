<img width="1881" height="892" alt="image" src="https://github.com/user-attachments/assets/de25f893-d7ef-446e-87d5-a89c7f2258a9" /># AI Interviewer

> **Production-ready AI interview platform for realistic technical assessments with voice, proctoring, and cost-controlled AI orchestration.**

---

## 🚀 Demo

- **Live App (Candidate):** `https://ai-interviewer-theta-tan.vercel.app/`
- **Live App (Admin):** `https://ai-interviewer-onoh.vercel.app/`
- **Backend API:** `https://ai-interviewer-4po6.onrender.com/docs`

### Screenshots

- `<img width="1881" height="892" alt="image" src="https://github.com/user-attachments/assets/8a4da277-e421-4df1-afe7-99adceefb3ee" />`
- `<img width="1901" height="812" alt="image" src="https://github.com/user-attachments/assets/56166ded-a2a2-487d-85a2-a72337223cb0" />`
- `<img width="1889" height="1023" alt="image" src="https://github.com/user-attachments/assets/78fe153c-fa50-49f4-bb0f-f777c3c66e97" />`
- `<img width="1889" height="835" alt="image" src="https://github.com/user-attachments/assets/393a9831-0de6-4208-b94a-746caba2cd98" />
`

- `<img width="1896" height="873" alt="image" src="https://github.com/user-attachments/assets/32a03667-b647-4db0-8994-c479502d34b5" />
`
- `docs/screenshots/proctoring-panel.png`

---

## ✨ Features

- AI-generated interview questions tailored by role and difficulty
- Company-curated question bank with admin CRUD controls
- Hybrid interview mode (DB-first + AI follow-ups)
- Voice answer capture + speech-to-text transcription
- Strict AI evaluation with score, confidence, verdict, and actionable feedback
- Proctoring signals: face presence, gaze state, tab switching, blur/focus violations
- Anti-cheating controls: fullscreen workflow, violation tracking, threshold handling
- Usage controls: token tracking, question limits, cooldowns, rate limiting
- Scalable architecture with stateless backend patterns and DB-backed session state
- Admin secure login flow with OTP and token-based authorization

---

## 🏗️ System Architecture

```text
Frontend (React/Vite)
   ├─ Candidate App
   └─ Admin App
            │
            ▼
Backend API (FastAPI)
   ├─ Interview Orchestration
   ├─ Admin Auth + Question Management
   ├─ Usage/Rate Limit Middleware
   └─ Proctoring Log Endpoints
            │
            ├────────► OpenAI APIs (GPT + Whisper)
            │
            └────────► PostgreSQL (Supabase)
```

**Flow:** Frontend handles UX and media capture, backend enforces business rules/security, AI services power generation/evaluation, and PostgreSQL persists state/usage.

---

## 🧰 Tech Stack

### Frontend
- React (Vite)
- Tailwind CSS
- Axios

### Backend
- FastAPI
- Python 3.11
- SQLAlchemy
- Pydantic

### AI
- OpenAI GPT (question generation + evaluation)
- OpenAI Whisper (speech-to-text)

### Data & Infra
- PostgreSQL (Supabase)
- Vercel (frontend hosting)
- Render (backend hosting)

---

## 🔄 How It Works

1. **Start Interview**
   - Candidate selects role, difficulty, mode.
   - Backend validates limits/session policy and returns first question.

2. **Ask Question**
   - DB question (company/hybrid) or AI-generated question is served.

3. **Record Answer**
   - Candidate records voice in browser and submits audio.

4. **AI Evaluation**
   - Whisper transcribes speech.
   - GPT evaluates answer quality, returns score + feedback.

5. **Result**
   - Candidate receives structured summary and final outcome.

---

## 🧠 AI Capabilities

- **Question Generation:** Role-aware, difficulty-aware prompts with controlled response style.
- **Evaluation Logic:** Deterministic rubric-style scoring to reduce output variance.
- **Prompt Engineering:** Compact system prompts, bounded tokens, low temperature for consistency.
- **Anti-Hallucination Approach:**
  - DB-first questioning in company/hybrid modes
  - constrained output format
  - strict context-driven follow-up generation

---

## 🔐 Security & Cost Control

- Per-user usage tracking (`users`, `usage_logs`)
- Daily token and question quotas
- Per-session question caps + AI follow-up caps
- Request rate limiting middleware
- CORS hardening with explicit allowed origins
- Admin OTP login + signed access token verification
- Clear 4xx/429 responses for limit/policy enforcement

---

## 🛡️ Proctoring System

- **Face Detection:** Detects absence/multiple faces and flags risks.
- **Gaze Tracking:** Basic gaze-center checks for interview engagement.
- **Behavioral Signals:** Tab switch, blur/focus, shortcut attempts, and violation logging.
- **Interview Guardrails:** Fullscreen-first flow with violation threshold handling.

---

## 📁 Project Structure

```text
AI-Interviewer/
├── backend/
│   ├── api/
│   │   ├── admin/
│   │   └── candidate/
│   ├── core/
│   ├── models/
│   ├── services/
│   ├── requirements.txt
│   └── main.py
├── frontend/
│   ├── admin/
│   ├── candidate/
│   └── src/
├── DEPLOYMENT.md
└── README.md
```

---

## ⚙️ Installation

### 1) Clone Repository

```bash
git clone https://github.com/<your-username>/<your-repo>.git
cd <your-repo>
```

### 2) Backend Setup

```bash
cd backend
python -m venv .venv
# Windows PowerShell
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn main:app --reload --port 8010
```

### 3) Frontend Setup (Candidate)

```bash
cd frontend/candidate
npm install
npm run dev
```

### 4) Frontend Setup (Admin)

```bash
cd frontend/admin
npm install
npm run dev
```

---

## 🔧 Environment Variables

### Backend (`backend/.env`)

```env
OPENAI_API_KEY=your_openai_key
DATABASE_URL=postgresql+psycopg2://<user>:<password>@<host>:6543/postgres?sslmode=require
ALLOWED_ORIGINS=https://<candidate-app>.vercel.app,https://<admin-app>.vercel.app

# Admin auth and email
ADMIN_API_KEY=your_admin_key
ADMIN_AUTH_SECRET=your_secret
ADMIN_ALLOWED_EMAIL=admin@yourdomain.com
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=you@example.com
SMTP_PASSWORD=app_password
SMTP_FROM_EMAIL=you@example.com
SMTP_SECURITY=starttls

# Optional fallback
RESEND_API_KEY=re_xxxxxxxxxxxxx
RESEND_FROM_EMAIL=onboarding@resend.dev
```

### Frontend (`frontend/admin/.env`, `frontend/candidate/.env`)

```env
VITE_API_URL=https://<your-render-backend>.onrender.com
```

---

## 🌍 Deployment

- **Frontend:** Vercel (`frontend/candidate` and `frontend/admin` as separate projects)
- **Backend:** Render (root: `backend`, start: `uvicorn main:app --host 0.0.0.0 --port 10000`)
- **Database:** Supabase PostgreSQL (pooler URL recommended)

For full production steps, see [`DEPLOYMENT.md`](./DEPLOYMENT.md).

---

## 🧭 Future Improvements

- Adaptive difficulty from live performance trajectory
- Multi-tenant organization support and role-based analytics
- Rich interviewer analytics dashboard (funnel, fairness, drift)
- Redis caching for generated questions and distributed rate limiting
- Worker queue (Celery/RQ) for async heavy AI tasks

---

## 🤝 Contribution

Contributions are welcome.

1. Fork the repository
2. Create a feature branch
3. Commit changes with clear messages
4. Open a pull request

Please keep changes production-focused and include testing notes.

---

## 📄 License

This project is licensed under the **MIT License**.  
You can add a `LICENSE` file in the repo root if not already present.

---

### ⭐ Recruiter Note

This project demonstrates end-to-end engineering across **AI integration, backend scalability, security controls, and production deployment troubleshooting**—with practical focus on reliability, observability, and cost governance.
