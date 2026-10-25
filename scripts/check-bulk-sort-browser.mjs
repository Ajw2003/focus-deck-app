// scripts/check-bulk-sort-browser.mjs -- real-Chromium check of "Select many" on the Sort screen and
// of the jotter with no length limit. Runs on sample data only, in a fresh browser profile per run.
// Usage: node scripts/check-bulk-sort-browser.mjs   (CHROMIUM=<path> to use another Chromium)
// Serves the repo root itself on 127.0.0.1:8131 for the length of the run. Checks, on a phone and a
// wide screen: the list and its ticks, what Apply waits for, filing ticked thoughts with a label
// into a project and grouping them under one new task, labelling tasks where they are, the backup
// copy taken first, every row showing its whole text, then a 3,000-character, multi-line thought typed into the jotter (kept whole,
// the box grows, Enter adds it) and filed (short title, full text in the notes).
// Screenshots: docs/generated/bulk-sort/. See docs/4-systems/in-tray.md#sort-many-at-once
import { createRequire } from 'node:module';
import { mkdirSync, readFileSync, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import { join, extname, normalize } from 'node:path';
const require = createRequire('/opt/node22/lib/node_modules/');
const { chromium } = require('playwright');
const ROOT = fileURLToPath(new URL('..', import.meta.url));
const OUT = join(ROOT, 'docs/generated/bulk-sort/');
mkdirSync(OUT, { recursive: true });
const BASE = 'http://127.0.0.1:8131/app/';
const STATE_KEY = 'focusdeck-state-v1';
const BACKUPS_KEY = 'focusdeck-state-backups';

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

const task = (id, title, cats) => ({ id, title, status: 'next', categoryIds: cats, priority: null, sortOrder: 0 });
const now = Date.now();
const seed = () => ({
  projects: [
    { id: 'pHome', name: 'Home', color: '#3E8E5E', tasks: [task('h1', 'Bins', ['c_chore']), task('h3', 'Fix the gate latch', [])] },
    { id: 'pSchool', name: 'School', color: '#4D6FB8', tasks: [task('s1', 'Read chapter 4', ['c_study']), task('s2', 'Find my calculator', [])] },
  ],
  categories: [{ id: 'c_chore', name: 'Chore', color: '#3E8E5E' }, { id: 'c_study', name: 'Study', color: '#4D6FB8' }, { id: 'c_art', name: 'Art', color: '#C2731E' }],
  inbox: [
    { id: 'th1', text: 'Buy a birthday card for Gran before Saturday', createdAt: now - 3 * 60000 },
    { id: 'th2', text: 'Post the parcel', createdAt: now - 60000 },
    { id: 'th3', text: 'Old phone charger in the drawer', createdAt: now - 30000 },
  ],
  completedLog: [], deletedTaskIds: {},
  choosingMode: { mode: 'tap', updatedAt: 1 },
});

const results = [];
const check = (name, ok, extra = '') => { results.push(ok); console.log((ok ? 'PASS ' : 'FAIL ') + name + (extra ? '  [' + extra + ']' : '')); };
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM, args: ['--no-sandbox'] });
const stored = (page) => page.evaluate((key) => JSON.parse(localStorage.getItem(key)), STATE_KEY);
const all = (st) => st.projects.flatMap((p) => p.tasks.map((t) => ({ ...t, projectId: p.id })));

for (const [label, width] of [['phone', 420], ['wide', 1440]]) {
  const tag = `[${label}]`;
  const ctx = await browser.newContext({ viewport: { width, height: 900 }, serviceWorkers: 'block' });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => check(`${tag} no page error: ` + e.message, false));
  await page.addInitScript(([s, key]) => { if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify(s)); if (!localStorage.getItem('focusdeck-screen')) localStorage.setItem('focusdeck-screen', 'sort'); }, [seed(), STATE_KEY]);
  await page.goto(BASE);
  await page.waitForSelector('.jot-slip');

  // ---- Select many ----
  check(`${tag} the tray offers Select many`, await page.isVisible('[data-action="bulk-toggle"]'));
  await page.click('[data-action="bulk-toggle"]');
  await page.waitForSelector('.bulk');
  check(`${tag} every slip is listed (3 thoughts + 2 unlabelled tasks)`, (await page.$$('.bulk-row')).length === 5);
  const fits = await page.$$eval('.bulk-row', (rows) => rows.every((r) => {
    const t = r.querySelector('.bulk-text'), rb = r.getBoundingClientRect(), tb = t.getBoundingClientRect();
    return t.scrollHeight <= t.clientHeight + 1 && tb.bottom <= rb.bottom && getComputedStyle(t).display === 'block';
  }));
  check(`${tag} every row shows its whole text, inside the row`, fits);
  check(`${tag} a thought's row says only when, in small type under the text`, (await page.$eval('[data-bulk-key="i:th1"] ~ .bulk-body .bulk-meta', (e) => e.textContent)) === '3m ago');
  check(`${tag} Apply is off with nothing ticked`, await page.$eval('[data-action="bulk-apply"]', (b) => b.disabled));
  await page.click('[data-action="bulk-all"]');
  check(`${tag} Tick all ticks all five`, (await page.textContent('.bulk-head .tray-count')).startsWith('5 of 5'));
  await page.click('[data-action="bulk-none"]');
  check(`${tag} Clear ticks clears them`, (await page.textContent('.bulk-head .tray-count')).startsWith('0 of 5'));

  await page.check('[data-bulk-key="i:th1"]');
  await page.check('[data-bulk-key="i:th2"]');
  check(`${tag} ticked thoughts ask for a project first`, ((await page.textContent('.bulk .step-why')) || '').includes('Choose a project for the thoughts'));
  await page.selectOption('[data-bulk-project]', 'pHome');
  await page.click('[data-action="bulk-flag"][data-token="c_chore"]');
  await page.fill('[data-bulk-newlabel]', 'Errand');
  await page.click('[data-action="bulk-new-flag"]');
  await page.fill('[data-bulk-group]', 'Saturday jobs');
  const wide = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  check(`${tag} no sideways page scroll`, wide <= 0, 'overflow ' + wide + 'px');
  await page.$eval('.inbox-card', (e) => { e.scrollIntoView(); window.scrollBy(0, -130); });
  await page.screenshot({ path: OUT + label + '-ticked.png', fullPage: label === 'phone' });
  const before = JSON.stringify(await stored(page));
  check(`${tag} Apply reads "Sort 2 items"`, (await page.textContent('[data-action="bulk-apply"]')).startsWith('Sort 2 items'));
  await page.click('[data-action="bulk-apply"]');
  await page.waitForTimeout(300);

  let st = await stored(page);
  const backups = await page.evaluate((k) => JSON.parse(localStorage.getItem(k) || '[]'), BACKUPS_KEY);
  const copy = backups.find((b) => b.reason === 'before sorting many at once');
  check(`${tag} a backup copy of the data as it was is saved first`, !!copy && JSON.parse(copy.raw).inbox.length === 3 && JSON.stringify(JSON.parse(copy.raw).inbox) === JSON.stringify(JSON.parse(before).inbox));
  const errand = st.categories.find((c) => c.name === 'Errand');
  const filed = all(st).filter((t) => ['Buy a birthday card for Gran before Saturday', 'Post the parcel'].includes(t.title));
  const parent = all(st).find((t) => t.title === 'Saturday jobs');
  check(`${tag} both thoughts left the tray`, !st.inbox.some((i) => i.id === 'th1' || i.id === 'th2') && st.inbox.some((i) => i.id === 'th3'));
  check(`${tag} both became tasks in Home with Chore and the new Errand label`, filed.length === 2 && filed.every((t) => t.projectId === 'pHome' && t.categoryIds.includes('c_chore') && errand && t.categoryIds.includes(errand.id)));
  check(`${tag} grouped under the new task "Saturday jobs"`, !!parent && parent.projectId === 'pHome' && filed.every((t) => t.parentId === parent.id));
  check(`${tag} the notice says what happened`, ((await page.textContent('.toast')) || '').includes('filed 2 into Home'), (await page.textContent('.toast')) || '');
  check(`${tag} untouched records are unchanged`, JSON.stringify(all(st).filter((t) => ['h1', 's1'].includes(t.id)).map((t) => [t.id, t.title, t.categoryIds])) === JSON.stringify([['h1', 'Bins', ['c_chore']], ['s1', 'Read chapter 4', ['c_study']]]));

  // tasks only: label them where they are
  await page.check('[data-bulk-key="t:h3"]');
  await page.check('[data-bulk-key="t:s2"]');
  await page.click('[data-action="bulk-flag"][data-token="c_art"]');
  await page.click('[data-action="bulk-apply"]');
  await page.waitForTimeout(300);
  st = await stored(page);
  const h3 = all(st).find((t) => t.id === 'h3'), s2 = all(st).find((t) => t.id === 's2');
  check(`${tag} label only: tasks keep their projects and get the label`, h3.projectId === 'pHome' && s2.projectId === 'pSchool' && h3.categoryIds.includes('c_art') && s2.categoryIds.includes('c_art'));
  await page.click('.bulk-head [data-action="bulk-toggle"]');
  await page.waitForSelector('.jot-slip');
  check(`${tag} One at a time goes back to the slip`, (await page.textContent('.jot-slip .slip-text')).startsWith('Old phone charger'));

  // ---- The jotter: no length limit ----
  const jot = '#capture-input';
  check(`${tag} the jotter has no maxlength`, await page.$eval(jot, (e) => e.tagName === 'TEXTAREA' && !e.hasAttribute('maxlength')));
  const h0 = await page.$eval(jot, (e) => e.getBoundingClientRect().height);
  const para = 'Remember to ask about the timetable change and the form for the trip. ';
  const longText = 'Big brain dump' + '\n' + para.repeat(42).trim();
  await page.click(jot);
  await page.keyboard.type('Big brain dump');
  await page.keyboard.press('Shift+Enter');
  await page.$eval(jot, (e, rest) => { e.value += rest; e.dispatchEvent(new Event('input', { bubbles: true })); }, para.repeat(42).trim());
  const h1 = await page.$eval(jot, (e) => e.getBoundingClientRect().height);
  check(`${tag} Shift+Enter makes a new line instead of adding`, (await stored(page)).inbox.length === 1 && (await page.$eval(jot, (e) => e.value)).startsWith('Big brain dump\n'));
  check(`${tag} the jotter grows with the text, up to 40% of the screen`, h1 > h0 * 3 && h1 <= 900 * 0.4 + 2, h0 + 'px -> ' + h1 + 'px');
  await page.screenshot({ path: OUT + label + '-jotter-long.png' });
  await page.keyboard.press('Enter');
  await page.waitForTimeout(300);
  st = await stored(page);
  const cap = st.inbox.find((i) => i.text.startsWith('Big brain dump'));
  check(`${tag} Enter adds it, every character kept (${longText.length} characters)`, !!cap && cap.text === longText, cap ? String(cap.text.length) : 'missing');
  check(`${tag} the jotter is empty and small again`, await page.$eval(jot, (e, h) => e.value === '' && e.getBoundingClientRect().height <= h + 2, h0));

  // file it one at a time: short title, whole text in the notes
  await page.click('[data-action="unsorted-skip"]'); // the charger goes to the back, the brain dump is on top
  await page.waitForTimeout(200);
  check(`${tag} the long thought shows whole on the slip`, (await page.$eval('.jot-slip .slip-text', (e) => e.innerText)).replace(/\s+/g, ' ').trim() === longText.replace(/\s+/g, ' '));
  await page.$eval('.inbox-card', (e) => { e.scrollIntoView(); window.scrollBy(0, -130); });
  await page.screenshot({ path: OUT + label + '-slip-long.png', fullPage: label === 'phone' });
  const sel = '[data-wallet="tray-folders"] .sleeve[data-key="pSchool"] .icard';
  await page.$eval(sel, (el) => el.scrollIntoView({ block: 'center', inline: 'center' }));
  await page.waitForTimeout(300);
  const box = await (await page.$(sel)).boundingBox();
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await page.waitForTimeout(500);
  await page.click('.step-tab[data-step="3"]');
  await page.waitForTimeout(200);
  await page.click('.file-btn');
  await page.waitForTimeout(300);
  st = await stored(page);
  const big = all(st).find((t) => t.title === 'Big brain dump');
  check(`${tag} filed: the first line is the title and the whole text is the notes`, !!big && big.projectId === 'pSchool' && big.notes === longText, big ? big.title : 'not filed');
  await ctx.close();
}

// Many slips (Aj had 41): every row still shows its whole text. A height-capped scrolling list used to
// squeeze each row to one line once the list was longer than the cap.
{
  const many = seed();
  const words = ['clear space on the right side of the desk for the monitor', 'move bins by printer ontop of the cabinet', 'unplug and move subwoofer'];
  many.inbox = Array.from({ length: 41 }, (_, i) => ({ id: 'm' + i, text: words[i % 3], createdAt: now - 4 * 86400000 }));
  many.noteFace = { face: 'dyslexic', updatedAt: 1 };
  const ctx = await browser.newContext({ viewport: { width: 393, height: 800 }, colorScheme: 'dark', serviceWorkers: 'block' });
  const page = await ctx.newPage();
  await page.addInitScript(([s, key]) => { localStorage.setItem(key, JSON.stringify(s)); localStorage.setItem('focusdeck-screen', 'sort'); }, [many, STATE_KEY]);
  await page.goto(BASE);
  await page.waitForSelector('[data-action="bulk-toggle"]');
  await page.click('[data-action="bulk-toggle"]');
  await page.waitForSelector('.bulk');
  const spill = await page.$$eval('.bulk-row', (rows) => rows.filter((r) => {
    const t = r.querySelector('.bulk-text'), m = r.querySelector('.bulk-meta');
    return m.getBoundingClientRect().bottom > r.getBoundingClientRect().bottom || t.scrollHeight > t.clientHeight + 1;
  }).length);
  check(`[phone, 41 slips, dyslexic face] no row cuts its text short`, spill === 0, spill + ' rows spill');
  await page.screenshot({ path: OUT + 'phone-41-rows.png' });
  await ctx.close();
}

await browser.close();
server.close();
const failed = results.filter((ok) => !ok).length;
console.log(`\n${results.length - failed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
