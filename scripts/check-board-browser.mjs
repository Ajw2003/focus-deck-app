// scripts/check-board-browser.mjs -- the Board's actions in real Chromium (#145, part of #140), at 1440
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
import { swipe } from './lib/touch.mjs';
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
    { id: 'p0', name: 'Home', color: '#3E8E5E', tasks: [t('n1', 'Bins out', 'next', { order: 1 }), t('n2', 'Mop the kitchen', 'next', { order: 2 }), t('n3', 'Fix the gate latch', 'next', { order: 3 }),
      t('d1', 'Book boiler service', 'doing'), t('x1', 'Paint the hall', 'done', { completedAt: Date.now() - 1000 })].concat(long) },
    { id: 'p1', name: 'Garden', color: '#4D6FB8', tasks: [t('g1', 'Plant the bulbs', 'next', { order: 1 }), t('g2', 'Order compost', 'doing')] },
  ],
  categories: [], inbox: [], completedLog: [], deletedTaskIds: {}, choosingMode: { mode: 'twice', updatedAt: 1 },
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
  const counts = () => page.$$eval('.board-col .board-count', (els) => els.map((e) => Number(e.textContent)));
  const noSideways = async (label) => check(!(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)), tag + 'no sideways scroll ' + label);
  const showCol = async (c) => { if (phone) { await page.click('.board-switch-btn[data-col="' + c + '"]'); await page.waitForTimeout(100); } };
  await noSideways('at rest');

  // ticking
  await showCol('next');
  let before = await counts();
  await page.click('.board-card[data-task-id="n1"] input[type="checkbox"]');
  await page.waitForTimeout(300);
  let after = await counts();
  check((await status('n1')) === 'done' && after[0] === before[0] - 1 && after[2] === before[2] + 1, tag + 'ticking moves a card to Done', before + ' -> ' + after);
  const stamped = await page.evaluate(() => JSON.parse(localStorage.getItem('focusdeck-state-v1')).projects[0].tasks.find((x) => x.id === 'n1').completedAt);
  check(typeof stamped === 'number', tag + 'ticking stamps completedAt');

  if (!phone) {
    const grip = (id) => page.locator('.board-grip[data-task="' + id + '"]');
    const dragTo = async (id, col, { shot } = {}) => {
      const g = await grip(id).boundingBox();
      const target = await page.locator('.board-col[data-col="' + col + '"] .board-cards').boundingBox();
      await page.mouse.move(g.x + g.width / 2, g.y + g.height / 2);
      await page.mouse.down();
      await page.mouse.move(g.x + 40, g.y + 10, { steps: 4 });
      await page.mouse.move(target.x + target.width / 2, target.y + 70, { steps: 12 });
      await page.waitForTimeout(150);
      if (shot) await page.screenshot({ path: OUT + shot, fullPage: false });
      await page.mouse.up();
      await page.waitForTimeout(300);
    };
    before = await counts();
    await dragTo('n2', 'doing', { shot: scheme === 'dark' ? 'board-action-1440-dark-mid-drag.png' : undefined });
    after = await counts();
    check((await status('n2')) === 'doing' && after[0] === before[0] - 1 && after[1] === before[1] + 1, tag + 'drag Up next -> In progress', before + ' -> ' + after);
    before = after;
    await dragTo('n2', 'done');
    after = await counts();
    check((await status('n2')) === 'done' && after[1] === before[1] - 1 && after[2] === before[2] + 1, tag + 'drag In progress -> Done', before + ' -> ' + after);
    const doneAt = await page.evaluate(() => JSON.parse(localStorage.getItem('focusdeck-state-v1')).projects[0].tasks.find((x) => x.id === 'n2').completedAt);
    check(typeof doneAt === 'number', tag + 'drop into Done stamps completedAt');
    before = after;
    await dragTo('n2', 'next');
    after = await counts();
    check((await status('n2')) === 'next' && after[2] === before[2] - 1 && after[0] === before[0] + 1, tag + 'drag Done -> Up next', before + ' -> ' + after);
    const reopened = await page.evaluate(() => JSON.parse(localStorage.getItem('focusdeck-state-v1')).projects[0].tasks.find((x) => x.id === 'n2').completedAt);
    check(reopened === undefined, tag + 'dragging out of Done clears completedAt');

    // keyboard
    await grip('n3').focus();
    await page.keyboard.press('ArrowRight');
    await page.waitForTimeout(250);
    let live = await page.$eval('#drag-live', (e) => e.textContent);
    let focused = await page.evaluate(() => document.activeElement && document.activeElement.getAttribute('data-task'));
    check((await status('n3')) === 'doing' && live === 'Fix the gate latch moved to In progress' && focused === 'n3', tag + 'ArrowRight moves, announces, keeps focus', live + ' / focus ' + focused);
    await page.keyboard.press('ArrowRight'); await page.waitForTimeout(250);
    check((await status('n3')) === 'done', tag + 'ArrowRight again -> Done');
    await page.keyboard.press('ArrowLeft'); await page.waitForTimeout(250);
    await page.keyboard.press('ArrowLeft'); await page.waitForTimeout(250);
    live = await page.$eval('#drag-live', (e) => e.textContent);
    check((await status('n3')) === 'next' && live === 'Fix the gate latch moved to Up next', tag + 'ArrowLeft x2 -> Up next, announced', live);
    await page.keyboard.press('ArrowLeft'); await page.waitForTimeout(250);
    live = await page.$eval('#drag-live', (e) => e.textContent);
    check((await status('n3')) === 'next' && /already in Up next/.test(live), tag + 'ArrowLeft at the edge says so', live);
  } else {
    const centre = async (id) => { const b = await page.locator('.board-card[data-task-id="' + id + '"]').boundingBox(); return { b, x: b.x + b.width / 2, y: b.y + b.height / 2 }; };
    // far swipe right: Up next -> In progress
    let c = await centre('n2');
    before = await counts();
    await swipe(page, { x: c.b.x + c.b.width * 0.35, y: c.y }, { x: c.b.x + c.b.width * 0.85, y: c.y });
    after = await counts();
    check((await status('n2')) === 'doing' && after[0] === before[0] - 1 && after[1] === before[1] + 1, tag + 'swipe right: Up next -> In progress', before + ' -> ' + after);
    const left = await page.$$eval('.board-col.is-current .board-card', (els) => els.map((e) => e.dataset.taskId));
    check(!left.includes('n2'), tag + 'the card leaves the visible column');
    await page.screenshot({ path: OUT + 'board-action-390-' + scheme + '-after-swipe.png', fullPage: false });
    // far swipe left from In progress back to Up next
    await showCol('doing');
    c = await centre('n2');
    await swipe(page, { x: c.b.x + c.b.width * 0.65, y: c.y }, { x: c.b.x + c.b.width * 0.15, y: c.y });
    check((await status('n2')) === 'next', tag + 'swipe left: In progress -> Up next');
    // right twice -> Done, ticking-equivalent
    await showCol('next');
    c = await centre('n2');
    await swipe(page, { x: c.b.x + c.b.width * 0.35, y: c.y }, { x: c.b.x + c.b.width * 0.85, y: c.y });
    await showCol('doing');
    c = await centre('n2');
    await swipe(page, { x: c.b.x + c.b.width * 0.35, y: c.y }, { x: c.b.x + c.b.width * 0.85, y: c.y });
    check((await status('n2')) === 'done', tag + 'two right swipes -> Done');
    await noSideways('after swipes');
    // short swipe snaps back
    await showCol('next');
    c = await centre('n3');
    await swipe(page, { x: c.b.x + c.b.width * 0.4, y: c.y }, { x: c.b.x + c.b.width * 0.55, y: c.y });
    const tr = await page.$eval('.board-card[data-task-id="n3"]', (e) => getComputedStyle(e).transform);
    check((await status('n3')) === 'next' && (tr === 'none' || tr === 'matrix(1, 0, 0, 1, 0, 0)'), tag + 'a short swipe snaps back', tr);
    // vertical drag over a card scrolls the page and moves nothing
    await showCol('next');
    const y0 = await page.evaluate(() => scrollY);
    const snapshot = await page.$$eval('.board-card', (els) => els.map((e) => e.dataset.taskId + ':' + e.dataset.status).join());
    c = await centre('l0');
    await swipe(page, { x: c.x, y: Math.min(c.y + 200, 800) }, { x: c.x, y: Math.max(c.y - 150, 60) });
    const y1 = await page.evaluate(() => scrollY);
    const same = (await page.$$eval('.board-card', (els) => els.map((e) => e.dataset.taskId + ':' + e.dataset.status).join())) === snapshot;
    check(y1 > y0 && same, tag + 'a vertical drag scrolls the page and moves nothing', 'scrollY ' + y0 + ' -> ' + y1);
    await page.evaluate(() => scrollTo(0, 0));
  }

  // survives a reload
  const expect = await page.$$eval('.board-card', (els) => els.map((e) => e.dataset.taskId + ':' + e.dataset.status).sort().join());
  await page.waitForTimeout(300);
  await page.reload(); await page.waitForSelector('.board-card');
  const got = await page.$$eval('.board-card', (els) => els.map((e) => e.dataset.taskId + ':' + e.dataset.status).sort().join());
  check(got === expect, tag + 'the moved state survives a reload');
  await noSideways('after reload');
  await ctx.close();
}
await browser.close(); server.close();
console.log(bad ? 'FAILED (' + bad + ')' : 'all board checks passed');
process.exit(bad ? 1 : 0);
