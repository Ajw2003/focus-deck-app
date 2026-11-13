// scripts/check-review-status-browser.mjs -- Review as the fourth status (#250) in real Chromium at 390x844 and
// 1440x900: one task moved Up next > Doing > Review > Done > Review > Doing > Up next on the one-milestone Roadmap (#268: the
// task drawer's stamps and Task details; seen in the right folder tab each time), then the Review tab (#271) shows it.
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
  projects: [{ id: 'p0', name: 'Home', color: '#3E8E5E', sections: [{ id: 's1', name: 'Foundations', order: 1, updatedAt: 1 }], milestones: [{ id: 'm1', name: 'First', sectionId: 's1', order: 1, updatedAt: 1 }],
    tasks: [t('n1', 'Bins out', 'next', { order: 1, milestoneId: 'm1', sortOrder: 1 }), t('r1', 'Check the quote', 'review', { order: 1, milestoneId: 'm1', sortOrder: 2 })] }],
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
    localStorage.setItem('focusdeck-onboarding', 'done'); localStorage.setItem('focusdeck-screen', 'roadmap'); localStorage.setItem('focusdeck-view', JSON.stringify({ mode: 'project', id: 'p0' })); localStorage.setItem('focusdeck-last-project', 'p0');
    localStorage.setItem('focusdeck-state-v1', JSON.stringify(s));
  }, seed);
  await page.goto(BASE);
  await page.waitForSelector('.rm-main');
  const stateTask = async (id) => (await page.evaluate(() => JSON.parse(localStorage.getItem('focusdeck-state-v1')))).projects[0].tasks.find((x) => x.id === id);
  const click = async (sel) => { await page.click(sel); await page.waitForTimeout(250); };
  // a task is in a folder tab when that tab lists it
  const where = async (k, id = 'n1') => { await click('.rm-tab[data-col="' + k + '"]'); return (await page.$$('.rm-task-title[data-id="' + id + '"]')).length === 1 && (await stateTask(id)).status === k; };
  const shot = (n) => page.screenshot({ path: OUT + 'review-' + (phone ? '390' : '1440') + '-' + n + '.png' });
  const tabs = await page.$$eval('.rm-tab', (e) => e.map((x) => x.dataset.col));
  check(tabs.join() === 'next,doing,review,done', tag + 'folder tabs in order', tabs.join());
  const stamp = async (id, k) => { await click('.rm-tab[data-col="' + (await stateTask(id)).status + '"]'); await click('.rm-task-title[data-id="' + id + '"]'); await click('.rm-stamp[data-status="' + k + '"]'); };
  await stamp('n1', 'doing');
  check(await where('doing'), tag + 'Up next > Doing: task is in the Doing tab');
  await stamp('n1', 'review');
  check(await where('review'), tag + 'Doing > Review: task is in the Review tab');
  await shot('board-review');
  await stamp('n1', 'done');
  check(await where('done'), tag + 'Review > Done: task is in the Done tab');
  await click('.rm-task-title[data-id="n1"]'); await click('.sort-drawer [data-action="rm-details"]');
  await click('[data-action="detail-status-open"]'); await click('.vs-pop [data-action="detail-status"][data-status="review"]'); // the status stamp's drawer
  await click('[data-action="detail-close"]');
  check(await where('review'), tag + 'Done > Review (Task details menu): task is in the Review tab');
  await stamp('n1', 'doing');
  check(await where('doing'), tag + 'Review > Doing: task is in the Doing tab');
  await click('.rm-task-title[data-id="n1"]'); await click('.sort-drawer [data-action="rm-details"]');
  await click('[data-action="detail-status-open"]'); await click('.vs-pop [data-action="detail-status"][data-status="next"]'); // the status stamp's drawer
  await click('[data-action="detail-close"]');
  check(await where('next'), tag + 'Doing > Up next (Task details menu): task is in the Up next tab');
  await shot('board-next');
  await page.reload();
  await page.waitForSelector('.rm-main');
  // the Review tab (#271) shows what waits: r1 from the seed, on the clipboard
  await page.click('[data-action="set-screen"][data-screen="review"]');
  await page.waitForSelector('.rv-card');
  check((await page.$eval('.rv-card', (e) => e.dataset.taskId)) === 'r1', tag + 'the Review tab shows r1 as the task waiting');
  await shot('review-tab');
  // Looks good moves it to Done, which the Roadmap's Done tab shows
  await page.click('[data-action="review-done"]');
  await page.click('[data-action="set-screen"][data-screen="roadmap"]');
  await page.waitForSelector('.rm-main');
  check(await where('done', 'r1'), tag + 'Looks good on the Review tab: r1 is in the Roadmap Done tab');
  await ctx.close();
}
await browser.close(); server.close();
console.log(bad ? bad + ' FAILED' : 'ALL PASSED');
process.exit(bad ? 1 : 0);
