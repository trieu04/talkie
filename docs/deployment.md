# Talkie — Deployment Guide

## Table of Contents

- [Architecture Overview](#architecture-overview)
- [Prerequisites](#prerequisites)
- [Local Development](#local-development)
- [Production Deployment](#production-deployment)
- [CI/CD Pipeline](#cicd-pipeline)
- [Operations](#operations)
- [Security Checklist](#security-checklist)

---

## Architecture Overview

```
                        ┌─────────────┐
                        │   Traefik   │  ← TLS termination, routing
                        │   :80/:443  │
                        └──────┬──────┘
                   ┌───────────┼───────────┐
                   │           │           │
              /api, /ws       /         /minio (opt)
                   │           │           │
            ┌──────▼──────┐ ┌──▼───────┐  │
            │   Backend   │ │ Frontend │  │
            │  FastAPI    │ │  nginx   │  │
            │    :8000    │ │   :80    │  │
            └──────┬──────┘ └──────────┘  │
                   │                      │
       ┌───────────┼───────────┐          │
       │           │           │          │
┌──────▼──┐ ┌─────▼────┐ ┌────▼───┐ ┌────▼────┐
│ Postgres │ │  Redis   │ │ MinIO  │ │  Colab  │
│  :5432   │ │  :6379   │ │ :9000  │ │ Worker  │
└──────────┘ └──────────┘ └────────┘ └─────────┘
```

**Services:**

| Service | Purpose | Port (dev) | Port (prod) |
|---------|---------|------------|-------------|
| PostgreSQL | Database | 6201 | internal |
| Redis | Pub/Sub, caching | 6202 | internal |
| MinIO | Audio file storage (S3-compatible) | 6203/6204 | internal |
| Backend | FastAPI REST + WebSocket | 8000 | internal |
| Frontend | React SPA via nginx | 5173 | internal |
| Traefik | Reverse proxy, TLS | — | 80/443 |
| Colab Worker | GPU transcription (external) | — | — |

---

## Prerequisites

| Tool | Version | Check |
|------|---------|-------|
| Docker | 24+ | `docker --version` |
| Docker Compose | v2+ | `docker compose version` |
| Node.js | 20+ | `node --version` |
| Python | 3.11+ | `python3 --version` |
| uv | latest | `uv --version` |
| make | any | `make --version` |

---

## Local Development

### Quick Start (automated)

```bash
make setup    # One-time: installs deps, creates .env files, runs migrations
make infra    # Start PostgreSQL, Redis, MinIO
make dev      # Start backend + frontend in tmux
```

### Manual Start

```bash
# Terminal 1: Infrastructure
make infra

# Terminal 2: Backend
make dev-backend

# Terminal 3: Frontend
make dev-frontend

# Open http://localhost:5173
```

### Available Make Targets

Run `make help` for the full list. Key commands:

| Command | Description |
|---------|-------------|
| `make setup` | One-time development setup |
| `make infra` | Start infrastructure services |
| `make dev` | Start backend + frontend (tmux) |
| `make migrate` | Run database migrations |
| `make migrate-new MSG="..."` | Create a new migration |
| `make lint` | Run all linters |
| `make test` | Run all tests |
| `make build` | Build production Docker images |
| `make deploy` | Deploy production stack |

### Environment Files

| File | Purpose | Template |
|------|---------|----------|
| `backend/.env` | Backend dev config | `backend/.env.example` |
| `frontend/.env.local` | Frontend dev config | `frontend/.env.example` |
| `.env.prod` | Production secrets | `.env.prod.example` |

---

## Production Deployment

### Option A: Single-Server Docker Compose

Best for: Small teams, demos, staging environments.

#### 1. Prepare the server

```bash
# On a fresh Ubuntu 22.04+ server
sudo apt update && sudo apt install -y docker.io docker-compose-v2 make
sudo usermod -aG docker $USER
# Log out and back in
```

#### 2. Clone and configure

```bash
git clone <repo-url> /opt/talkie
cd /opt/talkie

# Create production environment file
cp .env.prod.example .env.prod
```

Edit `.env.prod` — every `CHANGE_ME` value must be replaced:

```bash
# Required changes:
DOMAIN=talkie.yourdomain.com
ACME_EMAIL=you@yourdomain.com
POSTGRES_PASSWORD=<generate: openssl rand -hex 32>
REDIS_PASSWORD=<generate: openssl rand -hex 32>
MINIO_ROOT_USER=<generate: openssl rand -hex 16>
MINIO_ROOT_PASSWORD=<generate: openssl rand -hex 32>
JWT_SECRET=<generate: openssl rand -hex 32>

# Optional (enable features):
GOOGLE_TRANSLATE_API_KEY=<your-key>
OPENAI_API_KEY=<your-key>
```

#### 3. Deploy

```bash
make deploy            # Build images + start all services
make deploy-migrate    # Run database migrations
```

#### 4. Verify

```bash
curl -f https://talkie.yourdomain.com/api/health
# {"status": "healthy", "version": "0.1.0"}
```

#### 5. DNS

Point your domain's A record to the server IP. Traefik handles TLS via Let's Encrypt automatically.

### Option B: Container Registry + Remote Deploy

Best for: Teams with CI/CD, multi-environment setups.

#### 1. Push images to GitHub Container Registry

This happens automatically via CI on push to `main` or on tagged releases.

```bash
# Manual push:
docker login ghcr.io -u <github-user>
make build
docker tag talkie-backend:latest ghcr.io/<org>/talkie/backend:v1.0.0
docker tag talkie-frontend:latest ghcr.io/<org>/talkie/frontend:v1.0.0
docker push ghcr.io/<org>/talkie/backend:v1.0.0
docker push ghcr.io/<org>/talkie/frontend:v1.0.0
```

#### 2. On the target server

```bash
docker login ghcr.io -u <github-user>
VERSION=v1.0.0 docker compose -f docker-compose.prod.yml --env-file .env.prod up -d
```

### Colab Worker (GPU Transcription)

The Colab worker runs externally on Google Colab (free GPU).

1. Open `colab-worker/notebook.ipynb` in Google Colab
2. Enable GPU runtime: Runtime → Change runtime type → GPU
3. Set `SERVER_URL` to your production backend URL
4. Run all cells

For persistent workers, consider:
- **Google Cloud Run GPU** (when available)
- **AWS EC2 with GPU** (g4dn.xlarge)
- **Lambda Labs** or **RunPod** for dedicated GPU

---

## CI/CD Pipeline

### Workflows

| File | Trigger | Jobs |
|------|---------|------|
| `.github/workflows/ci.yml` | Push to main, PRs | Lint, test, build images |
| `.github/workflows/deploy.yml` | Tags `v*`, manual | Build, push, deploy |

### CI Pipeline (every push/PR)

```
┌──────────────┐  ┌───────────────┐  ┌───────────────┐  ┌──────────────┐
│ backend-lint │  │ backend-test  │  │ frontend-lint │  │frontend-test │
│  ruff check  │  │ pytest + cov  │  │  eslint       │  │ vitest + cov │
└──────┬───────┘  └───────┬───────┘  └───────┬───────┘  └──────┬───────┘
       │                  │                   │                 │
       └──────────────────┴─────────┬─────────┴─────────────────┘
                                    │
                          ┌─────────▼──────────┐
                          │   docker-build     │  ← only on main
                          │  push to ghcr.io   │
                          └────────────────────┘
```

### Deploy Pipeline

| Trigger | Environment |
|---------|-------------|
| Tag `v1.0.0-rc1` | Staging |
| Tag `v1.0.0` | Production |
| Manual dispatch | Choice |

### Required GitHub Secrets

| Secret | Purpose |
|--------|---------|
| `STAGING_SSH_KEY` | SSH private key for staging server |
| `STAGING_HOST` | Staging server IP/hostname |
| `STAGING_USER` | SSH user on staging |
| `PROD_SSH_KEY` | SSH private key for production |
| `PROD_HOST` | Production server IP/hostname |
| `PROD_USER` | SSH user on production |

---

## Operations

### Logs

```bash
make deploy-logs                                          # All services
docker compose -f docker-compose.prod.yml logs backend    # Single service
docker compose -f docker-compose.prod.yml logs -f --tail=100 backend
```

### Database Backup

```bash
# Backup
docker compose -f docker-compose.prod.yml exec postgres \
  pg_dump -U talkie talkie | gzip > backup_$(date +%Y%m%d).sql.gz

# Restore
gunzip -c backup_20260405.sql.gz | \
  docker compose -f docker-compose.prod.yml exec -T postgres \
  psql -U talkie talkie
```

### Rolling Updates

```bash
# Pull new images and recreate only changed services
VERSION=v1.1.0 docker compose -f docker-compose.prod.yml --env-file .env.prod up -d --no-deps backend
VERSION=v1.1.0 docker compose -f docker-compose.prod.yml --env-file .env.prod up -d --no-deps frontend
```

### Health Checks

```bash
# Backend health
curl -f https://yourdomain.com/api/health

# Service status
docker compose -f docker-compose.prod.yml ps

# Resource usage
docker stats --no-stream
```

### Scaling (future)

The architecture supports horizontal scaling:

- **Backend**: Stateless — scale with `docker compose up --scale backend=3`
- **Frontend**: Static files — CDN or multiple nginx containers
- **Worker**: Run multiple Colab instances with unique `--worker-id`

---

## Security Checklist

Before going to production:

- [ ] All `CHANGE_ME` values replaced in `.env.prod`
- [ ] `JWT_SECRET` is at least 32 random characters
- [ ] `POSTGRES_PASSWORD` is strong and unique
- [ ] `REDIS_PASSWORD` is set (not empty)
- [ ] `MINIO_ROOT_PASSWORD` is strong and unique
- [ ] `DEBUG=false` in production
- [ ] `LOG_LEVEL=WARNING` or higher
- [ ] TLS enabled (Traefik + Let's Encrypt)
- [ ] Database not exposed to public network
- [ ] Redis not exposed to public network
- [ ] MinIO not exposed to public network
- [ ] `.env.prod` is in `.gitignore`
- [ ] No secrets committed to git
- [ ] CORS origins restricted to your domain
- [ ] Rate limiting enabled on auth endpoints
