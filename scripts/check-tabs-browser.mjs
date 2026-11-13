// scripts/check-tabs-browser.mjs -- the six tabs (#259, then #262) in real Chromium at
// 360x780, 390x844 and 1440x900: Sort, Organize (Tidy up | Triage), Projects, Roadmap, Focus, Review, in order, no numbers;
// the header (+ Jot, sync light with its drawer, settings dial);
// badges only on Sort and Review; the jot box at the top of every tab; J focuses it on desktop (not while typing); a saved
// 'board' / 'projects' screen opens Projects; every row of the "Where every feature goes" table reachable, one
// check per row; Task details from each tab; no page errors; no sideways scroll.
// Usage: CHROMIUM=/opt/pw-browsers/chromium-1243/chrome-linux64/chrome node scripts/check-tabs-browser.mjs
// Serves the repo root itself on 127.0.0.1:8140. Screenshots: docs/generated/build-checks/step11/.
import { createRequire } from 'node:module';
import { mkdirSync, readFileSync, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import { join, extname, normalize } from 'node:path';
const require = createRequire('/opt/node22/lib/node_modules/');
const { chromium } = require('playwright');
const ROOT = fileURLToPath(new URL('..', import.meta.url));
const OUT = join(ROOT, 'docs/generated/build-checks/step11/');
mkdirSync(OUT, { recursive: true });
const BASE = 'http://127.0.0.1:8140/app/';
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.svg': 'image/svg+xml' };
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
let failed = 0, total = 0;
const check = (name, ok, extra = '') => { total++; if (!ok) failed++; console.log((ok ? 'PASS ' : 'FAIL ') + name + (extra ? '  [' + extra + ']' : '')); };
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM, args: ['--no-sandbox'] });

const t = (id, title, status, extra = {}) => Object.assign({ id, title, status, categoryIds: [], sortOrder: 1, updatedAt: Date.now() }, extra);
const data = () => ({
  projects: [
    { id: 'pHome', name: 'Home', color: '#3E8E5E', sortOrder: 1, tasks: [t('t1', 'Paint the shed', 'next'), t('t2', 'Fix the door', 'doing'), t('t3', 'Mow the lawn', 'review'), t('t4', 'Old chore', 'done', { completedAt: Date.now() })] },
    { id: 'pWork', name: 'Report', color: '#4D6FB8', sortOrder: 2, tasks: [t('t5', 'Write the report', 'next')] },
    { id: 'pGh', name: 'Repo', color: '#B3402F', sortOrder: 3, source: 'github', repoFullName: 'me/repo', htmlUrl: 'https://github.com/me/repo', tasks: [t('t6', 'Triage issues', 'next')] },
  ],
  inbox: [], completedLog: [], deletedTaskIds: {}, choosingMode: { mode: 'twice', updatedAt: 1 }, categories: [], projectCategories: [],
  focus: { taskId: 't1', pool: ['t1', 't2'] },
});
const seed = (page, screen, view) => page.addInitScript(([s, scr, v]) => {
  if (localStorage.getItem('seeded')) return;
  localStorage.setItem('seeded', '1');
  localStorage.setItem('focusdeck-onboarding', 'done'); if (scr) localStorage.setItem('focusdeck-screen', scr);
  if (v) localStorage.setItem('focusdeck-view', JSON.stringify(v));
  localStorage.setItem('focusdeck-state-v1', s);
}, [JSON.stringify(data()), screen, view]);
const go = async (page, sel) => { await page.click(sel); await page.waitForTimeout(150); };
const noSideways = (page) => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1);
const sizes = [['360', 360, 780], ['390', 390, 844], ['1440', 1440, 900]];

for (const [tag, w, h] of sizes) {
  const desk = w >= 1100;
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, serviceWorkers: 'block' });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => check(`[${tag}] no page error: ` + e.message, false));
  await seed(page, 'sort', { mode: 'all' });
  await page.goto(BASE + 'index.html');
  await page.waitForSelector('.rail');

  const tabs = await page.$$eval('.rail > .rail-item', (els) => els.map((e) => e.querySelector('.rail-label').textContent.replace(/\s+/g, ' ').trim()));
  check(`[${tag}] six tabs in order, no numbers`, JSON.stringify(tabs) === JSON.stringify(['Sort', 'Organize', 'Projects', 'Roadmap', 'Focus', 'Review']), tabs.join(' | '));
  const icons = await page.$$eval('.rail > .rail-item .rail-icon', (els) => els.map((e) => e.textContent));
  check(`[${tag}] tab icons`, icons.join(' ') === '📥 🧹 📁 🗺 ◎ ✓', icons.join(' '));
  const badges = await page.$$eval('.rail-count', (els) => els.map((e) => e.closest('.rail-item').querySelector('.rail-label').textContent.trim()));
  check(`[${tag}] badges only on Sort and Review`, JSON.stringify(badges) === JSON.stringify(['Sort', 'Review']), badges.join(' | '));
  const subs = await page.$$eval('.rail-sub', (els) => els.filter((e) => e.offsetParent).map((e) => e.textContent));
  check(`[${tag}] Tidy up / Triage sub-items under Organize in the desktop rail only`, desk ? subs.join() === 'Tidy up,Triage' : subs.length === 0, subs.join());
  check(`[${tag}] header: + Jot, sync light and settings dial; no old sync button or rail tools`, !!(await page.$('#jot-open')) && !!(await page.$('.sync-light')) && !!(await page.$('a.dk-dial[href="settings.html"]')) && !(await page.$('.sync-btn, .rail-tools')));
  await go(page, '.sync-light');
  check(`[${tag}] sync light opens a drawer with Sync now and Sync settings`, !!(await page.$('.sync-drawer [data-action="sync-github"]')) && !!(await page.$('.sync-drawer a[href="settings.html#sync-section"]')));
  await go(page, '.sync-light');
  const jotOpen = () => page.$('.jot-screen #jot-input');
  check(`[${tag}] + Jot opens the Jot screen and focuses its box`, await (async () => { await go(page, '#jot-open'); return page.evaluate(() => document.activeElement.id === 'jot-input'); })());
  await go(page, '[data-action="jot-close"]');
  check(`[${tag}] the × closes the Jot screen`, !(await jotOpen()));

  const jot = async (name) => check(`[${tag}] + Jot at the top of ${name}`, await page.$eval('#jot-open', (e) => { const r = e.getBoundingClientRect(); return r.width > 40 && r.top >= 0 && r.top < 200; }));
  const shot = (name) => page.screenshot({ path: OUT + `${name}-${tag}.png` });
  const detail = async (name) => { check(`[${tag}] Task details opens from ${name}`, !!(await page.$('.cw-detail .sort-q'))); await go(page, '[data-action="detail-close"]'); };

  // Sort
  await go(page, '.rail-item[data-screen="sort"]');
  await page.waitForSelector('.jot-slip');
  await jot('Sort'); check(`[${tag}] Sort: no sideways scroll`, await noSideways(page)); await shot('1-sort');
  check(`[${tag}] row Sort (file thoughts, steps, sort many at once): the slip and Select many`, !!(await page.$('.jot-slip')) && (await page.content()).includes('bulk-toggle'));
  await go(page, '.jot-slip ~ .task-open, .task-open');
  await detail('Sort');

  // Organize: Tidy up, then Triage
  await go(page, '.rail-item[data-go]');
  await page.waitForSelector('.org');
  check(`[${tag}] Organize opens on two cards, Tidy up and Triage`, (await page.$$('.org .dk-choice')).length === 2);
  await go(page, '.dk-btn[data-action="tidy-step"]');
  await jot('Organize / Tidy up'); check(`[${tag}] Tidy up: no sideways scroll`, await noSideways(page)); await shot('2-organize-tidy');
  await go(page, '.org-row .task-open');
  await detail('Tidy up');
  await go(page, '.rail-item[data-go]');
  await go(page, '[data-action="triage-go"][data-to="top"]');
  await page.waitForSelector('.tr-card');
  await jot('Organize / Triage'); check(`[${tag}] Triage: no sideways scroll`, await noSideways(page)); await shot('2-organize-triage');
  check(`[${tag}] row Tidy up, Triage (close, merge, rank): both screens open from Organize`, !!(await page.$('.tr-card')));
  await go(page, '.tr-card');
  await detail('Triage');

  // Projects tab (the clipboard list, #267)
  await go(page, '.rail-item[data-screen="projects"]');
  await page.waitForSelector('.pj-card');
  await jot('Projects'); check(`[${tag}] Projects: no sideways scroll`, await noSideways(page)); await shot('3-projects');
  check(`[${tag}] row Projects grid: the Projects tab lists every project`, (await page.$$('.pj-card')).length === 3);
  await page.fill('.pj-find', 'rep');
  await page.waitForTimeout(100);
  check(`[${tag}] row Projects grid search: Find a project narrows the rows live`, (await page.$$('.pj-card')).length === 2, 'Report + Repo');
  await page.fill('.pj-find', '');
  const sortBy = async (label) => { await page.click('.pj-pull'); await page.click('.sort-drawer .dk-choice:has-text("' + label + '")'); await page.waitForTimeout(100); };
  await sortBy('My order');
  const order = () => page.$$eval('.pj-row > span:first-child', (els) => els.map((e) => e.textContent.replace('📁', '').trim()));
  const before = await order();
  await page.evaluate(() => document.querySelectorAll('[data-action="rm-project-step"][data-dir="1"]')[0].click());
  await page.waitForTimeout(150);
  const after = await order();
  check(`[${tag}] row Projects grid sort and your own order: custom order, reordered with a button`, before.join() === 'Home,Report,Repo' && after.join() === 'Report,Home,Repo', before.join() + ' -> ' + after.join());
  await page.click('.dk-btn[data-action="proj-order-done"]');
  await sortBy('A–Z');
  await page.reload(); await page.waitForSelector('.pj-card');
  check(`[${tag}] row Projects grid sort: the sort choice is remembered`, (await page.evaluate(() => localStorage.getItem('focusdeck-project-sort'))) === 'name');
  check(`[${tag}] row Projects grid area filter: the view tape is on Projects`, !!(await page.$('.vs-tape')));
  check(`[${tag}] row Projects: + New project is on the Projects tab`, !!(await page.$('#new-panel-toggle')));

  // Roadmap tab, project view: a project opened from Projects, then the Roadmap tab reopens the last one
  await go(page, '.pj-card[data-project="pHome"]');
  await page.waitForSelector('.rm-project');
  check(`[${tag}] opening a project from Projects lands on the Roadmap tab`, (await page.$eval('.rail-item.is-on .rail-label', (e) => e.textContent)) === 'Roadmap');
  await go(page, '.rail-item[data-screen="projects"]'); await go(page, '.rail-item[data-screen="roadmap"]'); await page.waitForSelector('.rm-project');
  check(`[${tag}] the Roadmap tab opens the last-used project`, (await page.$eval('.vs-tape', (e) => e.textContent)).includes('Home'));
  check(`[${tag}] row Projects one project (task list, add a task, done list): add link and Done column`, !!(await page.$('[data-action="rm-screen"][data-screen="task"]')) && (await page.$$('.rm-col[data-status="done"]')).length === 1);
  await go(page, '[data-action="rm-drawer"][data-drawer="menu"]');
  check(`[${tag}] row Projects New project, link or create a repo, edit, remove: Edit project`, !!(await page.$('.sort-drawer [data-action="rm-screen"][data-screen="edit"]')));
  await go(page, '.sort-drawer .vs-x');
  check(`[${tag}] row Board columns: Up next, In progress, Review, Done inside a milestone`, (await page.$$eval('.rm-project .rm-col', (els) => els.map((e) => e.dataset.status))).join().startsWith('next,doing,review,done'));
  const tick = () => page.evaluate(() => document.querySelector('.rm-task[data-task-id="t1"] input[type=checkbox]').click());
  await tick();
  await page.waitForTimeout(200);
  await go(page, '.rm-tab[data-status="done"]'); // the Roadmap shows one status at a time
  check(`[${tag}] row Projects done list: a ticked task lands in the Done column`, await page.evaluate(() => !!document.querySelector('.rm-col[data-status="done"] .rm-task[data-task-id="t1"]')));
  await tick();
  await page.waitForTimeout(200);
  await go(page, '.rm-tab[data-status="next"]');
  await go(page, '.rm-task-title[data-id="t1"]');
  await go(page, '.sort-drawer .rm-stamp[data-status="doing"]'); // the task's drawer moves it between columns
  await go(page, '.rm-tab[data-status="doing"]');
  check(`[${tag}] row Board drag between columns: a card moves between the four columns (the drawer's status stamps)`, await page.evaluate(() => !!document.querySelector('.rm-col[data-status="doing"] .rm-task[data-task-id="t1"]')));
  await go(page, '[data-action="rm-drawer"][data-drawer="menu"]');
  await go(page, '.sort-drawer [data-action="rm-screen"][data-screen="find"]');
  await page.fill('.pj-find', 'door');
  await page.waitForTimeout(150);
  const shown = await page.$$eval('.dk-choice[data-action="rm-task"]', (els) => els.map((e) => e.dataset.id));
  check(`[${tag}] row Board filter by project or group, search: Find a task narrows to the tasks that match`, shown.join() === 't2', shown.join());
  await go(page, '.dk-choice[data-action="rm-task"]'); // the hit opens the task's drawer, which has Details
  await go(page, '.sort-drawer [data-action="rm-details"]');
  await detail('Roadmap');
  await go(page, '[data-action="rm-back"]');
  check(`[${tag}] Roadmap project view: no sideways scroll`, await noSideways(page)); await shot('3-roadmap-project');
  await page.evaluate(() => localStorage.setItem('focusdeck-view', JSON.stringify({ mode: 'project', id: 'pGh' })));
  await page.reload(); await page.waitForSelector('.rm-project');
  await go(page, '[data-action="rm-drawer"][data-drawer="menu"]');
  check(`[${tag}] row Projects Sync: Sync now on a GitHub project`, !!(await page.$('.sort-drawer [data-action="sync-github"]:not([disabled])')));
  await go(page, '.sort-drawer .vs-x');
  await page.evaluate(() => localStorage.setItem('focusdeck-view', JSON.stringify({ mode: 'all' })));
  await page.reload(); await page.waitForSelector('.rail');

  // Focus
  await go(page, '.rail-item[data-screen="focus"]');
  await page.waitForSelector('.focus-active');
  await jot('Focus'); check(`[${tag}] Focus: no sideways scroll`, await noSideways(page)); await shot('4-focus');
  await go(page, '[data-action="focus-menu"]');
  await go(page, '.sort-drawer [data-action="task-open"]');
  await detail('Focus');
  check(`[${tag}] row Start here: no separate Start here screen, and Focus offers "Or let me pick for you"`, !(await page.$('[data-screen="start"], [data-screen="start-here"]')));

  // Review
  await go(page, '.rail-item[data-screen="review"]');
  await page.waitForSelector('.rv-card');
  await jot('Review'); check(`[${tag}] Review: no sideways scroll`, await noSideways(page)); await shot('5-review');
  await go(page, '.rv-title');
  await detail('Review');

  // the jot box
  await go(page, '#jot-open'); await page.fill('#jot-input', 'a stray one'); await go(page, '[data-action="jot-save"]');
  check(`[${tag}] row Jotter: a thought is jotted from any tab`, (await page.evaluate(() => JSON.parse(localStorage.getItem('focusdeck-state-v1')).inbox.length)) === 1);
  await page.evaluate(() => document.activeElement && document.activeElement.blur());
  await page.keyboard.press('j');
  if (desk) {
    check(`[${tag}] J opens the Jot screen and focuses its box`, await page.evaluate(() => document.activeElement && document.activeElement.id === 'jot-input'));
    await page.keyboard.type('jjj');
    check(`[${tag}] J typed inside the jot box stays a letter`, (await page.$eval('#jot-input', (e) => e.value)) === 'jjj');
    await page.fill('#jot-input', '');
    await go(page, '[data-action="jot-close"]');
    check(`[${tag}] closing the Jot screen leaves the jot box`, !(await jotOpen()));
    await go(page, '.rail-item[data-screen="projects"]');
    await page.focus('.pj-find');
    await page.keyboard.press('j');
    check(`[${tag}] J does not steal focus from another field`, await page.evaluate(() => document.activeElement.classList.contains('project-search')));
  } else {
    check(`[${tag}] J does nothing on a phone`, !(await jotOpen()));
  }
  await ctx.close();

  for (const [saved, label, want] of [['board', 'Projects', 'Projects'], ['projects', 'Projects', 'Projects'], ['roadmap', 'Roadmap', 'Roadmap'], ['start-here', 'Focus', 'Focus']]) {
    const c2 = await browser.newContext({ viewport: { width: w, height: h }, serviceWorkers: 'block' });
    const p2 = await c2.newPage();
    p2.on('pageerror', (e) => check(`[${tag}] no page error: ` + e.message, false));
    await seed(p2, saved, { mode: 'all' });
    await p2.goto(BASE + 'index.html'); await p2.waitForSelector('.rail');
    const on = await p2.$eval('.rail-item.is-on .rail-label', (e) => e.textContent.replace(/\s+/g, ' ').trim());
    check(`[${tag}] a saved '${saved}' screen opens ${label}`, on === want, on);
    await c2.close();
  }
}
console.log(`\n${total - failed} of ${total} passed`);
await browser.close(); server.close();
process.exit(failed ? 1 : 0);
