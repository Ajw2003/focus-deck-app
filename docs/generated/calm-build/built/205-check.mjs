// #205 check: run from the repo root: node docs/generated/calm-build/built/205-check.mjs  (serves the repo on :8205)
import { createRequire } from 'node:module';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { join, extname, normalize } from 'node:path';
const require = createRequire('/opt/node22/lib/node_modules/');
const { chromium } = require('playwright');
const ROOT = process.cwd();
const T = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' };
const srv = createServer((q, r) => { let f = join(ROOT, normalize(decodeURIComponent(new URL(q.url, 'http://x').pathname)).replace(/^[/\\]+/, '')); if (existsSync(f) && statSync(f).isDirectory()) f = join(f, 'index.html'); if (!existsSync(f)) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'Content-Type': T[extname(f)] || 'application/octet-stream', 'Cache-Control': 'no-store' }); r.end(readFileSync(f)); });
await new Promise((ok) => srv.listen(8205, '127.0.0.1', ok));
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] });
let bad = 0; const ck = (n, ok, x = '') => { if (!ok) bad++; console.log((ok ? 'PASS ' : 'FAIL ') + n + (x ? ' [' + x + ']' : '')); };
for (const w of [1440, 390]) {
  const ctx = await b.newContext({ viewport: { width: w, height: 900 }, serviceWorkers: 'block' });
  const page = await ctx.newPage(); const errs = [];
  page.on('pageerror', (e) => errs.push(e.message)); page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
  await page.goto('http://127.0.0.1:8205/docs/generated/sort-steps/seed.html#sort'); await page.waitForSelector('.jot-slip'); await page.waitForTimeout(600);
  await page.click('.step-tab[data-step="3"]', { force: true });
  ck(`${w} locked step says why`, ((await page.textContent('.step-why').catch(() => '')) || '').startsWith('Choose a project first. Labels and links open once the thought has a project.'));
  const ctxOpens = async (sel) => { const box = await (await page.$(sel)).boundingBox(); await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2, { button: 'right' }); const n = await page.$$eval('body > input[type=color]', (e) => e.length); await page.evaluate(() => document.querySelectorAll('body > input[type=color]').forEach((e) => e.remove())); return n; };
  const pk = await page.$eval('[data-wallet="tray-folders"] .sleeve', (e) => e.dataset.key);
  await page.$eval(`[data-wallet="tray-folders"] .sleeve[data-key="${pk}"] .icard`, (e) => e.scrollIntoView({ block: 'center', inline: 'center' })); await page.waitForTimeout(400);
  ck(`${w} right-click project card opens picker`, (await ctxOpens(`[data-wallet="tray-folders"] .sleeve[data-key="${pk}"] .icard`)) === 1);
  const box = await (await page.$(`[data-wallet="tray-folders"] .sleeve[data-key="${pk}"] .icard`)).boundingBox();
  for (let i = 0; i < 2 && await page.$('.step-tab.locked'); i++) { const bx = await (await page.$(`[data-wallet="tray-folders"] .sleeve[data-key="${pk}"] .icard`)).boundingBox(); await page.mouse.click(bx.x + bx.width / 2, bx.y + bx.height / 2); await page.waitForTimeout(600); }
  await page.click('.step-tab[data-step="2"]'); await page.waitForSelector('[data-wallet="tray-flags"]'); await page.waitForTimeout(400);
  const lk = await page.$$eval('[data-wallet="tray-flags"] .sleeve', (els) => (els.find((e) => !e.dataset.key.startsWith('kind:') && !e.dataset.key.includes('more')) || { dataset: {} }).dataset.key);
  if (lk) { await page.$eval(`[data-wallet="tray-flags"] .sleeve[data-key="${lk}"] .icard`, (e) => e.scrollIntoView({ block: 'center', inline: 'center' })); await page.waitForTimeout(400);
    ck(`${w} right-click label card opens picker`, (await ctxOpens(`[data-wallet="tray-flags"] .sleeve[data-key="${lk}"] .icard`)) === 1, lk); } else ck(`${w} label card found`, false);
  await page.click('.step-tab[data-step="3"]'); await page.waitForTimeout(200);
  ck(`${w} step 3 header tappable`, await page.$eval('.step-tab[data-step="3"]', (e) => e.classList.contains('now')));
  await page.click('.step-tab[data-step="1"]'); await page.waitForTimeout(200);
  await page.click('[data-action="sort-add-notes"]'); await page.fill('.slip-notes', Array.from({ length: 14 }, (_, i) => 'note line ' + i).join('\n'));
  await page.waitForTimeout(200);
  const g = await page.evaluate(() => { const t = document.querySelector('.slip-notes'), l = document.querySelector('.tray-lip'); return { notesBottom: t.getBoundingClientRect().bottom, lipTop: l.getBoundingClientRect().top, sh: t.scrollHeight, ch: t.clientHeight }; });
  ck(`${w} notes end above the lip`, g.notesBottom <= g.lipTop + 1, JSON.stringify(g));
  ck(`${w} no sideways scroll`, await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  ck(`${w} no page/console errors`, errs.length === 0, errs.join(' | '));
  await page.$eval('.tray', (e) => e.scrollIntoView({ block: 'center' })); await page.screenshot({ path: `docs/generated/calm-build/built/205-sort-${w}.png` });
  await ctx.close();
}
await b.close(); srv.close(); process.exit(bad ? 1 : 0);
