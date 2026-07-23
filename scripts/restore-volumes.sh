#!/usr/bin/env bash
# =============================================================================
# TalentSecure-AI — Docker Volume Restore
# =============================================================================
# Usage:
#   ./scripts/restore-volumes.sh <backup-dir>            # restore all volumes
#   ./scripts/restore-volumes.sh <backup-dir> pgdata     # restore one volume
#
# Example:
#   ./scripts/restore-volumes.sh backups/2025-01-15_10-30-00
#   ./scripts/restore-volumes.sh backups/2025-01-15_10-30-00 pgdata
#
# IMPORTANT: Stop containers before restoring.
#   docker compose down  →  run this script  →  docker compose up -d
# =============================================================================

set -euo pipefail

COMPOSE_PROJECT="${COMPOSE_PROJECT:-talentsecure-ai}"
BACKUP_DIR=""
SINGLE_VOLUME=""

# ── Parse args ────────────────────────────────────────────────────────────────
while [[ $# -gt 0 ]]; do
  case "$1" in
    -p|--project) COMPOSE_PROJECT="$2"; shift 2 ;;
    -h|--help) sed -n '2,14p' "$0" | sed 's/^# \?//'; exit 0 ;;
    -*)  echo "Unknown option: $1" >&2; exit 1 ;;
    *)
      if [[ -z "$BACKUP_DIR" ]]; then BACKUP_DIR="$1"
      else SINGLE_VOLUME="$1"
      fi
      shift ;;
  esac
done

if [[ -z "$BACKUP_DIR" ]]; then
  echo "Usage: $0 <backup-dir> [volume-name]" >&2
  exit 1
fi

if [[ ! -d "$BACKUP_DIR" ]]; then
  echo "ERROR: Backup directory not found: $BACKUP_DIR" >&2
  exit 1
fi

# ── Helpers ───────────────────────────────────────────────────────────────────
log()  { echo "[$(date +%H:%M:%S)] $*"; }
ok()   { echo "[$(date +%H:%M:%S)] ✓ $*"; }
fail() { echo "[$(date +%H:%M:%S)] ✗ $*" >&2; }

# Convert Git Bash /c/... paths to C:/... for Docker volume mounts on Windows
to_docker_path() {
  local p="$1"
  if [[ "$OSTYPE" == "msys" || "$OSTYPE" == "cygwin" ]]; then
    echo "$p" | sed 's|^/\([a-zA-Z]\)/|\1:/|'
  else
    echo "$p"
  fi
}

confirm() {
  read -r -p "$1 [y/N] " answer
  [[ "$answer" =~ ^[Yy]$ ]]
}

restore_volume() {
  local vol_name="$1"
  local archive="${BACKUP_DIR}/${vol_name}.tar.gz"
  local full_name="${COMPOSE_PROJECT}_${vol_name}"

  if [[ ! -f "$archive" ]]; then
    fail "Archive not found: ${vol_name}.tar.gz — skipping"
    return 1
  fi

  # Create volume if missing (fresh machine / fresh setup)
  if ! docker volume inspect "$full_name" &>/dev/null 2>&1; then
    log "Volume $full_name does not exist — creating it"
    docker volume create \
      --label "com.talentsecure.project=${COMPOSE_PROJECT}" \
      --label "com.talentsecure.service=${vol_name}" \
      --label "com.talentsecure.backup=true" \
      "$full_name" > /dev/null
    ok "Volume $full_name created"
  else
    log "Volume $full_name exists — will overwrite data"
    confirm "  Overwrite $vol_name?" || { log "Skipped $vol_name"; return 0; }
  fi

  log "Restoring  ${vol_name}.tar.gz  →  $full_name"

  MSYS_NO_PATHCONV=1 docker run --rm \
    -v "${full_name}:/volume-data" \
    -v "$(to_docker_path "$(cd "$BACKUP_DIR" && pwd)"):/backup:ro" \
    alpine \
    sh -c "rm -rf /volume-data/* /volume-data/.[!.]* /volume-data/..?* 2>/dev/null; tar xzf /backup/${vol_name}.tar.gz -C /volume-data"

  ok "$vol_name restored"
}

# ── Main ──────────────────────────────────────────────────────────────────────
log "=== TalentSecure-AI Volume Restore  [project: ${COMPOSE_PROJECT}] ==="
log "Source: $BACKUP_DIR"

if [[ -f "${BACKUP_DIR}/manifest.txt" ]]; then
  echo ""
  cat "${BACKUP_DIR}/manifest.txt"
fi

echo ""
echo "WARNING: This will overwrite existing volume data."
confirm "Proceed?" || { echo "Aborted."; exit 0; }
echo ""

restored=0
failed=0

if [[ -n "$SINGLE_VOLUME" ]]; then
  if restore_volume "$SINGLE_VOLUME"; then restored=$((restored + 1)); else failed=$((failed + 1)); fi
else
  for archive in "${BACKUP_DIR}"/*.tar.gz; do
    [[ -f "$archive" ]] || continue
    vol_name="$(basename "$archive" .tar.gz)"
    if restore_volume "$vol_name"; then restored=$((restored + 1)); else failed=$((failed + 1)); fi
  done
fi

echo ""
log "=== Restore complete: ${restored} restored, ${failed} failed ==="
echo ""
echo "Next step: docker compose up -d"
