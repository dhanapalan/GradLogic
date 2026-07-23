#!/usr/bin/env bash
# =============================================================================
# GradLogic — Deployment Configuration & Backup Validator
# =============================================================================
# Read-only. Changes nothing. Exits non-zero if any check FAILS.
#
# Usage:
#   ./scripts/validate-deploy.sh                 # full validation
#   ./scripts/validate-deploy.sh --quiet         # only WARN/FAIL lines
#   ./scripts/validate-deploy.sh --no-live       # skip container/network probes
#   ./scripts/validate-deploy.sh -b /root/volbackup   # alternate backup dir
#   ./scripts/validate-deploy.sh --max-age 7     # warn if backups older than N days
#
# Exit codes:  0 = no failures   1 = one or more FAIL   2 = cannot run
#
# Checks: tooling, .env, compose project name, volume binding + emptiness,
#         orphaned volumes, image pins, placeholder secrets, credential
#         consistency, port exposure, redis auth, container health, live
#         connectivity, backup freshness, git sync state.
# =============================================================================

set -uo pipefail

# ── Config ────────────────────────────────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
ENV_FILE="${PROJECT_ROOT}/.env"
COMPOSE_FILE="${PROJECT_ROOT}/docker-compose.yml"
BACKUP_ROOT="${PROJECT_ROOT}/backups"
MAX_BACKUP_AGE_DAYS=7
QUIET=false
LIVE=true

# Volumes that must never be empty on a live deploy
CRITICAL_VOLUMES=("pgdata" "miniodata")

# ── Parse args ────────────────────────────────────────────────────────────────
while [[ $# -gt 0 ]]; do
  case "$1" in
    -b|--backup-dir) BACKUP_ROOT="$2"; shift 2 ;;
    --max-age)       MAX_BACKUP_AGE_DAYS="$2"; shift 2 ;;
    -q|--quiet)      QUIET=true; shift ;;
    --no-live)       LIVE=false; shift ;;
    -h|--help)       sed -n '2,18p' "$0" | sed 's/^# \?//'; exit 0 ;;
    *) echo "Unknown option: $1" >&2; exit 2 ;;
  esac
done

cd "$PROJECT_ROOT" || { echo "Cannot cd to $PROJECT_ROOT" >&2; exit 2; }

# ── Counters & output ─────────────────────────────────────────────────────────
PASS=0; WARN=0; FAILED=0

ok()   { PASS=$((PASS+1));   [[ "$QUIET" == true ]] || printf '  \033[32m✓\033[0m %s\n' "$*"; }
warn() { WARN=$((WARN+1));   printf '  \033[33m!\033[0m %s\n' "$*"; }
fail() { FAILED=$((FAILED+1)); printf '  \033[31m✗\033[0m %s\n' "$*"; }
info() { [[ "$QUIET" == true ]] || printf '    \033[90m%s\033[0m\n' "$*"; }
section() { [[ "$QUIET" == true ]] || printf '\n\033[1m── %s %s\033[0m\n' "$*" "$(printf '─%.0s' $(seq 1 $((60 - ${#1}))))"; }

# Mask a secret for display: first 3 chars + ***
mask() { local v="$1"; [[ -z "$v" ]] && echo "(empty)" || echo "${v:0:3}***(${#v} chars)"; }

# Read a key from .env (last occurrence wins, matching dotenv behaviour)
get_env() {
  [[ -f "$ENV_FILE" ]] || return 0
  grep -E "^[[:space:]]*$1=" "$ENV_FILE" 2>/dev/null | tail -1 | cut -d= -f2- | sed 's/^["'\'']//; s/["'\'']$//'
}

# Read a resolved value from `docker compose config` for a given service block
get_resolved() { # $1=service $2=KEY
  printf '%s\n' "$COMPOSE_CONFIG" \
    | awk -v svc="  $1:" '$0==svc{f=1;next} f&&/^  [a-zA-Z_-]+:$/{f=0} f' \
    | grep -E "^[[:space:]]+$2:" | head -1 | sed 's/^[^:]*:[[:space:]]*//'
}

# ── 0. Prerequisites ──────────────────────────────────────────────────────────
section "Tooling"

command -v docker >/dev/null 2>&1 || { fail "docker not found"; exit 2; }

if docker compose version >/dev/null 2>&1; then
  ok "docker compose v2 available  ($(docker compose version --short 2>/dev/null))"
else
  fail "docker compose v2 not available — v1 (docker-compose) hits KeyError: 'ContainerConfig'"
  exit 2
fi

if command -v docker-compose >/dev/null 2>&1; then
  warn "legacy docker-compose v1 is installed — never use it; it corrupts recreates"
  info "always run 'docker compose' (space), not 'docker-compose' (hyphen)"
fi

# ── 1. Files ──────────────────────────────────────────────────────────────────
section "Files"

[[ -f "$COMPOSE_FILE" ]] && ok "docker-compose.yml present" || { fail "docker-compose.yml missing"; exit 2; }

if [[ -f "$ENV_FILE" ]]; then
  ok ".env present"
  perms="$(stat -c '%a' "$ENV_FILE" 2>/dev/null || stat -f '%Lp' "$ENV_FILE" 2>/dev/null)"
  if [[ "$perms" == "600" || "$perms" == "400" ]]; then
    ok ".env permissions are $perms"
  else
    warn ".env permissions are $perms — should be 600 (chmod 600 .env)"
  fi
  if git check-ignore -q .env 2>/dev/null; then
    ok ".env is gitignored"
  else
    fail ".env is NOT gitignored — secrets risk being committed"
  fi
else
  fail ".env missing — the stack will fall back to compose defaults"
fi

# ── 2. Compose config resolves ────────────────────────────────────────────────
section "Compose configuration"

if ! COMPOSE_CONFIG="$(docker compose config 2>&1)"; then
  fail "docker compose config failed to parse:"
  printf '%s\n' "$COMPOSE_CONFIG" | head -5 | sed 's/^/      /'
  exit 2
fi
ok "compose config parses cleanly"

PROJECT="$(get_env COMPOSE_PROJECT_NAME)"
if [[ -n "$PROJECT" ]]; then
  ok "COMPOSE_PROJECT_NAME is pinned to '$PROJECT'"
else
  PROJECT="$(basename "$PROJECT_ROOT" | tr '[:upper:]' '[:lower:]' | tr -cd '[:alnum:]-')"
  fail "COMPOSE_PROJECT_NAME not set — defaulting to directory name '$PROJECT'"
  info "a directory rename silently repoints every unpinned volume at an empty one"
  info "fix: echo 'COMPOSE_PROJECT_NAME=talentsecure-ai' >> .env"
fi

# ── 3. Volumes: are we mounting real data? ────────────────────────────────────
section "Volumes"

vol_size_bytes() { # $1 = full volume name
  local mp
  mp="$(docker volume inspect "$1" --format '{{.Mountpoint}}' 2>/dev/null)"
  if [[ -n "$mp" && -d "$mp" ]]; then
    du -sb "$mp" 2>/dev/null | cut -f1
  else
    docker run --rm -v "$1:/v:ro" alpine du -sb /v 2>/dev/null | cut -f1
  fi
}

human() { local b="${1:-0}"; awk -v b="$b" 'BEGIN{s="B KB MB GB TB";split(s,a," ");i=1;while(b>=1024&&i<5){b/=1024;i++}printf "%.1f%s",b,a[i]}'; }

# Resolve each compose volume key to its actual docker volume name.
# An explicit `name:` in the top-level volumes block overrides the project prefix.
VOL_KEYS="$(docker compose config --volumes 2>/dev/null)"
for key in $VOL_KEYS; do
  explicit="$(printf '%s\n' "$COMPOSE_CONFIG" \
    | awk '/^volumes:/{f=1;next} f' \
    | awk -v k="  $key:" '$0==k{f=1;next} f&&/^  [a-zA-Z_-]+:$/{f=0} f' \
    | grep -E '^[[:space:]]+name:' | head -1 | sed 's/^[^:]*:[[:space:]]*//')"

  if [[ -n "$explicit" ]]; then
    full="$explicit"; origin="explicit name:"
  else
    full="${PROJECT}_${key}"; origin="project prefix"
  fi

  if ! docker volume inspect "$full" >/dev/null 2>&1; then
    warn "$key → $full  does not exist yet ($origin)"
    continue
  fi

  bytes="$(vol_size_bytes "$full")"; bytes="${bytes:-0}"
  is_critical=false
  for c in "${CRITICAL_VOLUMES[@]}"; do [[ "$key" == "$c" ]] && is_critical=true; done

  if [[ "$is_critical" == true && "$bytes" -lt 65536 ]]; then
    fail "$key → $full  is EMPTY ($(human "$bytes")) — likely pointed at the wrong volume"
    info "check for an orphaned volume holding the real data (see Orphans below)"
  else
    ok "$key → $full  ($(human "$bytes"), $origin)"
  fi
done

# ── 4. Orphaned volumes ───────────────────────────────────────────────────────
section "Orphaned volumes"

orphans=0
while read -r v; do
  [[ -z "$v" ]] && continue
  # skip anything the current project actually references
  referenced=false
  for key in $VOL_KEYS; do
    [[ "$v" == "${PROJECT}_${key}" ]] && referenced=true
    printf '%s\n' "$COMPOSE_CONFIG" | grep -qE "name:[[:space:]]*$v\$" && referenced=true
  done
  [[ "$referenced" == true ]] && continue

  bytes="$(vol_size_bytes "$v")"; bytes="${bytes:-0}"
  if [[ "$bytes" -gt 65536 ]]; then
    warn "orphan with data: $v  ($(human "$bytes"))"
    orphans=$((orphans+1))
  fi
done < <(docker volume ls --format '{{.Name}}' 2>/dev/null | grep -iE 'talentsecure|gradlogic' || true)

if [[ "$orphans" -eq 0 ]]; then
  ok "no orphaned volumes holding data"
else
  info "these are NOT referenced by the current compose project"
  info "never run 'docker volume prune' or 'docker compose down -v' while these matter"
fi

# ── 5. Image pins ─────────────────────────────────────────────────────────────
section "Image pins"

floating=0
while read -r img; do
  [[ -z "$img" ]] && continue
  if [[ "$img" == *":latest" || "$img" != *":"* ]]; then
    warn "floating tag: $img — a pull can silently downgrade or break on-disk formats"
    floating=$((floating+1))
  fi
done < <(printf '%s\n' "$COMPOSE_CONFIG" | grep -E '^[[:space:]]+image:' | sed 's/^[^:]*:[[:space:]]*//' | sort -u)

[[ "$floating" -eq 0 ]] && ok "all images pinned to explicit tags"

# ── 6. Placeholder secrets ────────────────────────────────────────────────────
section "Placeholder secrets"

placeholders=0
while IFS= read -r line; do
  key="$(printf '%s' "$line" | sed 's/^[[:space:]]*//; s/:.*//')"
  warn "placeholder value still in use: $key"
  placeholders=$((placeholders+1))
done < <(printf '%s\n' "$COMPOSE_CONFIG" \
  | grep -iE '^[[:space:]]+[A-Z_]+:.*(changeme|your-email|your-gmail|your-.*-here|minioadmin|: *secret$|example\.com|CHANGE_ME)' || true)

[[ "$placeholders" -eq 0 ]] && ok "no placeholder values detected"

# ── 7. Credential consistency ─────────────────────────────────────────────────
section "Credential consistency"

S3_AK="$(get_env S3_ACCESS_KEY)";      S3_SK="$(get_env S3_SECRET_KEY)"
M_USER="$(get_env MINIO_ROOT_USER)";   M_PASS="$(get_env MINIO_ROOT_PASSWORD)"
PG_PASS="$(get_env POSTGRES_PASSWORD)"; DB_URL="$(get_env DATABASE_URL)"
PG_DB_ENV="$(get_resolved postgres POSTGRES_DB)"

# MinIO root creds must match what the API authenticates with
M_USER_R="$(get_resolved minio MINIO_ROOT_USER)"
M_PASS_R="$(get_resolved minio MINIO_ROOT_PASSWORD)"
if [[ -n "$S3_AK" && -n "$M_USER_R" ]]; then
  if [[ "$S3_AK" == "$M_USER_R" ]]; then
    ok "S3_ACCESS_KEY matches MINIO_ROOT_USER  ($(mask "$S3_AK"))"
  else
    fail "S3_ACCESS_KEY ($(mask "$S3_AK")) != MINIO_ROOT_USER ($(mask "$M_USER_R")) — uploads will be disabled"
  fi
fi
if [[ -n "$S3_SK" && -n "$M_PASS_R" ]]; then
  if [[ "$S3_SK" == "$M_PASS_R" ]]; then
    ok "S3_SECRET_KEY matches MINIO_ROOT_PASSWORD"
  else
    fail "S3_SECRET_KEY != MINIO_ROOT_PASSWORD — MinIO will reject the API's credentials"
  fi
fi
[[ -n "$M_PASS" && "${#M_PASS}" -lt 8 ]] && fail "MINIO_ROOT_PASSWORD is under 8 chars — MinIO refuses to boot"

# DATABASE_URL must agree with POSTGRES_*
if [[ -n "$DB_URL" ]]; then
  url_pass="$(printf '%s' "$DB_URL" | sed -n 's|.*://[^:]*:\([^@]*\)@.*|\1|p')"
  url_db="$(printf '%s' "$DB_URL" | sed -n 's|.*/\([^/?]*\)$|\1|p')"

  if [[ -n "$PG_PASS" ]]; then
    [[ "$url_pass" == "$PG_PASS" ]] \
      && ok "DATABASE_URL password matches POSTGRES_PASSWORD" \
      || fail "DATABASE_URL password differs from POSTGRES_PASSWORD — API will fail on reconnect"
  else
    warn "POSTGRES_PASSWORD not in .env — password lives only in DATABASE_URL"
  fi

  if [[ -n "$PG_DB_ENV" ]]; then
    [[ "$url_db" == "$PG_DB_ENV" ]] \
      && ok "DATABASE_URL database '$url_db' matches POSTGRES_DB" \
      || fail "DATABASE_URL targets '$url_db' but POSTGRES_DB is '$PG_DB_ENV' — a rebuilt volume would create the wrong database"
  fi

  # healthcheck must reference the same database, or it logs FATAL every interval
  if printf '%s\n' "$COMPOSE_CONFIG" | grep -q "pg_isready"; then
    hc_db="$(printf '%s\n' "$COMPOSE_CONFIG" | grep -o 'pg_isready[^"]*' | head -1 | sed -n 's/.*-d[[:space:]]*\([^ "]*\).*/\1/p')"
    if [[ -n "$hc_db" ]]; then
      [[ "$hc_db" == "$url_db" ]] \
        && ok "postgres healthcheck targets '$hc_db'" \
        || fail "postgres healthcheck targets '$hc_db' but the database is '$url_db' — floods logs with FATAL"
    fi
  fi
fi

# ── 8. Network exposure ───────────────────────────────────────────────────────
section "Network exposure"

exposed=0
while IFS= read -r pub; do
  [[ -z "$pub" ]] && continue
  exposed=$((exposed+1))
done < <(printf '%s\n' "$COMPOSE_CONFIG" | grep -E '^[[:space:]]+published:' | sed 's/[^0-9]//g' || true)

if [[ "$LIVE" == true ]] && command -v ss >/dev/null 2>&1; then
  public=0
  while read -r port; do
    [[ -z "$port" ]] && continue
    if ss -tlnH 2>/dev/null | awk '{print $4}' | grep -qE "^(0\.0\.0\.0|\*|\[::\]):${port}$"; then
      fail "port $port is bound to 0.0.0.0 — reachable from the internet"
      public=$((public+1))
    fi
  done < <(printf '%s\n' "$COMPOSE_CONFIG" | grep -E '^[[:space:]]+published:' | sed 's/[^0-9]//g' | sort -u)
  [[ "$public" -eq 0 ]] && ok "no published port bound to 0.0.0.0"
  if [[ "$public" -gt 0 ]]; then
    info "bind to loopback in docker-compose.yml, e.g.  - \"127.0.0.1:5433:5432\""
    info "internal services reach each other over the compose network by name"
  fi
else
  info "skipped live port scan (--no-live or ss unavailable); $exposed published port(s) declared"
fi

if command -v ufw >/dev/null 2>&1; then
  if ufw status 2>/dev/null | grep -qi '^Status: active'; then
    ok "ufw firewall is active"
  else
    warn "ufw firewall is inactive — published ports have no second line of defence"
  fi
fi

# ── 9. Redis authentication ───────────────────────────────────────────────────
section "Redis"

if printf '%s\n' "$COMPOSE_CONFIG" | grep -q 'requirepass'; then
  ok "redis enforces requirepass"
  R_URL="$(get_env REDIS_URL)"
  [[ "$R_URL" == *"@"* ]] \
    && ok "REDIS_URL carries credentials" \
    || fail "redis requires a password but REDIS_URL has none — the API cannot connect"
else
  if [[ -n "$(get_env REDIS_PASSWORD)" ]]; then
    warn "REDIS_PASSWORD is set in .env but redis does not enforce requirepass — the password is unused"
  else
    warn "redis has no authentication configured"
  fi
  info "needs three coordinated changes: command, healthcheck, and REDIS_URL"
fi

# ── 10. Live service state ────────────────────────────────────────────────────
if [[ "$LIVE" == true ]]; then
  section "Running services"

  running="$(docker compose ps --format '{{.Name}}\t{{.State}}\t{{.Status}}' 2>/dev/null)"
  if [[ -z "$running" ]]; then
    warn "no containers running for project '$PROJECT'"
  else
    while IFS=$'\t' read -r name state status; do
      [[ -z "$name" ]] && continue
      case "$state" in
        running) [[ "$status" == *unhealthy* ]] && fail "$name is unhealthy — $status" || ok "$name — $status" ;;
        *)       fail "$name is $state — $status" ;;
      esac
    done <<< "$running"
  fi

  section "Connectivity"

  # Postgres: does the target database actually exist?
  if docker compose ps --status running 2>/dev/null | grep -q postgres; then
    PG_USER="$(get_resolved postgres POSTGRES_USER)"
    tgt_db="${url_db:-$PG_DB_ENV}"
    if docker compose exec -T postgres psql -U "${PG_USER:-postgres}" -d "$tgt_db" -c 'SELECT 1' >/dev/null 2>&1; then
      tables="$(docker compose exec -T postgres psql -U "$PG_USER" -d "$tgt_db" -tAc \
        "SELECT count(*) FROM information_schema.tables WHERE table_schema='public'" 2>/dev/null | tr -d '\r')"
      if [[ "${tables:-0}" -gt 0 ]]; then
        ok "postgres '$tgt_db' reachable — ${tables} tables in public schema"
      else
        fail "postgres '$tgt_db' reachable but has ZERO tables — likely a freshly initialised volume"
      fi
    else
      fail "cannot connect to postgres database '$tgt_db'"
    fi
  fi

  # Redis
  if docker compose ps --status running 2>/dev/null | grep -q redis; then
    if docker compose exec -T redis redis-cli ping 2>/dev/null | grep -q PONG; then
      warn "redis answers PING with no authentication"
    elif docker compose exec -T redis redis-cli -a "$(get_env REDIS_PASSWORD)" ping 2>/dev/null | grep -q PONG; then
      ok "redis reachable and requires authentication"
    else
      fail "redis is not responding to PING"
    fi
  fi

  # MinIO
  if docker compose ps --status running 2>/dev/null | grep -q minio; then
    if docker compose exec -T minio curl -fsS http://localhost:9000/minio/health/live >/dev/null 2>&1; then
      ok "minio health endpoint responding"
    else
      fail "minio health endpoint not responding"
    fi
    if docker compose logs minio 2>/dev/null | tail -50 | grep -q 'Unknown xl meta version'; then
      fail "minio reports 'Unknown xl meta version' — the image is OLDER than the data on disk"
      info "the running image was downgraded; pin it forward to the release that wrote the data"
    fi
  fi

  # API surface
  if docker compose logs api 2>/dev/null | tail -80 | grep -qi 'S3 unavailable'; then
    fail "api logs 'S3 unavailable' — file uploads are disabled"
  elif docker compose logs api 2>/dev/null | tail -80 | grep -q 'S3 bucket'; then
    ok "api reports S3 bucket ready"
  fi
fi

# ── 11. Backups ───────────────────────────────────────────────────────────────
section "Backups"

if [[ ! -d "$BACKUP_ROOT" ]]; then
  fail "backup directory not found: $BACKUP_ROOT"
  info "run ./scripts/backup-volumes.sh to create the first backup"
else
  latest="$(find "$BACKUP_ROOT" -mindepth 1 -maxdepth 1 -type d 2>/dev/null | sort | tail -1)"
  if [[ -z "$latest" ]]; then
    fail "no backups found under $BACKUP_ROOT"
  else
    age_days=$(( ( $(date +%s) - $(stat -c %Y "$latest" 2>/dev/null || stat -f %m "$latest") ) / 86400 ))
    if [[ "$age_days" -le "$MAX_BACKUP_AGE_DAYS" ]]; then
      ok "latest backup is ${age_days}d old — $(basename "$latest")"
    else
      fail "latest backup is ${age_days}d old (threshold ${MAX_BACKUP_AGE_DAYS}d) — $(basename "$latest")"
    fi

    for v in "${CRITICAL_VOLUMES[@]}"; do
      f="${latest}/${v}.tar.gz"
      if [[ -f "$f" ]]; then
        sz=$(stat -c %s "$f" 2>/dev/null || stat -f %z "$f")
        if [[ "$sz" -lt 1024 ]]; then
          fail "backup ${v}.tar.gz is only $(human "$sz") — almost certainly empty"
        else
          ok "backup ${v}.tar.gz  ($(human "$sz"))"
        fi
      else
        fail "no backup for critical volume '$v' in $(basename "$latest")"
      fi
    done

    if [[ -f "${latest}/manifest.txt" ]]; then
      ok "manifest present with checksums"
    else
      warn "no manifest.txt — integrity cannot be verified"
    fi

    count="$(find "$BACKUP_ROOT" -mindepth 1 -maxdepth 1 -type d | wc -l | tr -d ' ')"
    info "$count backup set(s) retained, total $(du -sh "$BACKUP_ROOT" 2>/dev/null | cut -f1)"
  fi
fi

# ── 12. Git state ─────────────────────────────────────────────────────────────
section "Git"

if git rev-parse --git-dir >/dev/null 2>&1; then
  branch="$(git rev-parse --abbrev-ref HEAD 2>/dev/null)"
  remote="$(git remote get-url origin 2>/dev/null)"
  ok "branch '$branch' → $remote"

  if [[ -n "$(git status --porcelain 2>/dev/null)" ]]; then
    fail "uncommitted changes — a git pull will revert them"
    git status --porcelain 2>/dev/null | head -5 | sed 's/^/      /'
  else
    ok "working tree clean"
  fi

  upstream="$(git rev-parse --abbrev-ref '@{u}' 2>/dev/null || true)"
  if [[ -n "$upstream" ]]; then
    ahead="$(git rev-list --count "${upstream}..HEAD" 2>/dev/null || echo 0)"
    behind="$(git rev-list --count "HEAD..${upstream}" 2>/dev/null || echo 0)"
    [[ "$ahead"  -gt 0 ]] && fail "$ahead commit(s) not pushed — they exist only on this host" || true
    [[ "$behind" -gt 0 ]] && warn "$behind commit(s) available upstream — not deployed" || true
    [[ "$ahead" -eq 0 && "$behind" -eq 0 ]] && ok "in sync with $upstream" || true
  else
    warn "branch '$branch' has no upstream configured"
  fi

  extra="$(git remote | grep -v '^origin$' | tr '\n' ' ')"
  [[ -n "$extra" ]] && warn "additional remotes configured: ${extra}— confirm you deploy from the right one"
else
  warn "not a git repository"
fi

# ── Summary ───────────────────────────────────────────────────────────────────
printf '\n\033[1m%s\033[0m\n' "$(printf '═%.0s' $(seq 1 66))"
printf '  \033[32m%d passed\033[0m   \033[33m%d warnings\033[0m   \033[31m%d failed\033[0m\n' "$PASS" "$WARN" "$FAILED"
printf '\033[1m%s\033[0m\n\n' "$(printf '═%.0s' $(seq 1 66))"

if [[ "$FAILED" -gt 0 ]]; then
  echo "Validation FAILED — resolve the ✗ items above before trusting this deploy."
  exit 1
fi
[[ "$WARN" -gt 0 ]] && echo "Validation passed with warnings."
exit 0
