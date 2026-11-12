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
      if (!localStorage.getItem('focusdeck-screen')) localStorage.setItem('focusdeck-screen', 'roadmap');
      if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify(s));
      if (!localStorage.getItem('focusdeck-view')) localStorage.setItem('focusdeck-view', JSON.stringify({ mode: 'project', id: 'pHome' })); // the add row now lives in a Roadmap milestone (#259)
    }, [seed(), STATE_KEY]);
    const page = await ctx.newPage();
    page.on('pageerror', (e) => check(`${tag} no page error: ` + e.message, false));
    await page.goto(BASE);
    const FIELD = '[data-rm-field="title"]', NEWTASK = '[data-action="rm-screen"][data-screen="task"]';
    await page.click(NEWTASK); // "+ Add a task" opens the New task page (#268); the one-line add row is gone
    await page.waitForSelector(FIELD);

    check(`${tag} the New task page has its title field`, (await page.$$(FIELD)).length === 1);
    check(`${tag} the old add row and "+ Add task" link are gone`, !(await page.$('.add-row, [data-action="open-add-task"], .rm-add-link')));
    check(`${tag} Add is off until there is a title`, await page.$eval('[data-action="rm-add-task"]', (b) => b.disabled));

    // Title only: type, Enter, the task lands in Home's Up next and the list is back
    await page.click(FIELD);
    await page.keyboard.type('Ring the plumber');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(200);
    let tasks = await homeTasks(page);
    const added = tasks.find((t) => t.title === 'Ring the plumber');
    check(`${tag} Enter adds the task to Home's Up next`, !!added && added.status === 'next');
    check(`${tag} the page is back on the list`, !(await page.$(FIELD)));
    check(`${tag} the new task shows on the Roadmap`, (await page.textContent('.rm-project')).includes('Ring the plumber'));

    // More…: adds the task and opens Task details, where priority and due date go on
    await page.click(NEWTASK);
    await page.waitForSelector(FIELD);
    await page.fill(FIELD, 'Book the boiler service');
    await page.screenshot({ path: OUT + `built-row-more-${size}-${scheme}.png` });
    await page.click('[data-action="rm-add-more"]');
    await page.waitForSelector('.cw-detail');
    await page.click('.cw-detail [data-action="detail-edit"][data-step="2"]');
    await page.click('.cw-detail .sort-flag[data-level="high"]');
    await page.click('.cw-detail [data-action="edit-save"]');
    await page.click('.cw-detail [data-action="detail-edit"][data-step="4"]');
    await page.click('.cw-detail .sort-cal-page[data-value="friday"]');
    await page.click('.cw-detail [data-action="edit-save"]');
    tasks = await homeTasks(page);
    const detailed = tasks.find((t) => t.title === 'Book the boiler service');
    check(`${tag} a task added with More… keeps its priority and date`, !!detailed && detailed.priority === 'high' && /^\d{4}-\d\d-\d\d$/.test(detailed.deadline || ''));
    await page.click('[data-action="detail-close"]');

    // Escape is the Back corner
    await page.click(NEWTASK);
    await page.waitForSelector(FIELD);
    await page.focus(FIELD);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(150);
    check(`${tag} Escape leaves the New task page`, !(await page.$(FIELD)));

    // A half-typed title survives another tab saving (the storage event repaints this tab)
    await page.click(NEWTASK);
    await page.waitForSelector(FIELD);
    await page.click(FIELD);
    await page.keyboard.type('Half-typed thought');
    const other = await ctx.newPage();
    await other.goto(BASE);
    await other.click(NEWTASK);
    await other.waitForSelector(FIELD);
    await other.fill(FIELD, 'From the other tab');
    await other.press(FIELD, 'Enter');
    await other.waitForTimeout(300);
    await page.bringToFront();
    await page.waitForFunction((k) => JSON.parse(localStorage.getItem(k)).projects[0].tasks.some((t) => t.title === 'From the other tab'), STATE_KEY, { timeout: 4000 }).catch(() => {});
    await page.waitForTimeout(400);
    check(`${tag} the half-typed title survived the repaint`, (await page.inputValue(FIELD)) === 'Half-typed thought');
    await page.click('[data-action="rm-back"]');
    check(`${tag} the other tab's task arrived (so this tab repainted)`, (await page.textContent('.rm-project')).includes('From the other tab'));
    await other.close();

    const wide = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    check(`${tag} no sideways page scroll`, wide <= 0, 'overflow ' + wide + 'px');
    await page.screenshot({ path: OUT + `built-row-${size}-${scheme}.png` });

    // The Roadmap (#259): choose School from the Projects tab and add a task to it
    await page.click('.rail [data-screen="projects"]'); // the project list is the Projects tab (#267); a project opens on the Roadmap
    await page.waitForSelector('.pj-card');
    check(`${tag} the Projects list has no add row`, !(await page.$('.pj .add-row')));
    await page.click('.pj-card[data-project="pSchool"]');
    await page.click(NEWTASK);
    await page.waitForSelector(FIELD);
    await page.click(FIELD);
    await page.keyboard.type('Print the reading list');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(200);
    const school = await page.evaluate((k) => JSON.parse(localStorage.getItem(k)).projects.find((p) => p.id === 'pSchool').tasks, STATE_KEY);
    check(`${tag} Enter on the Roadmap adds to School's Up next`, school.some((t) => t.title === 'Print the reading list' && t.status === 'next'));
    check(`${tag} the new task shows on the Roadmap`, (await page.textContent('.rm-project')).includes('Print the reading list'));
    await page.click(NEWTASK);
    await page.waitForSelector(FIELD);
    await page.click('[data-action="rm-back"]');
    check(`${tag} the Back corner closes the New task page`, !(await page.$(FIELD)));
    const boardWide = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    check(`${tag} Roadmap: no sideways page scroll`, boardWide <= 0, 'overflow ' + boardWide + 'px');
    await page.screenshot({ path: OUT + `built-board-${size}-${scheme}.png` });

    // The + Jot screen and its destination card (#242 stamp, #263 screen)
    const JOT = '#jot-input', WHERE = '.jot-where';
    const dest = () => page.textContent(WHERE);
    const stored = () => page.evaluate((k) => JSON.parse(localStorage.getItem(k)), STATE_KEY);
    const closed = async () => !(await page.$('.jot-screen'));
    await page.click('#jot-open');
    check(`${tag} Roadmap with School chosen: + Jot opens its screen, destination reads School`, !!(await page.$('.jot-screen')) && (await dest()).includes('School'));
    await page.keyboard.press('Escape');
    check(`${tag} Escape closes the + Jot screen`, await closed());
    await page.click('[data-action="set-screen"][data-screen="focus"]');
    await page.waitForTimeout(150);
    check(`${tag} Focus: no jot box in the topbar`, !(await page.$('#capture-input, #capture-form')));
    await page.click('#jot-open');
    check(`${tag} Focus: destination reads Sort, box is focused`, (await dest()).includes('Sort') && await page.evaluate(() => document.activeElement.id === 'jot-input'));
    const before = await stored();
    await page.keyboard.type('A stray thought');
    await page.click('.jot-save');
    await page.waitForTimeout(200);
    const after = await stored();
    const count = (s) => s.projects.reduce((n, p) => n + p.tasks.length, 0);
    check(`${tag} Save on Sort grows the inbox, adds no task, closes the screen`, after.inbox.length === before.inbox.length + 1 && count(after) === count(before) && await closed());
    check(`${tag} the toast reads Saved ✓`, (await page.textContent('.toast-text')) === 'Saved ✓');
    await page.click('#jot-open');
    await page.click(WHERE);
    check(`${tag} the drawer asks "Where should it go?" with Sort, a find box and projects`, await page.evaluate(() => { const d = document.querySelector('.jot-drawer'); return !!d && d.textContent.includes('Where should it go?') && d.textContent.includes('Sort') && !!d.querySelector('[data-jot-search]') && !!d.querySelector('[data-id="pHome"]'); }));
    await page.screenshot({ path: OUT + `built-jot-drawer-${size}-${scheme}.png` });
    await page.click('.jot-drawer [data-id="pHome"]');
    check(`${tag} picking Home puts Home on the card, drawer closed`, (await dest()).includes('Home') && !(await page.$('.jot-drawer')));
    await page.click(JOT);
    await page.keyboard.type('Jotted straight to Home');
    const jw = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    check(`${tag} jot screen: no sideways page scroll`, jw <= 0, 'overflow ' + jw + 'px');
    await page.screenshot({ path: OUT + `built-jot-${size}-${scheme}.png` });
    await page.click('.jot-save');
    await page.waitForSelector('.toast-action');
    const home = (await stored()).projects.find((p) => p.id === 'pHome').tasks.find((t) => t.title === 'Jotted straight to Home');
    check(`${tag} the jot became a task in Home's Up next`, !!home && home.status === 'next');
    check(`${tag} toast reads Saved ✓`, (await page.textContent('.toast-text')) === 'Saved ✓');
    await page.click('.toast-action');
    await page.waitForSelector('.vs-tape');
    check(`${tag} Open shows the Roadmap on Home with the task selected`, await page.evaluate(() => document.querySelector('.vs-tape').textContent.includes('Home') && /Jotted straight to Home/.test(document.querySelector('.screen-roadmap').textContent) && !!document.querySelector('.cw-detail[data-selected]')));
    check(`${tag} Open clears the notice`, !(await page.$('.toast')));
    await page.keyboard.press('Escape'); // close the details panel (it covers the rail on a phone)
    await page.click('#jot-open');
    await page.click(WHERE); await page.click('.jot-drawer [data-id=""]');
    await page.fill(JOT, 'x'); await page.click('.jot-save'); await page.waitForTimeout(150);
    await page.click('[data-action="set-screen"][data-screen="sort"]');
    await page.waitForTimeout(150);
    await page.click('#jot-open');
    check(`${tag} changing screen resets the manual pick (destination follows again)`, (await dest()).includes('Sort'));
    await page.keyboard.press('Escape');
    await page.click('[data-action="set-screen"][data-screen="roadmap"]');
    await page.waitForTimeout(150);
    await page.click('#jot-open');
    check(`${tag} back on the Roadmap (Home) the destination follows: Home`, (await dest()).includes('Home'));
    await page.keyboard.press('Escape');
    await ctx.close();
  }
}
await browser.close(); server.close();
const failed = results.filter((r) => !r).length;
console.log(`\n${results.length - failed}/${results.length} checks passed`);
process.exit(failed ? 1 : 0);
