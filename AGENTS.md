# AGENTS.md

## Cursor Cloud specific instructions

This is the **TalentSecure AI / GradLogic** monorepo: a multi-portal campus
recruitment + proctored-assessment SaaS. Packages: `client/` (React + Vite),
`server/` (NestJS API), `ai-engine/` (Python FastAPI, optional), `mobile/`
(Expo, optional). Standard commands live in the root `README.md` and each
package's `package.json` — reference those rather than duplicating them.

### Services and how to run them (dev)

Infra (Postgres, Redis, MinIO) runs in Docker; the API and client run on the
host in dev mode for hot reload. The Docker daemon must be started once per VM
(`sudo dockerd &`) since it does not auto-start here.

| Service | Start command | Port | Required? |
|---------|---------------|------|-----------|
| Postgres + Redis + MinIO | `sudo docker compose up -d postgres redis minio` | 5433 / 6380 / 9000-9001 | Required |
| API (NestJS) | `cd server && npm run dev` | 5050 | Required |
| Web client (Vite) | `cd client && npm run dev` | 5173 | Required |
| AI engine (FastAPI) | `cd ai-engine && python3 -m uvicorn main:app --host 0.0.0.0 --port 8000` | 8000 | Optional |

### Non-obvious caveats

- **Docker Compose volumes are `external: true`.** Before the first
  `docker compose up`, create them or compose errors out:
  `for v in pgdata redisdata miniodata; do sudo docker volume create talentsecure-ai_$v; done`
  (or run `./scripts/init-volumes.sh`). The API will not boot without Postgres,
  Redis, and MinIO all reachable (it runs `connectDatabase`, `connectRedis`,
  and `ensureBucket` before listening).
- **DB schema is applied only on first Postgres boot** from `docker/init-db/*.sql`
  (109 tables + seed users). It does NOT re-run on an existing volume. `prisma
  migrate` is intentionally not used (fails P3005). To reset schema, wipe the
  `talentsecure-ai_pgdata` volume and recreate.
- **Seeded super admin login:** `admin@gradlogic.com` / `gradlogic123`
  (defined in `docker/init-db/01-schema.sql` via `crypt('gradlogic123', ...)`).
  Note: `ADMIN_CREDENTIALS.md` lists `Admin123`, which is **wrong** for the
  Docker/init-db seed — use `gradlogic123`.
- **Login route is `/auth/login`, not `/login`.** Navigating directly to
  `/login` 404s; the app links to `/auth/login`. Super admin dashboard is at
  `/app/superadmin/dashboard`.
- **The AI engine's npm script `npm run dev:ai` calls `python`,** which does not
  exist on this VM (only `python3`). Start it with `python3 -m uvicorn ...` from
  inside `ai-engine/` (the module is `main:app`; must be run from that dir).
- **`npm run lint`/typecheck has pre-existing failures in both packages** and is
  NOT a gate for running the app. `server` lint (`tsc --noEmit`) errors on legacy
  `src/routes/*.ts` due to an `@types/express` v5 mismatch; the `server` build
  script intentionally tolerates this (`tsc || node -e "...existsSync('dist/index.js')"`).
  `client` lint (`tsc -b`) has ~38 source-level type errors, but `vite build`
  and `vite` dev use esbuild (no typecheck) and work fine.
- **Server unit tests:** `cd server && npm run test:unit` (node:test via tsx) —
  passes. `npm test` at root just runs typechecks (see above).
- The root `package.json` has stale `dev:frontend` / `dev:lendershub` scripts
  pointing at a non-existent `frontend/` dir — ignore them; the real web app is
  `client/`.
