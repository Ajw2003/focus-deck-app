// scripts/check-wallet-touch-browser.mjs -- real-Chromium check of the focus wallets under a real
// finger (#131, #132), at a phone size with touch, for each mode (Tap, Tap twice, and a save still
// saying the retired Swipe up): flipping sideways, the page scrolling from a vertical drag that
// starts on a side card, pushing the facing card up draws, a finger moving down on it scrolls back
// up, and a tap draws (once or twice by mode). Touches go through the DevTools protocol
// (scripts/lib/touch.mjs), so touch-action and the browser's own touch scrolling really run.
// Usage: CHROMIUM=/opt/pw-browsers/chromium-1194/chrome-linux/chrome node scripts/check-wallet-touch-browser.mjs
// Serves the repo root itself on 127.0.0.1:8132 for the length of the run (no separate server).
import { createRequire } from 'node:module';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import { join, extname, normalize } from 'node:path';
import { swipe } from './lib/touch.mjs';
const require = createRequire('/opt/node22/lib/node_modules/');
const { chromium } = require('playwright');
const ROOT = fileURLToPath(new URL('..', import.meta.url));
const BASE = 'http://127.0.0.1:8132/app/';

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
await new Promise((ok) => server.listen(8132, '127.0.0.1', ok));

const results = [];
const check = (name, ok, extra = '') => { results.push(ok); console.log((ok ? 'PASS ' : 'FAIL ') + name + (extra ? '  [' + extra + ']' : '')); };
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM, args: ['--no-sandbox'] });

const task = (id, c) => ({ id, title: id, status: 'next', categoryIds: [c] });
const seed = {
  projects: ['Home', 'School', 'Website', 'Art', 'Band'].map((n, i) => ({ id: 'p' + i, name: n, color: '#3E8E5E', tasks: [task(n + ' one', 'c1'), task(n + ' two', 'c2')] })),
  categories: [{ id: 'c1', name: 'Chore', color: '#3E8E5E' }, { id: 'c2', name: 'Study', color: '#4D6FB8' }],
  inbox: [], completedLog: [], deletedTaskIds: {},
};

async function open(mode) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, serviceWorkers: 'block' });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => check(`[${mode}] no page error: ` + e.message, false));
  await page.addInitScript(([s, m]) => {
    if (localStorage.getItem('focusdeck-state-v1')) return;
    localStorage.setItem('focusdeck-onboarding', 'done');
    localStorage.setItem('focusdeck-state-v1', JSON.stringify({ ...s, choosingMode: { mode: m, updatedAt: 1 } }));
  }, [seed, mode]);
  await page.goto(BASE);
  await page.waitForSelector('.flip-track');
  // the Focus screen alone can fit a phone (#135); the scroll checks need a page taller than the window
  await page.evaluate(() => { document.querySelector('.wrap').style.paddingBottom = '1400px'; });
  await page.waitForTimeout(400);
  return { ctx, page };
}
const track = (page) => page.$('[data-wallet="projects"]');
const facing = (page) => page.$eval('[data-wallet="projects"] .sleeve.is-centre', (e) => e.dataset.key);
const drawn = (page) => page.$('.focus-active');
const centreCard = async (page) => (await page.$('[data-wallet="projects"] .sleeve.is-centre .icard')).boundingBox();

for (const mode of ['tap', 'twice', 'swipe']) {
  const tag = `[${mode}]`;
  let { ctx, page } = await open(mode);

  // sideways: flips
  let box = await (await track(page)).boundingBox();
  const before = await facing(page);
  await swipe(page, { x: box.x + box.width * 0.85, y: box.y + box.height / 2 }, { x: box.x + box.width * 0.15, y: box.y + box.height / 2 });
  check(`${tag} a sideways swipe flips the folders`, (await facing(page)) !== before, before + ' -> ' + (await facing(page)));

  // vertical, starting on a side card: the page scrolls (#131)
  box = await (await track(page)).boundingBox();
  let y0 = await page.evaluate(() => scrollY);
  await swipe(page, { x: box.x + 18, y: box.y + box.height / 2 + 30 }, { x: box.x + 18, y: box.y + box.height / 2 - 220 });
  let y1 = await page.evaluate(() => scrollY);
  check(`${tag} a vertical drag that starts beside the facing card scrolls the page`, y1 - y0 > 100, y0 + ' -> ' + y1);
  check(`${tag} ...and draws nothing`, !(await drawn(page)));

  // a finger moving down on the facing card scrolls back up
  let card = await centreCard(page);
  await swipe(page, { x: card.x + card.width / 2, y: card.y + 10 }, { x: card.x + card.width / 2, y: card.y + 230 });
  const y2 = await page.evaluate(() => scrollY);
  check(`${tag} a finger moving down on the facing card scrolls the page back up`, y2 < y1 - 100, y1 + ' -> ' + y2);
  check(`${tag} ...and draws nothing`, !(await drawn(page)));

  // pushing the facing card up draws, in every mode (#132)
  card = await centreCard(page);
  await swipe(page, { x: card.x + card.width / 2, y: card.y + card.height - 12 }, { x: card.x + card.width / 2, y: card.y - 90 });
  await page.waitForTimeout(300);
  check(`${tag} pushing the facing card up draws a task`, !!(await drawn(page)));
  await ctx.close();

  // a tap draws: once in Tap (and the old Swipe up), twice in Tap twice (#132)
  ({ ctx, page } = await open(mode));
  card = await centreCard(page);
  await page.touchscreen.tap(card.x + card.width / 2, card.y + card.height / 2);
  await page.waitForTimeout(400);
  if (mode === 'twice') {
    check(`${tag} the first tap lifts the card, nothing drawn yet`, !(await drawn(page)) && !!(await page.$('[data-wallet="projects"] .sleeve.is-armed')));
    await page.touchscreen.tap(card.x + card.width / 2, card.y + card.height / 2);
    await page.waitForTimeout(400);
    check(`${tag} the second tap draws`, !!(await drawn(page)));
  } else {
    check(`${tag} one tap on the facing card draws (no nudge)`, !!(await drawn(page)));
  }
  await ctx.close();
}

await browser.close();
server.close();
const failed = results.filter((ok) => !ok).length;
console.log(`\n${results.length - failed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
