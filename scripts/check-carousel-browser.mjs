// scripts/check-carousel-browser.mjs -- real-Chromium check of choosing a project and Find / pick-for-me (#253) at 1440x900 and 390x844.
// Since 2026-11-15 the projects are files in the filing cabinet (app/js/cabinet.js), not the five-card strip.
// Desktop: every drawer at once, Up/Down keys, typing a name, Enter chooses and a task opens. Phone: a swipe changes drawer.
// Both: Find narrows the files; Sort files a thought by choosing a project in the cabinet plus a priority;
// "Or let me pick for you" opens the task the Start here order names, and "Not this one" the next.
// Usage: CHROMIUM=/opt/pw-browsers/chromium-1243/chrome-linux/chrome node scripts/check-carousel-browser.mjs
// Serves the repo root itself on 127.0.0.1:8143. Screenshots: docs/generated/build-checks/step5/.
import { createRequire } from 'node:module';
import { mkdirSync, readFileSync, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import { join, extname, normalize } from 'node:path';
import { swipe } from './lib/touch.mjs';
import { cab, everyFile, fileKeys, chooseFile } from './lib/cabinet.mjs';
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
  await page.waitForSelector(screen === 'sort' ? '.jot-slip' : '.cab');
  if (screen === 'sort') await page.click('[data-action="sort-next"]'); // the first Sort screen is the slip; step 1 is the project carousel
  return page;
}
// "3 of 13" on the front of the Everything drawer: which file is open
const countOf = (page, wallet) => page.$eval(cab(wallet) + ' .cab-drawer:first-child .cab-pos', (e) => e.textContent);
const shownDrawers = (page, wallet) => page.$$eval(cab(wallet) + ' .cab-drawer', (ds) => ds.filter((d) => { const b = d.getBoundingClientRect(); return b.left >= 0 && b.right <= innerWidth; }).length);

// ---- desktop -------------------------------------------------------------------------------
{
  const page = await open({ width: 1440, height: 900 }, 'focus');
  check('desktop: every drawer shows at once, so no drawer labels', (await shownDrawers(page, 'projects')) === (await page.$$(cab('projects') + ' .cab-drawer')).length && !(await page.isVisible(cab('projects') + ' .cab-labels')));
  check('desktop: All projects is open, "1 of 13" (All projects + 12)', (await countOf(page, 'projects')).trim() === '1 of 13', await countOf(page, 'projects'));
  check('desktop: the cabinet is a labelled group', !!(await page.$('[data-wallet="projects"][role="group"][aria-label]')));
  await page.screenshot({ path: OUT + 'focus-desk.png', fullPage: true });
  await page.focus(cab('projects'));
  await page.keyboard.press('ArrowDown');
  check('desktop: Down opens the next file, 2 of 13', (await countOf(page, 'projects')).trim() === '2 of 13');
  await page.keyboard.press('ArrowDown');
  check('desktop: Down again, 3 of 13', (await countOf(page, 'projects')).trim() === '3 of 13');
  await page.keyboard.press('ArrowUp');
  check('desktop: Up goes back to 2 of 13', (await countOf(page, 'projects')).trim() === '2 of 13');
  await page.keyboard.type('gar');
  const gardenAt = (await page.$$eval(everyFile('projects') + ' .cab-tab b', (bs) => bs.map((b) => b.textContent))).indexOf('Garden') + 1;
  check('desktop: typing "gar" opens Garden (' + gardenAt + ' of 13)', (await countOf(page, 'projects')).trim() === gardenAt + ' of 13', await countOf(page, 'projects'));
  await page.keyboard.press('Enter');
  await page.waitForSelector('[data-wallet="categories"]'); // #270: choosing a project asks the second question
  check('desktop: Enter chooses the project and asks "What kind of work?"', (await page.textContent('.sort-q')).includes('What kind of work?'));
  await page.click('[data-action="focus-skip"]');
  await page.waitForSelector('.focus-active');
  check('desktop: Skip (any kind) opens a task from that project', (await page.textContent('.focus-title')).includes('Garden task'), await page.textContent('.focus-title'));
  await page.close();
}

// ---- desktop: Find, pick for me ----------------------------------------------------------------
{
  const page = await open({ width: 1440, height: 900 }, 'focus');
  await page.fill('[data-car-find]', 'hot');
  check('Find a project narrows the files to Hotel', (await fileKeys(page, 'projects')).length === 1, (await fileKeys(page, 'projects')).join());
  await page.fill('[data-car-find]', 'zzz');
  check('Find with no match says so', !!(await page.$('.find-empty')));
  await page.fill('[data-car-find]', '');
  check('clearing Find brings every project back', (await fileKeys(page, 'projects')).length === 13);
  await page.click('[data-action="pick-for-me"]');
  await page.waitForSelector('.focus-active');
  check('Pick for me opens the task in progress', (await page.textContent('.focus-title')).includes('Hotel task'), await page.textContent('.focus-title'));
  await page.click('[data-action="reroll"]');
  check('"Another" offers the next by the same order (urgent)', (await page.textContent('.focus-title')).includes('Charlie task'), await page.textContent('.focus-title'));
  await page.close();
}

// ---- desktop: Sort ----------------------------------------------------------------------------
{
  const page = await open({ width: 1440, height: 900 }, 'sort');
  await page.waitForSelector('[data-wallet="tray-folders"]');
  check('Sort desktop: "Which project?" is the cabinet with every project', (await fileKeys(page, 'tray-folders')).length === 12 && (await page.textContent('.sort-q')).includes('Which project?'), (await fileKeys(page, 'tray-folders')).length + ' files');
  check('Sort: Next is off before a project is chosen', await page.$eval('.sort-foot .file-btn', (b) => b.disabled));
  await page.screenshot({ path: OUT + 'sort-desk.png', fullPage: true });
  await page.focus(cab('tray-folders'));
  await page.keyboard.type('ju');
  await page.keyboard.press('Enter');
  await page.waitForSelector('.folder-chip');
  check('Sort: Enter on Juliet puts it on the slip', (await page.textContent('.slip-dest')).includes('Juliet'));
  await page.click('.sort-foot .file-btn');
  check('Sort: the priority step has Next off until a priority is picked', (await page.textContent('.sort-q')) === 'How important?' && (await page.$eval('.sort-foot .file-btn', (b) => b.disabled)));
  await page.click('[data-action="pick-set"][data-field="priority"][data-value="high"]');
  await page.click('.sort-foot .file-btn');
  await page.click('.sort-foot .file-btn');
  for (let i = 0; i < 5; i++) { await page.click('.sort-foot .dk-skip'); await page.waitForTimeout(100); }
  const label = await page.textContent('.file-btn');
  check('Sort: the receipt button reads "Save to Juliet"', label.trim() === 'Save to Juliet', label);
  await page.click('.file-btn');
  await page.waitForTimeout(200);
  const filed = await page.evaluate(([k]) => { const s = JSON.parse(localStorage.getItem(k)); const p = s.projects.find((x) => x.name === 'Juliet'); return { has: p.tasks.some((t) => t.title === 'Buy paint' && t.priority === 'high'), inbox: s.inbox.length }; }, [STATE_KEY]);
  check('Sort: the thought is filed into Juliet at High', filed.has && filed.inbox === 0, JSON.stringify(filed));
  await page.close();
}

// ---- phone ------------------------------------------------------------------------------------
{
  const page = await open({ width: 390, height: 844 }, 'focus', true);
  check('phone: one drawer at a time, with the drawer labels under it', (await shownDrawers(page, 'projects')) === 1 && await page.isVisible(cab('projects') + ' .cab-labels'));
  await page.screenshot({ path: OUT + 'focus-phone.png', fullPage: true });
  const box = await (await page.$(cab('projects') + ' .cab-drawers')).boundingBox();
  await swipe(page, { x: box.x + box.width * 0.85, y: box.y + box.height * 0.8 }, { x: box.x + box.width * 0.1, y: box.y + box.height * 0.8 });
  const lit = await page.$eval(cab('projects') + ' .cab-label[aria-selected="true"]', (l) => l.dataset.drawer);
  check('phone: a sideways swipe moves to the next drawer', lit === '1', 'drawer ' + lit);
  await page.fill('[data-car-find]', 'kil');
  await page.waitForTimeout(300);
  check('phone: Find narrows the files to Kilo', (await fileKeys(page, 'projects')).length === 1);
  await chooseFile(page, 'projects', (await fileKeys(page, 'projects'))[0]);
  await page.waitForSelector('[data-wallet="categories"]');
  await page.click('[data-action="focus-skip"]');
  await page.waitForSelector('.focus-active');
  check('phone: tapping the file twice chooses the project; Skip opens a task from it', (await page.textContent('.focus-title')).includes('Kilo task'), await page.textContent('.focus-title'));
  await page.screenshot({ path: OUT + 'focus-phone-task.png' });
  await page.close();
}
{
  const page = await open({ width: 390, height: 844 }, 'sort', true);
  await page.waitForSelector('[data-wallet="tray-folders"]');
  await page.screenshot({ path: OUT + 'sort-phone.png', fullPage: true });
  await page.fill('.sort-find', 'lim');
  check('phone Sort: Find narrows the files', (await fileKeys(page, 'tray-folders')).length === 1);
  await chooseFile(page, 'tray-folders', (await fileKeys(page, 'tray-folders'))[0]);
  await page.click('.sort-foot .file-btn');
  await page.click('[data-action="pick-set"][data-field="priority"][data-value="medium"]');
  await page.click('.sort-foot .file-btn');
  await page.click('.sort-foot .file-btn');
  for (let i = 0; i < 5; i++) { await page.click('.sort-foot .dk-skip'); await page.waitForTimeout(100); }
  check('phone Sort: Save to Lima enabled', (await page.textContent('.file-btn')).trim() === 'Save to Lima' && !(await page.$eval('.file-btn', (b) => b.disabled)));
  await page.screenshot({ path: OUT + 'sort-phone-ready.png', fullPage: true });
  await page.close();
}

await browser.close();
server.close();
console.log(failed ? failed + ' of ' + total + ' FAILED' : 'ALL ' + total + ' PASSED');
process.exit(failed ? 1 : 0);
