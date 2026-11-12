// scripts/shoot-details-269.mjs -- real-Chromium walk through Task details at 390x844 (#269): the clipboard and receipt (d0), the Status
// drawer (d1), smaller steps (d2), GitHub (d3), the ⋯ drawer (d4), each receipt line edited through the Sort step and saved, status,
// rename, move, size, delete, and Task details opened from Sort, Organize and the Roadmap.
// Usage: CHROMIUM=/opt/pw-browsers/chromium-1243/chrome-linux64/chrome node scripts/shoot-details-269.mjs
// Serves the repo root on 127.0.0.1:8269 and seeds localStorage. Screenshots go to docs/generated/details-269/ named after the prototype's
// ids. Each screen is measured: the page and the panel must not scroll (it fits the phone) and no visible text may be under 13px.
// State changes are read back from localStorage.
import { createRequire } from 'node:module';
import { mkdirSync, readFileSync, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import { join, extname, normalize } from 'node:path';
const require = createRequire('/opt/node22/lib/node_modules/');
const { chromium } = require('playwright');
const ROOT = fileURLToPath(new URL('..', import.meta.url));
const OUT = join(ROOT, 'docs/generated/details-269/');
mkdirSync(OUT, { recursive: true });
const BASE = 'http://127.0.0.1:8269/app/';
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
await new Promise((ok) => server.listen(8269, '127.0.0.1', ok));

const now = Date.now();
const iso = (days) => { const d = new Date(now + days * 86400000); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
const t = (id, title, extra) => Object.assign({ id, title, status: 'next', updatedAt: now - 1000, sortOrder: 1, categoryIds: ['c1'] }, extra);
const seed = () => ({
  projectCategories: [{ id: 'a1', name: 'Apps', color: '#C9584F' }],
  projects: [
    { id: 'p0', name: 'Focus Deck', color: '#8459c0', categoryId: 'a1', sortOrder: 1,
      sections: [{ id: 'sec1', name: 'Foundations', order: 1, updatedAt: 1 }],
      milestones: [{ id: 'm1', name: 'Start here screen', sectionId: 'sec1', order: 1, updatedAt: 1 }],
      tasks: [
        t('t1', 'Test on phone', { milestoneId: 'm1', priority: 'high', deadline: iso(3), categoryIds: ['c1', 'c2'], notes: 'Check the install prompt', waitsOn: ['t4'] }),
        t('s1', 'Install it', { parentId: 't1', status: 'done' }), t('s2', 'Open offline', { parentId: 't1', status: 'done' }), t('s3', 'Add a thought', { parentId: 't1' }),
        t('t4', 'Get a quote', { milestoneId: 'm1' }), t('t5', 'Unlabelled chore', { categoryIds: [] }),
        t('g1', 'Linked from GitHub', { milestoneId: 'm1', source: 'github', repoFullName: 'o/r', issueNumber: 212, url: 'https://github.com/o/r/issues/212' }),
        t('x1', 'Ring the plumber', { priority: 'low' }), t('rv1', 'Check the quote', { status: 'review' })] },
    { id: 'p1', name: 'Garden', color: '#3E8E5E', categoryId: 'a1', sortOrder: 2, tasks: [t('h2', 'Water', {})] },
  ],
  categories: [{ id: 'c1', name: 'Code', color: '#4A6FB5' }, { id: 'c2', name: 'Phone', color: '#D9822B' }],
  inbox: [], completedLog: [], deletedTaskIds: {}, choosingMode: { mode: 'tap', updatedAt: 1 },
});

const results = [];
const check = (name, ok, extra = '') => { results.push(ok); console.log((ok ? 'PASS ' : 'FAIL ') + name + (extra ? '  [' + extra + ']' : '')); };
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM, args: ['--no-sandbox'] });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block', colorScheme: 'light', hasTouch: true });
const page = await ctx.newPage();
page.on('pageerror', (e) => check('no page error: ' + e.message, false));
let dialogs = [], accept = true;
page.on('dialog', (d) => { dialogs.push(d.message()); accept ? d.accept() : d.dismiss(); });
await page.addInitScript(([s, key]) => {
  if (localStorage.getItem('seeded')) return;
  localStorage.setItem('seeded', '1');
  localStorage.setItem(key, JSON.stringify(s));
  localStorage.setItem('focusdeck-onboarding', 'done');
  localStorage.setItem('focusdeck-screen', 'roadmap');
  localStorage.setItem('focusdeck-last-project', 'p0');
  localStorage.setItem('focusdeck-view', JSON.stringify({ mode: 'project', id: 'p0' }));
}, [seed(), STATE_KEY]);
await page.goto(BASE);
await page.waitForSelector('.rm-main');
await page.waitForTimeout(400);

const stored = async () => page.evaluate((key) => JSON.parse(localStorage.getItem(key)), STATE_KEY);
const task = async (id) => (await stored()).projects.flatMap((p) => p.tasks).find((x) => x.id === id) || {};
const inProject = async (id) => (await stored()).projects.find((p) => p.tasks.some((x) => x.id === id)).id;
const click = async (sel) => { await page.click(sel); await page.waitForTimeout(250); };
const text = async (sel) => ((await page.textContent(sel)) || '').replace(/\s+/g, ' ').trim();
const lines = async () => page.$$eval('.td-panel .sort-receipt > div', (rows) => rows.map((r) => r.querySelector('em').textContent.trim()));
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
    const inner = [...document.querySelectorAll('.td-panel, .td-panel .sort-body, .td-panel .sort-paper')].map((e) => e.scrollHeight - e.clientHeight).filter((n) => n > 0);
    return { scrollY: de.scrollHeight - innerHeight, scrollX: de.scrollWidth - innerWidth, small, inner };
  });
  await page.screenshot({ path: OUT + id + '.png' });
  check(id + ': fits 390x844 without scrolling', m.scrollY <= 0 && m.scrollX <= 0 && m.inner.length === 0, 'page over by ' + m.scrollY + 'px down, ' + m.scrollX + 'px across; panel parts over by ' + m.inner.join(','));
  check(id + ': no text under 13px', m.small.length === 0, m.small.slice(0, 4).join(' | '));
}
const pencil = async (step) => click('.td-panel [data-action="detail-edit"][data-step="' + step + '"]');
const save = async () => click('.td-panel [data-action="edit-save"]');
const closeDetails = async () => click('.td-panel [data-action="detail-close"]');

// d0 from the Roadmap drawer
await click('.rm-task-title[data-id="t1"]');
await click('.sort-drawer [data-action="rm-details"]');
await page.waitForSelector('.td-panel');
check('d0: opens from the Roadmap task drawer, the task title on the clipboard', (await text('.td-panel .sort-q')) === 'Test on phone');
check('d0: the status stamp and the project', (await text('.td-stamp-row .rm-stamp')) === 'Up next' && (await text('.td-stamp-row .folder-chip')) === 'Focus Deck');
const rec = await lines();
check('d0: priority, due, labels, smaller steps, waits on, notes, size, GitHub', rec[0] === 'High' && /^Due/.test(rec[1]) && rec[2] === 'Code, Phone' && rec[3] === '2 of 3' && rec[4] === 'Get a quote' && rec[5] === 'Check the install prompt' && rec[6] === '—' && rec[7] === '—', rec.join(' | '));
check('d0: a pencil on every line, the ⋯ tag and the ◎ Focus stamp', (await page.$$('.td-panel .dk-pencil')).length === 8 && !!(await page.$('.td-panel [data-action="detail-more"]')) && (await text('.td-panel [data-action="detail-focus"]')) === '◎ Focus');
await shot('d0');

// d1: the Status drawer
await click('.td-panel [data-action="detail-status-open"]');
check('d1: four stamps, Up next marked', JSON.stringify(await page.$$eval('.sort-drawer .rm-stamp', (b) => b.map((x) => x.textContent.trim() + (x.classList.contains('on') ? '*' : '')))) === '["Up next*","Doing","Review","Done"]');
await shot('d1');
await click('.sort-drawer [data-action="detail-status"][data-status="doing"]');
check('d1: Doing moved the task and the stamp follows', (await task('t1')).status === 'doing' && (await text('.td-stamp-row .rm-stamp')) === 'Doing' && !(await page.$('.sort-drawer')));

// each pencil opens the Sort step in edit mode, and Save writes it
await pencil(2);
check('priority: the Sort step "How important?" with Save, no dots, no Next', (await text('.td-panel .sort-q')) === 'How important?' && (await text('.td-panel .file-btn')) === 'Save' && !(await page.$('.td-panel .sort-dots')) && !(await page.$('.td-panel [data-action="sort-next"]')));
await shot('e-priority');
await click('.td-panel .sort-flags [data-level="urgent"]');
await save();
check('priority: Save wrote Urgent and the receipt is back', (await task('t1')).priority === 'urgent' && (await lines())[0] === 'Urgent');

await pencil(4);
check('due: the tear-off calendar step', (await text('.td-panel .sort-q')) === 'When is it due?');
await shot('e-due');
await click('.td-panel .sort-cal-page[data-value="tomorrow"]');
await save();
check('due: Save wrote tomorrow', (await task('t1')).deadline === iso(1) && /^Due/.test((await lines())[1]) || (await task('t1')).deadline === iso(1), (await task('t1')).deadline);

await pencil(3);
check('labels: the Sort labels step', (await text('.td-panel .sort-q')) === 'What kind of work?');
await shot('e-labels');
await click('.td-panel [data-action="sort-azl"]');
await click('.td-panel [data-action="sort-letter"][data-letter="C"]');
await click('.td-panel [data-action="sort-flag"][data-token="c1"]');
await click('.td-panel [data-action="sort-back"]');
await save();
check('labels: Save wrote Phone only', JSON.stringify((await task('t1')).categoryIds) === '["c2"]' && (await lines())[2] === 'Phone', JSON.stringify((await task('t1')).categoryIds));

await pencil(7);
check('waits on: the Sort step, Get a quote ticked', (await text('.td-panel .sort-q')) === 'What has to happen first?' && !!(await page.$('.td-panel .dk-choice.on')));
await shot('e-waits');
await click('.td-panel [data-action="tie-remove"][data-field="waitsOn"]');
await save();
check('waits on: Save took the link off', !((await task('t1')).waitsOn || []).length && (await lines())[4] === '—');

await pencil('notes');
await page.fill('.td-panel .slip-notes', 'Check the install prompt twice');
await shot('e-notes');
await save();
check('notes: Save wrote the note', (await task('t1')).notes === 'Check the install prompt twice' && (await lines())[5] === 'Check the install prompt twice');

// size (kept from the old Task details: the Roadmap's Task size reads it)
await click('.td-panel [data-action="detail-size-open"]');
await shot('e-size');
await click('.td-panel [data-action="detail-size"][data-size="large"]');
check('size: Large saved', (await task('t1')).size === 'large');
await click('.td-panel [data-action="detail-back"]');
check('size: the receipt says Large', (await lines())[6] === 'Large');

// Back from a step leaves without saving
await pencil(2);
await click('.td-panel .sort-flags [data-level="low"]');
await click('.td-panel [data-action="sort-back"]');
check('back: leaves the step without saving', (await task('t1')).priority === 'urgent' && !!(await page.$('.td-panel .sort-receipt')));

// d2: smaller steps
await click('.td-panel [data-action="detail-subs"]');
check('d2: the tick list, an Add field and Done', (await page.$$('.td-panel .td-tick')).length === 3 && !!(await page.$('.td-panel [data-detail-newsub]')) && (await text('.td-panel .sort-foot')).includes('Done'));
await shot('d2');
await click('.td-panel .td-tick:has-text("Add a thought") input');
check('d2: ticking a step marks it done', (await task('s3')).status === 'done');
await page.fill('.td-panel [data-detail-newsub]', 'Open offline too');
await click('.td-panel [data-action="detail-add-sub"]');
const added = (await stored()).projects[0].tasks.find((x) => x.title === 'Open offline too');
check('d2: Add makes a smaller step under this task', !!added && added.parentId === 't1');
await click('.td-panel .sort-foot [data-action="detail-back"].file-btn');
check('d2: Done is back on the receipt with 3 of 4', (await lines())[3] === '3 of 4', (await lines())[3]);

// d4: the ⋯ drawer, Rename, Delete (asks first)
await click('.td-panel [data-action="detail-more"]');
check('d4: Rename, Move, Part of, Holds up, Delete', JSON.stringify(await page.$$eval('.sort-drawer .dk-choice', (b) => b.map((x) => x.textContent.trim()))) === JSON.stringify(['✏️ Rename', '📁 Move to another project', '🧩 Part of…', '🚧 Holds up…', 'Delete']) && !!(await page.$('.sort-drawer .dk-choice.danger')));
await shot('d4');
accept = false; dialogs = [];
await click('.sort-drawer [data-action="detail-delete"]');
check('d4: Delete asks first, and No keeps the task', dialogs.length === 1 && /Delete "Test on phone"/.test(dialogs[0]) && (await task('t1')).id === 't1' && !!(await page.$('.td-panel')));
accept = true;
await click('.td-panel [data-action="detail-more"]');
await click('.sort-drawer [data-action="detail-rename"]');
await shot('d4r');
await page.fill('.td-panel [data-detail-rename]', 'Test on a phone');
await click('.td-panel [data-action="detail-rename-save"]');
check('rename: Save changed the title', (await task('t1')).title === 'Test on a phone' && (await text('.td-panel .sort-q')) === 'Test on a phone');

await click('.td-panel [data-action="detail-more"]');
await click('.sort-drawer [data-action="detail-edit"][data-step="5"]');
check('part of: the Sort step', (await text('.td-panel .sort-q')) === 'Part of a bigger task?');
await shot('e-partof');
await click('.td-panel [data-action="sort-back"]');
await click('.td-panel [data-action="detail-more"]');
await click('.sort-drawer [data-action="detail-edit"][data-step="8"]');
check('holds up: the Sort step', (await text('.td-panel .sort-q')) === 'What is waiting on this?');
await shot('e-holds');
await page.fill('.td-panel [data-tie-find]', 'Get');
await page.waitForTimeout(250);
await click('.td-panel [data-action="tie-add"][data-field="holdsUp"]');
await save();
check('holds up: Save made Get a quote wait on this task', ((await task('t4')).waitsOn || []).includes('t1'));

// move to another project (the Sort project step)
await click('.td-panel [data-action="detail-more"]');
await click('.sort-drawer [data-action="detail-edit"][data-step="1"]');
check('move: the Sort project step', (await text('.td-panel .sort-q')) === 'Which project?');
await shot('e-move');
const flip = async (key) => { const sel = '[data-wallet="tray-folders"] .sleeve[data-key="' + key + '"] .icard'; await page.$eval(sel, (el) => el.scrollIntoView({ block: 'center', inline: 'center' })); await page.waitForTimeout(300); const b = await (await page.$(sel)).boundingBox(); await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2); await page.waitForTimeout(450); };
await flip('p1');
await save();
check('move: Save moved the task to Garden', (await inProject('t1')) === 'p1' && (await text('.td-stamp-row .folder-chip')) === 'Garden');

// d3: GitHub, on an unlinked task and on a linked one
await click('.td-panel [data-action="detail-github"]');
check('d3: an unlinked task offers Create issue and Link', JSON.stringify(await page.$$eval('.td-panel .dk-choice', (b) => b.map((x) => x.textContent.trim()))) === '["+ Create issue","Link to an existing issue"]');
await click('.td-panel [data-action="detail-back"]');
await click('.td-panel [data-action="detail-focus"]');
check('focus: the ◎ Focus stamp sets the task in focus', ((await stored()).focus || {}).taskId === 't1');
await closeDetails();
await click('.rm-tab[data-col="next"]');
await click('.rm-task-title[data-id="g1"]');
await click('.sort-drawer [data-action="rm-details"]');
check('d3: the receipt line shows #212', (await lines())[7] === '#212');
await click('.td-panel [data-action="detail-github"]');
check('d3: ↗ Open on GitHub and Unlink', (await text('.td-panel .sort-q')) === 'GitHub #212' && (await page.getAttribute('.td-panel a.dk-choice', 'href')) === 'https://github.com/o/r/issues/212' && !!(await page.$('.td-panel .dk-choice.danger[data-action="unlink-github-issue"]')));
await shot('d3');
await click('.td-panel [data-action="unlink-github-issue"]');
check('d3: Unlink asked, then dropped the link', dialogs.some((m) => /Unlink/.test(m)) && (await task('g1')).source !== 'github');
await click('.td-panel [data-action="detail-back"]');
await closeDetails();

// delete, accepted
await click('.rm-tab[data-col="next"]');
await click('.rm-task-title[data-id="t4"]');
await click('.sort-drawer [data-action="rm-details"]');
await click('.td-panel [data-action="detail-more"]');
await click('.sort-drawer [data-action="detail-delete"]');
check('delete: after Yes the task is gone and the panel closed', (await task('t4')).id === undefined && !(await page.$('.td-panel')));

// from Sort: the slip's Details
await page.evaluate(() => { localStorage.setItem('focusdeck-screen', 'sort'); });
await page.reload();
await page.waitForSelector('.jot-slip');
await click('.jot-slip .task-open');
check('sort: Details on the slip opens the clipboard', !!(await page.$('.td-panel')) && (await text('.td-panel .sort-q')) === 'Unlabelled chore');
await shot('from-sort');
await closeDetails();

// from Organize: a title in Tidy up
await page.evaluate(() => { localStorage.setItem('focusdeck-screen', 'tidy'); });
await page.reload();
await page.waitForSelector('.org');
await click('.dk-btn[data-action="tidy-step"]');
await page.waitForSelector('.org-row .task-open');
await click('.org-row .task-open');
check('organize: a Tidy up title opens the clipboard', !!(await page.$('.td-panel')));
await shot('from-organize');
await closeDetails();

// from the Roadmap again, and Escape closes
await page.evaluate(() => { localStorage.setItem('focusdeck-screen', 'roadmap'); });
await page.reload();
await page.waitForSelector('.rm-main');
await click('.rm-task-title');
await click('.sort-drawer [data-action="rm-details"]');
check('roadmap: Details opens the clipboard', !!(await page.$('.td-panel')));
await shot('from-roadmap');
await page.keyboard.press('Escape');
await page.waitForTimeout(250);
check('Escape closes it', !(await page.$('.td-panel')));

await browser.close();
server.close();
const failed = results.filter((x) => !x).length;
console.log(failed ? failed + ' of ' + results.length + ' checks FAILED' : 'all ' + results.length + ' checks passed');
process.exit(failed ? 1 : 0);
