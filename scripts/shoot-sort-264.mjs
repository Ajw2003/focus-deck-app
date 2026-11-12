// scripts/shoot-sort-264.mjs -- real-Chromium walk through the Sort tab's nine steps at 390x844 (#264).
// Usage: CHROMIUM=/opt/pw-browsers/chromium-1243/chrome-linux64/chrome node scripts/shoot-sort-264.mjs
// Serves the repo root on 127.0.0.1:8264, seeds localStorage, clicks through the whole flow like a thumb
// (project, priority, labels incl. A-Z and a new one, due date incl. another date and the warn page,
// part of, smaller steps, waits on, holds up, the receipt, Save) and screenshots every screen into
// docs/generated/sort-264/ named after the prototype's ids (s0, s0m, s0n, s1 ... s11). Each screen is
// also measured: the page must not scroll (it fits the phone) and no visible text may be under 13px.
import { createRequire } from 'node:module';
import { mkdirSync, readFileSync, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import { join, extname, normalize } from 'node:path';
const require = createRequire('/opt/node22/lib/node_modules/');
const { chromium } = require('playwright');
const ROOT = fileURLToPath(new URL('..', import.meta.url));
const OUT = join(ROOT, 'docs/generated/sort-264/');
mkdirSync(OUT, { recursive: true });
const BASE = 'http://127.0.0.1:8264/app/';
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
await new Promise((ok) => server.listen(8264, '127.0.0.1', ok));

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

await shot('s0');
check('s0: heading, Sort several and the stamp', (await page.textContent('.tray-count')).trim() === '3 to sort' && !!(await page.$('[data-action="bulk-toggle"]')) && (await page.textContent('[data-action="sort-next"]')).trim() === 'Sort this one');
await click('[data-action="sort-menu"]');
await shot('s0m');
check('s0m: the drawer has Add notes, Done already, Later, Delete', JSON.stringify(await page.$$eval('.sort-drawer .dk-choice', (e) => e.map((x) => x.dataset.action))) === '["sort-add-notes","unsorted-complete","unsorted-skip","unsorted-delete"]');
await click('[data-action="sort-add-notes"]');
await page.fill('.slip-notes', 'Ask for three quotes, any day after 5');
await shot('s0n');
await click('[data-action="sort-notes-done"]');
await click('[data-action="sort-next"]');
await shot('s1');
await choose('tray-folders', 'pHome');
check('s1: choosing a folder puts it on the slip', (await page.textContent('.slip-dest')).includes('Going in') && (await page.textContent('.slip-dest')).includes('Home'));
await click('[data-action="sort-next"]');
await shot('s2');
check('s2: Next is off until a priority is picked', await page.$eval('.file-btn', (b) => b.disabled));
await click('.sort-flags [data-level="high"]');
await click('[data-action="sort-next"]');
await shot('s3');
await choose('tray-flags', 'c_repair');
await choose('tray-flags', 'c_call');
check('s3: picked labels hang under the carousel and on the slip', (await page.$$('.sort-picked .dk-tag')).length === 2 && (await page.$$('.slip-flag')).length === 2);
await click('[data-action="sort-azl"]');
await shot('s3a');
await click('[data-action="sort-letter"][data-letter="C"]');
await click('.dk-drawer [data-token="c_call"]'); // take Call off again from the drawer
await click('.sort-foot .dk-btn');
await click('[data-action="sort-new-label"]');
await page.fill('.sort-type', 'Measure');
await shot('s3b');
await click('[data-action="sort-new-flag"]');
check('s3b: the new label is on the slip', (await page.$$eval('.slip-flag', (e) => e.map((x) => x.textContent))).includes('Measure'));
await click('[data-action="sort-next"]');
await shot('s4');
await click('.sort-cal-page[data-value="friday"]');
await click('[data-action="pick-set"][data-value="date"]');
await shot('s4a');
await click('.sort-day >> nth=-1');
await click('[data-action="sort-use-date"]');
await click('[data-action="sort-next"]');
await shot('s4b');
await page.selectOption('[data-warn="yellow"]', { index: 1 });
await page.waitForTimeout(250);
await click('[data-action="sort-next"]');
await shot('s5');
await click('.sort-foot .dk-skip'); // no bigger task for this one (a task that is part of another cannot have steps)

await page.fill('.sort-find', 'Measure the door');
await page.waitForTimeout(250);
await click('[data-action="tie-new-sub"]');
await shot('s6');
await click('[data-action="sort-next"]');
await page.fill('.sort-find', 'tax');
await page.waitForTimeout(250);
await click('[data-action="tie-add"][data-field="waitsOn"]');
await shot('s7');
await click('[data-action="sort-next"]');
await page.fill('.sort-find', 'seeds');
await page.waitForTimeout(250);
await click('[data-action="tie-add"][data-field="holdsUp"]');
await shot('s8');
await click('[data-action="sort-next"]');
await shot('s9');
const receipt = await page.textContent('.sort-receipt');
check('s9: the receipt lists the choices', ['Home', 'High', 'Repair', 'Measure', 'Measure the door', 'Pay council tax', 'Order seeds', 'Ask for three quotes'].every((w) => receipt.includes(w)), receipt.split(/\s+/).join(' ').slice(0, 200));
// a pencil jumps back to its step and Next comes straight back to the receipt
await click('.sort-receipt [data-step="2"]');
check('s9: the priority pencil opens step 2', (await page.textContent('.sort-q')).includes('How important?'));
await click('.sort-flags [data-level="urgent"]');
await click('[data-action="sort-next"]');
check('s9: Next from an edited step goes back to the receipt', (await page.textContent('.sort-q')).includes('All good?') && (await page.textContent('.sort-receipt')).includes('Urgent'));
await click('[data-action="unsorted-file"]');
await shot('s10');
check('s10: a "Filed to Home ✓" slip with Open, and the next thought is on top', (await page.textContent('.toast')).includes('Filed to Home ✓') && !!(await page.$('.toast [data-action="open-added-task"]')) && (await page.textContent('.slip-text')).startsWith('Book the boiler'));
const st = await stored();
const filed = st.projects[0].tasks.find((t) => t.title.startsWith('Get three quotes'));
const sub = st.projects[0].tasks.find((t) => t.title === 'Measure the door');
check('filed: Home, Urgent, labels, due date, notes', !!filed && filed.priority === 'urgent' && filed.categoryIds.length === 2 && !!filed.deadline && filed.notes === 'Ask for three quotes, any day after 5', JSON.stringify(filed && [filed.priority, filed.categoryIds, filed.deadline, filed.dueStages]));
check('filed: warn stages kept', !!filed && !!filed.dueStages && filed.dueStages.yellow.leadHours > filed.dueStages.red.leadHours, JSON.stringify(filed && filed.dueStages));
check('filed: waits on tax, holds up Order seeds, one new subtask', !!filed && !filed.parentId && JSON.stringify(filed.waitsOn) === '["h2"]' && JSON.stringify(st.projects[1].tasks[0].waitsOn) === JSON.stringify([filed.id]) && !!sub && sub.parentId === filed.id);
// part of: a task that is part of another says it cannot have steps of its own
await click('[data-action="sort-next"]');
await choose('tray-folders', 'pHome');
await click('[data-action="sort-next"]');
await click('.sort-flags [data-level="low"]');
await click('[data-action="sort-next"]');
await click('.sort-foot .dk-skip');
await click('.sort-foot .dk-skip');
await click('[data-action="tie-add"][data-field="parent"][data-id="h1"]');
await click('[data-action="sort-next"]');
check('s6: with a bigger task chosen there are no smaller steps to add', (await body()).includes('can’t have smaller steps') && !(await page.$('[data-tie-find]')));
// clear the rest with Done already (the drawer) until nothing is left
for (let i = 0; i < 3; i++) { await click('[data-action="sort-menu"]'); await click('.sort-drawer [data-action="unsorted-complete"]'); }
await shot('s11');
check('s11: All sorted with an Organize card', (await page.textContent('.tray-count')).includes('All sorted ✓') && (await page.textContent('.sortflow [data-action="set-screen"][data-screen="tidy"]')).trim() === 'Organize');
await browser.close();
server.close();
const failed = results.filter((ok) => !ok).length;
console.log(`\n${results.length - failed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
