// scripts/shoot-projects-267.mjs -- real-Chromium walk through the Projects tab at 390x844 (#267).
// Usage: CHROMIUM=/opt/pw-browsers/chromium-1243/chrome-linux64/chrome node scripts/shoot-projects-267.mjs
// Serves the repo root on 127.0.0.1:8267, seeds localStorage and a fake GitHub token, and answers every api.github.com
// request from a stub (nothing leaves the machine; any other outside request fails the run). Then like a thumb: the list
// (r0), the Sort by drawer (r0m) and each sort order, My order (r0o), New project in four steps (r5 r6 r7 r8) with each
// GitHub choice (No, My repo r8a, New repo r8b, Someone else's r8c), and Make it opening the new project's Roadmap with
// the Made slip (r9). Every screen is measured: no page scroll, no visible text under 13px. Screenshots go to
// docs/generated/projects-267/.
import { createRequire } from 'node:module';
import { mkdirSync, readFileSync, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import { join, extname, normalize } from 'node:path';
const require = createRequire('/opt/node22/lib/node_modules/');
const { chromium } = require('playwright');
const ROOT = fileURLToPath(new URL('..', import.meta.url));
const OUT = join(ROOT, 'docs/generated/projects-267/');
mkdirSync(OUT, { recursive: true });
const BASE = 'http://127.0.0.1:8267/app/';
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
await new Promise((ok) => server.listen(8267, '127.0.0.1', ok));

const now = Date.now(), day = 864e5, iso = (n) => new Date(now + n * day).toISOString().slice(0, 10);
const task = (id, title, extra) => Object.assign({ id, title, status: 'next', categoryIds: [], priority: null, sortOrder: 0, updatedAt: now - day }, extra);
const many = (p, n, extra) => Array.from({ length: n }, (_, i) => task(p + i, p + ' task ' + i, extra));
const seed = () => ({
  projects: [
    { id: 'pHome', name: 'Home', color: '#2f7a4b', categoryId: 'pcat_home', sortOrder: 1, source: 'manual', tasks: many('h', 3, {}).concat([task('hd', 'Done one', { status: 'done' })]).concat([task('hx', 'Due later', { deadline: iso(20) })]) },
    { id: 'pGarden', name: 'Garden', color: '#d98a12', categoryId: 'pcat_personal', sortOrder: 2, source: 'manual', tasks: [task('g0', 'Prune roses', { deadline: iso(2) })] },
    { id: 'pBand', name: 'Band', color: '#c9584f', categoryId: 'pcat_apps', sortOrder: 3, source: 'github', repoFullName: 'me/band', lastSyncedAt: now - 1000, tasks: many('b', 5, {}) },
  ],
  categories: [], inbox: [], completedLog: [], deletedTaskIds: [], choosingMode: { mode: 'tap', updatedAt: 1 },
  pinnedRepos: ['me/band'], excludedRepos: [],
});

const results = [];
const check = (name, ok, extra = '') => { results.push(ok); console.log((ok ? 'PASS ' : 'FAIL ') + name + (extra ? '  [' + extra + ']' : '')); };
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM, args: ['--no-sandbox'] });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block', colorScheme: 'light' });
const page = await ctx.newPage();
page.on('pageerror', (e) => check('no page error: ' + e.message, false));
page.on('dialog', (d) => d.accept());

// ---- the GitHub stub: every api.github.com request is answered here; anything else outside is refused ----
const calls = [], outside = [], unhandled = [];
const repo = (full, priv) => ({ full_name: full, name: full.split('/')[1], private: !!priv, html_url: 'https://github.com/' + full });
await ctx.route((u) => u.hostname !== '127.0.0.1', async (route) => {
  const u = new URL(route.request().url()), m = route.request().method();
  if (/^fonts\.(googleapis|gstatic)\.com$/.test(u.hostname)) return route.abort(); // the app's own font stylesheet (index.html); refused here, not a leak
  if (u.hostname !== 'api.github.com') { outside.push(m + ' ' + u.href); return route.abort(); }
  const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' };
  if (m === 'OPTIONS') return route.fulfill({ status: 204, headers: cors });
  calls.push(m + ' ' + u.pathname);
  const json = (body, status = 200) => route.fulfill({ status, headers: cors, contentType: 'application/json', body: JSON.stringify(body) });
  if (m === 'GET' && u.pathname === '/user') return json({ login: 'me' });
  if (m === 'GET' && u.pathname === '/gists') return json([]); // sync looks for its gist; none yet
  if (m === 'GET' && u.pathname === '/user/repos') return json([repo('me/shed-plans', true), repo('me/notes'), repo('me/band')]);
  if (m === 'POST' && u.pathname === '/user/repos') return json(repo('me/' + JSON.parse(route.request().postData()).name, JSON.parse(route.request().postData()).private), 201);
  if (m === 'GET' && /^\/repos\/[^/]+\/[^/]+\/issues$/.test(u.pathname)) return json([]);
  if (m === 'GET' && u.pathname === '/repos/owner/missing') return json({ message: 'Not Found' }, 404);
  if (m === 'GET' && /^\/repos\/[^/]+\/[^/]+$/.test(u.pathname)) return json(repo(u.pathname.slice(7), false));
  unhandled.push(m + ' ' + u.pathname);
  return json({ message: 'stub: not handled' }, 404);
});
await page.addInitScript(([s, key]) => {
  if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify(s));
  localStorage.setItem('focusdeck-screen', 'projects'); localStorage.setItem('focusdeck-github-token', 'stub-token');
  if (!localStorage.getItem('focusdeck-project-sort')) localStorage.setItem('focusdeck-project-sort', 'name');
}, [seed(), STATE_KEY]);
await page.goto(BASE);
await page.waitForSelector('.pj');
await page.waitForTimeout(400);

const stored = () => page.evaluate((key) => JSON.parse(localStorage.getItem(key)), STATE_KEY);
const click = async (sel) => { await page.click(sel); await page.waitForTimeout(250); };
const text = (sel) => page.textContent(sel);
const names = () => page.$$eval('.pj-name', (e) => e.map((x) => x.textContent.replace('📁 ', '').trim()));
// measure the screen: no vertical scroll of the page, no sideways scroll, no visible text under 13px
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
    return { scrollY: de.scrollHeight - innerHeight, scrollX: de.scrollWidth - innerWidth, small };
  });
  await page.screenshot({ path: OUT + id + '.png' });
  check(id + ': fits 390x844 without scrolling', m.scrollY <= 0 && m.scrollX <= 0, 'over by ' + m.scrollY + 'px down, ' + m.scrollX + 'px across');
  check(id + ': no text under 13px', m.small.length === 0, m.small.slice(0, 4).join(' | '));
}
const sortBy = async (label) => { await click('.pj-pull'); await click('.sort-drawer .dk-choice:has-text("' + label + '")'); };

// ---- the list and its sort orders ----
await shot('r0');
check('r0: a card per project with a ruler, Find, + New project, the drawer handle', (await names()).join() === 'Band,Garden,Home' && (await page.$$('.pj-ruler')).length === 3 && !!(await page.$('.pj-find')) && (await text('#new-panel-toggle')) === '+ New project' && !!(await page.$('.pj-pull')));
check('r0: Home is 1 of 5 tasks done (20%)', (await page.getAttribute('.pj-card[data-project="pHome"] .pj-ruler', 'aria-label')) === '20% done');
await page.fill('.pj-find', 'ga'); await page.waitForTimeout(250);
check('Find a project narrows the list and keeps focus', (await names()).join() === 'Garden' && (await page.evaluate(() => document.activeElement.classList.contains('pj-find'))));
await page.fill('.pj-find', ''); await page.waitForTimeout(250);
await click('.pj-pull');
await shot('r0m');
check('r0m: Sort by lists A–Z, Most tasks, Due soonest, Last synced, My order ↑↓', (await page.$$eval('.sort-drawer .vs-pop-body .dk-choice', (els) => els.map((e) => e.textContent.trim()).join(' '))) === 'A–Z Most tasks Due soonest Last synced My order↑↓');
await click('.sort-drawer .dk-choice:has-text("Most tasks")');
await shot('r0-most');
check('Most tasks: Band 5, Home 4, Garden 1', (await names()).join() === 'Band,Home,Garden', (await names()).join());
await sortBy('Due soonest');
check('Due soonest: Garden, Home, then Band (no date)', (await names()).join() === 'Garden,Home,Band', (await names()).join());
await shot('r0-due');
await sortBy('Last synced');
check('Last synced: the synced repo project first, then by name', (await names()).join() === 'Band,Garden,Home', (await names()).join());
await shot('r0-synced');
await sortBy('A–Z');
check('A–Z: Band, Garden, Home, and the choice is remembered over a reload', (await names()).join() === 'Band,Garden,Home' && (await page.evaluate(() => localStorage.getItem('focusdeck-project-sort'))) === 'name');
await sortBy('My order');
await shot('r0o');
check('r0o: My order, a ↑ and ↓ per project and a Done stamp', (await text('.sort-q')) === 'My order' && (await page.$$('.pj-key')).length === 6 && (await text('.dk-btn')) === 'Done');
check('the top ↑ and bottom ↓ are off', await page.$eval('.pj-row:first-child [data-dir="-1"]', (e) => e.disabled) && await page.$eval('.pj-row:last-child [data-dir="1"]', (e) => e.disabled));
await click('.pj-row:nth-child(1) [data-dir="1"]');
check('↓ on the first row (Home) moves it down one', (await page.$$eval('.pj-row > span:first-child', (e) => e.map((x) => x.textContent.replace('📁 ', '').trim()))).join() === 'Garden,Home,Band');
await click('.dk-btn[data-action="proj-order-done"]');
check('Done: the list is in the person\'s order', (await names()).join() === 'Garden,Home,Band');
await page.reload(); await page.waitForSelector('.pj-card');
check('after a reload My order is still Garden, Home, Band', (await names()).join() === 'Garden,Home,Band' && (await page.evaluate(() => localStorage.getItem('focusdeck-project-sort'))) === 'custom');
await sortBy('A–Z');

// ---- New project ----
// makes a project through the four steps. o: { name, area, newArea, colour, gh: 'no' | 'mine' | 'new' | 'other', repo, repoName, priv, link }
async function make(o, shots) {
  await click('#new-panel-toggle');
  if (shots) await shot('r5');
  check(o.name + ': Name it, step 1 of 4, Next off until named', (await text('.sort-q')) === 'Name it' && (await page.getAttribute('.dk-prog', 'aria-label')) === 'Step 1 of 4' && await page.$eval('.dk-btn', (e) => e.disabled));
  await page.fill('[data-np-name]', o.name); await page.waitForTimeout(150);
  check(o.name + ': typing a name turns Next on without losing the caret', !(await page.$eval('.dk-btn', (e) => e.disabled)) && (await page.evaluate(() => document.activeElement.hasAttribute('data-np-name'))));
  await click('.dk-btn[data-action="np-next"]');
  if (shots) await shot('r6');
  check(o.name + ': Which area? lists the areas and + New area', (await text('.sort-q')) === 'Which area?' && (await text('.pj-scroll')).includes('Home') && (await text('.pj-scroll')).includes('+ New area') && !(await text('.pj-scroll')).includes('Unsorted'));
  if (o.area) await click('.dk-choice:has-text("' + o.area + '")');
  if (o.newArea) { await click('.dk-choice:has-text("+ New area")'); if (shots) await shot('r6n'); check('+ New area asks for a name, Next off until then', await page.$eval('.dk-btn', (e) => e.disabled)); await page.fill('[data-np-areaname]', o.newArea); }
  await click('.dk-btn[data-action="np-next"]');
  if (shots) await shot('r7');
  check(o.name + ': Pick a colour shows six swatches', (await text('.sort-q')) === 'Pick a colour' && (await page.$$('.pj-swatch')).length === 6);
  if (o.colour) await click('.pj-swatch[data-color="' + o.colour + '"]');
  if (shots) await shot('r7c');
  await click('.dk-btn[data-action="np-next"]');
  if (shots) await shot('r8');
  check(o.name + ': On GitHub? has No, My repo, New repo, Someone else\'s and a Make it stamp', (await text('.sort-q')) === 'On GitHub?' && (await text('.pj-flow .sort-body')).includes('No') && (await text('.pj-flow .sort-body')).includes('🔗 My repo') && (await text('.pj-flow .sort-body')).includes('✨ New repo') && (await text('.pj-flow .sort-body')).includes('👀 Someone else') && (await text('.dk-btn')) === 'Make it');
  if (o.gh === 'mine') {
    await click('.dk-choice:has-text("My repo")'); await page.waitForSelector('[data-action="np-repo"]');
    if (shots) await shot('r8a');
    check('r8a: Which repo? lists my untracked repos (not the tracked me/band), Link it off until one is picked', (await text('.sort-q')) === 'Which repo?' && (await page.$$('[data-action="np-repo"]')).length === 2 && await page.$eval('.dk-btn', (e) => e.disabled));
    await page.fill('.repo-filter', 'shed'); await page.waitForTimeout(250);
    check('r8a: Find a repo narrows to one and keeps focus', (await page.$$('[data-action="np-repo"]')).length === 1 && (await page.evaluate(() => document.activeElement.classList.contains('repo-filter'))));
    await click('[data-action="np-repo"][data-repo="' + o.repo + '"]');
    check('r8a: the picked repo is clipped and Link it is on', !!(await page.$('.dk-choice.on[data-repo="' + o.repo + '"]')) && !(await page.$eval('.dk-btn', (e) => e.disabled)) && (await text('.dk-btn')) === 'Link it');
  } else if (o.gh === 'new') {
    await click('.dk-choice:has-text("New repo")');
    check('r8b: the repo name starts from the project name, Private is picked', (await page.inputValue('[data-np-reponame]')) === o.repoName && !!(await page.$('.dk-choice.on:has-text("Private")')));
    if (o.priv === false) await click('.dk-choice:has-text("Public")');
    if (shots) await shot('r8b');
    await page.fill('[data-np-reponame]', 'bad name'); await page.waitForTimeout(150);
    check('r8b: a name with a space turns Create it off and says why', await page.$eval('.dk-btn', (e) => e.disabled) && (await text('.step-why')).includes('no spaces'));
    await page.fill('[data-np-reponame]', o.repoName); await page.waitForTimeout(150);
    check('r8b: a good name turns Create it on', !(await page.$eval('.dk-btn', (e) => e.disabled)) && (await text('.dk-btn')) === 'Create it');
  } else if (o.gh === 'other') {
    await click('.dk-choice:has-text("Someone else")');
    if (shots) await shot('r8c');
    check('r8c: Paste its link, Track it off until it reads as a repo', (await text('.sort-q')) === 'Paste its link' && await page.$eval('.dk-btn', (e) => e.disabled));
    await page.fill('[data-np-link]', o.link); await page.waitForTimeout(150);
    check('r8c: a github.com link turns Track it on', !(await page.$eval('.dk-btn', (e) => e.disabled)) && (await text('.dk-btn')) === 'Track it');
  }
  await page.click('.pj-flow .sort-foot .dk-btn'); await page.waitForSelector('.rm-project', { timeout: 8000 });
  await page.waitForTimeout(300);
}
const find = async (name) => (await stored()).projects.find((p) => p.name === name);

// 1. No GitHub, with a colour and a new area
await make({ name: 'Shed rebuild', newArea: 'Workshop', colour: '#3d5a80', gh: 'no' }, true);
await shot('r9');
let p = await find('Shed rebuild'), s = await stored();
check('r9: Make it opens the new project\'s Roadmap with a Made ✓ slip', (await text('.vs-tape')).includes('Shed rebuild') && (await text('.toast')).includes('Made ✓'));
check('the project is a hand-made one in the new area, in the chosen colour', !!p && p.source === 'manual' && p.color === '#3d5a80' && (s.projectCategories || []).some((c) => c.name === 'Workshop' && c.id === p.categoryId));
check('the Roadmap\'s menu has no + New project (Projects owns it)', !(await page.$('#new-panel-toggle')) && !(await text('.rm-project')).includes('New project'));
check('it is the last-used project', (await page.evaluate(() => localStorage.getItem('focusdeck-last-project'))) === p.id);
await click('[data-screen="projects"]');
check('back on Projects the new project is in the list', (await names()).includes('Shed rebuild'));
await page.fill('.pj-find', 'shed'); await page.waitForTimeout(250); await click('.pj-card[data-project="' + p.id + '"]');
check('tapping its card opens it on the Roadmap', !!(await page.$('.rm-project')) && (await text('.vs-tape')).includes('Shed rebuild'));
await click('[data-screen="projects"]'); await page.fill('.pj-find', ''); await page.waitForTimeout(250);

// 2. My repo: linked to a repo I own
await make({ name: 'Plans', area: 'Home', gh: 'mine', repo: 'me/shed-plans' });
p = await find('Plans');
check('My repo: the project is linked to me/shed-plans (a repo project, in the Home area)', !!p && p.source === 'github' && p.repoFullName === 'me/shed-plans' && p.categoryId === 'pcat_home' && (await stored()).pinnedRepos.includes('me/shed-plans'));
await shot('r9-mine');
await click('[data-screen="projects"]');
check('Plans is in the list', (await names()).includes('Plans'));

// 3. New repo: created (stubbed), then linked
const postsBefore = calls.filter((c) => c === 'POST /user/repos').length;
await make({ name: 'Boat refit', gh: 'new', repoName: 'boat-refit', priv: false });
p = await find('Boat refit');
check('New repo: one POST /user/repos, and the project is linked to me/boat-refit under its own name', calls.filter((c) => c === 'POST /user/repos').length === postsBefore + 1 && !!p && p.source === 'github' && p.repoFullName === 'me/boat-refit' && p.private === false);
await click('[data-screen="projects"]');

// 4. Someone else's: pasted link, tracked
await make({ name: 'Their tool', gh: 'other', link: 'https://github.com/owner/their-tool' });
p = await find('Their tool');
check('Someone else\'s: the pasted link is tracked as owner/their-tool under the typed name', !!p && p.source === 'github' && p.repoFullName === 'owner/their-tool');
await click('[data-screen="projects"]');
await shot('r0-after');
const listed = await names();
check('the list now has all four new projects', ['Shed rebuild', 'Plans', 'Boat refit', 'Their tool'].every((n) => listed.includes(n)) && listed.length === 7, listed.join());

// 5. Back out, and a link GitHub refuses leaves nothing behind
await click('#new-panel-toggle'); await click('.dk-back');
check('Back on step 1 returns to the list', !!(await page.$('.pj-card')) && !(await page.$('.pj-flow')));
const count = (await stored()).projects.length;
await click('#new-panel-toggle'); await page.fill('[data-np-name]', 'Nope');
for (let i = 0; i < 3; i++) await click('.dk-btn[data-action="np-next"]');
await click('.dk-choice:has-text("Someone else")'); await page.fill('[data-np-link]', 'owner/missing'); await page.waitForTimeout(150);
await click('.pj-flow .sort-foot .dk-btn');
await page.waitForSelector('.step-why', { timeout: 8000 });
await shot('r8c-error');
const kept = await stored();
check('a repo GitHub does not know: the error shows on the step, no project is left, nothing stays pinned', kept.projects.length === count && !kept.projects.some((q) => q.name === 'Nope') && !kept.pinnedRepos.includes('owner/missing') && !!(await page.$('.pj-flow')), 'projects ' + count + ' -> ' + kept.projects.length);

check('every GitHub call went to the stub: ' + [...new Set(calls)].join(', '), calls.length > 0 && unhandled.length === 0, 'not handled: ' + unhandled.join(', '));
check('nothing reached any other outside host', outside.length === 0, outside.join(', '));
await browser.close();
server.close();
const failed = results.filter((ok) => !ok).length;
console.log(`\n${results.length - failed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
