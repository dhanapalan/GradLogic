#!/usr/bin/env bash
# =============================================================================
# TalentSecure-AI — Create Docker Volumes (Fresh Setup)
# =============================================================================
# Run this ONCE before your first `docker compose up`.
# Creates all named volumes with proper labels so backup/restore works.
#
# Usage:
#   ./scripts/init-volumes.sh              # create volumes (safe if they exist)
#   ./scripts/init-volumes.sh --reset      # WIPE existing volumes and recreate
# =============================================================================

set -euo pipefail

COMPOSE_PROJECT="talentsecure-ai"
RESET=false

# ── Parse args ────────────────────────────────────────────────────────────────
for arg in "$@"; do
  case "$arg" in
    --reset) RESET=true ;;
    -h|--help)
      sed -n '2,11p' "$0" | sed 's/^# \?//'
      exit 0
      ;;
  esac
done

log()  { echo "[$(date +%H:%M:%S)] $*"; }
ok()   { echo "[$(date +%H:%M:%S)] ✓ $*"; }
warn() { echo "[$(date +%H:%M:%S)] ! $*"; }

# ── Volume definitions ────────────────────────────────────────────────────────
# Format: "volume_name|service|backup_enabled"
declare -a VOLUMES=(
  "pgdata|postgres|true"
  "redisdata|redis|true"
  "miniodata|minio|true"
  "judge0pgdata|judge0-postgres|false"
  "judge0redisdata|judge0-redis|false"
)

# ── Reset: wipe existing volumes ──────────────────────────────────────────────
if [[ "$RESET" == "true" ]]; then
  echo ""
  warn "WARNING: --reset will permanently delete all volume data!"
  read -r -p "  Type 'yes' to confirm: " answer
  if [[ "$answer" != "yes" ]]; then
    echo "Aborted."
    exit 0
  fi

  log "Removing existing volumes..."
  for entry in "${VOLUMES[@]}"; do
    vol_name="${entry%%|*}"
    full_name="${COMPOSE_PROJECT}_${vol_name}"
    if docker volume inspect "$full_name" &>/dev/null 2>&1; then
      docker volume rm "$full_name"
      ok "Removed $full_name"
    fi
  done
  echo ""
fi

# ── Create volumes ─────────────────────────────────────────────────────────────
log "=== TalentSecure-AI — Initialising Docker Volumes ==="
echo ""

created=0
skipped=0

for entry in "${VOLUMES[@]}"; do
  IFS='|' read -r vol_name service backup <<< "$entry"
  full_name="${COMPOSE_PROJECT}_${vol_name}"

  if docker volume inspect "$full_name" &>/dev/null 2>&1; then
    warn "$full_name  already exists — skipped (use --reset to recreate)"
    skipped=$((skipped + 1))
    continue
  fi

  docker volume create \
    --label "com.talentsecure.project=${COMPOSE_PROJECT}" \
    --label "com.talentsecure.service=${service}" \
    --label "com.talentsecure.backup=${backup}" \
    "$full_name" > /dev/null

  ok "Created $full_name  (backup=${backup})"
  created=$((created + 1))
done

# ── Summary ───────────────────────────────────────────────────────────────────
echo ""
log "=== Done: ${created} created, ${skipped} skipped ==="
echo ""
echo "Volumes:"
docker volume ls --filter "label=com.talentsecure.project=${COMPOSE_PROJECT}" \
  --format "  {{.Name}}\t{{.Driver}}"

echo ""
echo "Next steps:"
echo "  1. Edit .env with your secrets"
echo "  2. docker compose up -d"
echo "  3. ./scripts/backup-volumes.sh   # take your first backup"
