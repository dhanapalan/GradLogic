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

# No `pipefail`: this script pipes into `grep -q`, which exits on first match and
# SIGPIPEs the upstream command. With pipefail that reads as failure and inverts
# every such test. No `errexit` either — a failed check must not abort the run.
set -u

# ── Config ────────────────────────────────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
ENV_FILE="${PROJECT_ROOT}/.env"
COMPOSE_FILE="${PROJECT_ROOT}/docker-compose.yml"
BACKUP_ROOT="${PROJECT_ROOT}/backups"
MAX_BACKUP_AGE_DAYS=7
QUIET=false
LIVE=true
# Ports that are deliberately internet-facing. Anything else on 0.0.0.0 fails.
# Override with --public 80,443,9000 or PUBLIC_PORTS=80,443 in the environment.
PUBLIC_PORTS="${PUBLIC_PORTS:-80,443}"
# Extra profiles to consider (comma-separated), e.g. question-bank.
PROFILES="${PROFILES:-question-bank}"

# Volumes that must hold real data on a live deploy.
# Format: "key|marker-file" — the marker proves the volume is initialised.
# Size is a poor signal here: an initialised MinIO volume is only ~30KB.
CRITICAL_VOLUMES=(
  "pgdata|PG_VERSION"
  "miniodata|.minio.sys"
)

# ── Parse args ────────────────────────────────────────────────────────────────
while [[ $# -gt 0 ]]; do
  case "$1" in
    -b|--backup-dir) BACKUP_ROOT="$2"; shift 2 ;;
    --max-age)       MAX_BACKUP_AGE_DAYS="$2"; shift 2 ;;
    --public)        PUBLIC_PORTS="$2"; shift 2 ;;
    -f|--file)       COMPOSE_FILE="$2"; shift 2 ;;
    --profiles)      PROFILES="$2"; shift 2 ;;
    -q|--quiet)      QUIET=true; shift ;;
    --no-live)       LIVE=false; shift ;;
    -h|--help)       sed -n '2,18p' "$0" | sed 's/^# \?//'; exit 0 ;;
    *) echo "Unknown option: $1" >&2; exit 2 ;;
  esac
done

cd "$PROJECT_ROOT" || { echo "Cannot cd to $PROJECT_ROOT" >&2; exit 2; }

# ── Compose wrapper ───────────────────────────────────────────────────────────
# Every compose call goes through dc() so -f and --profile are applied uniformly.
DC_ARGS=()
[[ -n "$COMPOSE_FILE" ]] && DC_ARGS+=(-f "$COMPOSE_FILE")
IFS=',' read -ra _profs <<< "$PROFILES"
for _p in "${_profs[@]}"; do [[ -n "$_p" ]] && DC_ARGS+=(--profile "$_p"); done
dc() { docker compose "${DC_ARGS[@]}" "$@"; }

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

if [[ -f "$COMPOSE_FILE" ]]; then
  ok "validating $(basename "$COMPOSE_FILE")"
else
  fail "compose file not found: $COMPOSE_FILE"; exit 2
fi

# deploy.sh may target a different file than the default. Validating the wrong
# one reports confidently on a stack that is not the one running.
deploy_file="$(grep -oE 'COMPOSE_FILE="[^"]+"' "${PROJECT_ROOT}/deploy.sh" 2>/dev/null | head -1 | cut -d'"' -f2)"
if [[ -n "$deploy_file" && "$(basename "$COMPOSE_FILE")" != "$deploy_file" ]]; then
  warn "deploy.sh deploys with '$deploy_file' but this run validates '$(basename "$COMPOSE_FILE")'"
  info "re-run with:  -f $deploy_file"
fi

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

if ! COMPOSE_CONFIG="$(dc config 2>&1)"; then
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

# Does a marker file exist inside the volume? Definitive proof of initialisation.
vol_has_marker() { # $1 = full volume name, $2 = marker path
  local mp
  mp="$(docker volume inspect "$1" --format '{{.Mountpoint}}' 2>/dev/null)"
  if [[ -n "$mp" && -d "$mp" ]]; then
    [[ -e "${mp}/$2" ]]
  else
    docker run --rm -v "$1:/v:ro" alpine test -e "/v/$2" >/dev/null 2>&1
  fi
}

# Resolve each compose volume key to its actual docker volume name.
# An explicit `name:` in the top-level volumes block overrides the project prefix.
VOL_KEYS="$(dc config --volumes 2>/dev/null)"
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
  marker=""
  for c in "${CRITICAL_VOLUMES[@]}"; do
    [[ "$key" == "${c%%|*}" ]] && marker="${c##*|}"
  done

  if [[ -n "$marker" ]]; then
    if vol_has_marker "$full" "$marker"; then
      ok "$key → $full  ($(human "$bytes"), $origin, initialised)"
    else
      fail "$key → $full  is UNINITIALISED — no '$marker' present"
      info "the service is pointed at a fresh volume; the real data is likely in an orphan below"
    fi
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
    listeners="$(ss -tlnH 2>/dev/null | awk '{print $4}')"
    if printf '%s\n' "$listeners" | grep -qE "^(0\.0\.0\.0|\*|\[::\]):${port}$"; then
      if [[ ",${PUBLIC_PORTS}," == *",${port},"* ]]; then
        ok "port $port is public — declared intentional"
      else
        fail "port $port is bound to 0.0.0.0 — reachable from the internet"
        public=$((public+1))
      fi
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

# Probe the running instance. The compose file is only a proxy for this and can
# be wrong in both directions: requirepass may arrive from an override file, a
# mounted redis.conf, or a CONFIG SET that was never written back to YAML.
redis_running=false
if [[ "$LIVE" == true ]]; then
  dc ps --status running --services 2>/dev/null | grep -qx redis && redis_running=true
fi

if [[ "$redis_running" == true ]]; then
  unauth="$(dc exec -T redis redis-cli PING 2>/dev/null | tr -d '\r\n')"
  case "$unauth" in
    PONG)
      fail "redis accepts unauthenticated commands — anyone reaching the port owns the data" ;;
    NOAUTH*|*"Authentication required"*)
      ok "redis enforces authentication (unauthenticated PING is refused)"
      rp="$(get_env REDIS_PASSWORD)"
      if [[ -n "$rp" ]]; then
        authed="$(dc exec -T redis redis-cli -a "$rp" PING 2>/dev/null | tr -d '\r\n')"
        [[ "$authed" == *PONG* ]] \
          && ok "REDIS_PASSWORD from .env authenticates successfully" \
          || fail "REDIS_PASSWORD in .env does NOT authenticate — the API will fail on reconnect"
      else
        warn "redis requires a password but REDIS_PASSWORD is absent from .env"
      fi ;;
    *)
      fail "redis is not responding to PING (got: ${unauth:-no output})" ;;
  esac

  # A healthcheck that ignores auth errors reports healthy on a broken instance
  hc="$(printf '%s\n' "$COMPOSE_CONFIG" \
    | awk -v svc="  redis:" '$0==svc{f=1;next} f&&/^  [a-zA-Z_-]+:$/{f=0} f' \
    | grep -o 'redis-cli[^"]*' | head -1)"
  if [[ "$unauth" != "PONG" && -n "$hc" && "$hc" != *"-a"* ]]; then
    warn "redis healthcheck runs '${hc}' without credentials — it passes on NOAUTH and proves nothing"
  fi
else
  # Static fallback when not probing live
  if printf '%s\n' "$COMPOSE_CONFIG" | grep -q 'requirepass'; then
    ok "redis declares requirepass in compose"
  else
    info "no requirepass in compose — cannot confirm without a live probe (auth may come from an override or mounted conf)"
  fi
fi

# ── 10. Live service state ────────────────────────────────────────────────────
if [[ "$LIVE" == true ]]; then
  section "Running services"

  running="$(dc ps --format '{{.Name}}\t{{.State}}\t{{.Status}}' 2>/dev/null)"
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

  RUNNING_SERVICES="$(dc ps --status running --services 2>/dev/null | tr '\n' ' ')"

  # Postgres: does the target database actually exist?
  if [[ "$RUNNING_SERVICES" == *postgres* ]]; then
    PG_USER="$(get_resolved postgres POSTGRES_USER)"
    tgt_db="${url_db:-$PG_DB_ENV}"
    if dc exec -T postgres psql -U "${PG_USER:-postgres}" -d "$tgt_db" -c 'SELECT 1' >/dev/null 2>&1; then
      tables="$(dc exec -T postgres psql -U "$PG_USER" -d "$tgt_db" -tAc \
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

  # (redis is probed in full under the Redis section above)

  # MinIO
  if [[ "$RUNNING_SERVICES" == *minio* ]]; then
    if dc exec -T minio curl -fsS http://localhost:9000/minio/health/live >/dev/null 2>&1; then
      ok "minio health endpoint responding"
    else
      fail "minio health endpoint not responding"
    fi
    minio_log="$(dc logs --tail 50 minio 2>/dev/null)"
    if [[ "$minio_log" == *"Unknown xl meta version"* ]]; then
      fail "minio reports 'Unknown xl meta version' — the image is OLDER than the data on disk"
      info "the running image was downgraded; pin it forward to the release that wrote the data"
    fi
  fi

  # API surface — read the newest S3 line so a stale warning is not reported as current
  api_s3="$(dc logs --tail 200 api 2>/dev/null | grep -iE 'S3 unavailable|S3 bucket' | tail -1)"
  if [[ "$api_s3" == *"unavailable"* || "$api_s3" == *"Unavailable"* ]]; then
    fail "api logs 'S3 unavailable' — file uploads are disabled"
  elif [[ -n "$api_s3" ]]; then
    ok "api reports S3 bucket ready"
  fi
fi

# ── 10b. Question-bank RAG engine ─────────────────────────────────────────────
# Opt-in service behind the question-bank profile. Absent is fine; broken is not.
section "Question-bank engine"

QB_ENV="${PROJECT_ROOT}/ai-engine/question_bank_engine/.env"
qb_running=false
if [[ "$LIVE" == true ]]; then
  dc ps --status running --services 2>/dev/null | grep -qx question-bank && qb_running=true
fi

if [[ ! -f "$QB_ENV" ]]; then
  warn "no .env at ai-engine/question_bank_engine/ — engine falls back to defaults"
else
  ok "engine .env present"
  qb_get() { grep -E "^[[:space:]]*$1=" "$QB_ENV" 2>/dev/null | tail -1 | cut -d= -f2-; }
  provider="$(qb_get LLM_PROVIDER)"
  case "${provider:-}" in
    groq)      key="$(qb_get GROQ_API_KEY)";      model="$(qb_get GROQ_MODEL)" ;;
    openai)    key="$(qb_get OPENAI_API_KEY)";    model="$(qb_get OPENAI_MODEL)" ;;
    anthropic) key="$(qb_get ANTHROPIC_API_KEY)"; model="$(qb_get ANTHROPIC_MODEL)" ;;
    ollama)    key="n/a";                          model="$(qb_get OLLAMA_MODEL)" ;;
    *)         key=""; model="" ;;
  esac

  if [[ -z "${provider:-}" ]]; then
    warn "LLM_PROVIDER not set in the engine .env"
  elif [[ -z "$key" || "$key" == *your_api_key* || "$key" == *_here ]]; then
    fail "LLM_PROVIDER=$provider but its API key is missing or a placeholder"
  else
    ok "LLM provider '$provider' configured with a key ($(mask "$key"))"
  fi

  # Retired hosted models fail every call while the endpoint still returns 200.
  case "${model:-}" in
    mixtral-8x7b-32768|llama2-70b-4096|gemma-7b-it)
      fail "GROQ model '$model' is decommissioned — generation returns zero questions"
      info "list current models: curl -s https://api.groq.com/openai/v1/models -H \"Authorization: Bearer \$KEY\"" ;;
    "") warn "no model configured for provider '${provider:-unset}'" ;;
    *)  ok "model '$model'" ;;
  esac

  [[ -z "$(qb_get QUESTION_ENGINE_API_KEY)" ]] && warn "QUESTION_ENGINE_API_KEY unset — ingest endpoints are unprotected"
fi

if [[ "$qb_running" != true ]]; then
  info "question-bank is not running (opt-in profile) — skipping live checks"
  info "start it with: ./deploy.sh question-bank"
else
  qb_port="$(printf '%s
' "$COMPOSE_CONFIG" | grep -oE 'published: "8001"' | head -1)"
  health="$(dc exec -T question-bank curl -fsS http://localhost:8001/health 2>/dev/null)"
  if [[ -z "$health" ]]; then
    fail "question-bank is running but /health did not respond"
    info "first boot downloads the embedding model; allow ~3 minutes"
  else
    ok "/health responding"
    for comp in document_loader llm; do
      if [[ "$health" == *"\"$comp\":\"healthy\""* ]]; then
        ok "  component $comp healthy"
      else
        fail "  component $comp is not healthy"
      fi
    done

    # An empty index still reports healthy, so check chunk count explicitly.
    chunks="$(printf '%s' "$health" | grep -oE '"total_chunks":[0-9]+' | head -1 | cut -d: -f2)"
    docs="$(printf '%s' "$health" | grep -oE '"unique_documents":[0-9]+' | head -1 | cut -d: -f2)"
    if [[ "${chunks:-0}" -gt 0 ]]; then
      ok "knowledge base populated — ${docs:-?} document(s), ${chunks} chunk(s)"
    else
      fail "knowledge base is EMPTY — retrieval returns nothing and questions come out blank"
      info "seed it: docker cp ai-engine/question_bank_engine/data/documents/. talentsecure-question-bank:/app/question_bank_engine/data/documents/"
      info "then:    curl -X POST http://127.0.0.1:8001/documents/ingest-batch -H \"X-API-Key: \$KEY\""
    fi
  fi
fi

# ── 11. Backups ───────────────────────────────────────────────────────────────
section "Backups"

if [[ ! -d "$BACKUP_ROOT" ]]; then
  fail "backup directory not found: $BACKUP_ROOT"
  info "run ./scripts/backup-volumes.sh to create the first backup"
else
  # Two layouts are accepted: timestamped sets (backup-volumes.sh) or loose
  # archives written straight into the directory by hand.
  latest="$(find "$BACKUP_ROOT" -mindepth 1 -maxdepth 1 -type d 2>/dev/null | sort | tail -1)"
  if [[ -n "$latest" ]]; then
    set_dir="$latest"; layout="set $(basename "$latest")"
  elif [[ -n "$(find "$BACKUP_ROOT" -maxdepth 1 -name '*.tar.gz' -o -maxdepth 1 -name '*.tgz' 2>/dev/null | head -1)" ]]; then
    set_dir="$BACKUP_ROOT"; layout="loose archives"
    warn "backups are loose archives, not timestamped sets — prefer ./scripts/backup-volumes.sh"
  else
    set_dir=""
  fi

  if [[ -z "$set_dir" ]]; then
    fail "no backups found under $BACKUP_ROOT"
    info "run ./scripts/backup-volumes.sh before any deploy that touches data"
  else
    newest="$(find "$set_dir" -maxdepth 1 -type f \( -name '*.tar.gz' -o -name '*.tgz' \) -printf '%T@\n' 2>/dev/null | sort -n | tail -1 | cut -d. -f1)"
    newest="${newest:-$(stat -c %Y "$set_dir" 2>/dev/null)}"
    age_days=$(( ( $(date +%s) - ${newest:-0} ) / 86400 ))
    if [[ "$age_days" -le "$MAX_BACKUP_AGE_DAYS" ]]; then
      ok "newest backup is ${age_days}d old — ${layout}"
    else
      fail "newest backup is ${age_days}d old (threshold ${MAX_BACKUP_AGE_DAYS}d) — ${layout}"
    fi

    for entry in "${CRITICAL_VOLUMES[@]}"; do
      v="${entry%%|*}"
      f=""
      for cand in "${set_dir}/${v}.tar.gz" "${set_dir}/${v}.tgz"; do
        [[ -f "$cand" ]] && f="$cand" && break
      done
      if [[ -n "$f" ]]; then
        sz=$(stat -c %s "$f" 2>/dev/null || stat -f %z "$f")
        if [[ "${sz:-0}" -lt 1024 ]]; then
          fail "backup $(basename "$f") is only $(human "$sz") — almost certainly empty"
        else
          ok "backup $(basename "$f")  ($(human "$sz"))"
        fi
      else
        fail "no backup for critical volume '$v' in ${layout}"
      fi
    done

    if [[ -f "${set_dir}/manifest.txt" ]]; then
      ok "manifest present with checksums"
    else
      warn "no manifest.txt — archive integrity cannot be verified"
    fi

    info "total $(du -sh "$BACKUP_ROOT" 2>/dev/null | cut -f1) under $BACKUP_ROOT"
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
