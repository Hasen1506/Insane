#!/bin/sh
# Render mounts the persistent disk owned by root. Give the data dir to the unprivileged `node` user,
# then run the server as `node`. Fails closed: never runs the server as root.
set -eu
DATA_DIR=$(dirname "${DB_FILE:-/var/data/insane.db}")
if [ "$(id -u)" = "0" ]; then
  mkdir -p "$DATA_DIR" "${BACKUP_DIR:-$DATA_DIR/backups}"
  chown -R node:node "$DATA_DIR" "${BACKUP_DIR:-$DATA_DIR/backups}"
  exec setpriv --reuid=node --regid=node --init-groups -- "$@"
fi
if [ ! -w "$DATA_DIR" ]; then echo "INSANE: $DATA_DIR is not writable by uid $(id -u)" >&2; exit 1; fi
exec "$@"
