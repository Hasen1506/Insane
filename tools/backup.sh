#!/bin/sh
# Back up or restore the INSANE SQLite DB (C97). A thin wrapper over server/backup.js, which needs only Node.
#   tools/backup.sh backup                      snapshot DB_FILE now; uploads to the bucket if BACKUP_BUCKET is set
#   tools/backup.sh list                        local snapshots and bucket keys
#   tools/backup.sh restore latest              newest snapshot (bucket if set, else BACKUP_DIR) → DB_FILE
#   tools/backup.sh restore s3:insane/insane-20261017T000000Z.db
#   tools/backup.sh restore /var/data/backups/insane-20261017T000000Z.db
# Stop the server before a restore (on Render: suspend the service, run from the Shell, resume).
# Env: DB_FILE BACKUP_DIR BACKUP_KEEP BACKUP_BUCKET BACKUP_ENDPOINT BACKUP_REGION BACKUP_PREFIX
#      BACKUP_ACCESS_KEY_ID BACKUP_SECRET_ACCESS_KEY  (see docs/RUNBOOK.md)
set -eu
cd "$(dirname "$0")/.."
exec node --disable-warning=ExperimentalWarning server/backup.js "$@"
