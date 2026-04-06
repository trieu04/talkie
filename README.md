# Talkie

Real-time meeting transcription and translation platform.

Talkie là sản phẩm ghi transcript và translation cuộc họp theo thời gian thực.

## Features

- 🎙️ **Real-time Transcription**: Record meetings and see transcripts appear live
- 🌐 **Multi-language Translation**: Translate transcripts to English, Japanese, Korean, Chinese, French, Spanish
- 📝 **AI Meeting Summaries**: Generate structured summaries with key points, decisions, and action items
- 👥 **Participant Sharing**: Share room codes for participants to follow along
- 📚 **Meeting History**: Browse past meetings, search transcripts, replay sessions
- 🔐 **Secure Authentication**: JWT-based auth with host accounts

## Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│    Frontend     │────▶│     Backend     │────▶│   Colab Worker  │
│  React + Vite   │     │    FastAPI      │     │  Faster-Whisper │
│  MUI + Zustand  │◀────│  SQLAlchemy     │◀────│     GPU STT     │
└─────────────────┘     └─────────────────┘     └─────────────────┘
        │                       │
        │               ┌───────┴───────┐
        │               │               │
        ▼               ▼               ▼
   WebSocket       PostgreSQL        Redis
   Real-time         Data           Pub/Sub
                      │
                      ▼
                    MinIO
                   Storage
```

## Quick Start

### Prerequisites

- Node.js 20+
- Python 3.11+ with [uv](https://github.com/astral-sh/uv)
- Docker & Docker Compose

### 1. Start Infrastructure

```bash
docker compose up -d
```

Services:
| Service | Port | Description |
|---------|------|-------------|
| PostgreSQL | 6201 | Database |
| Redis | 6202 | Pub/Sub & caching |
| MinIO API | 6203 | Object storage |
| MinIO Console | 6204 | Storage UI |

### 2. Backend Setup

```bash
cd backend

# Create virtual environment
uv venv
source .venv/bin/activate

# Install dependencies
uv pip install -r requirements.txt

# Configure environment
cp .env.example .env
# Edit .env with your settings (see Configuration section)

# Run migrations
uv run alembic upgrade head

# Start server
uv run uvicorn src.main:app --reload --port 8000
```

### 3. Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Configure environment
cp .env.example .env.local

# Start dev server
npm run dev
```

### 4. GPU Worker (Optional - for transcription)

**Option A: Google Colab (Recommended)**
1. Open `colab-worker/notebook.ipynb` in Google Colab
2. Enable GPU: Runtime → Change runtime type → GPU
3. Run all cells
4. Use ngrok to expose backend if running locally

**Option B: Local CPU (Slow)**
```bash
cd colab-worker
python -m venv venv && source venv/bin/activate
pip install -r requirements-cpu.txt
python -m worker.main --server-url http://localhost:8000 --worker-id local-1
```

## Development

Run `make help` to see all available commands.

### Quick Start (with Make)

```bash
make setup       # One-time setup (deps, env files, migrations)
make infra       # Start PostgreSQL, Redis, MinIO
make dev         # Backend + Frontend in tmux
```

## Configuration

### Backend (.env)

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `DATABASE_URL` | Yes | - | PostgreSQL connection string |
| `REDIS_URL` | Yes | - | Redis connection string |
| `MINIO_ENDPOINT` | Yes | - | MinIO/S3 endpoint |
| `MINIO_ACCESS_KEY` | Yes | - | MinIO/S3 access key |
| `MINIO_SECRET_KEY` | Yes | - | MinIO/S3 secret key |
| `MINIO_BUCKET_NAME` | Yes | - | Storage bucket name |
| `JWT_SECRET` | Yes | - | JWT signing secret (min 32 chars) |
| `GOOGLE_TRANSLATE_API_KEY` | No | - | For translation feature |
| `OPENAI_API_KEY` | No | - | For AI summaries |

### Frontend (.env.local)

| Variable | Required | Description |
|----------|----------|-------------|
| `VITE_API_URL` | Yes | Backend API URL |
| `VITE_WS_URL` | Yes | Backend WebSocket URL |

## Development

### Commands

```bash
# Backend
cd backend
uv run uvicorn src.main:app --reload    # Start dev server
uv run alembic upgrade head             # Run migrations
uv run alembic revision --autogenerate -m "description"  # Create migration
uv run ruff check .                     # Lint
uv run pytest                           # Test

# Frontend
cd frontend
npm run dev                             # Start dev server
npm run build                           # Production build
npm run lint                            # Lint
npm run test                            # Unit tests
```

### Project Structure

```
talkie/
├── backend/
│   ├── src/
│   │   ├── api/          # FastAPI routes
│   │   ├── core/         # Config, auth, database, middleware
│   │   ├── models/       # SQLAlchemy models
│   │   ├── schemas/      # Pydantic schemas
│   │   ├── services/     # Business logic
│   │   └── workers/      # Background tasks
│   ├── alembic/          # Database migrations
│   ├── docs/             # API documentation
│   └── tests/
│
├── frontend/
│   ├── src/
│   │   ├── components/   # React components
│   │   ├── pages/        # Route pages
│   │   ├── hooks/        # Custom hooks
│   │   ├── services/     # API clients
│   │   ├── stores/       # Zustand stores
│   │   ├── i18n/         # Translations (en, vi)
│   │   └── theme/        # MUI theming
│   └── tests/
│
├── colab-worker/
│   ├── worker/           # STT worker code
│   └── notebook.ipynb    # Colab notebook
│
├── specs/                # Design documents
└── docker-compose.yml
```

## Deployment

See [docs/deployment.md](docs/deployment.md) for production deployment, CI/CD, and operations guide.

## API Documentation

- **Swagger UI**: http://localhost:8000/docs
- **ReDoc**: http://localhost:8000/redoc
- **API Reference**: [backend/docs/api-reference.md](backend/docs/api-reference.md)

## Tech Stack

### Backend
- FastAPI + Uvicorn
- SQLAlchemy 2.0 (async)
- PostgreSQL + Redis + MinIO
- Pydantic v2

### Frontend
- React 18 + TypeScript
- Vite
- Material-UI (MUI)
- Zustand (state)
- i18next (i18n)

### Worker
- Faster-Whisper (STT)
- Silero VAD
- PyTorch

## License

Proprietary - All rights reserved.
