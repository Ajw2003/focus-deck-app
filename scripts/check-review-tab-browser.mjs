// scripts/check-review-tab-browser.mjs -- the Review tab (#254) in real Chromium at 390x844 and 1440x900:
// badge count, one task at a time, the Looks good / More work stamps move it (slip Undo restores), Done this week and
// its Undo flag, All reviewed, the All | Area | Project switch, a title opens details.
// Usage: CHROMIUM=/opt/pw-browsers/chromium-1243/chrome-linux/chrome node scripts/check-review-tab-browser.mjs
// Serves the repo root on 127.0.0.1:8138. Screenshots: docs/generated/build-checks/step6/review-*.png
import { createRequire } from 'node:module';
import { mkdirSync, readFileSync, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import { join, extname, normalize } from 'node:path';
const require = createRequire('/opt/node22/lib/node_modules/');
const { chromium } = require('playwright');
const ROOT = fileURLToPath(new URL('..', import.meta.url));
const OUT = join(ROOT, 'docs/generated/build-checks/step6/');
mkdirSync(OUT, { recursive: true });
const BASE = 'http://127.0.0.1:8138/app/';
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
await new Promise((ok) => server.listen(8138, '127.0.0.1', ok));

const now = Date.now();
const t = (id, title, status, extra) => Object.assign({ id, title, status, updatedAt: now - 1000, order: 1, categoryIds: [] }, extra);
const seed = () => ({
  projects: [
    { id: 'p0', name: 'Home', color: '#3E8E5E', tasks: [t('r1', 'Check the quote', 'review', { updatedAt: now - 5000, order: 1 }), t('r2', 'Read the contract', 'review', { updatedAt: now - 2000, order: 2 }),
      t('d1', 'Painted the door', 'done', { completedAt: now - 3000, statusBeforeDone: 'doing' }), t('n1', 'Bins out', 'next')] },
    { id: 'p1', name: 'Work', color: '#4D6FB8', tasks: [t('r3', 'Review the draft', 'review', { updatedAt: now - 9000 })] },
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
  const text = async (sel) => ((await page.textContent(sel)) || '').replace(/\s+/g, ' ').trim();
  const badge = () => page.$eval('[data-screen="review"] .rail-count', (b) => b.textContent).catch(() => '0');
  const state = () => page.evaluate(() => JSON.parse(localStorage.getItem('focusdeck-state-v1')));
  const status = async (id) => (await state()).projects.flatMap((p) => p.tasks).find((x) => x.id === id).status;
  const titleNow = () => page.$eval('.rv-title', (e) => e.textContent).catch(() => '');
  const shot = (n) => page.screenshot({ path: OUT + 'review-' + (phone ? '390' : '1440') + '-' + n + '.png' });
  check(await badge() === '3', tag + 'badge shows 3', await badge());
  await page.click('[data-screen="review"]');
  await page.waitForSelector('.rv-card');
  // one task at a time, newest waiting first (#271)
  check(await titleNow() === 'Read the contract' && (await page.$$('.rv-card')).length === 1, tag + 'one task: the newest waiting', await titleNow());
  check((await page.$$('.sort-dots i')).length === 3 && (await page.getAttribute('.sort-dots', 'aria-label')) === 'Step 1 of 3', tag + 'three progress dots, first on');
  await shot('tab');
  // the switch filters the waiting task
  await page.click('.vs-tape'); await page.click('[data-action="view-step"][data-step="project"]');
  await page.click('[data-action="view-pick"][data-id="p1"]');
  check(await titleNow() === 'Review the draft', tag + 'switch to Work shows its task', await titleNow());
  await page.click('.vs-tape'); await page.click('.vs-pop .dk-choice[data-mode="all"]');
  check(await titleNow() === 'Read the contract', tag + 'All restores');
  // title opens details
  await page.click('.rv-title');
  await page.waitForSelector('.cw-detail');
  check((await page.$eval('.cw-detail h3', (h) => h.textContent)).includes('Read the contract'), tag + 'title opens Task details');
  await shot('details');
  await page.keyboard.press('Escape');
  // Looks good: done, the next task, the slip
  await page.click('[data-action="review-done"]');
  check(await status('r2') === 'done' && await titleNow() === 'Check the quote', tag + 'Looks good: r2 done, next task shows', await status('r2'));
  check((await text('.org-slip')) === 'Done ✓Undo' && await badge() === '2', tag + 'slip says Done ✓ / Undo, badge 2');
  await shot('after-done');
  await page.click('.org-slip [data-action="review-undo"]');
  check(await status('r2') === 'review' && await titleNow() === 'Read the contract' && !(await page.$('.org-slip')), tag + 'slip Undo puts r2 back in review');
  // More work: back to Doing, slip Sent back
  await page.click('[data-action="review-more"]');
  check(await status('r2') === 'doing' && (await text('.org-slip')) === 'Sent back ✓Undo', tag + 'More work: r2 doing, slip says Sent back ✓');
  await page.click('.org-slip [data-action="review-undo"]');
  check(await status('r2') === 'review', tag + 'slip Undo of More work puts r2 back in review');
  // Done this week: list, Undo flag restores the stored previous status, Back
  await page.click('[data-action="review-list"]');
  check((await page.$$eval('.rv-struck', (e) => e.map((x) => x.textContent).join())) === 'Painted the door', tag + 'Done this week lists d1 struck through');
  await shot('done-week');
  await page.click('.rv-done [data-action="review-undo"]');
  check(await status('d1') === 'doing' && (await page.$$('.rv-struck')).length === 0, tag + 'Undo flag restores d1 to Doing (its stored status)');
  await page.click('[data-action="review-back"]');
  check(await titleNow() === 'Read the contract', tag + 'Back returns to the clipboard');
  // all three stamped: All reviewed
  for (let i = 0; i < 3; i++) await page.click('[data-action="review-done"]');
  check((await text('.rv-none')) === 'All reviewed ✓' && !(await page.$('.rv-card')), tag + 'All reviewed ✓');
  await shot('empty');
  check(await badge() === '0', tag + 'no badge when nothing waits');
  await ctx.close();
}
await browser.close();
server.close();
console.log(bad ? bad + ' FAILED' : 'all passed');
process.exit(bad ? 1 : 0);
