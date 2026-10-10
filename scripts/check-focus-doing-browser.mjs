// scripts/check-focus-doing-browser.mjs -- "Mark in progress" under the sticky note on Focus (#146, part of #140).
// Usage: CHROMIUM=/opt/pw-browsers/chromium-1194/chrome-linux/chrome node scripts/check-focus-doing-browser.mjs
// Serves the repo root on 127.0.0.1:8137. Screenshots: docs/generated/pr140/focus-doing-*.png
import { createRequire } from 'node:module';
import { mkdirSync, readFileSync, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import { join, extname, normalize } from 'node:path';
const require = createRequire('/opt/node22/lib/node_modules/');
const { chromium } = require('playwright');
const ROOT = fileURLToPath(new URL('..', import.meta.url));
const OUT = join(ROOT, 'docs/generated/pr140/');
mkdirSync(OUT, { recursive: true });
const BASE = 'http://127.0.0.1:8137/app/';
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.png': 'image/png' };
const server = createServer((req, res) => {
  const rel = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname)).replace(/^[/\\]+/, '');
  let file = join(ROOT, rel);
  if (!file.startsWith(ROOT)) { res.writeHead(403); return res.end(); }
  if (existsSync(file) && statSync(file).isDirectory()) file = join(file, 'index.html');
  if (!existsSync(file)) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': TYPES[extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
  res.end(readFileSync(file));
});
await new Promise((ok) => server.listen(8137, '127.0.0.1', ok));
const t = (id, title, status, order) => ({ id, title, status, updatedAt: 1, order: order || 0, sortOrder: order || 0 });
const seed = {
  projects: [{ id: 'p0', name: 'Home', color: '#3E8E5E', tasks: [t('n1', 'Bins out', 'next', 1), t('n2', 'Mop the kitchen', 'next', 2), t('d1', 'Book boiler service', 'doing', 1)] }],
  categories: [], inbox: [], completedLog: [], deletedTaskIds: {}, choosingMode: { mode: 'twice', updatedAt: 1 },
  focus: { taskId: 'n2', startedAt: 1 },
};
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM, args: ['--no-sandbox'] });
let bad = 0;
const check = (ok, name) => { console.log((ok ? 'PASS ' : 'FAIL ') + name); if (!ok) bad++; };
for (const [tag, vp] of [['1440', { width: 1440, height: 900 }], ['390', { width: 390, height: 844 }]]) {
  const ctx = await browser.newContext({ viewport: vp, serviceWorkers: 'block', hasTouch: tag === '390' });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => { bad++; console.log('FAIL page error: ' + e.message); });
  await page.addInitScript((s) => {
    if (localStorage.getItem('seeded')) return;
    localStorage.setItem('seeded', '1');
    localStorage.setItem('focusdeck-onboarding', 'done'); localStorage.setItem('focusdeck-screen', 'focus');
    localStorage.setItem('focusdeck-state-v1', JSON.stringify(s));
  }, seed);
  await page.goto(BASE);
  await page.waitForSelector('.desk-focus');
  check(await page.locator('[data-action="focus-doing"]').count() === 1, tag + ': Mark in progress button shown for a next task');
  await page.screenshot({ path: OUT + 'focus-doing-' + tag + '.png' });
  await page.click('[data-action="focus-doing"]');
  await page.waitForTimeout(300);
  check(await page.locator('[data-action="focus-doing"]').count() === 0 && await page.locator('.focus-doing-mark').count() === 1, tag + ': button became the In progress marker');
  check((await page.locator('.focus-title').innerText()).includes('Mop the kitchen'), tag + ': task still in focus');
  check((await page.locator('.toast').allInnerTexts()).join(' ').includes('Moved to In progress'), tag + ': toast shown');
  const order = await page.evaluate(() => JSON.parse(localStorage.getItem('focusdeck-state-v1')).projects[0].tasks.filter((x) => x.status === 'doing').sort((a, b) => a.sortOrder - b.sortOrder).map((x) => x.id));
  check(order.join() === 'd1,n2', tag + ': lands at end of In progress (' + order + ')');
  await page.screenshot({ path: OUT + 'focus-doing-' + tag + '-marked.png' });
  await page.click('[data-screen="board"]:visible');
  await page.waitForSelector('.board-card');
  check(await page.locator('.board-card[data-task-id="n2"]').evaluate((e) => e.dataset.status) === 'doing', tag + ': Board shows the task in In progress');
  await ctx.close();
}
await browser.close(); server.close();
console.log(bad ? bad + ' FAILED' : 'all passed');
process.exit(bad ? 1 : 0);
