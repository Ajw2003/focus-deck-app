// scripts/check-roadmap-browser.mjs -- the Roadmap (#257, one milestone at a time since #268) in real Chromium at 390x844, 360x780 and 1440x900:
// the Projects tab's cards and percents (All, Area), the clipboard (ruler, four folder tabs, tick rows, the flags), a task moved by the
// drawer's stamps, the tick, and on a computer a drag onto a folder tab and Alt+Arrow, a task to another milestone, milestones and
// sections reordered (↑↓ keys, or drag / Alt+Up/Down on a computer), add a task / milestone / section, Make it a milestone, Edit project
// and Remove asking first, New project (on the Projects tab, #267), a reload keeps it all, the 6-tab phone bar fits, no page errors, no sideways scroll.
// Usage: CHROMIUM=/opt/pw-browsers/chromium-1243/chrome-linux/chrome node scripts/check-roadmap-browser.mjs
// Serves the repo root on 127.0.0.1:8141. Screenshots: docs/generated/build-checks/step9/roadmap-*.png
// A phone has no touch drag here (grips are hidden; scripts/lib/touch.mjs is not used): it moves with buttons.
import { createRequire } from 'node:module';
import { mkdirSync, readFileSync, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import { join, extname, normalize } from 'node:path';
const require = createRequire('/opt/node22/lib/node_modules/');
const { chromium } = require('playwright');
const ROOT = fileURLToPath(new URL('..', import.meta.url));
const OUT = join(ROOT, 'docs/generated/build-checks/step9/');
mkdirSync(OUT, { recursive: true });
const BASE = 'http://127.0.0.1:8141/app/';
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
await new Promise((ok) => server.listen(8141, '127.0.0.1', ok));

const now = Date.now();
const t = (id, title, status, extra) => Object.assign({ id, title, status, updatedAt: now - 1000, sortOrder: 1, categoryIds: [] }, extra);
const seed = () => ({
  projectCategories: [{ id: 'a1', name: 'Apps', color: '#C9584F' }, { id: 'a2', name: 'Home', color: '#3E8E5E' }],
  projects: [
    { id: 'p0', name: 'Focus Deck', color: '#C9584F', categoryId: 'a1', sortOrder: 1,
      sections: [{ id: 'sec1', name: 'Foundations', order: 1, updatedAt: 1 }, { id: 'sec2', name: 'Plan tools', order: 2, updatedAt: 1 }],
      milestones: [
        { id: 'm1', name: 'Start here screen', sectionId: 'sec1', order: 1, updatedAt: 1 },
        { id: 'mg2', name: 'Areas', sectionId: 'sec1', order: 2, githubMilestone: 'Areas', updatedAt: 1 },
        { id: 'm3', name: 'Tidy up and Triage', sectionId: 'sec2', order: 1, parentTaskId: 'par', updatedAt: 1 }],
      tasks: [
        t('s1', 'Test on phone', 'next', { milestoneId: 'm1' }), t('s2', 'Open on Start here', 'doing', { milestoneId: 'm1' }), t('s3', 'Pick one for me', 'review', { milestoneId: 'm1' }),
        t('s4', 'Three suggestions', 'done', { milestoneId: 'm1' }), t('s5', 'Tab on phone', 'done', { milestoneId: 'm1' }),
        t('g1', 'Areas from GitHub', 'next', { githubMilestone: 'Areas' }), t('g2', 'Areas shipped', 'done', { githubMilestone: 'Areas' }),
        t('par', 'Tidy up and Triage work', 'next'), t('sub1', 'Tidy done', 'done', { parentId: 'par' }), t('sub2', 'Triage next', 'next', { parentId: 'par' }), t('sub3', 'Triage later', 'next', { parentId: 'par' }),
        t('loose', 'Loose task', 'next'), t('par2', 'Android app', 'next'), t('kid1', 'Android build', 'done', { parentId: 'par2' }), t('kid2', 'Android test', 'next', { parentId: 'par2' })] },
    { id: 'p1', name: 'UnamedSoulsLike', color: '#2A9D8F', categoryId: 'a1', sortOrder: 2,
      sections: [{ id: 'secg', name: 'Core', order: 1, updatedAt: 1 }], milestones: [{ id: 'bf', name: 'Boss fight', sectionId: 'secg', order: 1, measure: 'phases built', updatedAt: 1 }],
      tasks: [t('b1', 'Phase one', 'done', { milestoneId: 'bf' }), t('b2', 'Phase two', 'next', { milestoneId: 'bf' })] },
    { id: 'p2', name: 'Plain tools', color: '#8E6BBF', categoryId: 'a1', sortOrder: 3, tasks: [t('o1', 'Old one', 'done'), t('o2', 'Old two', 'next'), t('o3', 'Old three', 'next')] },
    { id: 'p3', name: 'Garden', color: '#3E8E5E', categoryId: 'a2', sortOrder: 4, tasks: [t('h1', 'Weed', 'done'), t('h2', 'Water', 'next')] },
  ],
  categories: [], inbox: [], completedLog: [], deletedTaskIds: {}, choosingMode: { mode: 'twice', updatedAt: 1 },
});
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
  const shot = (n) => page.screenshot({ path: OUT + 'roadmap-' + w + '-' + n + '.png', fullPage: true });
  const st = () => page.evaluate(() => JSON.parse(localStorage.getItem('focusdeck-state-v1')));
  const task = async (id) => (await st()).projects.flatMap((p) => p.tasks).find((x) => x.id === id);
  const proj = async (id) => (await st()).projects.find((p) => p.id === id);
  const noScroll = async (n) => check(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), tag + 'no sideways scroll ' + n);
  const goRoadmap = async () => { await page.click('[data-screen="roadmap"]'); await page.waitForSelector('.rm'); };
  const goProjects = async () => { await page.click('[data-screen="projects"]'); await page.waitForSelector('.pj'); };
  // the view tape: Everything, or One area / One project and then the pick
  const pickView = async (mode, id) => {
    await page.click('.vs-tape');
    if (mode === 'all') await page.click('.vs-pop .dk-choice[data-mode="all"]');
    else { await page.click('[data-action="view-step"][data-step="' + mode + '"]'); await page.click('.vs-item[data-id="' + id + '"]'); }
  };
  const box = async (sel) => (await (await page.$(sel)).boundingBox());
  const drag = async (fromSel, toSel, dy = 6) => {
    const g = await box(fromSel), r = await box(toSel);
    await page.mouse.move(g.x + g.width / 2, g.y + g.height / 2); await page.mouse.down();
    await page.mouse.move(g.x + 12, g.y + 12, { steps: 4 }); await page.mouse.move(r.x + Math.min(40, r.width / 2), r.y + dy, { steps: 10 }); await page.mouse.up();
  };
  const secs = async () => (await proj('p0')).sections.slice().sort((a, b) => a.order - b.order).map((s) => s.id).join();

  // six tabs on the phone bar: every label whole
  const fit = await page.evaluate(() => {
    const items = [...document.querySelectorAll('.rail-item')].filter((i) => i.offsetParent);
    return { n: items.length, clipped: items.filter((i) => i.querySelector('.rail-label').scrollWidth > i.clientWidth).map((i) => i.textContent.trim()).join() };
  });
  check(fit.n === 6 && fit.clipped === '', tag + 'six tabs (Projects is its own tab since #262), no label clipped', fit.n + ' ' + fit.clipped);
  check((await page.$$eval('.rail-label', (l) => l.filter((x) => x.offsetParent).map((x) => x.textContent.replace(/\s+/g, ' ').trim()).join())) === 'Sort,Organize,Projects,Roadmap,Focus,Review', tag + 'tab order');
  if (phone) await page.screenshot({ path: OUT + 'roadmap-' + w + '-tabbar.png', clip: { x: 0, y: h - 90, width: w, height: 90 } });

  // Projects tab: a card and a ruler per project; All, then Area
  await goProjects();
  check((await page.textContent('.sort-q')) === 'Projects', tag + 'the Projects clipboard is titled Projects');
  check((await page.$$('.pj-card')).length === 4, tag + 'a card per project on All');
  await pickView('area', 'a1');
  check((await page.$$('.pj-card')).length === 3, tag + 'Area Apps: three cards');
  check((await page.getAttribute('.pj-card[data-project="p0"] .pj-ruler', 'aria-label')) === '37% done', tag + 'Focus Deck says 37% done (equal milestone shares: 40, 50, 33, 25)');
  check((await page.getAttribute('.pj-card[data-project="p1"] .pj-ruler', 'aria-label')) === '50% done', tag + 'second project 50%');
  await noScroll('projects'); await shot('projects');
  await page.click('.pj-card[data-project="p0"]'); await page.waitForSelector('.rm-main');
  check(!(await page.$('#new-panel-toggle')), tag + 'the Roadmap has no + New project (Projects owns it)');

  // the milestone on the clipboard
  check((await page.textContent('.sort-q')) === 'Start here screen', tag + 'the clipboard opens on the first milestone with open tasks');
  check((await page.$$eval('.rm-tab', (b) => b.map((x) => x.dataset.status).join())) === 'next,doing,review,done' && (await page.$$eval('.rm-task-title', (b) => b.map((x) => x.textContent).join('|'))) === 'Test on phone', tag + 'four folder tabs; Up next lists its task');
  await page.click('.rm-tab[data-col="review"]');
  check((await page.$$eval('.rm-task-title', (b) => b.map((x) => x.textContent).join('|'))) === 'Pick one for me', tag + 'the Review tab shows its one task');
  await page.click('.rm-tab[data-col="next"]');
  await page.click('.rm-flag[aria-label="Next milestone"]');
  check((await page.textContent('.sort-q')) === 'Areas' && (await page.$$eval('.rm-task-title', (b) => b.map((x) => x.textContent).join('|'))) === 'Areas from GitHub', tag + '› steps to Areas; the GitHub-milestone task is in it');
  await page.click('.rm-flag[aria-label="Previous milestone"]');
  await noScroll('clipboard'); await shot('project');

  // a task between columns: the drawer's stamps and the tick, then (on a computer) drag and Alt+Arrow
  await page.click('.rm-task-title[data-id="s1"]');
  await page.click('.rm-stamp[data-status="doing"]');
  check((await task('s1')).status === 'doing', tag + 'the Doing stamp moves Test on phone to Doing');
  await page.click('.rm-tab[data-col="doing"]');
  await page.click('.rm-task-title[data-id="s1"]');
  await page.click('.rm-stamp[data-status="review"]');
  check((await task('s1')).status === 'review', tag + 'the Review stamp moves it on');
  await page.click('.rm-tab[data-col="review"]');
  await page.click('.rm-task-title[data-id="s1"]');
  await page.click('.rm-stamp[data-status="done"]');
  const s1 = await task('s1');
  check(s1.status === 'done' && typeof s1.completedAt === 'number', tag + 'the Done stamp sets completedAt');
  await page.click('.rm-tab[data-col="done"]');
  await page.click('.rm-task[data-task-id="s1"] .rm-tick');
  check((await task('s1')).status === 'next' && (await task('s1')).completedAt === undefined, tag + 'unticking a done task puts it back in Up next');
  await page.click('.rm-tab[data-col="next"]');
  await page.click('.rm-task[data-task-id="s1"] .rm-tick');
  check((await task('s1')).status === 'done', tag + 'ticking a task finishes it');
  await page.click('.rm-tab[data-col="done"]');
  await page.click('.rm-task[data-task-id="s1"] .rm-tick');
  await page.click('.rm-tab[data-col="next"]');
  if (!phone) {
    await drag('.rm-task[data-task-id="s1"] .rm-grip', '.rm-tab[data-status="doing"]');
    check((await task('s1')).status === 'doing', tag + 'mouse drag onto the Doing tab');
    await page.click('.rm-tab[data-col="doing"]');
    await drag('.rm-task[data-task-id="s1"] .rm-grip', '.rm-tab[data-status="next"]');
    check((await task('s1')).status === 'next', tag + 'and back onto Up next (any direction)');
    await page.click('.rm-tab[data-col="next"]');
    await page.focus('.rm-task[data-task-id="s1"] .rm-grip');
    await page.keyboard.press('Alt+ArrowRight');
    check((await task('s1')).status === 'doing', tag + 'Alt+Right moves it one column');
    await page.click('.rm-tab[data-col="doing"]');
    await page.focus('.rm-task[data-task-id="s1"] .rm-grip');
    await page.keyboard.press('Alt+ArrowLeft');
    check((await task('s1')).status === 'next', tag + 'Alt+Left moves it back');
    await page.click('.rm-tab[data-col="next"]');
  }
  // to another milestone
  await page.click('.rm-task-title[data-id="s1"]');
  await page.click('.sort-drawer [data-action="rm-drawer"][data-drawer="move"]');
  await page.click('.sort-drawer [data-action="rm-move-to"][data-ms="mg2"]');
  check((await task('s1')).milestoneId === 'mg2', tag + 'Other milestone moves the task to Areas');
  await page.reload(); await page.waitForSelector('.rm-main');
  check((await task('s1')).milestoneId === 'mg2' && (await page.textContent('.vs-tape')).includes('Focus Deck'), tag + 'a reload keeps the move and the view');

  // milestones between sections, section reorder (All milestones)
  await page.click('.rm-all'); await page.waitForSelector('.rm-all-screen');
  await noScroll('all milestones'); await shot('all');
  if (phone) {
    await page.click('.rm-ms[data-ms-id="m3"] [data-action="rm-ms-step"][data-dir="-1"]');
    check((await proj('p0')).milestones.find((m) => m.id === 'm3').sectionId === 'sec1', tag + 'up key moves Tidy up and Triage into section 1');
    await page.click('.rm-ms[data-ms-id="m3"] [data-action="rm-ms-step"][data-dir="1"]');
    check((await proj('p0')).milestones.find((m) => m.id === 'm3').sectionId === 'sec2', tag + 'down key moves it back');
    await page.click('.rm-sec[data-section-id="sec2"] [data-action="rm-sec-step"][data-dir="-1"]');
    check((await secs()) === 'sec2,sec1', tag + 'up key reorders the sections');
    await page.click('.rm-sec[data-section-id="sec2"] [data-action="rm-sec-step"][data-dir="1"]');
    check((await secs()) === 'sec1,sec2', tag + 'down key puts them back');
  } else {
    await drag('.rm-ms[data-ms-id="m3"] .rm-grip', '.rm-sec[data-section-id="sec1"] .rm-sec-h');
    check((await proj('p0')).milestones.find((m) => m.id === 'm3').sectionId === 'sec1', tag + 'drag moves a milestone into another section');
    await page.keyboard.press('Alt+ArrowDown');
    check((await proj('p0')).milestones.find((m) => m.id === 'm3').sectionId === 'sec2', tag + 'Alt+Down moves it on into the next section');
    await drag('.rm-sec[data-section-id="sec2"] .rm-sec-h .rm-grip', '.rm-sec[data-section-id="sec1"] .rm-sec-h');
    check((await secs()) === 'sec2,sec1', tag + 'dragging a section reorders them');
    await shot('sections-swapped');
    await page.focus('.rm-sec[data-section-id="sec2"] .rm-grip');
    await page.keyboard.press('Alt+ArrowDown');
    check((await secs()) === 'sec1,sec2', tag + 'Alt+Down reorders them back');
  }

  // add a task, a milestone, a section
  await page.click('.rm-ms-open[data-id="m1"]');
  await page.click('.sort-foot [data-action="rm-screen"][data-screen="task"]');
  await page.fill('.pj-field', 'Brand new task');
  await page.click('.sort-foot .dk-btn');
  const nt = (await proj('p0')).tasks.find((x) => x.title === 'Brand new task');
  check(!!nt && nt.milestoneId === 'm1' && nt.status === 'next', tag + '+ Add a task puts it in that milestone, Up next');
  await page.click('.rm-all');
  await page.click('.sort-foot [data-action="rm-screen"][data-screen="ms"]');
  await page.fill('.pj-field', 'Polish');
  await page.click('.sort-foot .dk-btn');
  const nm = (await proj('p0')).milestones.find((m) => m.name === 'Polish');
  check(!!nm && nm.sectionId === 'sec2', tag + '+ Milestone: in the last section by default');
  await page.click('.sort-foot [data-action="rm-screen"][data-screen="sec"]');
  await page.fill('.pj-field', 'Launch');
  await page.click('.sort-foot .dk-btn');
  check((await proj('p0')).sections.some((s) => s.name === 'Launch'), tag + '+ Section');
  check((await page.$$eval('.rm-sec-name', (e) => e.map((x) => x.textContent).join('|'))) === 'Foundations|Plan tools|Launch', tag + 'the new section shows');

  // Make it a milestone, from a task's drawer
  await page.click('.rm-ms-open[data-id="unplanned"]');
  await page.click('.rm-task-title[data-id="par2"]');
  await page.click('.sort-drawer [data-action="rm-make"]');
  const mk = (await proj('p0')).milestones.find((m) => m.parentTaskId === 'par2');
  check(!!mk && mk.name === 'Android app', tag + 'Make it a milestone on a task with subtasks');
  await page.click('.rm-ms-open[data-id="' + (mk || {}).id + '"]');
  check((await page.getAttribute('.pj-ruler', 'aria-label')) === '50% done' && (await page.$$eval('.rm-tab b', (b) => b.map((x) => x.textContent).join())) === '1,0,0,1', tag + 'its subtasks are its tasks (1 of 2)');
  await noScroll('after adds'); await shot('after-adds');

  // Edit project: the receipt, then Remove asks first
  await page.click('.pj-pull'); await page.click('.sort-drawer [data-screen="edit"]');
  check((await page.$$('.dk-pencil')).length === 4 && (await page.textContent('.dk-choice.danger')) === 'Remove project', tag + 'Edit project is a receipt with a pencil a line and Remove project');
  await shot('edit-project');
  await page.click('.dk-choice.danger');
  check((await page.$$eval('.rm-ask .dk-btn', (b) => b.map((x) => x.textContent.trim()).join('|'))) === 'Back|Remove', tag + 'Remove asks first: Back / Remove');
  await page.click('.rm-ask .dk-btn:first-child');
  check(!!(await proj('p0')), tag + 'Back keeps the project');
  await page.click('.dk-back');
  await goProjects();
  await page.click('#new-panel-toggle');
  await page.fill('[data-np-name]', 'Fresh start');
  for (let i = 0; i < 3; i++) await page.click('.dk-btn[data-action="np-next"]');
  await page.click('.dk-btn[data-action="add-new-project"]');
  await page.waitForSelector('.rm-main');
  check((await st()).projects.some((p) => p.name === 'Fresh start') && (await page.textContent('.sort-q')) === 'Fresh start', tag + 'New project makes it and opens its Roadmap');
  await goProjects();
  check((await page.$$('.pj-card')).length === 5, tag + 'the new project is on the list');
  await noScroll('projects after new project'); await shot('all-with-new');

  // everything persists
  await page.reload(); await page.waitForSelector('.pj');
  check((await page.$$('.pj-card')).length === 5, tag + 'after a reload: five cards');
  await page.click('.pj-card[data-project="p0"]'); await page.waitForSelector('.rm-main');
  await page.click('.rm-all');
  check((await page.$$eval('.rm-sec-name', (e) => e.length)) === 3 && !!(await page.$('.rm-ms[data-ms-id="' + (nm || {}).id + '"]')), tag + 'after a reload: sections and milestones are still there');
  await noScroll('reload');
  await ctx.close();
}
await browser.close();
server.close();
console.log(bad ? bad + ' FAILED' : 'all passed');
process.exit(bad ? 1 : 0);
