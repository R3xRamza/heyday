#!/usr/bin/env bash
# Backup production SQLite from Railway volume to a dated local folder.
# Requires: railway CLI (logged in + linked to heyday production), sqlite3
#
# Usage:
#   npm run backup:prod
#   ./scripts/backup-prod-db.sh
#
# Env overrides:
#   RAILWAY_VOLUME   (default: heyday-volume)
#   REMOTE_DB_PATH   (default: /data/heyday.db)
#   BACKUP_ROOT      (default: <repo>/backups)
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
VOLUME="${RAILWAY_VOLUME:-heyday-volume}"
REMOTE_DB="${REMOTE_DB_PATH:-/data/heyday.db}"
BACKUP_ROOT="${BACKUP_ROOT:-$ROOT/backups}"
STAMP="$(date +%Y%m%d-%H%M%S)"
DEST="$BACKUP_ROOT/$STAMP"
BASE="heyday-prod"

need() {
  command -v "$1" >/dev/null 2>&1 || {
    echo "Missing required command: $1" >&2
    exit 1
  }
}

need railway
need sqlite3
need date
need mkdir

echo "→ Creating $DEST"
mkdir -p "$DEST"

echo "→ Downloading $REMOTE_DB (+ wal/shm) from volume $VOLUME"
echo "  (If prompted for a volume, press Enter on heyday-volume. Do not Ctrl+C.)"
railway volume files --volume "$VOLUME" download "$REMOTE_DB" "$DEST/${BASE}.db"
railway volume files --volume "$VOLUME" download "${REMOTE_DB}-wal" "$DEST/${BASE}.db-wal" || {
  echo "Note: no -wal file (ok if DB was checkpointed)"
}
railway volume files --volume "$VOLUME" download "${REMOTE_DB}-shm" "$DEST/${BASE}.db-shm" || {
  echo "Note: no -shm file (ok if DB was checkpointed)"
}

echo "→ Verifying"
ls -lh "$DEST"
sqlite3 "$DEST/${BASE}.db" ".tables" >/dev/null
INTEGRITY="$(sqlite3 "$DEST/${BASE}.db" "PRAGMA integrity_check;")"
echo "integrity_check: $INTEGRITY"

if [[ "$INTEGRITY" != "ok" ]]; then
  echo "ERROR: backup failed integrity check. Leaving files in $DEST for inspection." >&2
  exit 1
fi

echo "→ Writing consolidated single-file snapshot"
sqlite3 "$DEST/${BASE}.db" ".backup '$DEST/${BASE}-consolidated.db'"
CONSOLIDATED_OK="$(sqlite3 "$DEST/${BASE}-consolidated.db" "PRAGMA integrity_check;")"
if [[ "$CONSOLIDATED_OK" != "ok" ]]; then
  echo "ERROR: consolidated backup failed integrity check." >&2
  exit 1
fi

cat > "$DEST/README.txt" <<EOF
HEYDAY production DB backup
Created: $STAMP
Source: Railway volume $VOLUME path $REMOTE_DB

Files:
  ${BASE}.db (+ optional .db-wal / .db-shm) — raw copy from volume
  ${BASE}-consolidated.db — single-file snapshot (prefer this for archive/restore)

Keep the raw trio together if you keep them. Prefer consolidated for offsite copies.
Do not casually upload over production.
EOF

echo
echo "✓ Backup OK → $DEST"
echo "  Prefer ${BASE}-consolidated.db for offsite copies."
