// Browser plumbing for every e2e and golden test: which Playwright, which Chromium, which phone,
// and which outside hosts get cut off so a run never hangs on the network.
//
// Playwright:  $PW (a path or package name), else `playwright-core` (the devDependency), else `playwright`.
// Chromium:    $CHROMIUM, else $CHROME, else /usr/bin/chromium, /usr/bin/chromium-browser, /usr/bin/google-chrome.
'use strict';
const fs = require('fs'), path = require('path');

function playwright() {
  const tries = [process.env.PW, 'playwright-core', 'playwright'].filter(Boolean);
  for (const t of tries) { try { return require(t); } catch (e) { } }
  throw new Error('No Playwright found. Run `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 npm i` (installs the playwright-core devDependency) or set PW=/path/to/playwright.');
}

function chromiumPath() {
  const tries = [process.env.CHROMIUM, process.env.CHROME, '/usr/bin/chromium', '/usr/bin/chromium-browser', '/usr/bin/google-chrome'].filter(Boolean);
  for (const t of tries) if (fs.existsSync(t)) return t;
  throw new Error('No Chromium found. Install one (apt install chromium) or set CHROMIUM=/path/to/chrome.');
}

async function launch(opts = {}) {
  const { chromium } = playwright();
  return chromium.launch({ executablePath: chromiumPath(), args: ['--no-sandbox'], ...opts });
}

// Device profiles. Pixel 7 and iPhone 13 come from Playwright's own table; Desktop 1280 is ours.
function devices() {
  const d = playwright().devices || {};
  return {
    'Pixel 7': d['Pixel 7'],
    'iPhone 13': d['iPhone 13'],
    'Desktop 1280': { viewport: { width: 1280, height: 860 }, deviceScaleFactor: 1, isMobile: false, hasTouch: false, userAgent: (d['Desktop Chrome'] || {}).userAgent },
  };
}
// Context options for a named profile. Chromium can't emulate WebKit, so iPhone keeps its viewport, DPR,
// touch and UA but runs on Chromium; that is what "mobile profile" means everywhere in these tests.
function profile(name, extra = {}) {
  const p = devices()[name];
  if (!p) throw new Error('Unknown device profile: ' + name);
  const { defaultBrowserType, ...rest } = p;
  return { ...rest, ...extra };
}

// Hosts that hang in the sandbox (and make runs flaky anywhere). Fonts and tiles are aborted, so the
// app's own fallbacks (system font stack, bundled world map) are what gets tested. The QR library is
// served from a pinned copy in test/fixtures (same file, same version as the CDN) so QR codes still
// render; set QR=abort to cut it off like the rest.
const QR_URL = /cdnjs\.cloudflare\.com\/ajax\/libs\/qrcode-generator\/1\.4\.4\/qrcode\.min\.js/;
const QR_FILE = path.join(__dirname, '..', 'fixtures', 'qrcode-generator-1.4.4.min.js');
const ABORT = [/^https?:\/\/fonts\.(googleapis|gstatic)\.com\//, /^https?:\/\/([a-z0-9-]+\.)*tile\.openstreetmap\.org\//, /^https?:\/\/([a-z0-9-]+\.)*tile\.[a-z.]+\//];
async function blockExternal(ctx, { allow = [] } = {}) {
  const qr = process.env.QR !== 'abort' && fs.existsSync(QR_FILE) ? fs.readFileSync(QR_FILE) : null;
  await ctx.route(u => /^https?:/.test(u.href) && !/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?\//.test(u.href), route => {
    const u = route.request().url();
    if (allow.some(a => a.test(u))) return route.continue();
    if (qr && QR_URL.test(u)) return route.fulfill({ status: 200, contentType: 'text/javascript', body: qr });
    return route.abort('blockedbyclient');
  });
  ctx.__blocked = ABORT;
}

// Goldens need a fixed origin (invite links and QR codes carry it) but must not hold a fixed port (int-1, WS-J
// groundwork). The page talks to `alias` (e.g. http://localhost:8777), which nothing listens on: this context
// answers those requests from the real server at `realUrl` (a free port). Register it after blockExternal().
async function aliasOrigin(ctx, realUrl, alias) {
  await ctx.route(u => u.href === alias || u.href.startsWith(alias + '/'), async route => {
    const u = new URL(route.request().url());
    try { await route.fulfill({ response: await route.fetch({ url: realUrl + u.pathname + u.search }) }); } catch (e) { await route.abort('connectionrefused').catch(() => { }); }
  });
  return alias;
}
module.exports = { playwright, chromiumPath, launch, devices, profile, blockExternal, aliasOrigin, QR_FILE };
