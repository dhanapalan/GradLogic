#!/usr/bin/env bash
# =============================================================================
# TalentSecure-AI — Docker Volume Backup
# =============================================================================
# Usage:
#   ./scripts/backup-volumes.sh                  # backup all volumes
#   ./scripts/backup-volumes.sh pgdata           # backup a single volume
#   ./scripts/backup-volumes.sh -o /my/backups   # custom output directory
#
# Output: backups/YYYY-MM-DD_HH-MM-SS/<volume>.tar.gz + manifest.txt
#
# Volumes backed up: pgdata, redisdata, miniodata
# Volumes skipped  : judge0pgdata, judge0redisdata  (ephemeral, recreatable)
# =============================================================================

set -euo pipefail

# ── Config ────────────────────────────────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
BACKUP_ROOT="${PROJECT_ROOT}/backups"
TIMESTAMP="$(date +%Y-%m-%d_%H-%M-%S)"
SINGLE_VOLUME=""

# Auto-detect compose project name (default: directory name lowercased)
COMPOSE_PROJECT="${COMPOSE_PROJECT:-talentsecure-ai}"

# Volumes worth backing up
BACKUP_VOLUMES=(
  "pgdata"
  "redisdata"
  "miniodata"
)

# ── Parse args ────────────────────────────────────────────────────────────────
while [[ $# -gt 0 ]]; do
  case "$1" in
    -o|--output) BACKUP_ROOT="$2"; shift 2 ;;
    -p|--project) COMPOSE_PROJECT="$2"; shift 2 ;;
    -h|--help) sed -n '2,13p' "$0" | sed 's/^# \?//'; exit 0 ;;
    -*) echo "Unknown option: $1" >&2; exit 1 ;;
    *) SINGLE_VOLUME="$1"; shift ;;
  esac
done

BACKUP_DIR="${BACKUP_ROOT}/${TIMESTAMP}"
mkdir -p "$BACKUP_DIR"

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

backup_volume() {
  local vol_name="$1"
  local full_name="${COMPOSE_PROJECT}_${vol_name}"
  local out_file="${BACKUP_DIR}/${vol_name}.tar.gz"

  if ! docker volume inspect "$full_name" &>/dev/null 2>&1; then
    fail "Volume '$full_name' not found — run ./scripts/init-volumes.sh first"
    return 1
  fi

  log "Backing up  $full_name  →  ${vol_name}.tar.gz"

  MSYS_NO_PATHCONV=1 docker run --rm \
    -v "${full_name}:/volume-data:ro" \
    -v "$(to_docker_path "${BACKUP_DIR}"):/backup" \
    alpine \
    tar czf "/backup/${vol_name}.tar.gz" -C /volume-data .

  local size
  size=$(du -sh "$out_file" | cut -f1)
  ok "${vol_name}  (${size})"
}

write_manifest() {
  local manifest="${BACKUP_DIR}/manifest.txt"
  {
    echo "TalentSecure-AI Volume Backup"
    echo "Timestamp   : ${TIMESTAMP}"
    echo "Host        : $(hostname)"
    echo "Project     : ${COMPOSE_PROJECT}"
    echo "---"
    for f in "${BACKUP_DIR}"/*.tar.gz; do
      [[ -f "$f" ]] || continue
      local hash=""
      if command -v sha256sum &>/dev/null; then
        hash=$(sha256sum "$f" | awk '{print $1}')
      elif command -v shasum &>/dev/null; then
        hash=$(shasum -a 256 "$f" | awk '{print $1}')
      fi
      printf "%-30s  %6s  %s\n" "$(basename "$f")" "$(du -sh "$f" | cut -f1)" "$hash"
    done
  } > "$manifest"
  ok "Manifest → $manifest"
}

# ── Main ──────────────────────────────────────────────────────────────────────
log "=== TalentSecure-AI Volume Backup  [project: ${COMPOSE_PROJECT}] ==="
log "Output: $BACKUP_DIR"
echo ""

success=0
failed=0

if [[ -n "$SINGLE_VOLUME" ]]; then
  if backup_volume "$SINGLE_VOLUME"; then success=$((success + 1)); else failed=$((failed + 1)); fi
else
  for vol in "${BACKUP_VOLUMES[@]}"; do
    if backup_volume "$vol"; then success=$((success + 1)); else failed=$((failed + 1)); fi
  done
fi

write_manifest

echo ""
log "=== Backup complete: ${success} succeeded, ${failed} failed ==="
echo ""
ls -lh "$BACKUP_DIR"
