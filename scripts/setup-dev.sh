#!/usr/bin/env bash
set -euo pipefail

# Talkie Development Setup Script
# Usage: ./scripts/setup-dev.sh

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[OK]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

DOCKER_AVAILABLE=true
MIGRATIONS_SKIPPED=false

check_command() {
    if ! command -v "$1" &> /dev/null; then
        log_error "$1 is not installed. Please install it first."
        return 1
    fi
    log_success "$1 found"
}

check_docker_access() {
    if docker info > /dev/null 2>&1; then
        log_success "Docker daemon accessible"
        return 0
    fi

    log_warn "Docker is installed but the daemon is not accessible"
    log_warn "Infrastructure startup will be skipped"
    log_warn "Fix Docker access (for example: start Docker or add your user to the docker group)"
    return 1
}

echo "========================================"
echo "  Talkie Development Setup"
echo "========================================"
echo ""

log_info "Checking prerequisites..."
check_command docker
check_command node
check_command npm
check_command python3
if ! check_docker_access; then
    DOCKER_AVAILABLE=false
fi

if command -v uv &> /dev/null; then
    log_success "uv found"
    USE_UV=true
else
    log_warn "uv not found, will use pip instead"
    USE_UV=false
fi

echo ""
log_info "Starting infrastructure services..."
cd "$ROOT_DIR"
if [ "$DOCKER_AVAILABLE" = true ]; then
    docker compose up -d

    log_info "Waiting for services to be healthy..."
    sleep 5

    if docker compose ps | grep -q "healthy"; then
        log_success "Infrastructure services are running"
    else
        log_warn "Some services may not be healthy yet. Check with: docker compose ps"
    fi
else
    log_warn "Skipping infrastructure startup because Docker is unavailable"
fi

echo ""
log_info "Setting up backend..."
cd "$ROOT_DIR/backend"

if [ ! -d ".venv" ]; then
    if [ "$USE_UV" = true ]; then
        uv venv
    else
        python3 -m venv .venv
    fi
    log_success "Created Python virtual environment"
fi

source .venv/bin/activate

if [ "$USE_UV" = true ]; then
    uv pip install -r requirements.txt -r requirements-dev.txt
else
    pip install -r requirements.txt -r requirements-dev.txt
fi
log_success "Installed backend dependencies"

if [ ! -f ".env" ]; then
    cp .env.example .env
    log_success "Created .env from example"
    log_warn "Please edit backend/.env with your settings"
else
    log_info ".env already exists, skipping"
fi

if [ "$DOCKER_AVAILABLE" = true ]; then
    if [ "$USE_UV" = true ]; then
        uv run alembic upgrade head
    else
        alembic upgrade head
    fi
    log_success "Database migrations applied"
else
    MIGRATIONS_SKIPPED=true
    log_warn "Skipping database migrations because infrastructure is not running"
fi

echo ""
log_info "Setting up frontend..."
cd "$ROOT_DIR/frontend"

npm install
log_success "Installed frontend dependencies"

if [ ! -f ".env.local" ]; then
    cp .env.example .env.local
    log_success "Created .env.local from example"
else
    log_info ".env.local already exists, skipping"
fi

echo ""
echo "========================================"
echo -e "${GREEN}  Setup Complete!${NC}"
echo "========================================"
echo ""
echo "To start development:"
echo ""
echo "  Terminal 1 (Backend):"
echo "    cd backend && source .venv/bin/activate"
echo "    uv run uvicorn src.main:app --reload --port 8000"
echo ""
echo "  Terminal 2 (Frontend):"
echo "    cd frontend && npm run dev"
echo ""
echo "  Open: http://localhost:5173"
echo ""
echo "Services:"
echo "  PostgreSQL: localhost:6201"
echo "  Redis:      localhost:6202"
echo "  MinIO:      localhost:6203 (API), localhost:6204 (Console)"
echo ""

if [ "$MIGRATIONS_SKIPPED" = true ]; then
    log_warn "Backend dependencies were installed, but infra and migrations were skipped"
    log_warn "After fixing Docker access, run: docker compose up -d && cd backend && source .venv/bin/activate && uv run alembic upgrade head"
fi
