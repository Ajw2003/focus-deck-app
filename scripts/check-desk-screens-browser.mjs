// scripts/check-desk-screens-browser.mjs -- real-Chromium tour of every screen #123 restyles, at phone
// (390x844) and desktop (1280x900) widths in dark and light: the All and One views, the project list
// (sidebar / phone drawer) and its "+ New" panel, task rows, the task editor with the due-date step,
// the project Edit panel, the move dialog, a toast, and the Settings page.
// Usage: CHROMIUM=/opt/pw-browsers/chromium-1194/chrome-linux/chrome node scripts/check-desk-screens-browser.mjs [out-dir]
// Serves the repo root itself on 127.0.0.1:8127 for the length of the run (no separate server).
// Screenshots go to the out-dir (default docs/generated/pr123/). Checks: no page errors, no sideways
// scroll on any screen, and that each screen's controls are there and work as before.
import { createRequire } from 'node:module';
import { mkdirSync, readFileSync, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import { join, extname, normalize, resolve } from 'node:path';
const require = createRequire('/opt/node22/lib/node_modules/');
const { chromium } = require('playwright');
const ROOT = fileURLToPath(new URL('..', import.meta.url));
const OUT = resolve(process.argv[2] || join(ROOT, 'docs/generated/pr123/')) + '/';
mkdirSync(OUT, { recursive: true });
const BASE = 'http://127.0.0.1:8127/app/';
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
await new Promise((ok) => server.listen(8127, '127.0.0.1', ok));

const day = 86400000;
const iso = (offsetDays) => new Date(Date.now() + offsetDays * day).toISOString().slice(0, 10);
const task = (id, title, cats, extra = {}) => ({ id, title, status: 'next', categoryIds: cats, priority: null, sortOrder: 0, ...extra });
const seed = () => ({
  projects: [
    { id: 'pHome', name: 'Home', color: '#3E8E5E', tasks: [
      task('h1', 'Reply to Sam about the camping trip', ['c_chore'], { priority: 'high', deadline: iso(0), dueSetAt: Date.now() - 6 * day }),
      task('h2', 'Recycling out on Thursday', ['c_chore'], { priority: 'low', deadline: iso(3), dueSetAt: Date.now() - 2 * day }),
      task('h3', 'Hallway photos', ['c_art']),
      task('h4', 'Bought the paint', ['c_chore'], { status: 'done', completedAt: Date.now() - day }),
    ] },
    { id: 'pWeb', name: 'Website', color: '#C9584F', source: 'github', repoFullName: 'someone/website', tasks: [
      task('w1', 'Footer link points to the old blog', ['c_bug'], { priority: 'urgent', issueNumber: 12, repoFullName: 'someone/website', source: 'github', url: 'https://github.com/someone/website/issues/12' }),
      task('w2', 'Contact form sends twice on a slow connection', ['c_bug', 'c_study'], { priority: 'medium', issueNumber: 14, repoFullName: 'someone/website', source: 'github', url: 'https://github.com/someone/website/issues/14', deadline: iso(9), dueSetAt: Date.now() - day }),
    ] },
    { id: 'pSchool', name: 'School', color: '#4D6FB8', tasks: [task('s1', 'Read chapter 4', ['c_study'], { priority: 'high' })] },
  ],
  categories: [
    { id: 'c_chore', name: 'Chore', color: '#3E8E5E' }, { id: 'c_art', name: 'Art', color: '#C2731E' },
    { id: 'c_bug', name: 'Bug', color: '#C9584F' }, { id: 'c_study', name: 'Study', color: '#4D6FB8' },
  ],
  inbox: [], completedLog: [], deletedTaskIds: [],
});

const results = [];
const check = (name, ok, extra = '') => { results.push(ok); console.log((ok ? 'PASS ' : 'FAIL ') + name + (extra ? '  [' + extra + ']' : '')); };

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM, args: ['--no-sandbox'] });
const SIZES = { phone: { width: 390, height: 844 }, desktop: { width: 1280, height: 900 } };

async function open(size, scheme, path = '', view = 'all') {
  const ctx = await browser.newContext({ viewport: SIZES[size], colorScheme: scheme, serviceWorkers: 'block', hasTouch: size === 'phone' });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => check(`[${size}/${scheme}] no page error: ` + e.message, false));
  await page.addInitScript(([s, key, v]) => {
    if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify(s));
    if (!localStorage.getItem('focusdeck-project-view')) localStorage.setItem('focusdeck-project-view', v);
  }, [seed(), STATE_KEY, view]);
  await page.goto(BASE + path);
  await page.waitForTimeout(500);
  return { ctx, page };
}
async function shot(page, tag, name, fullPage = false) {
  const wide = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  check(`${tag} ${name}: no sideways page scroll`, wide <= 0, 'overflow ' + wide + 'px');
  await page.screenshot({ path: OUT + tag.replace(/[[\]]/g, '').replace('/', '-') + '-' + name + '.png', fullPage });
}
const scrollTo = (page, sel) => page.$eval(sel, (e) => { e.scrollIntoView({ block: 'start' }); window.scrollBy(0, -120); });

for (const size of ['phone', 'desktop']) {
  for (const scheme of ['dark', 'light']) {
    const tag = `[${size}/${scheme}]`;
    let { ctx, page } = await open(size, scheme);

    // The All view: project cards, task rows (checkbox, title, chips, deadline stages, grips)
    await scrollTo(page, '.project-card');
    check(`${tag} project cards render`, (await page.$$('.project-card')).length === 3);
    check(`${tag} task rows keep their grips and checkboxes`, (await page.$$('.task-row [data-action="toggle-task"]')).length >= 5 && (await page.$$('.task-row .task-grip, .task-row [class*="grip"]')).length >= 5);
    await shot(page, tag, 'all-view');

    // The task editor, and the due-date step that appears when a new date is set
    await page.click('.task-title[data-task="h3"]');
    await page.waitForSelector('.task-edit-form');
    await page.fill('.task-edit-form input[name="deadline"]', iso(5));
    await page.dispatchEvent('.task-edit-form input[name="deadline"]', 'input');
    await page.dispatchEvent('.task-edit-form input[name="deadline"]', 'change');
    await page.waitForTimeout(150);
    check(`${tag} the due-date step appears in the editor`, !!(await page.$('.task-edit-form .due-step')));
    await scrollTo(page, '.task-edit-form');
    await shot(page, tag, 'task-editor');
    await page.click('[data-action="cancel-task-edit"]');

    // The project Edit panel
    await page.click('[data-action="open-project-edit"][data-project="pHome"]');
    await page.waitForSelector('.project-edit-panel');
    await scrollTo(page, '.project-edit-panel');
    await shot(page, tag, 'project-edit');
    await page.click('[data-action="close-project-edit"][data-project="pHome"]');

    // The move dialog (the one a drag between a GitHub project and another asks)
    await page.evaluate(() => import('./js/move-dialog.js').then((m) => { m.confirmMove('Move "Footer link points to the old blog" to Home? It will be closed on GitHub as moved.'); }));
    await page.waitForSelector('.move-dialog');
    check(`${tag} the move dialog opens with its buttons`, (await page.$$('.move-dialog [data-dialog]')).length >= 2);
    await shot(page, tag, 'move-dialog');
    await page.keyboard.press('Escape');

    // A toast
    await page.evaluate(() => import('./js/app.js').then((m) => { m.ui.notice = 'Filed to Home.'; m.paint(); }));
    await page.waitForSelector('.toast');
    await shot(page, tag, 'toast');
    await page.click('.toast-close');

    // The project list: the sidebar on desktop, the drawer on a phone, and its "+ New" panel
    if (size === 'phone') {
      await page.click('#projects-btn');
      await page.waitForTimeout(300);
    }
    await page.evaluate(() => window.scrollTo(0, 0));
    check(`${tag} the project list shows every project`, (await page.$$('.sidebar-project')).length === 3);
    await shot(page, tag, 'project-list');
    await page.click('#new-panel-toggle');
    await page.waitForSelector('#new-panel');
    await shot(page, tag, 'new-panel');
    await ctx.close();

    // The One view (stored, as the switch is in the drawer on a phone)
    ({ ctx, page } = await open(size, scheme, '', 'one'));
    const oneCards = await page.$$eval('.project-card', (els) => els.filter((e) => e.offsetParent !== null).length);
    check(`${tag} the One view shows one project`, oneCards === 1, oneCards + ' visible');
    await scrollTo(page, '.project-card');
    await shot(page, tag, 'one-view');
    await ctx.close();

    // Settings
    ({ ctx, page } = await open(size, scheme, 'settings.html'));
    await shot(page, tag, 'settings', true);
    await ctx.close();
  }
}

await browser.close();
server.close();
const failed = results.filter((ok) => !ok).length;
console.log(`\n${results.length - failed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
