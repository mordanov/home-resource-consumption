# Home Resource Consumption Tracker

A full-stack web application for ingesting utility bills (electricity, gas, water), extracting structured data via LLM, and forecasting future consumption via ML.

## Prerequisites

- [Docker](https://docs.docker.com/get-docker/) ≥ 24
- [Docker Compose](https://docs.docker.com/compose/install/) v2 (`docker compose` command)
- A valid [OpenAI API key](https://platform.openai.com/account/api-keys)

## Quick Start

### 1. Configure environment

```bash
cp .env.example .env
```

Edit `.env` and set at minimum:

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | Yes | Postgres DSN — keep default for Docker Compose |
| `OPENAI_API_KEY` | Yes | OpenAI API key for bill parsing |
| `OPENAI_MODEL` | No | Default: `gpt-4o-mini` |
| `JWT_SECRET_KEY` | Yes | 64-char hex string — generate with `python -c "import secrets; print(secrets.token_hex(32))"` |
| `JWT_ALGORITHM` | No | Default: `HS256` |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | No | Default: `15` |
| `REFRESH_TOKEN_EXPIRE_DAYS` | No | Default: `7` |
| `CORS_ORIGINS` | No | Default: `["http://localhost", "http://localhost:3000"]` |
| `MAX_UPLOAD_SIZE_MB` | No | Default: `10` |
| `UPLOAD_DIR` | No | Default: `/app/uploads` |

### 2. Start the full stack

```bash
docker compose up --build
```

Services started:
- **Frontend** — React app at [http://localhost](http://localhost)
- **API** — FastAPI at [http://localhost/api/v1](http://localhost/api/v1)
- **OpenAPI docs** — [http://localhost/api/v1/docs](http://localhost/api/v1/docs)
- **Database** — PostgreSQL on port `5432`

Database migrations run automatically on backend startup (`alembic upgrade head`).

### 3. Register and log in

Open [http://localhost](http://localhost), create an account, and start uploading bills.

---

## Development

### Backend only

```bash
cd backend
pip install -e .
uvicorn app.main:app --reload --port 8000
```

### Frontend only

```bash
cd frontend
npm install
npm run dev
```

### Run tests

```bash
docker compose -f docker-compose.test.yml --profile test run backend-test
```

Or locally:

```bash
cd backend
pytest tests/ -v --cov=app
```

### Lint and type-check

```bash
cd backend
ruff check app/
mypy --strict app/
```

---

## Tailing logs

```bash
# Backend structured JSON logs
docker compose logs -f backend

# All services
docker compose logs -f
```

---

## Rollback procedure

If a deployment fails after a migration:

```bash
# 1. Stop all services
docker compose down

# 2. Revert the last migration (if one was included in this release)
docker compose run --rm backend alembic downgrade -1

# 3. Restart from the previous image tag
docker compose up --build
```

To revert to a specific revision:

```bash
docker compose run --rm backend alembic downgrade <revision-id>
```

---

## Architecture

```
nginx:80  →  /api/*   →  backend:8000 (FastAPI + Alembic + structlog)
          →  /*       →  frontend:3000 (React/Vite + HeroUI)
                           ↕
                        db:5432 (PostgreSQL 16)
```

See `documentation/specs/001-resource-consumption-tracker/` for full specification.
