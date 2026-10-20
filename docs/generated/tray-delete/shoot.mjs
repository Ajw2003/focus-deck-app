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
await new Promise((ok) => server.listen(8253, '127.0.0.1', ok));
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM, args: ['--no-sandbox'] });
for (const name of ['before', 'now', 'a', 'b']) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block', colorScheme: 'light' });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.log('PAGE ERROR', name, e.message));
  await page.goto('http://127.0.0.1:8253/docs/generated/sort-steps/seed.html#sort');
  const del = page.locator('[data-action="unsorted-delete"]').first();
  await del.waitFor({ timeout: 8000 });
  const text = await page.evaluate(() => {
    const id = document.querySelector('[data-action="unsorted-delete"]').getAttribute('data-inbox');
    return document.querySelector('.jot-slip .slip-text').textContent;
  });
  if (name === 'now' || name === 'b') await del.click();
  if (name === 'a') {
    await page.evaluate((t) => {
      const d = document.createElement('div');
      d.innerHTML = '<div class="move-dialog-backdrop"><div class="move-dialog" role="dialog"><p class="move-dialog-text">Delete "' + t + '"? It leaves the tray for good.</p>'
        + '<div class="move-dialog-actions"><button type="button" class="btn-text">Cancel</button><button type="button" class="btn primary">Delete</button></div></div></div>';
      document.body.appendChild(d.firstElementChild);
    }, text);
  }
  if (name === 'b') {
    await page.waitForSelector('.toast');
    await page.evaluate(() => {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'btn ghost'; b.textContent = 'Undo';
      b.style.cssText = 'margin-left:auto;margin-right:6px;padding:6px 14px;font-weight:700';
      document.querySelector('.toast .toast-close').before(b);
    });
  }
  await page.waitForTimeout(250);
  await page.screenshot({ path: OUT + name + '-390.png' });
  console.log(name, JSON.stringify(text), 'toast:', await page.$eval('.toast', (e) => e.textContent).catch(() => '-'));
  await ctx.close();
}
await browser.close(); server.close();
