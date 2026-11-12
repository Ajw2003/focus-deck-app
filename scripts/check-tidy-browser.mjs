// scripts/check-tidy-browser.mjs -- Tidy up (#255) in real Chromium at 390x844 and 1440x900: the four groups and
// counts, Keep/Close/Merge marks, the "N → M" number, Confirm closes only marked tasks in the chosen Area, the
// Closed list and Undo, another area shows only its tasks, no page errors, no sideways scroll.
// Usage: CHROMIUM=/opt/pw-browsers/chromium-1243/chrome-linux/chrome node scripts/check-tidy-browser.mjs
// Serves the repo root on 127.0.0.1:8139. Screenshots: docs/generated/build-checks/step7/tidy-*.png
import { createRequire } from 'node:module';
import { mkdirSync, readFileSync, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import { join, extname, normalize } from 'node:path';
const require = createRequire('/opt/node22/lib/node_modules/');
const { chromium } = require('playwright');
const ROOT = fileURLToPath(new URL('..', import.meta.url));
const OUT = join(ROOT, 'docs/generated/build-checks/step7/');
mkdirSync(OUT, { recursive: true });
const BASE = 'http://127.0.0.1:8139/app/';
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
await new Promise((ok) => server.listen(8139, '127.0.0.1', ok));

const now = Date.now();
const D = 864e5;
const t = (id, title, extra) => Object.assign({ id, title, status: 'next', updatedAt: now - D, order: 1, categoryIds: [] }, extra);
const seed = () => ({
  projectCategories: [{ id: 'a1', name: 'Home', color: '#3E8E5E' }, { id: 'a2', name: 'Work', color: '#4D6FB8' }],
  projects: [
    { id: 'p0', name: 'Garden', color: '#3E8E5E', categoryId: 'a1', tasks: [
      t('h1', 'Built the shed plan', { status: 'review' }), t('h2', 'Old fence plan, replaced by new fence plan'),
      t('h3', 'Buy compost!!', { updatedAt: now - 4 * D }), t('h4', 'buy compost', { updatedAt: now - 1 * D }),
      t('h5', 'Forgotten pond', { updatedAt: now - 70 * D }), t('h6', 'Fresh task')] },
    { id: 'p1', name: 'Office', color: '#4D6FB8', categoryId: 'a2', tasks: [
      t('w1', 'Draft built', { status: 'review' }), t('w2', 'Superseded by the new template'),
      t('w3', 'Send invoice', { updatedAt: now - 3 * D }), t('w4', 'send invoice.', { updatedAt: now - 1 * D }),
      t('w5', 'Dusty idea', { updatedAt: now - 90 * D })] },
  ],
  categories: [], inbox: [], completedLog: [], deletedTaskIds: {}, choosingMode: { mode: 'twice', updatedAt: 1 },
});
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
    localStorage.setItem('focusdeck-onboarding', 'done');
    localStorage.setItem('focusdeck-state-v1', JSON.stringify(s));
  }, seed());
  await page.goto(BASE);
  await page.waitForSelector('.rail');
  const shot = (n) => page.screenshot({ path: OUT + 'tidy-' + (phone ? '390' : '1440') + '-' + n + '.png' });
  const counts = () => page.$$eval('.td-group', (g) => g.map((x) => x.dataset.group + ':' + x.querySelectorAll('.td-row').length).join());
  const nums = () => page.$eval('[data-open]', (e) => e.textContent.replace(/\s+/g, ' ').replace(' becomes', '').trim());
  const mark = (id, m) => page.click('.td-row[data-task-id="' + id + '"] [data-mark="' + m + '"]');
  const noScroll = async (n) => check(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), tag + 'no sideways scroll ' + n);
  const pickArea = async (id) => { await page.click('[data-action="view-mode"][data-mode="area"]'); await page.click('[data-action="view-pick"][data-id="' + id + '"]'); };
  const doneIds = () => page.evaluate(() => JSON.parse(localStorage.getItem('focusdeck-state-v1')).projects.flatMap((p) => p.tasks).filter((x) => x.status === 'done').map((x) => x.id).sort().join());
  await page.click('[data-screen="tidy"]');
  await page.waitForSelector('.td-layout');
  check((await page.textContent('.board-title')) === 'Tidy up: All', tag + 'title says All');
  check(await counts() === 'review:2,replaced:2,same:2,stale:2', tag + 'four groups, two each', await counts());
  check(await nums() === '11 → 11', tag + 'open 11 → 11', await nums());
  await noScroll('tab'); await shot('tab');
  await pickArea('a1');
  check(await counts() === 'review:1,replaced:1,same:1,stale:1', tag + 'Home shows only its tasks', await counts());
  check((await page.textContent('.board-title')) === 'Tidy up: Home', tag + 'title says Home');
  await mark('h1', 'close'); await mark('h2', 'keep'); await mark('h3', 'merge'); await mark('h5', 'close');
  check((await page.$$('.td-btn.is-marked')).length === 4, tag + 'four marks visible');
  check(await nums() === '6 → 3', tag + 'N → M is 6 → 3', await nums());
  check((await page.textContent('.td-confirm')) === 'Confirm 3, then Triage', tag + 'Confirm 3, then Triage');
  await mark('h5', 'close');
  check((await page.textContent('.td-confirm')) === 'Confirm 2, then Triage', tag + 'pressing again unmarks');
  await mark('h5', 'close');
  check(await doneIds() === '', tag + 'nothing closed before Confirm');
  await noScroll('marked'); await shot('marked');
  // a mark made in Work must survive a Confirm in Home
  await pickArea('a2'); await mark('w1', 'close');
  await pickArea('a1');
  await page.click('.td-confirm');
  check(await page.isVisible('.tr-layout'), tag + 'Confirm leads to Triage');
  await page.click('[data-screen="tidy"]');
  check(await doneIds() === 'h1,h3,h5', tag + 'Confirm closed only the three Home marks', await doneIds());
  check(await counts() === 'replaced:1', tag + 'closed tasks leave the groups', await counts());
  check((await page.$$('.td-closed .td-row')).length === 3, tag + 'Closed list has 3');
  await noScroll('after-confirm'); await shot('after-confirm');
  await page.click('.td-closed [data-task="h1"]');
  check((await counts()).startsWith('review:1'), tag + 'Undo puts h1 back in review', await counts());
  check((await page.$$('.td-closed .td-row')).length === 2 && await doneIds() === 'h3,h5', tag + 'Closed list has 2, h1 open again', await doneIds());
  await noScroll('closed-undo'); await shot('closed-undo');
  await pickArea('a2');
  check(await counts() === 'review:1,replaced:1,same:1,stale:1', tag + 'Work shows its tasks', await counts());
  check((await page.$$('.td-row[data-task-id^="h"]')).length === 0, tag + 'no Home task in Work');
  check((await page.textContent('.td-confirm')) === 'Confirm 1, then Triage', tag + 'Work keeps its own mark');
  await ctx.close();
}
await browser.close();
server.close();
console.log(bad ? bad + ' FAILED' : 'all passed');
process.exit(bad ? 1 : 0);
