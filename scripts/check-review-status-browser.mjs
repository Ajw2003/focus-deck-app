// scripts/check-review-status-browser.mjs -- Review as the fourth status (#250) in real Chromium at 390x844 and
// 1440x900: one task moved Up next > In progress > Review > Done > Review > In progress > Up next across the Roadmap's columns
// (seen in the right column each time), then the Review tab, then a second task dragged / stepped in and out of Review.
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
    localStorage.setItem('focusdeck-onboarding', 'done'); localStorage.setItem('focusdeck-screen', 'roadmap'); localStorage.setItem('focusdeck-view', JSON.stringify({ mode: 'project', id: 'p0' }));
    localStorage.setItem('focusdeck-state-v1', JSON.stringify(s));
  }, seed);
  await page.goto(BASE);
  await page.waitForSelector('.rm-ms.is-open');
  const ORDER = ['next', 'doing', 'review', 'done'];
  const cols = await page.$$eval('.rm-ms.is-open .rm-col', (e) => e.map((x) => x.dataset.status));
  check(cols.join() === 'next,doing,review,done', tag + 'columns in order', cols.join());
  // each status is a Roadmap column (the Board's tabs became the milestone's columns)
  const where = async (k, id = 'n1') => (await page.$$('.rm-col[data-status="' + k + '"] .rm-task[data-task-id="' + id + '"]')).length === 1;
  const shot = (n) => page.screenshot({ path: OUT + 'review-' + (phone ? '390' : '1440') + '-' + n + '.png' });
  // a phone moves with the arrow buttons (its grips are hidden); a computer with Alt+Left / Alt+Right on the grip
  const show = async (id) => { if (phone) await page.click('.rm-ms.is-open .rm-coltab[data-col="' + (await page.$eval('.rm-task[data-task-id="' + id + '"]', (e) => e.closest('.rm-col').dataset.status)) + '"]'); };
  const step = async (id, dir) => {
    if (phone) {
      const col = await page.$eval('.rm-task[data-task-id="' + id + '"]', (e) => e.closest('.rm-col').dataset.status);
      await page.click('.rm-ms.is-open .rm-coltab[data-col="' + col + '"]'); // one column shows at a time on a phone
      await page.click('.rm-task[data-task-id="' + id + '"] [data-action="rm-task-step"][data-dir="' + dir + '"]');
    } else { await page.focus('.rm-task[data-task-id="' + id + '"] .rm-grip'); await page.keyboard.press(dir > 0 ? 'Alt+ArrowRight' : 'Alt+ArrowLeft'); }
  };
  const move = async (id, from, to) => { const d = Math.sign(ORDER.indexOf(to) - ORDER.indexOf(from)); for (let i = ORDER.indexOf(from); i !== ORDER.indexOf(to); i += d) await step(id, d); };
  await move('n1', 'next', 'doing');
  check(await where('doing'), tag + 'Up next > In progress: card is in In progress');
  await move('n1', 'doing', 'review');
  check(await where('review'), tag + 'In progress > Review: card is in Review');
  await shot('board-review');
  await show('n1');
  await page.click('.rm-task[data-task-id="n1"] input[type=checkbox]');
  check(await where('done'), tag + 'Review > Done: card is in Done');
  await show('n1');
  await page.click('.rm-task[data-task-id="n1"] .rm-task-title');
  await page.click('.cw-detail [data-action="detail-status-open"]'); await page.click('.sort-drawer [data-action="detail-status"][data-status="review"]');
  await page.keyboard.press('Escape'); // phones: the panel covers the list
  check(await where('review'), tag + 'Done > Review (Task details menu): card is in Review');
  await move('n1', 'review', 'doing');
  check(await where('doing'), tag + 'Review > In progress: card is in In progress');
  await move('n1', 'doing', 'next');
  check(await where('next'), tag + 'In progress > Up next: card is in Up next');
  await shot('board-next');
  await page.reload();
  await page.waitForSelector('.rm-ms.is-open');
  // the Review tab lists what waits (r1 is in Review from the seed)
  await page.click('[data-action="set-screen"][data-screen="review"]');
  await page.waitForSelector('.rv-card');
  check((await page.$$('.calm-cards[data-list="waiting"] .rv-card[data-task-id="r1"]')).length === 1, tag + 'the Review tab lists r1 as waiting');
  await shot('review-tab');
  await page.click('[data-action="set-screen"][data-screen="roadmap"]');
  await page.waitForSelector('.rm-ms.is-open');
  // the milestone's columns (the old project card's groups)
  const groups = await page.$$eval('.rm-ms.is-open .rm-col', (g) => g.map((x) => x.dataset.status + ':' + x.querySelectorAll('.rm-task').length));
  check(groups.join() === 'next:1,doing:0,review:1,done:0', tag + 'milestone columns', groups.join());
  await shot('project-card');
  // r1 in and out of Review: a mouse drag by the grip on a computer, the arrow buttons on a phone (no touch drag here)
  const dragTo = async (id, to, from) => {
    if (phone) return move(id, from, to);
    const grip = await (await page.$('.rm-task[data-task-id="' + id + '"] .rm-grip')).boundingBox();
    await page.mouse.move(grip.x + grip.width / 2, grip.y + grip.height / 2);
    await page.mouse.down();
    await page.mouse.move(grip.x + 30, grip.y + 30, { steps: 4 });
    const tgt = await (await page.$('.rm-col[data-status="' + to + '"]')).boundingBox();
    await page.mouse.move(tgt.x + tgt.width / 2, tgt.y + tgt.height / 2, { steps: 10 });
    await page.mouse.up();
    await page.waitForTimeout(150);
  };
  await dragTo('r1', 'next', 'review');
  check(await where('next', 'r1'), tag + 'drag Review > Up next');
  await dragTo('r1', 'review', 'next');
  check(await where('review', 'r1'), tag + 'drag Up next > Review');
  await dragTo('r1', 'doing', 'review');
  check(await where('doing', 'r1'), tag + 'drag Review > In progress');
  await dragTo('r1', 'review', 'doing');
  check(await where('review', 'r1'), tag + 'drag In progress > Review');
  // one step at a time: Review > Done, Done > Review, Review > In progress, In progress > Review
  await step('r1', 1);
  check(await where('done', 'r1'), tag + 'step right: Review > Done');
  await step('r1', -1);
  check(await where('review', 'r1'), tag + 'step left: Done > Review');
  await step('r1', -1);
  check(await where('doing', 'r1'), tag + 'step left: Review > In progress');
  await step('r1', 1);
  check(await where('review', 'r1'), tag + 'step right: In progress > Review');
  for (const w of phone ? [360, 390] : [1440]) {
    await page.setViewportSize({ width: w, height: 844 });
    const fit = await page.$eval(phone ? '.rm-coltabs' : '.rm-ms.is-open .rm-cols', (e) => e.scrollWidth <= e.clientWidth);
    check(fit, tag + 'all four ' + (phone ? 'tabs' : 'columns') + ' fit at ' + w + 'px');
    await page.screenshot({ path: OUT + 'review-tabs-' + w + '.png' });
  }
  await ctx.close();
}
await browser.close(); server.close();
console.log(bad ? bad + ' FAILED' : 'ALL PASSED');
process.exit(bad ? 1 : 0);
