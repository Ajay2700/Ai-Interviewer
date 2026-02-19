## AI Interviewer Web Application

Full-stack, voice-based AI interviewer built with **FastAPI + OpenAI (GPT + Whisper)** on the backend and **React (Vite) + Tailwind CSS** on the frontend.

The app simulates a real interview: it generates questions, records your spoken answers, transcribes them with Whisper, evaluates them with GPT, and returns a score with strengths, weaknesses, and improvements.

This version includes a production-grade, proctored flow:
- strict deterministic AI evaluation with confidence + verdict
- controlled interview state machine (`environment_check`, `ready`, `interviewing`, `evaluating`, `completed`)
- anti-cheating signals (tab switch, blur, copy/paste, right-click, shortcut blocking)
- fullscreen immersive mode with violation tracking
- camera proctoring using MediaPipe Face Landmarker (face count + basic gaze/lighting checks)

---

## Separated Admin/Candidate Architecture

Admin and candidate systems are intentionally separated to improve security and scalability.

- **Admin System (Interviewer)**:
  - manages question CRUD
  - calls `/api/admin/*`
  - requires `x-admin-key` header
- **Candidate System (Student)**:
  - attends interview, submits voice answers, gets evaluation
  - calls `/api/interview/*`
  - has no admin actions or admin UI controls

### Backend structure

- `backend/main.py`
- `backend/api/admin/routes.py`
- `backend/api/candidate/routes.py`
- `backend/services/question_service.py`
- `backend/services/openai_service.py`
- `backend/services/speech_service.py`
- `backend/models/schemas.py`
- `backend/core/config.py`
- `backend/core/database.py`

### Frontend structure

- `frontend/admin/` (independent interviewer app, default port `5174`)
- `frontend/candidate/` (independent candidate app, default port `5173`)

---

### 1. Project structure

- **backend** – FastAPI API
  - `main.py` – FastAPI app, CORS, router registration
  - `core/config.py` – central settings/env config
  - `api/interview_routes.py` – interview start/next/audio routes
  - `api/admin_routes.py` – question CRUD admin APIs
  - `services/question_service.py` – SQLite question management logic
  - `services/openai_service.py` – GPT question generation + strict evaluation
  - `services/whisper_service.py` – Whisper speech-to-text
  - `models/schemas.py` – Pydantic models for request/response validation
  - `utils/prompts.py` – prompt templates
  - `requirements.txt` – backend dependencies
- **frontend** – Vite React SPA
  - `src/App.jsx` – shell, theme, routing between interview and results
  - `src/pages/Admin.jsx` – admin panel for question management
  - `src/components/QuestionForm.jsx` – add/edit question form
  - `src/components/QuestionList.jsx` – list/edit/delete questions
  - `src/hooks/useProctoring.js` – anti-cheat and proctoring state
  - `src/hooks/useFullscreen.js` – fullscreen enforcement
  - `src/components/CameraMonitor.jsx` – camera feed + face/gaze checks (MediaPipe)
  - `src/components/WarningModal.jsx` – suspicious activity warning modal
  - `src/pages/EnvironmentCheck.jsx` – pre-interview readiness checks
  - `src/pages/Interview.jsx` – main interview flow
  - `src/pages/Result.jsx` – evaluation result view
  - `src/components/Recorder.jsx` – audio recording with `MediaRecorder`
  - `src/components/Loader.jsx` – loading indicator
  - `src/services/api.js` – Axios API client

---

### 2. Backend setup (FastAPI)

1. **Create & activate virtualenv** (recommended):

   ```bash
   cd backend
   python -m venv .venv
   # Windows PowerShell
   .venv\Scripts\Activate.ps1
   # or Command Prompt
   .venv\Scripts\activate.bat
   ```

2. **Install dependencies**:

   ```bash
   pip install -r requirements.txt
   ```

3. **Configure environment variable**:

   Create a backend `.env` file:

   **Path:** `backend/.env`

   ```env
   OPENAI_API_KEY=your_openai_api_key_here
   FRONTEND_ORIGIN=http://localhost:5173
ADMIN_API_KEY=change_me_admin_key
CANDIDATE_FRONTEND_ORIGIN=http://localhost:5173
ADMIN_FRONTEND_ORIGIN=http://localhost:5174
   ```

   > The backend loads `.env` automatically via `python-dotenv`.

4. **Run the backend server**:

   ```bash
   uvicorn main:app --reload --port 8000
   ```

5. **Key endpoints**:

   - Candidate:
     - `GET /api/interview/start?role=Frontend%20Developer&difficulty=easy`
     - `POST /api/interview/answer` (multipart with `audio`, `question`)
     - `POST /api/interview/next`
   - Admin (requires `x-admin-key`):
     - `POST /api/admin/question`
     - `GET /api/admin/questions`
     - `PUT /api/admin/question/{id}`
     - `DELETE /api/admin/question/{id}`

### Run Candidate Frontend

```bash
cd frontend/candidate
npm install
npm run dev
```

### Run Admin Frontend

Create `frontend/admin/.env.local`:

```env
VITE_API_BASE_URL=http://127.0.0.1:8000
VITE_ADMIN_KEY=change_me_admin_key
```

Then run:

```bash
cd frontend/admin
npm install
npm run dev
```

Candidate app: `http://localhost:5173`  
Admin app: `http://localhost:5174`

   - `POST /api/interview/next`
   - `POST /api/admin/question`
   - `GET /api/admin/questions`
   - `PUT /api/admin/question/{id}`
   - `DELETE /api/admin/question/{id}`

### Database setup

The backend uses SQLite and auto-creates `questions` table at startup:

- `id` (pk, autoincrement)
- `role` (text)
- `difficulty` (easy/medium/hard)
- `question` (text)
- `created_at` (timestamp)

Why this hybrid model:
- DB questions provide deterministic, curated quality and admin control.
- AI serves as fallback/follow-up when DB questions are exhausted or unavailable.

---

### 3. Frontend setup (Vite React + Tailwind)

1. **Install dependencies**:

   ```bash
   cd frontend
   npm install
   ```

2. **Run the dev server**:

   ```bash
   npm run dev
   ```

   By default this runs on `http://localhost:5173`, which is already allowed by the backend CORS config.

3. **Frontend environment (optional)**:

   Create a frontend `.env.local` file:

   **Path:** `frontend/.env.local`

   ```env
   VITE_API_BASE_URL=http://localhost:8000
   ```

3. **Tech stack**:

   - React (Vite)
   - Tailwind CSS (`tailwind.config.js` with `darkMode: 'class'`)
   - Axios for API communication
   - `MediaRecorder` API for audio recording
  - MediaPipe (`@mediapipe/tasks-vision`) for proctoring

---

### 4. Frontend flow & features

- **Role selection** – choose from Frontend, Backend, Full Stack, AI/ML, DevOps.
- **Question generation** – calls `GET /api/interview/question?role=...` and displays the question.
- **Recording** – `Recorder` component uses `MediaRecorder`:
  - Start/Stop recording
  - Local timer and max duration (e.g. 180s)
  - Converts chunks into a `Blob` and sends it back to parent
- **Submitting an answer** – converts the `Blob` to a `File` and calls `submitAnswer(file)`:
  - Displays loading state while waiting for backend
  - Shows errors if the request fails
- **Result display**:
  - Transcript of the answer
  - Score out of 10 with a visual progress bar
  - Strengths / Weaknesses / Improvements lists
  - Overall feedback paragraph
- **Advanced features**:
  - Timer while answering
  - Next question button (re-use "Start / Next question")
  - Multi-question session (session history in right sidebar)
  - History persisted in `localStorage`
  - Dark mode toggle (stored in `localStorage` and applied via `document.documentElement.classList`)

---

### 5. Running the full stack locally

1. **Start backend**:

   ```bash
   cd backend
   # Activate venv if using one
   uvicorn main:app --reload --port 8000
   ```

2. **Start frontend** (in a separate terminal):

   ```bash
   cd frontend
   npm run dev
   ```

3. **Open the app**:

   - Navigate to `http://localhost:5173` in your browser.

4. **Interview flow**:

   - Select a role and click **“Start / Next question”**.
   - Read the question and click **“Start recording”**.
   - Speak your answer, then **“Stop recording”**.
   - Click **“Submit answer”** and wait for the evaluation.
   - Review the **score**, **feedback**, and **history**, then repeat with **“New question”**.

---

### 6. Root scripts (optional)

If you prefer running from the project root:

- Start frontend from root:

  ```bash
  npm run frontend
  ```

- Start backend from root:

  ```bash
  npm run backend
  ```

### 7. Notes & production considerations

- The backend uses the official `openai` SDK (`OpenAI` client) for both GPT and Whisper.
- Make sure your OpenAI account has access to the `whisper-1` model and a suitable GPT model (`gpt-4o-mini` in this code).
- For production:
  - Use HTTPS and secure cookie / token-based auth if you tie this to user accounts.
  - Consider rate limiting and request size limits on the FastAPI endpoints.
  - Host the backend and frontend separately (or behind a reverse proxy) and adjust CORS and `baseURL` in `src/services/api.js` accordingly.

