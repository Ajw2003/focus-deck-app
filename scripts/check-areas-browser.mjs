// scripts/check-areas-browser.mjs -- real-Chromium check of Areas and Kinds of work (#251) at 390x844 and
// 1440x900: a fresh user sees the eight default areas; an existing user's Learning area survives the
// migration; rename, add, move a project and delete (to Unsorted) work in Settings; unticking a kind of
// work removes it from Focus's kinds row, and a label mapped to Urgent shows as Urgent on a task.
// Usage: CHROMIUM=/opt/pw-browsers/chromium-1243/chrome-linux/chrome node scripts/check-areas-browser.mjs
// Serves the repo root itself on 127.0.0.1:8132. Screenshots: docs/generated/build-checks/step3/.
import { createRequire } from 'node:module';
import { mkdirSync, readFileSync, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import { join, extname, normalize } from 'node:path';
const require = createRequire('/opt/node22/lib/node_modules/');
const { chromium } = require('playwright');
const ROOT = fileURLToPath(new URL('..', import.meta.url));
const OUT = join(ROOT, 'docs/generated/build-checks/step3/');
mkdirSync(OUT, { recursive: true });
const BASE = 'http://127.0.0.1:8132/app/';
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
await new Promise((ok) => server.listen(8132, '127.0.0.1', ok));
let failed = 0, total = 0;
const check = (name, ok, extra = '') => { total++; if (!ok) failed++; console.log((ok ? 'PASS ' : 'FAIL ') + name + (extra ? '  [' + extra + ']' : '')); };
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM, args: ['--no-sandbox'] });

const t = (id, title, cats, extra = {}) => ({ id, title, status: 'next', categoryIds: cats, sortOrder: 1, ...extra });
const existing = {
  projects: [
    { id: 'pEssay', name: 'Essay', color: '#C2731E', categoryId: 'pcat_learning', tasks: [t('t1', 'Draft intro', ['c_chore']), t('t2', 'Fix typo', ['c_bug'])] },
    { id: 'pShed', name: 'Shed', color: '#3E8E5E', tasks: [t('t3', 'Paint', ['c_asap'])] },
  ],
  inbox: [], completedLog: [], deletedTaskIds: {}, choosingMode: { mode: 'twice', updatedAt: 1 },
  categories: [{ id: 'c_chore', name: 'Chore', color: '#3E8E5E' }, { id: 'c_bug', name: 'Bug', color: '#B3402F' }, { id: 'c_asap', name: 'Asap', color: '#C2731E' }, { id: 'c_wip', name: 'wip', color: '#888888' }],
  projectCategories: [{ id: 'pcat_work', name: 'Work', color: '#4D6FB8' }, { id: 'pcat_personal', name: 'Personal', color: '#3E8E5E' }, { id: 'pcat_learning', name: 'Learning', color: '#C2731E' }],
};
const stored = (page) => page.evaluate((k) => JSON.parse(localStorage.getItem(k)), STATE_KEY);
const openRow = async (page, sel) => { const row = page.locator('.set', { has: page.locator(sel) }); if (!(await row.evaluate((e) => e.classList.contains('open')))) await row.locator('.set-head').click(); };
async function session(size, storage) {
  const ctx = await browser.newContext({ viewport: size === 'phone' ? { width: 390, height: 844 } : { width: 1440, height: 900 }, serviceWorkers: 'block' });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => check(`[${size}] no page error: ` + e.message, false));
  page.on('dialog', (d) => d.accept());
  if (storage) await page.addInitScript(([k, v]) => { if (localStorage.getItem(k) === null) localStorage.setItem(k, v); }, [STATE_KEY, JSON.stringify(storage)]);
  return { ctx, page };
}
const areaNames = (page) => page.$$eval('#proj-cat-list .area-row .area-name', (els) => els.map((e) => e.textContent));

for (const size of ['phone', 'desktop']) {
  const tag = `[${size}]`;
  // 1. A fresh user
  {
    const { ctx, page } = await session(size);
    await page.goto(BASE + 'settings.html');
    await openRow(page, '#proj-cat-list');
    const names = await areaNames(page);
    check(`${tag} fresh user: the eight default areas`, names.join('|') === 'Personal|Lists|Home|Apps|Games|Work|School|Unsorted', names.join('|'));
    const sw = await page.$$eval('#proj-cat-list .area-swatch', (els) => new Set(els.map((e) => getComputedStyle(e).backgroundColor)).size);
    check(`${tag} fresh user: each area has its own colour`, sw === 8, String(sw));
    check(`${tag} fresh user: Unsorted has no delete button`, (await page.$$('#proj-cat-list .area-row[data-id="pcat_unsorted"] .cat-remove-btn')).length === 0);
    check(`${tag} no sideways scroll`, (await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)) <= 0);
    await page.$eval('#areas-section', (e) => e.scrollIntoView());
    await page.screenshot({ path: OUT + `${size}-areas-fresh.png`, fullPage: size === 'phone' });
    await ctx.close();
  }
  // 2. An existing user
  {
    const { ctx, page } = await session(size, existing);
    await page.goto(BASE + 'settings.html');
    await openRow(page, '#proj-cat-list');
    const names = await areaNames(page);
    check(`${tag} existing user: Learning survives and the missing defaults are added`, names.includes('Learning') && ['Lists', 'Home', 'Apps', 'Games', 'School', 'Unsorted'].every((n) => names.includes(n)) && names.filter((n) => n === 'Work').length === 1, names.join('|'));
    await page.click('#proj-cat-list [data-pick="pcat_learning"]');
    check(`${tag} Learning lists its project`, (await page.textContent('#area-projects')).includes('Essay'));
    await page.click('#proj-cat-list [data-edit="pcat_learning"]');
    await page.fill('.area-name-input', 'Study');
    await page.click('#proj-cat-list [data-edit="pcat_learning"]');
    check(`${tag} rename: Learning becomes Study, id kept`, (await stored(page)).projectCategories.some((c) => c.id === 'pcat_learning' && c.name === 'Study'));
    await page.fill('#add-proj-cat-form input[name="name"]', 'Garden');
    await page.press('#add-proj-cat-form input[name="name"]', 'Enter');
    let st = await stored(page);
    const garden = st.projectCategories.find((c) => c.name === 'Garden');
    check(`${tag} add: Garden exists`, !!garden);
    await page.click('#proj-cat-list [data-pick="pcat_learning"]');
    await page.selectOption('#area-projects [data-move]', garden.id);
    st = await stored(page);
    check(`${tag} move: Essay is now in Garden (one area)`, st.projects.find((p) => p.id === 'pEssay').categoryId === garden.id);
    await page.click(`#proj-cat-list [data-pick="${garden.id}"]`);
    check(`${tag} move: Garden lists Essay and counts 1 project`, (await page.textContent('#area-projects')).includes('Essay') && (await page.textContent(`#proj-cat-list [data-id="${garden.id}"]`)).includes('1 project'));
    await page.$eval('#areas-section', (e) => e.scrollIntoView());
    await page.screenshot({ path: OUT + `${size}-areas-existing.png`, fullPage: size === 'phone' });
    await page.click(`#proj-cat-list .area-row[data-id="${garden.id}"] .cat-remove-btn`); // the confirm is auto-accepted
    st = await stored(page);
    check(`${tag} delete: Garden gone, Essay in Unsorted`, !st.projectCategories.some((c) => c.id === garden.id) && !st.projects.find((p) => p.id === 'pEssay').categoryId);
    await openRow(page, '#task-cat-list');
    const ticks = await page.$$eval('#task-cat-list [data-kind]', (els) => els.map((e) => e.dataset.kind + ':' + e.checked));
    check(`${tag} kinds: workflow label wip starts unticked, Chore ticked`, ticks.includes('c_wip:false') && ticks.includes('c_chore:true'), ticks.join());
    await page.selectOption('[data-prio="c_asap"]', 'urgent');
    await page.uncheck('[data-kind="c_chore"]');
    st = await stored(page);
    check(`${tag} kinds: unticking and mapping are stored`, st.categories.find((c) => c.id === 'c_chore').kind === false && st.categories.find((c) => c.id === 'c_asap').priority === 'urgent');
    await page.$eval('#kinds-section', (e) => e.scrollIntoView());
    await page.screenshot({ path: OUT + `${size}-kinds.png`, fullPage: size === 'phone' });
    await page.goto(BASE + 'index.html');
    await page.click('[data-action="set-screen"][data-screen="focus"]');
    await page.click('[data-action="focus-next"]'); // Focus's second question, "What kind of work?", holds the kinds strip
    await page.waitForSelector('[data-wallet="categories"] .sleeve', { state: 'attached' });
    const keys = await page.$$eval('[data-wallet="categories"] .sleeve', (els) => els.map((e) => e.dataset.key));
    check(`${tag} Focus kinds row: Chore (unticked) is gone, Bug stays`, !keys.includes('c_chore') && keys.includes('c_bug'), keys.join());
    check(`${tag} Focus: the unticked-only-label task is not lost (Unlabelled card)`, keys.includes('__none__'), keys.join());
    // Asap is mapped to Urgent above: its task (Paint, no priority of its own) shows the Urgent chip
    // the Roadmap's project view, then Task details, which shows the priority (the old Projects task row's chip)
    await page.evaluate(() => localStorage.setItem('focusdeck-view', JSON.stringify({ mode: 'project', id: 'pShed' })));
    await page.reload();
    await page.click('[data-action="set-screen"][data-screen="roadmap"]');
    await page.waitForSelector('.rm-task', { state: 'attached' });
    await page.evaluate(() => [...document.querySelectorAll('.rm-task-title')].find((b) => b.textContent.includes('Paint')).click());
    await page.click('.sort-drawer [data-action="rm-details"]'); // a Roadmap title opens its drawer (#268); Details is a card in it
    await page.waitForSelector('.cw-detail .sort-q');
    const urgent = [await page.textContent('.rm-detail')];
    check(`${tag} a task labelled Asap (mapped to Urgent) shows Urgent in Task details`, urgent.every((x) => x.includes('Urgent')), JSON.stringify(urgent).slice(0, 200));
    await page.screenshot({ path: OUT + `${size}-focus.png` });
    await ctx.close();
  }
}
await browser.close();
server.close();
console.log(`\n${total - failed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
