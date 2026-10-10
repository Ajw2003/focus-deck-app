// scripts/check-onboarding-browser.mjs -- real-Chromium check of first-run onboarding (#124) at a
// phone width: the full flow (welcome, folder, tasks with a category, first pick, sync offer), when it
// shows and when it doesn't (fresh, existing data, a second device with a key or a sync Gist, after
// skipping, after leaving half-way), the replay from Settings, and the no-folders empty state.
// Usage: CHROMIUM=/opt/pw-browsers/chromium-1194/chrome-linux/chrome node scripts/check-onboarding-browser.mjs
// Serves the repo root itself on 127.0.0.1:8128 for the length of the run (no separate server).
// Screenshots: docs/generated/pr124/.
import { createRequire } from 'node:module';
import { mkdirSync, readFileSync, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import { join, extname, normalize } from 'node:path';
const require = createRequire('/opt/node22/lib/node_modules/');
const { chromium } = require('playwright');
const ROOT = fileURLToPath(new URL('..', import.meta.url));
const OUT = join(ROOT, 'docs/generated/pr124/');
mkdirSync(OUT, { recursive: true });
const BASE = 'http://127.0.0.1:8128/app/';
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
await new Promise((ok) => server.listen(8128, '127.0.0.1', ok));

const results = [];
const check = (name, ok, extra = '') => { results.push(ok); console.log((ok ? 'PASS ' : 'FAIL ') + name + (extra ? '  [' + extra + ']' : '')); };
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM, args: ['--no-sandbox'] });

const withData = { projects: [{ id: 'pHome', name: 'Home', color: '#3E8E5E', tasks: [{ id: 'h1', title: 'Bins', status: 'next', categoryIds: [] }] }], inbox: [], categories: [], completedLog: [], deletedTaskIds: {} };

// `storage` is written before the app loads, once per context (an init script that only fills empty keys).
async function open(scheme, storage = {}, path = '') {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, colorScheme: scheme, serviceWorkers: 'block', hasTouch: true });
  // a key on a second device makes the app try GitHub; answer as if offline, not from the real API
  await ctx.route('https://api.github.com/**', (r) => r.abort());
  const page = await ctx.newPage();
  page.on('pageerror', (e) => check(`[${scheme}] no page error: ` + e.message, false));
  await page.addInitScript((entries) => { for (const [k, v] of entries) if (localStorage.getItem(k) === null) localStorage.setItem(k, v); }, Object.entries(storage));
  await page.goto(BASE + path);
  await page.waitForTimeout(400);
  return { ctx, page };
}
const onboardingShown = async (page) => !!(await page.$('.onboarding'));
const step = (page) => page.$eval('.onboarding', (e) => e.dataset.step).catch(() => null);
const stored = (page) => page.evaluate((k) => JSON.parse(localStorage.getItem(k) || 'null'), STATE_KEY);
const wide = async (page, tag) => {
  const w = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  check(`${tag}: no sideways page scroll`, w <= 0, 'overflow ' + w + 'px');
};

// 1. The full flow on a fresh device, dark and light
for (const scheme of ['dark', 'light']) {
  const tag = `[${scheme}] fresh`;
  const { ctx, page } = await open(scheme);
  check(`${tag}: the welcome shows`, (await step(page)) === 'welcome');
  await wide(page, tag + ' welcome');
  await page.screenshot({ path: OUT + scheme + '-1-welcome.png' });

  await page.click('[data-action="ob-next"]');
  await page.waitForTimeout(100); // the field is focused on the next frame
  check(`${tag}: Let's start opens the folder step, input focused`, (await step(page)) === 'folder' && (await page.evaluate(() => document.activeElement.id)) === 'ob-folder-name');
  await page.click('[data-action="ob-suggest"][data-name="School"]');
  check(`${tag}: a suggestion fills the name`, (await page.inputValue('#ob-folder-name')) === 'School');
  await page.screenshot({ path: OUT + scheme + '-2-folder.png' });
  await page.click('.ob-form button[type="submit"]');
  await page.waitForTimeout(150);
  let st = await stored(page);
  const school = st && st.projects.find((p) => p.name === 'School');
  check(`${tag}: the folder is made`, !!school);
  check(`${tag}: the tasks step follows`, (await step(page)) === 'tasks' && (await page.$eval('.ob-title', (e) => e.textContent)) === 'A few tasks for School');
  check(`${tag}: Deal waits for a task`, await page.$eval('.ob-acts .file-btn', (b) => b.disabled));

  await page.click('[data-action="ob-category"][data-name="Study"]');
  await page.fill('#ob-task-title', 'Read chapter 4 of the history book');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(150);
  check(`${tag}: the task input keeps focus for the next one`, (await page.evaluate(() => document.activeElement.id)) === 'ob-task-title');
  await page.fill('#ob-task-title', 'Flashcards for French');
  await page.keyboard.press('Enter');
  await page.click('[data-action="ob-category"][data-name="Study"]'); // off again
  await page.fill('#ob-task-title', 'Return library books');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(150);
  st = await stored(page);
  const tasks = st.projects.find((p) => p.name === 'School').tasks;
  const study = st.categories.find((c) => c.name === 'Study');
  check(`${tag}: three tasks are added`, tasks.length === 3, tasks.map((t) => t.title).join(' | '));
  check(`${tag}: the chosen category is made and put on its tasks`, !!study && tasks[0].categoryIds.includes(study.id) && tasks[1].categoryIds.includes(study.id) && !tasks[2].categoryIds.length);
  check(`${tag}: the added tasks are listed`, (await page.$$('.ob-list li')).length === 3);
  await wide(page, tag + ' tasks');
  await page.screenshot({ path: OUT + scheme + '-3-tasks.png' });

  await page.click('[data-action="ob-deal"]');
  await page.waitForTimeout(200);
  const picked = await page.$eval('.onboarding .focus-title', (e) => e.textContent).catch(() => '');
  check(`${tag}: the first pick deals one of them on the sticky note`, tasks.some((t) => t.title === picked), picked);
  await page.screenshot({ path: OUT + scheme + '-4-pick.png' });

  await page.click('[data-action="ob-next"]');
  check(`${tag}: then the sync offer`, (await step(page)) === 'sync');
  await page.screenshot({ path: OUT + scheme + '-5-sync.png' });
  await page.click('[data-action="ob-finish"]');
  await page.waitForTimeout(200);
  check(`${tag}: Not now lands on the Focus screen with the pick`, !(await onboardingShown(page)) && !!(await page.$('.screen-focus .focus-active')));
  await page.screenshot({ path: OUT + scheme + '-6-app.png' });
  await page.click('.rail [data-screen="projects"]');
  await page.waitForTimeout(200);
  check(`${tag}: and the new folder is on the Projects screen`, !!(await page.$('#proj-' + school.id)));
  await page.click('.rail [data-screen="focus"]');
  await page.reload();
  await page.waitForTimeout(300);
  check(`${tag}: it does not come back after a reload`, !(await onboardingShown(page)));
  await ctx.close();
}

// 2. Skip at the welcome: the app works, and its empty state is not a dead end
{
  const { ctx, page } = await open('dark');
  await page.click('[data-action="ob-skip"]');
  await page.waitForTimeout(200);
  check('skip: the app shows its Focus screen, pointing to Projects', !(await onboardingShown(page)) && ((await page.$eval('.desk-empty', (e) => e.textContent)) || '').includes('Make your first folder on the Projects screen'));
  await page.click('.desk-empty [data-screen="projects"]');
  await page.waitForTimeout(200);
  check('skip: Go to Projects shows the empty folders spot, saying what goes there', ((await page.$eval('.projects-empty', (e) => e.textContent)) || '').includes('No folders yet'));
  await page.screenshot({ path: OUT + 'dark-7-skipped-empty.png' });
  await page.click('.rail [data-screen="focus"]');
  await page.waitForTimeout(200);
  await page.click('#projects-btn');
  await page.waitForTimeout(300);
  check('skip: the Projects button, with no projects, opens the first-project panel', !!(await page.$('.projects-empty #new-panel')));
  await page.reload();
  await page.waitForTimeout(300);
  await page.click('[data-action="start-new-project"]');
  await page.waitForTimeout(300);
  check('skip: + New project opens the new-project panel, name field focused', !!(await page.$('#new-panel')) && (await page.evaluate(() => document.activeElement && document.activeElement.closest('#new-panel') !== null)));
  await page.screenshot({ path: OUT + 'dark-8-new-project.png' });
  await page.keyboard.type('Garden');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(200);
  check('skip: the project is made from there', !!(await stored(page)).projects.find((p) => p.name === 'Garden'));
  await page.reload();
  await page.waitForTimeout(300);
  check('skip: no welcome after a reload', !(await onboardingShown(page)));
  await ctx.close();
}

// 3. Leaving half-way (a reload on the tasks step): the app works with what was made
{
  const { ctx, page } = await open('dark');
  await page.click('[data-action="ob-next"]');
  await page.fill('#ob-folder-name', 'Work');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(200);
  await page.reload();
  await page.waitForTimeout(300);
  check('half-way: after leaving, the app shows the folder made so far', !(await onboardingShown(page)) && ((await page.textContent('body')) || '').includes('Work'));
  await ctx.close();
}

// 4. When it never shows
for (const [name, storage] of [
  ['existing data', { [STATE_KEY]: JSON.stringify(withData) }],
  ['a second device with a saved key', { 'focusdeck-github-token': 'github_pat_test' }],
  ['a second device with a sync Gist', { 'focusdeck-gist-id': 'abc123' }],
  ['a device that finished it', { 'focusdeck-onboarding': 'done' }],
]) {
  const { ctx, page } = await open('dark', storage);
  check(`no welcome for ${name}`, !(await onboardingShown(page)));
  await ctx.close();
}

// 5. Replay from Settings, over existing data
{
  const { ctx, page } = await open('dark', { [STATE_KEY]: JSON.stringify(withData), 'focusdeck-onboarding': 'done' }, 'settings.html');
  const href = await page.$eval('#help-section a', (a) => a.getAttribute('href'));
  check('replay: Settings > Help links to the welcome', href === './?welcome', href);
  await page.screenshot({ path: OUT + 'dark-9-settings-help.png' });
  await page.click('#help-section a');
  await page.waitForTimeout(400);
  check('replay: the welcome shows over existing data', (await step(page)) === 'welcome');
  await page.click('[data-action="ob-skip"]');
  await page.waitForTimeout(200);
  check('replay: leaving it drops ?welcome from the address and keeps the data', !page.url().includes('welcome') && !!(await stored(page)).projects.find((p) => p.name === 'Home'));
  await ctx.close();
}

// 6. "Set up sync" opens the guided setup (#125)
{
  const { ctx, page } = await open('dark', {}, '?welcome');
  for (const s of ['welcome', 'folder']) { if (s === 'folder') { await page.fill('#ob-folder-name', 'Home'); await page.keyboard.press('Enter'); } else await page.click('[data-action="ob-next"]'); await page.waitForTimeout(150); }
  await page.fill('#ob-task-title', 'Bins out');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(150);
  await page.click('[data-action="ob-deal"]');
  await page.click('[data-action="ob-next"]');
  await page.click('[data-action="ob-sync"]');
  await page.waitForURL(/setup\.html/);
  check('sync: Set up sync opens the guided setup', page.url().endsWith('setup.html'));
  await ctx.close();
}

await browser.close();
server.close();
const failed = results.filter((ok) => !ok).length;
console.log(`\n${results.length - failed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
