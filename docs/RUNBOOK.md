# INSANE runbook (server and ops)

How to deploy, back up, restore, roll back and keep the INSANE server healthy. Written by WS-I for v0.9 (PLAN-V09 §9, "bus factor").

## What runs where

- One Docker web service on Render (`render.yaml`), region Singapore, with a 1 GB persistent disk at `/var/data`.
- The SQLite DB is `/var/data/insane.db`. Snapshots go to `/var/data/backups/`, and to a bucket if one is set.
- The server has no runtime dependencies. Node is pinned in `.nvmrc` and the `Dockerfile` (`node:22.23.3-slim`).
- Health check: `GET /api/health` returns `{ok, build, schema, store, docs}`.
- A disk means one instance. Each deploy restarts the service for a few seconds; there are no zero-downtime deploys.

## Environment

Set these in the Render dashboard. `render.yaml` lists them all; the ones marked `sync: false` are entered by hand.

| Var | Needed for | Without it |
|---|---|---|
| `PUBLIC_URL` | links in emails; `https://` turns on `Secure` cookies and HSTS | `http://localhost:PORT` |
| `OWNER_EMAIL` | owner tools: moderation, stats, `/api/funnel` | no owner |
| `RESEND_API_KEY`, `MAIL_FROM` | sign-in emails to anyone | codes are only printed in the server log |
| `SENTRY_DSN` (+ `SENTRY_ENV`) | errors to Sentry, server and `/api/err` | errors only in the log |
| `GOOGLE_CLIENT_ID` | Google Sign-In (`POST /api/auth/google`) | email code only; `hello.google` is null |
| `TILE_URL`, `TILE_ATTR` | map tiles (C69: not OSM's own server in production) | tile.openstreetmap.org |
| `VAPID_SUBJECT` | web push contact (`mailto:…`) | `mailto:admin@example.com` |
| `BACKUP_BUCKET`, `BACKUP_ENDPOINT`, `BACKUP_ACCESS_KEY_ID`, `BACKUP_SECRET_ACCESS_KEY`, `BACKUP_REGION` | off-disk backups (R2, S3, B2, MinIO) | snapshots only on the same disk (weaker) |
| `BACKUP_EVERY_H` (24), `BACKUP_KEEP` (14), `BACKUP_PREFIX` (`insane/`) | backup cadence and retention | defaults |
| `DEFAULT_TZ` (`Asia/Kolkata`) | circles and quiet hours with no zone | Asia/Kolkata |
| `MAX_CIRCLES` (3) | circles per person (C36) | 3 |
| `TRUST_PROXY=1` | real client IPs behind Render's proxy, for per-IP limits | every request looks like the proxy |
| `MIN_CLIENT_BUILD` | force old clients to reload after a breaking API change (C08) | no forced reload |
| `RATE_LIMITS` | JSON overrides, e.g. `{"write":{"cap":120}}` | defaults in `server/ratelimit.js` |
| `CSP_EXTRA` | extra CSP sources, e.g. `connect-src https://tiles.example.com` | the built-in policy |

VAPID keys are generated on first boot and kept in the DB (`kv` table), so they survive deploys and are restored with the DB.

## Deploy a release (C99)

1. Make sure `npm test` is green on the commit.
2. Tag it: `git tag v0.9.0 && git push origin v0.9.0`.
3. In Render, deploy that tag or commit (`autoDeploy` is off on purpose).
4. Watch the log for `[migrate] …` and check `GET /api/health`.

**Migrations run on boot.** `server/migrate.js` snapshots the DB to `backup-pre-v9.db` first (only when something will change), then migrates inside one transaction. If a step fails, the transaction rolls back and the server refuses to start. The previous release keeps serving until the health check passes.

**Expand → migrate → contract.** For one release, v0.9 reads and writes both shapes. For example, `people.circle` is kept as the primary and mirrored into `circles: []`. Only remove an old field in the release *after* every client has moved.

## Back up

- **Automatic:** every `BACKUP_EVERY_H` hours. The server takes an online snapshot with SQLite's backup API, checks it with `integrity_check`, keeps the newest `BACKUP_KEEP`, and uploads it if a bucket is set.
- **By hand** (Render Shell): `tools/backup.sh backup`
- **List:** `tools/backup.sh list`

Point-in-time recovery is at snapshot granularity. Set `BACKUP_EVERY_H=1` for hourly snapshots.

## Restore (tested by `test/unit/server-backup.test.js`)

1. Suspend the service in Render, so nothing writes to the DB.
2. Open the Render Shell, or a one-off job with the disk attached.
3. Run one of these:
   - `tools/backup.sh restore latest`: the newest snapshot from the bucket, or from `/var/data/backups` without one
   - `tools/backup.sh restore s3:insane/insane-20261017T000000Z.db`
   - `tools/backup.sh restore /var/data/backups/backup-pre-v9.db`
4. Resume the service and check `/api/health`.

The restore checks the file before it touches the DB. It keeps the old DB as `insane.db.before-restore` and removes stale `-wal`/`-shm` files.

## Roll back

- **Code only:** deploy the previous tag. v0.9's store shape is a superset of v0.8's, so the v0.8 server runs on a migrated DB.
- **Code and data:** suspend the service, run `tools/backup.sh restore /var/data/backups/backup-pre-v9.db`, deploy the `v0.8` tag (fac3720), then resume.

## Routine tasks

- **Rotate VAPID keys:**
  1. Suspend the service.
  2. Run `sqlite3 /var/data/insane.db "DELETE FROM kv WHERE k='vapid'; DELETE FROM push;"`.
  3. Resume.

  New keys are made on boot. Every browser re-subscribes the next time it opens INSANE.
- **Change `OWNER_EMAIL`:** set the env var and redeploy. The owner is whoever signs in with that email.
- **Sign everyone out:** `sqlite3 /var/data/insane.db "DELETE FROM sessions;"`
- **Funnel:** `GET /api/funnel?days=30` (owner only) returns aggregate counts per day. No identities are stored.
- **Too many 429s:** raise a class with `RATE_LIMITS`, for example `{"write":{"cap":120,"per":60000}}`.

## Test hooks (DEV=1 only)

- `POST /api/dev/clock {offset}` moves the server clock and pushes the time-bound views.
- `POST /api/dev/tick {offset?}` runs the sweep now: Midnight release, drop reminders and clip expiry.
- `GET /api/dev/outbox?email=` and `GET /api/dev/pushlog`.
