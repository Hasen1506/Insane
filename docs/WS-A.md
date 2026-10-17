# WS-A: phone shell and PWA (v0.9)

Closes C01–C08, C31 and C107 from [CRITIQUES-V09](CRITIQUES-V09.md), per [PLAN-V09](PLAN-V09.md) §3 and §6.

| # | What changed | Where |
|---|---|---|
| C01 | `<meta name=viewport content="width=device-width,initial-scale=1,viewport-fit=cover">`. The rail is hidden below 980 px, as before. | `src/head.html` |
| C02 | Manifest linked and filled in (id, scope, lang, portrait). PNG icons: 192, 512, maskable 512 and a 180 px apple-touch-icon, drawn by `tools/icons.js` as font-free SVG geometry and rasterised by Chromium. Theme colour for light and dark, `apple-mobile-web-app-*`. On iPhone Safari (not standalone, server mode, in a circle, on Home) an "Add to Home Screen" card, which can be dismissed for good. | `src/head.html`, `server/public/*`, `src/js/63-pwa.js` |
| C03 | `<!doctype html><html lang="en"><meta charset="utf-8">` | `src/head.html` |
| C04 | No CDN script. `src/js/62-qr.js` is a 5 KB byte-mode level-M encoder (versions 1–10). For ASCII it produces the same modules and SVG markup as qrcode-generator 1.4.4, checked on random strings and on every length from 0 to 213. Non-ASCII is now real UTF-8. | `src/js/62-qr.js`, `src/body.html` |
| C05 | History routing: `#/today`, `#/circle/plans`, `#/circle/thread/<id>`, `#/ledger/pots`, `+ /sheet/<name>`. After each draw, the route is read from `S.ui`, so no screen code changed. Back closes a sheet first. Close and Back leave the same history. A sheet that hands over to another sheet or screen gives up its entry. `#c`/`#m` links still work. `#/…` links open that tab. | `src/js/61-router.js`, a hook in `draw()` |
| C06 | When the kind of screen changes (sign-in → onboarding → app), the page scrolls to the top. A new tab starts at the top. Back restores the scroll position of the entry it returns to. | `70-shell.js`, `61-router.js` |
| C07 | Offline banner, using the browser's online/offline events (the SSE "Reconnecting…" is kept). The service worker installs once the page is idle and precaches the shell (index, manifest, icons). `world.json` and the other icons are cached the first time they are requested. Pages are served cache-first. On a cold start with no signal it shows an "You're offline" shell, which reloads itself when the connection returns. | `server/public/sw.js`, `63-pwa.js`, `60-boot.js` |
| C08 | The worker is registered as `/sw.js?b=<BUILD_ID>`: one worker and one cache (`insane-<id>`) per build, with old caches deleted on activate. A new build waits; it doesn't call `skipWaiting` on its own. The page checks `/` for a newer build stamp on boot, on visibility, when it comes back online, and every 30 minutes. It prefers `X-Insane-Build` if the server sends it. When a newer build is found it shows "New version ready · Reload". | `sw.js`, `63-pwa.js` |
| C31 | `#app` with a tab bar gets `padding-bottom: calc(var(--nav-h) + env(safe-area-inset-bottom) + 16px)`. | `src/css/base.css` |
| C107 | The rail's claude.ai copy stays only in artifact and local mode. The server dev build shows a short About / Help panel instead. Production has no rail, and the app keeps its full column. | `railFor()` in `70-shell.js` |

**Hooks outside WS-A files:**
- `server/server.js`: one line, the static route also serves the PNG icons (C02).
- `79-activity.js`: one line, push opt-in uses `swReg()`, so the worker URL never flips.
- `test/diff/pure.test.js`: new action names are listed per workstream in `test/diff/new-names/<ws>.json`.
- `test/run.js`: new suites `regression` and `e2e:flows`.
- `package.json`: `test:e2e` includes `e2e:flows`.
- `test/golden/screens.test.js`: the goldens now cover Pixel 7 and iPhone 13. v0.8 pixel identity is a report (`GOLDEN_V08=1`), because C01 changes every phone screen.

**Tests:**
- unit `qr`, `pwa`;
- pbt `router` (model-based history: R1–R6);
- `regression/shell` (R-C01, R-C03, R-C05, R-C06, R-C31, R-C107);
- `e2e/flows/shell` (F18 offline and update, F19 history, C04 under CSP with every outside host cut, C02 served 200 and the A2HS card). All on Pixel 7 and iPhone 13, in local and server mode.

**Not done here:**
- **The C07 write queue with idempotency keys.** It needs `41-store-remote.js` and a server idempotency check (WS-I). Until then the offline banner says plainly that changes won't send.
- **The C08 server header.** `X-Insane-Build` and a min-client-build check belong to WS-I. The client already reads the header.
- **A CSP meta.** It isn't in `head.html`, because claude.ai's own injected scripts are unknown. For server mode, CSP is WS-I's C85. The e2e test applies `script-src 'self' 'unsafe-inline'` as a header.
