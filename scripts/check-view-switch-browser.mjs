// scripts/check-view-switch-browser.mjs -- real-Chromium check of the view tape and its card-index drawer (#252, #262) at
// 360x780, 390x844 and 1440x900: pick One area=Home on Focus and see only Home on Projects and Sort; reload keeps
// it; One project and Everything work; the drawer lists every area without clipping; the tape is not cut off at 360.
// Usage: CHROMIUM=/opt/pw-browsers/chromium-1243/chrome-linux64/chrome node scripts/check-view-switch-browser.mjs
// Serves the repo root itself on 127.0.0.1:8133. Screenshots: docs/generated/build-checks/step4/.
import { createRequire } from 'node:module';
import { mkdirSync, readFileSync, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import { join, extname, normalize } from 'node:path';
const require = createRequire('/opt/node22/lib/node_modules/');
const { chromium } = require('playwright');
const ROOT = fileURLToPath(new URL('..', import.meta.url));
const OUT = join(ROOT, 'docs/generated/build-checks/step4/');
mkdirSync(OUT, { recursive: true });
const BASE = 'http://127.0.0.1:8133/app/';
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
await new Promise((ok) => server.listen(8133, '127.0.0.1', ok));
let failed = 0, total = 0;
const check = (name, ok, extra = '') => { total++; if (!ok) failed++; console.log((ok ? 'PASS ' : 'FAIL ') + name + (extra ? '  [' + extra + ']' : '')); };
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM, args: ['--no-sandbox'] });

const t = (id, title, extra = {}) => ({ id, title, status: 'next', categoryIds: [], sortOrder: 1, ...extra });
const LONG = 'The very long project name that must truncate with an ellipsis';
const data = {
  projects: [
    { id: 'pShed', name: 'Shed', color: '#3E8E5E', categoryId: 'pcat_home', tasks: [t('t1', 'Paint the shed'), t('t2', 'Fix the door')] },
    { id: 'pGarden', name: 'Garden', color: '#C2731E', categoryId: 'pcat_home', tasks: [t('t3', 'Mow the lawn')] },
    { id: 'pReport', name: 'Report', color: '#4D6FB8', categoryId: 'pcat_work', tasks: [t('t4', 'Write the report')] },
    { id: 'pLoose', name: 'Loose', color: '#888888', tasks: [t('t5', 'Unsorted chore')] },
    { id: 'pLong', name: LONG, color: '#B3402F', categoryId: 'pcat_work', tasks: [t('t6', 'Long thing')] },
  ],
  inbox: [{ id: 'i1', text: 'A stray thought', createdAt: 1 }], completedLog: [], deletedTaskIds: {}, choosingMode: { mode: 'twice', updatedAt: 1 },
  categories: [], projectCategories: [],
};
const HOME = ['Paint the shed', 'Fix the door', 'Mow the lawn'];
const sizes = [['360', 360, 780], ['390', 390, 844], ['desk', 1440, 900]];
const screen = async (page, name) => { await page.click(`[data-action="set-screen"][data-screen="${name}"]`); await page.waitForSelector('.vs-row'); };
const rmNames = (page) => page.$$eval('.rm-row .rm-proj-name', (els) => els.map((e) => e.textContent));
const rmTaskTitles = (page) => page.$$eval('.rm-project .rm-task-title', (els) => els.map((e) => e.textContent));
const folderKeys = (page) => page.$$eval('[data-wallet="tray-folders"] .sleeve', (els) => els.map((e) => e.dataset.key));
const wallet = (page) => page.$$eval('[data-wallet="projects"] .sleeve', (els) => els.map((e) => e.dataset.key));
const pickBtn = (page) => page.$eval('.vs-tape', (b) => b.textContent.replace(/\s+/g, ' ').trim());
const openList = async (page, step) => { await page.click('.vs-tape'); await page.click(`[data-action="view-step"][data-step="${step}"]`); await page.waitForSelector('.vs-pop .vs-item'); };

for (const [tag, w, h] of sizes) {
  const phone = w < 600;
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, serviceWorkers: 'block' });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => check(`[${tag}] no page error: ` + e.message, false));
  await page.addInitScript(([k, v]) => { if (localStorage.getItem(k) === null) localStorage.setItem(k, v); }, [STATE_KEY, JSON.stringify(data)]);
  await page.goto(BASE + 'index.html');
  await page.waitForSelector('.vs-row');
  check(`[${tag}] Focus: one tape saying Everything, no All | Area | Project switch`, (await pickBtn(page)) === 'Everything ▾' && !(await page.$('.vs-seg, .vs-segs')));
  await page.click('.vs-tape');
  check(`[${tag}] the drawer holds Everything, One area ›, One project ›`, (await page.$$eval('.vs-pop .dk-choice', (b) => b.map((x) => x.textContent.trim()).join('|'))) === 'Everything|One area ›|One project ›');
  await page.keyboard.press('Escape');
  const allKeys = await wallet(page);
  check(`[${tag}] Focus on All offers every project`, ['pShed', 'pGarden', 'pReport', 'pLoose', 'pLong'].every((k) => allKeys.includes(k)), allKeys.join());

  // Area = Home
  await openList(page, 'area');
  const items = await page.$$eval('.vs-pop .vs-item', (els) => els.map((e) => e.textContent.trim()));
  check(`[${tag}] the list has every area incl. Unsorted`, items.join('|') === 'Personal|Lists|Home|Apps|Games|Work|School|Unsorted', items.join('|'));
  check(`[${tag}] each area has a colour dot`, (await page.$$('.vs-pop .vs-item .vs-dot')).length === 8);
  {
    const r = await page.$eval('.vs-pop', (e) => { const b = e.getBoundingClientRect(); return { top: b.top, bottom: b.bottom, left: b.left, right: b.right }; });
    const inside = await page.$$eval('.vs-pop .vs-item', (els) => els.every((e) => { const b = e.getBoundingClientRect(); return b.top >= 0 && b.bottom <= innerHeight && b.left >= 0 && b.right <= innerWidth; }));
    check(`[${tag}] the drawer is a bottom sheet, flush to the bottom, inside the screen, nothing clipped`, Math.abs(r.bottom - h) < 1 && r.left >= 0 && r.right <= w && r.top > 0 && inside, JSON.stringify(r));
    await page.screenshot({ path: OUT + `${tag}-sheet-areas.png` });
  }
  check(`[${tag}] focus starts inside the list`, await page.evaluate(() => document.querySelector('.vs-pop').contains(document.activeElement)));
  for (let i = 0; i < 14; i++) await page.keyboard.press('Tab');
  check(`[${tag}] Tab stays inside the list`, await page.evaluate(() => document.querySelector('.vs-pop').contains(document.activeElement)));
  await page.keyboard.press('Escape');
  check(`[${tag}] Escape closes it and focus returns to the tape`, !(await page.$('.vs-pop')) && (await page.evaluate(() => document.activeElement.classList.contains('vs-tape'))));
  await page.click('.vs-tape');
  await page.click('.vs-backdrop', { position: { x: 5, y: 5 }, force: true });
  check(`[${tag}] the backdrop closes it`, !(await page.$('.vs-pop')));
  await openList(page, 'area');
  await page.click('.vs-item[data-id="pcat_home"]');
  check(`[${tag}] picking Home closes the list; the tape says Home ▾`, !(await page.$('.vs-pop')) && (await pickBtn(page)) === 'Home ▾', await pickBtn(page));

  // Focus only offers Home
  const keys = await wallet(page);
  check(`[${tag}] Focus: only Home's projects`, keys.sort().join() === ['all', 'pGarden', 'pShed'].sort().join(), keys.join());
  await page.screenshot({ path: OUT + `${tag}-focus-home.png` });
  // Projects tab (the group view)
  await screen(page, 'projects');
  const names = (await rmNames(page)).sort().join();
  check(`[${tag}] Projects: only Home projects`, names === 'Garden,Shed', names);
  await page.screenshot({ path: OUT + `${tag}-roadmap-home.png` });
  // Sort
  await screen(page, 'sort');
  const fk = await folderKeys(page);
  check(`[${tag}] Sort: only Home's projects offered, the thought is still there`, fk.sort().join() === 'pGarden,pShed' && (await page.textContent('.inbox-card')).includes('A stray thought'), fk.join());
  await page.screenshot({ path: OUT + `${tag}-sort-home.png` });

  // reload keeps it
  await page.reload();
  await page.waitForSelector('.vs-row');
  check(`[${tag}] reload: still Home on the Sort screen`, (await pickBtn(page)) === 'Home ▾');
  await screen(page, 'projects');
  check(`[${tag}] reload: Projects still only Home`, (await rmNames(page)).length === 2);

  // Project
  await openList(page, 'project');
  const grouped = await page.$$eval('.vs-pop .vs-group', (els) => els.map((e) => e.textContent));
  check(`[${tag}] project list is grouped by area`, grouped.join() === 'Home,Work,Unsorted', grouped.join());
  await page.click('.vs-item[data-id="pReport"]');
  await screen(page, 'roadmap');
  check(`[${tag}] Project=Report: Roadmap shows only its task`, (await rmTaskTitles(page)).join() === 'Write the report', (await rmTaskTitles(page)).join());
  await screen(page, 'focus');
  const k2 = await wallet(page);
  check(`[${tag}] Project=Report: Focus offers only it`, k2.sort().join() === 'all,pReport', k2.join());

  // long name: not cut off
  await openList(page, 'project');
  await page.click('.vs-item[data-id="pLong"]');
  const geo = await page.evaluate(() => { const row = document.querySelector('.vs-row').getBoundingClientRect(); const b = document.querySelector('.vs-tape'); const n = document.querySelector('.vs-pick-name'); const r = b.getBoundingClientRect(); return { right: r.right, vw: innerWidth, rowRight: row.right, over: n.scrollWidth > n.clientWidth, ell: getComputedStyle(n).textOverflow, h: r.height, docW: document.documentElement.scrollWidth }; });
  check(`[${tag}] long project name: one line, ellipsis, inside the screen, no sideways scroll`, geo.right <= geo.vw && geo.rowRight <= geo.vw && geo.ell === 'ellipsis' && geo.h < 60 && geo.docW <= geo.vw && (!phone || geo.over), JSON.stringify(geo));
  await page.screenshot({ path: OUT + `${tag}-long-name.png` });
  if (phone) {
    await openList(page, 'project');
    await page.screenshot({ path: OUT + `${tag}-sheet-projects.png` });
    await page.keyboard.press('Escape');
  }

  // All
  await page.click('.vs-tape');
  await page.click('.vs-pop .dk-choice[data-mode="all"]');
  check(`[${tag}] Everything: the tape says so`, (await pickBtn(page)) === 'Everything ▾');
  await screen(page, 'projects');
  check(`[${tag}] Everything: Projects shows every project`, (await rmNames(page)).length === 5, (await rmNames(page)).join());
  await screen(page, 'sort');
  check(`[${tag}] All: Sort offers every project`, (await folderKeys(page)).length === 5);
  // Unsorted area
  await openList(page, 'area');
  await page.click('.vs-item[data-id="pcat_unsorted"]');
  await screen(page, 'projects');
  check(`[${tag}] Area=Unsorted: the project with no area`, (await rmNames(page)).join() === 'Loose', (await rmNames(page)).join());
  await ctx.close();
}
await browser.close();
server.close();
console.log(failed ? `\n${failed} of ${total} checks FAILED` : `\nall ${total} checks passed`);
process.exit(failed ? 1 : 0);
