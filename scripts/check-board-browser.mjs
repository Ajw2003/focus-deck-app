// scripts/check-board-browser.mjs -- the calm Board's actions in real Chromium (#145, #200: one tab at a
// time, seven cards at once, Show more, the move buttons; drag and swipe are gone), at 1440
// and 390 wide, dark and light: ticking, mouse drag between columns, keyboard moves (+ announcement,
// focus kept), phone finger swipes (far = moves, short = snaps back, vertical = scrolls the page),
// the moved state surviving a reload, and no sideways page scroll. Later Board steps can add to it.
// Usage: CHROMIUM=/opt/pw-browsers/chromium-1194/chrome-linux/chrome node scripts/check-board-browser.mjs
// Serves the repo root itself on 127.0.0.1:8136. Screenshots: docs/generated/pr140/board-action-*.png
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
const BASE = 'http://127.0.0.1:8136/app/';
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
await new Promise((ok) => server.listen(8136, '127.0.0.1', ok));

const t = (id, title, status, extra) => Object.assign({ id, title, status, updatedAt: 1, order: 0 }, extra);
const long = Array.from({ length: 22 }, (_, i) => t('l' + i, 'Garden job number ' + (i + 1), 'next', { order: i + 5 }));
const seed = {
  projects: [
    { id: 'p0', name: 'Home', color: '#3E8E5E', tasks: [t('n1', 'Bins out', 'next', { order: 1 }), t('n2', 'Mop the kitchen', 'next', { order: 2 }), t('n3', 'Fix the gate latch', 'next', { order: 3, priority: 'urgent', deadline: new Date(Date.now() + 3 * 864e5).toISOString().slice(0, 10), categoryIds: ['c1'] }),
      t('d1', 'Book boiler service', 'doing'), t('x1', 'Paint the hall', 'done', { completedAt: Date.now() - 1000 })].concat(long) },
    { id: 'p1', name: 'Garden', color: '#4D6FB8', tasks: [t('g1', 'Plant the bulbs', 'next', { order: 1 }), t('g2', 'Order compost', 'doing')] },
  ],
  categories: [{ id: 'c1', name: 'Repair', color: '#C2731E' }], inbox: [], completedLog: [], deletedTaskIds: {}, choosingMode: { mode: 'twice', updatedAt: 1 },
};

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM, args: ['--no-sandbox'] });
let bad = 0;
const check = (ok, name, extra) => { console.log((ok ? 'PASS ' : 'FAIL ') + name + (extra ? '  [' + extra + ']' : '')); if (!ok) bad++; };

for (const size of ['desk', 'phone']) for (const scheme of ['dark', 'light']) {
  const phone = size === 'phone';
  const tag = (phone ? '390 ' : '1440 ') + scheme + ': ';
  const ctx = await browser.newContext({ viewport: phone ? { width: 390, height: 844 } : { width: 1440, height: 900 }, colorScheme: scheme, serviceWorkers: 'block', hasTouch: phone });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => { bad++; console.log('FAIL page error: ' + e.message); });
  await page.addInitScript((s) => {
    if (localStorage.getItem('seeded')) return;
    localStorage.setItem('seeded', '1');
    localStorage.setItem('focusdeck-onboarding', 'done'); localStorage.setItem('focusdeck-screen', 'board');
    localStorage.setItem('focusdeck-state-v1', JSON.stringify(s));
    localStorage.setItem('focusdeck-board-project', 'p0'); // narrowed to Home: a small, predictable board
  }, seed);
  await page.goto(BASE);
  await page.waitForSelector('.board-card');
  const status = (id) => page.$eval('.board-card[data-task-id="' + id + '"]', (e) => e.dataset.status).catch(() => 'gone');
  const tabCount = (k) => page.$eval('.calm-tab[data-col="' + k + '"] b', (e) => Number(e.textContent));
  const noSideways = async (label) => check(!(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)), tag + 'no sideways scroll ' + label);
  const ids = () => page.$$eval('.board-card', (els) => els.map((e) => e.dataset.taskId));
  await noSideways('at rest');
  check((await page.$$('.board-grip, .board-col')).length === 0, tag + 'no drag grips or columns any more');

  // the priority and due date line (#211): shown with both, absent on a card with neither
  const line = await page.$eval('.board-card[data-task-id="n3"]', (e) => (e.querySelector('.gl-glance') || {}).textContent || '');
  check(line.includes('Urgent') && /due in/.test(line), tag + 'a card shows its priority and due date', line);
  check(!(await page.$('.board-card[data-task-id="n1"] .gl-glance')), tag + 'a card with neither has no line');
  await page.screenshot({ path: ROOT + 'docs/generated/calm-build/built/212-board-' + (phone ? '390' : '1440') + '-' + scheme + '.png', fullPage: false });

  // tabs, groups of 7, Show more
  check((await ids()).length === 7, tag + 'seven cards at once', (await ids()).length);
  await page.click('.calm-more');
  check((await ids()).length === 14, tag + 'Show more adds a group');

  // ticking
  const before = [await tabCount('next'), await tabCount('done')];
  await page.click('.board-card[data-task-id="n1"] input[type="checkbox"]');
  await page.waitForTimeout(300);
  check((await status('n1')) === 'gone' && (await tabCount('next')) === before[0] - 1 && (await tabCount('done')) === before[1] + 1, tag + 'ticking moves a card to Done', before + ' -> ' + [await tabCount('next'), await tabCount('done')]);
  const stamped = await page.evaluate(() => JSON.parse(localStorage.getItem('focusdeck-state-v1')).projects[0].tasks.find((x) => x.id === 'n1').completedAt);
  check(typeof stamped === 'number', tag + 'ticking stamps completedAt');

  // the move buttons
  await page.click('.board-card[data-task-id="n2"] .calm-move');
  await page.waitForTimeout(300);
  check((await status('n2')) === 'gone' && (await tabCount('doing')) === 3, tag + 'In progress button moves a card out of Up next');
  await page.click('.calm-tab[data-col="doing"]');
  check((await status('n2')) === 'doing', tag + 'the card is in In progress');
  await page.screenshot({ path: OUT + 'board-action-' + (phone ? '390' : '1440') + '-' + scheme + '-in-progress.png', fullPage: false });
  await page.click('.board-card[data-task-id="n2"] .calm-move');
  await page.waitForTimeout(300);
  await page.click('.calm-tab[data-col="next"]');
  check((await tabCount('doing')) === 2, tag + 'Up next button moves it back (it lands at the end of Up next)');
  await page.click('.board-card[data-task-id="n3"] .calm-move');
  await page.waitForTimeout(300);

  // survives a reload
  await page.reload(); await page.waitForSelector('.calm-tab');
  await page.click('.calm-tab[data-col="doing"]');
  check((await status('n3')) === 'doing' && (await status('d1')) === 'doing', tag + 'the moved state survives a reload');
  await page.click('.calm-tab[data-col="done"]');
  check((await status('n1')) === 'done', tag + 'the ticked card is still in Done after a reload');
  await noSideways('after reload');
  await ctx.close();
}
await browser.close(); server.close();
console.log(bad ? 'FAILED (' + bad + ')' : 'all board checks passed');
process.exit(bad ? 1 : 0);
