# Quickstart Guide: Realtime Meeting Transcription

**Feature**: 007-realtime-meeting-transcription  
**Date**: 2026-04-04  
**Last Updated**: 2026-04-05

## Prerequisites

- Node.js 20+ (frontend)
- Python 3.11+ with uv package manager (backend)
- Docker & Docker Compose (services)
- Google account (for Colab worker with GPU)

---

## 1. Clone and Setup

```bash
# Clone repository
git clone <repo-url>
cd talkie

# Switch to feature branch
git checkout 007-realtime-meeting-transcription
```

---

## 2. Start Infrastructure Services

```bash
# Start PostgreSQL, Redis, MinIO
docker compose up -d postgres redis minio

# Verify services
docker compose ps
```

**Services:**
| Service | Port | Credentials |
|---------|------|-------------|
| PostgreSQL | 6201 | talkie / talkie123 |
| Redis | 6202 | (no auth) |
| MinIO | 6203 (API), 6204 (Console) | minioadmin / minioadmin |

---

## 3. Backend Setup

```bash
cd backend

# Create virtual environment with uv
uv venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate

# Install dependencies with uv
uv pip install -r requirements.txt
uv pip install -r requirements-dev.txt

# Copy environment config
cp .env.example .env

# Edit .env with your settings (required values shown):
# DATABASE_URL=postgresql+asyncpg://talkie:talkie123@localhost:6201/talkie
# REDIS_URL=redis://localhost:6202
# MINIO_ENDPOINT=localhost:6203
# MINIO_ACCESS_KEY=minioadmin
# MINIO_SECRET_KEY=minioadmin
# JWT_SECRET=your-secret-key-change-in-production
#
# Optional (for translation and summary features):
# GOOGLE_TRANSLATE_API_KEY=your-google-api-key
# OPENAI_API_KEY=your-openai-api-key

# Run database migrations
uv run alembic upgrade head

# Start backend server (development)
uv run uvicorn src.main:app --reload --port 8001
```

**Verify backend:**
```bash
curl http://localhost:8001/health
# {"status": "healthy", "version": "0.1.0"}
```

---

## 4. Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Copy environment config
cp .env.example .env.local

# Edit .env.local
# VITE_API_URL=http://localhost:8001/api/v1
# VITE_WS_URL=ws://localhost:8001/ws

# Start development server
npm run dev
```

**Verify frontend:**
Open http://localhost:5173 in browser.

---

## 5. Colab Worker Setup

### Option A: Local Development (CPU - slow)

```bash
cd colab-worker

# Create virtual environment
python -m venv venv
source venv/bin/activate

# Install dependencies (CPU version)
pip install -r requirements-cpu.txt

# Start worker
python -m worker.main \
  --server-url http://localhost:8001 \
  --worker-id local-dev-1
```

### Option B: Google Colab (GPU - recommended)

1. Open `colab-worker/notebook.ipynb` in Google Colab
2. Enable GPU runtime: Runtime → Change runtime type → GPU
3. Run setup cells to install dependencies
4. Configure server URL (use ngrok for local development)
5. Run worker cells

**Ngrok for local development:**
```bash
# In a new terminal
ngrok http 8001

# Use the ngrok URL in Colab notebook
# e.g., https://abc123.ngrok.io
```

---

## 6. Run Tests

### Backend Tests

```bash
cd backend
source .venv/bin/activate

# Run linting
uv run ruff check .

# Unit tests
uv run pytest tests/unit -v

# Integration tests (requires services)
uv run pytest tests/integration -v

# All tests with coverage
uv run pytest --cov=src --cov-report=html
```

### Frontend Tests

```bash
cd frontend

# Unit tests
npm run test -- --run

# E2E tests (requires frontend server running)
PLAYWRIGHT_BASE_URL=http://127.0.0.1:4173 npm run test:e2e
```

---

## 7. Development Workflow

### Create a Meeting (Quick Test)

```bash
# 1. Register host account
curl -X POST http://localhost:8001/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"Test1234","display_name":"Test Host"}'

# 2. Login
TOKEN=$(curl -s -X POST http://localhost:8001/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"Test1234"}' | jq -r '.access_token')

# 3. Create meeting
curl -X POST http://localhost:8001/api/v1/meetings \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"title":"Test Meeting","source_language":"vi"}'
```

### Full E2E Test

1. Start frontend (dev or preview) and open it in a browser
2. Register/login as host
3. Create a new meeting
4. Open participant link in a separate browser context
5. Verify realtime transcript reaches both host and participant views
6. End the meeting and open replay view
7. Verify replay transcript and summary render correctly

---

## 8. Common Issues

### "No workers available"

- Ensure Colab worker is running
- Check worker can reach backend (ngrok if local)
- Verify worker ID in logs

### "WebSocket connection failed"

- Check CORS settings in backend
- Verify WS_URL in frontend config
- Check browser console for errors

### "Translation not appearing"

- Verify Google Translate API key
- Check API quota in Google Cloud Console
- Review backend logs for errors

### Database migration errors

```bash
# Reset database (development only!)
docker compose down -v
docker compose up -d postgres
alembic upgrade head
```

---

## 9. Project Structure

```
talkie/
├── backend/
│   ├── src/
│   │   ├── api/           # FastAPI routes
│   │   ├── core/          # Config, auth, database
│   │   ├── models/        # SQLAlchemy models
│   │   ├── services/      # Business logic
│   │   └── workers/       # Background tasks
│   ├── tests/
│   ├── alembic/           # Migrations
│   └── requirements.txt
│
├── frontend/
│   ├── src/
│   │   ├── components/    # React components
│   │   ├── pages/         # Route pages
│   │   ├── services/      # API/WebSocket clients
│   │   ├── stores/        # Zustand stores
│   │   └── i18n/          # Translations
│   ├── tests/
│   └── package.json
│
├── colab-worker/
│   ├── notebook.ipynb     # Colab notebook
│   ├── worker/            # Worker Python code
│   └── tests/
│
├── docker-compose.yml
└── specs/                 # Design documents
```

---

## 10. Useful Commands

```bash
# Backend
uv run uvicorn src.main:app --reload     # Start dev server
uv run alembic revision --autogenerate -m "..."  # Create migration
uv run alembic upgrade head              # Apply migrations
uv run ruff check .                      # Lint code
uv run pytest -x -v                      # Run tests, stop on first failure

# Frontend
npm run dev                              # Start dev server
npm run build                            # Production build
npm run lint                             # Lint code
npm run test                             # Run tests

# Docker
docker compose up -d                     # Start all services
docker compose logs -f backend           # Tail backend logs
docker compose down -v                   # Stop and remove volumes
```

---

## 11. Environment Variables Reference

### Backend (.env)

| Variable | Required | Description |
|----------|----------|-------------|
| DATABASE_URL | Yes | PostgreSQL connection string |
| REDIS_URL | Yes | Redis connection string |
| MINIO_ENDPOINT | Yes | MinIO/S3 endpoint |
| MINIO_ACCESS_KEY | Yes | MinIO/S3 access key |
| MINIO_SECRET_KEY | Yes | MinIO/S3 secret key |
| JWT_SECRET | Yes | Secret for JWT signing |
| JWT_ACCESS_EXPIRE_MINUTES | No | Access token expiry (default: 60) |
| GOOGLE_TRANSLATE_API_KEY | Yes | Google Cloud Translation API key |
| OPENAI_API_KEY | Yes | OpenAI API key for summaries |
| WORKER_TIMEOUT_SECONDS | No | Worker job timeout (default: 30) |

### Frontend (.env.local)

| Variable | Required | Description |
|----------|----------|-------------|
| VITE_API_URL | Yes | Backend API URL |
| VITE_WS_URL | Yes | Backend WebSocket URL |

---

## Next Steps

1. Review [data-model.md](./data-model.md) for database schema
2. Review [contracts/rest-api.md](./contracts/rest-api.md) for API details
3. Review [contracts/websocket-protocol.md](./contracts/websocket-protocol.md) for real-time protocol
4. Check [research.md](./research.md) for technology decisions
