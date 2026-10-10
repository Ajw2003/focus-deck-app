// scripts/check-in-tray-browser.mjs -- real-Chromium check of the Unsorted in-tray (#121).
// Usage: CHROMIUM=/opt/pw-browsers/chromium-1194/chrome-linux/chrome node scripts/check-in-tray-browser.mjs
// Serves the repo root itself on 127.0.0.1:8126 for the length of the run (no separate server),
// seeds localStorage, and checks the tray in dark and light: the top slip, choosing a folder and
// flags (and choosing again to undo), filing into the right project with the right labels, Later,
// a task slip (no folder wallet, Save, Save with nothing = to the back), Already done and Bin it.
// Screenshots: docs/generated/pr121/.
import { createRequire } from 'node:module';
import { mkdirSync, readFileSync, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import { join, extname, normalize } from 'node:path';
const require = createRequire('/opt/node22/lib/node_modules/');
const { chromium } = require('playwright');
const ROOT = fileURLToPath(new URL('..', import.meta.url));
const OUT = join(ROOT, 'docs/generated/pr121/');
mkdirSync(OUT, { recursive: true });
const BASE = 'http://127.0.0.1:8126/app/';
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
await new Promise((ok) => server.listen(8126, '127.0.0.1', ok));

const task = (id, title, cats) => ({ id, title, status: 'next', categoryIds: cats, priority: null, sortOrder: 0 });
const now = Date.now();
const seed = (mode) => ({
  projects: [
    { id: 'pHome', name: 'Home', color: '#3E8E5E', tasks: [task('h1', 'Bins', ['c_chore']), task('h2', 'Mop', ['c_chore']), task('h3', 'Fix the gate latch', [])] },
    { id: 'pSchool', name: 'School', color: '#4D6FB8', tasks: [task('s1', 'Read chapter 4', ['c_study'])] },
  ],
  categories: [{ id: 'c_chore', name: 'Chore', color: '#3E8E5E' }, { id: 'c_study', name: 'Study', color: '#4D6FB8' }, { id: 'c_art', name: 'Art', color: '#C2731E' }],
  inbox: [
    { id: 'th1', text: 'Buy a birthday card for Gran before Saturday', createdAt: now - 3 * 60000 },
    { id: 'th2', text: 'Email Ms Patel about the trip', createdAt: now - 60000 },
    { id: 'th3', text: 'Old phone charger in the drawer', createdAt: now - 30000 },
  ],
  completedLog: [], deletedTaskIds: [],
  choosingMode: { mode, updatedAt: 1 },
});

const results = [];
const check = (name, ok, extra = '') => { results.push(ok); console.log((ok ? 'PASS ' : 'FAIL ') + name + (extra ? '  [' + extra + ']' : '')); };

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM, args: ['--no-sandbox'] });

async function open(mode, scheme) {
  const ctx = await browser.newContext({ viewport: { width: 420, height: 900 }, colorScheme: scheme, serviceWorkers: 'block' });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => check(`[${mode}/${scheme}] no page error: ` + e.message, false));
  page.on('dialog', (d) => d.accept());
  await page.addInitScript(([s, key]) => { if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify(s)); }, [seed(mode), STATE_KEY]);
  await page.goto(BASE);
  await page.waitForSelector('.jot-slip');
  await page.waitForTimeout(300);
  return { ctx, page };
}
const stored = (page) => page.evaluate((key) => JSON.parse(localStorage.getItem(key)), STATE_KEY);
const slipText = (page) => page.$eval('.jot-slip .slip-text', (e) => e.textContent);
const trayCount = (page) => page.$eval('.tray-count', (e) => e.textContent.trim());
const flagsOnSlip = (page) => page.$$eval('.slip-flags .slip-flag', (els) => els.map((e) => e.textContent));
// Flip a tray wallet to a card (as a swipe would: a card off the edge can't be tapped), then tap
// it; in tap-twice mode the first tap lifts it, the second chooses.
async function choose(page, wallet, key, mode) {
  const sel = '[data-wallet="' + wallet + '"] .sleeve[data-key="' + key + '"] .icard';
  await page.$eval(sel, (el) => el.scrollIntoView({ block: 'center', inline: 'center' }));
  await page.waitForTimeout(300); // the snap settles and the wallet records the facing card
  for (let i = 0; i < (mode === 'twice' ? 2 : 1); i++) {
    const box = await (await page.$(sel)).boundingBox();
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    await page.waitForTimeout(450); // let a flip settle before the next tap
  }
  await page.waitForTimeout(150);
}

for (const [mode, scheme] of [['tap', 'dark'], ['twice', 'light']]) {
  const tag = `[${mode}/${scheme}]`;
  const { ctx, page } = await open(mode, scheme);

  check(`${tag} tray shows the oldest thought first`, (await slipText(page)).startsWith('Buy a birthday card'), await slipText(page));
  check(`${tag} count reads "4 in the tray" (3 thoughts + 1 unlabelled task)`, (await trayCount(page)) === '4 in the tray', await trayCount(page));
  check(`${tag} a thought has a folder wallet and a flag wallet`, !!(await page.$('[data-wallet="tray-folders"]')) && !!(await page.$('[data-wallet="tray-flags"]')));
  check(`${tag} File is disabled until a folder is chosen`, await page.$eval('.file-btn', (b) => b.disabled && b.textContent === 'Choose a folder first'));
  const wide = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  check(`${tag} no sideways page scroll`, wide <= 0, 'overflow ' + wide + 'px');
  await page.$eval('.inbox-card', (e) => { e.scrollIntoView(); window.scrollBy(0, -130); }); // clear of the sticky jotter
  await page.screenshot({ path: OUT + `${scheme}-${mode}-thought.png` });

  await choose(page, 'tray-folders', 'pSchool', mode);
  check(`${tag} choosing a folder puts it on the slip`, (await page.$eval('.slip-dest', (e) => e.textContent)).includes('Going in School'), await page.$eval('.slip-dest', (e) => e.textContent));
  check(`${tag} File names the folder`, await page.$eval('.file-btn', (b) => !b.disabled && b.textContent === 'File it in School →'));
  await choose(page, 'tray-folders', 'pSchool', mode);
  check(`${tag} choosing the folder again clears it`, (await page.$eval('.slip-dest', (e) => e.textContent)) === 'No folder yet');
  await choose(page, 'tray-folders', 'pHome', mode);

  await choose(page, 'tray-flags', 'c_chore', mode);
  await choose(page, 'tray-flags', 'kind:reminder', mode);
  check(`${tag} chosen flags stick to the slip`, JSON.stringify(await flagsOnSlip(page)) === '["Chore","Reminder"]', (await flagsOnSlip(page)).join());
  await choose(page, 'tray-flags', 'c_chore', mode);
  check(`${tag} choosing a flag again takes it off`, JSON.stringify(await flagsOnSlip(page)) === '["Reminder"]', (await flagsOnSlip(page)).join());
  await choose(page, 'tray-flags', 'c_chore', mode);
  await page.$eval('.inbox-card', (e) => { e.scrollIntoView(); window.scrollBy(0, -130); }); // clear of the sticky jotter
  await page.screenshot({ path: OUT + `${scheme}-${mode}-flagged.png` });

  await page.click('.file-btn');
  await page.waitForTimeout(300);
  let st = await stored(page);
  const filed = st.projects.find((p) => p.id === 'pHome').tasks.find((t) => t.title.startsWith('Buy a birthday card'));
  const reminder = st.categories.find((c) => c.name === 'reminder');
  check(`${tag} File puts the thought in Home with its flags`, !!filed && !!reminder && filed.categoryIds.includes('c_chore') && filed.categoryIds.includes(reminder.id), JSON.stringify(filed && filed.categoryIds));
  check(`${tag} the thought leaves the tray`, !st.inbox.some((i) => i.id === 'th1') && (await trayCount(page)) === '3 in the tray', await trayCount(page));
  check(`${tag} a notice says where it went`, ((await page.textContent('body')) || '').includes('Filed to Home.'));
  check(`${tag} the next slip starts clean`, (await slipText(page)).startsWith('Email Ms Patel') && (await flagsOnSlip(page)).length === 0);

  await page.click('[data-action="unsorted-skip"]');
  await page.waitForTimeout(200);
  check(`${tag} Later shows the next slip, the count is unchanged`, (await slipText(page)).startsWith('Old phone charger') && (await trayCount(page)) === '3 in the tray');

  await page.click('[data-action="unsorted-delete"]');
  await page.waitForTimeout(200);
  st = await stored(page);
  check(`${tag} Bin it discards the thought`, !st.inbox.some((i) => i.id === 'th3') && (await trayCount(page)) === '2 in the tray');

  check(`${tag} next is the unlabelled task (Later sent the email to the back)`, (await slipText(page)) === 'Fix the gate latch', await slipText(page));
  check(`${tag} a task slip has no folder wallet and is saved in its project`, !(await page.$('[data-wallet="tray-folders"]')) && (await page.$eval('.file-btn', (b) => b.textContent)) === 'Save in Home →');
  await page.click('.file-btn'); // nothing chosen: to the back
  await page.waitForTimeout(200);
  check(`${tag} Save with no flags sends the task to the back`, (await slipText(page)).startsWith('Email Ms Patel'));
  await page.click('[data-action="unsorted-skip"]');
  await page.waitForTimeout(200);
  await choose(page, 'tray-flags', 'kind:fix', mode);
  check(`${tag} the Fix flag sticks to the task slip`, JSON.stringify(await flagsOnSlip(page)) === '["Fix"]', (await flagsOnSlip(page)).join() + ' facing=' + (await page.$eval('[data-wallet="tray-flags"]', (t) => t.dataset.facing + ' centre=' + (t.querySelector('.sleeve.is-centre') || {}).dataset?.key)));
  await page.$eval('.inbox-card', (e) => { e.scrollIntoView(); window.scrollBy(0, -130); }); // clear of the sticky jotter
  await page.screenshot({ path: OUT + `${scheme}-${mode}-task.png` });
  await page.click('.file-btn');
  await page.waitForTimeout(300);
  st = await stored(page);
  const latch = st.projects.find((p) => p.id === 'pHome').tasks.find((t) => t.id === 'h3');
  const fixLabel = st.categories.find((c) => c.name === 'fix');
  check(`${tag} Save puts the flag on the task (Fix label made on first use)`, !!fixLabel && latch.categoryIds.includes(fixLabel.id), JSON.stringify(latch.categoryIds));

  await page.click('[data-action="unsorted-complete"]');
  await page.waitForTimeout(300);
  st = await stored(page);
  check(`${tag} Already done clears the last thought`, !st.inbox.some((i) => i.id === 'th2'));
  check(`${tag} the empty tray says so`, ((await page.$eval('.inbox-card', (e) => e.textContent)) || '').includes('The tray is empty') && (await trayCount(page)) === '0 in the tray');
  await page.$eval('.inbox-card', (e) => { e.scrollIntoView(); window.scrollBy(0, -130); }); // clear of the sticky jotter
  await page.screenshot({ path: OUT + `${scheme}-${mode}-empty.png` });
  await ctx.close();
}

await browser.close();
server.close();
const failed = results.filter((ok) => !ok).length;
console.log(`\n${results.length - failed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
