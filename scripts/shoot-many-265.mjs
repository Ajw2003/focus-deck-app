// scripts/shoot-many-265.mjs -- real-Chromium walk through "Sort several" at 390x844 (#265).
// Usage: CHROMIUM=/opt/pw-browsers/chromium-1243/chrome-linux64/chrome node scripts/shoot-many-265.mjs
// Serves the repo root on 127.0.0.1:8265, seeds localStorage, then like a thumb: Sort several, tick two
// thoughts (m1), a project and priority (m2), labels (m3), a group name (m4), the receipt (m5), Sort N.
// Screenshots go to docs/generated/many-265/ named after the prototype's ids (m1 ... m5). Each screen is
// measured: the page must not scroll (it fits the phone) and no visible text may be under 13px.
import { createRequire } from 'node:module';
import { mkdirSync, readFileSync, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import { join, extname, normalize } from 'node:path';
const require = createRequire('/opt/node22/lib/node_modules/');
const { chromium } = require('playwright');
const ROOT = fileURLToPath(new URL('..', import.meta.url));
const OUT = join(ROOT, 'docs/generated/many-265/');
mkdirSync(OUT, { recursive: true });
const BASE = 'http://127.0.0.1:8265/app/';
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
await new Promise((ok) => server.listen(8265, '127.0.0.1', ok));

const now = Date.now();
const task = (id, title, cats, extra) => Object.assign({ id, title, status: 'next', categoryIds: cats, priority: null, sortOrder: 0 }, extra);
const seed = () => ({
  projects: [
    { id: 'pHome', name: 'Home', color: '#3E8E5E', tasks: [task('h1', 'Rebuild the shed', ['c_repair']), task('h2', 'Pay council tax', ['c_call']), task('h3', 'Sort out the garden', ['c_repair'])] },
    { id: 'pGarden', name: 'Garden', color: '#C2731E', tasks: [task('g1', 'Order seeds', ['c_call'])] },
  ],
  categories: [{ id: 'c_repair', name: 'Repair', color: '#D9822B' }, { id: 'c_call', name: 'Call', color: '#4A6FB5' }, { id: 'c_admin', name: 'Admin', color: '#3E8E5E' }, { id: 'c_bug', name: 'Bug', color: '#B42318' }],
  inbox: [
    { id: 'th1', text: 'Get three quotes for fixing the shed door', createdAt: now - 3 * 60000 },
    { id: 'th2', text: 'Book the boiler service', createdAt: now - 2 * 60000 },
    { id: 'th3', text: 'Old phone charger in the drawer', createdAt: now - 60000 },
  ],
  completedLog: [], deletedTaskIds: [], choosingMode: { mode: 'tap', updatedAt: 1 },
});

const results = [];
const check = (name, ok, extra = '') => { results.push(ok); console.log((ok ? 'PASS ' : 'FAIL ') + name + (extra ? '  [' + extra + ']' : '')); };
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM, args: ['--no-sandbox'] });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block', colorScheme: 'light' });
const page = await ctx.newPage();
page.on('pageerror', (e) => check('no page error: ' + e.message, false));
page.on('dialog', (d) => d.accept());
await page.addInitScript(([s, key]) => { if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify(s)); localStorage.setItem('focusdeck-screen', 'sort'); }, [seed(), STATE_KEY]);
await page.goto(BASE);
await page.waitForSelector('.jot-slip');
await page.waitForTimeout(400);

const stored = () => page.evaluate((key) => JSON.parse(localStorage.getItem(key)), STATE_KEY);
const click = async (sel) => { await page.click(sel); await page.waitForTimeout(250); };
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
// flip a wallet to a card and tap it (a card off the edge can't be tapped); tap mode, so once
async function choose(wallet, key) {
  const sel = '[data-wallet="' + wallet + '"] .sleeve[data-key="' + key + '"] .icard';
  await page.$eval(sel, (el) => el.scrollIntoView({ block: 'center', inline: 'center' }));
  await page.waitForTimeout(300);
  const box = await (await page.$(sel)).boundingBox();
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await page.waitForTimeout(450);
}
const body = () => page.textContent('body');
const pencil = (n) => '.dk-pencil[data-step="' + n + '"]';
await click('[data-action="bulk-toggle"]');
await page.waitForSelector('.many-list');
await click('.bulk-row:nth-child(1) input');
await click('.bulk-row:nth-child(2) input');
await shot('m1');
check('m1: ticks, ✓ All and Clear', (await page.$$('.bulk-row input:checked')).length === 2 && !!(await page.$('[data-action="bulk-all"]')) && !!(await page.$('[data-action="bulk-none"]')));
await click('.sort-foot [data-action="bulk-next"]');
await shot('m2');
await choose('tray-folders', 'pHome');
await click('[data-scope="bulk"][data-field="priority"][data-value="high"]');
await click('.sort-foot [data-action="bulk-next"]');
await choose('tray-flags', 'c_repair');
await shot('m3');
check('m3: the picked label hangs under the carousel, no words', (await page.$$('.sort-picked .dk-tag')).length === 1 && !(await body()).includes('Nothing picked'));
await click('.sort-foot [data-action="bulk-next"]');
await page.fill('[data-bulk-group]', 'Fix the shed door');
await shot('m4');
await click('.sort-foot [data-action="bulk-next"]');
await shot('m5');
check('m5: All good? with a pencil per row and a "Sort 2" stamp', (await page.textContent('.sort-q')) === 'All good?' && (await page.$$('.dk-pencil')).length === 5 && (await page.textContent('[data-action="bulk-apply"]')).trim() === 'Sort 2');
await click(pencil(4)); // a pencil goes back to the receipt after one change
await click('.sort-foot [data-action="bulk-next"]');
check('a pencil returns to the receipt', (await page.textContent('.sort-q')) === 'All good?');
await click('[data-action="bulk-apply"]');
const st = await stored();
const parent = st.projects.flatMap((p) => p.tasks).find((t) => t.title === 'Fix the shed door');
check('Sort 2 filed both thoughts under the new task', st.inbox.length === 1 && !!parent && st.projects.flatMap((p) => p.tasks).filter((t) => t.parentId === parent.id).length === 2);
await browser.close();
server.close();
const failed = results.filter((ok) => !ok).length;
console.log(`\n${results.length - failed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
