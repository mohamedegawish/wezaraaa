#!/bin/sh
# Backup cron — runs daily at 02:00, keeps 14 days, logs to /var/log/industry-backup.log
# Install: crontab -e  →  0 2 * * * /path/to/INDUSTRIAL_INITIATIVES/backend/scripts/backup-cron.sh
set -eu
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
LOG="/var/log/industry-backup.log"
STAMP="$(date -u +%Y-%m-%dT%H-%M-%S)"
OUT="$ROOT/backups/$STAMP"
mkdir -p "$(dirname "$OUT")"
echo "[$STAMP] backup start" | tee -a "$LOG"
if ! node "$ROOT/backend/scripts/backup.mjs" "$OUT" >> "$LOG" 2>&1; then
  echo "[$STAMP] backup FAILED" | tee -a "$LOG"
  exit 1
fi
# Prune backups older than 14 days
find "$ROOT/backups" -maxdepth 1 -type d -mtime +14 -exec rm -rf {} + 2>/dev/null || true
echo "[$STAMP] backup ok — $(ls -1 "$ROOT/backups" 2>/dev/null | wc -l) backups retained" | tee -a "$LOG"
