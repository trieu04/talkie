# talkie Development Guidelines

Auto-generated from all feature plans. Last updated: 2026-04-04

## Active Technologies

- TypeScript 5.x (frontend), Python 3.11+ (backend), Python (Colab worker) + React + Vite, Zustand, MUI (frontend); FastAPI, SQLAlchemy 2.0, Dramatiq (backend); Faster-Whisper turbo (STT) (007-realtime-meeting-transcription)

## Project Structure

```text
src/
tests/
```

## Commands

cd src [ONLY COMMANDS FOR ACTIVE TECHNOLOGIES][ONLY COMMANDS FOR ACTIVE TECHNOLOGIES] pytest [ONLY COMMANDS FOR ACTIVE TECHNOLOGIES][ONLY COMMANDS FOR ACTIVE TECHNOLOGIES] ruff check .

## Code Style

TypeScript 5.x (frontend), Python 3.11+ (backend), Python (Colab worker): Follow standard conventions

## Recent Changes

- 007-realtime-meeting-transcription: Added TypeScript 5.x (frontend), Python 3.11+ (backend), Python (Colab worker) + React + Vite, Zustand, MUI (frontend); FastAPI, SQLAlchemy 2.0, Dramatiq (backend); Faster-Whisper turbo (STT)

<!-- MANUAL ADDITIONS START -->
## Commit Guidelines

- One commit must represent one major task.
- Group implementation changes with the tests that verify that same task.
- Do not split a single major task across multiple tiny commits unless the split is required to keep the tree valid.
- When rewriting history, prefer regrouping by user-visible task boundary (backend replay support, frontend replay UX, worker tuning, docs/tooling) instead of by file type alone.
- Keep commit messages in semantic format: `feat: ...`, `fix: ...`, `test: ...`, `build: ...`, `docs: ...`.
<!-- MANUAL ADDITIONS END -->
