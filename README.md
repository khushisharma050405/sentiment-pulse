# Sentiment Pulse

Full-stack sentiment analysis for text and social media posts.

- **frontend/** React 18 + Vite (landing, login, analyzer) in a dark brown and dusty rose theme
- **backend/** FastAPI + SQLAlchemy (SQLite) + JWT auth, VADER scoring (optional RoBERTa transformer engine)

---

## Quickstart (Local Development)

### 1. Run the backend (terminal 1)
```bash
cd backend
python -m venv .venv && source .venv/bin/activate      # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env                                   # configure JWT_SECRET and SENTIMENT_ENGINE

# Optional for Image OCR Extraction (pytesseract):
# macOS: brew install tesseract (or conda install -c conda-forge tesseract)
# Ubuntu/Debian: sudo apt-get install -y tesseract-ocr
# Windows: Install from https://github.com/UB-Mannheim/tesseract/wiki and add to PATH

uvicorn app.main:app --reload                          # http://localhost:8000/docs
```

### 2. Run the frontend (terminal 2)
```bash
cd frontend
npm install
cp .env.example .env
npm run dev                                            # http://localhost:5173
```
Open [http://localhost:5173](http://localhost:5173), click **Login**, then **Sign up** to create an account.

---

## Features

### 1. Text Sentiment Analysis & History Panel
- Real-time sentiment scoring (score between −1.0 and +1.0, positive/neutral/negative breakdowns, and keyword polarity highlights).
- **Recent Analyses History Panel**: Logged-in users see their last 10 analyzed texts under the analyzer. Clicking any history item automatically populates the text field and re-analyzes it.

### 2. Social Media Crowd Sentiment & Multi-File Upload
- Live crowd mood breakdown (positive/neutral/negative distribution, platform sentiment breakdown, and hashtag tracking).
- **Multi-File Upload with OCR & Extraction**:
  - Drag-and-drop zone and Browse button for up to 10 files (max 5 MB each).
  - **Images (.jpg, .jpeg, .png, .webp)**: OCR extraction via Tesseract with automatic UI noise removal (removes "Likes", "Reply", bare numbers, timestamps, leaving clean caption/comment text) and thumbnail previews.
  - **Tables (.csv, .tsv, .xlsx)**: Reads `platform,text` columns, displays row counts, capped at 1,000 rows.
  - **Text & Documents (.txt, .json, .pdf)**: Line-by-line or paragraph text extraction.
  - **Editable Review List**: Edit post text, adjust platform, or delete rows before submitting.
  - **Analyze Button**: Dispatches reviewed items to `POST /api/sentiment/batch` to score all extracted posts together.
- Add individual posts manually or upload a batch CSV.

### 3. Streamlined Authentication
- Clean registration and login flows.
- Dead/non-functional links (forgot password and third-party social buttons) are hidden to maintain honest UX without misleading messages.

---

## Tests & Verification

### Backend Tests
```bash
cd backend
pytest
```
Covers: health checks, positive/negative/neutral scoring, negation and keyword detection, request validations, batch summaries, auth flows, history pagination/limits, user isolation, engine fallback, and comprehensive file upload tests (all file types, OCR noise cleaning, empty file, oversize file, fake extension, and unauthenticated access).

### Frontend Production Build
```bash
cd frontend
npm run build
```

---

## API Endpoints

| Method | Path | Description |
|---|---|---|
| `POST` | `/auth/register` | `{name, email, password}` — Creates account and returns a JWT |
| `POST` | `/auth/login` | `{email, password}` — Authenticates user and returns a JWT |
| `POST` | `/api/upload` | `multipart/form-data` with `files[]` — Extracts text from images, tables, PDFs, and text files without scoring |
| `POST` | `/api/sentiment` | `{text}` — Returns sentiment label, score, probabilities, keywords, engine |

| `POST` | `/api/sentiment/batch` | `{posts: [{platform, text}]}` — Returns per-post scores and aggregate crowd summary |
| `GET` | `/api/history?limit=50` | Returns user's recent analyses ordered newest-first (requires Bearer token) |
| `GET` | `/api/trends?days=30` | Returns user's daily rolling average sentiment over time (requires Bearer token) |
| `GET` | `/api/topics` | Returns top 20 keywords & hashtags ranked by frequency and sentiment (requires Bearer token) |
| `GET` | `/api/stats` | Returns total analyses, positive/neutral/negative counts, and overall average (requires Bearer token) |
| `GET` | `/health` | Health check endpoint returning `{"status": "ok"}` |

---

## Sentiment Engines: VADER vs. RoBERTa Transformer

Sentiment Pulse supports two sentiment analysis engines via `backend/.env` (`SENTIMENT_ENGINE=vader` or `SENTIMENT_ENGINE=transformer`).

To install the optional transformer engine:
```bash
cd backend
pip install -r requirements-ml.txt
```
Set `SENTIMENT_ENGINE=transformer` in `backend/.env`. It uses `cardiffnlp/twitter-roberta-base-sentiment-latest` and automatically falls back to VADER if the model is unavailable.

### Benchmark Comparison (20 Sample Sentences)

Both engines were evaluated across 20 diverse sentences featuring sarcasm, social media slang, negations, litotes, mixed sentiments, and contextual complaints:

| Metric | VADER (Lexicon-based) | RoBERTa Transformer |
|---|---|---|
| **Accuracy** | 70.0% (14 / 20) | **75.0% (15 / 20)** |
| **Average Latency** | **~0.07 ms** | ~53.5 ms |
| **Model Size / Dependencies** | Zero model downloads, minimal RAM | ~500 MB model weights, PyTorch + Transformers |
| **Slang & Idioms** | Fails on slang (e.g. marked *"straight fire! Absolutely goated"* as Negative) | **Correctly classifies modern slang as strongly Positive** |
| **Contextual Complaints** | Misses implicit complaints with no sentiment keywords (*"waited 45 mins before anyone brought water"*) | **Accurately identifies negative sentiment from context** |
| **Double Negation & Litotes** | Prone to error on nuanced phrasing (*"not that I dislike the redesign, but it takes too many clicks"*) | **Accurately captures the underlying critique** |

### Verdict & Recommendation
- **Which is better?**
  - **For Semantic Accuracy & Social Media Nuance:** **RoBERTa Transformer is superior**. It understands syntax, negations, sarcasm, and modern internet slang that rule-based lexicons completely fail on.
  - **For High-Throughput & Low-Resource Environments:** **VADER is ideal**. Running over 700x faster (~0.07 ms vs ~53 ms) with virtually zero memory overhead, it is best suited for real-time streaming or low-memory servers.
  - **Production Recommendation:** Use **RoBERTa Transformer** for batch processing and user-facing social analytics where nuanced accuracy matters; keep VADER as an instant zero-dependency fallback.

---

## Docker Compose

Run both frontend and backend services together in Docker:

```bash
docker compose up --build
```

- **Frontend:** [http://localhost:5173](http://localhost:5173) (and [http://localhost:80](http://localhost:80))
- **Backend API:** [http://localhost:8000](http://localhost:8000)
- **API Docs:** [http://localhost:8000/docs](http://localhost:8000/docs)

To run in detached mode:
```bash
docker compose up -d
```
To stop the containers:
```bash
docker compose down
```

---

## Deployment Notes

### 1. Environment Variables
- **Backend**:
  - `DATABASE_URL`: `sqlite:///./sentiment_pulse.db` (or PostgreSQL `postgresql://user:pass@host:5432/db` for production)
  - `JWT_SECRET`: Secure random string (minimum 32 characters)
  - `JWT_EXPIRE_MINUTES`: Token expiration in minutes (default: `1440` = 24h)
  - `CORS_ORIGINS`: Comma-separated list of allowed frontend origins
  - `AUTH_RATE_LIMIT`: Max login/register attempts per minute (e.g., `30`)
  - `SENTIMENT_ENGINE`: `vader` or `transformer`
- **Frontend**:
  - `VITE_API_URL`: Backend API URL (leave empty when using Nginx reverse proxy, or e.g. `https://api.yourdomain.com`)
  - `VITE_REQUIRE_AUTH`: `true` (enforce authentication to access `#/app`)

### 2. Cloud Hosting Options
- **Container / PaaS (Render, Railway, Fly.io, AWS ECS)**:
  - Deploy backend using `backend/Dockerfile` with a persistent disk volume for SQLite (or connect a managed Postgres database).
  - Deploy frontend using `frontend/Dockerfile` (Nginx container serving static build and proxying `/api`).
- **Static Hosting for Frontend (Vercel, Netlify, Cloudflare Pages)**:
  - Build command: `npm run build`
  - Output directory: `dist`
  - Set `VITE_API_URL=https://<your-backend-domain>` in your hosting dashboard.
