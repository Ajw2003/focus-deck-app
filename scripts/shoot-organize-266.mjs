// scripts/shoot-organize-266.mjs -- real-Chromium walk through Organize at 390x844 (#266).
// Usage: CHROMIUM=/opt/pw-browsers/chromium-1243/chrome-linux64/chrome node scripts/shoot-organize-266.mjs
// Serves the repo root on 127.0.0.1:8266, seeds localStorage, then like a thumb: the two cards (o0), the four tick
// lists (t1 to t4), Close these? (t5), Confirm -> Triage with the Closed slip (r10t), Undo, Next (r11), Later (r12), Move (r13).
// Every screen is measured: no page scroll, no visible text under 13px. Screenshots go to docs/generated/organize-266/.
import { createRequire } from 'node:module';
import { mkdirSync, readFileSync, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import { join, extname, normalize } from 'node:path';
const require = createRequire('/opt/node22/lib/node_modules/');
const { chromium } = require('playwright');
const ROOT = fileURLToPath(new URL('..', import.meta.url));
const OUT = join(ROOT, 'docs/generated/organize-266/');
mkdirSync(OUT, { recursive: true });
const BASE = 'http://127.0.0.1:8266/app/';
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
await new Promise((ok) => server.listen(8266, '127.0.0.1', ok));

const now = Date.now(), day = 864e5;
const task = (id, title, extra) => Object.assign({ id, title, status: 'next', categoryIds: [], priority: null, sortOrder: 0, updatedAt: now - day }, extra);
const NAMES = ['Renew passport', 'Boiler service', 'Gate latch', 'Email accountant', 'Order compost', 'Paint the fence', 'Book dentist', 'Water the ferns', 'Pay council tax', 'Return library books', 'Sharpen the shears', 'Plan the holiday'];
const fill = Array.from({ length: 12 }, (_, i) => task('f' + i, NAMES[i], { priority: i === 0 ? 'urgent' : i < 3 ? 'high' : null }));
const seed = () => ({
  projects: [{ id: 'pHome', name: 'Home', color: '#3E8E5E', tasks: [
    task('rv1', 'Contact form sends twice', { status: 'review' }), task('rv2', 'Fix the login typo', { status: 'review' }),
    task('rp1', 'Old shelf plan', { notes: 'replaced by New shelf plan' }),
    task('sm1', 'Mop the kitchen', { updatedAt: now - 5 * day }), task('sm2', 'Mop the kitchen floor', { updatedAt: now - 2 * day }),
    task('st1', 'Clear out the loft', { updatedAt: now - 90 * day }),
  ].concat(fill) }],
  categories: [], inbox: [], completedLog: [], deletedTaskIds: [], choosingMode: { mode: 'tap', updatedAt: 1 },
});

const results = [];
const check = (name, ok, extra = '') => { results.push(ok); console.log((ok ? 'PASS ' : 'FAIL ') + name + (extra ? '  [' + extra + ']' : '')); };
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM, args: ['--no-sandbox'] });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block', colorScheme: 'light' });
const page = await ctx.newPage();
page.on('pageerror', (e) => check('no page error: ' + e.message, false));
page.on('dialog', (d) => d.accept());
await page.addInitScript(([s, key]) => { if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify(s)); localStorage.setItem('focusdeck-screen', 'tidy'); }, [seed(), STATE_KEY]);
await page.goto(BASE);
await page.waitForSelector('.org');
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
const status = async (id) => (await stored()).projects[0].tasks.find((t) => t.id === id).status;
const cards = () => page.$$eval('.tr-card span', (e) => e.map((x) => x.textContent));
const strip = (s) => s.replace(/^\d+ · /, '');
const tick = (id) => click('[data-tidy-tick="' + id + '"]');
const text = (sel) => page.textContent(sel);

await shot('o0');
const home = await text('.org');
check('o0: two cards (Tidy up with its count, Triage) and a Start stamp', home.includes('🧹 Tidy up') && home.includes('📌 Triage') && (await page.textContent('.dk-choice small')) === '5' && !!(await page.$('.dk-btn[data-action="tidy-step"]')));
await click('.dk-btn[data-action="tidy-step"]');
await shot('t1');
check('t1: Finished? with ticks, ✓ All, Clear, tray and bin, step 1 of 4', (await text('.sort-q')) === 'Finished?' && (await page.$$('.org-row')).length === 2 && !!(await page.$('[data-action="tidy-all"]')) && !!(await page.$('[data-action="tidy-none"]')) && (await page.$$('.dk-obj')).length === 2 && (await page.getAttribute('.dk-prog', 'aria-label')) === 'Step 1 of 4');
await click('[data-action="tidy-all"]');
check('✓ All ticks every row', (await page.$$('[data-tidy-tick]:checked')).length === 2);
await click('.dk-obj[data-mark="close"]');
await shot('t2');
check('t2: Replaced? reads old ➜ new', (await text('.org-title')).includes('Old shelf plan ➜ New shelf plan'));
await tick('rp1'); await click('.dk-obj[data-mark="close"]');
await shot('t3');
check('t3: The same? reads a = b, with Keep both and Merge', (await text('.org-title')).includes('Mop the kitchen = Mop the kitchen floor') && (await text('.org-objs')).includes('Keep both') && (await text('.org-objs')).includes('Merge'));
await tick('sm1'); await click('.dk-obj[data-mark="merge"]');
await shot('t4');
check('t4: Still want it?', (await text('.sort-q')) === 'Still want it?');
await tick('st1'); await click('.dk-obj[data-mark="close"]');
await shot('t5');
check('t5: Close these? lists 5, the merged one with a 📎', (await page.$$('.org-plain')).length === 5 && (await text('.org-list')).includes('📎 Mop the kitchen'));
check('nothing is closed before Confirm', (await status('rv1')) === 'review');
await click('[data-action="tidy-confirm"]');
await shot('r10t');
check('r10t: Triage with "Closed 5 ✓" and Undo; both ticked tasks and the rest are done', (await text('.org-slip')).includes('Closed 5 ✓') && (await status('rv1')) === 'done' && (await status('rv2')) === 'done' && (await status('sm1')) === 'done' && (await status('st1')) === 'done');
await click('.org-slip [data-action="tidy-undo"]');
check('Undo brings them back', (await status('rv1')) === 'review' && (await status('rp1')) === 'next' && (await status('sm1')) === 'next' && !(await page.$('.org-slip')));
await shot('r10');
check('r10: three numbered cards with priority flags, Next and Later flags, a Move stamp', (await cards()).length === 3 && (await page.$$('.tr-card .pf')).length >= 1 && (await text('.sort-row2')).includes('Next 8') && !!(await page.$('.dk-btn[data-to="move"]')));
await click('[data-action="triage-go"][data-to="next"]');
await shot('r11');
check('r11: Next lists 8', (await cards()).length === 8);
await click('.dk-back');
await click('[data-action="triage-later"]');
await shot('r12');
check('r12: Later has Find', !!(await page.$('[data-triage-find]')));
await page.fill('[data-triage-find]', 'holiday'); await page.waitForTimeout(250);
check('Find narrows Later', (await cards()).length === 1);
await click('.dk-back');
const before = await cards();
await click('.dk-btn[data-to="move"]');
await shot('r13');
check('r13: Move shows a ↑ and ↓ per row, a ↺ Reset card and Done', (await page.$$('.tr-move')).length === 6 && (await text('.tr-reset')).includes('↺ Reset') && !!(await page.$('.dk-btn[data-to="top"]')));
await click('.tr-row:nth-child(1) [data-dir="1"]');
await click('.dk-btn[data-to="top"]');
const after = await cards();
check('Move keeps the new order', strip(after[0]) === strip(before[1]) && strip(after[1]) === strip(before[0]), before.join('|') + ' -> ' + after.join('|'));
await page.reload(); await page.waitForSelector('.org'); await click('[data-action="triage-go"][data-to="top"]');
check('the order survives a reload', (await cards()).join() === after.join());
await browser.close();
server.close();
const failed = results.filter((ok) => !ok).length;
console.log(`\n${results.length - failed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
