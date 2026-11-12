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
  // ---- project add row and chips
  let { ctx, page } = await open(size, 'roadmap');
  const ROW = '.add-row[data-project="pHome"]';
  await page.click('.rm-add-link');
  await page.waitForSelector(ROW + ' input[name="title"]');
  check(`${tag} pickers hidden before there is a title`, await page.$eval(ROW + ' .pick-blocks', (e) => e.hidden));
  await page.click(ROW + ' input[name="title"]');
  await page.keyboard.type('Ring the plumber');
  check(`${tag} pickers show once there is a title`, !(await page.$eval(ROW + ' .pick-blocks', (e) => e.hidden)));
  check(`${tag} Add is disabled and says why`, await page.$eval(ROW + ' button[type=submit]', (b) => b.disabled && b.textContent === 'Add') && (await page.textContent(ROW + ' .pick-hint')) === 'Pick a priority to add' && (await page.getAttribute(ROW + ' input[name="title"]', 'placeholder')) ?.startsWith('Add a task') && (await page.$eval(ROW + ' input[name="title"]', (i) => i.getBoundingClientRect().width)) > 120);
  await page.$eval(ROW, (e) => e.scrollIntoView({ block: 'center' }));
  await page.screenshot({ path: OUT + `${size}-add-title-only.png` });
  await page.keyboard.press('Enter'); // bypassing the disabled button: still nothing is added
  await page.waitForTimeout(150);
  check(`${tag} Enter with no priority adds nothing`, (await stored(page)).projects[0].tasks.length === 1);
  await page.click(ROW + ' [data-field="priority"][data-value="high"]');
  await page.click(ROW + ' [data-field="due"][data-value="friday"]');
  check(`${tag} High and Friday are pressed, Add enabled`, await page.$eval(ROW, (r) => r.querySelector('[data-value="high"]').getAttribute('aria-pressed') === 'true' && r.querySelector('[data-field="due"][data-value="friday"]').getAttribute('aria-pressed') === 'true' && !r.querySelector('button[type=submit]').disabled && r.querySelector('button[type=submit]').textContent === 'Add'));
  check(`${tag} the title survives the repaint`, (await page.inputValue(ROW + ' input[name="title"]')) === 'Ring the plumber');
  await page.screenshot({ path: OUT + `${size}-add-picked.png` });
  await page.click(ROW + ' button[type=submit]');
  await page.waitForTimeout(200);
  let t = (await stored(page)).projects[0].tasks.find((x) => x.title === 'Ring the plumber');
  check(`${tag} the task is stored with High and a due date`, !!t && t.priority === 'high' && /^\d{4}-\d\d-\d\d$/.test(t.deadline || ''), JSON.stringify(t && [t.priority, t.deadline]));
  // the Roadmap's task rows (#259): a read-only chip shows the priority and due date; a click opens Task details, where they change
  const rowSel = '.rm-task[data-task-id="' + (t && t.id) + '"]';
  check(`${tag} the Roadmap row shows "High" and a due chip`, (await page.$eval(rowSel + ' .priority-chip', (e) => e.textContent.trim())) === 'High' && !!(await page.$(rowSel + ' .deadline-chip')));
  check(`${tag} a Roadmap task with no priority shows no priority chip`, !(await page.$('.rm-task[data-task-id="h1"] .priority-chip')));
  await page.$eval(rowSel, (e) => e.scrollIntoView({ block: 'center' }));
  await page.click(rowSel + ' .priority-chip');
  await page.waitForSelector('.cw-detail');
  await page.click('.cw-detail [data-action="detail-fold"][data-key="when"]');
  check(`${tag} the chip opens Task details with High selected`, (await page.$eval('[data-detail-priority]', (e) => e.value)) === 'high');
  await page.screenshot({ path: OUT + `${size}-chip-picker.png` });
  await page.selectOption('[data-detail-priority]', 'urgent');
  t = (await stored(page)).projects[0].tasks.find((x) => x.title === 'Ring the plumber');
  check(`${tag} Task details sets the new priority and the row chip follows`, t.priority === 'urgent' && (await page.$eval(rowSel + ' .priority-chip', (e) => e.textContent.trim())) === 'Urgent');
  await page.fill('[data-detail-due]', '');
  await page.$eval('[data-detail-due]', (i) => i.dispatchEvent(new Event('change', { bubbles: true })));
  check(`${tag} clearing the date in Task details clears it`, !(await stored(page)).projects[0].tasks.find((x) => x.id === t.id).deadline);
  if (size === 'desktop') {
    await page.click('.rm-add-link'); // the clicks above were away from the add box, which closed it
    await page.click(ROW + ' input[name="title"]');
    await page.keyboard.type('Keys test');
    await page.focus(ROW + ' [data-field="priority"][data-value="low"]');
    await page.keyboard.press('2');
    check(`${tag} key 2 picks High`, await page.$eval(ROW + ' [data-field="priority"][data-value="high"]', (b) => b.getAttribute('aria-pressed') === 'true'));
    await page.click(ROW + ' [data-field="due"][data-value="date"]');
    await page.fill(ROW + ' [data-pick-type]', '15 dec');
    await page.keyboard.press('Enter');
    check(`${tag} a typed date is read`, /-12-15$/.test(await page.$eval(ROW + ' input[name="deadline"]', (i) => i.value)));
  }
  await ctx.close();

  // ---- Sort
  ({ ctx, page } = await open(size, 'sort'));
  await page.waitForSelector('.jot-slip');
  await page.waitForTimeout(300);
  check(`${tag} the Sort slip has the pickers, marked needed`, (await page.textContent('.sort-picks')).includes('Priority · needed'));
  const sel = '[data-wallet="tray-folders"] .sleeve[data-key="pSchool"] .icard';
  await page.$eval(sel, (el) => el.scrollIntoView({ block: 'center', inline: 'center' }));
  await page.waitForTimeout(400);
  const box = await (await page.$(sel)).boundingBox();
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await page.waitForTimeout(400);
  await page.click('.step-tab[data-step="3"]');
  check(`${tag} the file button waits for a priority`, await page.$eval('.file-btn', (b) => b.disabled && b.textContent === 'Pick a priority to file'));
  await page.$eval('.inbox-card', (e) => { e.scrollIntoView(); window.scrollBy(0, -130); });
  await page.screenshot({ path: OUT + `${size}-sort-needs-priority.png` });
  await page.click('.sort-picks [data-field="priority"][data-value="medium"]');
  await page.click('.sort-picks [data-field="due"][data-value="tomorrow"]');
  await page.screenshot({ path: OUT + `${size}-sort-picked.png` });
  await page.click('[data-action="unsorted-file"]');
  await page.waitForTimeout(200);
  const st = await stored(page);
  const filed = st.projects[1].tasks[0];
  check(`${tag} the thought is filed with Medium and a date`, !!filed && filed.priority === 'medium' && !!filed.deadline && st.inbox.length === 1, JSON.stringify(filed && [filed.priority, filed.deadline]));
  await ctx.close();
}

for (const size of ['phone', 'desktop']) {
  const tag = `[${size}]`;
  // ---- Roadmap: a second add box, and a priority set from Task details (the Board's add row and card chips moved here, #259)
  let { ctx, page } = await open(size, 'roadmap');
  const BR = '.rm-project .add-row[data-project="pHome"]';
  await page.click('.rm-add-link');
  await page.waitForSelector(BR + ' input[name="title"]');
  await page.click(BR + ' input[name="title"]');
  await page.keyboard.type('Board task');
  check(`${tag} Roadmap add row: Add disabled until a priority`, await page.$eval(BR + ' button[type=submit]', (b) => b.disabled));
  await page.keyboard.press('Enter');
  await page.waitForTimeout(150);
  check(`${tag} Roadmap add row: Enter without a priority adds nothing`, (await stored(page)).projects[0].tasks.length === 1);
  await page.click(BR + ' [data-field="priority"][data-value="urgent"]');
  await page.click(BR + ' [data-field="due"][data-value="today"]');
  await page.click(BR + ' button[type=submit]');
  await page.waitForTimeout(200);
  const bt = (await stored(page)).projects[0].tasks.find((x) => x.title === 'Board task');
  check(`${tag} Roadmap add row adds with Urgent and a date`, !!bt && bt.priority === 'urgent' && !!bt.deadline, JSON.stringify(bt && [bt.priority, bt.deadline]));
  const card = '.rm-task[data-task-id="h1"]';
  check(`${tag} Roadmap row with nothing set shows no priority or due chip`, !(await page.$(card + ' .priority-chip')) && !(await page.$(card + ' .deadline-chip')));
  await page.click(card + ' .rm-task-title');
  await page.waitForSelector('.cw-detail');
  await page.click('.cw-detail [data-action="detail-fold"][data-key="when"]');
  await page.selectOption('[data-detail-priority]', 'low');
  check(`${tag} one choice in Task details sets Low`, (await stored(page)).projects[0].tasks.find((x) => x.id === 'h1').priority === 'low');
  check(`${tag} the Roadmap row now shows the Low chip`, (await page.$eval(card + ' .priority-chip', (e) => e.textContent.trim())) === 'Low');
  await page.$eval(card, (e) => e.scrollIntoView({ block: 'center' }));
  await page.screenshot({ path: OUT + `${size}-board-chip-picker.png` });
  await ctx.close();

  // ---- bulk sort: one priority for the batch
  ({ ctx, page } = await open(size, 'sort'));
  await page.waitForSelector('[data-action="bulk-toggle"]');
  await page.click('[data-action="bulk-toggle"]');
  await page.click('[data-action="bulk-all"]');
  await page.selectOption('[data-bulk-project]', 'pSchool');
  check(`${tag} bulk: Apply is off with no priority and the panel says why`, await page.$eval('[data-action="bulk-apply"]', (b) => b.disabled) && (await page.textContent('.bulk-panel')).includes('Pick a priority for the thoughts you ticked.'));
  await page.screenshot({ path: OUT + `${size}-bulk-needs-priority.png`, fullPage: size === 'phone' });
  await page.click('[data-scope="bulk"][data-field="priority"][data-value="high"]');
  await page.click('[data-scope="bulk"][data-field="due"][data-value="tomorrow"]');
  await page.screenshot({ path: OUT + `${size}-bulk-picked.png`, fullPage: size === 'phone' });
  await page.click('[data-action="bulk-apply"]');
  await page.waitForTimeout(300);
  const bst = await stored(page);
  const bt2 = bst.projects[1].tasks.filter((x) => x.id !== 'h1'); // h1 is the seeded unlabelled task, moved along by Tick all
  check(`${tag} bulk: both thoughts filed with High and a date`, bt2.length === 2 && bt2.every((x) => x.priority === 'high' && !!x.deadline) && bst.inbox.length === 0, JSON.stringify(bt2.map((x) => [x.priority, x.deadline])));
  await ctx.close();
}
await browser.close();
server.close();
const failed = results.filter((r) => !r).length;
console.log(failed ? failed + ' FAILED' : 'all ' + results.length + ' passed');
process.exit(failed ? 1 : 0);
