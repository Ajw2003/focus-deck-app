// scripts/check-review-tab-browser.mjs -- the Review tab (#254) in real Chromium at 390x844 and 1440x900:
// badge count, "Looks good · Done" and "Needs more work" move the task (and it shows in the Board's matching
// column), Undo restores the old status, the All | Area | Project switch filters both lists, a title opens details.
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
  const badge = () => page.$eval('[data-screen="review"] .rail-count', (b) => b.textContent).catch(() => '0');
  const ids = (list) => page.$$eval('[data-list="' + list + '"] .rv-card', (e) => e.map((x) => x.dataset.taskId).join());
  const shot = (n) => page.screenshot({ path: OUT + 'review-' + (phone ? '390' : '1440') + '-' + n + '.png' });
  check(await badge() === '3', tag + 'badge shows 3', await badge());
  await page.click('[data-screen="review"]');
  await page.waitForSelector('.rv-cols');
  check(await ids('waiting') === 'r2,r1,r3', tag + 'waiting newest first', await ids('waiting'));
  check(await ids('done') === 'd1', tag + 'done this week', await ids('done'));
  await shot('tab');
  // the switch filters both lists
  await page.click('.vs-tape'); await page.click('[data-action="view-step"][data-step="project"]'); // the view tape
  await page.click('[data-action="view-pick"][data-id="p1"]');
  check(await ids('waiting') === 'r3' && await ids('done') === '', tag + 'switch to Work filters both lists', await ids('waiting') + '|' + await ids('done'));
  await page.click('.vs-tape'); await page.click('.vs-pop .dk-choice[data-mode="all"]');
  check(await ids('waiting') === 'r2,r1,r3', tag + 'All restores');
  // title opens details
  await page.click('.rv-card[data-task-id="r1"] .rv-title');
  await page.waitForSelector('.cw-detail');
  check((await page.$eval('.cw-detail h3', (h) => h.textContent)).includes('Check the quote'), tag + 'title opens Task details');
  await shot('details');
  await page.keyboard.press('Escape');
  // Looks good · Done
  await page.click('.rv-card[data-task-id="r1"] [data-action="review-done"]');
  check(await ids('waiting') === 'r2,r3' && (await ids('done')).includes('r1'), tag + 'Looks good moves r1 to Done this week', await ids('done'));
  check(await badge() === '2', tag + 'badge is 2', await badge());
  await shot('after-done');
  // Needs more work
  await page.click('.rv-card[data-task-id="r2"] [data-action="review-more"]');
  check(await ids('waiting') === 'r3', tag + 'Needs more work removes r2 from the list');
  // the Board's columns are inside each milestone on the Roadmap (#259): open Home's project view, look in the column, switch back to All
  const col = async (c, id) => { await page.click('[data-screen="projects"]'); await page.click('.pj-card[data-project="p0"]'); await page.waitForSelector('.rm-project'); const ok = (await page.$$('.rm-col[data-status="' + c + '"] .rm-task[data-task-id="' + id + '"]')).length === 1; return ok; };
  check(await col('doing', 'r2'), tag + 'r2 is in the Roadmap In progress column');
  check(await col('done', 'r1'), tag + 'r1 is in the Roadmap Done column');
  await page.click('[data-screen="review"]');
  // Undo: r1 was in review before done; d1 was doing
  await page.click('.rv-card[data-task-id="r1"] [data-action="review-undo"]');
  check((await ids('waiting')).split(',').includes('r1') && !(await ids('done')).includes('r1'), tag + 'Undo puts r1 back in review', await ids('waiting'));
  await page.click('.rv-card[data-task-id="d1"] [data-action="review-undo"]');
  check(await col('doing', 'd1'), tag + 'Undo restores d1 to In progress (its stored status)');
  await page.click('[data-screen="review"]');
  await page.click('.vs-tape'); await page.click('.vs-pop .dk-choice[data-mode="all"]'); // the Roadmap keeps one project in view, so Everything is picked here
  await page.click('.rv-card[data-task-id="r3"] [data-action="review-done"]');
  await page.click('.rv-card[data-task-id="r1"] [data-action="review-done"]');
  await page.waitForSelector('[data-list="waiting"] .calm-empty');
  await shot('empty');
  check(await badge() === '0', tag + 'no badge when nothing waits');
  await ctx.close();
}
await browser.close();
server.close();
console.log(bad ? bad + ' FAILED' : 'all passed');
process.exit(bad ? 1 : 0);
