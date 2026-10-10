// scripts/shoot-board.mjs -- screenshots of the Board (#144) with realistic data: 19 projects, 45
// categories, 60+ tasks (long titles and names included), at 1440 and 390 wide, dark and light, all
// projects and narrowed to one. Also asserts there is no sideways page scroll.
// Usage: CHROMIUM=/opt/pw-browsers/chromium-1194/chrome-linux/chrome node scripts/shoot-board.mjs
// Serves the repo root itself on 127.0.0.1:8135. Output: docs/generated/pr140/board-*.png
import { createRequire } from 'node:module';
import { mkdirSync, readFileSync, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import { join, extname, normalize } from 'node:path';
const require = createRequire('/opt/node22/lib/node_modules/');
const { chromium } = require('playwright');
const ROOT = fileURLToPath(new URL('..', import.meta.url));
const OUT = join(ROOT, 'docs/generated/pr140/');
mkdirSync(OUT, { recursive: true });
const BASE = 'http://127.0.0.1:8135/app/';
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.png': 'image/png' };
const server = createServer((req, res) => {
  const rel = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname)).replace(/^[/\\]+/, '');
  let file = join(ROOT, rel);
  if (!file.startsWith(ROOT)) { res.writeHead(403); return res.end(); }
  if (existsSync(file) && statSync(file).isDirectory()) file = join(file, 'index.html');
  if (!existsSync(file)) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': TYPES[extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
  res.end(readFileSync(file));
});
await new Promise((ok) => server.listen(8135, '127.0.0.1', ok));

const NAMES = ['Home', 'School', 'Website redesign', 'Band', 'Garden', 'Portfolio', 'Taxes and paperwork', 'Fitness', 'Kitchen renovation planning with the contractor', 'Reading list', 'Car', 'Holiday in Portugal', 'Open source: focus-deck', 'Finances', 'Photography', 'Family', 'Learning Rust', 'Volunteering', 'Shed rebuild'];
const COLORS = ['#3E8E5E', '#4D6FB8', '#C9584F', '#8A6FB8', '#2F8F8F', '#C2731E', '#B8527E', '#5B8C2A', '#6A6FD1', '#A8742B'];
const CAT_NAMES = ['Chore', 'Study', 'Bug', 'Art', 'Errand', 'Music', 'Writing', 'Admin', 'Call', 'Email', 'Buy', 'Plan', 'Research', 'Repair', 'Clean', 'Cook', 'Garden', 'Money', 'Health', 'Travel', 'Design', 'Code', 'Review', 'Read', 'Practice', 'Wait for reply', 'Quick win', 'Deep work', 'Needs a decision', 'Outside', 'Online', 'Phone', 'Waiting on someone else to finish their part', 'Heavy', 'Light', 'Fun', 'Family', 'Friends', 'Urgent-ish', 'Someday', 'Weekend', 'Evening', 'Paperwork', 'Tools', 'Shopping'];
const cats = CAT_NAMES.map((n, i) => ({ id: 'c' + i, name: n, color: COLORS[(i * 3) % COLORS.length] }));
const TITLES = ['Bins out Thursday', 'Read chapter 4', 'Footer link to old blog', 'Learn the bridge', 'History essay draft', 'Contact form sends twice', 'Mop the kitchen', 'Book boiler service', 'Renew passport before the Lisbon trip, the old one expires in March', 'Ask the landlord about the damp patch behind the wardrobe in the back bedroom', 'Fix the gate latch', 'Hang hallway photos', 'Cookie banner text', 'Scan sketches', 'Order compost', 'Call the dentist', 'Compare three quotes for the new shed roof and pick one', 'Pay council tax', 'Reply to Sam', 'Write the release notes for v2', 'Sharpen the secateurs', 'Tidy the tool wall', 'Check tyre pressure', 'Back up the photo library to the external disk', 'Draft the volunteer rota for November', 'Chapter 5 flashcards', 'Install the new bathroom fan', 'Supercalifragilisticexpialidocious_unbroken_long_word_in_a_title_to_test_wrapping', 'Email the accountant', 'Plant the bulbs'];
const mon = new Date(); mon.setHours(0, 0, 0, 0); mon.setDate(mon.getDate() - ((mon.getDay() + 6) % 7));
const sinceMon = Date.now() - mon.getTime();
let n = 0;
const projects = NAMES.map((name, i) => ({ id: 'p' + i, name, color: COLORS[i % COLORS.length], tasks: [] }));
// project 0 (Home) gets plenty in every column so the narrowed view is full
for (let k = 0; k < 66; k++) {
  const pi = k < 18 ? 0 : (k * 7 + 3) % projects.length;
  const status = k % 11 === 0 || k % 11 === 5 ? 'done' : k % 7 === 0 ? 'doing' : 'next';
  const nc = (k % 4) + (k % 9 === 0 ? 3 : 0);
  projects[pi].tasks.push({ id: 't' + (n++), title: TITLES[k % TITLES.length] + (k >= TITLES.length ? ' (' + (k + 1) + ')' : ''), status,
    categoryIds: Array.from({ length: nc }, (_, j) => cats[(k * 5 + j * 7) % cats.length].id), priority: ['urgent', 'high', 'medium', 'low', null][k % 5],
    updatedAt: status === 'done' ? Date.now() - Math.min(sinceMon - 1000, (k + 1) * 3.1 * 3600e3) : 1, order: k });
}
const seed = { projects, categories: cats, inbox: [], completedLog: [], deletedTaskIds: {}, choosingMode: { mode: 'twice', updatedAt: 1 } };

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM, args: ['--no-sandbox'] });
const SIZES = { desk: { width: 1440, height: 900 }, phone: { width: 390, height: 844 } };
let bad = 0;
for (const size of ['desk', 'phone']) for (const scheme of ['dark', 'light']) for (const view of ['all', 'one']) {
  const ctx = await browser.newContext({ viewport: SIZES[size], colorScheme: scheme, serviceWorkers: 'block', hasTouch: size === 'phone' });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => { bad++; console.log('FAIL page error: ' + e.message); });
  await page.addInitScript(([s, one]) => {
    if (localStorage.getItem('shot-seeded')) return;
    localStorage.setItem('shot-seeded', '1');
    localStorage.setItem('focusdeck-onboarding', 'done'); localStorage.setItem('focusdeck-screen', 'board');
    localStorage.setItem('focusdeck-state-v1', JSON.stringify(s));
    if (one) localStorage.setItem('focusdeck-board-project', 'p0');
  }, [seed, view === 'one']);
  await page.goto(BASE);
  await page.waitForSelector('.board-card');
  await page.waitForTimeout(400);
  const tag = `board-${size === 'desk' ? '1440' : '390'}-${scheme}-${view === 'one' ? 'narrowed' : 'all'}`;
  const over = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
  console.log((over ? 'FAIL' : 'PASS') + ' no sideways scroll ' + tag); if (over) bad++;
  await page.screenshot({ path: OUT + tag + '.png', fullPage: false });
  if (size === 'phone') { // the other two columns through the switch
    for (const col of ['doing', 'done']) {
      await page.click(`.board-switch-btn[data-col="${col}"]`);
      await page.waitForTimeout(150);
      await page.screenshot({ path: OUT + tag + '-' + col + '.png', fullPage: false });
    }
  }
  await ctx.close();
}
{ // ticking a card uses the existing toggle-task handler: the card moves to Done this week
  const ctx = await browser.newContext({ viewport: SIZES.desk, serviceWorkers: 'block' });
  const page = await ctx.newPage();
  await page.addInitScript(([s]) => { if (localStorage.getItem('shot-seeded')) return; localStorage.setItem('shot-seeded', '1'); localStorage.setItem('focusdeck-onboarding', 'done'); localStorage.setItem('focusdeck-screen', 'board'); localStorage.setItem('focusdeck-state-v1', JSON.stringify(s)); }, [seed]);
  await page.goto(BASE); await page.waitForSelector('.board-card');
  const counts = () => page.$$eval('.board-count', (els) => els.slice(3, 6).map((e) => Number(e.textContent)));
  const before = await counts();
  const id = await page.$eval('.board-col[data-col="next"] .board-card', (e) => e.dataset.taskId);
  await page.click('.board-col[data-col="next"] .board-card input[type="checkbox"]');
  await page.waitForTimeout(500);
  const after = await counts();
  const moved = await page.$eval('.board-card[data-task-id="' + id + '"]', (e) => e.dataset.status).catch(() => 'gone');
  const ok = after[0] === before[0] - 1 && after[2] === before[2] + 1 && moved === 'done';
  console.log((ok ? 'PASS' : 'FAIL') + ' ticking a card moves it to Done  [' + before + ' -> ' + after + ', ' + moved + ']'); if (!ok) bad++;
  await ctx.close();
}
await browser.close(); server.close();
console.log(bad ? 'FAILED' : 'screenshots in docs/generated/pr140/');
process.exit(bad ? 1 : 0);
