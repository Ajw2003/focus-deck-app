// scripts/check-roadmap-browser.mjs -- the Roadmap (#257) in real Chromium at 390x844, 360x780 and 1440x900:
// group rows and percents (All, Area), phone cards, the project view (sections, four columns, collapsed rows),
// a task moved between columns (mouse drag + Alt+Arrow on desktop, the arrow buttons and the column buttons on a
// phone), a milestone moved between sections and sections reordered (drag / Alt+Up/Down, or the up/down buttons),
// add a task / milestone / section, Make this a milestone, Edit project, New project, a reload keeps it all,
// the 8-tab phone bar fits, no page errors, no sideways scroll.
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
  const pickView = async (mode, id) => { await page.click('[data-action="view-mode"][data-mode="' + mode + '"]'); if (id) await page.click('[data-action="view-pick"][data-id="' + id + '"]'); };
  const box = async (sel) => (await (await page.$(sel)).boundingBox());
  const drag = async (fromSel, toSel, dy = 6) => {
    const g = await box(fromSel), r = await box(toSel);
    await page.mouse.move(g.x + g.width / 2, g.y + g.height / 2); await page.mouse.down();
    await page.mouse.move(g.x + 12, g.y + 12, { steps: 4 }); await page.mouse.move(r.x + Math.min(40, r.width / 2), r.y + dy, { steps: 10 }); await page.mouse.up();
  };
  const secs = async () => (await proj('p0')).sections.slice().sort((a, b) => a.order - b.order).map((s) => s.id).join();

  // eight tabs on the phone bar: every label whole
  const fit = await page.evaluate(() => {
    const items = [...document.querySelectorAll('.rail-item')].filter((i) => i.offsetParent);
    return { n: items.length, clipped: items.filter((i) => i.querySelector('.rail-label').scrollWidth > i.clientWidth).map((i) => i.textContent.trim()).join() };
  });
  check(fit.n === (phone ? 7 : 8) && fit.clipped === '', tag + (phone ? 'phone bar: seven tabs (Tidy up and Triage share Organize), no label clipped' : 'rail: eight entries'), fit.n + ' ' + fit.clipped);
  if (phone) check((await page.$$eval('.rail-label', (l) => l.filter((x) => x.offsetParent).map((x) => x.textContent).join())) === 'Focus,Sort,Board,Projects,Review,Organize,Roadmap', tag + 'phone tab order');
  if (phone) await page.screenshot({ path: OUT + 'roadmap-' + w + '-tabbar.png', clip: { x: 0, y: h - 90, width: w, height: 90 } });

  // group view: All, then Area
  await goRoadmap();
  check((await page.textContent('.board-title')) === 'Roadmap: All', tag + 'title says Roadmap: All');
  check((await page.$$('.rm-row')).length === 4, tag + 'a row per project on All');
  await pickView('area', 'a1');
  check((await page.textContent('.board-title')) === 'Roadmap: Apps' && (await page.$$('.rm-row')).length === 3, tag + 'Area Apps: title and three rows');
  const row0 = await page.textContent('.rm-row[data-project="p0"] ' + (phone ? '.rm-phone' : '.rm-proj'));
  check(row0.includes('Focus Deck') && row0.includes('37%'), tag + 'Focus Deck row says 37% done (equal milestone shares: 40, 50, 33, 25)', row0.replace(/\s+/g, ' '));
  const row1 = await page.textContent('.rm-row[data-project="p1"] ' + (phone ? '.rm-phone' : '.rm-proj'));
  check(row1.includes('50%'), tag + 'second project 50%', row1.replace(/\s+/g, ' '));
  if (phone) {
    check((await page.isVisible('.rm-row[data-project="p0"] .rm-phone')) && !(await page.isVisible('.rm-row[data-project="p0"] .rm-card')), tag + 'phone: one card per project');
    check((await page.textContent('.rm-row[data-project="p0"] .rm-now')) === 'Now: Start here screen · tasks 2 of 5', tag + 'phone card says Now: milestone · X of Y', await page.textContent('.rm-row[data-project="p0"] .rm-now'));
    check((await page.textContent('.rm-row[data-project="p1"] .rm-now')) === 'Now: Boss fight · phases built 1 of 2', tag + 'a milestone with its own measure says so');
  } else {
    const cards = await page.$$eval('.rm-row[data-project="p0"] .rm-card', (c) => c.map((x) => x.textContent.replace(/\s+/g, ' ')));
    check(cards.join('|') === 'Start here screentasks 2 of 5|Areastasks 1 of 2|Tidy up and Triagetasks 1 of 3|Unplannedtasks 1 of 4', tag + 'a card per milestone plus Unplanned', cards.join(' | '));
  }
  check((await page.isVisible('#new-panel-toggle')) && (await page.textContent('#new-panel-toggle')) === '+ New project', tag + '+ New project is there');
  await noScroll('group'); await shot('group');

  // project view
  await pickView('project', 'p0');
  await page.waitForSelector('.rm-project');
  check((await page.textContent('.rm-big')) === '37%' && (await page.textContent('.rm-title')).trim() === 'Focus Deck', tag + 'project view: name and big 37%', await page.textContent('.rm-big'));
  check((await page.$$eval('.rm-sec-name', (e) => e.map((x) => x.textContent).join('|'))) === '1 · Foundations|2 · Plan tools', tag + 'sections in order');
  check((await page.$$('.rm-ms.is-open')).length === 1 && (await page.$$eval('.rm-ms.is-open .rm-col', (c) => c.map((x) => x.dataset.status).join())) === 'next,doing,review,done', tag + 'the open milestone has the four columns');
  check((await page.$$('.rm-ms:not(.is-open)')).length === 3, tag + 'the other milestones (and Unplanned) are collapsed rows');
  check((await page.textContent('.rm-ms[data-ms-id="m3"] .rm-ms-count')).trim().startsWith('tasks 1 of 3'), tag + 'collapsed row says tasks 1 of 3');
  if (phone) {
    check((await page.$$eval('.rm-coltab', (b) => b.map((x) => x.textContent).join('|'))) === 'Up next|In progress|Review|Done', tag + 'phone: four column buttons');
    check((await page.$$eval('.rm-ms.is-open .rm-col', (c) => c.filter((x) => x.offsetParent).map((x) => x.dataset.status).join())) === 'next', tag + 'phone: one column visible at a time');
    await page.click('.rm-coltab[data-col="review"]');
    check((await page.$$eval('.rm-ms.is-open .rm-col', (c) => c.filter((x) => x.offsetParent).map((x) => x.dataset.status + ':' + x.querySelectorAll('.rm-task').length).join())) === 'review:1', tag + 'phone: Review shows its one task');
    await page.click('.rm-coltab[data-col="next"]');
  } else {
    check((await page.$$eval('.rm-ms.is-open .rm-col', (c) => c.filter((x) => x.offsetParent).length)) === 4, tag + 'desktop: all four columns visible');
  }
  await page.click('.rm-ms-toggle[data-id="mg2"]');
  check((await page.$$('.rm-ms.is-open')).length === 2 && (await page.$$eval('.rm-ms[data-ms-id="mg2"] .rm-task-title', (e) => e.map((x) => x.textContent).join('|'))) === 'Areas from GitHub|Areas shipped', tag + 'clicking a collapsed milestone opens it; the GitHub-milestone tasks are in it');
  await page.click('.rm-ms-toggle[data-id="mg2"]');
  check((await page.$$('.rm-ms.is-open')).length === 1, tag + 'and closes it again');
  await noScroll('project'); await shot('project');

  // a task between columns
  if (phone) {
    await page.click('.rm-task[data-task-id="s1"] [data-action="rm-task-step"][data-dir="1"]');
    check((await task('s1')).status === 'doing', tag + 'the → button moves Test on phone to In progress');
    await page.click('.rm-coltab[data-col="doing"]');
    await page.click('.rm-task[data-task-id="s1"] [data-action="rm-task-step"][data-dir="1"]');
    await page.click('.rm-coltab[data-col="review"]');
    await page.click('.rm-task[data-task-id="s1"] [data-action="rm-task-step"][data-dir="1"]');
    const s1 = await task('s1');
    check(s1.status === 'done' && typeof s1.completedAt === 'number', tag + '→ again, twice: Review, then Done (completedAt set)');
    await page.click('.rm-coltab[data-col="done"]'); await shot('done-column');
    await page.click('.rm-task[data-task-id="s1"] [data-action="rm-task-step"][data-dir="-1"]');
    check((await task('s1')).status === 'review' && (await task('s1')).completedAt === undefined, tag + '← moves back, any direction');
    await page.click('.rm-coltab[data-col="next"]');
  } else {
    await drag('.rm-task[data-task-id="s1"] .rm-grip', '.rm-col[data-ms="m1"][data-status="doing"]');
    check((await task('s1')).status === 'doing', tag + 'mouse drag: Test on phone to In progress');
    await drag('.rm-task[data-task-id="s1"] .rm-grip', '.rm-col[data-ms="m1"][data-status="done"]');
    const s1 = await task('s1');
    check(s1.status === 'done' && typeof s1.completedAt === 'number', tag + 'mouse drag to Done sets completedAt');
    await drag('.rm-task[data-task-id="s1"] .rm-grip', '.rm-col[data-ms="m1"][data-status="next"]');
    check((await task('s1')).status === 'next', tag + 'and back to Up next (any direction)');
    await page.focus('.rm-task[data-task-id="s1"] .rm-grip');
    await page.keyboard.press('Alt+ArrowRight');
    check((await task('s1')).status === 'doing' && (await page.evaluate(() => document.activeElement.dataset.id)) === 's1', tag + 'Alt+Right moves it one column, focus stays');
    await page.keyboard.press('Alt+ArrowLeft');
    check((await task('s1')).status === 'next', tag + 'Alt+Left moves it back');
  }
  await page.reload(); await page.waitForSelector('.rm-project');
  check((await task('s1')).status === (phone ? 'review' : 'next') && (await page.textContent('.rm-title')).trim() === 'Focus Deck', tag + 'a reload keeps the move and the view');

  // milestone between sections, section reorder
  if (phone) {
    await page.click('.rm-ms[data-ms-id="m3"] [data-action="rm-ms-step"][data-dir="-1"]');
    check((await proj('p0')).milestones.find((m) => m.id === 'm3').sectionId === 'sec1', tag + 'up button moves Tidy up and Triage into section 1');
    await page.click('.rm-ms[data-ms-id="m3"] [data-action="rm-ms-step"][data-dir="1"]');
    check((await proj('p0')).milestones.find((m) => m.id === 'm3').sectionId === 'sec2', tag + 'down button moves it back');
    await page.click('.rm-sec[data-section-id="sec2"] [data-action="rm-sec-step"][data-dir="-1"]');
    check((await secs()) === 'sec2,sec1', tag + 'up button reorders the sections');
    await page.click('.rm-sec[data-section-id="sec2"] [data-action="rm-sec-step"][data-dir="1"]');
    check((await secs()) === 'sec1,sec2', tag + 'down button puts them back');
  } else {
    await drag('.rm-ms[data-ms-id="m3"] .rm-grip', '.rm-sec[data-section-id="sec1"] .rm-sec-h');
    check((await proj('p0')).milestones.find((m) => m.id === 'm3').sectionId === 'sec1', tag + 'drag moves a milestone into another section');
    await page.keyboard.press('Alt+ArrowDown');
    check((await proj('p0')).milestones.find((m) => m.id === 'm3').sectionId === 'sec2', tag + 'Alt+Down moves it on into the next section');
    await drag('.rm-sec[data-section-id="sec2"] .rm-sec-h .rm-grip', '.rm-sec[data-section-id="sec1"] .rm-sec-h');
    check((await secs()) === 'sec2,sec1', tag + 'dragging a section reorders them');
    await shot('sections-swapped');
    await page.keyboard.press('Alt+ArrowDown');
    check((await secs()) === 'sec1,sec2', tag + 'Alt+Down reorders them back');
  }

  // add a task, a milestone, a section
  await page.click('[data-action="rm-add"][data-kind="task"][data-ms="m1"]');
  await page.fill('.rm .add-row input[name="title"]', 'Brand new task');
  await page.click('.rm .add-row [data-field="priority"][data-value="high"]');
  await page.click('.rm .add-row button[type="submit"]');
  const nt = (await proj('p0')).tasks.find((x) => x.title === 'Brand new task');
  check(!!nt && nt.milestoneId === 'm1' && nt.status === 'next', tag + '+ Add a task puts it in that milestone, Up next');
  await page.click('[data-action="rm-add"][data-kind="milestone"]');
  await page.fill('.rm-add-form input', 'Polish');
  await page.click('.rm-add-form button[type="submit"]');
  const nm = (await proj('p0')).milestones.find((m) => m.name === 'Polish');
  check(!!nm && nm.sectionId === 'sec2', tag + '+ Add a milestone: in the last section');
  await page.click('[data-action="rm-add"][data-kind="section"]');
  await page.fill('.rm-add-form input', 'Launch');
  await page.click('.rm-add-form button[type="submit"]');
  check((await proj('p0')).sections.some((s) => s.name === 'Launch'), tag + '+ Add a section');
  check((await page.$$eval('.rm-sec-name', (e) => e.map((x) => x.textContent).join('|'))) === '1 · Foundations|2 · Plan tools|3 · Launch', tag + 'the new section shows, numbered 3');

  // Make this a milestone, from a task's details
  await page.click('.rm-ms-toggle[data-id="unplanned"]');
  await page.click('.rm-task-title[data-id="par2"]');
  await page.waitForSelector('.rm-detail [data-action="rm-make"]');
  await shot('details');
  await page.click('.rm-detail [data-action="rm-make"]');
  const mk = (await proj('p0')).milestones.find((m) => m.parentTaskId === 'par2');
  await page.keyboard.press('Escape'); // Task details fills a phone's screen; Escape closes it
  check(!!mk && mk.name === 'Android app', tag + 'Make this a milestone on a task with subtasks');
  check((await page.textContent('.rm-ms[data-ms-id="' + (mk || {}).id + '"] .rm-ms-count')).trim().startsWith('tasks 1 of 2'), tag + 'its subtasks are its tasks (1 of 2)');
  check((await page.textContent('.rm-big')) === '28%', tag + 'project percent: equal shares again after Polish (empty) and Android app are added (#258)', await page.textContent('.rm-big'));
  await noScroll('after adds'); await shot('after-adds');

  // Edit project (the existing panel) and New project
  await page.click('[data-action="open-project-edit"]');
  await page.waitForSelector('.project-edit-panel');
  const ed = await page.textContent('.project-edit-panel');
  check(ed.includes('Remove project') && ed.includes('Area') && (await page.$$('.project-edit-panel input[type="color"]')).length >= 1, tag + 'Edit project opens the rename/colour/area/Remove panel');
  await shot('edit-project');
  await page.click('[data-action="close-project-edit"]');
  await pickView('all');
  await page.click('#new-panel-toggle');
  await page.fill('.add-project-form input[name="name"]', 'Fresh start');
  await page.click('.add-project-form button[type="submit"]');
  await page.waitForSelector('.rm-row[data-project]');
  check((await st()).projects.some((p) => p.name === 'Fresh start') && (await page.$$('.rm-row')).length === 5, tag + 'New project adds a row');
  await noScroll('all after new project'); await shot('all-with-new');

  // everything persists
  await page.reload(); await page.waitForSelector('.rm');
  check((await page.$$('.rm-row')).length === 5 && (await page.textContent('.board-title')) === 'Roadmap: All', tag + 'after a reload: five rows, same view');
  await pickView('project', 'p0');
  check((await page.$$eval('.rm-sec-name', (e) => e.length)) === 3 && !!(await page.$('.rm-ms[data-ms-id="' + (nm || {}).id + '"]')), tag + 'after a reload: sections and milestones are still there');
  await noScroll('reload');
  await ctx.close();
}
await browser.close();
server.close();
console.log(bad ? bad + ' FAILED' : 'all passed');
process.exit(bad ? 1 : 0);
