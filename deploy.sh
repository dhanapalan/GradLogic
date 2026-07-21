#!/usr/bin/env bash
# =============================================================================
# GradLogic / TalentSecure-AI — one-command production deploy
# =============================================================================
# Run this on the server, from the repo root:
#
#   ./deploy.sh                # pull, build & (re)start EVERYTHING, apply migrations
#   ./deploy.sh api            # only rebuild/restart the API
#   ./deploy.sh client         # only rebuild/restart the client (nginx)
#   ./deploy.sh ai-engine      # only rebuild/restart the AI engine
#   ./deploy.sh question-bank  # only build/restart the AI question-bank engine (:8001)
#   ./deploy.sh migrate        # only apply pending DB migrations
#
# Overridable via environment:
#   BRANCH=main                # git branch to deploy (auto-detected if unset)
#   HEALTH_URL=http://127.0.0.1:5050/api/health
#   NO_PULL=1                  # skip 'git pull' (deploy current working tree)
#   PROFILE=judge0             # also start the opt-in judge0 sandbox
#   PROFILE=question-bank      # include the question-bank engine in an 'all' deploy
#                              # (it is opt-in: the image is multi-GB and first boot
#                              #  downloads the embedding model). Needed on 'all' so
#                              #  --remove-orphans doesn't stop a running instance.
# =============================================================================
set -euo pipefail
cd "$(dirname "$0")"

TARGET="${1:-all}"
BRANCH="${BRANCH:-}"   # empty → auto-detected from the checkout's upstream below
COMPOSE_FILE="docker-compose.prod.yml"
HEALTH_URL="${HEALTH_URL:-http://127.0.0.1:5050/api/health}"
DB_CONTAINER="talentsecure-postgres"

COMPOSE="docker compose -f $COMPOSE_FILE"
[ -n "${PROFILE:-}" ] && COMPOSE="$COMPOSE --profile $PROFILE"

# The question-bank engine is an opt-in profiled service. When it's the target,
# auto-enable its profile so compose can see the service (otherwise it reports
# "no such service: question-bank").
if [ "$TARGET" = "question-bank" ]; then
  case " $COMPOSE " in
    *" --profile question-bank "*) ;;
    *) COMPOSE="$COMPOSE --profile question-bank" ;;
  esac
fi

log()  { echo -e "\n\033[1;36m==>\033[0m $*"; }
ok()   { echo -e "  \033[1;32m✓\033[0m $*"; }
warn() { echo -e "  \033[1;33m⚠\033[0m $*"; }
die()  { echo -e "\n\033[1;31m✗ $*\033[0m" >&2; exit 1; }

# ── Preflight ────────────────────────────────────────────────────────────────
command -v docker >/dev/null 2>&1 || die "docker is not installed"
docker compose version >/dev/null 2>&1 || die "docker compose v2 is required"
[ -f "$COMPOSE_FILE" ] || die "$COMPOSE_FILE not found — run from the repo root"
[ -f .env ] || die ".env not found — copy .env.prod.example to .env and fill in secrets"

# DB credentials come from .env (never hard-coded), with sane fallbacks.
set -a; . ./.env; set +a
DB_USER="${PG_USER:-talentsecure}"
DB_NAME="${PG_DATABASE:-talentsecure_db}"

# ── 1. Pull latest code ──────────────────────────────────────────────────────
# Runs for "migrate" too — migration files live in the git checkout, so a
# migrate-only run must fetch them or it silently re-applies the old set.
if [ "${NO_PULL:-0}" != "1" ]; then
  # Resolve the branch to deploy (don't assume 'master' — this repo's remote
  # may use 'main'). Precedence: BRANCH env → current upstream → remote default.
  if [ -z "$BRANCH" ]; then
    if up=$(git rev-parse --abbrev-ref --symbolic-full-name '@{u}' 2>/dev/null); then
      BRANCH="${up#*/}"                       # e.g. origin/main → main
    else
      BRANCH="$(git remote show origin 2>/dev/null | sed -n 's/.*HEAD branch: //p')"
      BRANCH="${BRANCH:-main}"
    fi
  fi
  log "Pulling latest code (branch: $BRANCH)…"
  git fetch --quiet origin "$BRANCH" \
    || die "remote has no branch '$BRANCH' — set BRANCH=<name> (check: git ls-remote --heads origin)"
  # Mirror the remote exactly (safe on a deploy checkout; .env & other gitignored
  # files are untouched). Avoids 'diverged'/'cannot fast-forward' failures.
  git checkout --quiet -B "$BRANCH" "origin/$BRANCH"
  git reset --hard --quiet "origin/$BRANCH"
  ok "code up to date ($(git rev-parse --short HEAD) on $BRANCH)"
fi

# ── 2. Ensure external volumes exist (prod compose declares them external) ────
if [ "$TARGET" != "migrate" ]; then
  log "Ensuring Docker volumes…"
  for v in pgdata redisdata miniodata judge0pgdata judge0redisdata; do
    vol="talentsecure-ai_${v}"
    docker volume inspect "$vol" >/dev/null 2>&1 || { docker volume create "$vol" >/dev/null; ok "created $vol"; }
  done
fi

# ── 3. Build + (re)start ─────────────────────────────────────────────────────
if [ "$TARGET" = "all" ]; then
  log "Building images…"; $COMPOSE build
  log "Starting all services…"; $COMPOSE up -d --remove-orphans
elif [ "$TARGET" = "api" ] || [ "$TARGET" = "client" ] || [ "$TARGET" = "ai-engine" ] || [ "$TARGET" = "question-bank" ]; then
  log "Building $TARGET…"; $COMPOSE build "$TARGET"
  log "Restarting $TARGET…"; $COMPOSE up -d "$TARGET"
elif [ "$TARGET" = "migrate" ]; then
  : # handled below
else
  die "Unknown target '$TARGET' (use: all | api | client | ai-engine | question-bank | migrate)"
fi

# ── 4. Apply DB migrations (idempotent) ──────────────────────────────────────
# On a first-ever boot, docker/init-db/*.sql runs automatically from the
# postgres entrypoint. This re-applies them for existing databases so newly
# added, numbered migration files land too. Every file is written idempotently
# (CREATE ... IF NOT EXISTS / ADD COLUMN IF NOT EXISTS), so re-running is safe.
if [ "$TARGET" = "all" ] || [ "$TARGET" = "migrate" ]; then
  log "Waiting for postgres…"
  for i in $(seq 1 30); do
    docker exec "$DB_CONTAINER" pg_isready -U "$DB_USER" >/dev/null 2>&1 && break
    sleep 2
    [ "$i" = "30" ] && die "postgres did not become ready"
  done
  log "Applying migrations (docker/init-db/*.sql → $DB_NAME)…"
  shopt -s nullglob
  MIGRATE_FAILURES=0
  for f in docker/init-db/*.sql; do
    printf '  → %-40s ' "$(basename "$f")"
    if err=$(docker exec -i "$DB_CONTAINER" psql -v ON_ERROR_STOP=1 -q \
         -U "$DB_USER" -d "$DB_NAME" < "$f" 2>&1 >/dev/null); then
      echo "applied"
    elif echo "$err" | grep -qiE 'already exists|duplicate'; then
      echo "already present"
    else
      echo "FAILED"
      echo "$err" | head -5 | sed 's/^/      /'
      MIGRATE_FAILURES=$((MIGRATE_FAILURES + 1))
    fi
  done
  if [ "$MIGRATE_FAILURES" -gt 0 ]; then
    warn "$MIGRATE_FAILURES migration file(s) FAILED with real errors (not 'already exists') — schema may be incomplete, see errors above"
  fi
fi

# ── 5. Health check ──────────────────────────────────────────────────────────
if [ "$TARGET" = "all" ] || [ "$TARGET" = "api" ]; then
  log "Waiting for API health ($HEALTH_URL)…"
  for i in $(seq 1 30); do
    code=$(curl -s -o /dev/null -w '%{http_code}' "$HEALTH_URL" || echo 000)
    if [ "$code" = "200" ]; then ok "API healthy"; break; fi
    sleep 2
    if [ "$i" = "30" ]; then
      warn "API health check failed (last status: $code) — recent logs:"
      $COMPOSE logs --tail 40 api || true
      die "deploy finished but API is not healthy"
    fi
  done
fi

# ── 5b. Question-bank health check ───────────────────────────────────────────
# Its first boot downloads the sentence-transformers model, so allow longer and
# only warn (never die) if it's still starting.
if [ "$TARGET" = "question-bank" ]; then
  QB_HEALTH="http://127.0.0.1:8001/health"
  log "Waiting for question-bank health ($QB_HEALTH)…"
  for i in $(seq 1 60); do
    code=$(curl -s -o /dev/null -w '%{http_code}' "$QB_HEALTH" || echo 000)
    if [ "$code" = "200" ]; then ok "question-bank healthy"; break; fi
    sleep 3
    if [ "$i" = "60" ]; then
      warn "question-bank not healthy yet (last status: $code) — first boot downloads the embedding model and can take minutes. Check: $COMPOSE logs --tail 40 question-bank"
    fi
  done
fi

log "Deploy complete."
$COMPOSE ps
