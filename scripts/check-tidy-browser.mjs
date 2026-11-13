// scripts/check-tidy-browser.mjs -- Tidy up as tick lists (#266, was #255) in real Chromium at 390x844 and 1440x900: the four screens, ticks
// then a desk object marks, Close these?, the Confirm stamp closes only marked tasks in the chosen Area, the
// Closed slip and Undo, another area shows only its tasks, no page errors, no sideways scroll.
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
  const rows = () => page.$$eval('.org-row', (g) => g.map((x) => x.dataset.taskId).join());
  const step = (n) => page.click('[data-action="tidy-skip"][data-step="' + n + '"]');
  const tick = (id) => page.click('[data-tidy-tick="' + id + '"]');
  const obj = (m) => page.click('.dk-obj[data-mark="' + m + '"]');
  const noScroll = async (n) => check(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), tag + 'no sideways scroll ' + n);
  const pickArea = async (id) => { await page.click('.vs-tape'); await page.click('[data-action="view-step"][data-step="area"]'); await page.click('[data-action="view-pick"][data-id="' + id + '"]'); };
  const doneIds = () => page.evaluate(() => JSON.parse(localStorage.getItem('focusdeck-state-v1')).projects.flatMap((p) => p.tasks).filter((x) => x.status === 'done').map((x) => x.id).sort().join());
  const openTidy = async () => { await page.click('.rail-item[data-go="tidy"]'); await page.waitForSelector('.org'); await page.click('.dk-btn[data-action="tidy-step"]'); };
  await openTidy();
  check((await page.textContent('.sort-q')) === 'Finished?' && await rows() === 'h1,w1', tag + 'Finished? lists the two review tasks', await rows());
  await noScroll('finished'); await shot('finished');
  await step(2); check(await rows() === 'h2,w2', tag + 'Replaced? lists two', await rows());
  await step(3); check(await rows() === 'h3,w3', tag + 'The same? lists the older of each pair', await rows());
  await step(4); check(await rows() === 'h5,w5', tag + 'Still want it? lists two', await rows());
  await page.click('.rail-item[data-go="tidy"]');
  await pickArea('a1'); await page.click('.dk-btn[data-action="tidy-step"]');
  check(await rows() === 'h1', tag + 'Home shows only its Finished? task', await rows());
  // Home: close h1 (Finished?), keep h2, merge h3, close h5
  await tick('h1'); await obj('close');
  await tick('h2'); await obj('keep');
  await tick('h3'); await obj('merge');
  await tick('h5'); await obj('close');
  check((await page.textContent('.sort-q')) === 'Close these?' && (await page.$$('.org-plain')).length === 3, tag + 'Close these? lists h1, h3, h5 (not the kept one)');
  check((await page.textContent('.org-list')).includes('📎 Buy compost'), tag + 'the merged one has a paperclip');
  check(await doneIds() === '', tag + 'nothing closed before the Confirm stamp');
  await noScroll('close-these'); await shot('close-these');
  await page.click('[data-action="tidy-confirm"]');
  check(await page.isVisible('.tr-card') && (await page.textContent('.org-slip')).includes('Closed 3'), tag + 'the stamp leads to Triage with Closed 3');
  check(await doneIds() === 'h1,h3,h5', tag + 'it closed only the three Home marks', await doneIds());
  await noScroll('after-stamp'); await shot('after-stamp');
  await page.click('.org-slip [data-action="tidy-undo"]');
  check(await doneIds() === '' && !(await page.$('.org-slip')), tag + 'Undo brings them all back', await doneIds());
  await ctx.close();
}
await browser.close();
server.close();
console.log(bad ? bad + ' FAILED' : 'all passed');
process.exit(bad ? 1 : 0);
