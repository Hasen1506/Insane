// Load INSANE's client code into a Node vm, with no browser, so pure functions can be called directly.
//   loadV09()            src/js/** concatenated in build order (99-start.js, i.e. boot(), left out)
//   loadBuilt(file)      the inline <script> of a built index.html (default app/index.html)
//   loadV08()            the inline <script> of v0.8's app/index.html at fac3720, via a cached git worktree
// Each returns an App: { ctx, get(name), run(code), setNow(t), loadPlaces() }.
// The DOM, storage and network are inert stubs; Date.now() and `new Date()` read a clock you set.
'use strict';
const vm = require('vm'), fs = require('fs'), path = require('path'), { execFileSync } = require('child_process');
const { webcrypto } = require('crypto');
const REPO = path.resolve(__dirname, '..', '..');
const V08_SHA = 'fac3720';
const V08_DIR = process.env.V08_DIR || path.join(REPO, '.v08');

// A value that absorbs anything: any property, any call, any `new`. Not thenable, so `await` passes through.
function inert() {
  const f = function () { };
  const p = new Proxy(f, {
    get: (t, k) => k === 'then' ? undefined : k === Symbol.toPrimitive ? () => '' : k === Symbol.iterator ? function* () { } : k === 'length' ? 0 : p,
    apply: () => p, construct: () => p, set: () => true, has: () => false,
  });
  return p;
}

function makeContext() {
  const clock = { now: Date.UTC(2026, 9, 12, 9, 0, 0) }; // a Monday, 09:00 UTC; tests set their own
  const RealDate = Date;
  class FakeDate extends RealDate {
    constructor(...a) { if (a.length === 0) super(clock.now); else super(...a); }
    static now() { return clock.now; }
  }
  const store = new Map();
  const localStorage = { getItem: k => store.has(k) ? store.get(k) : null, setItem: (k, v) => store.set(k, String(v)), removeItem: k => store.delete(k), clear: () => store.clear(), key: i => [...store.keys()][i] ?? null, get length() { return store.size; } };
  const fileFetch = async u => { // only data/ files, read from app/; everything else never answers
    const m = /^data\/(places\.tsv|world\.json|places\/[A-Za-z0-9._-]+)$/.exec(String(u)); // places/: WS-F's per-country chunks
    if (!m) return new Promise(() => { });
    const f = path.join(REPO, 'app', 'data', m[1]);
    return { ok: true, status: 200, text: async () => fs.readFileSync(f, 'utf8'), json: async () => JSON.parse(fs.readFileSync(f, 'utf8')) };
  };
  const sandbox = {
    console, Date: FakeDate, Math, JSON, Intl, Promise, Set, Map, WeakMap, WeakSet, Symbol, Proxy, Reflect, Array, Object, String, Number, Boolean, RegExp, Error, TypeError, RangeError,
    Uint8Array, Float64Array, Float32Array, Int32Array, Uint32Array, ArrayBuffer, DataView, TextEncoder, TextDecoder, URL, URLSearchParams, BigInt, isFinite, isNaN, parseInt, parseFloat, encodeURIComponent, decodeURIComponent, escape, unescape, structuredClone, queueMicrotask, atob, btoa,
    crypto: webcrypto, localStorage, sessionStorage: localStorage,
    document: inert(), navigator: { userAgent: 'node', language: 'en-GB', languages: ['en-GB'], clipboard: inert(), serviceWorker: undefined, geolocation: undefined },
    location: { href: 'http://localhost/', origin: 'http://localhost', protocol: 'http:', host: 'localhost', hostname: 'localhost', pathname: '/', search: '', hash: '', reload() { }, replace() { } },
    history: inert(), fetch: fileFetch, matchMedia: () => ({ matches: false, addEventListener() { }, addListener() { } }),
    requestAnimationFrame: () => 0, cancelAnimationFrame() { }, setTimeout: () => 0, clearTimeout() { }, setInterval: () => 0, clearInterval() { },
    addEventListener() { }, removeEventListener() { }, scrollTo() { }, alert() { }, confirm: () => false, getComputedStyle: () => inert(), Image: function () { return inert(); }, Notification: undefined,
    devicePixelRatio: 1, innerWidth: 390, innerHeight: 844,
  };
  sandbox.window = sandbox; sandbox.self = sandbox; sandbox.globalThis = sandbox;
  const ctx = vm.createContext(sandbox);
  return { ctx, clock };
}

// The app's code runs inside one function scope, not as vm globals: every global lookup in a vm context
// goes through the sandbox interceptor, which made the 69,818-town scans ~50x slower than in a browser.
// Hot builtins are bound as locals for the same reason. `run` is a direct eval in that scope, so it
// sees the app's top-level names exactly as code in the page does (the app never reads its own
// names off `window`).
const HOT = ['Math', 'Date', 'JSON', 'Object', 'Array', 'String', 'Number', 'Set', 'Map', 'RegExp', 'isFinite', 'parseInt', 'parseFloat'];
function app(code, label) {
  const { ctx, clock } = makeContext();
  const wrapped = `(function(${HOT.join(',')}){${code}\n;return function(__c){return eval(__c)};})(${HOT.join(',')})`;
  const evalIn = vm.runInContext(wrapped, ctx, { filename: label });
  const cache = new Map();
  const get = name => { if (!cache.has(name)) cache.set(name, evalIn(name)); return cache.get(name); };
  const run = c => evalIn(c);
  return {
    label, ctx, get, run,
    setNow: t => { clock.now = +t; },
    loadPlaces: () => run('loadPlaces()'),
    // put fixture state into S (S is a const in the app's scope, so assign into it)
    setState: obj => { ctx.__st = obj; run('Object.assign(S,__st)'); delete ctx.__st; },
  };
}

// The app's inline <script> (the one with no src) out of an index.html.
function inlineScript(html) {
  const m = [...html.matchAll(/<script>\n([\s\S]*?)<\/script>/g)];
  if (m.length !== 1) throw new Error('expected exactly one inline <script>, found ' + m.length);
  const js = m[0][1];
  if (!/\nboot\(\);\n$/.test(js)) throw new Error('inline script does not end with boot();');
  return js.replace(/\nboot\(\);\n$/, '\n'); // no boot: pure functions only
}

function loadV09() {
  const { jsFiles, SRC } = require(path.join(REPO, 'tools', 'build.js'));
  const files = jsFiles().filter(f => f !== 'js/99-start.js');
  return app(files.map(f => fs.readFileSync(path.join(SRC, f), 'utf8')).join(''), 'v0.9 src');
}
function loadBuilt(file = path.join(REPO, 'app', 'index.html')) { return app(inlineScript(fs.readFileSync(file, 'utf8')), 'built ' + path.basename(file)); }

// git worktree at fac3720, created once and reused (.v08/ is gitignored).
function v08Dir() {
  const f = path.join(V08_DIR, 'app', 'index.html');
  if (!fs.existsSync(f)) {
    try { execFileSync('git', ['worktree', 'prune'], { cwd: REPO, stdio: 'ignore' }); } catch (e) { }
    execFileSync('git', ['worktree', 'add', '--detach', V08_DIR, V08_SHA], { cwd: REPO, stdio: 'pipe' });
  }
  const head = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: V08_DIR }).toString().trim();
  if (!head.startsWith(V08_SHA)) throw new Error(`${V08_DIR} is at ${head}, expected ${V08_SHA}`);
  return V08_DIR;
}
function loadV08() { return app(inlineScript(fs.readFileSync(path.join(v08Dir(), 'app', 'index.html'), 'utf8')), 'v0.8 ' + V08_SHA); }

module.exports = { loadV08, loadV09, loadBuilt, v08Dir, inlineScript, makeContext, V08_SHA };
