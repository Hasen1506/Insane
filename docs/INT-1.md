# INT-1: v0.9 integration, round 1

Branch `int-1`, from `v0.9` (888f1fd). Merged in this order: **I** (server/ops), **D** (safety), **E** (Decode/content), **F** (map/picker), **B** (first run), **A** (phone shell/PWA), **G** (ledger/UPI). Then: minified build, goldens, every e2e suite run serially on a quiet box, D's multi-circle and migration follow-ups.

## Merge decisions (conflict table)

| Merge | Where they met | Decision |
|---|---|---|
| I | — | Base for the rest: rule files under `server/rules/`, `server/migrate.js`, `/api/dev/tick`, ops scripts. |
| D into I | `beforeWrite` in server.js vs I's rule split | D's hook is called from the rule files it covers (people, circles, circles-midnight/-dares/-daily/-cheers, posts) via `ctx.safe()`; its read filter runs after every collection's read rule. people: I's `circle`/`circles` mirror first, then D's consent + membership. circles: D's field whitelist, then I's roles/tz. Midnight release moved to 00:00 circle time (C102). `Refuse` takes `retryMs` (number) or `reason` (string). I's tests sign up with adult + consent. |
| E into I | solves/check-ins/drops/Mole rules; daily dare | E's rule changes ported into `server/rules/{solves,checkins,drops,circles-moles}.js`. `sendIndex` + `/admin/content` behind I's headers. Daily dare: E's no-repeat cycle over D's unflagged/unpulled jar. Starter d23 "security guard" → "watchman" (tripped D's dare screen). `CONTENT_SECRET` in render.yaml. |
| F | missions, `/api/hello`, routes, diff registries | Mission pin hiding ported to `server/rules/missions.js`. `/api/hello` carries I's build fields, D's consent and F's tile fields. `/legal` and `/data/basemap.pmtiles` both routed. D's `allowed.json` folded into F's `changes/<ws>.json` union. |
| B | invite route, sign-in, onboarding step 1, City/You | `/api/invite/:code`: one route, I's place and rate class, B's contract `{name,count,max,by}`. `signin()` in 68-welcome.js shows D's signed-out/deleted notice. Step 1: B's month+year age block plus D's consent row; `obWhy` is the one rule. One e2e:flows runner for `*.flow.js` and `*.test.js`. |
| A | icons, `/legal`, boot, shell, ACT/SHEETS registry | PNG icon route + `/legal` + basemap all routed; boot does `setSkew`/`setTiles` + `railFor`/`swLater`; offline shell, `welcomeGate`, update bar after sign-in. Registry unions A's `new-names/<ws>.json` with `changes/<ws>.json` and `allowed.json`. Harness: free ports everywhere, `SEED=test-seed`. Crisis line Tele-MANAS 14416 unless locale is GB (Samaritans 116 123). |
| G | pot payment rule | Ported to `server/rules/circles-threads.js`: only the organiser (`old.by`) sets `upi`/`pay`; `upi` must look like `name@bank`. `e2e:ledger` added to `test/run.js`. Goldens with origins in links keep the origin via `BR.aliasOrigin`. |

## What this round changed

1. **Minified build** (`tools/build.js`): esbuild 0.28.2 (pinned devDependency) per JS file and for the CSS: whitespace, syntax, local identifiers. Top-level names are never renamed (shared global scope; tests reach functions by name); strings untouched; the local Decode pack between `/*@decode-local*/` markers is kept byte for byte (the server cuts it out). `MINIFY=0` gives the readable build; `--check` fails on it and the budget only warns for it. Budget 350 → **400 KiB** (reason in the comment). Unit checks that read the page now accept esbuild's `"use strict"`, and the byte-for-byte schedule-helper check reads src/ and the `MINIFY=0` build; new checks: `MINIFY=0` is larger and self-contained, the Decode pack is identical in both builds.
2. **Goldens**: `map.test.js` skips the intro and tour like the other suites; `ledger-flow.js` puts coordinates in WS-F's search box (no `lp-paste` button) and sets `insane_unlock_all` (pots unlock after a first plan; that unlock is tested in `firstrun-server`). All goldens regenerated from the **minified** build; a `MINIFY=0` build then passes every golden in compare mode with `GOLDEN_STRICT=1` (DOM goldens byte-identical). I looked at every light and dark image: no visual regression. The large diffs against the old goldens are the phone viewport (WS-A's C01): the old ws0/ws-b goldens were desktop-width.
3. **e2e fixes** (all harness drift, no check removed): `e2e:map` and `d-safety.flow.js` skip WS-B's intro/tour; sign-in in map, d-safety and the shell lib relies on C13's six-digit auto-submit instead of racing a tap on the disabled **Sign in** button; `firstrun-local` re-ticks consent after a reload (consent is deliberately not in the saved draft) and gained a check that Next says why. One product fix: the map's pulse timer is cleared when nothing is hot any more (one leftover repaint after a drop closed; "nothing repaints while idle"). `e2e/flows/run.js` exits only after its report drains (the "N/M passed" line was cut off on a pipe, so the summary said 1/1).
4. **V08-S14 (sign-in under 4 s)** passed on wall clock in both runs (855–1,425 ms), so it was left as is. Alice's time prints `undefined` because her sign-in is the wrong-code path, which the check skips by design.
5. **D × I multi-circle**: `server/moderation.js` membership, reads, writes, presence (`live/`), the square (`cell`), Midnight's late-joiner screen, the 8-person cap and owner removal now use every circle in `people.circles` (with `circle` as the primary), not only the primary. Joining is checked per added circle (closed, removed, full) before any circle doc changes; leaving drops you from each circle removed. Owner removal takes the circle out of `circles[]` too. Data export covers every circle. New `test/pbt/circles.test.js`: **M01** a member of A never reads or writes B unless B is in their circles (300 random op sequences over 2–4 circles, joins via `circles` and `circle`, primary switches, drops, owner removals), **M02** `people.circles` and `circles/{cid}.members` always agree and nobody exceeds MAX_CIRCLES, **M03** a removed member can't re-add the circle. The old code fails M01 on the first case.
6. **D's tables in the migration**: `reports` and `audit` are schema step 3 in `server/migrate.js` (`CREATE TABLE IF NOT EXISTS`, so a dev DB that made them ad hoc passes through); `moderation.js` no longer creates tables and refuses to start if they're missing. `server-migrate.test.js`: health reports schema 3, the tables have the right columns, step 3 over pre-existing ad hoc tables keeps their rows and a rerun is a no-op, a fresh DB gets both tables.
7. **V08-S72 ("direct messages work only after meeting") flake, harness race.** The check polled `tap(Carol, '.thr:has-text("Alice")')` then read the screen, inside an 8 s poll. Once Carol was inside the DM there is no row to tap, so every later pass spent `tapOnce`'s 5 s click + 3 s forced-click fallback before reading the screen; if Alice's message had not been drawn on the first read (and on a loaded box the first tap can itself wait for the row to be named), the 8 s ran out without a second read. It now waits on the real conditions in order: the DM row named Alice exists (`.thr[data-type=dm]`, so it can't match another row), Carol opens it once, then the message is on her screen; the failure text records Carol's open view, her met list and the messages she has. Same file, same pattern found while diagnosing (run 2 of the three verbose runs): Mariana's uid was read from her page *after* Delete, which reloads it (`S is not defined`); it is read before, and the check waits for the signed-out screen.
8. **WS-E's content tables in the migration**: `content_items` and `content_sched` are schema step 4 in `server/migrate.js` (`IF NOT EXISTS`); `server/content.js` no longer creates them and refuses an unmigrated DB. `server-migrate.test.js`: health reports schema 4, both tables with the right columns, step 4 over ad hoc tables at user_version 3 keeps the owner's item and schedule row, a rerun is a no-op, a fresh DB gets them, content.js refuses an unmigrated DB and boots on a migrated one. `test/pbt/content.test.js` migrates its in-memory DB first.
9. **Undo-remove is multi-circle aware** (`circle/unremove`, `server/moderation.js`): within 24 h the member comes back if they still have room for one more circle (`MAX_CIRCLES`, default 3, the same cap as `server/rules/people.js`) and the circle isn't full (8); their other circles and primary are kept, and someone in no circle comes back with it as primary (v0.8's case). At the cap the undo only clears the removal. Regression tests `R-unremove` in `test/regression/safety.test.js` (the old rule fails two of them).

## Suite results

The full `npm test` (every suite, serially, in `test/run.js` order) twice in a row on a quiet 2-core box, at the commits below this doc's own. Both fully green. Times in seconds. (S72 was also run under two CPU hogs on the same box: 92/92 in 151.8 s.)

| Suite | Run 1 | s | Run 2 | s |
|---|---|---|---|---|
| build | 1/1 | 0.4 | 1/1 | 0.4 |
| unit | 224/224 | 5.8 | 224/224 | 6.7 |
| pbt | 128/128 | 12.4 | 128/128 | 13.1 |
| diff | 54/54 | 20.3 | 54/54 | 21.6 |
| e2e:local | 83/83 | 48.4 | 83/83 | 59.6 |
| e2e:server | 92/92 | 135.2 | 92/92 | 124.6 |
| e2e:decode | 17/17 | 5.4 | 17/17 | 5.1 |
| regression | 68/68 | 12.8 | 68/68 | 17.6 |
| e2e:map | 26/26 | 14.6 | 26/26 | 16.4 |
| golden | 280/280 | 80.9 | 280/280 | 83.2 |
| e2e:flows | 233/233 | 49.2 | 233/233 | 51.8 |
| e2e:ledger | 17/17 | 14.4 | 17/17 | 14.0 |
| **total** | **1223/1223** | **400** | **1223/1223** | **414** |

Budgets are informational (`BUDGETS=strict` not set). Over budget: `diff` (~21 s vs 10), `golden` (~82 s vs 30), `e2e:server` (125–135 s vs 90), `regression` (13–18 s vs 10, after the R-unremove cases).

## Bundle

| Build | Raw | Gzipped (`gzip -9n`) |
|---|---|---|
| shipped, minified (`app/index.html`) | 403,814 B | 131,518 B |
| `MINIFY=0` | 460,060 B | 149,662 B |

Budget 409,600 bytes (400 KiB); the shipped build is 98.6% of it. The build log's own gzip figure (Node zlib level 9, 132,335 B) is a little larger than `gzip -9n`. Most of what's left is copy and HTML inside template strings.

## Known gaps

- Commit e54b2cb (moderation no longer creates its tables) lands one commit before 7342520 (the migration that creates them), so e54b2cb on its own doesn't boot. Both are on `int-1`; bisect over them as a pair.
- Joining a circle needs only its id (as in v0.8, where the code maps to the id); `circles[]` doesn't change that.
- Consent isn't kept in the onboarding draft, so a reload asks again (kept on purpose; tested).
- The bundle is at 98.6% of its budget; the next feature that adds copy will need the budget or the copy moved.
- Over-budget suite times (above).
- `ccr-25f42e9d-g2mmei` untouched.
