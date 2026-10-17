#!/usr/bin/env node
// Builds app/index.html, the one self-contained file that pastes into claude.ai, from src/.
// No dependencies and no bundler: an ordered concatenation, since the app already shares one global scope.
//
//   node tools/build.js            write app/index.html
//   node tools/build.js --check    exit 1 if the committed app/index.html differs from a fresh build
//   node tools/build.js --stdout   print the build instead of writing it
//   OUT=path node tools/build.js   write somewhere else
//   MINIFY=0 node tools/build.js   skip minification (readable output for debugging; --check then fails, budget only warns)
//
// Minification (int-1, PLAN-V09 §5 budget): each JS file and the CSS go through esbuild (pinned devDependency)
// for whitespace, syntax and local-identifier minification. Top-level names are never renamed (the files share
// one global scope, and tests reach functions by name), string and template contents are untouched, and the
// local Decode pack between /*@decode-local*/ markers is kept byte for byte, since the server cuts it out.
//
// Layout (PLAN-V09 §2):
//   src/head.html                     <title>, meta, font links (everything before <style>)
//   src/css/{tokens,base,components,map,screens}.css   in that order (cascade order matters)
//   src/body.html                     the page markup and the QR <script src>
//   src/js/**/*.js                    sorted by path; "00-" files lead their folder (a registry before
//                                     the handlers that fill it). Order = load order = behaviour.
// Output: head + <!-- stamp --> + <style>css</style> + body + <script>js</script>
'use strict';
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const REPO = path.resolve(__dirname, '..');
const SRC = path.join(REPO, 'src');
const OUT = path.resolve(process.env.OUT || path.join(REPO, 'app', 'index.html'));
// bytes; v0.8 was 274,854. Never raise it again without cutting first (int-2). int-1 raised 350 KiB → 400 KiB: the merged v0.9 (WS-A/B/D/E/F/G/I) is 459,927 bytes
// unminified and 403,770 minified; most of what is left is copy and HTML inside template strings, which a
// minifier can't shrink. Server mode serves it gzipped (about 132 KB). See docs/INT-1.md.
const BUDGET = +process.env.SIZE_BUDGET || 400 * 1024;
const MINIFY = process.env.MINIFY !== '0';
let esbuild = null;
function minifier() {
  if (!esbuild) { try { esbuild = require('esbuild'); } catch (e) { throw new Error('esbuild is missing: run npm install (or MINIFY=0 for an unminified build)'); } }
  return esbuild;
}
const MIN_JS = { loader: 'js', minifyWhitespace: true, minifySyntax: true, minifyIdentifiers: true, keepNames: false, legalComments: 'none', charset: 'utf8', target: 'es2022' };
function minJs(code, name) {
  if (!MINIFY) return code;
  // the local Decode pack stays verbatim between its markers (server/server.js LOCAL_PACK, tools/content.js)
  const A = '/*@decode-local*/', B = '/*@end-decode-local*/', i = code.indexOf(A), j = code.indexOf(B);
  if (i >= 0 && j > i) return minJs(code.slice(0, i), name) + A + code.slice(i + A.length, j) + B + '\n' + minJs(code.slice(j + B.length), name);
  // int-2: in esbuild's one-line output a raw newline is only ever inside a template literal, and every one of
  // those is HTML between tags, where "\n    " and "\n" render the same; the indentation goes (about 0.8 KB).
  try { return minifier().transformSync(code, { ...MIN_JS, sourcefile: name }).code.replace(/\n[ \t]+/g, '\n'); }
  catch (e) { throw new Error(`src/${name}: ${e.message.split('\n')[0]}`); }
}
function minCss(code) { return MINIFY ? minifier().transformSync(code, { loader: 'css', minify: true, legalComments: 'none', charset: 'utf8' }).code : code; }


const CSS_ORDER = ['tokens', 'base', 'components', 'map', 'screens'];

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)]);
}
const rel = f => path.relative(SRC, f).split(path.sep).join('/');
const read = f => { const s = fs.readFileSync(f, 'utf8'); if (s.includes('\r')) throw new Error(rel(f) + ': CRLF line endings'); if (s && !s.endsWith('\n')) throw new Error(rel(f) + ': must end with a newline'); return s; };

function jsFiles() {
  return walk(path.join(SRC, 'js')).filter(f => f.endsWith('.js')).map(rel).sort();
}
function cssFiles() {
  const have = walk(path.join(SRC, 'css')).filter(f => f.endsWith('.css')).map(rel).sort();
  const want = CSS_ORDER.map(n => `css/${n}.css`);
  const extra = have.filter(f => !want.includes(f));
  if (extra.length) throw new Error('Unknown CSS file(s) ' + extra.join(', ') + ': add them to CSS_ORDER in tools/build.js (cascade order is explicit)');
  return want.filter(f => have.includes(f));
}

function build() {
  const files = ['head.html', ...cssFiles(), 'body.html', ...jsFiles()];
  const src = Object.fromEntries(files.map(f => [f, read(path.join(SRC, f))]));
  const css = minCss(cssFiles().map(f => src[f]).join(''));
  for (const f of jsFiles()) if (/<\/script/i.test(src[f])) throw new Error(`src/${f}: contains "</script", which would end the inline script`);
  if (/<\/style/i.test(css)) throw new Error('CSS contains "</style"');
  // one short marker per file, /*70-shell*/ for src/js/70-shell.js (int-2: the long form cost 1.9 KB)
  const js = jsFiles().map(f => `/*${f.slice(3, -3)}*/\n` + minJs(src[f], f)).join('');
  const body = `<style>\n${css}</style>\n${src['body.html']}<script>\n${js}</script>\n`;
  const id = crypto.createHash('sha256').update(src['head.html'] + body).digest('hex').slice(0, 12);
  const html = src['head.html'] + `<!-- INSANE build ${id}: generated by tools/build.js from src/. Do not edit by hand; edit src/ and run npm run build. -->\n` + body;
  return { html, id, files };
}

function main() {
  const args = process.argv.slice(2);
  const { html, id, files } = build();
  const size = Buffer.byteLength(html);
  // the budget is on what ships (the minified build); a MINIFY=0 debug build is never committed (--check fails on it), so it only warns
  if (size > BUDGET) { console.error(`build: ${size} bytes is over the ${BUDGET}-byte budget (SIZE_BUDGET)${MINIFY ? '' : ' (MINIFY=0: warning only)'}`); if (MINIFY) process.exit(1); }
  if (args.includes('--stdout')) { process.stdout.write(html); return; }
  if (args.includes('--check')) {
    const have = fs.existsSync(OUT) ? fs.readFileSync(OUT, 'utf8') : '';
    if (have === html) { console.log(`check: ${path.relative(REPO, OUT)} matches a fresh build (${id}, ${size} bytes)`); return; }
    const a = have.split('\n'), b = html.split('\n'); let i = 0; while (i < a.length && a[i] === b[i]) i++;
    console.error(`check: ${path.relative(REPO, OUT)} is stale or hand-edited. First difference at line ${i + 1}:\n  committed: ${(a[i] ?? '<eof>').slice(0, 160)}\n  fresh:     ${(b[i] ?? '<eof>').slice(0, 160)}\nRun: npm run build`);
    process.exit(1);
  }
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, html);
  console.log(`build: ${path.relative(REPO, OUT)} ${id} ${size} bytes${MINIFY ? ' minified' : ''}, ${require('zlib').gzipSync(html, { level: 9 }).length} gzipped, from ${files.length} files (budget ${BUDGET})`);
}

if (require.main === module) { try { main(); } catch (e) { console.error('build: ' + e.message); process.exit(1); } }
module.exports = { build, jsFiles, cssFiles, SRC, REPO };
