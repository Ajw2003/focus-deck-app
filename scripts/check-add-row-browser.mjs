// scripts/check-add-row-browser.mjs -- real-Chromium check of the one-line add row on project cards
// (#240, docs/4-systems/quick-add.md), at phone (390x844) and desktop (1440x900) widths in dark and
// light: Enter adds a title-only task and leaves the box empty and focused; "More" opens the other
// boxes and a task added with them keeps its priority and date; Escape closes "More"; a half-typed
// title survives a repaint caused by another tab saving (the path a sync takes, #235).
// Usage: node scripts/check-add-row-browser.mjs [out-dir]   (CHROMIUM=... to pick a browser binary)
// Serves the repo root itself on 127.0.0.1:8147 for the length of the run. Screenshots go to the
// out-dir (default docs/generated/quick-add/).
import { createRequire } from 'node:module';
import { mkdirSync, readFileSync, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import { join, extname, normalize, resolve } from 'node:path';
const require = createRequire('/opt/node22/lib/node_modules/');
const { chromium } = require('playwright');
const ROOT = fileURLToPath(new URL('..', import.meta.url));
const OUT = resolve(process.argv[2] || join(ROOT, 'docs/generated/quick-add/')) + '/';
mkdirSync(OUT, { recursive: true });
const BASE = 'http://127.0.0.1:8147/app/';
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
await new Promise((ok) => server.listen(8147, '127.0.0.1', ok));

const day = 86400000;
const iso = (offsetDays) => new Date(Date.now() + offsetDays * day).toISOString().slice(0, 10);
const task = (id, title) => ({ id, title, status: 'next', categoryIds: [], priority: null, sortOrder: 0 });
const seed = () => ({
  projects: [
    { id: 'pHome', name: 'Home', color: '#3E8E5E', tasks: [task('h1', 'Recycling out on Thursday'), task('h2', 'Hallway photos')] },
    { id: 'pSchool', name: 'School', color: '#4D6FB8', tasks: [task('s1', 'Read chapter 4')] },
  ],
  categories: [{ id: 'c_chore', name: 'Chore', color: '#3E8E5E' }],
  inbox: [], completedLog: [], deletedTaskIds: [],
});

const results = [];
const check = (name, ok, extra = '') => { results.push(ok); console.log((ok ? 'PASS ' : 'FAIL ') + name + (extra ? '  [' + extra + ']' : '')); };
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM, args: ['--no-sandbox'] });
const SIZES = { phone: { width: 390, height: 844 }, desktop: { width: 1440, height: 900 } };
const ROW = '.add-row[data-project="pHome"]';
const TITLE = ROW + ' input[name="title"]';
const homeTasks = (page) => page.evaluate((k) => JSON.parse(localStorage.getItem(k)).projects.find((p) => p.id === 'pHome').tasks, STATE_KEY);

for (const size of ['phone', 'desktop']) {
  for (const scheme of ['light', 'dark']) {
    const tag = `[${size}/${scheme}]`;
    const ctx = await browser.newContext({ viewport: SIZES[size], colorScheme: scheme, serviceWorkers: 'block', hasTouch: size === 'phone' });
    await ctx.addInitScript(([s, key]) => {
      localStorage.setItem('focusdeck-onboarding', 'done');
      if (!localStorage.getItem('focusdeck-screen')) localStorage.setItem('focusdeck-screen', 'projects');
      if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify(s));
      if (!localStorage.getItem('focusdeck-project-view')) localStorage.setItem('focusdeck-project-view', 'all');
    }, [seed(), STATE_KEY]);
    const page = await ctx.newPage();
    page.on('pageerror', (e) => check(`${tag} no page error: ` + e.message, false));
    await page.goto(BASE);
    await page.waitForSelector(TITLE);

    check(`${tag} every card has an add row`, (await page.$$('.project-card .add-row')).length === 2);
    check(`${tag} the old "+ Add task" link is gone`, !(await page.$('[data-action="open-add-task"]')));
    check(`${tag} More starts closed`, !(await page.$(ROW + ' [name="steps"]')));

    // Title only: type, Enter, the task lands in Home's Up next and the box is empty and focused
    await page.click(TITLE);
    await page.keyboard.type('Ring the plumber');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(200);
    let tasks = await homeTasks(page);
    const added = tasks.find((t) => t.title === 'Ring the plumber');
    check(`${tag} Enter adds the task to Home's Up next`, !!added && added.status === 'next');
    check(`${tag} the box is empty and still focused for the next one`, await page.evaluate((sel) => document.activeElement === document.querySelector(sel) && document.activeElement.value === '', TITLE));
    check(`${tag} the new task shows on the card`, (await page.textContent('#proj-pHome')).includes('Ring the plumber'));

    // More: priority and a due date go onto the task
    await page.click(ROW + ' [data-action="toggle-add-more"]');
    await page.waitForSelector(ROW + ' [name="steps"]');
    check(`${tag} More opens steps, priority and due date`, !!(await page.$(ROW + ' [name="priority"]')) && !!(await page.$(ROW + ' [name="deadline"]')));
    await page.fill(TITLE, 'Book the boiler service');
    await page.selectOption(ROW + ' [name="priority"]', 'high');
    await page.fill(ROW + ' [name="deadline"]', iso(4));
    await page.dispatchEvent(ROW + ' [name="deadline"]', 'input');
    await page.waitForTimeout(150);
    await page.screenshot({ path: OUT + `built-row-more-${size}-${scheme}.png` });
    await page.click(ROW + ' button[type="submit"]');
    await page.waitForTimeout(200);
    tasks = await homeTasks(page);
    const detailed = tasks.find((t) => t.title === 'Book the boiler service');
    check(`${tag} a task added with More keeps its priority and date`, !!detailed && detailed.priority === 'high' && detailed.deadline === iso(4));
    check(`${tag} More closes after adding`, !(await page.$(ROW + ' [name="steps"]')));

    // Escape closes More
    await page.click(ROW + ' [data-action="toggle-add-more"]');
    await page.waitForSelector(ROW + ' [name="steps"]');
    await page.focus(TITLE);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(150);
    check(`${tag} Escape closes More`, !(await page.$(ROW + ' [name="steps"]')));

    // A half-typed title survives another tab saving (the storage event repaints this tab)
    await page.click(TITLE);
    await page.keyboard.type('Half-typed thought');
    const other = await ctx.newPage();
    await other.goto(BASE);
    await other.waitForSelector('.add-row[data-project="pSchool"] input[name="title"]');
    await other.fill('.add-row[data-project="pSchool"] input[name="title"]', 'From the other tab');
    await other.press('.add-row[data-project="pSchool"] input[name="title"]', 'Enter');
    await other.waitForTimeout(200);
    await page.bringToFront();
    await page.waitForFunction(() => (document.getElementById('proj-pSchool') || {}).textContent?.includes('From the other tab'), null, { timeout: 4000 }).catch(() => {});
    check(`${tag} the other tab's task arrived (so this tab repainted)`, (await page.textContent('#proj-pSchool')).includes('From the other tab'));
    check(`${tag} the half-typed title survived the repaint`, (await page.inputValue(TITLE)) === 'Half-typed thought');
    await other.close();

    const wide = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    check(`${tag} no sideways page scroll`, wide <= 0, 'overflow ' + wide + 'px');
    await page.$eval(ROW, (e) => { e.scrollIntoView({ block: 'center' }); });
    await page.screenshot({ path: OUT + `built-row-${size}-${scheme}.png` });

    // The Board (#241): no row with Project: All; choose School and the row adds to School
    await page.fill(TITLE, '');
    await page.dispatchEvent(TITLE, 'input');
    await page.click('[data-action="set-screen"][data-screen="board"]');
    await page.waitForSelector('[data-action="board-project-select"]');
    check(`${tag} Board with Project: All has no add row`, !(await page.$('.screen-board .add-row')));
    await page.selectOption('[data-action="board-project-select"]', 'pSchool');
    const BOARD_TITLE = '.screen-board .add-row[data-project="pSchool"] input[name="title"]';
    await page.waitForSelector(BOARD_TITLE);
    check(`${tag} Board with School chosen shows "Add a task to School…"`, (await page.getAttribute(BOARD_TITLE, 'placeholder')) === 'Add a task to School…');
    await page.click(BOARD_TITLE);
    await page.keyboard.type('Print the reading list');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(200);
    const school = await page.evaluate((k) => JSON.parse(localStorage.getItem(k)).projects.find((p) => p.id === 'pSchool').tasks, STATE_KEY);
    check(`${tag} Enter on the Board adds to School's Up next`, school.some((t) => t.title === 'Print the reading list' && t.status === 'next'));
    check(`${tag} the new task shows in the Board list`, (await page.textContent('.calm-cards')).includes('Print the reading list'));
    check(`${tag} the Board's box is empty and focused`, await page.evaluate((sel) => document.activeElement === document.querySelector(sel) && document.activeElement.value === '', BOARD_TITLE));
    await page.click('[data-action="board-col"][data-col="doing"]');
    await page.waitForTimeout(100);
    check(`${tag} no add row on In progress`, !(await page.$('.screen-board .add-row')));
    await page.click('[data-action="board-col"][data-col="next"]');
    await page.waitForSelector(BOARD_TITLE);
    const boardWide = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    check(`${tag} Board: no sideways page scroll`, boardWide <= 0, 'overflow ' + boardWide + 'px');
    await page.screenshot({ path: OUT + `built-board-${size}-${scheme}.png` });

    // The jotter's To: stamp (#242)
    const STAMP = '#capture-to', JOT = '#capture-input';
    const sel = (s) => page.evaluate((x) => { const e = document.querySelector(x); return e.options[e.selectedIndex].text; }, s);
    const stored = () => page.evaluate((k) => JSON.parse(localStorage.getItem(k)), STATE_KEY);
    check(`${tag} Board with School chosen: stamp reads "To: School" untouched`, (await sel(STAMP)) === 'To: School');
    await page.click('[data-action="set-screen"][data-screen="focus"]');
    await page.waitForTimeout(150);
    check(`${tag} Focus: stamp reads "To: Unsorted", Add reads "Add"`, (await sel(STAMP)) === 'To: Unsorted' && (await page.textContent('.jot-add')) === 'Add');
    const before = await stored();
    await page.click(JOT);
    await page.keyboard.type('A stray thought');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(200);
    const after = await stored();
    const count = (s) => s.projects.reduce((n, p) => n + p.tasks.length, 0);
    check(`${tag} Enter on Unsorted grows the inbox, adds no task`, after.inbox.length === before.inbox.length + 1 && count(after) === count(before));
    await page.selectOption(STAMP, 'pHome');
    check(`${tag} picking Home makes Add read "Add task"`, (await page.textContent('.jot-add')) === 'Add task');
    await page.click(JOT);
    await page.keyboard.type('Jotted straight to Home');
    await page.keyboard.press('Enter');
    await page.waitForSelector('.toast-action');
    const home = (await stored()).projects.find((p) => p.id === 'pHome').tasks.find((t) => t.title === 'Jotted straight to Home');
    check(`${tag} the jot became a task in Home's Up next`, !!home && home.status === 'next');
    check(`${tag} notice reads Added "…" to Home`, (await page.textContent('.toast-text')) === 'Added "Jotted straight to Home" to Home');
    check(`${tag} the jotter box is empty and focused`, await page.evaluate((s) => document.activeElement === document.querySelector(s) && document.activeElement.value === '', JOT));
    const jw = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    check(`${tag} jotter: no sideways page scroll`, jw <= 0, 'overflow ' + jw + 'px');
    // Room to jot (#244): on a phone the writing spans the jotter, with the stamp and Add on a line
    // below it (stamp left, Add right); on a computer all three stay on one line.
    const box = await page.evaluate(() => Object.fromEntries(['#capture-form', '#capture-input', '#capture-to', '#capture-form .jot-add']
      .map((s) => [s, document.querySelector(s).getBoundingClientRect().toJSON()])));
    const [form, input, stamp, add] = ['#capture-form', '#capture-input', '#capture-to', '#capture-form .jot-add'].map((s) => box[s]);
    if (size === 'phone') {
      check(`${tag} jotter: the writing spans the jotter`, input.width >= form.width - 40, Math.round(input.width) + ' of ' + Math.round(form.width) + 'px');
      check(`${tag} jotter: stamp and Add sit below the writing`, stamp.top >= input.bottom && add.top >= input.bottom);
      check(`${tag} jotter: stamp on the left, Add on the right`, stamp.right < add.left && add.right >= form.right - 30);
    } else {
      check(`${tag} jotter: writing, stamp and Add share one line`, stamp.top < input.bottom && add.top < input.bottom && input.right <= stamp.left);
    }
    await page.screenshot({ path: OUT + `built-jotter-${size}-${scheme}.png` });
    await page.click('.toast-action');
    await page.waitForSelector('[data-action="board-project-select"]');
    check(`${tag} Open shows the Board on Home with the task selected`, await page.evaluate(() => document.querySelector('[data-action="board-project-select"]').value === 'pHome' && /Jotted straight to Home/.test(document.querySelector('.screen-board').textContent) && !!document.querySelector('.cw-detail[data-selected]')));
    check(`${tag} Open clears the notice`, !(await page.$('.toast')));
    await page.keyboard.press('Escape'); // close the details panel (it covers the rail on a phone)
    await page.selectOption(STAMP, '');
    await page.click('[data-action="set-screen"][data-screen="sort"]');
    await page.waitForTimeout(150);
    check(`${tag} changing screen resets the manual pick (stamp follows again)`, (await sel(STAMP)) === 'To: Unsorted');
    await page.click('[data-action="set-screen"][data-screen="board"]');
    await page.waitForTimeout(150);
    check(`${tag} back on the Board (Home) the stamp follows: "To: Home"`, (await sel(STAMP)) === 'To: Home');
    await ctx.close();
  }
}
await browser.close(); server.close();
const failed = results.filter((r) => !r).length;
console.log(`\n${results.length - failed}/${results.length} checks passed`);
process.exit(failed ? 1 : 0);
