// scripts/check-triage-browser.mjs -- Triage (#256) in real Chromium at 390x844, 360x780 and 1440x900: the order and
// reason chips for every rule across two areas, Later folded, a drag (desktop) / up-down button (phone) / Alt+Arrow
// move that survives a reload, Reset to the rules, view switch narrows, Focus "pick for me" opens the first Now task,
// Tidy up's Confirm leads to Triage, the 7-tab phone bar fits, no page errors, no sideways scroll.
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
  const phone = w < 900, tag = w + ': ';
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, serviceWorkers: 'block', hasTouch: phone });
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
  const order = () => page.$$eval('.tr-row', (r) => r.map((x) => x.dataset.taskId).join());
  const chips = () => page.$$eval('.tr-row .tr-chip', (r) => r.map((x) => x.textContent).join('|'));
  const noScroll = async (n) => check(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), tag + 'no sideways scroll ' + n);
  const goScreen = async (k) => { const d = page.locator('.rail-sub[data-screen="' + k + '"]'); if (await d.isVisible()) return d.click(); if (!(await page.locator('.org-tab[data-screen="' + k + '"]').count())) await page.click('.rail-item[data-go]'); await page.click('.org-tab[data-screen="' + k + '"]'); };
  const goTriage = async () => { await goScreen('triage'); await page.waitForSelector('.tr-layout'); };
  const pickArea = async (id) => { await page.click('[data-action="view-mode"][data-mode="area"]'); await page.click('[data-action="view-pick"][data-id="' + id + '"]'); };
  const laterHidden = () => page.$eval('.tr-later .tr-list', (e) => e.hidden);

  // the 7-tab phone bar must fit: every label whole, nothing wider than the bar
  const fit = await page.evaluate(() => {
    const items = [...document.querySelectorAll('.rail-item')].filter((i) => i.offsetParent);
    return { n: items.length, clipped: items.filter((i) => i.querySelector('.rail-label').scrollWidth > i.clientWidth).map((i) => i.textContent.trim()).join() };
  });
  check(fit.clipped === '', tag + 'no rail label clipped', fit.n + ' ' + fit.clipped);

  await goTriage();
  check((await page.textContent('.board-title')) === 'Triage: All', tag + 'title says All');
  check((await page.textContent('.tr-sub')).startsWith('14 open tasks, ranked.'), tag + 'subline counts 14', await page.textContent('.tr-sub'));
  check(await order() === BASE_ORDER, tag + 'order follows the rules', await order());
  check(await chips() === 'Needs review|In progress|Overdue|Urgent|High|Holds up 1|Due ' + new Date(day(5) + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short' }) + '|Oldest first|Oldest first|Oldest first|Oldest first|Oldest first|Low|Low', tag + 'reason chips', await chips());
  check((await page.$$eval('.tr-card', (c) => c.map((x) => x.dataset.list + ':' + x.querySelectorAll('.tr-row').length).join())) === 'now:3,next:8,later:3', tag + 'Now 3, Next 8, Later 3');
  check(await laterHidden() && (await page.getAttribute('.tr-fold', 'aria-expanded')) === 'false', tag + 'Later is folded');
  check(await page.$eval('.tr-next .tr-list', (e) => !e.hidden), tag + 'Next shows its tasks');
  check((await page.$$('.tr-side')).length === 1 && (await page.isVisible('.tr-side')) === !phone, tag + (phone ? 'no rules column' : 'rules column with 7 rules'));
  if (!phone) check((await page.$$eval('.tr-rules li', (l) => l.length)) === 7 && (await page.textContent('.tr-side-h')) === 'HOW THE ORDER IS WORKED OUT', tag + 'seven numbered rules');
  check((await page.isVisible('.tr-hint')) === !phone, tag + (phone ? 'no drag hint' : 'drag hint shown'));
  await noScroll('tab'); await shot('tab');

  // a move: drag (desktop) or the row's up button (phone); saved at once
  if (phone) {
    await page.click('.tr-row[data-task-id="high1"] [data-dir="-1"]');
    check((await order()).startsWith('rev1,doing1,past1,high1,urgent1'), tag + 'up button moves high1 above urgent1', await order());
  } else {
    const g = await (await page.$('.tr-row[data-task-id="high1"] .tr-grip')).boundingBox();
    const r = await (await page.$('.tr-row[data-task-id="rev1"]')).boundingBox();
    await page.mouse.move(g.x + g.width / 2, g.y + g.height / 2); await page.mouse.down();
    await page.mouse.move(g.x + 10, g.y - 30, { steps: 5 }); await page.mouse.move(r.x + 200, r.y + 5, { steps: 10 }); await page.mouse.up();
    check((await order()).startsWith('high1,rev1,doing1'), tag + 'drag puts high1 first', await order());
  }
  const moved = await order();
  await shot('moved');
  await page.reload(); await page.waitForSelector('.rail'); await goTriage();
  check(await order() === moved, tag + 'moved order survives reload', await order());
  // keyboard: Alt+Down on a focused row
  const first = moved.split(',')[0];
  await page.focus('.tr-row[data-task-id="' + first + '"]');
  await page.keyboard.press('Alt+ArrowDown');
  const kb = moved.split(','); [kb[0], kb[1]] = [kb[1], kb[0]];
  check(await order() === kb.join(), tag + 'Alt+Down moves the first row down one', await order());
  check(await page.evaluate((id) => document.activeElement && document.activeElement.dataset.taskId === id, first), tag + 'focus stays on the moved row');
  // Reset to the rules
  await page.click(phone ? '.tr-reset-phone' : '.tr-reset');
  check(await order() === BASE_ORDER, tag + 'Reset to the rules restores the order', await order());
  // across lists: Next's last (n=11) down into Later
  await page.focus('.tr-row[data-task-id="plain3"]');
  await page.keyboard.press('Alt+ArrowDown');
  check((await page.$$eval('.tr-later .tr-row', (r) => r.map((x) => x.dataset.taskId).join())).startsWith('plain3') && !(await laterHidden()), tag + 'Alt+Down crosses from Next into Later and opens it');
  await noScroll('later'); await shot('later');
  await page.click(phone ? '.tr-reset-phone' : '.tr-reset');
  // view switch
  await pickArea('a1');
  check((await page.textContent('.board-title')) === 'Triage: Home', tag + 'title says Home');
  check(await order() === 'rev1,doing1,past1,urgent1,high1,holdsA,soon1,plain1,low1', tag + 'Home shows only its nine', await order());
  check((await page.textContent('.tr-sub')).startsWith('9 Home tasks, ranked.'), tag + 'subline says 9 Home tasks', await page.textContent('.tr-sub'));
  await noScroll('area'); await shot('area');
  await page.click('[data-action="view-mode"][data-mode="all"]');
  // Focus: pick for me opens the first Now task
  await page.click('[data-screen="focus"]');
  await page.click('[data-action="pick-for-me"]');
  const picked = await page.evaluate(() => JSON.parse(localStorage.getItem('focusdeck-state-v1')).focus.taskId);
  check(picked === 'rev1' && (await page.textContent('body')).includes('Task rev1'), tag + 'pick for me opens the first Now task', picked);
  // Tidy up -> Confirm N, then Triage
  await goScreen('tidy');
  await page.click('.td-row[data-task-id="rev1"] [data-mark="close"]');
  check((await page.textContent('.td-confirm')) === 'Confirm 1, then Triage', tag + 'button says Confirm 1, then Triage');
  await page.click('.td-confirm');
  await page.waitForSelector('.tr-layout');
  check((await page.textContent('.board-title')) === 'Triage: All' && (await order()).startsWith('doing1,past1,urgent1'), tag + 'Confirm leads to Triage without the closed task', await order());
  await noScroll('after-tidy'); await shot('after-tidy');
  await ctx.close();
}
await browser.close();
server.close();
console.log(bad ? bad + ' FAILED' : 'all passed');
process.exit(bad ? 1 : 0);
