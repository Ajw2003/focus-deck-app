// scripts/check-category-filter-browser.mjs -- real-Chromium check of Settings > Category choices
// (#133) at a phone width: the in-tray's flag cards offer only the folder's own categories plus
// "More categories", which shows the rest; the task editor's label picker hides the others behind
// "Show all N categories" (ticked ones always show); turning the setting off in Settings shows every
// category everywhere, and the choice is stored.
// Usage: CHROMIUM=/opt/pw-browsers/chromium-1194/chrome-linux/chrome node scripts/check-category-filter-browser.mjs
// Serves the repo root itself on 127.0.0.1:8133 for the length of the run (no separate server).
// Screenshots: docs/generated/pr133/.
import { createRequire } from 'node:module';
import { mkdirSync, readFileSync, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import { join, extname, normalize } from 'node:path';
const require = createRequire('/opt/node22/lib/node_modules/');
const { chromium } = require('playwright');
const ROOT = fileURLToPath(new URL('..', import.meta.url));
const OUT = join(ROOT, 'docs/generated/pr133/');
mkdirSync(OUT, { recursive: true });
const BASE = 'http://127.0.0.1:8133/app/';
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
await new Promise((ok) => server.listen(8133, '127.0.0.1', ok));

const results = [];
const check = (name, ok, extra = '') => { results.push(ok); console.log((ok ? 'PASS ' : 'FAIL ') + name + (extra ? '  [' + extra + ']' : '')); };
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM, args: ['--no-sandbox'] });

const t = (id, title, cats) => ({ id, title, status: 'next', categoryIds: cats });
const seed = {
  projects: [
    { id: 'pHome', name: 'Home', color: '#3E8E5E', tasks: [t('h1', 'Bins', ['c_chore']), t('h2', 'Mop', ['c_chore', 'c_garden']), t('h3', 'Fix the gate', [])] },
    { id: 'pSchool', name: 'School', color: '#4D6FB8', tasks: [t('s1', 'Read', ['c_study']), t('s2', 'Essay', ['c_essay'])] },
  ],
  categories: ['chore', 'garden', 'study', 'essay', 'art', 'music'].map((n) => ({ id: 'c_' + n, name: n[0].toUpperCase() + n.slice(1), color: '#4D6FB8' })),
  inbox: [{ id: 'th1', text: 'Plant the bulbs', createdAt: Date.now() - 60000 }],
  completedLog: [], deletedTaskIds: {},
  choosingMode: { mode: 'tap', updatedAt: 1 },
};

async function open(storage = {}, path = '') {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, serviceWorkers: 'block' });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => check('no page error: ' + e.message, false));
  await page.addInitScript((entries) => { for (const [k, v] of entries) if (localStorage.getItem(k) === null) localStorage.setItem(k, v); }, Object.entries({ 'focusdeck-onboarding': 'done', [STATE_KEY]: JSON.stringify(seed), ...storage }));
  await page.goto(BASE + path);
  await page.waitForTimeout(400);
  return { ctx, page };
}
const flagKeys = (page) => page.$$eval('[data-wallet="tray-flags"] .sleeve', (els) => els.map((e) => e.dataset.key));
async function chooseFolder(page, key) {
  const sel = '[data-wallet="tray-folders"] .sleeve[data-key="' + key + '"] .icard';
  await page.$eval(sel, (el) => el.scrollIntoView({ block: 'center', inline: 'center' }));
  await page.waitForTimeout(300);
  const b = await (await page.$(sel)).boundingBox();
  await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2);
  await page.waitForTimeout(300);
}
async function chooseFlag(page, key) {
  const sel = '[data-wallet="tray-flags"] .sleeve[data-key="' + key + '"] .icard';
  await page.$eval(sel, (el) => el.scrollIntoView({ block: 'center', inline: 'center' }));
  await page.waitForTimeout(300);
  const b = await (await page.$(sel)).boundingBox();
  await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2);
  await page.waitForTimeout(300);
}
const kinds = ['kind:reminder', 'kind:build', 'kind:fix'];

// 1. In the in-tray: before a folder, all; Home's flags; More categories shows the rest
{
  const { ctx, page } = await open();
  await page.waitForSelector('[data-wallet="tray-flags"]');
  check('in-tray, no folder yet: every category is offered', (await flagKeys(page)).length === kinds.length + 6);
  await chooseFolder(page, 'pHome');
  const home = await flagKeys(page);
  check('in-tray, Home chosen: only Home’s categories, then More categories', JSON.stringify(home) === JSON.stringify([...kinds, 'c_chore', 'c_garden', '__more__']), home.join());
  check('More categories says how many', ((await page.$eval('[data-key="__more__"] .ct', (e) => e.textContent)) || '') === '4 more');
  await page.$eval('.inbox-card', (e) => { e.scrollIntoView(); window.scrollBy(0, -130); });
  await page.screenshot({ path: OUT + 'tray-filtered.png' });
  await chooseFlag(page, '__more__');
  const all = await flagKeys(page);
  check('choosing More categories shows them all', all.length === kinds.length + 6 && !all.includes('__more__'), all.join());
  await chooseFlag(page, 'c_music');
  await page.click('.file-btn');
  await page.waitForTimeout(300);
  const st = JSON.parse(await page.evaluate((k) => localStorage.getItem(k), STATE_KEY));
  const filed = st.projects.find((p) => p.id === 'pHome').tasks.find((x) => x.title === 'Plant the bulbs');
  check('a category from the rest can be used: filed with Music', !!filed && filed.categoryIds.includes('c_music'));
  await ctx.close();
}

// 2. In the task editor: Home's labels, ticked ones, then Show all
{
  const { ctx, page } = await open();
  await page.click('.task-title[data-task="h2"]');
  await page.waitForSelector('.task-edit-form .label-picker');
  await page.click('.task-edit-form .label-picker summary');
  const visible = () => page.$$eval('.task-edit-form .label-option', (els) => els.filter((e) => e.offsetParent !== null).map((e) => e.textContent.trim()));
  check('editor: only Home’s labels show', (await visible()).join() === 'Chore,Garden', (await visible()).join());
  await page.fill('.task-edit-form input[name="title"]', 'Mop the kitchen floor');
  await page.$eval('.task-edit-form', (e) => { e.scrollIntoView(); window.scrollBy(0, -130); });
  await page.screenshot({ path: OUT + 'editor-filtered.png' });
  await page.click('.task-edit-form [data-action="label-show-all"]');
  check('editor: Show all reveals all six, and keeps what was typed', (await visible()).length === 6 && (await page.inputValue('.task-edit-form input[name="title"]')) === 'Mop the kitchen floor');
  await ctx.close();
}

// 3. Settings: turning it off shows everything, and it is stored
{
  const { ctx, page } = await open({}, 'settings.html');
  check('Settings: Category choices is on by default', await page.isChecked('#category-filter-on'));
  await page.$eval('#category-filter-section', (e) => e.scrollIntoView());
  await page.screenshot({ path: OUT + 'settings.png' });
  await page.uncheck('#category-filter-on');
  const stored = JSON.parse(await page.evaluate((k) => localStorage.getItem(k), STATE_KEY)).categoryFilter;
  check('Settings: turning it off is stored with a stamp', stored.on === false && stored.updatedAt > 0, JSON.stringify(stored));
  await page.goto(BASE);
  await page.waitForSelector('[data-wallet="tray-folders"]');
  await chooseFolder(page, 'pHome');
  check('off: Home offers every category, no More card', (await flagKeys(page)).length === kinds.length + 6);
  await page.click('.task-title[data-task="h1"]');
  await page.waitForSelector('.task-edit-form');
  check('off: the editor has no Show all', !(await page.$('.task-edit-form [data-action="label-show-all"]')));
  await ctx.close();
}

await browser.close();
server.close();
const failed = results.filter((ok) => !ok).length;
console.log(`\n${results.length - failed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
