// scripts/check-settings-browser.mjs -- real-Chromium check of Settings reorganised with the setup
// checklist (#126): the four groups in order, the checklist on a fresh device and a set-up one (each
// unfinished item linking to its step), every existing setting showing its saved value and still
// saving, the key and Gist controls under "Paste a key or a sync Gist ID directly" still working
// (api.github.com simulated), and the "Link a repo" item opening the repo panel.
// Usage: CHROMIUM=/opt/pw-browsers/chromium-1194/chrome-linux/chrome node scripts/check-settings-browser.mjs
// Serves the repo root itself on 127.0.0.1:8131 for the length of the run (no separate server).
// Screenshots: docs/generated/pr126/.
import { createRequire } from 'node:module';
import { mkdirSync, readFileSync, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import { join, extname, normalize } from 'node:path';
const require = createRequire('/opt/node22/lib/node_modules/');
const { chromium } = require('playwright');
const ROOT = fileURLToPath(new URL('..', import.meta.url));
const OUT = join(ROOT, 'docs/generated/pr126/');
mkdirSync(OUT, { recursive: true });
const BASE = 'http://127.0.0.1:8131/app/';
const STATE_KEY = 'focusdeck-state-v1';
const KEY = 'github_pat_11ABCDEFG0123456789_abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUV';

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
await new Promise((ok) => server.listen(8131, '127.0.0.1', ok));

const results = [];
const check = (name, ok, extra = '') => { results.push(ok); console.log((ok ? 'PASS ' : 'FAIL ') + name + (extra ? '  [' + extra + ']' : '')); };
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM, args: ['--no-sandbox'] });
const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': 'Authorization, Accept, X-GitHub-Api-Version, Content-Type', 'access-control-allow-methods': 'GET, POST, PATCH' };

const setUp = {
  projects: [{ id: 'pHome', name: 'Home', color: '#3E8E5E', tasks: [{ id: 'h1', title: 'Bins', status: 'next', categoryIds: [] }] }],
  inbox: [], completedLog: [], deletedTaskIds: {},
  categories: [{ id: 'c_chore', name: 'Chore', color: '#3E8E5E' }],
  projectCategories: [{ id: 'pcat_work', name: 'Work', color: '#4D6FB8' }],
  gistId: 'gOLD',
  noteFace: { face: 'dyslexic', updatedAt: 5 },
  choosingMode: { mode: 'swipe', updatedAt: 5 },
  dueDefaults: { yellowPct: 40, redPct: 15, updatedAt: 5 },
};

async function open(size, scheme, storage = {}, path = 'settings.html') {
  const ctx = await browser.newContext({ viewport: size === 'phone' ? { width: 390, height: 844 } : { width: 1280, height: 900 }, colorScheme: scheme, serviceWorkers: 'block' });
  await ctx.route('https://api.github.com/**', (route) => {
    const req = route.request();
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors });
    const p = new URL(req.url()).pathname;
    let body = {}, status = 200;
    if (p === '/user') body = { login: 'aj' };
    else if (p === '/gists' && req.method() === 'POST') { status = 201; body = { id: 'gNEW' }; }
    else if (p === '/gists') body = [];
    else if (p.startsWith('/gists/')) body = { id: 'gX', files: { 'focus-deck-state.json': { content: JSON.stringify({ projects: [], inbox: [], categories: [] }) } } };
    else if (p === '/user/repos') body = [{ full_name: 'aj/site', name: 'site', owner: { login: 'aj' }, private: false, updated_at: '2026-10-01T00:00:00Z' }];
    return route.fulfill({ status, headers: { 'content-type': 'application/json', ...cors }, body: JSON.stringify(body) });
  });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => check(`[${size}/${scheme}] no page error: ` + e.message, false));
  page.on('dialog', (d) => d.accept());
  await page.addInitScript((entries) => { for (const [k, v] of entries) if (localStorage.getItem(k) === null) localStorage.setItem(k, v); }, Object.entries(storage));
  await page.goto(BASE + path);
  await page.waitForSelector('#checklist-items li');
  return { ctx, page };
}
const items = (page) => page.$$eval('#checklist-items li', (els) => els.map((e) => ({ id: e.dataset.item, done: e.classList.contains('is-done'), href: (e.querySelector('a') || {}).getAttribute ? e.querySelector('a').getAttribute('href') : null })));
const stored = (page) => page.evaluate((k) => JSON.parse(localStorage.getItem(k)), STATE_KEY);

// 1. A fresh device: groups, and a checklist with nothing done
for (const size of ['phone', 'desktop']) for (const scheme of ['dark', 'light']) {
  const tag = `[${size}/${scheme}]`;
  const { ctx, page } = await open(size, scheme);
  const groups = await page.$$eval('.settings-group', (els) => els.map((e) => e.textContent));
  check(`${tag} groups in order`, groups.join('|') === 'How it looks|How it works|Sync and GitHub|Help', groups.join('|'));
  const wide = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  check(`${tag} no sideways page scroll`, wide <= 0, 'overflow ' + wide + 'px');
  if (size === 'phone' && scheme === 'dark') {
    const list = await items(page);
    check('fresh: the checklist starts at 0 of 3', (await page.textContent('#checklist-title')) === 'Getting set up: 0 of 3 done');
    check('fresh: each item links to its step', JSON.stringify(list.map((i) => i.href)) === JSON.stringify(['./?welcome', './?welcome', 'setup.html', 'setup.html']), JSON.stringify(list));
    check('fresh: the long token instructions are gone, the guided setup is the way in', !((await page.textContent('body')) || '').includes('Create a fine-grained token') && (await page.$eval('#sync-section .setup-callout a', (a) => a.getAttribute('href'))) === 'setup.html');
  }
  await page.screenshot({ path: OUT + `${size}-${scheme}-fresh.png`, fullPage: true });
  await ctx.close();
}

// 2. A set-up device: saved values show, and still save
{
  const { ctx, page } = await open('phone', 'dark', { [STATE_KEY]: JSON.stringify(setUp), 'focusdeck-github-token': KEY, 'focusdeck-gist-id': 'gOLD' });
  check('set up: the checklist says All set up', (await page.textContent('#checklist-title')) === 'All set up');
  const list = await items(page);
  check('set up: only the optional repo item is left, linking to the repo panel', list.filter((i) => !i.done).map((i) => i.id + '=' + i.href).join() === 'issues=index.html?new=repo', JSON.stringify(list));
  await page.screenshot({ path: OUT + 'phone-dark-set-up.png', fullPage: true });
  check('set up: Note writing shows its saved face', await page.$eval('input[value="dyslexic"]', (i) => i.checked));
  check('set up: Choosing a card shows its saved mode', await page.$eval('#choosing-section input[value="swipe"]', (i) => i.checked));
  check('set up: Due dates show their saved cut-offs', (await page.inputValue('#due-yellow-pct')) === '40' && (await page.inputValue('#due-red-pct')) === '15');
  check('set up: category colours list both kinds', (await page.$$('#task-cat-list .cat-color-row')).length === 1 && (await page.$$('#proj-cat-list .cat-color-row')).length === 1);
  check('set up: the sync status names the Gist', ((await page.textContent('#gist-status')) || '').includes('gOLD'));

  await page.check('input[value="print"]');
  await page.check('#choosing-section input[value="tap"]');
  await page.fill('#due-yellow-pct', '50'); await page.dispatchEvent('#due-yellow-pct', 'change');
  await page.fill('#task-cat-list ~ form input[name="name"]', 'Errand'); await page.press('#task-cat-list ~ form input[name="name"]', 'Enter');
  await page.waitForTimeout(200);
  const st = await stored(page);
  check('set up: changes still save (note face, choosing, due, a new category)', st.noteFace.face === 'print' && st.choosingMode.mode === 'tap' && st.dueDefaults.yellowPct === 50 && st.categories.some((c) => c.name === 'Errand'), JSON.stringify({ n: st.noteFace, c: st.choosingMode, d: st.dueDefaults }));
  await ctx.close();
}

// 3. The direct controls still work: paste a key, create a Gist, connect a Gist ID; the checklist follows
{
  const { ctx, page } = await open('phone', 'light', { [STATE_KEY]: JSON.stringify({ ...setUp, gistId: null }) });
  check('direct: the key and Gist controls are tucked away', !(await page.isVisible('#token-input')));
  await page.click('.settings-advanced summary');
  await page.fill('#token-input', KEY);
  await page.click('#save-token');
  await page.waitForFunction(() => /Connected as @aj/.test(document.getElementById('toast-root').textContent));
  check('direct: Save checks and stores the key', (await page.evaluate(() => localStorage.getItem('focusdeck-github-token'))) === KEY);
  await page.click('#create-gist');
  await page.waitForFunction(() => /gNEW/.test(document.getElementById('gist-status').textContent));
  check('direct: Create sync Gist makes and connects one', (await page.evaluate(() => localStorage.getItem('focusdeck-gist-id'))) === 'gNEW');
  await page.waitForTimeout(200);
  check('direct: the checklist ticks sync off without a reload', (await items(page)).find((i) => i.id === 'sync').done);
  await page.fill('#gist-id-input', 'gX');
  await page.click('#connect-gist');
  await page.waitForFunction(() => /gX/.test(document.getElementById('gist-status').textContent));
  check('direct: Connect switches to a pasted Gist ID', (await page.evaluate(() => localStorage.getItem('focusdeck-gist-id'))) === 'gX');
  await page.screenshot({ path: OUT + 'phone-light-direct.png', fullPage: true });
  await ctx.close();
}

// 4. "Link a repo" opens the + New panel on its repo tab
{
  const { ctx, page } = await open('phone', 'dark', { [STATE_KEY]: JSON.stringify(setUp), 'focusdeck-github-token': KEY, 'focusdeck-gist-id': 'gOLD' });
  await page.click('[data-item="issues"] a');
  await page.waitForSelector('#new-panel');
  await page.waitForTimeout(300);
  check('repo link: the drawer opens on the repo tab', !!(await page.$('.project-sidebar.is-open')) && ((await page.textContent('#new-panel')) || '').includes('aj/site'));
  check('repo link: the address is tidied', !page.url().includes('new=repo'));
  await page.screenshot({ path: OUT + 'phone-dark-repo-link.png' });
  await ctx.close();
}

await browser.close();
server.close();
const failed = results.filter((ok) => !ok).length;
console.log(`\n${results.length - failed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
