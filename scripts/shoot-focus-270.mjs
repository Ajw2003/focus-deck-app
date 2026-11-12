// scripts/shoot-focus-270.mjs -- real-Chromium walk through the Focus tab at 390x844 (#270): two questions, then one task.
// Usage: CHROMIUM=/opt/pw-browsers/chromium-1243/chrome-linux64/chrome node scripts/shoot-focus-270.mjs
// Serves the repo root on 127.0.0.1:8270, seeds localStorage, then like a thumb: Which project? (f1), Pick for me, the ⋯ drawer (f4), Clear, Find + Next,
// What kind of work? (f2), Show me one (f3), Another, Start it, Smaller steps (f4s) and Focus on one, Done (f5), Next one. Screenshots go to docs/generated/focus-270/.
// Each screen is measured: the page must not scroll (it fits the phone) and no visible text may be under 13px. State is read back from localStorage.
import { createRequire } from 'node:module';
import { mkdirSync, readFileSync, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import { join, extname, normalize } from 'node:path';
const require = createRequire('/opt/node22/lib/node_modules/');
const { chromium } = require('playwright');
const ROOT = fileURLToPath(new URL('..', import.meta.url));
const OUT = join(ROOT, 'docs/generated/focus-270/');
mkdirSync(OUT, { recursive: true });
const BASE = 'http://127.0.0.1:8270/app/';
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
await new Promise((ok) => server.listen(8270, '127.0.0.1', ok));

const now = Date.now();
const t = (id, title, status, extra) => Object.assign({ id, title, status, updatedAt: now - 1000, sortOrder: 1, categoryIds: [] }, extra);
const seed = () => ({
  projects: [
    { id: 'p0', name: 'Family', color: '#3E8E5E', sortOrder: 1, tasks: [
      t('a1', 'Renew passport before the Lisbon trip', 'next', { categoryIds: ['c0'] }), t('a2', 'Call the dentist', 'next', { categoryIds: ['c0'] }),
      t('a3', 'Buy a birthday present', 'next', { categoryIds: ['c1'] }),
      t('s1', 'Find old passport', 'next', { parentId: 'a1' }), t('s2', 'Get photos taken', 'next', { parentId: 'a1' }), t('s3', 'Fill in the form', 'next', { parentId: 'a1' })] },
    { id: 'p1', name: 'Work', color: '#4A6FB5', sortOrder: 2, tasks: [t('w1', 'Send the invoice', 'next', { categoryIds: ['c0'] }), t('w2', 'Tidy the shared drive', 'next')] },
  ],
  categories: [{ id: 'c0', name: 'Call', color: '#4A6FB5' }, { id: 'c1', name: 'Buy', color: '#2F7A4B' }], inbox: [], completedLog: [], deletedTaskIds: {}, choosingMode: { mode: 'twice', updatedAt: 1 },
});

const results = [];
const check = (name, ok, extra = '') => { results.push(ok); console.log((ok ? 'PASS ' : 'FAIL ') + name + (extra ? '  [' + extra + ']' : '')); };
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM, args: ['--no-sandbox'] });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block', colorScheme: 'light', hasTouch: true });
const page = await ctx.newPage();
page.on('pageerror', (e) => check('no page error: ' + e.message, false));
await page.addInitScript(([s, key]) => {
  if (localStorage.getItem('seeded')) return;
  localStorage.setItem('seeded', '1');
  localStorage.setItem(key, JSON.stringify(s));
  localStorage.setItem('focusdeck-onboarding', 'done');
  localStorage.setItem('focusdeck-screen', 'focus');
}, [seed(), STATE_KEY]);
await page.goto(BASE);
await page.waitForSelector('[data-wallet="projects"]');
await page.waitForTimeout(400);

const saved = () => page.evaluate((key) => JSON.parse(localStorage.getItem(key)), STATE_KEY);
const task = async (id) => (await saved()).projects.flatMap((p) => p.tasks).find((x) => x.id === id);
const click = async (sel) => { await page.click(sel); await page.waitForTimeout(250); };
const text = async (sel) => ((await page.textContent(sel)) || '').replace(/\s+/g, ' ').trim();
const title = () => page.$eval('.focus-title', (e) => e.textContent.trim()).catch(() => '');
const cards = (wallet) => page.$$eval('[data-wallet="' + wallet + '"] .sleeve', (e) => e.map((x) => x.textContent.trim()).join('|'));
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

// f1: Which project?
check('f1: "Which project?" with Find, a folder carousel, the Pick for me tag and a Next stamp', (await text('.sort-q')) === 'Which project?' && !!(await page.$('[data-car-find="projects"]')) && (await text('.focus-tag')) === '🎲 Pick for me' && (await text('.sort-foot .file-btn')) === 'Next');
check('f1: folders are All projects, Family, Work and carry only their names', (await cards('projects')) === 'All projects|Family|Work');
await shot('f1');
// Pick for me
await click('[data-action="pick-for-me"]');
const picked = await title();
check('f3 (Pick for me): one task on its sticky note with Done and Another stamps', picked.length > 0 && (await text('.focus-stamps')) === '✓ Done↻ Another' && (await saved()).focus.ordered === true, picked);
await shot('f3-pick-for-me');
// the drawer, then Clear
await click('[data-action="focus-menu"]');
check('f4: the ⋯ drawer has Details, the project and Clear', !!(await page.$('.sort-drawer [data-action="task-open"]')) && !!(await page.$('.sort-drawer [data-action="clear-focus"]')) && !!(await page.$('.sort-drawer [data-action="rm-open"]')));
await shot('f4-drawer');
await click('.sort-drawer [data-action="clear-focus"]');
check('Clear: focus is gone and the first question is back', (await saved()).focus == null && (await text('.sort-q')) === 'Which project?' && !(await page.$('.sort-drawer')));
// pick a project (Find, then Next), then a kind
await page.fill('[data-car-find="projects"]', 'fam');
await page.waitForTimeout(300);
check('f1: Find narrows to Family', (await cards('projects')) === 'Family');
await click('[data-action="focus-next"]');
check('f2: "What kind of work?" with Find, index cards (Call, Buy, Unlabelled for the steps, Surprise me), Back, Skip and Show me one', (await text('.sort-q')) === 'What kind of work?' && (await cards('categories')) === 'Call|Buy|Unlabelled|Surprise me' && !!(await page.$('[data-action="focus-back"]')) && !!(await page.$('[data-action="focus-skip"]')) && (await text('.sort-foot .file-btn')) === 'Show me one');
await shot('f2');
await page.fill('[data-car-find="kinds"]', 'call');
await page.waitForTimeout(300);
await click('[data-action="focus-show"]');
const name = await title();
const f = (await saved()).focus;
check('f3: Show me one drew a Family task labelled Call', ['a1', 'a2'].includes(f.taskId) && f.filter.projectId === 'p0' && f.filter.categoryId === 'c0', name);
await shot('f3');
// Another
await click('[data-action="reroll"]');
const other = await title();
check('Another swaps to the other Call task in Family', other !== name && ['a1', 'a2'].includes((await saved()).focus.taskId), name + ' -> ' + other);
await shot('f3-another');
// Start it
await click('[data-action="focus-menu"]');
const id = (await saved()).focus.taskId;
await shot('f4-drawer-full');
await click('.sort-drawer [data-action="focus-doing"]');
check('Start it moved the task to In progress and closed the drawer', (await task(id)).status === 'doing' && !(await page.$('.sort-drawer')) && (await saved()).focus.taskId === id);
await shot('f3-started');
// Smaller steps need the passport task
if (id !== 'a1') await click('[data-action="reroll"]');
check('the passport task is in focus', (await saved()).focus.taskId === 'a1');
await click('[data-action="focus-menu"]');
await click('.sort-drawer [data-action="focus-steps"]');
check('f4s: Smaller steps is a tick list of its three steps with Focus on one off', (await text('.sort-q')) === 'Smaller steps' && (await page.$$('[data-focus-tick]')).length === 3 && (await page.$eval('[data-action="focus-subtask"]', (b) => b.disabled)));
await shot('f4s');
await page.check('[data-focus-tick="s2"]');
await page.waitForTimeout(250);
check('f4s: ticking a step turns Focus on one on', !(await page.$eval('[data-action="focus-subtask"]', (b) => b.disabled)));
await shot('f4s-ticked');
await click('[data-action="focus-subtask"]');
check('Focus on one: the ticked step is now the focus', (await saved()).focus.taskId === 's2' && (await title()) === 'Get photos taken');
await shot('f3-step');
// Done, then Next one
await click('[data-action="complete-focus"]');
await page.waitForSelector('.note.is-done', { timeout: 4000 });
await page.waitForTimeout(300);
check('f5: Done crossed the note out and completed the step', (await task('s2')).status === 'done' && (await text('.sort-foot .file-btn')) === 'Next one');
await shot('f5');
await click('[data-action="focus-next-one"]');
check('Next one picks another task', !!(await saved()).focus && (await page.$$('.focus-stamps .dk-btn')).length === 2, await title());
// Clear again, from the drawer
await click('[data-action="focus-menu"]');
await click('.sort-drawer [data-action="clear-focus"]');
check('Clear (again): back to "Which project?"', (await text('.sort-q')) === 'Which project?' && (await saved()).focus == null);
await shot('f1-again');
await browser.close(); server.close();
const failed = results.filter((x) => !x).length;
console.log(failed ? failed + ' FAILED of ' + results.length : 'ALL PASSED (' + results.length + ')');
process.exit(failed ? 1 : 0);
