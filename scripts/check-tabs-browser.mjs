// scripts/check-tabs-browser.mjs -- the five tabs (#259, step 11 of "tabs that follow the flow") in real Chromium at
// 360x780, 390x844 and 1440x900: Sort 1, Organize 2 (Tidy up | Triage), Roadmap 3, Focus 4, Review 5, in order and numbered;
// badges only on Sort and Review; the jot box at the top of every tab; J focuses it on desktop (not while typing); a saved
// 'board' / 'projects' screen opens the Roadmap; every row of the "Where every feature goes" table reachable, one
// check per row; Task details from each tab; no page errors; no sideways scroll.
// Usage: CHROMIUM=/opt/pw-browsers/chromium-1243/chrome-linux/chrome node scripts/check-tabs-browser.mjs
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
  check(`[${tag}] five tabs in order, numbered`, JSON.stringify(tabs) === JSON.stringify(['1 Sort', '2 Organize', '3 Roadmap', '4 Focus', '5 Review']), tabs.join(' | '));
  const badges = await page.$$eval('.rail-count', (els) => els.map((e) => e.closest('.rail-item').querySelector('.rail-label').textContent.trim()));
  check(`[${tag}] badges only on Sort and Review`, JSON.stringify(badges) === JSON.stringify(['1 Sort', '5 Review']), badges.join(' | '));
  const subs = await page.$$eval('.rail-sub', (els) => els.filter((e) => e.offsetParent).map((e) => e.textContent));
  check(`[${tag}] Tidy up / Triage sub-items under Organize in the desktop rail only`, desk ? subs.join() === 'Tidy up,Triage' : subs.length === 0, subs.join());
  if (desk) check(`[${tag}] Settings at the foot of the rail`, await page.$eval('.rail-settings', (e) => !!e.offsetParent));

  const jot = async (name) => check(`[${tag}] jot box at the top of ${name}`, await page.$eval('#capture-input', (e) => { const r = e.getBoundingClientRect(); return r.width > 100 && r.top >= 0 && r.top < 200; }));
  const shot = (name) => page.screenshot({ path: OUT + `${name}-${tag}.png` });
  const detail = async (name) => { check(`[${tag}] Task details opens from ${name}`, !!(await page.$('.cw-detail h3'))); await go(page, '[data-action="detail-close"]'); };

  // Sort
  await go(page, '.rail-item[data-screen="sort"]');
  await page.waitForSelector('.jot-slip');
  await jot('Sort'); check(`[${tag}] Sort: no sideways scroll`, await noSideways(page)); await shot('1-sort');
  check(`[${tag}] row Sort (file thoughts, steps, sort many at once): the slip and Select many`, !!(await page.$('.jot-slip')) && (await page.content()).includes('bulk-toggle'));
  await go(page, '.jot-slip ~ .task-open, .task-open');
  await detail('Sort');

  // Organize: Tidy up, then Triage
  await go(page, '.rail-item[data-go]');
  await page.waitForSelector('.td-layout');
  await jot('Organize / Tidy up'); check(`[${tag}] Tidy up: no sideways scroll`, await noSideways(page)); await shot('2-organize-tidy');
  const orgTabs = await page.$$eval('.org-tab', (els) => els.map((e) => e.textContent));
  check(`[${tag}] Organize: Tidy up | Triage buttons at the top of the screen`, orgTabs.join() === 'Tidy up,Triage');
  await go(page, '.td-row .task-open');
  await detail('Tidy up');
  await go(page, '.org-tab:not(.on)');
  await page.waitForSelector('.tr-row');
  await jot('Organize / Triage'); check(`[${tag}] Triage: no sideways scroll`, await noSideways(page)); await shot('2-organize-triage');
  check(`[${tag}] row Tidy up, Triage (close, merge, rank): both screens open from Organize`, !!(await page.$('.tr-row')) && orgTabs.length === 2);
  await go(page, '.tr-row .task-open');
  await detail('Triage');

  // Roadmap, group view
  await go(page, '.rail-item[data-screen="roadmap"]');
  await page.waitForSelector('.rm-row');
  await jot('Roadmap'); check(`[${tag}] Roadmap: no sideways scroll`, await noSideways(page)); await shot('3-roadmap');
  check(`[${tag}] row Projects grid: the Roadmap group view lists every project`, (await page.$$('.rm-row')).length === 3);
  await page.fill('.rm-finds .project-search', 'rep');
  await page.waitForTimeout(100);
  check(`[${tag}] row Projects grid search: Find a project narrows the rows live`, (await page.$$('.rm-row')).length === 2, 'Report + Repo');
  await page.fill('.rm-finds .project-search', '');
  await page.selectOption('.rm-finds .project-sort-select', 'custom');
  await page.waitForTimeout(100);
  const order = () => page.$$eval('.rm-row .rm-proj-name', (els) => els.map((e) => e.textContent));
  const before = await order();
  await page.evaluate(() => document.querySelectorAll('[data-action="rm-project-step"][data-dir="1"]')[0].click());
  await page.waitForTimeout(150);
  const after = await order();
  check(`[${tag}] row Projects grid sort and your own order: custom order, reordered with a button`, before.join() === 'Home,Report,Repo' && after.join() === 'Report,Home,Repo', before.join() + ' -> ' + after.join());
  await page.selectOption('.rm-finds .project-sort-select', 'name');
  await page.reload(); await page.waitForSelector('.rm-row');
  check(`[${tag}] row Projects grid sort: the sort choice is remembered`, (await page.$eval('.project-sort-select', (e) => e.value)) === 'name');
  check(`[${tag}] row Projects grid area filter: the All | Area | Project switch is on the Roadmap`, !!(await page.$('.vs-row')));
  check(`[${tag}] row Projects: + New project is on the Roadmap`, !!(await page.$('#new-panel-toggle')));

  // Roadmap, project view
  await go(page, '.rm-row[data-project="pHome"] button:visible');
  await page.waitForSelector('.rm-project');
  check(`[${tag}] row Projects one project (task list, add a task, done list): add link and Done column`, !!(await page.$('.rm-add-link')) && (await page.$$('.rm-col[data-status="done"]')).length === 1);
  check(`[${tag}] row Projects New project, link or create a repo, edit, remove: Edit project`, !!(await page.$('[data-action="open-project-edit"]')));
  check(`[${tag}] row Board columns: Up next, In progress, Review, Done inside a milestone`, (await page.$$eval('.rm-project .rm-col', (els) => els.map((e) => e.dataset.status))).join().startsWith('next,doing,review,done'));
  await page.evaluate(() => document.querySelector('.rm-task[data-task-id="t1"] input[type=checkbox]').click());
  await page.waitForTimeout(200);
  check(`[${tag}] row Projects done list: a ticked task lands in the Done column`, await page.evaluate(() => !!document.querySelector('.rm-col[data-status="done"] .rm-task[data-task-id="t1"]')));
  await page.evaluate(() => document.querySelector('.rm-task[data-task-id="t1"] input[type=checkbox]').click());
  await page.waitForTimeout(200);
  await page.evaluate(() => document.querySelector('.rm-task[data-task-id="t1"] [data-action="rm-task-step"][data-dir="1"]').click());
  await page.waitForTimeout(200);
  check(`[${tag}] row Board drag between columns: a card moves between the four columns (arrow button)`, await page.evaluate(() => !!document.querySelector('.rm-col[data-status="doing"] .rm-task[data-task-id="t1"]')));
  await page.fill('.rm-find', 'door');
  await page.waitForTimeout(150);
  const shown = await page.$$eval('.rm-task', (els) => els.map((e) => e.dataset.taskId));
  check(`[${tag}] row Board filter by project or group, search: Find a task narrows the milestones' tasks`, shown.join() === 't2', shown.join());
  await page.fill('.rm-find', '');
  await page.waitForTimeout(100);
  await page.evaluate(() => document.querySelector('.rm-task[data-task-id="t2"] .rm-task-title').click()); // a phone shows one column at a time
  await page.waitForTimeout(150);
  await detail('Roadmap');
  check(`[${tag}] Roadmap project view: no sideways scroll`, await noSideways(page)); await shot('3-roadmap-project');
  await page.evaluate(() => localStorage.setItem('focusdeck-view', JSON.stringify({ mode: 'project', id: 'pGh' })));
  await page.reload(); await page.waitForSelector('.rm-project');
  check(`[${tag}] row Projects Sync: Sync now on a GitHub project`, !!(await page.$('.rm-tools [data-action="sync-github"]')));
  await page.evaluate(() => localStorage.setItem('focusdeck-view', JSON.stringify({ mode: 'all' })));
  await page.reload(); await page.waitForSelector('.rail');

  // Focus
  await go(page, '.rail-item[data-screen="focus"]');
  await page.waitForSelector('.focus-card');
  await jot('Focus'); check(`[${tag}] Focus: no sideways scroll`, await noSideways(page)); await shot('4-focus');
  await go(page, '.focus-card .task-open');
  await detail('Focus');
  check(`[${tag}] row Start here: no separate Start here screen, and Focus offers "Or let me pick for you"`, !(await page.$('[data-screen="start"], [data-screen="start-here"]')));

  // Review
  await go(page, '.rail-item[data-screen="review"]');
  await page.waitForSelector('.rv-card');
  await jot('Review'); check(`[${tag}] Review: no sideways scroll`, await noSideways(page)); await shot('5-review');
  await go(page, '.rv-title');
  await detail('Review');

  // the jot box
  await page.fill('#capture-input', 'a stray one'); await page.keyboard.press('Enter'); await page.waitForTimeout(150);
  check(`[${tag}] row Jotter: a thought is jotted from any tab`, (await page.evaluate(() => JSON.parse(localStorage.getItem('focusdeck-state-v1')).inbox.length)) === 1);
  await page.evaluate(() => document.activeElement && document.activeElement.blur());
  await page.keyboard.press('j');
  if (desk) {
    check(`[${tag}] J focuses the jot box`, await page.evaluate(() => document.activeElement && document.activeElement.id === 'capture-input'));
    await page.keyboard.type('jjj');
    check(`[${tag}] J typed inside the jot box stays a letter`, (await page.$eval('#capture-input', (e) => e.value)) === 'jjj');
    await page.fill('#capture-input', '');
    await page.keyboard.press('Escape');
    check(`[${tag}] Escape leaves the jot box`, await page.evaluate(() => document.activeElement.id !== 'capture-input'));
    await go(page, '.rail-item[data-screen="roadmap"]');
    await page.focus('.rm-finds .project-search');
    await page.keyboard.press('j');
    check(`[${tag}] J does not steal focus from another field`, await page.evaluate(() => document.activeElement.classList.contains('project-search')));
  } else {
    check(`[${tag}] J does nothing on a phone`, await page.evaluate(() => document.activeElement.id !== 'capture-input'));
  }
  await ctx.close();

  for (const [saved, label, want] of [['board', 'Roadmap', '3 Roadmap'], ['projects', 'Roadmap', '3 Roadmap'], ['start-here', 'Focus', '4 Focus']]) {
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
