// scripts/shoot-review-271.mjs -- real-Chromium walk through the Review tab at 390x844 (#271): one task at a time.
// Usage: CHROMIUM=/opt/pw-browsers/chromium-1243/chrome-linux64/chrome node scripts/shoot-review-271.mjs
// Serves the repo root on 127.0.0.1:8271, seeds localStorage, then like a thumb: Finished? (v1), Looks good with its slip (v2), Undo,
// More work with its slip, Undo, Done this week (v3), its Undo flag, Back, and All reviewed. Screenshots go to docs/generated/review-271/.
// Each screen is measured: the page must not scroll (it fits the phone) and no visible text may be under 13px. State is read back from localStorage.
import { createRequire } from 'node:module';
import { mkdirSync, readFileSync, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import { join, extname, normalize } from 'node:path';
const require = createRequire('/opt/node22/lib/node_modules/');
const { chromium } = require('playwright');
const ROOT = fileURLToPath(new URL('..', import.meta.url));
const OUT = join(ROOT, 'docs/generated/review-271/');
mkdirSync(OUT, { recursive: true });
const BASE = 'http://127.0.0.1:8271/app/';
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
await new Promise((ok) => server.listen(8271, '127.0.0.1', ok));

const now = Date.now();
const t = (id, title, status, extra) => Object.assign({ id, title, status, updatedAt: now - 1000, sortOrder: 1, categoryIds: [] }, extra);
const seed = () => ({
  projects: [
    { id: 'p0', name: 'Home', color: '#3E8E5E', sortOrder: 1, tasks: [
      t('r1', 'Renew passport', 'review', { updatedAt: now - 3000 }), t('r2', 'Call the plumber about the kitchen tap', 'review', { updatedAt: now - 2000 }),
      t('r3', 'Pick one for me', 'review', { updatedAt: now - 1000, issueNumber: 12 }),
      t('d1', 'Bins out', 'done', { completedAt: now - 5000, statusBeforeDone: 'doing' }), t('d2', 'Gas bill', 'done', { completedAt: now - 6000, statusBeforeDone: 'next' })] },
  ],
  categories: [], inbox: [], completedLog: [], deletedTaskIds: {}, choosingMode: { mode: 'twice', updatedAt: 1 },
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
  localStorage.setItem('focusdeck-screen', 'review');
}, [seed(), STATE_KEY]);
await page.goto(BASE);
await page.waitForSelector('.rv-card');
await page.waitForTimeout(400);

const status = async (id) => (await page.evaluate((key) => JSON.parse(localStorage.getItem(key)), STATE_KEY)).projects[0].tasks.find((x) => x.id === id).status;
const click = async (sel) => { await page.click(sel); await page.waitForTimeout(250); };
const text = async (sel) => ((await page.textContent(sel)) || '').replace(/\s+/g, ' ').trim();
const title = () => page.$eval('.rv-title', (e) => e.textContent).catch(() => '');
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

// v1: Finished? with the newest task, the dots, the two stamps, the Done this week tag
check('v1: the newest waiting task on the clipboard', (await title()) === 'Pick one for me' && (await text('.sort-q')) === 'Finished?');
check('v1: three dots, two stamps, the Done this week tag', (await page.$$('.sort-dots i')).length === 3 && (await text('.rv-stamps')) === '✓ Looks good✎ More work' && (await text('.rv-tag')) === 'Done this week');
await shot('v1');
// Looks good, then its slip (v2) and Undo
await click('[data-action="review-done"]');
check('v2: Looks good made r3 done and the next task shows', (await status('r3')) === 'done' && (await title()) === 'Call the plumber about the kitchen tap');
check('v2: the slip says Done ✓ / Undo and the second dot is on', (await text('.org-slip')) === 'Done ✓Undo' && (await page.getAttribute('.sort-dots', 'aria-label')) === 'Step 2 of 3');
await shot('v2');
await click('.org-slip [data-action="review-undo"]');
check('v2: Undo of Looks good puts r3 back in review and on the clipboard', (await status('r3')) === 'review' && (await title()) === 'Pick one for me' && !(await page.$('.org-slip')));
// More work, its slip, Undo
await click('[data-action="review-more"]');
check('v2b: More work sent r3 back to Doing and the next task shows', (await status('r3')) === 'doing' && (await title()) === 'Call the plumber about the kitchen tap');
check('v2b: the slip says Sent back ✓ / Undo', (await text('.org-slip')) === 'Sent back ✓Undo');
await shot('v2b');
await click('.org-slip [data-action="review-undo"]');
check('v2b: Undo of More work puts r3 back in review', (await status('r3')) === 'review' && (await title()) === 'Pick one for me');
// v3: Done this week, the Undo flag, Back
await click('[data-action="review-list"]');
check('v3: Done this week lists the two done tasks struck through with an Undo flag each', (await page.$$eval('.rv-struck', (e) => e.map((x) => x.textContent).sort().join('|'))) === 'Bins out|Gas bill' && (await page.$$('.rv-done .dk-link')).length === 2 && (await text('.dk-back')) === '‹ Back');
await shot('v3');
await click('.rv-done:has(.rv-struck:text("Bins out")) .dk-link');
check('v3: Undo flag restores Bins out to Doing and it leaves the list', (await status('d1')) === 'doing' && (await page.$$eval('.rv-struck', (e) => e.map((x) => x.textContent).join())) === 'Gas bill');
await click('[data-action="review-back"]');
check('v3: Back is the clipboard again', (await text('.sort-q')) === 'Finished?');
// All reviewed
for (let i = 0; i < 3; i++) await click('[data-action="review-done"]');
check('empty: All reviewed ✓', (await text('.rv-none')) === 'All reviewed ✓' && !(await page.$('.rv-stamps')));
await shot('empty');
await browser.close(); server.close();
const failed = results.filter((x) => !x).length;
console.log(failed ? failed + ' FAILED of ' + results.length : 'ALL PASSED (' + results.length + ')');
process.exit(failed ? 1 : 0);
