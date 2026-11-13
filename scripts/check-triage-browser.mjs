// scripts/check-triage-browser.mjs -- Triage as cards (#266, was #256) in real Chromium at 390x844, 360x780 and 1440x900: the top
// three by the seven rules, Next and Later lists with Find, Move (down key, Alt+Arrow across the boundary, Done keeps the
// order), Reset, the view tape narrows, Focus "pick for me" opens the first Now task, no page errors, no sideways scroll.
// Usage: CHROMIUM=/opt/pw-browsers/chromium-1243/chrome-linux/chrome node scripts/check-triage-browser.mjs
// Serves the repo root on 127.0.0.1:8140. Screenshots: docs/generated/build-checks/step8/triage-*.png
import { createRequire } from 'node:module';
import { mkdirSync, readFileSync, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import { join, extname, normalize } from 'node:path';
const require = createRequire('/opt/node22/lib/node_modules/');
const { chromium } = require('playwright');
const ROOT = fileURLToPath(new URL('..', import.meta.url));
const OUT = join(ROOT, 'docs/generated/build-checks/step8/');
mkdirSync(OUT, { recursive: true });
const BASE = 'http://127.0.0.1:8140/app/';
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
await new Promise((ok) => server.listen(8140, '127.0.0.1', ok));

const D = 864e5, now = Date.now();
const day = (n) => { const d = new Date(now + n * D); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
const t = (id, extra) => Object.assign({ id, title: 'Task ' + id, status: 'next', updatedAt: now - D, order: 1, categoryIds: [] }, extra);
// Expected order (all): rev1 doing1 past1 | urgent1 high1 holdsA soon1 plain1 w1 plain2 plain3 | plain4 low1 low2
const seed = () => ({
  projectCategories: [{ id: 'a1', name: 'Home', color: '#3E8E5E' }, { id: 'a2', name: 'Work', color: '#4D6FB8' }],
  projects: [
    { id: 'p0', name: 'Garden', color: '#3E8E5E', categoryId: 'a1', tasks: [
      t('low1', { priority: 'low' }), t('plain1'), t('soon1', { deadline: day(5) }), t('holdsA'), t('high1', { priority: 'high' }),
      t('urgent1', { priority: 'urgent' }), t('past1', { deadline: day(-2) }), t('doing1', { status: 'doing' }), t('rev1', { status: 'review' })] },
    { id: 'p1', name: 'Office', color: '#4D6FB8', categoryId: 'a2', tasks: [
      t('w1', { waitsOn: ['holdsA'] }), t('plain2'), t('plain3'), t('plain4'), t('low2', { priority: 'low' })] },
  ],
  categories: [], inbox: [], completedLog: [], deletedTaskIds: {}, choosingMode: { mode: 'twice', updatedAt: 1 },
});
const BASE_ORDER = 'rev1,doing1,past1,urgent1,high1,holdsA,soon1,plain1,w1,plain2,plain3,plain4,low1,low2';
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM, args: ['--no-sandbox'] });
let bad = 0;
const check = (ok, name, extra) => { console.log((ok ? 'PASS ' : 'FAIL ') + name + (extra ? '  [' + extra + ']' : '')); if (!ok) bad++; };
for (const [w, h] of [[390, 844], [360, 780], [1440, 900]]) {
  const tag = w + ': ';
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, serviceWorkers: 'block', hasTouch: w < 900 });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => { bad++; console.log('FAIL page error: ' + e.message); });
  await page.addInitScript((s) => {
    if (localStorage.getItem('seeded')) return;
    localStorage.setItem('seeded', '1');
    localStorage.setItem('focusdeck-onboarding', 'done');
    localStorage.setItem('focusdeck-state-v1', JSON.stringify(s));
  }, seed());
  await page.goto(BASE);
  await page.waitForSelector('.rail');
  const shot = (n) => page.screenshot({ path: OUT + 'triage-' + w + '-' + n + '.png' });
  const cards = () => page.$$eval('.tr-card', (r) => r.map((x) => x.dataset.task).join());
  const rowsOf = () => page.$$eval('.tr-row', (r) => r.map((x) => x.dataset.taskId).join());
  const noScroll = async (n) => check(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), tag + 'no sideways scroll ' + n);
  const pickArea = async (id) => { await page.click('.vs-tape'); await page.click('[data-action="view-step"][data-step="area"]'); await page.click('[data-action="view-pick"][data-id="' + id + '"]'); };
  const goTriage = async () => { await page.click('.rail-item[data-go="tidy"]'); await page.waitForSelector('.org'); await page.click('[data-action="triage-go"][data-to="top"]'); await page.waitForSelector('.tr-card'); };
  await goTriage();
  check((await page.textContent('.sort-q')) === 'Do these first' && await cards() === 'rev1,doing1,past1', tag + 'top three by the seven rules', await cards());
  check((await page.textContent('.sort-row2')).replace(/\s+/g, ' ') === 'Next 8Later 3', tag + 'Next 8 and Later 3 flags');
  await noScroll('top'); await shot('top');
  await page.click('[data-action="triage-go"][data-to="next"]');
  check(await cards() === 'urgent1,high1,holdsA,soon1,plain1,w1,plain2,plain3', tag + 'Next lists the following eight', await cards());
  await noScroll('next'); await shot('next');
  await page.click('.dk-back'); await page.click('[data-action="triage-later"]');
  check(await cards() === 'plain4,low1,low2', tag + 'Later lists the rest', await cards());
  await page.fill('[data-triage-find]', 'low');
  check(await cards() === 'low1,low2', tag + 'Find narrows Later', await cards());
  await noScroll('later'); await shot('later');
  await page.click('.dk-back');
  // Move: the down key saves at once
  await page.click('.dk-btn[data-to="move"]');
  check(await rowsOf() === 'rev1,doing1,past1', tag + 'Move opens on the top three', await rowsOf());
  await page.click('.tr-row[data-task-id="rev1"] [data-dir="1"]');
  check(await rowsOf() === 'doing1,rev1,past1', tag + 'the down key swaps the first two', await rowsOf());
  await noScroll('move'); await shot('move');
  await page.focus('.tr-row[data-task-id="past1"]');
  await page.keyboard.press('Alt+ArrowDown');
  await page.click('.dk-btn[data-to="top"]');
  check(await cards() === 'doing1,rev1,urgent1', tag + 'Alt+Down crosses the boundary and Done keeps the new order', await cards());
  await page.click('.dk-btn[data-to="move"]');
  await page.click('.tr-reset');
  check(await cards() === 'rev1,doing1,past1', tag + 'Reset goes back to the rules', await cards());
  // view tape
  await pickArea('a1');
  check(await cards() === 'rev1,doing1,past1' && (await page.textContent('.sort-row2')).replace(/\s+/g, ' ') === 'Next 6Later 0', tag + 'Home shows only its nine', await page.textContent('.sort-row2'));
  await noScroll('area'); await shot('area');
  // Focus: pick for me opens the first Now task
  await page.click('[data-screen="focus"]');
  await page.click('[data-action="pick-for-me"]');
  const picked = await page.evaluate(() => JSON.parse(localStorage.getItem('focusdeck-state-v1')).focus.taskId);
  check(picked === 'rev1', tag + 'pick for me opens a first Now task', picked);
  await ctx.close();
}
await browser.close();
server.close();
console.log(bad ? bad + ' FAILED' : 'all passed');
process.exit(bad ? 1 : 0);
