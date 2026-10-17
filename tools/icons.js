#!/usr/bin/env node
// Writes the INSANE app icons into server/public/ (C02). No image deps: the mark is drawn as SVG
// geometry (no fonts, so every machine draws the same pixels) and Chromium rasterises the PNGs.
//   node tools/icons.js
// icon.svg               any size, rounded (favicon, push badge)
// icon-192.png / icon-512.png          purpose "any", rounded corners, transparent outside
// icon-maskable-512.png  purpose "maskable": full bleed, mark inside the 80% safe circle
// apple-touch-icon.png   180 px, full bleed, opaque (iOS rounds the corners itself)
'use strict';
const fs = require('fs'), path = require('path');
const OUT = path.join(__dirname, '..', 'server', 'public');
const NAVY = '#151D36', PAPER = '#ECEEE7', STAMP = '#C8214B';
// The mark on a 96 grid: "IN" in blocks and the stamp-red dot.
const MARK = `<path fill="${PAPER}" d="M24 30h10v36H24zM40 30h10v36H40zM62 30h10v36H62zM40 30h10l22 36H62z"/><circle cx="78" cy="22" r="7" fill="${STAMP}"/>`;
const svg = ({ rx = 20, scale = 1 }) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96"><rect width="96" height="96" rx="${rx}" fill="${NAVY}"/><g transform="translate(48 48) scale(${scale}) translate(-48 -48)">${MARK}</g></svg>\n`;
const ICONS = [
  { file: 'icon-192.png', size: 192, svg: svg({}), transparent: true },
  { file: 'icon-512.png', size: 512, svg: svg({}), transparent: true },
  { file: 'icon-maskable-512.png', size: 512, svg: svg({ rx: 0, scale: 0.72 }) },
  { file: 'apple-touch-icon.png', size: 180, svg: svg({ rx: 0, scale: 0.86 }) },
];
module.exports = { ICONS, svg };
if (require.main === module) (async () => {
  const BR = require('../test/lib/browser');
  fs.writeFileSync(path.join(OUT, 'icon.svg'), svg({}));
  const browser = await BR.launch();
  try {
    for (const i of ICONS) {
      const page = await browser.newPage({ viewport: { width: i.size, height: i.size }, deviceScaleFactor: 1 });
      await page.setContent(`<style>html,body{margin:0;background:transparent}svg{display:block;width:${i.size}px;height:${i.size}px}</style>${i.svg}`);
      fs.writeFileSync(path.join(OUT, i.file), await page.screenshot({ omitBackground: !!i.transparent }));
      await page.close(); console.log('icons: wrote server/public/' + i.file);
    }
  } finally { await browser.close(); }
})();
