// scripts/check-milestone-browser.mjs -- Milestone settings (#258) in real Chromium at 360x780, 390x844 and 1440x900:
// open from a milestone name, move the share slider (keyboard and mouse) and see the rest rescale to 100, pick each
// of the four measures and see the progress text and project percent change after Save, Cancel discards, it all
// persists after a reload, the segmented project bar, a task's size, no page errors, no sideways scroll.
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
  const noScroll = async (n) => check(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth && (!document.querySelector('.ms-dialog') || document.querySelector('.ms-dialog').scrollWidth <= document.querySelector('.ms-dialog').clientWidth)), tag + 'no sideways scroll ' + n);
  const text = async (sel) => ((await page.textContent(sel)) || '').replace(/\s+/g, ' ').trim();
  const openIt = async (id) => { await page.click('.rm-ms-name[data-id="' + id + '"]'); await page.waitForSelector('.ms-dialog'); };
  const sumShown = async () => page.$$eval('.ms-others b', (b) => b.map((x) => parseInt(x.textContent, 10)).reduce((a, c) => a + c, 0));
  const slider = async () => Number(await page.inputValue('.ms-slider'));
  const save = async () => { await page.click('[data-ms-save]'); await page.waitForSelector('.ms-dialog', { state: 'detached' }); };
  const countA = async () => text('.rm-ms[data-ms-id="a"] .rm-ms-count');

  await page.click('[data-screen="roadmap"]'); await page.waitForSelector('.rm');
  await page.click('.vs-tape'); await page.click('[data-action="view-step"][data-step="project"]'); await page.click('[data-action="view-pick"][data-id="p0"]'); // the view tape
  await page.waitForSelector('.rm-project');
  check((await text('.rm-big')) === '23%', tag + 'start: equal shares of 4, tasks 3 of 5 / 1 of 3 -> 23%', await text('.rm-big'));

  // open, close with Escape (focus returns), open again
  await openIt('a');
  check((await text('.ms-title')) === 'Milestone: Alpha' && (await text('.ms-sub')) === 'Focus Deck · 1 · Foundations', tag + 'title and subline', (await text('.ms-title')) + ' / ' + (await text('.ms-sub')));
  check(await page.evaluate(() => !!document.activeElement.closest('.ms-dialog')), tag + 'focus is inside the dialog');
  const dlg = await (await page.$('.ms-dialog')).boundingBox();
  check(phone ? Math.abs(dlg.y + dlg.height - h) < 2 && Math.abs(dlg.width - w) < 2 : Math.abs(dlg.x + dlg.width / 2 - w / 2) < 2 && dlg.y > 20, tag + (phone ? 'bottom sheet' : 'centred dialog'), JSON.stringify(dlg));
  check((await text('[data-ms-mine]')) === '25% of the project' && (await text('[data-ms-rest]')) === 'the rest share 75%', tag + 'old save: equal shares of 4 (3 milestones + Unplanned)', await text('[data-ms-mine]'));
  for (let i = 0; i < 40; i++) await page.keyboard.press('Tab');
  check(await page.evaluate(() => !!document.activeElement.closest('.ms-dialog')), tag + 'Tab stays inside');
  await page.keyboard.press('Escape');
  check(!(await page.$('.ms-dialog')) && (await page.evaluate(() => document.activeElement.matches('.rm-ms-name[data-id="a"]'))), tag + 'Escape closes and focus is back on the name');

  // the slider: keyboard, then mouse; the rest rescale and the total stays 100
  await openIt('a');
  await page.focus('.ms-slider');
  for (let i = 0; i < 15; i++) await page.keyboard.press('ArrowRight');
  check((await slider()) === 40 && (await text('[data-ms-mine]')) === '40% of the project' && (await text('[data-ms-rest]')) === 'the rest share 60%', tag + 'keyboard: 40% / rest 60%', await text('[data-ms-mine]'));
  check((await sumShown()) === 60 && (await text('[data-ms-total]')) === '100', tag + 'others add up to 60, total 100');
  const sb = await (await page.$('.ms-slider')).boundingBox();
  await page.mouse.click(sb.x + sb.width * 0.7, sb.y + sb.height / 2);
  const v = await slider();
  check(v >= 60 && v <= 80 && (await sumShown()) === 100 - v && (await text('[data-ms-total]')) === '100', tag + 'mouse: slider at ' + v + ', others ' + (100 - v) + ', total 100');
  await shot('slider');
  await noScroll('dialog open');
  await page.click('.ms-actions [data-ms-cancel]');
  check(!(await page.$('.ms-dialog')) && (await st()).milestones.every((m) => m.weight === undefined && !m.measureBy), tag + 'Cancel changed nothing');
  await openIt('a'); await page.focus('.ms-slider'); await page.keyboard.press('End'); await page.click('.ms-top [data-ms-cancel]');
  check((await st()).milestones.every((m) => m.weight === undefined), tag + 'the close control discards');

  // each measure, saved
  await openIt('a');
  await page.focus('.ms-slider'); await page.keyboard.press('Home'); for (let i = 0; i < 40; i++) await page.keyboard.press('ArrowRight');
  check((await text('.ms-card.is-on .ms-card-hint')) === '3 of 5 tasks', tag + 'Tasks done card says 3 of 5 tasks');
  await save();
  check((await countA()).startsWith('tasks 3 of 5') && (await text('.rm-big')) === '31%', tag + 'tasks: 3 of 5, project 31%', (await countA()) + ' ' + (await text('.rm-big')));
  check(await page.evaluate(() => document.activeElement.matches('.rm-ms-name[data-id="a"]')), tag + 'after Save focus is on the name');

  await openIt('a'); check((await slider()) === 40, tag + 'the saved share is 40');
  await page.check('input[type="radio"][value="size"]');
  check((await text('.ms-card.is-on .ms-card-hint')) === 'small 1, medium 2, large 3', tag + 'Task size card text');
  await save();
  check((await countA()).startsWith('5 of 8 points') && (await text('.rm-big')) === '32%', tag + 'size: 5 of 8 points, project 32%', (await countA()) + ' ' + (await text('.rm-big')));

  await openIt('a'); await page.check('input[type="radio"][value="number"]');
  await page.fill('[data-ms-num="name"]', 'screens tested'); await page.fill('[data-ms-num="current"]', '2'); await page.fill('[data-ms-num="target"]', '4');
  await shot('number'); await noScroll('number measure');
  await save();
  check((await countA()).startsWith('screens tested 2 of 4') && (await text('.rm-big')) === '27%', tag + 'own number: screens tested 2 of 4, project 27%', (await countA()) + ' ' + (await text('.rm-big')));

  await openIt('a'); await page.check('input[type="radio"][value="checklist"]');
  for (const item of ['write', 'test', 'ship']) { await page.fill('[data-ms-new]', item); await page.keyboard.press('Enter'); }
  await page.check('[data-ms-tick="0"]');
  check((await page.$$('.ms-item')).length === 3, tag + 'three checklist items');
  await shot('checklist'); await noScroll('checklist measure');
  await save();
  check((await countA()).startsWith('1 of 3 items') && (await text('.rm-big')) === '20%', tag + 'checklist: 1 of 3 items, project 20%', (await countA()) + ' ' + (await text('.rm-big')));

  // the segmented bar names each milestone's contribution
  const segs = await page.$$eval('.rm-segs i', (i) => i.map((x) => x.getAttribute('title')));
  check(segs.length === 2 && segs[0] === 'Alpha: 13.2% of the project' && segs[1].startsWith('Beta: '), tag + 'segments name the milestone and its contribution', segs.join(' | '));
  await shot('bar'); await noScroll('project view');

  // saved data: shares add up to 100, stamped; survives a reload
  const p1 = await st();
  const total = p1.milestones.reduce((a, m) => a + m.weight, 0) + p1.unplannedWeight;
  check(total === 100 && p1.milestones.find((m) => m.id === 'a').weight === 40 && p1.milestones.every((m) => m.updatedAt > 1), tag + 'stored shares add up to 100 and are stamped', JSON.stringify(p1.milestones.map((m) => m.weight)) + ' +' + p1.unplannedWeight);
  await page.reload(); await page.waitForSelector('.rm-project');
  check((await countA()).startsWith('1 of 3 items') && (await text('.rm-big')) === '20%', tag + 'after a reload the same', (await countA()) + ' ' + (await text('.rm-big')));
  await openIt('a'); check((await slider()) === 40 && (await page.$$('.ms-item')).length === 3, tag + 'reopened: 40% and the checklist'); await page.keyboard.press('Escape');

  // a task's size
  await page.click('.rm-task-title[data-id="a4"]'); await page.click('[data-action="detail-fold"][data-key="when"]');
  await page.selectOption('[data-detail-size]', 'large');
  check(((await st()).tasks.find((x) => x.id === 'a4') || {}).size === 'large', tag + 'task details: size saved on the task');

  // the Projects tab uses the same numbers (the task panel covers the switch on a phone: close it first)
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
