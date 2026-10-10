// scripts/check-service-worker-browser.mjs -- real-Chromium check that the app worker installs,
// caches every SHELL_ASSETS file, and that /app/ and Settings load with the network cut.
// Usage (after `python3 generate_icons.py`): CHROMIUM=/opt/pw-browsers/chromium-1194/chrome-linux/chrome node scripts/check-service-worker-browser.mjs
// Serves the repo root itself on 127.0.0.1:8124 for the length of the run (no separate server).
import { createRequire } from 'node:module';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import { join, extname, normalize } from 'node:path';
const require = createRequire('/opt/node22/lib/node_modules/');
const { chromium } = require('playwright');
const ROOT = fileURLToPath(new URL('..', import.meta.url));
const BASE = 'http://127.0.0.1:8124/app/';
// The icons are generated, not committed; without them the worker's install fails and every check below fails with it.
if (!existsSync(join(ROOT, 'app/icons/icon-192.png'))) {
  console.log('app/icons/ is missing: run `python3 generate_icons.py` from the repo root first (the deploy job does the same).');
  process.exit(1);
}

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' };
const notFound = [];
const server = createServer((req, res) => {
  const rel = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname)).replace(/^[/\\]+/, '');
  let file = join(ROOT, rel);
  if (!file.startsWith(ROOT)) { res.writeHead(403); return res.end(); }
  if (existsSync(file) && statSync(file).isDirectory()) file = join(file, 'index.html');
  if (!existsSync(file)) { notFound.push(req.url); res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': TYPES[extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
  res.end(readFileSync(file));
});
await new Promise((ok) => server.listen(8124, '127.0.0.1', ok));

const results = [];
const check = (name, ok, extra = '') => { results.push(ok); console.log((ok ? 'PASS ' : 'FAIL ') + name + (extra ? '  [' + extra + ']' : '')); };

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM, args: ['--no-sandbox'] });
try {
  const ctx = await browser.newContext({ viewport: { width: 420, height: 900 } });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => check('no page error: ' + e.message, false));
  await page.goto(BASE);

  // Resolves once a worker is active, or with a reason after 10 s, so a failed install never hangs the run.
  const state = await page.evaluate(() => Promise.race([
    navigator.serviceWorker.ready.then((r) => 'active: ' + r.active.scriptURL),
    new Promise((ok) => setTimeout(async () => ok('no active worker after 10 s; registrations: ' + (await navigator.serviceWorker.getRegistrations()).length), 10000)),
  ]));
  check('app worker installs and activates', state.startsWith('active:'), state);

  const source = readFileSync(join(ROOT, 'app/service-worker.js'), 'utf8');
  const listed = [...source.match(/const SHELL_ASSETS = \[([\s\S]*?)\];/)[1].matchAll(/'([^']+)'/g)].map((m) => new URL(m[1], BASE).href);
  const cached = await page.evaluate(async () => {
    const urls = [];
    for (const key of await caches.keys()) for (const req of await (await caches.open(key)).keys()) urls.push(req.url);
    return urls;
  });
  const uncached = listed.filter((u) => !cached.includes(u));
  check('every SHELL_ASSETS file is in the cache', uncached.length === 0, uncached.join(', ') || listed.length + ' files');

  await ctx.setOffline(true);
  await page.reload().catch((e) => console.log('offline reload failed: ' + e.message.split('\n')[0]));
  await page.waitForSelector('#app', { timeout: 5000 }).catch(() => {});
  const appText = await page.evaluate(() => (document.querySelector('#app')?.innerText || '').trim().length).catch(() => 0);
  check('/app/ renders offline', appText > 0, appText + ' characters in #app');

  await page.goto(BASE + 'settings.html').catch((e) => check('Settings navigates offline', false, e.message));
  const settingsTitle = await page.title().catch(() => '');
  check('Settings loads offline', /settings/i.test(settingsTitle), 'title: ' + settingsTitle);
  await ctx.close();
} finally {
  await browser.close();
  server.close();
}

if (notFound.length) console.log('404s during the run: ' + notFound.join(', '));
const failed = results.filter((ok) => !ok).length;
console.log(`\n${results.length - failed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
