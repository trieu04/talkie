.PHONY: help dev dev-backend dev-frontend infra infra-down migrate lint test build deploy logs clean

SHELL := /bin/bash

help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | \
		awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-20s\033[0m %s\n", $$1, $$2}'

# ── Development ─────────────────────────────────────────

setup: ## One-time dev environment setup
	./scripts/setup-dev.sh

infra: ## Start infrastructure (Postgres, Redis, MinIO)
	docker compose up -d

infra-down: ## Stop infrastructure
	docker compose down

infra-reset: ## Stop infrastructure and delete volumes
	docker compose down -v

dev-backend: ## Start backend dev server
	cd backend && source .venv/bin/activate && uv run uvicorn src.main:app --host 0.0.0.0 --reload --port 8001

dev-frontend: ## Start frontend dev server
	cd frontend && npm run dev

dev: ## Start both backend and frontend (requires tmux)
	@command -v tmux >/dev/null 2>&1 || { echo "tmux required. Install with: apt install tmux"; exit 1; }
	tmux new-session -d -s talkie-dev 'make dev-backend' \; \
		split-window -h 'make dev-frontend' \; \
		attach

# ── Database ────────────────────────────────────────────

migrate: ## Run database migrations
	cd backend && source .venv/bin/activate && uv run alembic upgrade head

migrate-new: ## Create new migration (usage: make migrate-new MSG="add users table")
	cd backend && source .venv/bin/activate && uv run alembic revision --autogenerate -m "$(MSG)"

migrate-down: ## Rollback one migration
	cd backend && source .venv/bin/activate && uv run alembic downgrade -1

# ── Quality ─────────────────────────────────────────────

lint: ## Run all linters
	cd backend && source .venv/bin/activate && uv run ruff check .
	cd frontend && npm run lint

lint-fix: ## Auto-fix lint issues
	cd backend && source .venv/bin/activate && uv run ruff check . --fix
	cd frontend && npm run lint:fix

format: ## Format code
	cd backend && source .venv/bin/activate && uv run ruff format .
	cd frontend && npm run format

test: ## Run all tests
	cd backend && source .venv/bin/activate && uv run pytest -x -v
	cd frontend && npm run test -- --run

test-backend: ## Run backend tests only
	cd backend && source .venv/bin/activate && uv run pytest -x -v

test-frontend: ## Run frontend tests only
	cd frontend && npm run test -- --run

test-coverage: ## Run tests with coverage
	cd backend && source .venv/bin/activate && uv run pytest --cov=src --cov-report=html

# ── Production Build ────────────────────────────────────

build: ## Build production Docker images
	docker compose -f docker-compose.prod.yml build

build-backend: ## Build backend image only
	docker build -t talkie-backend:latest ./backend

build-frontend: ## Build frontend image only
	docker build -t talkie-frontend:latest \
		--build-arg VITE_API_URL=/api \
		--build-arg VITE_WS_URL=/ws \
		./frontend

# ── Production Deploy ───────────────────────────────────

deploy: ## Deploy production stack
	@test -f .env.prod || { echo "Error: .env.prod not found. Copy .env.prod.example and fill in values."; exit 1; }
	docker compose -f docker-compose.prod.yml --env-file .env.prod up -d --build
	@echo "Waiting for services..."
	@sleep 10
	docker compose -f docker-compose.prod.yml --env-file .env.prod ps

deploy-migrate: ## Run migrations in production
	docker compose -f docker-compose.prod.yml exec backend alembic upgrade head

deploy-down: ## Stop production stack
	docker compose -f docker-compose.prod.yml --env-file .env.prod down

deploy-logs: ## Tail production logs
	docker compose -f docker-compose.prod.yml --env-file .env.prod logs -f

# ── Utility ─────────────────────────────────────────────

logs: ## Tail dev infrastructure logs
	docker compose logs -f

clean: ## Remove build artifacts and caches
	rm -rf backend/.pytest_cache backend/.ruff_cache backend/__pycache__
	rm -rf frontend/dist frontend/node_modules/.cache
	find . -type d -name __pycache__ -exec rm -rf {} + 2>/dev/null || true

status: ## Show service status
	@echo "=== Infrastructure ==="
	@docker compose ps 2>/dev/null || echo "Not running"
	@echo ""
	@echo "=== Production ==="
	@docker compose -f docker-compose.prod.yml ps 2>/dev/null || echo "Not running"
