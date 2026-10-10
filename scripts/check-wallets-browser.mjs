// scripts/check-wallets-browser.mjs -- real-Chromium check of the focus wallets (#120).
// Usage: CHROMIUM=/opt/pw-browsers/chromium-1194/chrome-linux/chrome node scripts/check-wallets-browser.mjs
// Serves the repo root itself on 127.0.0.1:8123 for the length of the run (no separate server),
// seeds localStorage, checks both wallets, the flip narrowing, both choosing modes and pushing a card up, in dark
// and light, and the Settings page, and writes screenshots to docs/generated/pr120/.
import { createRequire } from 'node:module';
import { mkdirSync, readFileSync, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import { join, extname, normalize } from 'node:path';
const require = createRequire('/opt/node22/lib/node_modules/');
const { chromium } = require('playwright');
const ROOT = fileURLToPath(new URL('..', import.meta.url));
const OUT = join(ROOT, 'docs/generated/pr120/');
mkdirSync(OUT, { recursive: true });
const BASE = 'http://127.0.0.1:8123/app/';

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
await new Promise((ok) => server.listen(8123, '127.0.0.1', ok));

const task = (id, title, cats, priority) => ({ id, title, status: 'next', categoryIds: cats, priority, sortOrder: 0 });
const seed = (mode) => ({
  projects: [
    { id: 'pHome', name: 'Home', color: '#3E8E5E', tasks: [task('h1', 'Reply to Sam', ['c_chore'], 'high'), task('h2', 'Recycling', ['c_chore'], 'low'), task('h3', 'Hallway photos', ['c_art'], 'low')] },
    { id: 'pSchool', name: 'School', color: '#4D6FB8', tasks: [task('s1', 'Read chapter 4', ['c_study'], 'high'), task('s2', 'Flashcards', ['c_study'], 'medium'), task('s3', 'Library books', ['c_chore'], 'medium')] },
    { id: 'pWeb', name: 'Website', color: '#C9584F', tasks: [task('w1', 'Fix menu', ['c_bug'], 'urgent'), task('w2', 'Contact form', ['c_bug'], 'medium'), task('w3', 'Header image', ['c_art'], 'medium'), task('w4', 'Unlabelled thing', [], null)] },
    { id: 'pPort', name: 'Portfolio', color: '#C2731E', tasks: [task('o1', 'Ink the comic', ['c_art'], 'high')] },
  ],
  categories: [
    { id: 'c_chore', name: 'Chore', color: '#3E8E5E' }, { id: 'c_art', name: 'Art', color: '#C2731E' },
    { id: 'c_bug', name: 'Bug', color: '#C9584F' }, { id: 'c_study', name: 'Study', color: '#4D6FB8' },
  ],
  inbox: [], completedLog: [], deletedTaskIds: [],
  choosingMode: { mode, updatedAt: 1 },
});

const results = [];
const check = (name, ok, extra = '') => { results.push([ok, name]); console.log((ok ? 'PASS ' : 'FAIL ') + name + (extra ? '  [' + extra + ']' : '')); };

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM, args: ['--no-sandbox'] });

async function open(mode, scheme, extraStorage = {}) {
  const ctx = await browser.newContext({ viewport: { width: 420, height: 900 }, colorScheme: scheme, hasTouch: false, serviceWorkers: 'block' });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => check('no page error: ' + e.message, false));
  page.on('console', (m) => { if (m.type() === 'error') console.log('console.error: ' + m.text()); });
  await page.addInitScript(([s, extra]) => {
    if (!localStorage.getItem('focusdeck-state-v1')) localStorage.setItem('focusdeck-state-v1', JSON.stringify(s));
    for (const [k, v] of Object.entries(extra)) if (!localStorage.getItem(k)) localStorage.setItem(k, v);
  }, [seed(mode), extraStorage]);
  await page.goto(BASE);
  await page.waitForSelector('.flip-track');
  await page.waitForTimeout(400);
  const wide = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  check(`[${mode}/${scheme}] no sideways page scroll`, wide <= 0, 'overflow ' + wide + 'px');
  return { ctx, page };
}
const facing = (page, w) => page.$eval('[data-wallet="' + w + '"]', (t) => { const c = t.querySelector('.sleeve.is-centre'); return c && c.dataset.key; });
const keysOf = (page, w) => page.$$eval('[data-wallet="' + w + '"] .sleeve', (els) => els.map((e) => e.dataset.key));
const tapCard = async (page, w, key) => {
  const box = await (await page.$('[data-wallet="' + w + '"] .sleeve[data-key="' + key + '"] .icard')).boundingBox();
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
};
const focusShown = (page) => page.$('.focus-active');

// 1. wallets render, dark
let { ctx, page } = await open('twice', 'dark');
const projKeys = await keysOf(page, 'projects');
check('project wallet has All + 4 folders', projKeys.length === 5 && projKeys[0] === 'all', projKeys.join());
const catAll = await keysOf(page, 'categories');
check('category wallet has cards + unlabelled + surprise', catAll.includes('__none__') && catAll.at(-1) === 'any', catAll.join());
check('project wallet facing All', (await facing(page, 'projects')) === 'all');
check('mockup folders drawn as folders (::before tab)', await page.$eval('.icard.project', (e) => getComputedStyle(e, '::before').content !== 'none'));
await page.screenshot({ path: OUT + 'dark-twice-all.png', fullPage: false });

// 2. flip a folder narrows index cards (keyboard on a computer)
await page.focus('[data-wallet="projects"]');
const slotBefore = await page.$eval('#project-wallet', (e) => e.firstElementChild);
await page.evaluate(() => { window.__projTrack = document.querySelector('[data-wallet="projects"]'); });
await page.keyboard.press('ArrowRight');
await page.waitForTimeout(900);
const f1 = await facing(page, 'projects');
check('arrow flips the project wallet (facing = ' + f1 + ')', f1 !== 'all');
const catNarrow = await keysOf(page, 'categories');
check('category cards narrowed to that project', catNarrow.length < catAll.length, catNarrow.join());
check('project wallet track NOT re-rendered on a flip', await page.evaluate(() => window.__projTrack === document.querySelector('[data-wallet="projects"]')));
const saved = await page.evaluate(() => localStorage.getItem('focusdeck-focus-filter'));
check('facing folder remembered in focusdeck-focus-filter', saved && JSON.parse(saved).projectId === f1, saved);
await page.screenshot({ path: OUT + 'dark-twice-flipped.png' });
// remembered on reload
await page.reload(); await page.waitForSelector('.flip-track'); await page.waitForTimeout(400);
check('after reload the remembered folder faces you', (await facing(page, 'projects')) === f1);
check('markup carries data-facing', (await page.$eval('[data-wallet="projects"]', (t) => t.dataset.facing)) === f1);
await ctx.close();

// 3. choosing under each mode
// 'push' is Tap twice with the facing card pushed up instead: that draws in every mode (#132)
for (const mode of ['twice', 'tap', 'push']) {
  for (const scheme of ['dark', 'light']) {
    ({ ctx, page } = await open(mode === 'push' ? 'twice' : mode, scheme));
    const m = await page.$eval('[data-wallet="categories"]', (t) => t.dataset.mode);
    check(`[${mode}/${scheme}] markup mode`, m === (mode === 'push' ? 'twice' : mode));
    const cats = await keysOf(page, 'categories');
    const target = cats[1];
    if (mode === 'twice') {
      await tapCard(page, 'categories', target); // first tap lifts (and flips)
      await page.waitForTimeout(800);
      check(`[${mode}/${scheme}] first tap only arms`, !(await focusShown(page)) && (await page.$('.sleeve.is-armed')) !== null);
      await page.screenshot({ path: OUT + `${scheme}-twice-armed.png` });
      await tapCard(page, 'categories', target);
      await page.waitForSelector('.focus-active', { timeout: 3000 }).catch(() => {});
      check(`[${mode}/${scheme}] second tap draws a task`, !!(await focusShown(page)));
    } else if (mode === 'tap') {
      await tapCard(page, 'categories', target);
      await page.waitForSelector('.focus-active', { timeout: 3000 }).catch(() => {});
      check(`[${mode}/${scheme}] one tap draws a task`, !!(await focusShown(page)));
    } else {
      await page.screenshot({ path: OUT + `${scheme}-push-idle.png` });
      // flip to target (keyboard), then drag it up with the mouse
      await page.focus('[data-wallet="categories"]');
      await page.keyboard.press('ArrowRight');
      await page.waitForTimeout(900);
      const face = await facing(page, 'categories');
      const box = await (await page.$('[data-wallet="categories"] .sleeve.is-centre .icard')).boundingBox();
      const cx = box.x + box.width / 2, cy = box.y + box.height / 2;
      await page.mouse.move(cx, cy); await page.mouse.down();
      await page.mouse.move(cx, cy - 25, { steps: 4 });
      await page.screenshot({ path: OUT + `${scheme}-push-lifting.png` });
      await page.mouse.move(cx, cy - 80, { steps: 6 });
      await page.mouse.up();
      await page.waitForSelector('.focus-active', { timeout: 3000 }).catch(() => {});
      check(`[${mode}/${scheme}] pushing the facing card up draws, even in Tap twice (${face})`, !!(await focusShown(page)));
    }
    if (await focusShown(page)) await page.screenshot({ path: OUT + `${scheme}-${mode}-drawn.png` });
    await ctx.close();
  }
}

// 4. keyboard Enter chooses in every mode; Surprise me works
({ ctx, page } = await open('twice', 'light'));
await page.focus('[data-wallet="categories"]');
await page.keyboard.press('End'); await page.waitForTimeout(900);
check('End goes to Surprise me', (await facing(page, 'categories')) === 'any');
await page.screenshot({ path: OUT + 'light-twice-surprise.png' });
await page.keyboard.press('Enter');
await page.waitForSelector('.focus-active', { timeout: 3000 }).catch(() => {});
check('Enter draws from Surprise me', !!(await focusShown(page)));
await ctx.close();

// 5. Settings page: change the mode, it is stored, and the wallet follows
({ ctx, page } = await open('twice', 'dark'));
await page.goto(BASE.replace('/app/', '/app/settings.html'));
await page.waitForSelector('.choosing-modes input');
const labels = await page.$$eval('.choosing-modes label', (l) => l.map((x) => x.textContent.trim()));
check('Settings lists the two modes', labels.join('|') === 'Tap|Tap twice', labels.join('|'));
check('Settings shows Tap twice selected by default', await page.$eval('.choosing-modes input[value="twice"]', (i) => i.checked));
await page.screenshot({ path: OUT + 'dark-settings.png', fullPage: false });
await page.check('.choosing-modes input[value="tap"]');
const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('focusdeck-state-v1')).choosingMode);
check('choosing Tap is stored with a stamp', stored.mode === 'tap' && stored.updatedAt > 1, JSON.stringify(stored));
await page.goto(BASE); await page.waitForSelector('.flip-track');
check('the wallets follow the setting', (await page.$eval('[data-wallet="projects"]', (t) => t.dataset.mode)) === 'tap');
check('and the hint reads for that mode', (await page.$eval('.flip-hint', (e) => e.textContent)).includes('tap or push a card up to draw'));
await ctx.close();

// 6. empty-project edge: a folder with its only matching categories, wide screen
({ ctx, page } = await open('twice', 'light'));
await page.setViewportSize({ width: 1280, height: 900 });
await page.waitForTimeout(500);
check('wide screen: wallets render', (await keysOf(page, 'projects')).length === 5);
await page.screenshot({ path: OUT + 'light-wide.png' });
await ctx.close();

await browser.close();
server.close();
const failed = results.filter((r) => !r[0]);
console.log(`\n${results.length - failed.length} passed, ${failed.length} failed`);
process.exit(failed.length ? 1 : 0);
