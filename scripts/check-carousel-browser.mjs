// scripts/check-carousel-browser.mjs -- real-Chromium check of the wallet strip and Find / pick-for-me (#253) at 1440x900 and 390x844.
// Desktop: five cards, arrows, keys, wheel, typing, Enter picks and a task opens. Phone: a swipe moves the row.
// Both: Find narrows the row; Sort files a thought by picking a project in the carousel plus a priority;
// "Or let me pick for you" opens the task the Start here order names, and "Not this one" the next.
// Usage: CHROMIUM=/opt/pw-browsers/chromium-1243/chrome-linux/chrome node scripts/check-carousel-browser.mjs
// Serves the repo root itself on 127.0.0.1:8143. Screenshots: docs/generated/build-checks/step5/.
import { createRequire } from 'node:module';
import { mkdirSync, readFileSync, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import { join, extname, normalize } from 'node:path';
import { swipe } from './lib/touch.mjs';
const require = createRequire('/opt/node22/lib/node_modules/');
const { chromium } = require('playwright');
const ROOT = fileURLToPath(new URL('..', import.meta.url));
const OUT = join(ROOT, 'docs/generated/build-checks/step5/');
mkdirSync(OUT, { recursive: true });
const BASE = 'http://127.0.0.1:8143/app/';
const STATE_KEY = 'focusdeck-state-v1';
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' };
const server = createServer((req, res) => {
  const rel = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname)).replace(/^[/\\]+/, '');
  let file = join(ROOT, rel);
  if (!file.startsWith(ROOT)) { res.writeHead(403); return res.end(); }
  if (existsSync(file) && statSync(file).isDirectory()) file = join(file, 'index.html');
  if (!existsSync(file)) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': TYPES[extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
  res.end(readFileSync(file));
});
await new Promise((ok) => server.listen(8143, '127.0.0.1', ok));
let failed = 0, total = 0;
const check = (name, ok, extra = '') => { total++; if (!ok) failed++; console.log((ok ? 'PASS ' : 'FAIL ') + name + (extra ? '  [' + extra + ']' : '')); };

const NAMES = ['Alpha', 'Bravo', 'Charlie', 'Delta', 'Echo', 'Foxtrot', 'Garden', 'Hotel', 'India', 'Juliet', 'Kilo', 'Lima'];
const seed = () => ({
  projects: NAMES.map((n, i) => ({
    id: 'p' + i, name: n, color: 'hsl(' + (i * 30) + ' 50% 45%)',
    tasks: [{ id: 't' + i, title: n + ' task', status: i === 7 ? 'doing' : 'next', categoryIds: ['c' + (i % 3)], priority: i === 2 ? 'urgent' : null, sortOrder: 0 }]
      .concat(i === 7 ? [{ id: 'tx', title: 'Hotel second', status: 'next', categoryIds: ['c0'], priority: 'high', sortOrder: 1 }] : []),
  })),
  categories: [{ id: 'c0', name: 'Chore', color: '#3E8E5E' }, { id: 'c1', name: 'Art', color: '#C2731E' }, { id: 'c2', name: 'Study', color: '#4D6FB8' }],
  inbox: [{ id: 'cap_1', text: 'Buy paint', createdAt: Date.now() }], completedLog: [], deletedTaskIds: [],
});

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM, args: ['--no-sandbox'] });
async function open(vp, screen, touch) {
  const ctx = await browser.newContext({ viewport: vp, hasTouch: !!touch, isMobile: !!touch, serviceWorkers: 'block' });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => check('no page error: ' + e.message, false));
  await page.addInitScript(([k, v, scr]) => {
    if (localStorage.getItem(k) === null) localStorage.setItem(k, v);
    localStorage.setItem('focusdeck-screen', scr);
    localStorage.setItem('focusdeck-onboarding', 'done');
  }, [STATE_KEY, JSON.stringify(seed()), screen]);
  await page.goto(BASE);
  await page.waitForSelector('.flip-track');
  return page;
}
const W = { projects: '[data-wallet="projects"]', categories: '[data-wallet="categories"]', 'tray-projects': '[data-wallet="tray-folders"]' };
const countOf = (page, id) => page.$eval(W[id], (t) => t.closest('.wallet').querySelector('.wallet-count').textContent);
const visible = (page, id) => page.$$eval(W[id] + ' .sleeve', (els, sel) => {
  const r = document.querySelector(sel).getBoundingClientRect();
  return els.filter((e) => { const b = e.getBoundingClientRect(); return b.left >= r.left - 2 && b.right <= r.right + 2; }).length;
}, W[id]);

// ---- desktop -------------------------------------------------------------------------------
{
  const page = await open({ width: 1440, height: 900 }, 'focus');
  check('desktop: five project cards show at once', (await visible(page, 'projects')) === 5, 'visible=' + (await visible(page, 'projects')));
  check('desktop: count reads "1 of 13" (All projects + 12)', (await countOf(page, 'projects')).trim() === '1 of 13', await countOf(page, 'projects'));
  check('desktop: arrow buttons, a labelled row and a count are there', !!(await page.$('#project-wallet .wallet-arrow[aria-label="Next"]')) && !!(await page.$('[data-wallet="projects"][role="group"][aria-label]')));
  await page.screenshot({ path: OUT + 'focus-desk.png', fullPage: true });
  await page.click('#project-wallet .wallet-arrow[aria-label="Next"]');
  check('desktop: the next arrow moves to 2 of 13', (await countOf(page, 'projects')).trim() === '2 of 13');
  await page.focus('[data-wallet="projects"]');
  await page.keyboard.press('ArrowRight');
  check('desktop: Right arrow key moves to 3 of 13', (await countOf(page, 'projects')).trim() === '3 of 13');
  await page.keyboard.press('ArrowLeft');
  check('desktop: Left arrow key moves back to 2 of 13', (await countOf(page, 'projects')).trim() === '2 of 13');
  const box = await (await page.$('[data-wallet="projects"]')).boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.wheel(120, 0);
  await page.waitForTimeout(150);
  check('desktop: a sideways wheel over the row moves it to 3 of 13', (await countOf(page, 'projects')).trim() === '3 of 13', await countOf(page, 'projects'));
  await page.focus('[data-wallet="projects"]');
  await page.keyboard.type('gar');
  check('desktop: typing "gar" jumps to Garden (9 of 13)', (await countOf(page, 'projects')).trim() === '9 of 13', await countOf(page, 'projects'));
  await page.waitForTimeout(600); // the smooth scroll settles
  check('desktop: the row scrolled so the active card is in view', (await visible(page, 'projects')) === 5 && await page.$eval('[data-wallet="projects"] .sleeve.is-centre', (e) => { const r = e.closest('.flip-track').getBoundingClientRect(), b = e.getBoundingClientRect(); return b.left >= r.left - 2 && b.right <= r.right + 2; }));
  await page.screenshot({ path: OUT + 'focus-desk-garden.png' });
  await page.keyboard.press('Enter');
  await page.waitForSelector('.focus-active');
  check('desktop: Enter picks the project and a task opens', (await page.textContent('.focus-title')).includes('Garden task'), await page.textContent('.focus-title'));
  await page.close();
}

// ---- desktop: Find, pick for me ----------------------------------------------------------------
{
  const page = await open({ width: 1440, height: 900 }, 'focus');
  await page.fill('.car-find', 'hot');
  check('Find a project narrows the row to Hotel', (await countOf(page, 'projects')).trim() === '1 of 1', await countOf(page, 'projects'));
  await page.fill('.car-find', 'zzz');
  check('Find with no match says so', !!(await page.$('.find-empty')));
  await page.fill('.car-find', '');
  check('clearing Find brings every project back', (await countOf(page, 'projects')).trim().endsWith('of 13'));
  await page.click('[data-action="pick-for-me"]');
  await page.waitForSelector('.focus-active');
  check('Or let me pick for you opens the task in progress', (await page.textContent('.focus-title')).includes('Hotel task'), await page.textContent('.focus-title'));
  await page.click('[data-action="reroll"]');
  check('"Not this one" offers the next by the same order (urgent)', (await page.textContent('.focus-title')).includes('Charlie task'), await page.textContent('.focus-title'));
  await page.close();
}

// ---- desktop: Sort ----------------------------------------------------------------------------
{
  const page = await open({ width: 1440, height: 900 }, 'sort');
  await page.waitForSelector('[data-wallet="tray-folders"]');
  check('Sort desktop: "Which project?" carousel shows five cards', (await visible(page, 'tray-projects')) === 5 && (await page.textContent('#tray-folder-wallet .wallet-h .q')).includes('Which project?'), 'visible=' + (await visible(page, 'tray-projects')));
  check('Sort: File button is off before a project and priority', await page.$eval('.file-btn', (b) => b.disabled));
  await page.screenshot({ path: OUT + 'sort-desk.png', fullPage: true });
  await page.focus('[data-wallet="tray-folders"]');
  await page.keyboard.type('ju');
  await page.keyboard.press('Enter');
  await page.waitForSelector('.folder-chip');
  check('Sort: Enter on Juliet puts it on the slip', (await page.textContent('.slip-dest')).includes('Juliet'));
  check('Sort: still disabled with no priority', await page.$eval('.file-btn', (b) => b.disabled));
  await page.click('[data-action="pick-set"][data-field="priority"][data-value="high"]');
  const label = await page.textContent('.file-btn');
  check('Sort: the main button reads "File to Juliet →"', label.trim() === 'File to Juliet →', label);
  await page.click('.file-btn');
  await page.waitForTimeout(200);
  const filed = await page.evaluate(([k]) => { const s = JSON.parse(localStorage.getItem(k)); const p = s.projects.find((x) => x.name === 'Juliet'); return { has: p.tasks.some((t) => t.title === 'Buy paint' && t.priority === 'high'), inbox: s.inbox.length }; }, [STATE_KEY]);
  check('Sort: the thought is filed into Juliet at High', filed.has && filed.inbox === 0, JSON.stringify(filed));
  await page.close();
}

// ---- phone ------------------------------------------------------------------------------------
{
  const page = await open({ width: 390, height: 844 }, 'focus', true);
  check('phone: the flip wallet is as before (no strip, no arrows, hint line)', !(await page.$('.is-strip')) && !(await page.$('.wallet-arrow')) && (await page.textContent('.flip-hint')).includes('Swipe sideways to flip'));
  await page.screenshot({ path: OUT + 'focus-phone.png', fullPage: true });
  const box = await (await page.$('[data-wallet="projects"]')).boundingBox();
  await swipe(page, { x: box.x + box.width * 0.8, y: box.y + box.height / 2 }, { x: box.x + box.width * 0.1, y: box.y + box.height / 2 });
  const c = (await countOf(page, 'projects')).trim();
  check('phone: a swipe flips the wallet (count is no longer 1 of 13)', c !== '1 of 13' && c.endsWith(' of 13'), c);
  await page.fill('.car-find', 'kil');
  await page.waitForTimeout(300);
  check('phone: Find narrows the wallet to Kilo', (await countOf(page, 'projects')).trim() === '1 of 1');
  await page.click('[data-wallet="projects"] .sleeve .icard');
  await page.waitForTimeout(450);
  await page.click('[data-wallet="projects"] .sleeve .icard');
  await page.waitForSelector('.focus-active');
  check('phone: tapping the card twice opens a task', (await page.textContent('.focus-title')).includes('Kilo task'), await page.textContent('.focus-title'));
  await page.screenshot({ path: OUT + 'focus-phone-task.png' });
  await page.close();
}
{
  const page = await open({ width: 390, height: 844 }, 'sort', true);
  await page.waitForSelector('[data-wallet="tray-folders"]');
  await page.screenshot({ path: OUT + 'sort-phone.png', fullPage: true });
  await page.fill('.sort-find', 'lim');
  check('phone Sort: Find narrows the project row', (await countOf(page, 'tray-projects')).trim() === '1 of 1');
  await page.click('[data-wallet="tray-folders"] .sleeve .icard');
  await page.waitForTimeout(450);
  await page.click('[data-wallet="tray-folders"] .sleeve .icard');
  await page.waitForTimeout(300);
  await page.click('[data-action="pick-set"][data-field="priority"][data-value="medium"]');
  check('phone Sort: File to Lima enabled', (await page.textContent('.file-btn')).trim() === 'File to Lima →' && !(await page.$eval('.file-btn', (b) => b.disabled)));
  await page.screenshot({ path: OUT + 'sort-phone-ready.png', fullPage: true });
  await page.close();
}

await browser.close();
server.close();
console.log(failed ? failed + ' of ' + total + ' FAILED' : 'ALL ' + total + ' PASSED');
process.exit(failed ? 1 : 0);
