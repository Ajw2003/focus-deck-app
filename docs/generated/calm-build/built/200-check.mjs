// Browser check for #200 (calm Board): node docs/generated/calm-build/built/200-check.mjs <port>
import { createRequire } from 'node:module';
const require = createRequire('/opt/node22/lib/node_modules/');
const { chromium } = require('playwright');
const port = process.argv[2] || '8247';
const SEED = 'http://localhost:' + port + '/docs/generated/sort-steps/seed.html#board?ties';
const OUT = new URL('./', import.meta.url).pathname;
const browser = await chromium.launch();
let bad = 0;
const check = (ok, name) => { console.log((ok ? 'PASS ' : 'FAIL ') + name); if (!ok) bad++; };
for (const [w, h] of [[1440, 900], [390, 844]]) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, serviceWorkers: 'block' });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
  await page.goto(SEED);
  await page.waitForSelector('.calm-tabs');
  const tag = w + ': ';
  check(await page.$$eval('.calm-card.on', (e) => e.length) === 0, tag + 'nothing selected at open');
  const n = await page.$$eval('.calm-card', (e) => e.length);
  console.log(tag + 'cards shown ' + n, await page.$$eval('.calm-tab', (e) => e.map((x) => x.textContent.trim())));
  await page.screenshot({ path: OUT + '200-board-' + w + '.png' });
  // select / deselect
  await page.click('.calm-card .board-card-title');
  check(await page.$$eval('.calm-card.on', (e) => e.length) === 1, tag + 'click selects');
  await page.click('.calm-card.on .board-card-title');
  check(await page.$$eval('.calm-card.on', (e) => e.length) === 0, tag + 'click again deselects');
  await page.click('.calm-card .board-card-title');
  await page.keyboard.press('Escape');
  check(await page.$$eval('.calm-card.on', (e) => e.length) === 0, tag + 'Escape deselects');
  // move
  const first = await page.$eval('.calm-card[data-status="next"]', (e) => e.dataset.taskId);
  await page.click('.calm-card[data-task-id="' + first + '"] .calm-move');
  await page.waitForTimeout(200);
  check(await page.$('.calm-card[data-task-id="' + first + '"]') === null, tag + 'moved card leaves Up next');
  await page.reload(); await page.waitForSelector('.calm-tabs');
  await page.click('.calm-tab[data-col="doing"]');
  check(await page.$('.calm-card[data-task-id="' + first + '"][data-status="doing"]') !== null, tag + 'moved task is in In progress after reload');
  await page.click('.calm-card[data-task-id="' + first + '"] .calm-move');
  await page.click('.calm-tab[data-col="next"]');
  // find / project / filter
  const all = await page.$$eval('.calm-card', (e) => e.length);
  await page.fill('.board-find', 'zzzz');
  check(await page.$$eval('.calm-card', (e) => e.length) === 0, tag + 'Find narrows');
  await page.fill('.board-find', '');
  const opts = await page.$$eval('select[data-action="board-project-select"] option', (e) => e.map((x) => x.value));
  await page.selectOption('select[data-action="board-project-select"]', opts[1]);
  check(await page.$$eval('.board-card-proj', (e) => e.length) === 0, tag + 'project name hidden on one project');
  await page.selectOption('select[data-action="board-project-select"]', '');
  check(await page.$$eval('.board-card-proj', (e) => e.length) > 0, tag + 'project name shown on All');
  await page.click('[data-action="board-filter"]');
  await page.click('[data-action="board-show"][data-show="subs"]');
  const subs = await page.$$eval('.calm-card', (e) => e.length);
  check(subs < all, tag + 'Filter > Has subtasks narrows ' + all + ' -> ' + subs);
  await page.screenshot({ path: OUT + '200-filter-' + w + '.png' });
  check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), tag + 'no sideways scroll');
  check(errs.length === 0, tag + 'no errors ' + errs.join(' | '));
  await ctx.close();
}
await browser.close();
process.exit(bad ? 1 : 0);
