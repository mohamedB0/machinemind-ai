# MachineMind AI

> RAG-powered technical assistant for machine manuals — built with FastAPI, Next.js, pgvector, and Groq.

## Quick Start

### 1. Prerequisites
- Python 3.11+
- Node.js 20+
- Docker + Docker Compose
- A [Groq API key](https://console.groq.com)

### 2. Configure environment
```bash
cp .env.example .env
# Edit .env and set GROQ_API_KEY=your_key_here
```

### 3. Start the database
```bash
docker compose up db -d
```

### 4. Start the backend
```bash
cd services/api
pip install -r requirements.txt
uvicorn app.main:app --reload
```
API available at: http://localhost:8000
Swagger docs: http://localhost:8000/docs

### 5. Start the frontend
```bash
cd apps/web
npm install
npm run dev
```
Frontend available at: http://localhost:3000

---

## Architecture

```
User → Next.js (3000) → FastAPI (8000) → PostgreSQL+pgvector
                                       → Groq LLM
                                       → Local file storage
```

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 15, TypeScript, Tailwind CSS |
| Backend | Python 3.11, FastAPI, Pydantic v2 |
| Database | PostgreSQL 16 + pgvector |
| PDF extraction | PyMuPDF |
| Figures & scanned pages | Vision LLM (Groq/Gemini/OpenRouter, auto-fallback) + local Tesseract OCR |
| Embeddings | multilingual-e5-large (local) |
| LLM | Groq (llama-3.3-70b-versatile) |
| Auth | JWT (python-jose + passlib) |

## API Endpoints

| Method | Route | Description |
|---|---|---|
| POST | /api/auth/register | Create account |
| POST | /api/auth/login | Get JWT token |
| POST | /api/machines | Create machine |
| GET | /api/machines | List machines |
| POST | /api/machines/{id}/manuals | Upload PDF |
| GET | /api/machines/{id}/manuals | List manuals |
| POST | /api/conversations | Create conversation |
| POST | /api/conversations/{id}/messages | Send question → RAG response |
| GET | /api/health | Health check |
