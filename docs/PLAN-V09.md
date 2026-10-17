# v0.9 plan: from "works in a test" to "works on a real phone, for strangers, safely"

The plan answers every critique in [CRITIQUES-V09.md](CRITIQUES-V09.md) (C01–C108; 7 P0, 44 P1, 51 P2, 6 P3).
- The base is v0.8 at `fac3720`.
- The live-test evidence is in `docs/v09-shots/`, with drivers in `tools/livetest/`.
- This branch (`v0.9`) holds **planning only**: no feature code yet.

## 1. Goals, non-goals, release bar

**v0.9 goal:** a stranger in Chennai with a mid-range Android phone on mobile data can do all of this without help:
- open an invite link;
- understand what INSANE is in 5 seconds;
- sign in;
- join the circle;
- do one real thing (answer a plan, tick a pact or do the daily dare) within 2 minutes.

They should come back on day 2 because something needs them, and they should never see a desktop layout, a dead end, or another member's location.

**Release bar (all must hold):**
1. No P0 open. Every P1 is either fixed or has a written waiver from Vijay.
2. `npm test` is green, deterministic, and runs in under 3 minutes on a laptop: unit + PBT under 10 s, differential under 10 s, e2e local under 60 s, e2e server under 90 s, golden under 30 s.
3. Golden screens are approved in light and dark on Pixel 7, iPhone 13 and 1280 px.
4. The v0.8 → v0.9 migration passes on a copy of the v0.8 playtest DB and on an exported claude.ai store snapshot.
5. It is deployed on Render (or equivalent) behind HTTPS, with backups, Sentry and the rollback tag verified once.

**Non-goals for v0.9** (C94): Zones/fixtures (need venue partners), Chapters (need block/report to settle first), the vouch and Reliability economy, 15 s video (needs object storage and moderation), Tamil and Hindi translations (strings are prepared, translation is v1.0), and native apps.

## 2. Code layout: modules in `src/`, still one file for claude.ai

The single-file artifact is a hard requirement. `app/index.html` must stay one self-contained file that pastes into claude.ai. So v0.9 adds a **zero-dependency build step**, and doesn't replace the file.

```
src/
  head.html            doctype, lang, viewport, manifest/icon links, CSP meta (artifact-safe)
  css/                 tokens.css  base.css  components.css  map.css  screens.css
  js/
    00-helpers.js      (lines 299–321 today)
    10-places.js       (322–389)        20-map.js        (390–492)
    25-picker.js       (846–895)        30-lanes.js      (493–528)
    35-decode.js       (529–549)        36-drops.js      (550–559)
    40-store-local.js  (560–588)        41-store-remote.js (589–617)
    50-state.js        (618–691)        55-writes.js     (692–750)
    60-boot.js         (751–781)        61-router.js     (NEW: history, deep links)
    70-shell.js        (782–845 header/nav/render)
    71-onboarding.js   (896–979)        72-home.js       (980–1037, 1310–1356)
    73-circle.js       (1038–1120, 1357–1412)
    74-city.js         (1121–1203, 1413–1424)
    75-ledger.js       (1425–1490, 1278–1287)
    76-you.js          (1204–1259)      77-plus.js       (1491–1502)
    78-sheets/*.js     (1553–1688, one file per sheet family)
    79-activity.js     (1503–1552)      80-input.js      (1689–1724)
    90-actions/*.js    (1725–1975: the act() switch, split per module)
    95-strings.js      (NEW: T{} table, C95)  96-unlock.js (NEW)  97-help.js (NEW)
tools/build.mjs        concatenates head + <style> + <script>, writes app/index.html,
                       stamps BUILD_ID, checks size budget, optional --check mode
```

Rules that keep this safe:
- **`app/index.html` stays committed** and is the build output. CI runs `node tools/build.mjs --check`, which fails if the committed file differs from a fresh build. So claude.ai users always have a pasteable file, and nobody edits it by hand.
- **No bundler and no npm deps.** The build is a plain ordered concatenation by filename prefix. No module system is needed, since today's code already shares one global scope.
- **`act()` becomes a registry.** Each module registers its handlers, e.g. `ACT['fv-ask']=async(d,el)=>{…}`. The one 250-line switch is the main merge-conflict hotspot today, and the registry removes it.
- **Step WS-0 does the split mechanically**, with zero behaviour change. Its acceptance test: the existing `app/test/e2e.js` (83) and `server/test/playtest.js` (92) pass against the built file, and a DOM snapshot of 10 screens is identical before and after. Only after WS-0 merges do the parallel workstreams start.

## 3. Workstreams (run in parallel after WS-0)

Each workstream owns files. Shared files have one owner, and the others send small PRs to that owner. Effort is engineer-days, assuming one person who knows the code.

| WS | Name | Scope (critiques) | Owns files | Touches (via owner) | Est. |
|---|---|---|---|---|---|
| **WS-0** | Split and build | Mechanical split, build, `--check`, act registry | everything, once | | 1.5 d |
| **WS-A** | Phone shell and PWA | C01–C08, C31, C107 | `src/head.html`, `css/base.css`, `61-router.js`, `70-shell.js`, `server/public/*` (sw, manifest, icons) | `60-boot.js` | 4 d |
| **WS-B** | First run, onboarding, unlocks, help | C09–C19, C22–C26, C56–C58, C108 | `71-onboarding.js`, `NEW welcome.js`, `96-unlock.js`, `97-help.js`, `77-plus.js`, `css/screens.css` (onboarding part) | `server.js` unlock route (via WS-I) | 6 d |
| **WS-C** | Home, Circle, invite | C20, C27–C30, C32–C34, C36, C38–C41, C45, C47, C102 (client) | `72-home.js`, `73-circle.js`, `78-sheets/invite.js`, `78-sheets/thread.js` | multi-circle data (WS-I) | 6 d |
| **WS-D** | Safety, moderation, legal, account | C17 (server rule), C35, C37, C44 (server), C59–C63, C87–C90 | `NEW 98-safety.js`, `76-you.js`, `NEW server/moderation.js`, `NEW server/account.js`, `legal/*.html` | `server.js` rules (`rules()` blocks for midnight, posts, members) | 7 d |
| **WS-E** | Game integrity and content | C48, C50, C86, C91–C93 | `35-decode.js`, `36-drops.js`, `NEW server/content.js`, `server/content/*.json`, `NEW admin-content` screen | `server.js` solve and draw routes | 5 d |
| **WS-F** | Map and location | C43, C44 (UI), C49, C51, C64–C69, C81 | `20-map.js`, `25-picker.js`, `10-places.js`, `74-city.js` map section, `css/map.css`, `tools/build_geo.py` | `server.js` geo route, `TILE_URL` | 7 d |
| **WS-G** | Ledger and India money | C52–C55 | `75-ledger.js`, `78-sheets/pot*.js` | | 2.5 d |
| **WS-H** | Visual system, a11y, i18n prep | C21, C42, C46, C70–C80, C82 (client), C95 | `css/tokens.css`, `css/components.css`, `95-strings.js`, toast/snackbar in `79-activity.js` | every screen's class names (token-only changes) | 6 d |
| **WS-I** | Server and ops | C08 (server), C11 (route), C14, C25 (route), C36 (data), C83–C85, C96–C101, C102 (server) | `server/server.js` (core), `NEW server/migrate.js`, `server/ratelimit.js`, `Dockerfile`, `render.yaml`, `package.json`, `tools/backup.sh` | | 7 d |
| **WS-J** | Tests | C79, C103–C106, every acceptance test below | `test/**`, `tools/livetest/**` | | 8 d, starts day 1 in parallel |

**Total:** about 60 engineer-days. With 4 parallel tracks that's about 3–4 calendar weeks.

**Order of attack:**
- **Week 1:** WS-0. Then WS-A (P0 phone) + WS-I (deploy, backup, Sentry, migrations scaffold) + WS-J harness + WS-E (Decode server-side).
- **Week 2:** WS-B + WS-C + WS-D + WS-F.
- **Week 3:** WS-G + WS-H sweep + polish. Golden approval.
- **Week 4:** bug bash with 6–10 real people in Chennai on the deployed build.

**Conflict hotspots and how they're handled:**
- **`server/server.js` `rules()`.** WS-I splits it first into `server/rules/<collection>.js` (still no deps, `require`d by path). WS-D and WS-E then own their own rule files.
- **`70-shell.js` header and nav.** WS-A owns it. WS-B's tour and WS-H's header redesign go in as PRs to WS-A.
- **CSS tokens.** WS-H owns `tokens.css`. Others use tokens only, never raw colours. A lint test greps for hex values outside `tokens.css`.

## 4. Things that need Vijay, or can't be done honestly yet

| Need | Why | Honest stand-in until then |
|---|---|---|
| A domain plus a Resend API key and verified sender (C14) | Real sign-in emails to anyone not on the dev server | Deploy at `*.onrender.com`. Use Resend's test sender for invited testers only. DEV outbox for the team |
| Google OAuth client ID (C14) | Google Sign-In | Email-code only. The button is hidden when `GOOGLE_CLIENT_ID` is unset |
| SMS provider plus India DLT registration (entity, sender ID, templates) (C14) | Phone OTP in India | Not in v0.9. Documented |
| Grievance officer name and contact email; legal review of Terms and Privacy (C63, C17) | DPDP notice and grievance (≤90 days). Children's data rules commence 13 May 2027 | Draft pages written by us and marked "draft, not legal advice". 18+ in India |
| Tile hosting choice and budget (C69) | OSM tiles forbid this use | Protomaps India extract on Render static or R2, about 0 cost. Stadia free (non-commercial) for the test elsewhere |
| Sentry DSN (C98) | Error monitoring | Vijay has a Sentry account (sentry.io login on file). We need a project DSN. Logs to stdout until then |
| Render persistent disk and an object storage bucket (C96, C97) | SQLite durability and backups | Render disk + nightly `VACUUM INTO` kept on the same disk (weaker) until a bucket exists |
| Venue partners (C94) | Zones and fixtures | Out of scope |
| Native-speaker reviewers for Tamil and Hindi (C95) | Translations | Strings extracted; English only |
| A decision on 3 circles per person (C36) | Product call: it changes the ledger and pots per circle | Default to 3, behind a server flag |

## 5. Testing plan

### 5.0 One command, fast and deterministic (C103, C104)

```
npm test            # = node test/run.mjs  → unit, pbt, diff, e2e:local, e2e:server, golden, a11y
npm run test:quick  # unit + pbt + diff (<10 s)
npm run test:e2e    # both e2e modes
npm run golden:update   # rewrite goldens after a reviewed change
```

**`package.json` has no runtime dependencies.** The only dev dependency is `playwright-core` (no browser download).

**Browser resolution** (`test/lib/browser.mjs`):
1. `CHROME` env;
2. `playwright-core`'s registry path, if installed;
3. `/usr/bin/chromium`, `/usr/bin/chromium-browser`, `/usr/bin/google-chrome`;
4. otherwise fail with a one-line install hint.

Playwright itself comes from `PW` env, else `require.resolve('playwright-core')`, else `playwright`. This removes the hardcoded `/opt/pw-browsers` and `/opt/node22` paths.

**Determinism rules, enforced by a lint test that greps `test/`:**
- **No fixed sleeps.** `setTimeout`-based `wait(ms)` is banned in tests. Use `page.waitForFunction`, `waitForSelector`, or SSE "applied" events: the client exposes `window.__insane.version` and `onApplied(seq)`, which tests await.
- **Fake clocks everywhere.** The server takes `now()` from a `Clock` object, already movable in DEV. Add `POST /api/dev/tick`, which runs the sweep (midnight release, drop reminders, clip expiry) synchronously and returns. This replaces the two `wait(21000)` calls. Browsers use `page.clock.install({time})` and the same offset.
- **Seeded randomness.** `rnd()` / `crypto.getRandomValues` go through `RNG` (mulberry32) in tests (`?seed=` or `window.__seed`). The server takes `SEED` env. Every failing PBT prints its seed and shrunk case.
- **Isolation.** Each e2e file gets its own port (0 = OS-assigned) and a temp DB. Parallel workers each run one Chromium with N contexts.
- **Budgets** are checked by `test/run.mjs`, which fails if a suite exceeds 1.5× its budget: unit + PBT < 10 s, diff < 10 s, e2e:local < 60 s, e2e:server < 90 s, golden < 30 s.

### 5.a End-to-end tests as ground truth: real user flows, mobile profiles, both modes

**Location:** `test/e2e/flows/*.mjs`. Each flow runs in **server mode** (real server, temp DB, dev outbox codes) and in **local mode** (static `app/`, LocalDB, as on claude.ai), unless marked server-only.

**Profiles:** `Pixel 7` and `iPhone 13` from `playwright.devices`, plus `Desktop 1280`. Light by default; golden screens repeat in dark.

**Personas live in fixtures:**
- Meera (Minjur, solo; long name with emoji)
- Arjun (Chetput, creator)
- Kavya (Arabic + Latin name, joins by link)
- Ravi (desktop, joins by code)
- the eleven v0.8 playtest people

Flows (each a user story with assertions on what the person *sees*):

| Flow | Covers |
|---|---|
| F01 cold open → welcome → intro → sign-in → onboarding (reload mid-way) → Home | C01–C03, C06, C09–C13, C16–C20, C24, C26 |
| F02 creator: start circle → invite card → share sheet stub → WhatsApp fallback | C27, C28, C22 |
| F03 joiner by deep link: preview shows circle → join → lands on Home with plan first | C11, C22, C30 |
| F04 joiner by code on desktop | C107, layout |
| F05 plan → I'm in → thread → composer docked → retry after offline | C38, C07 |
| F06 favor ask → claim → done → confirm → ledger balances | C54, C55 |
| F07 INR pot → UPI link → paid → organiser confirms | C52, C53 |
| F08 pacts + cheer; week strip | C40 |
| F09 Midnight with every name-token variant refused; release at 00:00 circle time (tick) | C37, C102 |
| F10 Mole at 3 (locked) and 4 members; reveal | C41 |
| F11 Decode: clue only in payload; solve via API; city pack | C48, C91 |
| F12 drop: host → door code → check-in → two-key → commit-reveal draw | C50 |
| F13 Mission spot hidden until T−2h (tick) to yes-sayers only; trail GPS stamp radius | map goals |
| F14 City map-first; list/map toggle; distance chips; tile failure fallback; no member dots | C43, C44, C49, C64–C68 |
| F15 block and report person; unsafe dare flag; owner moderation | C87–C89 |
| F16 circle admin: remove, rename, transfer, close; multi-circle switch | C35, C36 |
| F17 account: sessions, revoke, change email, export, server delete → welcome | C59, C60, C62 |
| F18 offline cold start, SW update prompt | C07, C08 |
| F19 back button and history across tabs and sheets | C05 |
| F20 day-14 power user (port of playtest days 0–13 using tick, no sleeps) | regression of v0.8's 92 checks |

The existing 83 local checks and 92 server checks are ported into F01–F20. Every v0.8 assertion keeps an ID (`V08-L##`, `V08-S##`), so nothing silently drops.

### 5.b Property-based tests: what must never happen

**Runner:** `test/pbt/runner.mjs`, about 150 lines, no dependencies. fast-check isn't vendored: the properties need only generators, seeds and shrinking of arrays and ints, which the small runner covers. That keeps "no npm deps" honest.
- `prop(name, gen, predicate, {runs=1000, seed})`.
- Generators: `int`, `pick`, `str` (including emoji, RTL and combining marks), `array`, `record`, `oneOf`, `latLon`, `email`, plus domain generators `circleState`, `favorOps`, `potOps` and `members`.
- Shrinking: halve ints, drop array items, shorten strings.
- Each failure prints `SEED=… CASE=…` to replay with `PBT_SEED`.

**Two targets:**
- **(i) Pure functions,** imported from `src/js/*.js` through a tiny loader. `test/lib/load.mjs` evaluates the concatenated helpers in a `vm` context with a fake `S`, so no browser is needed.
- **(ii) Server rules,** called in-process through `server/rules/*.js` with a temp DB, plus about 200 sampled cases over real HTTP to prove the wiring.

**Default:** 1,000 cases per property, and 10,000 in a nightly CI job (`PBT_RUNS=10000`).

| ID | Property: this must never happen | Target |
|---|---|---|
| P01 | Any member's favor balance goes below −5 h after any sequence of ask/claim/done/confirm/log/delete ops by random actors | server rules + `balance()` |
| P02 | Someone logs hours for themselves, or logs as `asker` when not the person helped | server |
| P03 | Sum of all balances in a circle ≠ 0 (hours are conserved) | `balance()` |
| P04 | Any non-organiser sets `paid[x]=true`; anyone sets `paid` for someone else; anyone pledges for someone else | server |
| P05 | `potState(t,u)` returns `paid` for someone the organiser never confirmed (unless they are the organiser) | pure |
| P06 | Any non-Mole reads the Mole's uid from any endpoint, list, export or push payload; anyone but the Mole reveals | server (all routes scanned) |
| P07 | A Midnight message containing any token (2 or more letters) of another member's name or handle, under case, accent or zero-width variants, is accepted; *or* any stored Midnight doc has an author field | server |
| P08 | Any response (get/query/SSE/export/push) for any non-owner contains a Decode answer before reveal; the built `index.html` contains any answer literal | server + build grep |
| P09 | Any user other than the owner reads `data/users/{uid}/loc`; any public doc contains coordinates finer than its declared cell | server |
| P10 | `drawWinner` differs for the same (revealed seed, check-in set) in any order; the winner is outside the check-in set; the seed hash was published after the first check-in | pure + server |
| P11 | A drop is listed to a user whose distance from the drop centre exceeds their radius (+ cell half-diagonal for zone users); a drop from another 25 km bucket leaks | pure `nearDrops` + server query |
| P12 | A blocked user can DM, dare, react to, room with, or see the blocker's posts or presence | server |
| P13 | A Mission's exact spot is readable by anyone outside the host circle before T−2h, or by non-yes-sayers ever | server |
| P14 | A trail stamp is accepted outside the window, or as `gps` more than 60 m from the stop | server |
| P15 | `cellOf(lat,lon,s)` doesn't contain the point; adjacent points straddling a boundary map to non-adjacent cells; `nearCells` misses a cell within radius | pure |
| P16 | City resolution puts a point in a city more than 35 km away when a city of 1M+ is within 35 km (the V08 rule) | pure |
| P17 | `decodeState` ranks a later solve ahead of an earlier one; hint penalties make points negative | pure |
| P18 | `readUrge` crashes or returns a lane outside {need, want, urge} for any string (fuzz incl. emoji/RTL/10 kB) | pure |
| P19 | Rate limiter lets N+1 writes through in a window; any body > cap accepted | server |
| P20 | Unlocks ever go backwards (a feature locks again) as members/days/met increase | pure `unlocks()` |
| P21 | Home header count ≠ number of rendered Needs-you + today items; a Needs-you item ranks below dare/Decode | pure `homeItems()` |
| P22 | Server trimming of names splits a surrogate pair or grapheme, or exceeds the limit | server |
| P23 | Midnight release instant ≠ next 00:00 in the circle's timezone, across DST changes | pure |
| P24 | Migration v0.8 → v0.9 is not idempotent, or loses a doc (count by collection) | migrate.js on generated v0.8 stores |
| P25 | After account delete, any doc still references the uid (except anonymised message bylines) | server |

### 5.c Differential tests: v0.8 vs v0.9 on random inputs

`test/diff/setup.mjs` runs `git worktree add .v08 fac3720` once and caches it. It loads v0.8's pure functions from `.v08/app/index.html`, extracting the `<script>` into a vm, and v0.9's from `src/`.

For each function replaced or refactored, it generates 5,000 seeded inputs and asserts **equal output**, or an **allowed, documented difference** with a predicate:

| Function | Expectation |
|---|---|
| `cellOf`, `nearCells`, `distKm` | identical |
| city resolution (`areaFor` / nearest city rule) | identical, except the documented India-split change if WS-F adds per-country files (the diff must be empty on the v0.8 places set) |
| `decodeState` | identical ranking and points |
| `potState`, `potOn` | identical for v0.8-shaped pots; v0.9 UPI fields ignored |
| `balance` | identical for single-circle data; per-circle in v0.9 equals v0.8 when one circle |
| `drawWinner` | **intentionally different** (commit-reveal). Diff asserts v0.9(seed = v0.8 hash input) is reproducible and v0.8 winners are still verifiable for drops created before migration (legacy path kept) |
| `readUrge`, `readCard` | identical lane, count and stake for every input |
| `searchPlaces` ranking (local mode) | top-1 identical for 2,000 sampled place names |
| server `rules()` per collection | for 2,000 random (actor, op, path, data) tuples on v0.8-shaped data, v0.9 accepts and refuses exactly what v0.8 did, except new refusals listed in `diff/allowed.json` (names in Midnight, rate limits, blocks) |

### 5.d Golden and snapshot tests

- **Screens:** welcome, sign-in, each onboarding step, solo Home, creator Home, joiner Home, Circle (each segment), City (map, feed, calls, league), Ledger (favors, pots), + sheet, invite sheet, Profile, Help, Go dark. Each is shot on Pixel 7 and iPhone 13, in light and dark. About 80 images.
- **Stability:** fonts are bundled for tests (C04 removes the Google Fonts dependency in tests via a `font-display` fallback stack), with a frozen clock, a fixed seed, animations disabled, and a fixed tile fixture.
- **Two layers:**
  1. A **DOM golden**: a normalised text-and-role tree (fast, diff-friendly).
  2. A **pixel golden** compared with a small in-repo pixelmatch, with a tolerance of 0.1% differing pixels.

  Goldens are stored as JPEG 400 px, quality 70, under `test/golden/`.
- **Audit checks on goldens:**
  - 0 tap targets under 44 px (C76);
  - minimum font ≥ 12 px (C70);
  - WCAG AA contrast for text (C75);
  - every button has an accessible name (C77);
  - no horizontal scroll (C01);
  - toast bounding box never intersects a `.card` (C73).

  The checker grows from `tools/livetest/live.py`'s `AUDIT_JS`, ported to JS.

### 5.e Regression tests for every bug found in the live test

Each has an ID `R-Cnn` and lives in `test/regression/`:

| Test | Asserts |
|---|---|
| R-C01 | phone innerWidth |
| R-C05 | Back doesn't leave the app |
| R-C06 | scrollY 0 after onboarding |
| R-C11 | invite preview before sign-in |
| R-C16 | onboarding draft survives reload |
| R-C20 | long names: no mid-word truncation |
| R-C21 | RTL names wrapped in bdi |
| R-C29 | count matches list |
| R-C30 | Needs-you first |
| R-C37 | "Kavya" blocked when the member name is "كافيا Kavya" |
| R-C44 | no member dot on the City map |
| R-C45 | own call visible |
| R-C49 | tile-failure fallback |
| R-C52 | INR pot shows UPI, not PayPal |
| R-C53 | ₹1,500 |
| R-C55 | buttons clickable under the stamp |
| R-C59 | delete signs out |
| R-C61 | dark timer uses server time |
| R-C64 | picker opens on India for Asia/Kolkata |
| R-C73 | toast cleared on navigation |
| R-C81 | no places.tsv download on server-mode phones |
| R-C107 | no "Share menu" copy on server |

### 5.f What runs where

- **Every push:** `npm run test:quick` and `build --check`.
- **PR:** `npm test` (all suites).
- **Nightly:** PBT at 10,000 runs, the full playtest port with 11 people, and golden in all three profiles.
- **Pre-release:** a migration test on the latest prod DB snapshot, restored from backup. That also tests the backup.

## 6. Every critique → fix → workstream → acceptance test

| # | Sev | Fix | Workstream | Acceptance test |
|---|---|---|---|---|
| C01 | P0 | Viewport meta; hide rail <900px | WS-A | E2E-M: innerWidth==device width on Pixel 7/iPhone 13; no horizontal scroll; rail hidden |
| C02 | P0 | Link manifest; PNG 180/192/512/maskable; theme-color; iOS A2HS coach | WS-A | Unit: manifest JSON valid + icons exist + sizes; E2E: `link[rel=manifest]`, `apple-touch-icon` resolve 200; Lighthouse-style installability check script |
| C03 | P1 | `<!doctype html><html lang>` | WS-A | E2E: document.doctype && lang!=='' |
| C04 | P1 | Vendor inline QR encoder; CSP forbids external script | WS-A | E2E under CSP `script-src 'self' 'unsafe-inline'`: invite sheet renders `svg` QR with all external hosts blocked |
| C05 | P1 | History routing for tab/segment/sheet; Back closes sheet | WS-A | E2E: open sheet→Back closes sheet; tab A→B→Back returns A; never about:blank |
| C06 | P1 | scrollTo(0,0) on tab change + onboarding finish | WS-A | E2E: after onboarding scrollY==0; regression for 22-creator-home |
| C07 | P2 | Offline banner; write queue w/ idempotency keys; SW shell cache | WS-A | E2E: setOffline→banner visible; queued message sends on reconnect exactly once; cold offline load shows shell |
| C08 | P2 | Versioned SW cache; update prompt; min-client-build header | WS-A, WS-I | E2E: deploy build N+1 → "New version" snackbar → reload picks new BUILD_ID |
| C09 | P1 | Welcome screen with value prop | WS-B | Golden: welcome light/dark Pixel 7; E2E text contains promise + Get started |
| C10 | P1 | 3–4 card skippable intro, once | WS-B | E2E: shown first visit, skipped visit 2 (localStorage) |
| C11 | P1 | Public invite preview endpoint; welcome shows circle name | WS-B, WS-I | API test: /api/invite/:code returns name+count only, rate-limited; E2E deep link shows "Arjun invited you" |
| C12 | P2 | Inline email error + typo suggestion | WS-B | Unit: suggestDomain('a@gmial.com')→gmail.com; E2E inline error visible |
| C13 | P2 | OTP field: numeric, one-time-code, autosubmit, resend timer | WS-B | E2E: typing 6 digits submits without tap; resend disabled with countdown (fake clock) |
| C14 | P1 | Google Sign-In (needs client ID); phone OTP later; Resend email now | WS-B, WS-I | API test with mocked Google tokeninfo; skipped unless GOOGLE_CLIENT_ID set |
| C15 | P3 | DEV "Fill dev code" button | WS-B | E2E (DEV only): button fills code |
| C16 | P1 | Persist onboarding draft | WS-B | E2E: type name→reload→name restored, step kept; cleared after finish |
| C17 | P1 | DOB (month/year), 18+ India / 16+ elsewhere; 44px control; disabled-reason text | WS-B, WS-D | Unit PBT: ageOK(dob,country,now) monotonic & boundary-exact; E2E: Next disabled shows reason |
| C18 | P2 | Copy "your people (3–8)" | WS-B | Copy lint test: no "your five" |
| C19 | P2 | Handle explainer + Shuffle + preview | WS-B | E2E: Shuffle changes handle; preview shows handle not name |
| C20 | P1 | maxlength + counter; word-boundary trim with notice | WS-B, WS-C | PBT: server trims ≤N and never splits a surrogate pair/emoji; E2E counter |
| C21 | P1 | `<bdi>` around user strings | WS-H | Golden RTL screen; DOM test: every `.name` inside bdi |
| C22 | P2 | Invite path: single "Join X" primary | WS-B | E2E deep link: only one primary button; Start is a link |
| C23 | P2 | Skip explains consequence | WS-B | E2E text |
| C24 | P2 | Lane examples + readUrge chip preview | WS-B | Unit: readUrge examples parse; E2E chip text |
| C25 | P1 | Server-computed unlocks; locked rows explain | WS-B, WS-C, WS-I | PBT: unlocks monotonic in (members, days, met); E2E solo day0 + shows ≤6 rows |
| C26 | P1 | 4-step coach tour, replay from Help | WS-B | E2E: tour after onboarding, dismiss persists |
| C27 | P1 | Persistent "Bring your people in" card until 3 members | WS-C | E2E: creator Home top card has code+Share; disappears at 3 |
| C28 | P1 | navigator.share → wa.me → copy | WS-C | E2E: stub navigator.share called with url; fallback opens wa.me link |
| C29 | P2 | Count derived from rendered list | WS-C | Unit/PBT: homeItems(state).length == header count |
| C30 | P1 | Home order: Needs you first | WS-C | PBT: for random states, rank(needsYou) < rank(dare) < rank(decode); E2E Kavya sees plan first |
| C31 | P2 | Bottom padding w/ safe-area | WS-A | E2E: last element bottom ≤ nav top |
| C32 | P2 | Collapse empty drops card on Home | WS-C | Golden Home solo |
| C33 | P2 | One-line Decode teaser on Home | WS-C | Golden Home |
| C34 | P2 | Dots only for unseen addressed items | WS-C | E2E: fresh user has no dots |
| C35 | P1 | Circle roles: remove/rename/transfer/close/rotate code | WS-D, WS-I | API PBT: only admin can mutate; removed member loses read within 1 sync; E2E admin flow |
| C36 | P1 | Up to 3 circles + switcher | WS-C, WS-I | Migration test v0.8 fixture; PBT: ledger isolation across circles; E2E switch |
| C37 | P0 | Server-side Midnight name screen (tokens, handles, NFKD) | WS-D | PBT P07: any member name token inserted in random text → refused (server); differential none (new) |
| C38 | P2 | Docked composer; message status; retry | WS-C | E2E: composer visible above keyboard (visualViewport stub); failed send shows Retry |
| C39 | P2 | Date chip, .ics, map link on plans | WS-C | Unit: ics generation valid RFC5545 for random dates/tz |
| C40 | P2 | Week strip for pacts | WS-C | Golden pacts |
| C41 | P2 | Locked segment chips "4+" | WS-C | E2E 3-member circle: Mole chip locked |
| C42 | P3 | Single avatar component 44px | WS-H | A11y target test |
| C43 | P1 | Map-first City; bottom sheet list | WS-F | Golden City map Pixel 7; map ≥55% viewport height |
| C44 | P1 | No people dots by default; opt-in square only | WS-F, WS-D | API PBT: no endpoint returns another user's cell unless opt-in; E2E map has no member markers |
| C45 | P2 | "Your circle's calls" section | WS-C | E2E: after posting, own call listed w/ Close |
| C46 | P2 | Overflow menu Report/Hide/Block; 44px reactions | WS-H, WS-D | A11y target test feed |
| C47 | P2 | League table w/ next-step line | WS-C | Golden league |
| C48 | P0 | Puzzles server-side; client gets clue only; artifact uses salted hash | WS-E | PBT P08: no API response for any role contains answer before reveal; grep test: built index.html has no ANS literal |
| C49 | P2 | Tile error fallback to bundled vector + label | WS-F | E2E with tiles blocked: map shows world vector + "Street map unavailable" |
| C50 | P2 | Commit-reveal draw seed | WS-E | PBT P10: winner reproducible from revealed seed; H(seed) published before first check-in; differential vs v0.8 shape |
| C51 | P2 | 3-step Mission/trail wizard; shared picker | WS-F | E2E create Mission/trail via wizard |
| C52 | P1 | UPI VPA field + upi:// deep link + QR | WS-G | Unit PBT: upiUri escapes params, amount 2dp; VPA regex; E2E INR pot shows Pay by UPI |
| C53 | P2 | Intl currency formatting (lakh grouping) | WS-G | Unit: fmt(150000,'INR','en-IN')=='₹1,50,000.00'→ display rule |
| C54 | P2 | One-line balance explainer + sign | WS-G | Golden ledger |
| C55 | P2 | Stamp anchored, pointer-events none, reduced-motion | WS-H | E2E: after confirm, buttons clickable immediately |
| C56 | P2 | Solo Ledger empty state / hidden until circle | WS-B, WS-G | E2E solo |
| C57 | P1 | Grouped + menu w/ icons and lock rules | WS-B | E2E: solo + shows groups, locked rows route to Invite/Meet |
| C58 | P1 | Contextual push ask after first plan/pact/favor | WS-B | E2E: soft-ask card appears after first plan; not in onboarding |
| C59 | P1 | Server-side account delete transaction + sign-out | WS-D, WS-I | API test: after delete no row references uid except anonymised messages; session invalid; E2E lands on welcome |
| C60 | P2 | Sessions list, revoke, change email | WS-D, WS-I | API: revoke kills SSE + cookie; E2E |
| C61 | P2 | Dark timer from server now | WS-D | Unit with fake clock skew ±1 day |
| C62 | P2 | Human-readable export | WS-D | E2E export contains messages + ledger |
| C63 | P1 | Terms/Privacy/Rules pages; versioned consent; grievance contact | WS-D | E2E: consent required to finish onboarding; record stored with version |
| C64 | P1 | Initial map centre from timezone/IP | WS-F | Unit: tzCentre('Asia/Kolkata') in India bbox; E2E picker opens on India |
| C65 | P1 | One primary "Use my location", search fallback, URL detect | WS-F | E2E: paste URL into search places pin |
| C66 | P1 | You-see / Others-see preview toggle | WS-F | Golden picker both modes; PBT: preview cell == stored public cell |
| C67 | P2 | Collapse street hits, type icons, distance | WS-F | Unit: ranking puts towns before streets |
| C68 | P2 | 44px controls, label collision, gestures, fullscreen | WS-F, WS-H | A11y target test map |
| C69 | P1 | Protomaps PMTiles (India extract) default; Stadia fallback; attribution | WS-F, WS-I | E2E with TILE_URL=local pmtiles fixture; attribution visible |
| C70 | P2 | 13px min body secondary text; mono only codes | WS-H | Style test: no computed font-size <12px on golden screens |
| C71 | P2 | One filled primary per screen | WS-H | DOM test: ≤1 `.btn.primary` visible per view |
| C72 | P2 | Card contrast / shadow; dashed only for drop zones | WS-H | Contrast test card vs paper ≥1.25:1 + border |
| C73 | P1 | Snackbar above nav, cleared on navigation, role=status | WS-H | E2E: toast gone after tab change; never overlaps `.card` bbox |
| C74 | P3 | Header simplification | WS-H | Golden header |
| C75 | P3 | Token contrast audit in CI | WS-H | Contrast test light/dark |
| C76 | P1 | 44px targets | WS-H | A11y test: 0 targets <44px on golden screens |
| C77 | P2 | aria-labels, aria-expanded | WS-H | A11y test: every button has accessible name |
| C78 | P2 | focus-visible + focus trap | WS-H | E2E keyboard: Tab cycles inside sheet; focus returns |
| C79 | P2 | Contrast/target checker (in-repo) on goldens | WS-J | Runs in npm test |
| C80 | P3 | All animations behind reduced-motion | WS-H | E2E with reducedMotion: no running animations (getAnimations().length==0) |
| C81 | P1 | No places.tsv on server mode; per-country split; immutable cache | WS-F, WS-I | Network test: cold onboarding on server mode downloads <400KB total |
| C82 | P2 | Perf budget; lazy segments | WS-H, WS-I | Perf test: TTI proxy (render-complete) <2.5s on 4x CPU throttle |
| C83 | P1 | schemaVersion + migrations + artifact migration | WS-I | Migration test: v0.8 fixture DB → v0.9 → e2e passes; idempotent (run twice) |
| C84 | P1 | Token buckets per route; body cap | WS-I | PBT: N+1th write in window refused; 1MB body refused 413 |
| C85 | P2 | Security headers + cookie flags | WS-I | API test asserts headers |
| C86 | P2 | Hash secrets in artifact mode | WS-E | Grep test on built file: no plaintext spot/answer |
| C87 | P0 | Block + report person (server enforced) | WS-D | PBT P12: blocked user can never DM/dare/see blocker in any route; E2E block flow |
| C88 | P1 | Unsafe-dare flag; keyword screen; relabel scale | WS-D | Unit: screen refuses list; E2E flag hides dare; 2 flags pull from jar |
| C89 | P1 | Owner moderation view + audit log | WS-D | E2E owner sees flagged; non-owner 403 |
| C90 | P2 | Presence circle-only + toggle | WS-D | API PBT: presence never in city responses |
| C91 | P1 | Server city puzzle packs (India seeds) | WS-E | Content test: ≥12 puzzles per seeded city, no dup answers, each solvable (checker) |
| C92 | P2 | 60 dares / 30 Mole tasks; no repeat 30 days | WS-E | PBT: pickDare never repeats within 30 days per circle |
| C93 | P2 | Owner content tool | WS-E | E2E owner adds puzzle → appears next week |
| C94 | P3 | Explicitly out of scope; documented | none (out of scope) | Doc check |
| C95 | P2 | Strings table `T{}`; locale formatting | WS-H | Lint: no raw user-facing literals outside T (allowlist) |
| C96 | P0 | package.json, Dockerfile, render.yaml | WS-I | CI: docker build + /api/hello 200 |
| C97 | P0 | Nightly VACUUM INTO + WAL copy; restore script | WS-I | Test: backup→wipe→restore→e2e smoke |
| C98 | P1 | Sentry client+server, PII scrubbed | WS-I | Unit: scrubber removes emails/coords; DSN optional |
| C99 | P1 | Tagged releases; expand-migrate-contract | WS-I | Doc + migration test runs N-1 client against N server |
| C100 | P2 | Pin Node; suppress warning | WS-I | CI uses pinned version |
| C101 | P2 | First-party funnel counts | WS-I | API test: event counts aggregate, no uid stored |
| C102 | P2 | Circle timezone for Midnight/Mole/resets | WS-C, WS-I | PBT: release instant == next 00:00 in circle tz across DST |
| C103 | P1 | Env-configurable browser/playwright paths | WS-J | `npm test` runs here with /usr/bin/chromium |
| C104 | P1 | Condition waits; /api/dev/tick; fake clocks; device profiles | WS-J | Suite runtime budget check |
| C105 | P1 | PBT + differential + golden suites | WS-J | See §5 |
| C106 | P2 | India/RTL/emoji/long-name fixtures | WS-J | Fixtures used by e2e |
| C107 | P2 | Rail copy by backend; hidden in prod | WS-A | E2E server mode: no "Share menu" text |
| C108 | P1 | Glossary (i) + Help page + one-time tooltips | WS-B | E2E: every invented noun heading has (i); Help lists all |

## 7. Map and location design (WS-F detail)

**Why this design:** INSANE's map has four jobs, and each needs privacy by default:
1. Set your place without revealing it.
2. See drops within *your* radius.
3. Keep a Mission spot secret until T−2h.
4. Prove you were at a trail stop.

The v0.8 picker offers four input methods at once, opens on the wrong continent, and shows a square even in Exact mode (C64–C66). The City map is below the fold and plots members by name (C43, C44).

**Place picker (one shared component, used five times: onboarding, Profile, host drop, Mission, trail stop):**
1. It opens centred on a timezone or IP guess (Asia/Kolkata → India, city-level zoom if the IP city is known).
2. There is one primary button, **📍 Use my location**, with a search field beneath it. The field also accepts pasted Google, Apple or OSM links and plain coordinates (auto-detected). "Paste a maps link" is removed as a separate button.
3. Results come grouped as Towns · Neighbourhoods · Streets, each with a distance from the guess.
4. After a pick there's a **You see / Others see** toggle on the same map:
   - **Zone mode (the default, 1 km²):** both views show the square. Nothing finer is stored.
   - **Exact mode:** "You see" shows the pin. "Others see" shows the 1 km² square, blurred, with the label "near Chetput".
   
   The preview uses the same function the server uses to derive the public cell (property P09 checks they agree).
5. Drop radius is set by chips (2 · 5 · 10 · 25 km) with the ring drawn live.

**City tab:**
- The map comes first (about 60% of the viewport), with a draggable bottom sheet (peek, half, full) and a **List / Map** toggle for people who prefer lists.
- Distance chips filter live. Drops cluster at low zoom, with count bubbles.
- The list is sorted by distance and start time ("2.3 km · opens 18:00 · two-key").
- Decode moves to Home and League. The City header shrinks to one line.
- **Missions:** before T−2h, a 350 m circle nudged off the real spot, with a countdown chip. After the reveal, an exact pin only for yes-sayers (server-stripped for others).
- **Trails:** numbered stops and a dashed path. "Stamp" is enabled only within 60 m, with the GPS accuracy shown. An "on your word" fallback is labelled.
- **People are never plotted** (C44). An optional, circle-only "show my square" toggle exists, off by default.
- Map controls are 44 px. Two-finger pan inside the scroll page, plus a full-screen map button. Labels avoid collisions, with edge padding.
- **Tiles:** Protomaps PMTiles India extract (self-hosted, offline-cacheable by the SW, no third-party IP leak), configurable via `TILE_URL`/`TILE_KIND`. Stadia Maps is the hosted fallback for other regions during the test (free tier non-commercial: 200k credits a month; Starter $20 a month for commercial use; checked 17 Oct 2026, https://stadiamaps.com/pricing/). MapTiler's free tier (5k sessions a month, non-commercial, logo required) is too small. tile.openstreetmap.org is dropped for production per the OSMF tile policy. If tiles fail, the map falls back to the bundled vector world with a notice (C49).
- **Performance:** on server mode, phones never download `places.tsv` (C81). Search is server-side. Artifact mode loads a per-country file on demand.

## 8. Migration v0.8 → v0.9 (WS-I, C83)

- **Store-level `meta/schema` doc:** `{version: 9}`. Migrations are ordered, idempotent functions in `server/migrate.js`, run on boot inside a transaction after an automatic `VACUUM INTO backup-pre-v9.db`.
- **The v9 steps:**
  1. `people/{uid}.circle` → `circles: [cid]` (keep `circle` as primary for one release).
  2. Add `roles` to each circle (creator → admin).
  3. Move Decode answers out of any client-visible doc into `server_content`.
  4. Backfill `consent: {version: 0}` and prompt on next open.
  5. Add `tz` to each circle (from the creator's last seen tz).
  6. Drops keep the legacy draw (`drawVersion: 1`).
- **Artifact mode:** the client checks `meta/schema`. If it's below 9 and the user is the owner, the client exports a backup JSON first, then runs the same steps against the shared store. Non-owners see "This circle is updating, ask the owner to open INSANE".
- **Rollback:** the v0.9 server reads both shapes for one release (expand → migrate → contract). The v0.8 tag stays deployable with the pre-v9 backup.

## 9. Proactive additions (not asked for, but likely missed)

- **Abuse of dares:** a server keyword screen, a 2-flag pull, a per-user daily dare-sending cap, and no dares to people who joined less than 24 h ago. Covered by C88 and the rate limits in C84.
- **Analytics funnel:** first-party counts only, never per-person tracking (DPDP purpose limitation). Covered by C101.
- **Rollback and data migration:** sections 8 and C99.
- **Mobile data:** the places.tsv and tile budget (C81, C82). Goal: cold onboarding under 400 KB on server mode.
- **PWA update flow:** C08.
- **Timezones:** a circle-level tz (C102).
- **UPI for pots:** C52. Also plain "₹1,500 · GPay/PhonePe/Paytm all accept UPI" copy.
- **India age rule:** 18+ (C17).
- **Security headers and CSP:** C85.
- **Sentry PII scrubbing:** C98.
- **Bus factor:** `docs/RUNBOOK.md`, written by WS-I. How to deploy, restore, rotate VAPID keys, and change `OWNER_EMAIL`.
