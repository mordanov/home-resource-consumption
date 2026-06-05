# Quickstart: Home Resource Consumption Tracker

**Date**: 2026-06-05

---

## Prerequisites

| Tool | Minimum version | Install |
|---|---|---|
| Docker | 24.x | https://docs.docker.com/get-docker/ |
| Docker Compose | v2.x (plugin) | Bundled with Docker Desktop |
| Git | Any recent | — |

No local Python, Node.js, or PostgreSQL installation is required — everything runs inside containers.

---

## 1. Clone and Configure

```bash
git clone <repo-url> resource-consumption-tracker
cd resource-consumption-tracker
cp .env.example .env
```

Edit `.env` and fill in:

```dotenv
# Required
JWT_SECRET_KEY=<generate with: openssl rand -hex 32>
OPENAI_API_KEY=sk-...

# Optional overrides (defaults shown)
OPENAI_MODEL=gpt-4o-mini
MAX_UPLOAD_SIZE_MB=20
CORS_ORIGINS=http://localhost:3000
ACCESS_TOKEN_EXPIRE_MINUTES=15
REFRESH_TOKEN_EXPIRE_DAYS=30
```

---

## 2. Start the Stack

```bash
docker compose up --build
```

This starts four services:
- **db** — PostgreSQL 16 on port 5432
- **backend** — FastAPI on port 8000 (Alembic migrations run on startup)
- **frontend** — React/Vite dev server on port 3000
- **nginx** — Reverse proxy on port 80 (`/api/` → backend, `/` → frontend)

First boot takes ~60 seconds while Docker pulls images and builds layers. Subsequent starts are under 10 seconds.

---

## 3. Verify the Stack

```bash
# Backend health check
curl http://localhost/api/v1/health
# Expected: {"status": "ok"}

# OpenAPI docs
open http://localhost/api/v1/docs

# Frontend
open http://localhost
```

---

## 4. Register Your Account

The application is single-user per deployment. Register once:

1. Visit `http://localhost/register`
2. Enter username, email, and a password meeting the strength policy (≥ 8 chars, uppercase, lowercase, digit)
3. You are redirected to the login page — log in to reach the dashboard

---

## 5. Upload Your First Bill

1. Click **"Upload Bill"** on the dashboard
2. Drag and drop a PDF or image of a utility bill
3. Select the resource type (Electricity / Gas / Water)
4. Wait for parsing (< 20 s) — a preview of extracted fields appears
5. Review and confirm — the bill is saved to your history

---

## 6. Run Tests

```bash
# All tests (requires the `test` Docker Compose profile)
docker compose --profile test run --rm backend-test

# Unit tests only (no DB required)
docker compose --profile test run --rm backend-test pytest tests/unit

# With coverage report
docker compose --profile test run --rm backend-test pytest --cov=app --cov-report=term-missing
```

---

## 7. Stop the Stack

```bash
docker compose down          # stop containers, keep volumes
docker compose down -v       # stop containers, delete volumes (wipes DB)
```

---

## Environment Variables Reference

| Variable | Required | Default | Description |
|---|---|---|---|
| `DATABASE_URL` | Yes* | set by compose | PostgreSQL connection string |
| `JWT_SECRET_KEY` | Yes | — | ≥ 256-bit random secret |
| `JWT_ALGORITHM` | No | `HS256` | JWT signing algorithm |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | No | `15` | Access token TTL |
| `REFRESH_TOKEN_EXPIRE_DAYS` | No | `30` | Refresh token TTL |
| `OPENAI_API_KEY` | Yes | — | OpenAI API key for bill parsing |
| `OPENAI_MODEL` | No | `gpt-4o-mini` | OpenAI model for extraction |
| `MAX_UPLOAD_SIZE_MB` | No | `20` | Max upload file size |
| `CORS_ORIGINS` | No | `http://localhost:3000` | Allowed CORS origins |
| `UPLOAD_DIR` | No | `/app/uploads` | Local path for uploaded files |

*`DATABASE_URL` is set automatically in `docker-compose.yml`; override only for external DB.

---

## Directory Structure

```
.
├── backend/                  # FastAPI application
│   ├── app/
│   │   ├── main.py           # App factory
│   │   ├── core/             # Config, DB, security, exceptions
│   │   ├── domain/           # ORM models, Pydantic schemas, enums
│   │   ├── repositories/     # Data access layer
│   │   ├── services/         # Business logic
│   │   │   ├── parser/       # LLM bill parsing
│   │   │   └── ml/           # Prediction service
│   │   ├── api/v1/           # HTTP routing layer
│   │   ├── templates/        # Jinja2 HTML template for PDF export
│   │   └── workers/          # Background tasks
│   ├── tests/
│   │   ├── unit/
│   │   ├── integration/
│   │   └── quality/          # Performance + security gate tests
│   ├── alembic/              # DB migrations
│   ├── Dockerfile
│   └── pyproject.toml
├── frontend/                 # React 18 + TypeScript + HeroUI
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── lib/              # Axios instance, React Query setup, queryKeys
│   │   └── store/            # Zustand auth store
│   ├── Dockerfile
│   └── vite.config.ts
├── nginx/
│   └── nginx.conf
├── docker-compose.yml
├── docker-compose.test.yml   # Test profile
├── .env.example
└── documentation/            # Spec Kit documentation
    └── specs/001-resource-consumption-tracker/
```
