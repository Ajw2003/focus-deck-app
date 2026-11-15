// scripts/check-cabinet-browser.mjs -- the filing cabinet (docs/4-systems/wallets.md#the-filing-cabinet) in a real
// phone-sized browser: Focus, Sort and the Projects tab each show their projects as files in wooden drawers.
// Run: node scripts/check-cabinet-browser.mjs   (FOCUS_DATA=<a saved copy .json> runs it on real data)
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
const require = createRequire('/opt/node22/lib/node_modules/');
const { chromium } = require('playwright');

const PORT = 8237;
const srv = spawn('python3', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1'], { cwd: new URL('..', import.meta.url).pathname, stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 800));
const now = Date.now();
const task = (id) => ({ id, title: 'Task ' + id, status: 'next', categoryIds: [], createdAt: now });
const sample = {
  projectCategories: [{ id: 'apps', name: 'Apps', color: '#c9584f' }, { id: 'games', name: 'Games', color: '#3d5a80' }],
  projects: [['p1', 'Zebra', 'apps'], ['p2', 'Alpha', 'games'], ['p3', 'Mango', 'apps'], ['p4', 'Loose', null]].map(([id, name, categoryId]) => ({ id, name, color: '#888', categoryId, tasks: [task(id + 'a'), task(id + 'b')] })),
  categories: [], inbox: [{ id: 'i1', text: 'a thought to file', createdAt: now }],
};
const seed = process.env.FOCUS_DATA ? readFileSync(process.env.FOCUS_DATA, 'utf8') : JSON.stringify(sample);
const browser = await chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {});
const checks = {};
try {
  const page = await browser.newPage({ viewport: { width: 390, height: 800 } });
  const errors = []; page.on('pageerror', (e) => errors.push(e.message));
  await page.addInitScript((s) => { if (localStorage.getItem('focusdeck-state-v1')) return; localStorage.setItem('focusdeck-state-v1', s); localStorage.setItem('focusdeck-onboarding', JSON.stringify({ done: true })); localStorage.setItem('focusdeck-screen', 'focus'); }, seed);
  await page.goto('http://127.0.0.1:' + PORT + '/app/');
  await page.waitForSelector('.focus-active'); await page.click('[data-action="focus-choose"]'); // #283: Focus opens on a task; Choose… leads to the questions
  await page.waitForSelector('.cab[data-wallet="projects"]');
  await page.waitForTimeout(400);
  const cab = (w) => '.cab[data-wallet="' + w + '"]';
  // the drawer in view (the cabinet scrolls sideways a whole drawer at a time)
  const current = (w) => page.evaluate((sel) => { const row = document.querySelector(sel + ' .cab-drawers'); return Math.round(row.scrollLeft / row.clientWidth); }, cab(w));
  const tap = async (w, i) => { // the top of a file is its tab, which is never covered by the next file
    const f = page.locator(cab(w) + ' .cab-drawer >> nth=' + (await current(w))).locator('.cab-file').nth(i);
    const key = await f.getAttribute('data-key'); // read first: choosing repaints, and the file is gone
    await f.scrollIntoViewIfNeeded(); await f.click({ position: { x: 40, y: 8 } }); await page.waitForTimeout(450);
    return key;
  };

  // Focus
  const names = await page.$$eval(cab('projects') + ' .cab-drawer:first-child .cab-file .cab-tab b', (bs) => bs.map((b) => b.textContent));
  const rest = names.slice(1);
  checks['Focus: Everything starts with All projects, then every project A to Z'] = names[0] === 'All projects' && rest.join('|') === rest.slice().sort((a, b) => a.localeCompare(b)).join('|');
  // Focus leaves out a project with nothing to do, so the drawers are checked against each other: every file in an
  // area drawer is in Everything, and every project in Everything is in exactly one area drawer
  const st = JSON.parse(seed);
  const byDrawer = await page.$$eval(cab('projects') + ' .cab-drawer', (ds) => ds.map((d) => [...d.querySelectorAll('.cab-file')].map((f) => f.getAttribute('data-key'))));
  const everything = byDrawer[0].slice(1), inAreas = byDrawer.slice(1).flat();
  checks['Focus: each of the ' + everything.length + ' projects in Everything is in exactly one area drawer'] = everything.length > 0 && inAreas.length === everything.length && everything.every((k) => inAreas.includes(k));
  checks['Focus: every area drawer has files, and there is one drawer per area used (' + byDrawer.length + ' drawers)'] = byDrawer.slice(1).every((d) => d.length > 0) && byDrawer.length > 1;
  const drawers = byDrawer;
  const k = await tap('projects', 1);
  checks['Focus: a tap opens a file'] = (await page.getAttribute(cab('projects'), 'data-facing')) !== null && await page.locator(cab('projects') + ' .cab-file.is-centre[data-key="' + k + '"]').count() > 0;
  const before = await page.$eval(cab('projects') + ' .cab-drawer:first-child .cab-file:nth-child(2)', (f) => f.style.transform);
  await page.$eval(cab('projects') + ' .cab-drawer:first-child .cab-files', (f) => { f.scrollTop += 120; });
  await page.waitForTimeout(200);
  const after = await page.$eval(cab('projects') + ' .cab-drawer:first-child .cab-file:nth-child(2)', (f) => f.style.transform);
  checks['Focus: scrolling flicks the files (they tip as you pass them)'] = before !== after && /rotateX/.test(after);
  if (drawers.length > 1) {
    await page.click(cab('projects') + ' .cab-label[data-drawer="1"]'); await page.waitForTimeout(700);
    checks['Focus: a drawer label slides to that drawer'] = (await current('projects')) === 1;
    const x = await page.$eval(cab('projects') + ' .cab-drawers', (r) => r.scrollLeft);
    await page.click(cab('projects') + ' .cab-label[data-drawer="1"]'); await page.waitForTimeout(400);
    checks['Focus: tapping the drawer you are in does not move it'] = (await page.$eval(cab('projects') + ' .cab-drawers', (r) => r.scrollLeft)) === x;
  }
  if (await page.locator(cab('projects') + ' .cab-drawer >> nth=' + (await current('projects'))).locator('.cab-file').first().getAttribute('class').then((c) => !c.includes('is-centre'))) await tap('projects', 0);
  await tap('projects', 0);
  checks['Focus: a second tap on the open file chooses it and asks the kind of work'] = await page.locator('#category-wallet').count() === 1;

  // Sort
  await page.locator('[data-screen="sort"]:visible').first().click(); await page.waitForTimeout(500);
  if (await page.locator('.sort-next, [data-action="sort-next"]').count()) {
    await page.locator('[data-action="sort-next"]').first().click(); await page.waitForTimeout(500);
    const has = await page.locator(cab('tray-folders')).count();
    checks['Sort: Which project? is a cabinet'] = has === 1;
    if (has) {
      const key = await tap('tray-folders', 0); await tap('tray-folders', 0);
      checks['Sort: tapping a file twice puts it on the slip'] = await page.locator(cab('tray-folders') + ' .cab-file.is-picked[data-key="' + key + '"]').count() > 0 && await page.locator('.folder-chip').count() > 0;
    }
  } else checks['Sort: there is a slip to sort'] = false;

  // Projects tab
  await page.evaluate(() => { localStorage.setItem('focusdeck-screen', 'projects'); }); await page.reload(); await page.waitForTimeout(800);
  const pt = await page.locator(cab('projects-tab')).count();
  checks['Projects: the list is a cabinet with progress bars'] = pt === 1 && await page.locator(cab('projects-tab') + ' .cab-bar').count() >= st.projects.length;
  if (pt) {
    const key = await tap('projects-tab', 0); await tap('projects-tab', 0);
    checks['Projects: tapping a file twice opens its Roadmap'] = (await page.evaluate(() => localStorage.getItem('focusdeck-screen'))) === 'roadmap' && (await page.evaluate(() => localStorage.getItem('focusdeck-view') || '')).includes(key);
  }
  checks['no script errors' + (errors.length ? ' (' + errors[0] + ')' : '')] = errors.length === 0;
} finally { await browser.close(); srv.kill(); }
Object.entries(checks).forEach(([k, v]) => console.log((v ? 'PASS ' : 'FAIL ') + k));
process.exit(Object.values(checks).every(Boolean) ? 0 : 1);
