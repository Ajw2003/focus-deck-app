// scripts/check-review-status-browser.mjs -- Review as the fourth status (#250) in real Chromium at 390x844 and
// 1440x900: one task moved Up next > In progress > Review > Done > Review > In progress > Up next on the Board
// (seen in the right tab each time), then in its project card's Review group.
// Usage: CHROMIUM=/opt/pw-browsers/chromium-1243/chrome-linux/chrome node scripts/check-review-status-browser.mjs
// Serves the repo root on 127.0.0.1:8137. Screenshots: docs/generated/build-checks/step2/review-*.png
import { createRequire } from 'node:module';
import { mkdirSync, readFileSync, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import { join, extname, normalize } from 'node:path';
const require = createRequire('/opt/node22/lib/node_modules/');
const { chromium } = require('playwright');
const ROOT = fileURLToPath(new URL('..', import.meta.url));
const OUT = join(ROOT, 'docs/generated/build-checks/step2/');
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

const t = (id, title, status, extra) => Object.assign({ id, title, status, updatedAt: 1, order: 0 }, extra);
const seed = {
  projects: [{ id: 'p0', name: 'Home', color: '#3E8E5E', tasks: [t('n1', 'Bins out', 'next', { order: 1 }), t('r1', 'Check the quote', 'review', { order: 1 })] }],
  categories: [], inbox: [], completedLog: [], deletedTaskIds: {}, choosingMode: { mode: 'twice', updatedAt: 1 },
};
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM, args: ['--no-sandbox'] });
let bad = 0;
const check = (ok, name, extra) => { console.log((ok ? 'PASS ' : 'FAIL ') + name + (extra ? '  [' + extra + ']' : '')); if (!ok) bad++; };
for (const phone of [true, false]) {
  const tag = phone ? '390: ' : '1440: ';
  const ctx = await browser.newContext({ viewport: phone ? { width: 390, height: 844 } : { width: 1440, height: 900 }, serviceWorkers: 'block', hasTouch: phone });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => { bad++; console.log('FAIL page error: ' + e.message); });
  await page.addInitScript((s) => {
    if (localStorage.getItem('seeded')) return;
    localStorage.setItem('seeded', '1');
    localStorage.setItem('focusdeck-onboarding', 'done'); localStorage.setItem('focusdeck-screen', 'board');
    localStorage.setItem('focusdeck-state-v1', JSON.stringify(s));
  }, seed);
  await page.goto(BASE);
  await page.waitForSelector('.board-card');
  const tabs = await page.$$eval('.calm-tab', (e) => e.map((x) => x.dataset.col));
  check(tabs.join() === 'next,doing,review,done', tag + 'tabs in order', tabs.join());
  const where = async (k) => { await page.click('.calm-tab[data-col="' + k + '"]'); return (await page.$$('.board-card[data-task-id="n1"]')).length === 1; };
  const shot = (n) => page.screenshot({ path: OUT + 'review-' + (phone ? '390' : '1440') + '-' + n + '.png' });
  const move = (to) => page.click('.board-card[data-task-id="n1"] [data-action="board-move"][data-to="' + to + '"]');
  await move('doing');
  check(await where('doing'), tag + 'Up next > In progress: card is in In progress');
  await move('review');
  check(await where('review'), tag + 'In progress > Review: card is in Review');
  await shot('board-review');
  await page.click('.board-card[data-task-id="n1"] input[type=checkbox]');
  check(await where('done'), tag + 'Review > Done: card is in Done');
  await page.click('.board-card[data-task-id="n1"]');
  await page.selectOption('[data-detail-status]', 'review');
  await page.keyboard.press('Escape'); // phones: the panel covers the list
  check(await where('review'), tag + 'Done > Review (Task details menu): card is in Review');
  await move('doing');
  check(await where('doing'), tag + 'Review > In progress: card is in In progress');
  await move('next');
  check(await where('next'), tag + 'In progress > Up next: card is in Up next');
  await shot('board-next');
  await page.reload();
  await page.waitForSelector('.board-card');
  await page.click('.calm-tab[data-col="review"]');
  await shot('review-tab');
  // project card Review group (r1 is in Review from the seed)
  await page.evaluate(() => localStorage.setItem('focusdeck-screen', 'projects'));
  await page.reload();
  await page.waitForSelector('.project-card');
  const groups = await page.$$eval('.project-card .task-group', (g) => g.map((x) => x.dataset.group + ':' + x.querySelectorAll('.task-row').length));
  check(groups.join() === 'doing:0,review:1,next:1', tag + 'project card groups', groups.join());
  await shot('project-card');
  await ctx.close();
}
await browser.close(); server.close();
console.log(bad ? bad + ' FAILED' : 'ALL PASSED');
process.exit(bad ? 1 : 0);
