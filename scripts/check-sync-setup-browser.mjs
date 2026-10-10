// scripts/check-sync-setup-browser.mjs -- real-Chromium check of the guided GitHub sync setup (#125)
// at a phone width, with api.github.com answered by fixture responses (this sandbox can't reach
// GitHub): a first device (good key, the sync Gist made), a key missing Gists (named, not saved,
// fixed and re-checked), a second device (its existing Gist found and pulled in), an expired key,
// and the wrong thing pasted. Also checks the key is never sent anywhere but api.github.com.
// Usage: CHROMIUM=/opt/pw-browsers/chromium-1194/chrome-linux/chrome node scripts/check-sync-setup-browser.mjs
// Serves the repo root itself on 127.0.0.1:8130 for the length of the run (no separate server).
// Screenshots: docs/generated/pr125/.
import { createRequire } from 'node:module';
import { mkdirSync, readFileSync, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import { join, extname, normalize } from 'node:path';
const require = createRequire('/opt/node22/lib/node_modules/');
const { chromium } = require('playwright');
const ROOT = fileURLToPath(new URL('..', import.meta.url));
const OUT = join(ROOT, 'docs/generated/pr125/');
mkdirSync(OUT, { recursive: true });
const BASE = 'http://127.0.0.1:8130/app/';
const KEY = 'github_pat_11ABCDEFG0123456789_abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUV';
const GIST_FILE = 'focus-deck-state.json';

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
await new Promise((ok) => server.listen(8130, '127.0.0.1', ok));

const results = [];
const check = (name, ok, extra = '') => { results.push(ok); console.log((ok ? 'PASS ' : 'FAIL ') + name + (extra ? '  [' + extra + ']' : '')); };
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM, args: ['--no-sandbox'] });

const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': 'Authorization, Accept, X-GitHub-Api-Version, Content-Type', 'access-control-allow-methods': 'GET, POST, PATCH', 'access-control-expose-headers': 'X-OAuth-Scopes' };
const denied = { status: 403, body: { message: 'Resource not accessible by personal access token' } };
const remoteState = { projects: [{ id: 'pR1', name: 'Allotment', color: '#3E8E5E', tasks: [] }, { id: 'pR2', name: 'Band', color: '#4D6FB8', tasks: [] }], inbox: [], categories: [], completedLog: [], deletedTaskIds: {} };

// A fake api.github.com. `world` is mutable so a test can "fix the key on GitHub" mid-run.
async function open(scheme, world, storage = {}) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, colorScheme: scheme, serviceWorkers: 'block', hasTouch: true });
  const seen = { keyed: [], apiCalls: 0 };
  ctx.on('request', (r) => { const auth = r.headers().authorization; if (auth && auth.includes(KEY.slice(0, 20))) seen.keyed.push(new URL(r.url()).host); });
  await ctx.route('https://api.github.com/**', async (route) => {
    const req = route.request();
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors });
    seen.apiCalls++;
    const url = new URL(req.url());
    const p = url.pathname + url.search;
    let r = { status: 404, body: { message: 'Not Found' } };
    if (p === '/user') r = world.user;
    else if (p.startsWith('/gists?per_page=1&') || p === '/gists?per_page=1') r = world.gistsProbe;
    else if (p.startsWith('/gists?per_page=100')) r = { status: 200, body: world.existingGist ? [{ id: 'g9', updated_at: '2026-10-01T00:00:00Z', files: { [GIST_FILE]: {} } }] : [] };
    else if (p === '/gists' && req.method() === 'POST') { world.created = JSON.parse(req.postData()); r = { status: 201, body: { id: 'gNEW' } }; }
    else if (p.startsWith('/gists/g9')) r = { status: 200, body: { id: 'g9', files: { [GIST_FILE]: { content: JSON.stringify(remoteState) } } } };
    else if (p.startsWith('/user/repos')) r = { status: 200, body: [{ full_name: 'aj/site' }] };
    else if (p.startsWith('/repos/aj/site/issues')) r = world.issues || { status: 200, body: [] };
    return route.fulfill({ status: r.status, headers: { 'content-type': 'application/json', ...cors }, body: JSON.stringify(r.body) });
  });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => check('no page error: ' + e.message, false));
  await page.addInitScript((entries) => { for (const [k, v] of entries) if (localStorage.getItem(k) === null) localStorage.setItem(k, v); }, Object.entries(storage));
  await page.goto(BASE + 'setup.html');
  await page.waitForSelector('.setup');
  return { ctx, page, seen };
}
const step = (page) => page.$eval('.setup', (e) => e.dataset.step);
const go = (page, label) => page.click(`.setup >> text="${label}"`);
const ls = (page, k) => page.evaluate((key) => localStorage.getItem(key), k);
async function pasteAndCheck(page, key) {
  await page.fill('#key-input', key);
  await page.click('#paste-form button[type="submit"]');
  await page.waitForFunction(() => { const s = document.querySelector('.setup'); return s && s.dataset.step === 'check' && !/Checking your key/.test(s.textContent); });
}
const finding = (page, id) => page.$eval(`[data-finding="${id}"]`, (e) => ({ level: e.className.replace(/.*is-/, ''), text: e.textContent })).catch(() => null);
const wide = async (page, tag) => {
  const w = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  check(`${tag}: no sideways page scroll`, w <= 0, 'overflow ' + w + 'px');
};

// 1. First device, dark (and the key step in light)
{
  const world = { user: { status: 200, body: { login: 'aj' } }, gistsProbe: { status: 200, body: [] }, existingGist: false };
  const { ctx, page, seen } = await open('dark', world);
  check('first: opens on Why', (await step(page)) === 'why');
  await page.screenshot({ path: OUT + 'dark-1-why.png' });
  await go(page, 'Let’s do it');
  check('first: then the GitHub account step, links out', (await step(page)) === 'account' && (await page.$$eval('.setup a[target="_blank"]', (as) => as.map((a) => a.href))).join() === 'https://github.com/signup,https://github.com/login');
  await page.screenshot({ path: OUT + 'dark-2-account.png' });
  await go(page, 'I’m signed in');
  const href = await page.$eval('#token-page', (a) => a.href);
  check('first: the key step links to GitHub’s new-key page', href.startsWith('https://github.com/settings/personal-access-tokens/new'), href);
  const rows = await page.$$eval('.gh-row', (els) => els.map((e) => [e.querySelector('.gh-label').firstChild.textContent, e.querySelector('.gh-value').textContent, (e.querySelector('.gh-note') || {}).textContent || '']));
  const row = (label) => rows.find((r) => r[0] === label) || [];
  check('first: and lists what to choose (Gists needed, Issues optional)', row('Account permissions → Gists')[1] === 'Read and write' && row('Account permissions → Gists')[2].startsWith('needed') && row('Repository permissions → Issues')[2].startsWith('optional'), JSON.stringify(rows));
  await wide(page, 'first key step');
  await page.screenshot({ path: OUT + 'dark-3-key.png', fullPage: true });
  await go(page, 'I’ve copied my key');
  check('first: the paste field is focused', (await page.evaluate(() => document.activeElement.id)) === 'key-input');
  await page.screenshot({ path: OUT + 'dark-4-paste.png' });
  await pasteAndCheck(page, '  ' + KEY + '\n');
  check('first: a good key passes, account named', (await finding(page, 'account')).text.includes('@aj') && (await finding(page, 'gists')).level === 'ok' && (await finding(page, 'issues')).level === 'ok');
  check('first: the key is saved once it passes', (await ls(page, 'focusdeck-github-token')) === KEY);
  await page.screenshot({ path: OUT + 'dark-5-check-ok.png' });
  await go(page, 'Turn on sync');
  await page.waitForFunction(() => /Sync is on/.test(document.querySelector('.setup').textContent));
  check('first: no Gist yet, so one is made with this device’s data', !!world.created && !!world.created.files[GIST_FILE] && world.created.public === false);
  check('first: this device is connected to it', (await ls(page, 'focusdeck-gist-id')) === 'gNEW');
  check('first: it says what to do on the other device', ((await page.textContent('.setup')) || '').includes('paste the same key'));
  await page.screenshot({ path: OUT + 'dark-6-on.png' });
  check('first: the key went only to api.github.com', seen.keyed.length > 0 && seen.keyed.every((h) => h === 'api.github.com'), [...new Set(seen.keyed)].join());
  await ctx.close();

  const light = await open('light', world);
  await go(light.page, 'Let’s do it'); await go(light.page, 'I’m signed in');
  await light.page.screenshot({ path: OUT + 'light-3-key.png', fullPage: true });
  await light.ctx.close();
}

// 2. A key missing Gists: named, not saved; fixed on GitHub, checked again
{
  const world = { user: { status: 200, body: { login: 'aj' } }, gistsProbe: denied, existingGist: false };
  const { ctx, page } = await open('dark', world);
  for (const label of ['Let’s do it', 'I’m signed in', 'I’ve copied my key']) await go(page, label);
  await pasteAndCheck(page, KEY);
  const gists = await finding(page, 'gists');
  check('no Gists: it says exactly what is missing', gists.level === 'missing' && gists.text.includes('can’t save sync data, so turn on Gists'), gists.text);
  check('no Gists: Turn on sync is not offered', !(await page.$('.setup >> text="Turn on sync"')));
  check('no Gists: the key is not saved', (await ls(page, 'focusdeck-github-token')) === null);
  await page.screenshot({ path: OUT + 'dark-7-check-missing-gists.png' });
  world.gistsProbe = { status: 200, body: [] };
  await go(page, 'I’ve fixed it, check again');
  await page.waitForFunction(() => /Your key works/.test(document.querySelector('.setup').textContent));
  check('no Gists: after fixing it on GitHub, the same key passes and is saved', (await ls(page, 'focusdeck-github-token')) === KEY);
  await ctx.close();
}

// 3. A second device: the existing sync Gist is found and its data pulled in
{
  const world = { user: { status: 200, body: { login: 'aj' } }, gistsProbe: { status: 200, body: [] }, existingGist: true };
  const { ctx, page } = await open('dark', world);
  for (const label of ['Let’s do it', 'I’m signed in', 'I’ve copied my key']) await go(page, label);
  await pasteAndCheck(page, KEY);
  await go(page, 'Turn on sync');
  await page.waitForFunction(() => /Sync is on/.test(document.querySelector('.setup').textContent));
  check('second device: finds the existing Gist, makes no new one', (await ls(page, 'focusdeck-gist-id')) === 'g9' && !world.created);
  const st = JSON.parse(await ls(page, 'focusdeck-state-v1'));
  check('second device: the other device’s folders are here', ['Allotment', 'Band'].every((n) => st.projects.some((p) => p.name === n)));
  check('second device: and it says so', ((await page.textContent('.setup')) || '').includes('2 folders'));
  await page.screenshot({ path: OUT + 'dark-8-second-device.png' });
  await ctx.close();
}

// 4. Expired key, and the wrong thing pasted
{
  const world = { user: { status: 401, body: { message: 'Bad credentials' } }, gistsProbe: { status: 200, body: [] } };
  const { ctx, page, seen } = await open('dark', world);
  for (const label of ['Let’s do it', 'I’m signed in', 'I’ve copied my key']) await go(page, label);
  await pasteAndCheck(page, KEY);
  const rej = await finding(page, 'rejected');
  check('expired: says GitHub doesn’t accept it and what to do', !!rej && rej.text.includes('may have expired') && rej.text.includes('Make a new one'));
  await page.screenshot({ path: OUT + 'dark-9-check-expired.png' });
  await go(page, 'Paste a different key');
  const before = seen.apiCalls;
  await pasteAndCheck(page, 'https://github.com/settings/tokens');
  const fmt = await finding(page, 'format');
  check('wrong paste: caught here, nothing sent to GitHub', !!fmt && seen.apiCalls === before, fmt && fmt.text);
  await ctx.close();
}

// 5. Settings links in
{
  const { ctx, page } = await open('dark', { user: { status: 200, body: {} } });
  await page.goto(BASE + 'settings.html');
  check('settings: links to the guided setup', (await page.$eval('.setup-callout a', (a) => a.getAttribute('href'))) === 'setup.html');
  await ctx.close();
}

await browser.close();
server.close();
const failed = results.filter((ok) => !ok).length;
console.log(`\n${results.length - failed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
