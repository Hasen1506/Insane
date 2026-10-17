# WS-0: split and build (v0.9)

WS-0 of [PLAN-V09](PLAN-V09.md) §2 does one thing: it moves v0.8's single `app/index.html` into `src/` modules and adds a build that puts it back together, **with no behaviour change**. It also lays the test foundation (WS-J) that the other workstreams build on.

## The build

`app/index.html` is still one self-contained file that pastes into claude.ai. It's now the build output, and it stays committed.

```
npm run build      # node tools/build.js          writes app/index.html from src/
npm run check      # node tools/build.js --check  exit 1 if the committed file isn't a fresh build
```

- **No dependencies, no bundler.** The build is an ordered concatenation: `head.html`, then `<style>` with the five CSS files in a fixed order, then `body.html`, then `<script>` with every `src/js/**/*.js` sorted by path. Each JS file gets a `/* src/js/… */` marker.
- **Stamp and checks.** The build adds a stamp comment, `<!-- INSANE build <sha256-12> … -->`, after the head. The hash is of the content, so `--check` stays stable across commits. The build also enforces a size budget (`SIZE_BUDGET`, default 350 KiB; v0.9 is now 285 KB, v0.8 was 275 KB). It refuses CRLF line endings, a missing final newline, a `</script` inside JS, and any CSS file not listed in `CSS_ORDER`, because cascade order is explicit.
- **The plan says `tools/build.mjs`.** This build is `tools/build.js` (CommonJS), as WS-0 was briefed. Rename it if you want ESM; nothing else depends on the name except `package.json`.

## Module layout

```
src/head.html                 <title>, meta, font links (v0.8 lines 1–5)
src/css/tokens.css            :root colours and fonts, light/dark (7–26)
src/css/base.css              page, rail, header, tab bar (27–57)
src/css/components.css        type, cards, buttons, inputs, chips, lists, sheet, toast (58–181)
src/css/map.css               map slot, controls, search results (182–190)
src/css/screens.css           everything after: v0.6 pieces, ledger, Mole, Midnight, nav + (191–273)
src/body.html                 rail markup, #app, #layer, QR library <script src> (275–296)
src/js/00-helpers.js          'use strict', $, esc, time helpers (298–321)
       10-places.js           places file, cells, areaFor, parseLL (322–389)
       20-map.js              MapView, tiles, vector world (390–492)
       25-picker.js           place picker (846–895)
       30-lanes.js            readUrge / readCard (493–528)
       35-decode.js           Decode (529–549)
       36-drops.js            drops, drawWinner (550–559)
       40-store-local.js      LocalDB (560–588)
       41-store-remote.js     RemoteDB, codeHash, localUid (589–617)
       50-state.js            S, subscriptions, wire/wire2, person (618–691)
       55-writes.js           W, mark, timeline, journeys (692–750)
       60-boot.js             boot, signOut, appLink, qrSvg, handleDeep (751–781)
       65-game.js             v0.6 game rules: currency, dares, Mole, Missions, trails (1260–1277, 1288–1309)
       70-shell.js            render/draw/view, sign-in, header, nav, badges (782–845)
       71-onboarding.js       (896–979)
       72-home.js             (980–1037, 1310–1356)
       73-circle.js           (1038–1120, 1357–1412)
       74-city.js             (1121–1203, 1413–1424)
       75-ledger.js           pots, balance, ledger screens (1278–1287, 1425–1490)
       76-you.js              (1204–1259)
       77-plus.js             + sheet, invite sheet, photo shrink, clip sweep (1491–1502)
       78-sheets/00-layer.js  layer(), the SHEETS registry and sheetBody()
       78-sheets/*.js         one file per sheet family: city dares decode drops favors invite journeys make midnight pots thread you
       79-activity.js         what's new, calm, presence, celebrate, push, toast (1503–1552, 1685–1688)
       80-input.js            clocks, input/change/submit/click/keydown listeners, openSheet/closeSheet (1689–1724)
       90-actions/00-registry.js   ACT registry and act()
       90-actions/*.js        handlers per module: circle city dares dark decode drops favors journeys meet midnight mole nav onboarding plans plus pots you
       99-start.js            boot();
```

The line numbers are v0.8's (`fac3720`). Where the code differs from the plan's table:
- **65-game.js is new.** The plan's ranges didn't cover the shared v0.6 rules at 1260–1309.
- **Toast moved to 79-activity.js**, the file WS-H owns.
- **`61-router`, `95-strings`, `96-unlock` and `97-help` aren't created.** They are new features, so they belong to their workstreams.

**The `act()` switch is now a registry.** Each `case` became `ACT['name']=async(d,el,a)=>{const db=S.db,uid=S.uid,me=S.me; …}`, with its body copied verbatim. The `a` parameter is the action name, which four handlers read. Cases that shared a body share a function. `act(a,d,el)` looks the handler up and returns its promise, so the timing is the same as the old async function.

**`sheetBody()` became `SHEETS['name']=(sh,close)=>…`** in the same way. Both registries use `Object.create(null)`.

**The split was done by [`tools/ws0/split.js`](../tools/ws0/split.js)** (a one-off; it needs `acorn`, used only for this). It refuses to write anything unless all of these hold:
- every v0.8 script line is used exactly once;
- no case can fall through, and none declares at switch level;
- there are no duplicate case labels;
- every comment is kept;
- every load-time reference to a `const`, `let` or `class` still comes after its declaration in the new order, including through functions called at load;
- the 15 top-level side effects (listeners, intervals, `boot()`) run in the same order;
- the top-level names are identical, apart from `ACT` and `SHEETS`.

The CSS and everything outside `<script>` are byte-identical to v0.8.

## Tests

```
npm test               # node test/run.js: build, unit, pbt, diff, e2e:local, e2e:server, golden
npm run test:quick     # build unit pbt diff
npm run test:e2e       # e2e:local e2e:server
npm run golden:update  # GOLDEN_UPDATE=1: rewrite goldens after a reviewed change
node test/run.js diff  # any suite by name; VERBOSE=1 streams script output; BUDGETS=strict fails over-budget suites
```

| Suite | What | Where |
|---|---|---|
| build | `--check` | `tools/build.js` |
| unit | build is deterministic; `--check` catches an edit; budget enforced; one inline script; remote hosts are exactly v0.8's; registry files lead their folders. Lint: no fixed sleeps and no `/opt` paths anywhere in `test/`, the legacy ports included. Scripts: every `node <file>` in `package.json` exists, `run.js` takes its build check from `scripts.check`, and the docs name only commands that exist | `test/unit/` |
| pbt | the runner tests itself: it finds planted bugs, shrinks to the minimal case, replays by seed, and handles async | `test/pbt/` |
| diff | v0.8 vs v0.9 src vs v0.9 built on seeded inputs, 5,000 per function (`DIFF_RUNS`); the place-file scans run 40–60 cases (`DIFF_PLACES_RUNS`, `DIFF_AREA_RUNS`, `DIFF_NEAR_RUNS`), since a region search costs ~80 ms a call on each of the three sides. Covers 29 pure functions: geometry, text, urges, time, Decode, drops, pots, balance, and place search/area over the real 69,818-town file. Also checks that the ACT and SHEETS registries hold exactly v0.8's 150 action names and 23 sheets, and that every sheet renders identical HTML | `test/diff/` |
| e2e:local | v0.8's 83 local-store checks, IDs `V08-L01…`, against the built file. Starts at a fixed Wed 07:00 Lisbon (inside quiet hours), so all 83 run at any hour; v0.8 skipped two of them by day | `test/e2e/legacy-local.js` |
| e2e:server | v0.8's 92 server checks, IDs `V08-S01…`, against the built file served by `server/server.js` | `test/e2e/legacy-server.js` |
| golden | 11 screens (onboarding ×4, Home, Circle, City, Ledger, You, + sheet, invite sheet) on Pixel 7, driven identically on v0.8 and v0.9: **identical DOM and pixels**. The v0.9 shots are kept as DOM and JPEG goldens | `test/golden/` |

`app/test/e2e.js` and `server/test/playtest.js` are now one-line shims to the ports, so the old commands still work. `package.json` scripts are the source of truth; there is no `tools/check.js` (the check is `npm run check`).

**No fixed sleeps.** v0.8's 97 (local) and 47 (server) fixed waits are gone:
- Every tap waits for its `act()` to finish and draw (`E.idle`, via the act probe).
- A check that depends on something arriving is polled (`ok(name, async () => …)`, 8 s), so it passes the moment the write or push lands.
- Local mode reads a tab only once it has caught up: an init script counts each tab's LocalDB writes on a side `BroadcastChannel`, and a read waits until the tab has heard every other tab's latest write, then for `#app` to stop changing.
- Server mode: the two `wait(21000)` for the server's 20 s sweep are polls (up to 45 s) that end when the sweep has run. `POST /api/dev/tick` (§5.0) would make them instant, but it is a server change, left to WS-I/J.
- Server mode drops Playwright's fake clock (it fakes every timer and rAF, and across eleven windows its timer loop was a big share of the CPU) for a per-page `Date` offset that `setClock` moves. The harness also paces rAF to 4 fps in the windows the test isn't driving and caps map repaints at 8 a second: v0.8's map repaints the whole vector world every frame while a drop or trail pulses, which on a 2-core box starved taps until they timed out. No app code changes.

### The J foundation (`test/lib`, `test/pbt`, `test/diff`)

- **`test/pbt/runner.js`: a seeded property runner with no deps.**
  - `prop(name, gen, pred, {runs, seed})`, using mulberry32.
  - Generators: `int float bool pick constant str array tuple record oneOf map latLon email uid`.
  - `str` covers emoji, ZWJ, RTL, combining marks, zero-width characters, Tamil and Devanagari.
  - Shrinking: ints halve toward 0, arrays drop items, strings shorten.
  - A failure prints `SEED=… CASE=…`. Replay with `PBT_SEED`, and set runs with `PBT_RUNS`.
- **`test/lib/load.js`: loads client code into a Node `vm`** with inert DOM, storage and network stubs and a settable clock.
  - `loadV09()` reads `src/`, `loadBuilt()` reads a built file, and `loadV08()` reads `fac3720` through a cached `git worktree` at `.v08/` (gitignored).
  - `boot()` is left out, so only definitions run.
  - `loadPlaces()` reads the real `app/data/places.tsv`.
- **`test/diff/harness.js`** feeds every side the same seeded inputs and compares results in a canonical form that is safe across realms (keeps Set, Map, NaN, −0 and undefined). `allow()` hooks are there for the documented intentional differences in PLAN §5.c, such as `drawWinner`.
- **`test/lib/browser.js`** picks Playwright from `$PW`, then `playwright-core`, then `playwright`.
  - Chromium comes from `$CHROMIUM`, then `$CHROME`, then `/usr/bin/chromium`, `chromium-browser` or `google-chrome`.
  - It provides the device profiles `Pixel 7`, `iPhone 13` (iPhone keeps its viewport, DPR and UA on Chromium) and `Desktop 1280`.
  - `blockExternal(ctx)` aborts every non-localhost request. The QR library is the exception: it's served from a pinned copy in `test/fixtures/` (the same 1.4.4 file as the CDN), so QR codes still render. Set `QR=abort` to cut it too.
- **`test/lib/e2e.js`: condition waits only.**
  - `until(fn)`, `settled` (two rAFs), `stable`, `textHas`, `gone`.
  - `actProbe` + `idle`: wait until every `act()` started by a tap has finished and drawn. The probe wraps `window.act` from an init script, with no app change.
  - Clocks: `clock.install/set/advance`, plus `clock.server(base, t)` for `/api/dev/clock`.
  - `serveStatic` (configurable `APP`, `APP_DIR`, `APP_PORT`).
  - `startServer` spawns a DEV server on a temp DB, or attaches to `$SERVER_URL`. `outboxCode` reads the DEV outbox.
- **`test/lib/golden.js`**
  - `seedRandom` (seeded `Math.random`, `getRandomValues` and `randomUUID`) and `freeze` (no animation or caret).
  - `domSnapshot`: a normalised text-and-role tree.
  - `matchDom`, and `pixelShot` (400 px JPEG q70, encoded by Chromium's canvas, so no image deps).
  - `pixelDiff` (fraction of pixels over a channel threshold), and `matchPixels`.

**Playwright:** `playwright-core` is the only devDependency (no browser download). Install with `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 npm i`. It drives the system Chromium (`apt install chromium`, or set `CHROMIUM`).
