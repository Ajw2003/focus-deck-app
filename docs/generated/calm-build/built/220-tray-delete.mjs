// Shoots the real tray delete question (#220) on the seed Sort screen, light and dark, 390 wide.
// Run: CHROMIUM=... node docs/generated/calm-build/built/220-tray-delete.mjs
import { createRequire } from 'node:module';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { join, extname, normalize } from 'node:path';
const require = createRequire('/opt/node22/lib/node_modules/');
const { chromium } = require('playwright');
const OUT = new URL('./', import.meta.url).pathname;
const ROOT = join(OUT, '..', '..', '..', '..');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.woff2': 'font/woff2', '.svg': 'image/svg+xml' };
const server = createServer((req, res) => {
  const rel = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname)).replace(/^[/\\]+/, '');
  let file = join(ROOT, rel);
  if (existsSync(file) && statSync(file).isDirectory()) file = join(file, 'index.html');
  if (!existsSync(file)) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': TYPES[extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
  res.end(readFileSync(file));
});
await new Promise((ok) => server.listen(8254, '127.0.0.1', ok));
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM, args: ['--no-sandbox'] });
for (const scheme of ['light', 'dark']) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block', colorScheme: scheme });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.log('PAGE ERROR', e.message));
  await page.goto('http://127.0.0.1:8254/docs/generated/sort-steps/seed.html#sort');
  await page.click('[data-action="unsorted-delete"]');
  await page.waitForSelector('.move-dialog');
  await page.waitForTimeout(200);
  await page.screenshot({ path: OUT + '220-tray-delete-390-' + scheme + '.png' });
  console.log(scheme, await page.textContent('.move-dialog'));
  await ctx.close();
}
await browser.close(); server.close();
