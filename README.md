# Online Retail Platform — DevOps Portfolio Project

> A containerized full-stack e-commerce application with a React frontend, Node.js/Express REST API, and PostgreSQL persistence. Designed as a portfolio piece to demonstrate: multi-stage Docker builds, Docker Compose service orchestration, database containerization with health checks and persistent volumes, 12-factor configuration, and production-grade image hardening.

---

## 🏗 Architecture Overview

```
                          ┌──────────────────────────────────────────────────┐
                          │              Docker Compose Network              │
                          │                                                  │
  Browser ──:5001────────▶│  ┌─────────────────┐          ┌───────────────┐  │
  (or :3000 in dev)       │  │  web (Express)  │ :5432    │  db (Postgres) │  │
                          │  │                 │──────────▶               │  │
                          │  │  - API (REST)   │          │  - products    │  │
                          │  │  - Static files │          │  - cart_items  │  │
                          │  │    (React build)│          │  - orders      │  │
                          │  └─────────────────┘          │  - order_items │  │
                          │          │                     └───────────────┘  │
                          │          │                             ▲           │
                          └──────────┼─────────────────────────────┼───────────┘
                                     │                             │
                                     ▼                             │
                              named volume                        │
                               pgdata ─────────────────────────────┘
                          (persists DB across container restarts)
```

**Request flow (Docker production):**
1. Browser hits `http://HOST:5001` → nginx-less setup; Express serves static React assets directly.
2. React app makes REST calls to `/api/*` → same Express server routes them to SQL queries.
3. Express connects to Postgres over the Compose internal network using the service hostname `db`.

**Request flow (local dev):**
1. Browser → Vite dev server on `:3000`.
2. Vite proxies `/api/*` → Express API on `:5000` (see [vite.config.js](client/vite.config.js)).
3. Express → Postgres on `localhost:5432` or `localhost:5433` (via `.env`).

---

## 🧰 Tech Stack

| Layer | Technology | Version | Purpose |
|---|---|---|---|
| Frontend | React + React Router + Vite | React 18 / Vite 5 | Store UI, routing, dev server |
| Backend API | Node.js + Express | Node 20 / Express 4 | REST endpoints, static hosting |
| Database | PostgreSQL | 16 Alpine | Persistent relational storage |
| DB Driver | `node-postgres` (`pg`) | 8.x | Connection pooling + parameterized queries |
| Configuration | `dotenv` | 16.x | 12-factor style env-variable loading |
| Container Runtime | Docker Engine | 24+ | Image building & execution |
| Orchestration | Docker Compose | v2 (plugin) | Multi-service lifecycle, volumes, health checks |
| Build Strategy | Multi-stage Dockerfile | — | Small final image, cached npm installs |
| Data seeding | Idempotent SQL (`ON CONFLICT DO NOTHING`) | — | Automatic on app boot |

---

## 📁 Project Structure

```
Online-Retail-API/
├── .env.example                  # Template for env vars (safe to commit)
├── .env                          # YOUR credentials (gitignored — see .gitignore)
├── .gitignore                    # Ignores secrets, node_modules, dist
├── .dockerignore                 # Excludes node_modules, secrets from build context
├── .trae/
│   └── documents/
│       └── postgres_integration_plan.md  # Original impl plan (audit trail)
│
├── server/                       # Express API + PostgreSQL
│   ├── index.js                  # 10 REST endpoints + static serving + DB bootstrap
│   ├── db.js                     # pg.Pool singleton, loads root .env explicitly
│   ├── init.sql                  # Schema + 6 seed products (idempotent)
│   ├── package.json              # pg, dotenv, express, cors, uuid
│   └── package-lock.json
│
├── client/                       # React + Vite frontend
│   ├── src/
│   │   ├── components/           # Navbar.jsx, ProductCard.jsx
│   │   ├── pages/                # ProductList, ProductDetail, Cart, Orders
│   │   ├── context/CartContext   # Global cart state (React Context API)
│   │   └── styles/global.css
│   ├── index.html
│   ├── vite.config.js            # Dev proxy → localhost:5000/api
│   ├── package.json
│   └── package-lock.json
│
├── Dockerfile                    # 3-stage build → ~150MB final Alpine image
├── docker-compose.yml            # 2 services: db (postgres) + web (express+react)
├── package.json                  # Root convenience scripts
└── README.md                     # ← you are here
```

---

## 🗄 Database Schema (4 tables)

Automatically created & seeded by [server/init.sql](server/init.sql) on every app startup (safe to re-run — uses `IF NOT EXISTS` + `ON CONFLICT DO NOTHING`).

```
┌──────────────────────────┐
│ products                 │  ← 6 seed rows (catalog, never changes)
├──────────────────────────┤
│ id          VARCHAR(32) PK  (e.g. "p1")
│ name        VARCHAR(255)
│ description TEXT
│ price       NUMERIC(10,2)
│ category    VARCHAR(100)
│ stock       INTEGER
│ image       TEXT (URL)
│ created_at  TIMESTAMPTZ   DEFAULT NOW()
└──────────────────────────┘
           ▲
           │  1:N FK product_id
           │
┌──────────────────────────┐     ┌──────────────────────────┐
│ cart_items               │     │ orders                   │
├──────────────────────────┤     ├──────────────────────────┤
│ id          SERIAL PK     │     │ id          UUID PK       │
│ product_id  FK→products  │     │ customer_name VARCHAR     │
│ quantity    INTEGER      │     │ email       VARCHAR       │
│ created_at  TIMESTAMPTZ  │     │ total       NUMERIC(10,2) │
│ UNIQUE(product_id)       │     │ status      VARCHAR(50)   │
└──────────────────────────┘     │ created_at  TIMESTAMPTZ  │
                                 └──────────────────────────┘
                                               ▲
                                               │  1:N FK order_id
                                               │
                                 ┌──────────────────────────┐
                                 │ order_items              │  ← snapshot of item
                                 ├──────────────────────────┤    price/qty at time
                                 │ id          SERIAL PK     │    of purchase
                                 │ order_id    FK→orders    │
                                 │ product_id  FK→products  │
                                 │ name        VARCHAR(255) │
                                 │ price       NUMERIC(10,2)│
                                 │ quantity    INTEGER      │
                                 │ subtotal    NUMERIC(10,2)│
                                 └──────────────────────────┘
```

**Ordering is a single DB transaction** in [server/index.js](server/index.js#L303-L350):
`BEGIN → read cart → INSERT order → INSERT order_items → TRUNCATE cart_items → COMMIT`
(rolls back on any failure).

---

## ⚙️ Environment Variables

Loaded by [server/db.js](server/db.js#L1-L3) in this priority order:
1. Root `.env` file (`/project/.env`)
2. Local `server/.env` (overrides above if present)
3. Real shell environment variables (Docker Compose / Cloud provider — highest priority)

| Variable | Example Value | Required | Purpose |
|---|---|---|---|
| `DATABASE_URL` | `postgresql://retail_user:retail_pass@localhost:5432/retail_db` | ✅ | Postgres connection string |
| `PORT` | `5000` | ❌ | Express listen port (default 5000) |
| `NODE_ENV` | `development` / `production` | ❌ | Used by Express; toggled automatically in Compose |

**Compose-provided overrides:**

Inside `docker-compose.yml` the web service gets `DATABASE_URL=postgresql://retail_user:retail_pass@db:5432/retail_db` — note the hostname `db` (the Compose service name, **not** localhost). Only containers talk over this network.

---

## 🚀 Quick Start — 3 Ways to Run

### ✅ Option 1: Docker Compose (RECOMMENDED — portfolio demo, fully self-contained)

**Requirements:** Docker Engine + Docker Compose plugin

```bash
# 1. Build both images and start in background
docker compose up -d --build

# 2. View logs to confirm healthy startup
docker compose logs --tail=30
#   Expected:
#     online-retail-db   | PostgreSQL init process complete; ready for start up
#     online-retail-api  | Database schema initialized
#     online-retail-api  | Server running on http://localhost:5000

# 3. Open the app
open http://localhost:5001      # macOS
# or visit http://localhost:5001 manually
```

Ports exposed on your host:
- `5001` → Express web app + React UI
- `5433` → PostgreSQL (use with TablePlus / pgAdmin to inspect data)

To stop and wipe **everything including DB data**:
```bash
docker compose down -v
```
To stop but **keep** data for next run (volume persists):
```bash
docker compose down
```

---

### Option 2: Local Dev (Vite hot reload + Express + Postgres via Docker)

Best for coding — fast rebuilds, live React HMR.

```bash
# 1. Start ONLY Postgres in Docker (saves installing Postgres locally)
docker compose up -d db

# 2. Copy env template and point to the containerized Postgres (port 5433)
cp .env.example .env
# Then edit .env: swap comments so DATABASE_URL uses port 5433 (not 5432)
# DATABASE_URL=postgresql://retail_user:retail_pass@localhost:5433/retail_db

# 3. Install all dependencies
npm run install:all

# 4. Start backend (terminal 1)
npm run server          # → http://localhost:5000

# 5. Start frontend (terminal 2)
npm run client          # → http://localhost:3000  (proxies /api → :5000)
```

Open **http://localhost:3000** for the React dev server (HMR on save).

---

### Option 3: Standalone Docker image (no Compose)

```bash
# Requires an external Postgres reachable on $DATABASE_URL
docker build -t online-retail-api .
docker run -p 5000:5000 \
  -e DATABASE_URL=postgresql://user:pass@your-db-host:5432/retail \
  online-retail-api
```

---

## 🔌 REST API Reference

All endpoints live under `/api`. All JSON bodies use `Content-Type: application/json`.

| # | Method | Endpoint | Body / Query | Success | Failure |
|---|---|---|---|---|---|
| 1 | `GET` | `/api/products` | `?category=Electronics` (optional) | 200 `[{...product}]` | — |
| 2 | `GET` | `/api/products/:id` | — | 200 product object | 404 `{error: "Product not found"}` |
| 3 | `GET` | `/api/cart` | — | 200 `{ items:[...], total:number }` | — |
| 4 | `POST` | `/api/cart` | `{ "productId":"p1", "quantity":2 }` | 201 new cart state | 404 product missing |
| 5 | `PUT` | `/api/cart/:productId` | `{ "quantity": 3 }` (0 removes item) | 200 new cart state | 404 not in cart |
| 6 | `DELETE` | `/api/cart/:productId` | — | 200 new cart state | 404 not in cart |
| 7 | `DELETE` | `/api/cart` | — | 200 `{items:[],total:0}` | — |
| 8 | `GET` | `/api/orders` | — | 200 `[{...order with items[]}]` | — |
| 9 | `POST` | `/api/orders` | `{ "customerName":"X", "email":"a@b.c" }` | 201 new order | 400 missing fields / empty cart |
| 10 | `GET` | `/api` | — | 200 endpoint index | — |

**Example flow (curl):**
```bash
BASE=http://localhost:5001/api
curl -s $BASE/products | jq length                         # → 6
curl -s -X POST $BASE/cart -H 'Content-Type: application/json' \
  -d '{"productId":"p1","quantity":2}' | jq .total         # → 299.98
curl -s -X POST $BASE/orders -H 'Content-Type: application/json' \
  -d '{"customerName":"Demo","email":"d@d.com"}' | jq .id  # → UUID
curl -s $BASE/orders | jq length                           # → 1
```

---

## 🐳 Docker Build Strategy (Multi-Stage, 3 Phases)

See [Dockerfile](Dockerfile) — tuned for DevOps interview talking points.

```
          ┌────────────────────────────────────────────────────────────┐
STAGE 1   │  client-build   node:20-alpine   (≈900MB, discarded)      │
          │  • npm ci (client package*.json only → layer cache)        │
          │  • copy client source                                        │
          │  • npm run build → dist/ (static React bundle ~180KB)       │
          └──────────────────────────┬─────────────────────────────────┘
                                     │ COPY dist/ ────────────────┐
          ┌──────────────────────────▼────────────────────────┐   │
STAGE 2   │  server-deps   node:20-alpine   (discarded)       │   │
          │  • npm ci --omit=dev (87 prod packages only)       │   │
          └──────────────────────────┬─────────────────────────┘   │
                                     │ COPY node_modules ────┐     │
          ┌──────────────────────────▼────────────────────────▼─────▼───────┐
STAGE 3   │  FINAL   node:20-alpine   (≈150MB, runs in production)          │
(RUNTIME) │  • Non-root user: appuser:appgroup (least privilege)            │
          │  • server/node_modules ← from stage-2                          │
          │  • server/ code (index.js, db.js, init.sql)                    │
          │  • server/public     ← React dist/ from stage-1                 │
          │  • PORT=5000, NODE_ENV=production                               │
          │  • CMD ["node", "server/index.js"]                              │
          └─────────────────────────────────────────────────────────────────┘
```

**Why this matters (portfolio points):**

| Technique | Benefit |
|---|---|
| Multi-stage build | Small runtime image (~150MB vs ~1GB single stage), no dev dependencies in prod |
| Copy `package*.json` BEFORE source | NPM installs are **cached** by Docker layer — only re-run when deps change |
| `npm ci --omit=dev` | Production-only Node modules (no `nodemon`, `vite`, etc.) |
| `node:*-alpine` base | Minimal attack surface, tiny footprint |
| Non-root `appuser` | Container can't modify filesystem outside `/app` |
| `.dockerignore` excludes `node_modules`, `.env` | Smaller build context, **prevents leaking secrets** into image layers |

Layer savings verified:
- client-build + server-deps stages: **discarded entirely**
- Final image contains: Alpine OS + Node runtime + 87 npm prod packages + React dist + server code = **~150 MB**

---

## 🎼 Docker Compose Topology

Defined in [docker-compose.yml](docker-compose.yml).

| Service | Image | Ports | Volume | Healthcheck | Depends On |
|---|---|---|---|---|---|
| `db` | `postgres:16-alpine` | `5433:5432` | `pgdata` → `/var/lib/postgresql/data` | `pg_isready -U retail_user -d retail_db` (5s interval, 5 retries) | — |
| `web` | `online-retail-api:latest` (built locally) | `5001:5000` | — | — | `db` (condition: **service_healthy**) |
| Top-level volume | **`pgdata`** (named) | — | Persists Postgres WAL, tables, indexes across `docker compose down` | — | — |

**Why `depends_on.condition: service_healthy` and not just `depends_on`?**
A plain `depends_on` only waits for container *start*. Postgres typically needs 3–8s to finish init before it accepts connections. The healthcheck ensures `pg_isready` succeeds before Express ever starts, eliminating startup race conditions (portfolio interview staple).

---

## 🔒 Security & Hardening

1. **DB credentials via environment variables** — no hardcoded passwords in code. Compose supplies them; in production use your platform's secret manager (AWS Secrets Manager, Docker Swarm secrets, GitHub Actions secrets, etc.).
2. **Parameterized SQL queries everywhere** (`pool.query(text, [$1, $2])`) — no string concatenation = no SQL injection surface.
3. **Non-root runtime user** (`appuser` in Dockerfile) — container escapes would land as an unprivileged user, not root.
4. **`.env` / `.env.local` / `server/.env` are all gitignored** — [.gitignore](.gitignore) + [.dockerignore](.dockerignore) prevent accidental credential commits or image inclusion.
5. **CORS open in dev only** — in production the UI is served from the same Express origin, so cross-origin isn't needed.
6. **Least-privilege npm installs in container** — `--omit=dev` drops nodemon, vite, etc. which carry their own CVE surface.

---

## 🧪 Validation / Smoke Tests

Run these from the project root with Compose stack up (`docker compose up -d`):

```bash
# 1. Product catalog (expect 6 items)
curl -s http://localhost:5001/api/products | python3 -c "import sys,json; print('Products:', len(json.load(sys.stdin)))"

# 2. Cart round-trip
curl -s -X POST http://localhost:5001/api/cart \
  -H 'Content-Type: application/json' -d '{"productId":"p4","quantity":3}' \
  | python3 -c "import sys,json; d=json.load(sys.stdin); print('Cart total:', d['total'])"

# 3. Place order (writes to Postgres transactionally)
curl -s -X POST http://localhost:5001/api/orders \
  -H 'Content-Type: application/json' -d '{"customerName":"Smoke Test","email":"smoke@test.io"}' \
  | python3 -c "import sys,json; d=json.load(sys.stdin); print('Order ID:', d.get('id','ERROR'))"

# 4. PERSISTENCE CHECK — order survives app restart
docker restart online-retail-api
sleep 10
curl -s http://localhost:5001/api/orders | python3 -c "import sys,json; d=json.load(sys.stdin); print('Orders after restart:', len(d))"
# Expected: Orders after restart: 1 (or more if you ran this twice)
```

---

## 🆘 Troubleshooting

| Symptom | Root Cause | Fix |
|---|---|---|
| `ECONNREFUSED` on `/api/products` (Vite log) | Express backend not running on port 5000 | Start `npm run server` in a second terminal |
| `Bind for 0.0.0.0:5000 failed: port is already allocated` | macOS AirPlay or another service is using port 5000 | Already mapped to host `5001` in current compose — if you still see this, change host port in docker-compose.yml |
| `Bind for 0.0.0.0:5432 failed` | Local Postgres / brew service running | Already mapped to host `5433` — leave as-is or `brew services stop postgresql` |
| `Database schema initialized → Server running…` never appears | DB service not healthy | `docker compose ps` — confirm `online-retail-db` shows `healthy`. If not, `docker compose logs db` for Postgres errors. |
| `DATABASE_URL` undefined error | `.env` missing or malformed | `cp .env.example .env` and edit the URL; confirm values match your chosen Postgres endpoint (local vs Docker port) |
| `npm ci` can only install when lock file is in sync | You edited `package.json` without regenerating the lock | Run `npm install` inside the folder you edited (server or client) then rebuild |

---

## 📦 Deployment Topology (portfolio suggestions)

This stack is easily promoted to a real provider — no code changes required (just env vars):

**Low-cost single-VM (EC2 / Lightsail / Hetzner):**
1. Install Docker + Compose on VM.
2. Clone repo.
3. `docker compose up -d`.
4. Put Nginx / Caddy in front on port 80/443 with Certbot for Let's Encrypt → reverse-proxy to `localhost:5001`.

**Managed services (AWS):**
- RDS Postgres (Free Tier `db.t3.micro`) → set `DATABASE_URL` to the RDS endpoint + security-group rules.
- Elastic Beanstalk / ECS Fargate running the single `web` Docker image.
- ALB with HTTPS listener in front.

**Fly.io / Render / Railway:**
- Provision their managed Postgres add-on, paste the generated `DATABASE_URL` into the service env vars, deploy from Dockerfile.

---

## 🗂 Root Convenience Scripts

(`npm run` at project root)

| Script | Effect |
|---|---|
| `npm run install:all` | Installs root → server → client deps in one go |
| `npm run server` | `cd server && npm start` (Express on 5000) |
| `npm run client` | `cd client && npm run dev` (Vite on 3000) |
| `npm start` | Runs both server & client with `concurrently` |

---

## 🧹 Cleanup

```bash
# Stop services, keep DB data
docker compose down

# Stop and DELETE everything (volumes, images, networks — FULL reset)
docker compose down -v --rmi all
```

---

## 📚 What This Project Demonstrates (DevOps Portfolio Talking Points)

- ✅ **Containerization** — reproducible environment, no "works on my machine"
- ✅ **Multi-stage Docker builds** — minimal final image size, cached npm layers
- ✅ **Multi-service orchestration** — Docker Compose, inter-service networking, named volumes
- ✅ **Container hardening** — non-root user, `.dockerignore`, alpine base, prod-only deps
- ✅ **Startup order & reliability** — healthcheck-based depends_on (race condition elimination)
- ✅ **Persistent data tier** — Postgres volume survives container restarts & recreation
- ✅ **12-factor configuration** — env-var driven, no config in code, `.env.example` contract
- ✅ **Secret hygiene** — `.gitignore` + `.dockerignore` block `.env` leaks
- ✅ **Idempotent schema / seed** — app auto-initializes schema on first boot, safe on reboots
- ✅ **ACID transactions** — order placement is a single SQL transaction
- ✅ **SQL injection prevention** — parameterized queries throughout
- ✅ **Audit trail** — original plan document lives in `.trae/documents/postgres_integration_plan.md`
