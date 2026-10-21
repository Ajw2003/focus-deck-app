// #203 browser check: settings page closed/open at 1440 and 390, Comfort values, and a past-its-date
// task on the Board in both overdue modes. Usage: node 203-check.mjs <port>  (server on the repo root)
import { createRequire } from 'node:module';
const require = createRequire('/opt/node22/lib/node_modules/');
const { chromium } = require('playwright');
const port = process.argv[2];
const OUT = new URL('.', import.meta.url).pathname;
const base = `http://localhost:${port}`;
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] });
const errors = [];
let bad = 0;
for (const [w, h] of [[1440, 900], [390, 844]]) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, serviceWorkers: 'block' });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(w + ' pageerror ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/fonts\.g|ERR_|Failed to load resource/.test(m.text())) errors.push(w + ' console ' + m.text()); });
  await page.goto(`${base}/docs/generated/sort-steps/seed.html#board?ties`);
  await page.waitForURL(/app\/index\.html/);
  await page.waitForTimeout(800);
  // make one open task past its date
  await page.evaluate(() => {
    const k = 'focusdeck-state-v1'; const s = JSON.parse(localStorage.getItem(k));
    const t = s.projects.flatMap((p) => p.tasks).find((x) => x.status !== 'done' && !x.parentId);
    t.deadline = new Date(Date.now() - 2 * 864e5).toISOString().slice(0, 10); t.dueSetAt = Date.now() - 30 * 864e5; t.title = 'Renew passport (past its date)';
    localStorage.setItem(k, JSON.stringify(s));
  });
  for (const mode of ['amber', 'red']) {
    await page.evaluate((m) => { const k = 'focusdeck-state-v1'; const s = JSON.parse(localStorage.getItem(k)); s.comfort = Object.assign(s.comfort || {}, { overdue: { value: m, updatedAt: Date.now() } }); localStorage.setItem(k, JSON.stringify(s)); }, mode);
    await page.goto(`${base}/app/index.html`); await page.reload(); await page.waitForTimeout(800); await page.click(".rail-item[data-screen=projects]"); await page.waitForTimeout(500); await page.evaluate(() => { document.querySelectorAll("[data-action=toggle-collapse],[aria-expanded=false]").forEach((b) => b.click()); });  await page.waitForTimeout(300);
    const chip = await page.$$eval('.deadline-chip', (els) => els.map((e) => e.className + ' | ' + e.textContent).filter((t) => /past|overdue/.test(t)));
    console.log(w, mode, 'chips:', JSON.stringify(chip));
    if (!chip.length) bad++;
    await page.locator(".deadline-chip.due-amber, .deadline-chip.due-red").first().scrollIntoViewIfNeeded(); await page.waitForTimeout(300); await page.screenshot({ path: `${OUT}203-projects-${mode}-${w}.png` });
  }
  await page.goto(`${base}/app/settings.html`); await page.waitForTimeout(600);
  const over = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
  console.log(w, 'settings overflow', over, 'rows', await page.$$eval('.set', (e) => e.length));
  if (over > 0) bad++;
  await page.screenshot({ path: `${OUT}203-settings-closed-${w}.png`, fullPage: true });
  await page.click('#comfort-cardcolour-section .set-head'); await page.waitForTimeout(200);
  await page.click('#comfort-overdue-section .set-head'); await page.waitForTimeout(200);
  console.log(w, 'open rows after opening two:', await page.$$eval('.set.open', (e) => e.length));
  await page.click('#comfort-cardcolour-section .set-head'); await page.waitForTimeout(200);
  console.log(w, 'card colour row open:', await page.$$eval('#comfort-cardcolour-section.open', (e) => e.length));
  await page.screenshot({ path: `${OUT}203-settings-cardcolour-${w}.png`, fullPage: true });
  const over2 = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
  if (over2 > 0) bad++;
  // movement off and softer colours really reach the body, on both pages
  await page.click('#comfort-motion-section .set-head'); await page.check('#comfort-motion input[value="off"]');
  console.log(w, 'settings body class:', await page.evaluate(() => document.body.className));
  await page.goto(`${base}/app/index.html#board`); await page.waitForTimeout(600);
  console.log(w, 'board body class:', await page.evaluate(() => document.body.className));
  await ctx.close();
}
await browser.close();
console.log('errors:', JSON.stringify(errors));
process.exit(errors.length || bad ? 1 : 0);
