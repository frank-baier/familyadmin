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
#   3. Pin the server's host key next to the client key (DSM has no ssh-keyscan, and Task Scheduler
#      does not run with root's $HOME, so /root/.ssh/known_hosts is NOT read):
#      echo "178.104.152.16 ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIK97sipBPSGjg1IxzSAypuNMQeYXkJ2pid9VWnMXcAg2" \
#          > /volume1/backup/familyadmin/.ssh/known_hosts
#   4. DSM → Control Panel → Task Scheduler → Create → Scheduled Task → User-defined script
#      User: root, daily at 08:30, command: bash /volume1/backup/familyadmin/synology-pull-backup.sh
#      Enable "Send run details by email" → "only when the script terminates abnormally".
#      The NAS uses HDD hibernation only (DSM keeps running, never reboots), so a boot trigger never
#      fires but a fixed time always does. Hourly runs would wake the disks just to skip (see MARKER).
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
# At most one dump per day. The marker lives in /tmp (RAM) so the hourly check doesn't wake the
# disks; after a reboot it's gone and the day's dump is simply taken again, which is harmless.
MARKER="${MARKER_DIR:-/tmp}/familyadmin-backup-$stamp.done"
[ -e "$MARKER" ] && exit 0
file="familyadmin-$stamp.dump"
tmp="$DEST/.incoming-$file"
trap 'rm -f "$tmp"' EXIT

server() {
    ssh -T -i "$KEY" -o BatchMode=yes -o ServerAliveInterval=30 \
        -o UserKnownHostsFile="$DEST/.ssh/known_hosts" -o StrictHostKeyChecking=yes \
        "$HOST" "$1" < /dev/null
}

server dump > "$tmp"

# A transfer can end early yet still report success (it did on 2026-11-09), so compare
# against the checksum and size the server computed for the dump it sent
expected=$(server verify)
size=$(wc -c < "$tmp" | tr -d " ")
actual="$(sha256sum < "$tmp" | cut -d' ' -f1) $size"
if [ "$actual" != "$expected" ]; then
    echo "ERROR: incomplete transfer — server sent '$expected', received '$actual'" >&2
    exit 1
fi

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

touch "$MARKER"
echo "OK: $file ($size bytes)"
if [ -n "$warn" ]; then
    echo "$warn" >&2
    exit 1
fi
