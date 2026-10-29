// Tray delete options: opens the seed Focus screen, finds the first tray thought, and shoots today's
// one-tap delete result, option A (an in-app "Delete?" card, the move dialog's look with a Delete
// button) and option B (deleted at once, with Undo on the notice). Light mode, 390 wide.
// Run: CHROMIUM=... node docs/generated/tray-delete/shoot.mjs
import { createRequire } from 'node:module';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { join, extname, normalize } from 'node:path';
const require = createRequire('/opt/node22/lib/node_modules/');
const { chromium } = require('playwright');
const OUT = new URL('./', import.meta.url).pathname;
const ROOT = join(OUT, '..', '..', '..');
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
const shots = [];
for (const [w, h, tag] of [[390, 844, '390'], [1440, 900, '1440']]) {
  for (const screen of ['focus', 'sort', 'board', 'projects', 'projects-form']) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, serviceWorkers: 'block', colorScheme: 'light' });
    const page = await ctx.newPage();
    page.on('pageerror', (e) => console.log('PAGE ERROR', screen, e.message));
    await page.goto('http://127.0.0.1:8254/docs/generated/sort-steps/seed.html#' + screen.replace('-form', ''));
    await page.waitForTimeout(800);
    if (screen === 'projects-form') { await page.locator('[data-action="open-add-task"]').first().click(); await page.waitForTimeout(300); }
    await page.screenshot({ path: OUT + 'before-' + screen + '-' + tag + '.png' });
    shots.push(screen + '-' + tag);
    await ctx.close();
  }
}
console.log('shot', shots.join(' '));
await browser.close(); server.close();
