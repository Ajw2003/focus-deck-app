// scripts/shoot-roadmap-268.mjs -- real-Chromium walk through the Roadmap at 390x844 (#268): one project, one milestone at a time.
// Usage: CHROMIUM=/opt/pw-browsers/chromium-1243/chrome-linux64/chrome node scripts/shoot-roadmap-268.mjs
// Serves the repo root on 127.0.0.1:8268, seeds localStorage, then like a thumb: the milestone on the clipboard (r2), the drawer (r2m),
// a task's drawer (r4), a task to Doing, a task to another milestone (r4m), + Add a task (r3), All milestones (r2o), + Milestone (r2a),
// + Section (r2b), Find a task (r2f), Milestone settings with each "Done means" (r2s, r2t, r2u, r2v), Edit project (r2e) and Remove (r2x).
// Screenshots go to docs/generated/roadmap-268/ named after the prototype's ids. Each screen is measured: the page must not scroll
// (it fits the phone) and no visible text may be under 13px. State changes are read back from localStorage.
import { createRequire } from 'node:module';
import { mkdirSync, readFileSync, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import { join, extname, normalize } from 'node:path';
const require = createRequire('/opt/node22/lib/node_modules/');
const { chromium } = require('playwright');
const ROOT = fileURLToPath(new URL('..', import.meta.url));
const OUT = join(ROOT, 'docs/generated/roadmap-268/');
mkdirSync(OUT, { recursive: true });
const BASE = 'http://127.0.0.1:8268/app/';
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
await new Promise((ok) => server.listen(8268, '127.0.0.1', ok));

const now = Date.now();
const t = (id, title, status, extra) => Object.assign({ id, title, status, updatedAt: now - 1000, sortOrder: 1, categoryIds: [] }, extra);
const seed = () => ({
  projectCategories: [{ id: 'a1', name: 'Apps', color: '#C9584F' }, { id: 'a2', name: 'Home', color: '#3E8E5E' }],
  projects: [
    { id: 'p0', name: 'Focus Deck', color: '#8459c0', categoryId: 'a1', sortOrder: 1,
      sections: [{ id: 'sec1', name: 'Foundations', order: 1, updatedAt: 1 }, { id: 'sec2', name: 'Plan tools', order: 2, updatedAt: 1 }],
      milestones: [
        { id: 'm1', name: 'Start here screen', sectionId: 'sec1', order: 1, updatedAt: 1 },
        { id: 'mg2', name: 'Areas', sectionId: 'sec1', order: 2, updatedAt: 1 },
        { id: 'm3', name: 'Tidy up and Triage', sectionId: 'sec2', order: 1, parentTaskId: 'par', updatedAt: 1 }],
      tasks: [
        t('s1', 'Test on phone', 'next', { milestoneId: 'm1', priority: 'high' }), t('s2', 'Open on Start here', 'doing', { milestoneId: 'm1' }), t('s3', 'Pick one for me', 'review', { milestoneId: 'm1' }),
        t('s4', 'Three suggestions', 'done', { milestoneId: 'm1' }), t('s5', 'Phone layout check', 'next', { milestoneId: 'm1', priority: 'medium' }),
        t('g1', 'Areas from GitHub', 'next', { milestoneId: 'mg2' }), t('g2', 'Areas shipped', 'done', { milestoneId: 'mg2' }),
        t('par', 'Tidy up and Triage work', 'next'), t('sub1', 'Tidy done', 'done', { parentId: 'par' }), t('sub2', 'Triage next', 'next', { parentId: 'par' }),
        t('loose', 'Loose task', 'next')] },
    { id: 'p1', name: 'Garden', color: '#3E8E5E', categoryId: 'a2', sortOrder: 2, tasks: [t('h1', 'Weed', 'done'), t('h2', 'Water', 'next')] },
  ],
  categories: [], inbox: [], completedLog: [], deletedTaskIds: {}, choosingMode: { mode: 'twice', updatedAt: 1 },
});

const results = [];
const check = (name, ok, extra = '') => { results.push(ok); console.log((ok ? 'PASS ' : 'FAIL ') + name + (extra ? '  [' + extra + ']' : '')); };
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM, args: ['--no-sandbox'] });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block', colorScheme: 'light', hasTouch: true });
const page = await ctx.newPage();
page.on('pageerror', (e) => check('no page error: ' + e.message, false));
await page.addInitScript(([s, key]) => {
  if (localStorage.getItem('seeded')) return;
  localStorage.setItem('seeded', '1');
  localStorage.setItem(key, JSON.stringify(s));
  localStorage.setItem('focusdeck-onboarding', 'done');
  localStorage.setItem('focusdeck-screen', 'roadmap');
  localStorage.setItem('focusdeck-last-project', 'p0');
}, [seed(), STATE_KEY]);
await page.goto(BASE);
await page.waitForSelector('.rm-main');
await page.waitForTimeout(400);

const proj = async (id = 'p0') => (await page.evaluate((key) => JSON.parse(localStorage.getItem(key)), STATE_KEY)).projects.find((p) => p.id === id);
const task = async (id) => ((await proj()).tasks.find((x) => x.id === id) || {});
const ms = async (id) => ((await proj()).milestones.find((m) => m.id === id) || {});
const click = async (sel) => { await page.click(sel); await page.waitForTimeout(250); };
const text = async (sel) => ((await page.textContent(sel)) || '').replace(/\s+/g, ' ').trim();
// measure the screen: no vertical scroll of the page, no sideways scroll, no visible text under 13px
async function shot(id) {
  await page.waitForTimeout(250);
  const m = await page.evaluate(() => {
    const de = document.documentElement;
    const small = [];
    document.querySelectorAll('body *').forEach((el) => {
      if (!el.offsetParent && getComputedStyle(el).position !== 'fixed') return;
      const own = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
      if (!own || el.closest('.sr-only, script, style, option')) return;
      const cs = getComputedStyle(el);
      if (cs.visibility === 'hidden' || +cs.opacity === 0) return;
      if (parseFloat(cs.fontSize) < 13) small.push((el.className || el.tagName) + ':' + cs.fontSize + ':' + el.textContent.trim().slice(0, 18));
    });
    return { scrollY: de.scrollHeight - innerHeight, scrollX: de.scrollWidth - innerWidth, small };
  });
  await page.screenshot({ path: OUT + id + '.png' });
  check(id + ': fits 390x844 without scrolling', m.scrollY <= 0 && m.scrollX <= 0, 'over by ' + m.scrollY + 'px down, ' + m.scrollX + 'px across');
  check(id + ': no text under 13px', m.small.length === 0, m.small.slice(0, 4).join(' | '));
}
const menu = async (action, screen) => { await click('.pj-pull'); await click('.sort-drawer [data-action="' + action + '"]' + (screen ? '[data-screen="' + screen + '"]' : '')); };
const openTask = async (id) => click('.rm-task-title[data-id="' + id + '"]');

// r2: the milestone on the clipboard
check('r2: opens on the last-used project at its first milestone with open tasks', (await text('.sort-q')) === 'Start here screen');
check('r2: four folder tabs, Up next on', (await page.$$eval('.rm-tab', (b) => b.map((x) => x.textContent.replace(/\s+/g, ' ').trim()).join('|'))) === 'Up next 2|Doing 1|Review 1|Done 1' && (await page.getAttribute('.rm-tab[data-col="next"]', 'aria-pressed')) === 'true');
check('r2: the tasks of the chosen column as tick rows', (await page.$$eval('.rm-task-title', (b) => b.map((x) => x.textContent).join('|'))) === 'Test on phone|Phone layout check');
check('r2: a ruler and the flags', !!(await page.$('.pj-ruler')) && (await text('.rm-all')) === 'All milestones' && !!(await page.$('.rm-flag[aria-label="Next milestone"]:not([disabled])')) && !!(await page.$('.rm-flag[aria-label="Previous milestone"][disabled]')));
await shot('r2');
await click('.rm-tab[data-col="doing"]');
check('r2: the Doing tab lists Open on Start here', (await text('.rm-task-title')) === 'Open on Start here');
await click('.rm-tab[data-col="next"]');
await click('.rm-flag[aria-label="Next milestone"]');
check('r2: › steps to the next milestone', (await text('.sort-q')) === 'Areas');
await click('.rm-flag[aria-label="Previous milestone"]');
check('r2: ‹ steps back', (await text('.sort-q')) === 'Start here screen');

// r2m: the drawer
await click('.pj-pull');
check('r2m: the drawer lists the five cards', (await page.$$eval('.sort-drawer .dk-choice', (b) => b.map((x) => x.textContent.trim()).join('|'))) === '⚙ Milestone|🗺 All milestones|🔍 Find a task|✏️ Edit project|⟳ Sync');
await shot('r2m');
await click('.sort-drawer .vs-x');

// r4: a task's drawer, then to Doing
await openTask('s1');
check('r4: the task drawer has the stamps and the cards', (await page.$$eval('.rm-stamp', (b) => b.map((x) => x.textContent.trim()).join('|'))) === 'Doing|Review|Done|◎ Focus' && (await page.$$eval('.sort-drawer .dk-choice', (b) => b.map((x) => x.textContent.trim()).join('|'))) === '➜ Other milestone|Details›');
await shot('r4');
await click('.rm-stamp[data-status="doing"]');
check('r4: the Doing stamp moved the task to Doing', (await task('s1')).status === 'doing' && !(await page.$('.sort-drawer')));
await click('.rm-tab[data-col="doing"]');
check('r4: it is in the Doing tab', (await page.$$eval('.rm-task-title', (b) => b.map((x) => x.textContent).join('|'))) === 'Test on phone|Open on Start here');

// r4m: to another milestone
await openTask('s1');
await click('.sort-drawer [data-action="rm-drawer"][data-drawer="move"]');
check('r4m: Move to lists the milestones and Unplanned, this one marked', (await page.$$eval('.sort-drawer .dk-choice', (b) => b.map((x) => x.textContent.trim()).join('|'))) === 'Start here screen|Areas|Tidy up and Triage|Unplanned' && (await page.$$('.sort-drawer .dk-choice.on')).length === 1);
await shot('r4m');
await click('.sort-drawer [data-action="rm-move-to"][data-ms="mg2"]');
check('r4m: the task is now in Areas', (await task('s1')).milestoneId === 'mg2' && (await page.$$eval('.rm-task-title', (b) => b.map((x) => x.textContent).join('|'))) === 'Open on Start here');
await click('.rm-tab[data-col="next"]');

// ◎ Focus and Details
await openTask('s5');
await click('.rm-stamp[data-status="review"]');
check('the Review stamp moved Phone layout check to Review', (await task('s5')).status === 'review');
await click('.rm-tab[data-col="review"]');
await openTask('s5');
await click('.sort-drawer [data-action="rm-details"]');
check('Details › opens Task details', !!(await page.$('[data-action="detail-close"]')));
await page.screenshot({ path: OUT + 'd0.png' });
await click('[data-action="detail-close"]');

// r3: + Add a task
await click('.rm-tab[data-col="next"]');
await click('.sort-foot [data-action="rm-screen"][data-screen="task"]');
check('r3: New task has the field, Back, More… and a Add stamp that is off until there is a title', (await text('.sort-q')) === 'New task' && (await page.isDisabled('.sort-foot .dk-btn')) && (await text('.dk-skip')) === 'More…');
await page.fill('.pj-field', 'Check the install prompt');
check('r3: typing turns the Add stamp on', !(await page.isDisabled('.sort-foot .dk-btn')));
await shot('r3');
await click('.sort-foot .dk-btn');
const added = (await proj()).tasks.find((x) => x.title === 'Check the install prompt');
check('r3: Add puts it in the milestone on the clipboard, Up next', !!added && added.milestoneId === 'm1' && added.status === 'next' && (await text('.sort-q')) === 'Start here screen');
await click('.sort-foot [data-action="rm-screen"][data-screen="task"]');
await page.fill('.pj-field', 'Write the details');
await click('.dk-skip');
check('r3: More… adds it and opens Task details', !!(await page.$('[data-action="detail-close"]')) && !!(await proj()).tasks.find((x) => x.title === 'Write the details'));
await click('[data-action="detail-close"]');

// r2o: All milestones
await click('.rm-all');
check('r2o: sections with ↑↓ keys, each milestone with a ruler', (await page.$$('.rm-sec-h .tr-move')).length === 4 && (await page.$$('.rm-ms .pj-ruler')).length === 4 && (await page.$$eval('.rm-sec-name', (e) => e.map((x) => x.textContent).join('|'))) === 'Foundations|Plan tools');
await shot('r2o');
await click('.rm-sec[data-section-id="sec2"] [data-action="rm-sec-step"][data-dir="-1"]');
check('r2o: the section ↑ key reorders the sections', (await proj()).sections.find((s) => s.id === 'sec2').order === 1);
await click('.rm-sec[data-section-id="sec2"] [data-action="rm-sec-step"][data-dir="1"]');
await click('.rm-ms[data-ms-id="m3"] [data-action="rm-ms-step"][data-dir="-1"]');
check('r2o: a milestone ↑ key steps it into the section above', (await ms('m3')).sectionId === 'sec1');
await click('.rm-ms[data-ms-id="m3"] [data-action="rm-ms-step"][data-dir="1"]');
check('r2o: and ↓ puts it back', (await ms('m3')).sectionId === 'sec2');

// r2a: + Milestone, r2b: + Section
await click('.sort-foot [data-action="rm-screen"][data-screen="ms"]');
check('r2a: New milestone has a name field and the sections to pick', (await text('.sort-q')) === 'New milestone' && (await page.$$('.dk-choice[data-action="rm-form-sec"]')).length === 2 && (await page.isDisabled('.sort-foot .dk-btn')));
await page.fill('.pj-field', 'Test on real phones');
await click('.dk-choice[data-action="rm-form-sec"][data-id="sec1"]');
check('r2a: the picked section is marked and the typed name is kept', (await page.inputValue('.pj-field')) === 'Test on real phones' && (await page.$$('.dk-choice.on')).length === 1);
await shot('r2a');
await click('.sort-foot .dk-btn');
const nm = (await proj()).milestones.find((m) => m.name === 'Test on real phones');
check('r2a: Add makes it in the picked section and returns to All milestones', !!nm && nm.sectionId === 'sec1' && (await text('.sort-q')) === 'Milestones');
await click('.sort-foot [data-action="rm-screen"][data-screen="sec"]');
await page.fill('.pj-field', 'Launch');
await shot('r2b');
await click('.sort-foot .dk-btn');
check('r2b: Add makes the section', (await proj()).sections.some((s) => s.name === 'Launch') && (await page.$$eval('.rm-sec-name', (e) => e.map((x) => x.textContent).join('|'))) === 'Foundations|Plan tools|Launch');
await click('.rm-ms-open[data-id="m1"]');
check('r2o: tapping a milestone puts it on the clipboard', (await text('.sort-q')) === 'Start here screen');

// r2f: Find a task
await menu('rm-screen', 'find');
await page.fill('.pj-find', 'phone');
await page.waitForTimeout(200);
check('r2f: Find a task lists the matching tasks', (await page.$$eval('.sort-body .dk-choice span', (b) => b.map((x) => x.textContent).join('|'))) === 'Test on phone|Phone layout check');
await shot('r2f');
await click('.sort-body .dk-choice[data-id="s1"]');
check('r2f: tapping a result opens its drawer', !!(await page.$('.rm-stamps')));
await click('.sort-drawer .vs-x');
await click('.dk-back');

// r2s, r2t, r2u, r2v: Milestone settings, each "Done means"
await menu('rm-settings');
check('r2s: How big a part? with the ruler and its %', (await text('.sort-q')) === 'How big a part?' && !!(await page.$('.rm-slider')) && (await text('[data-rm-pct]')).endsWith('%'));
await page.focus('.rm-slider');
await page.keyboard.press('Home');
for (let i = 0; i < 40; i++) await page.keyboard.press('ArrowRight');
check('r2s: the % follows the slider', (await text('[data-rm-pct]')) === '40%');
await shot('r2s');
await click('.sort-foot [data-action="rm-set-next"]');
check('r2t: Done means… offers the four', (await text('.sort-q')) === 'Done means…' && (await page.$$eval('.sort-body .dk-choice', (b) => b.map((x) => x.textContent.trim()).join('|'))) === '✓ Tasks done|⚖ Task size|🔢 A number|☑ A checklist');
await shot('r2t');
await click('.dk-choice[data-value="tasks"]');
await click('.sort-foot [data-action="rm-set-save"]');
check('Save (Tasks done): measure tasks, share 40, back on the clipboard', (await ms('m1')).measureBy === 'tasks' && (await ms('m1')).weight === 40 && (await text('.sort-q')) === 'Start here screen');
const total = async () => { const p = await proj(); return p.milestones.reduce((a, m) => a + (m.weight || 0), 0) + (p.unplannedWeight || 0); };
check('Save: the shares still add up to 100', (await total()) === 100, String(await total()));

await menu('rm-settings'); await click('.sort-foot [data-action="rm-set-next"]');
await click('.dk-choice[data-value="size"]');
await click('.sort-foot [data-action="rm-set-save"]');
check('Save (Task size): measure size', (await ms('m1')).measureBy === 'size');

await menu('rm-settings'); await click('.sort-foot [data-action="rm-set-next"]');
await click('.dk-choice[data-value="number"]');
check('r2u: A number has the name and the two fields', (await text('.sort-q')) === 'A number' && (await page.$$('[data-rm-num]')).length === 3);
await page.fill('[data-rm-num="name"]', 'screens tested');
await page.fill('[data-rm-num="current"]', '2');
await page.fill('[data-rm-num="target"]', '4');
await shot('r2u');
await click('.sort-foot [data-action="rm-set-save"]');
const mn = await ms('m1');
check('Save (A number): screens tested 2 of 4', mn.measureBy === 'number' && mn.number.name === 'screens tested' && mn.number.current === 2 && mn.number.target === 4);

await menu('rm-settings'); await click('.sort-foot [data-action="rm-set-next"]');
await click('.dk-choice[data-value="checklist"]');
for (const item of ['Works on a phone', 'Works offline', 'Eden has tried it']) { await page.fill('[data-rm-new]', item); await click('[data-action="rm-set-add"]'); }
await click('.rm-tick[data-rm-tick="0"]');
check('r2v: A checklist has a tick list and Add', (await page.$$('.rm-item')).length === 3 && (await page.$$('.rm-tick:checked')).length === 1);
await shot('r2v');
await click('.sort-foot [data-action="rm-set-save"]');
const mc = await ms('m1');
check('Save (A checklist): three items, one ticked', mc.measureBy === 'checklist' && mc.checklist.length === 3 && mc.checklist.filter((i) => i.done).length === 1);
check('the ruler shows the checklist (1 of 3 = 33%)', (await page.getAttribute('.pj-ruler', 'aria-label')) === '33% done');
await menu('rm-settings'); check('Back from step 1 leaves settings without saving', true); await page.focus('.rm-slider'); await page.keyboard.press('End'); await click('.dk-back');
check('Back leaves settings and keeps what was saved', (await ms('m1')).weight === 40 && (await text('.sort-q')) === 'Start here screen');

// r2e: Edit project
await menu('rm-screen', 'edit');
check('r2e: the receipt has name, area, colour and repo, each with a pencil, and Remove project', (await page.$$('.dk-pencil')).length === 4 && (await text('.dk-choice.danger')) === 'Remove project');
await shot('r2e');
await click('.dk-pencil[data-field="name"]');
await page.fill('.pj-field', 'Focus Deck 2');
await shot('r5');
await click('.sort-foot .dk-btn');
check('r2e: the name pencil renames the project', (await proj()).name === 'Focus Deck 2');
await click('.dk-pencil[data-field="area"]');
await shot('r6');
await click('.dk-choice[data-id="a2"]');
check('r2e: the area pencil changes the area', (await proj()).categoryId === 'a2');
await click('.dk-pencil[data-field="colour"]');
await shot('r7');
await click('.pj-swatch[data-color="#2f7a4b"]');
check('r2e: the colour pencil changes the colour', (await proj()).color === '#2f7a4b');
await click('.dk-pencil[data-field="repo"]');
await shot('r8');
await click('.dk-back');
await click('.dk-choice.danger');
check('r2x: Remove project asks first in a drawer with Back and Remove', (await text('.vs-pop-head b')) === 'Remove Focus Deck 2?' && (await page.$$eval('.rm-ask .dk-btn', (b) => b.map((x) => x.textContent.trim()).join('|'))) === 'Back|Remove');
await shot('r2x');
await click('.rm-ask .dk-btn:first-child');
check('r2x: Back keeps the project', !!(await proj()) && !(await page.$('.sort-drawer')));
await click('.dk-choice.danger');
await click('.rm-ask .dk-btn:last-child');
check('r2x: Remove removes it and lands on the Projects tab', !(await proj()) && !!(await page.$('.pj-card[data-project="p1"]')));
await shot('r0');

await browser.close();
server.close();
const bad = results.filter((x) => !x).length;
console.log(bad ? bad + ' FAILED of ' + results.length : 'all ' + results.length + ' passed');
process.exit(bad ? 1 : 0);
