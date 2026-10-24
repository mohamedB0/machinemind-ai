# MachineMind AI — Architecture

## System Overview

```
┌─────────────────────────────────────────────────────────┐
│                      User Browser                        │
└──────────────────────┬──────────────────────────────────┘
                       │ HTTP
┌──────────────────────▼──────────────────────────────────┐
│              Next.js Frontend (port 3000)                │
│  /login  /register  /dashboard  /machines  /chat        │
└──────────────────────┬──────────────────────────────────┘
                       │ REST API calls
┌──────────────────────▼──────────────────────────────────┐
│              FastAPI Backend (port 8000)                 │
│                                                          │
│  /api/auth/*          JWT authentication                 │
│  /api/machines/*      Machine + Manual CRUD + Upload     │
│  /api/conversations/* Chat + RAG pipeline                │
│  /api/health          Health check                       │
└──────┬────────────────────────────────────┬─────────────┘
       │                                    │
┌──────▼──────┐                    ┌────────▼────────────┐
│ PostgreSQL  │                    │   Groq API          │
│ + pgvector  │                    │ llama-3.3-70b       │
│             │                    └─────────────────────┘
│ • users     │
│ • machines  │  ┌──────────────────────────────────────┐
│ • manuals   │  │  Local Embedding Model               │
│ • doc_pages │  │  multilingual-e5-large               │
│ • chunks    │  │  (runs on CPU, no API needed)        │
│   + vectors │  └──────────────────────────────────────┘
│ • convos    │
│ • messages  │  ┌──────────────────────────────────────┐
└─────────────┘  │  Local File Storage                  │
                 │  ./uploads/*.pdf                     │
                 └──────────────────────────────────────┘
```

## RAG Pipeline

```
User Question
     │
     ▼
1. Embed question (multilingual-e5: "query: <text>")
     │
     ├── Vector Search (pgvector cosine distance)
     │   → top-16 candidates
     │
     ├── Lexical Search (PostgreSQL FTS)
     │   → top-16 candidates
     │
     ▼
2. Score Fusion (0.6 × vector + 0.4 × lexical)
     │
     ▼
3. Select top-8 passages
     │
     ▼
4. Build context string with page citations
     │
     ▼
5. Call Groq LLM (llama-3.3-70b-versatile)
   System: MachineMind rules (cite, don't invent, abstain)
   User: Question + retrieved context
     │
     ▼
6. Return answer + sources + confidence level
```

## Ingestion Pipeline

```
PDF Upload
     │
     ▼
1. Validate (type, size, magic bytes)
2. SHA-256 hash → dedup check
3. Save to ./uploads/
4. Record in DB (status: pending)
     │
     ▼ (background task)
5. Extract text per page (PyMuPDF)
6. Sliding-window chunking (600 tokens, 100 overlap)
   → preserve page numbers, section titles, content type
7. Generate embeddings (multilingual-e5-large, batch=16)
   → prefix: "passage: <text>"
8. Store chunks + vectors in PostgreSQL/pgvector
9. Update status: completed / error
```

## Data Model

```
users ──────────────────────┐
  id, email, hashed_password │
                             │ owner_id
machines ◄──────────────────┘
  id, name, manufacturer      │
  model_number, description   │ machine_id
                              │
manuals ◄───────────────────┘
  id, filename, file_hash     │
  page_count, status          │ manual_id
                              │
document_pages ◄─────────────┤
  page_number, text           │
                              │
document_chunks ◄────────────┘
  text, embedding (vector)
  page_start/end, section_title
  content_type, chunk_index
       │
       │ cited in
       ▼
conversations → messages
  role (user|assistant)
  content, sources (JSON)
```
