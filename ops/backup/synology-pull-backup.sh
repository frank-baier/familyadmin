#!/bin/bash
# Nightly pull of the FamilyAdmin database dump from Hetzner to the Synology.
#
# The dump is streamed over SSH straight onto the Synology — nothing is stored on the server.
# Retention: 7 daily, 4 weekly (Sundays), 12 monthly (1st of month). Weekly/monthly entries are
# hardlinks to the daily file, so they cost no extra space until the daily copy is pruned.
#
# Setup on the Synology (once):
#   1. ssh-keygen -t ed25519 -N "" -f /volume1/backup/familyadmin/.ssh/id_ed25519
#   2. On the Mac, from the repo root: bash ops/backup/install-server.sh "<contents of id_ed25519.pub>"
#   3. As root, trust the server's host key once:  ssh-keyscan -t ed25519 178.104.152.16 >> /root/.ssh/known_hosts
#   4. DSM → Control Panel → Task Scheduler → Create → Scheduled Task → User-defined script
#      User: root, daily 03:00, command: bash /volume1/backup/familyadmin/synology-pull-backup.sh
#      Enable "Send run details by email" → "only when the script terminates abnormally".
#
# Restore: pg_restore --clean --if-exists -U <user> -d familyadmin <file>.dump
set -euo pipefail

HOST="${HOST:-fabackup@178.104.152.16}"
DEST="${DEST:-/volume1/backup/familyadmin}"
KEY="$DEST/.ssh/id_ed25519"
KEEP_DAILY=7
KEEP_WEEKLY=4
KEEP_MONTHLY=12

mkdir -p "$DEST/daily" "$DEST/weekly" "$DEST/monthly"
stamp=$(date +%Y-%m-%d)
file="familyadmin-$stamp.dump"
tmp="$DEST/.incoming-$file"
trap 'rm -f "$tmp"' EXIT

ssh -T -i "$KEY" -o BatchMode=yes -o ServerAliveInterval=30 "$HOST" > "$tmp"

# Custom-format dumps start with the magic bytes "PGDMP"
if [ "$(head -c 5 "$tmp")" != "PGDMP" ]; then
    echo "ERROR: received file is not a pg_dump archive" >&2
    exit 1
fi

size=$(wc -c < "$tmp" | tr -d " ")
warn=""
dailies=("$DEST"/daily/*.dump)
prev="${dailies[${#dailies[@]}-1]}"
if [ -e "$prev" ]; then
    prev_size=$(wc -c < "$prev" | tr -d " ")
    if [ "$size" -lt $((prev_size / 2)) ]; then
        warn="WARNING: dump shrank by more than half ($prev_size -> $size bytes) — check the database"
    fi
fi

mv "$tmp" "$DEST/daily/$file"
if [ "$(date +%u)" = "7" ]; then ln -f "$DEST/daily/$file" "$DEST/weekly/$file"; fi
if [ "$(date +%d)" = "01" ]; then ln -f "$DEST/daily/$file" "$DEST/monthly/$file"; fi

prune() {
    local files=("$1"/*.dump)
    [ -e "${files[0]}" ] || return 0
    # Glob results are sorted; filenames sort by date, so the oldest come first
    local excess=$((${#files[@]} - $2))
    [ "$excess" -gt 0 ] && rm -f -- "${files[@]:0:excess}"
    return 0
}
prune "$DEST/daily" "$KEEP_DAILY"
prune "$DEST/weekly" "$KEEP_WEEKLY"
prune "$DEST/monthly" "$KEEP_MONTHLY"

echo "OK: $file ($size bytes)"
if [ -n "$warn" ]; then
    echo "$warn" >&2
    exit 1
fi
