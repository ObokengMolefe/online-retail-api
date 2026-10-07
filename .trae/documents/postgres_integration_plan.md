# PostgreSQL Integration Implementation Plan

## Repository Research

**Current architecture:**
- Backend: Express.js (`server/index.js`) on port 5000
- Data: 100% in-memory JavaScript arrays in `server/data.js` — `products` (6 seed items), `cart` (empty), `orders` (empty)
- Data is LOST on every server restart (no persistence)
- Frontend: Vite + React on port 3000, proxies `/api` to backend
- Docker: Multi-stage build bundles frontend into `server/public`, served by Express on port 5000
- docker-compose.yml currently has only the web service (no database)

**Data model (3 entities):**
1. `products` — id, name, description, price, category, stock, image
2. `cart_items` — productId + quantity (currently a simple array, no user/session id = single global cart)
3. `orders` — id, customerName, email, items[] (embedded), total, status, createdAt

## Files and Modules

| File | Change |
|---|---|
| `server/package.json` | Add `pg` and `dotenv` dependencies |
| `server/db.js` | NEW — PostgreSQL connection pool + query helper |
| `server/init.sql` | NEW — Schema: create `products`, `cart_items`, `orders`, `order_items` tables + seed the 6 products |
| `server/index.js` | Rewrite all 10 API endpoints to query Postgres instead of in-memory arrays |
| `server/data.js` | DELETE — no longer used |
| `docker-compose.yml` | Add `db` service (PostgreSQL 16) + env vars + volume + healthcheck; update `web` service to wait for db, pass DATABASE_URL |
| `Dockerfile` | No structural changes needed (already copies server/ directory) |
| `.env.example` | NEW — Template for DB connection env vars |

## Implementation Steps

1. Add `pg` (PostgreSQL client) and `dotenv` to `server/package.json` dependencies
2. Create `server/db.js` — singleton connection pool using `pg.Pool`, reads from `DATABASE_URL` env var, exports a `query(text, params)` helper
3. Create `server/init.sql` — SQL schema with 4 tables:
   - `products` (id PK, name, description, price NUMERIC, category, stock INT, image, created_at)
   - `cart_items` (id PK, product_id FK→products, quantity INT, UNIQUE(product_id))
   - `orders` (id PK, customer_name, email, total NUMERIC, status, created_at)
   - `order_items` (id PK, order_id FK→orders, product_id FK→products, name, price NUMERIC, quantity INT, subtotal NUMERIC)
   - Seed the same 6 products from current `data.js` (only if table is empty — UPSERT or INSERT…ON CONFLICT DO NOTHING)
4. Rewrite `server/index.js` endpoints to use SQL:
   - `GET /api/products` — `SELECT * FROM products` (+ optional category filter)
   - `GET /api/products/:id` — `SELECT * FROM products WHERE id=$1`
   - `GET /api/cart` — JOIN `cart_items` with `products`, compute total
   - `POST /api/cart` — INSERT or UPDATE (ON CONFLICT DO UPDATE SET quantity=quantity+excluded.quantity), return joined items + total
   - `PUT /api/cart/:productId` — UPDATE quantity or DELETE if ≤0, return joined items + total
   - `DELETE /api/cart/:productId` — DELETE row, return joined items + total
   - `DELETE /api/cart` — `TRUNCATE cart_items`, return empty
   - `GET /api/orders` — `SELECT * FROM orders ORDER BY created_at DESC` + JOIN order_items
   - `POST /api/orders` — Transaction: read cart_items, INSERT order, INSERT order_items, TRUNCATE cart_items, return order
5. Create a DB init bootstrap in `server/index.js`: on startup, run `init.sql` via `fs.readFile + pool.query` so tables + seed data exist automatically (no manual migration step needed)
6. Delete `server/data.js`
7. Create `.env.example` with `DATABASE_URL=postgresql://user:pass@localhost:5432/retail`
8. Update `docker-compose.yml`:
   - Add `db` service: `postgres:16-alpine`, env vars (POSTGRES_USER, POSTGRES_PASSWORD, POSTGRES_DB), port 5432:5432, volume `pgdata:/var/lib/postgresql/data`, healthcheck (`pg_isready`)
   - `web` service: add `depends_on: db: condition: service_healthy`, add `DATABASE_URL` env var pointing to the db service, remove `PORT` env override (keep default 5000)
   - Add top-level `volumes: pgdata:`
9. Update root `package.json` `install:all` script (no change — already installs server deps)

## Dependencies and Considerations

- **pg library** — standard Node.js PostgreSQL driver, zero ORM layer = simple, auditable SQL (matches your compliance/audit trail priority)
- **dotenv** — loads `.env` file for local dev (outside Docker); inside Docker, compose supplies env vars directly
- **Schema init on startup** — the app runs `init.sql` on every boot; SQL uses `IF NOT EXISTS` and `ON CONFLICT DO NOTHING` so re-running is safe. No separate migration tool needed for this small schema.
- **Single global cart** — kept as-is (matches current behavior; no user auth). `cart_items` has a UNIQUE constraint on product_id.
- **Docker networking** — in compose, the `web` container reaches Postgres via hostname `db` (the service name), not `localhost`. The DATABASE_URL in compose reflects this.
- **Local dev outside Docker** — you must have a running Postgres (either native install or just `docker compose up db`) accessible on localhost:5432, and a `.env` file in `server/` folder.

## Validation

After implementation, run these checks in order:

1. **Docker path (recommended):**
   ```
   cd /Users/obokengmolefe/Desktop/Online-Retail-API
   docker compose down -v     # wipe old state
   docker compose up --build
   ```
   Then in a browser:
   - `http://localhost:5000/api/products` → returns 6 products (JSON array)
   - `http://localhost:5000/api/cart` → returns `{ items: [], total: 0 }`
   - `http://localhost:5000/api/orders` → returns `[]`

2. **API flow test (all via curl against localhost:5000):**
   ```
   # Add to cart
   curl -X POST -H "Content-Type: application/json" -d '{"productId":"p1","quantity":2}' http://localhost:5000/api/cart
   # View cart
   curl http://localhost:5000/api/cart
   # Place order
   curl -X POST -H "Content-Type: application/json" -d '{"customerName":"Test","email":"t@t.com"}' http://localhost:5000/api/orders
   # View orders
   curl http://localhost:5000/api/orders
   # Restart container and confirm data persisted (orders still there, products still there)
   docker compose restart web
   curl http://localhost:5000/api/orders
   ```

3. **Diagnostics check:** `GetDiagnostics` for any lint errors after edits.

## Risks

| Risk | Handling |
|---|---|
| Postgres container not ready when web starts | `depends_on` with `condition: service_healthy` + `pg_isready` healthcheck ensures DB is accepting connections before web boots |
| Existing Docker volume has old state | Validation step starts with `docker compose down -v` to wipe and recreate clean |
| Connection string mismatch (localhost vs compose hostname) | `.env.example` documents the local format; docker-compose.yml overrides DATABASE_URL explicitly with `db` hostname |
| Breaking current users of `data.js` | `data.js` is only imported by `index.js`; we rewrite the importer and delete the file atomically |
| Seed products inserted twice | `INSERT ... ON CONFLICT (id) DO NOTHING` prevents duplicates on re-init |
