// scripts/check-milestone-browser.mjs -- Milestone settings (#258, two steps since #268) in real Chromium at 360x780, 390x844 and 1440x900:
// open from the drawer, move the ruler slider (keyboard and mouse) and see the %, Back discards, pick each of the four "done means"
// (tasks, size, a number, a checklist) and see the milestone's ruler change after Save, the stored shares add up to 100, it all
// persists after a reload, a task's size, the Projects ruler, no page errors, no sideways scroll.
// Usage: CHROMIUM=/opt/pw-browsers/chromium-1243/chrome-linux/chrome node scripts/check-milestone-browser.mjs
// Serves the repo root on 127.0.0.1:8142. Screenshots: docs/generated/build-checks/step10/milestone-*.png
import { createRequire } from 'node:module';
import { mkdirSync, readFileSync, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import { join, extname, normalize } from 'node:path';
const require = createRequire('/opt/node22/lib/node_modules/');
const { chromium } = require('playwright');
const ROOT = fileURLToPath(new URL('..', import.meta.url));
const OUT = join(ROOT, 'docs/generated/build-checks/step10/');
mkdirSync(OUT, { recursive: true });
const BASE = 'http://127.0.0.1:8142/app/';
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
await new Promise((ok) => server.listen(8142, '127.0.0.1', ok));

const now = Date.now();
const t = (id, title, status, extra) => Object.assign({ id, title, status, updatedAt: now - 1000, sortOrder: 1, categoryIds: [] }, extra);
const seed = () => ({
  projectCategories: [{ id: 'a1', name: 'Apps', color: '#C9584F' }],
  projects: [{ id: 'p0', name: 'Focus Deck', color: '#C9584F', categoryId: 'a1', sortOrder: 1,
    sections: [{ id: 'sec1', name: 'Foundations', order: 1, updatedAt: 1 }],
    milestones: [{ id: 'a', name: 'Alpha', sectionId: 'sec1', order: 1, updatedAt: 1 }, { id: 'b', name: 'Beta', sectionId: 'sec1', order: 2, updatedAt: 1 }, { id: 'c', name: 'Gamma', sectionId: 'sec1', order: 3, updatedAt: 1 }],
    tasks: [t('a1', 'A one', 'done', { milestoneId: 'a', size: 'large' }), t('a2', 'A two', 'done', { milestoneId: 'a' }), t('a3', 'A three', 'done', { milestoneId: 'a', size: 'small' }),
      t('a4', 'A four', 'next', { milestoneId: 'a', size: 'medium' }), t('a5', 'A five', 'next', { milestoneId: 'a', size: 'small' }),
      t('b1', 'B one', 'done', { milestoneId: 'b' }), t('b2', 'B two', 'next', { milestoneId: 'b' }), t('b3', 'B three', 'next', { milestoneId: 'b' }),
      t('loose', 'Loose', 'next')] }],
  categories: [], inbox: [], completedLog: [], deletedTaskIds: {}, choosingMode: { mode: 'twice', updatedAt: 1 },
});
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM, args: ['--no-sandbox'] });
let bad = 0;
const check = (ok, name, extra) => { console.log((ok ? 'PASS ' : 'FAIL ') + name + (extra ? '  [' + extra + ']' : '')); if (!ok) bad++; };
for (const [w, h] of [[360, 780], [390, 844], [1440, 900]]) {
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
  const shot = (n) => page.screenshot({ path: OUT + 'milestone-' + w + '-' + n + '.png' });
  const st = async () => (await page.evaluate(() => JSON.parse(localStorage.getItem('focusdeck-state-v1')))).projects[0];
  const noScroll = async (n) => check(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), tag + 'no sideways scroll ' + n);
  const text = async (sel) => ((await page.textContent(sel)) || '').replace(/\s+/g, ' ').trim();
  const openIt = async () => { await page.click('.pj-pull'); await page.click('.sort-drawer [data-action="rm-settings"]'); await page.waitForSelector('.rm-slider'); };
  const next = async () => { await page.click('[data-action="rm-set-next"]'); await page.waitForSelector('[data-action="rm-set-measure"]'); };
  const save = async () => { await page.click('[data-action="rm-set-save"]'); await page.waitForSelector('.rm-main'); };
  const slider = async () => Number(await page.inputValue('.rm-slider'));
  const ruler = async () => page.getAttribute('.pj-ruler', 'aria-label'); // the open milestone's own ruler

  await page.click('[data-screen="roadmap"]'); await page.waitForSelector('.rm');
  await page.click('.vs-tape'); await page.click('[data-action="view-step"][data-step="project"]'); await page.click('[data-action="view-pick"][data-id="p0"]'); // the view tape
  await page.waitForSelector('.rm-main');
  check((await text('.sort-q')) === 'Alpha' && (await ruler()) === '60% done', tag + 'start: Alpha, 3 of 5 tasks done = 60%', await ruler());

  // step 1: open, the slider by keyboard then mouse; Back leaves it unsaved
  await openIt();
  check((await text('.sort-q')) === 'How big a part?' && (await slider()) === 25 && (await text('[data-rm-pct]')) === '25%', tag + 'old save: equal shares of 4 (3 milestones + Unplanned) = 25%', await text('[data-rm-pct]'));
  await page.focus('.rm-slider');
  for (let i = 0; i < 15; i++) await page.keyboard.press('ArrowRight');
  check((await slider()) === 40 && (await text('[data-rm-pct]')) === '40%', tag + 'keyboard: 40%', await text('[data-rm-pct]'));
  const sb = await (await page.$('.rm-slider')).boundingBox();
  await page.mouse.click(sb.x + sb.width * 0.7, sb.y + sb.height / 2);
  const v = await slider();
  check(v >= 60 && v <= 80 && (await text('[data-rm-pct]')) === v + '%', tag + 'mouse: slider and % agree at ' + v);
  await shot('slider'); await noScroll('step 1');
  await page.click('.dk-back');
  check((await text('.sort-q')) === 'Alpha' && (await st()).milestones.every((m) => m.weight === undefined && !m.measureBy), tag + 'Back changed nothing');
  await openIt(); await page.keyboard.press('Escape');
  check((await text('.sort-q')) === 'Alpha', tag + 'Escape leaves too');

  // step 2: each measure, saved
  await openIt();
  await page.focus('.rm-slider'); await page.keyboard.press('Home'); for (let i = 0; i < 40; i++) await page.keyboard.press('ArrowRight');
  await next();
  check((await text('.sort-q')) === 'Done means…' && (await page.$$eval('.sort-body .dk-choice', (b) => b.map((x) => x.textContent.trim()).join('|'))) === '✓ Tasks done|⚖ Task size|🔢 A number|☑ A checklist' && (await page.$$('.dk-choice.on')).length === 1, tag + 'four choices, the current one marked');
  await page.click('.dk-choice[data-value="tasks"]');
  await save();
  check((await ruler()) === '60% done' && (await st()).milestones.find((m) => m.id === 'a').weight === 40, tag + 'tasks: 3 of 5 = 60%, share 40');
  await page.click('.pj-pull'); await page.click('.sort-drawer [data-action="rm-screen"][data-screen="all"]');
  check((await page.getAttribute('.rm-ms[data-ms-id="a"] .pj-ruler', 'aria-label')) === '60% done', tag + 'All milestones shows the same ruler');
  await page.click('.rm-ms-open[data-id="a"]');

  await openIt(); check((await slider()) === 40, tag + 'the saved share is 40');
  await next(); await page.click('.dk-choice[data-value="size"]'); await save();
  check((await ruler()) === '63% done', tag + 'size: 5 of 8 points = 63%', await ruler());

  await openIt(); await next(); await page.click('.dk-choice[data-value="number"]');
  await page.waitForFunction(() => document.activeElement && document.activeElement.matches('[data-rm-num="name"]')); // the app puts the cursor in the name a frame later; typing before then lands there
  await page.fill('[data-rm-num="name"]', 'screens tested'); await page.fill('[data-rm-num="current"]', '2'); await page.fill('[data-rm-num="target"]', '4');
  await shot('number'); await noScroll('number measure');
  await save();
  const mn = (await st()).milestones.find((m) => m.id === 'a');
  check((await ruler()) === '50% done' && mn.measureBy === 'number' && mn.number.name === 'screens tested', tag + 'own number: screens tested 2 of 4 = 50%', await ruler());

  await openIt(); await next(); await page.click('.dk-choice[data-value="checklist"]');
  for (const item of ['write', 'test', 'ship']) { await page.fill('[data-rm-new]', item); await page.keyboard.press('Enter'); }
  await page.check('.rm-tick[data-rm-tick="0"]');
  check((await page.$$('.rm-item')).length === 3, tag + 'three checklist items');
  await page.click('[data-rm-drop="2"]');
  check((await page.$$('.rm-item')).length === 2, tag + 'a remove key drops one');
  await page.fill('[data-rm-new]', 'ship'); await page.keyboard.press('Enter');
  await shot('checklist'); await noScroll('checklist measure');
  await save();
  check((await ruler()) === '33% done', tag + 'checklist: 1 of 3 items = 33%', await ruler());

  // saved data: shares add up to 100, stamped; the Projects ruler follows; survives a reload
  const p1 = await st();
  const total = p1.milestones.reduce((a, m) => a + m.weight, 0) + p1.unplannedWeight;
  check(total === 100 && p1.milestones.find((m) => m.id === 'a').weight === 40 && p1.milestones.every((m) => m.updatedAt > 1), tag + 'stored shares add up to 100 and are stamped', JSON.stringify(p1.milestones.map((m) => m.weight)) + ' +' + p1.unplannedWeight);
  await page.reload(); await page.waitForSelector('.rm-main');
  check((await ruler()) === '33% done', tag + 'after a reload the same', await ruler());
  await openIt(); check((await slider()) === 40, tag + 'reopened: 40%'); await next(); await page.click('.dk-choice[data-value="checklist"]');
  check((await page.$$('.rm-item')).length === 3 && (await page.$$('.rm-tick:checked')).length === 1, tag + 'reopened: the checklist and its tick'); for (let i = 0; i < 3; i++) await page.keyboard.press('Escape'); // checklist, step 2, step 1

  // a task's size, in Task details (the drawer's Details card)
  await page.click('.rm-tab[data-col="next"]');
  await page.click('.rm-task-title[data-id="a4"]'); await page.click('.sort-drawer [data-action="rm-details"]');
  await page.click('[data-action="detail-size-open"]');
  await page.click('[data-action="detail-size"][data-size="large"]');
  check(((await st()).tasks.find((x) => x.id === 'a4') || {}).size === 'large', tag + 'task details: size saved on the task');

  // the Projects tab uses the same numbers (the task panel covers the switch on a phone: close it first)
  await page.click('[data-action="detail-back"]');
  await page.click('[data-action="detail-close"]');
  await page.click('[data-screen="projects"]:visible');
  await page.waitForSelector('.pj-card');
  check((await page.getAttribute('.pj-card[data-project="p0"] .pj-ruler', 'aria-label')) === '20% done', tag + 'the Projects tab says 20% done');
  await noScroll('projects'); await shot('projects');
  await ctx.close();
}
await browser.close();
server.close();
console.log(bad ? bad + ' FAILED' : 'all passed');
process.exit(bad ? 1 : 0);
