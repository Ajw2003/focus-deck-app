// #206 whole-app pass: every screen at 1440x900 and 390x844 with sample data; reports page/console errors and sideways scroll.
// Usage: CHROMIUM=/opt/pw-browsers/chromium-1194/chrome-linux/chrome node docs/generated/calm-build/built/206-shots.mjs
import { createRequire } from 'node:module';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import { join, extname, normalize } from 'node:path';
const require = createRequire('/opt/node22/lib/node_modules/');
const { chromium } = require('playwright');
const ROOT = fileURLToPath(new URL('../../../../', import.meta.url));
const OUT = join(ROOT, 'docs/generated/calm-build/built/');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' };
const server = createServer((req, res) => {
  const rel = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname)).replace(/^[/\\]+/, '');
  let file = join(ROOT, rel);
  if (existsSync(file) && statSync(file).isDirectory()) file = join(file, 'index.html');
  if (!existsSync(file)) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': TYPES[extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
  res.end(readFileSync(file));
});
await new Promise((ok) => server.listen(8206, '127.0.0.1', ok));
const B = 'http://127.0.0.1:8206/';
const screens = { focus: 'docs/generated/sort-steps/seed.html#focus', sort: 'docs/generated/sort-steps/seed.html#sort', board: 'docs/generated/sort-steps/seed.html#board?ties', projects: 'docs/generated/sort-steps/seed.html#projects', settings: 'SETTINGS' };
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM, args: ['--no-sandbox'] });
let bad = 0;
for (const [w, h] of [[1440, 900], [390, 844]]) {
  for (const [name, url] of Object.entries(screens)) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, serviceWorkers: 'block' });
    const page = await ctx.newPage();
    const errs = [];
    page.on('pageerror', (e) => errs.push('page: ' + e.message));
    page.on('console', (m) => { if (m.type() === 'error' && !/favicon\.ico/.test(m.location().url || '')) errs.push('console: ' + m.text() + ' ' + (m.location().url || '')); });
    if (url === 'SETTINGS') { await page.goto(B + 'docs/generated/sort-steps/seed.html#focus'); await page.waitForTimeout(1500); await page.goto(B + 'app/settings.html'); }
    else await page.goto(B + url);
    await page.waitForTimeout(1200);
    const sw = await page.evaluate(() => [document.documentElement.scrollWidth, innerWidth]);
    await page.screenshot({ path: OUT + `206-${name}-${w}.png` });
    const ok = !errs.length && sw[0] <= sw[1];
    if (!ok) bad++;
    console.log((ok ? 'OK   ' : 'BAD  ') + name + ' ' + w + ' scrollWidth ' + sw.join('/') + (errs.length ? ' ' + errs.join(' | ') : ''));
    await ctx.close();
  }
}
await browser.close(); server.close();
process.exit(bad ? 1 : 0);
