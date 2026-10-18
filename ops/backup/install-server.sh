#!/bin/bash
# One-time setup of the backup endpoint on the Hetzner server. Run from the repo root on your Mac:
#
#   bash ops/backup/install-server.sh                      # install script, user, sudo rule
#   bash ops/backup/install-server.sh "ssh-ed25519 AAAA…"  # same, plus authorize the Synology key
#
# Idempotent — safe to run again (e.g. to replace the Synology key).
set -euo pipefail

SERVER="root@178.104.152.16"
PUBKEY="${1:-}"

scp -q "$(dirname "$0")/familyadmin-dump" "$SERVER:/tmp/familyadmin-dump"
ssh "$SERVER" PUBKEY="'$PUBKEY'" bash -s <<'EOF'
set -euo pipefail
install -o root -g root -m 0755 /tmp/familyadmin-dump /usr/local/bin/familyadmin-dump
rm /tmp/familyadmin-dump

id fabackup >/dev/null 2>&1 || useradd --create-home --shell /bin/sh fabackup
passwd -l fabackup >/dev/null
install -d -o fabackup -g fabackup -m 0700 /home/fabackup/.ssh

echo "fabackup ALL=(root) NOPASSWD: /usr/local/bin/familyadmin-dump" > /tmp/fabackup.sudoers
visudo -cqf /tmp/fabackup.sudoers
install -o root -g root -m 0440 /tmp/fabackup.sudoers /etc/sudoers.d/fabackup
rm /tmp/fabackup.sudoers

if [ -n "$PUBKEY" ]; then
    echo "command=\"sudo /usr/local/bin/familyadmin-dump\",restrict $PUBKEY" > /home/fabackup/.ssh/authorized_keys
    chown fabackup:fabackup /home/fabackup/.ssh/authorized_keys
    chmod 600 /home/fabackup/.ssh/authorized_keys
    echo "Synology key authorized."
fi
sudo -l -U fabackup | tail -1
echo "Server setup done."
EOF
