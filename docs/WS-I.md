# WS-I: server and ops (v0.9), notes for the integrator

Branch `ws-i`, based on `888f1fd`. Operations are covered in [RUNBOOK.md](RUNBOOK.md).

## What moved out of `server/server.js`

The move was mechanical and verbatim: commit `1ab99c7`, with e2e:server at 92/92 before any behaviour change.

| From `server.js` (888f1fd lines) | To |
|---|---|
| `ANS`, `weekIdx` (73–74) | `server/rules/solves.js` |
| `beforeWrite()` (75–220), one `if` block per collection | `server/rules/<key>.js` → `write(op, p, s, data, u, old)` |
| `readFilter()` (225–238) | `read(p, s, d, u)` in `missions.js`, `drops.js`, `pair.js`, `circles-midnight.js`, `circles-sealed.js` |
| the SQL `CREATE TABLE` block (28–35) | `server/migrate.js` `SCHEMA[0]` (identical SQL) |

**Keys.** The key is the top collection (`drops`, `missions`…), or `circles-<sub>` for `circles/{cid}/<sub>/…`. `server/rules/index.js` loads every file in the folder and dispatches by key. A missing file or hook passes the data through, as v0.8 did.

**Rule files:** `checkins solves met drops posts missions trails stamps pair circles-{midnight,threads,favors,moles,molevotes,cheers,clips,dares,daily,sealed}`. Two are new: `circles.js` (the circle doc) and `people.js`.

**Merging with WS-D and WS-E.** Put your rule changes in these files instead of `server.js`:
- WS-D: `circles-midnight.js` (the name screen), `posts.js`, `people.js` and `circles.js` (members, roles, admin).
- WS-E: `solves.js` (ANS moves to `server_content`), `drops.js`.

A new collection is a new file. In `server.js`, `beforeWrite`/`readFilter` are now one line that calls `rules`.

## What changed in `server.js` (small, in place)

**At the top:**
- requires for the new modules;
- `BUILD_ID` (read from the `app/index.html` stamp), `MIN_CLIENT_BUILD`, `MAX_BODY`, `GOOGLE_CLIENT_ID`;
- the Sentry, security-header and limiter instances;
- DB open → `migrate(db, …)` and `createFunnel(db)`.

**Rules and behaviour:**
- `canWrite`: `meta/*` is read-only for clients.
- `quiet()` uses `TZ.localHour(now, person.tz)`, so a server running in UTC never reads its own clock (C102).
- `inCircle(d, cid)` replaces `d.circle === cid` in afterWrite and sweep, which makes notifications multi-circle aware (C36).
- `sweep()` returns `{from, to, notes, clipsGone}`. `pushTimeBound()` is the old 15 s loop body.

**Request handling:**
- `body()`: `MAX_BODY` (default 300 KiB, same as v0.8), refused with `413 payload_too_large`.
- Writes: `rate('write', uid)`, `rate('writeIp', ip)`, plus the content classes from `writeClasses()`. This replaces `limited('w:'…)`.
- Every response gets the headers from `server/headers.js`. API responses also get `x-insane-build` and `x-insane-min-build`. A `Refuse` can carry `retryMs` → `Retry-After`.

**New routes:**

| Route | What it does |
|---|---|
| `GET /api/health` | Health check |
| `GET /api/invite/:code` | C11: public. Returns name, member count and first names; rate-limited per IP |
| `GET /api/unlocks[?circle=]` | C25: `{circle, inputs, on, locked}`, from `server/unlocks.js` |
| `GET/POST /api/funnel` | C101: owner report / `{step, anon?}` |
| `POST /api/err` | C98: browser error tunnel → Sentry, scrubbed |
| `POST /api/auth/google {credential}` | C14: only when `GOOGLE_CLIENT_ID` is set |
| `POST /api/dev/tick {offset?}` | DEV only |

`POST /api/dev/clock` now also pushes the time-bound views.

**Helpers** (at the bottom): `signIn()` is shared by email and Google, plus `googleEmail()`, `unlocksFor()`, `dayOneReturn()`, `funnelWrite()`, the backup timer, and the uncaught-error handlers.

## New files

- **`server/`:** `migrate.js`, `ratelimit.js`, `headers.js`, `sentry.js`, `tz.js`, `backup.js`, `analytics.js`, `unlocks.js`, `rules/*`
- **Repo root:** `Dockerfile`, `.dockerignore`, `render.yaml`, `.nvmrc`
- **`tools/`:** `backup.sh`, `docker-entrypoint.sh`
- **Docs:** `docs/RUNBOOK.md`, this file
- **Tests:** `test/lib/server-proc.js`, `test/unit/server-{migrate,http,backup,deploy}.test.js`, `test/pbt/server.test.js` (P19, P20, P23, P24), and `test/fixtures/v08/` (`make.js`, `insane-v08.db`, `manifest.json`)
- **Changed:** `package.json` (`start` with `--disable-warning=ExperimentalWarning`, plus `backup`/`restore`), `test/e2e/legacy-server.js` (two `tick()` calls), the `test/run.js` comment

## Not done here (owner named)

- **Client wiring** (no client `src/` was changed):
  - WS-B/C call `/api/invite/:code`, `/api/unlocks`, `/api/funnel` and `/api/auth/google`, and show "00:00 Chennai time".
  - WS-A reads `x-insane-min-build` and versions the SW cache (C08), and posts `window.onerror` to `/api/err` (C98).
- **Artifact-mode migration** (PLAN §8): `migrateStore(memoryStore(docs))` is storage-agnostic. The owner-run client port with an export-first backup belongs to the client.
- **`ev/{uid}` per-person first/days docs** (v0.8 client analytics) still exist. Once the client posts funnel steps, the owner Stats view should read `/api/funnel` and `ev/` should be dropped. That needs a client change plus a contract step.
- **Push coalescing** (part of C84's fix list): not done. The rate classes cap the fan-out sources (msgs 30/min, posts 10/h, dares 20/day).
- **`missions.js` still reads `me.circle`** (the primary circle). Multi-circle Missions are WS-C/F.
- **Hourly WAL shipping** isn't implemented. Snapshots are online and complete; set `BACKUP_EVERY_H=1` for hourly.
