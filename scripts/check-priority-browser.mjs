// scripts/check-priority-browser.mjs -- real-Chromium check of #249 (docs/4-systems/quick-add.md,
// in-tray.md): the add row asks for a priority and a due date, task chips open a small picker, and a
// Sort thought needs a priority. Phone (390x844) and desktop (1440x900).
// Usage: node scripts/check-priority-browser.mjs [out-dir]   (CHROMIUM=... to pick a browser binary)
// Serves the repo root itself on 127.0.0.1:8148. Screenshots go to the out-dir
// (default docs/generated/build-checks/step1/).
import { createRequire } from 'node:module';
import { mkdirSync, readFileSync, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import { join, extname, normalize, resolve } from 'node:path';
const require = createRequire('/opt/node22/lib/node_modules/');
const { chromium } = require('playwright');
const ROOT = fileURLToPath(new URL('..', import.meta.url));
const OUT = resolve(process.argv[2] || join(ROOT, 'docs/generated/build-checks/step1/')) + '/';
mkdirSync(OUT, { recursive: true });
const BASE = 'http://127.0.0.1:8148/app/';
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
await new Promise((ok) => server.listen(8148, '127.0.0.1', ok));

const now = Date.now();
const seed = () => ({
  projects: [
    { id: 'pHome', name: 'Home', color: '#3E8E5E', tasks: [{ id: 'h1', title: 'Recycling out', status: 'next', categoryIds: [], priority: null, sortOrder: 0 }] },
    { id: 'pSchool', name: 'School', color: '#4D6FB8', tasks: [] },
  ],
  categories: [], inbox: [{ id: 'th1', text: 'Buy a birthday card for Gran', createdAt: now - 60000 }, { id: 'th2', text: 'Email Ms Patel', createdAt: now - 30000 }],
  completedLog: [], deletedTaskIds: [], choosingMode: { mode: 'tap', updatedAt: 1 },
});
const results = [];
const check = (name, ok, extra = '') => { results.push(ok); console.log((ok ? 'PASS ' : 'FAIL ') + name + (extra ? '  [' + extra + ']' : '')); };
const browser = await chromium.launch();
const SIZES = { phone: { width: 390, height: 844 }, desktop: { width: 1440, height: 900 } };
const stored = (page) => page.evaluate((k) => JSON.parse(localStorage.getItem(k)), STATE_KEY);

async function open(size, screen) {
  const ctx = await browser.newContext({ viewport: SIZES[size], serviceWorkers: 'block' });
  await ctx.addInitScript(([s, key, scr]) => {
    localStorage.setItem('focusdeck-onboarding', 'done');
    if (!localStorage.getItem('focusdeck-screen')) localStorage.setItem('focusdeck-screen', scr);
    if (scr === 'board' || scr === 'projects' || scr === 'roadmap') localStorage.setItem('focusdeck-view', JSON.stringify({ mode: 'project', id: 'pHome' }));
    if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify(s));
  }, [seed(), STATE_KEY, screen]);
  const page = await ctx.newPage();
  page.on('pageerror', (e) => check(`[${size}] no page error: ` + e.message, false));
  await page.goto(BASE);
  return { ctx, page };
}

for (const size of ['phone', 'desktop']) {
  const tag = `[${size}]`;
  // ---- Roadmap: + Add a task, then priority and due date set in Task details (the add row and its pickers went with #268)
  let { ctx, page } = await open(size, 'roadmap');
  await page.click('[data-action="rm-screen"][data-screen="task"]');
  await page.waitForSelector('[data-rm-field="title"]');
  check(`${tag} New task: Add is off until there is a title`, await page.$eval('[data-action="rm-add-task"]', (b) => b.disabled));
  await page.click('[data-rm-field="title"]');
  await page.keyboard.type('Ring the plumber');
  await page.screenshot({ path: OUT + `${size}-add-title-only.png` });
  await page.click('[data-action="rm-add-more"]'); // More… adds it and opens its Task details
  await page.waitForSelector('.cw-detail');
  let t = (await stored(page)).projects[0].tasks.find((x) => x.title === 'Ring the plumber');
  check(`${tag} More… adds the task and opens its Task details`, !!t && (await page.getAttribute('.cw-detail', 'data-selected')) === t.id && !t.priority);
  await page.click('.cw-detail [data-action="detail-edit"][data-step="2"]');
  check(`${tag} the priority step in Task details has the four flags`, (await page.$$('.cw-detail .sort-flags .sort-flag')).length >= 4);
  await page.click('.cw-detail .sort-flag[data-level="high"]');
  await page.click('.cw-detail [data-action="edit-save"]');
  await page.click('.cw-detail [data-action="detail-edit"][data-step="4"]');
  await page.click('.cw-detail .sort-cal-page[data-value="friday"]');
  await page.click('.cw-detail [data-action="edit-save"]');
  t = (await stored(page)).projects[0].tasks.find((x) => x.title === 'Ring the plumber');
  check(`${tag} the task is stored with High and a due date`, !!t && t.priority === 'high' && /^\d{4}-\d\d-\d\d$/.test(t.deadline || ''), JSON.stringify(t && [t.priority, t.deadline]));
  check(`${tag} the receipt shows High`, (await page.textContent('.cw-detail .sort-receipt > div:nth-child(1) em')).includes('High'));
  await page.screenshot({ path: OUT + `${size}-add-picked.png` });
  await page.click('.cw-detail [data-action="detail-edit"][data-step="2"]');
  check(`${tag} Task details opens the priority step with High selected`, (await page.$eval('.cw-detail .sort-flag.on', (e) => e.getAttribute('data-level'))) === 'high');
  await page.click('.cw-detail .sort-flag[data-level="urgent"]');
  await page.click('.cw-detail [data-action="edit-save"]');
  t = (await stored(page)).projects[0].tasks.find((x) => x.title === 'Ring the plumber');
  check(`${tag} Task details sets the new priority`, t.priority === 'urgent' && (await page.textContent('.cw-detail .sort-receipt > div:nth-child(1) em')).includes('Urgent'));
  await page.click('.cw-detail [data-action="detail-edit"][data-step="4"]');
  await page.click('.cw-detail .sort-cal-page[data-value="none"]');
  await page.click('.cw-detail [data-action="edit-save"]');
  check(`${tag} clearing the date in Task details clears it`, !(await stored(page)).projects[0].tasks.find((x) => x.id === t.id).deadline);
  await page.click('.cw-detail [data-action="detail-edit"][data-step="4"]');
  await page.click('.cw-detail [data-action="pick-set"][data-field="due"][data-value="date"]');
  await page.fill('.cw-detail [data-pick-type]', '15 dec');
  await page.keyboard.press('Enter');
  await page.click('.cw-detail [data-action="sort-use-date"]');
  await page.click('.cw-detail [data-action="edit-save"]');
  check(`${tag} a typed date is read`, /-12-15$/.test((await stored(page)).projects[0].tasks.find((x) => x.id === t.id).deadline || ''));
  await page.click('[data-action="detail-close"]');
  // a task row carries no priority or due chip; its priority is read in Task details
  check(`${tag} a Roadmap row shows no priority or due chip`, !(await page.$('.rm-task .priority-chip, .rm-task .deadline-chip')));
  await ctx.close();

  // ---- Sort
  ({ ctx, page } = await open(size, 'sort'));
  await page.waitForSelector('.jot-slip');
  await page.waitForTimeout(300);
  await page.click('[data-action="sort-next"]');
  await page.waitForSelector('[data-wallet="tray-folders"]');
  const sel = '[data-wallet="tray-folders"] .sleeve[data-key="pSchool"] .icard';
  await page.$eval(sel, (el) => el.scrollIntoView({ block: 'center', inline: 'center' }));
  await page.waitForTimeout(400);
  const box = await (await page.$(sel)).boundingBox();
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await page.waitForTimeout(400);
  await page.click('.sort-foot .file-btn');
  check(`${tag} the priority step is a page of flags and Next waits for a priority`, (await page.textContent('.sort-q')) === 'How important?' && (await page.$$('.sort-flags .sort-flag')).length === 4 && (await page.$eval('.sort-foot .file-btn', (b) => b.disabled)) && !(await page.$('.step-why')));
  await page.screenshot({ path: OUT + `${size}-sort-needs-priority.png` });
  await page.click('.sort-picks [data-field="priority"][data-value="medium"]');
  await page.click('.sort-foot .file-btn'); // labels
  await page.click('.sort-foot .file-btn'); // due date
  await page.click('.sort-cal-page[data-value="tomorrow"]');
  await page.screenshot({ path: OUT + `${size}-sort-picked.png` });
  for (let i = 0; i < 5; i++) { await page.click('.sort-foot .dk-skip'); await page.waitForTimeout(100); } // skip to the receipt
  check(`${tag} the receipt shows Medium and the date`, (await page.textContent('.sort-receipt')).includes('Medium') && /\d/.test(await page.$eval('.sort-receipt > div:nth-child(4) em', (e) => e.textContent)));
  await page.click('[data-action="unsorted-file"]');
  await page.waitForTimeout(200);
  const st = await stored(page);
  const filed = st.projects[1].tasks[0];
  check(`${tag} the thought is filed with Medium and a date`, !!filed && filed.priority === 'medium' && !!filed.deadline && st.inbox.length === 1, JSON.stringify(filed && [filed.priority, filed.deadline]));
  await ctx.close();
}

for (const size of ['phone', 'desktop']) {
  const tag = `[${size}]`;
  // ---- Roadmap: a priority set from Task details on a task that has none
  let { ctx, page } = await open(size, 'roadmap');
  const card = '.rm-task[data-task-id="h1"]';
  await page.click(card + ' .rm-task-title');
  await page.click('.sort-drawer [data-action="rm-details"]');
  await page.waitForSelector('.cw-detail');
  await page.click('.cw-detail [data-action="detail-edit"][data-step="2"]');
  await page.click('.cw-detail .sort-flag[data-level="low"]');
  await page.click('.cw-detail [data-action="edit-save"]');
  check(`${tag} one choice in Task details sets Low`, (await stored(page)).projects[0].tasks.find((x) => x.id === 'h1').priority === 'low');
  check(`${tag} Task details now reads Low`, (await page.textContent('.cw-detail .sort-receipt > div:nth-child(1) em')).includes('Low'));
  await page.screenshot({ path: OUT + `${size}-board-chip-picker.png` });
  await ctx.close();

  // ---- Sort several: one priority for the batch (tick, project and priority, labels, group, All good?)
  ({ ctx, page } = await open(size, 'sort'));
  await page.waitForSelector('[data-action="bulk-toggle"]');
  await page.click('[data-action="bulk-toggle"]');
  await page.click('[data-action="bulk-all"]');
  await page.click('.sort-foot [data-action="bulk-next"]');
  const bsel = '[data-wallet="tray-folders"] .sleeve[data-key="pSchool"] .icard';
  await page.$eval(bsel, (el) => el.scrollIntoView({ block: 'center', inline: 'center' }));
  await page.waitForTimeout(400);
  const bbox = await (await page.$(bsel)).boundingBox();
  await page.mouse.click(bbox.x + bbox.width / 2, bbox.y + bbox.height / 2);
  await page.waitForTimeout(400);
  check(`${tag} bulk: Next is off with no priority`, await page.$eval('.sort-foot [data-action="bulk-next"]', (b) => b.disabled));
  await page.screenshot({ path: OUT + `${size}-bulk-needs-priority.png`, fullPage: size === 'phone' });
  await page.click('[data-scope="bulk"][data-field="priority"][data-value="high"]');
  await page.screenshot({ path: OUT + `${size}-bulk-picked.png`, fullPage: size === 'phone' });
  for (let i = 0; i < 3; i++) { await page.click('.sort-foot [data-action="bulk-next"], .sort-foot .dk-skip'); await page.waitForTimeout(150); } // labels, group (skipped), then the receipt
  await page.click('[data-action="bulk-apply"]');
  await page.waitForTimeout(300);
  const bst = await stored(page);
  const bt2 = bst.projects[1].tasks.filter((x) => x.id !== 'h1'); // h1 is the seeded task, moved along by Tick all
  check(`${tag} bulk: both thoughts filed with High`, bt2.length === 2 && bt2.every((x) => x.priority === 'high') && bst.inbox.length === 0, JSON.stringify(bt2.map((x) => [x.title, x.priority])));
  await ctx.close();
}
await browser.close();
server.close();
const failed = results.filter((r) => !r).length;
console.log(failed ? failed + ' FAILED' : 'all ' + results.length + ' passed');
process.exit(failed ? 1 : 0);
