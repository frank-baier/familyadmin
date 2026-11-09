#!/bin/bash
# One-time setup of the backup endpoint on the Hetzner server. Run from the repo root on your Mac:
#
#   bash ops/backup/install-server.sh                      # install/update script, user, sudo rule
#   bash ops/backup/install-server.sh "ssh-ed25519 AAAA…"  # same, plus (re)place the Synology key
#
# Without a key argument, an already authorized key is kept and its forced command updated.
# Idempotent — safe to run again.
set -euo pipefail

SERVER="root@178.104.152.16"
# Collapse whitespace/newlines — a key pasted across two lines once ended up split in authorized_keys
PUBKEY="$(echo ${1:-})"

scp -q "$(dirname "$0")/familyadmin-dump" "$SERVER:/tmp/familyadmin-dump"
ssh "$SERVER" PUBKEY="'$PUBKEY'" bash -s <<'EOF'
set -euo pipefail
install -o root -g root -m 0755 /tmp/familyadmin-dump /usr/local/bin/familyadmin-dump
rm /tmp/familyadmin-dump

id fabackup >/dev/null 2>&1 || useradd --create-home --shell /bin/sh fabackup
passwd -l fabackup >/dev/null
install -d -o fabackup -g fabackup -m 0700 /home/fabackup/.ssh

printf '%s\n' "fabackup ALL=(root) NOPASSWD: /usr/local/bin/familyadmin-dump dump, /usr/local/bin/familyadmin-dump verify" \
    > /tmp/fabackup.sudoers
visudo -cqf /tmp/fabackup.sudoers
install -o root -g root -m 0440 /tmp/fabackup.sudoers /etc/sudoers.d/fabackup
rm /tmp/fabackup.sudoers

KEYS=/home/fabackup/.ssh/authorized_keys
if [ -z "$PUBKEY" ] && [ -f "$KEYS" ]; then
    PUBKEY="$(grep -o 'ssh-ed25519 [A-Za-z0-9+/=]*' "$KEYS" | head -n 1 || true)"
fi
if [ -n "$PUBKEY" ]; then
    # The client picks dump|verify; sudo only permits those two, anything else is refused
    printf 'command="sudo /usr/local/bin/familyadmin-dump \\"$SSH_ORIGINAL_COMMAND\\"",restrict %s\n' "$PUBKEY" > "$KEYS"
    chown fabackup:fabackup "$KEYS"
    chmod 600 "$KEYS"
    echo "Synology key authorized:"
    cat "$KEYS"
fi
sudo -l -U fabackup | tail -1
echo "Server setup done."
EOF
