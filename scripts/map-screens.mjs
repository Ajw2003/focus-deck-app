// scripts/map-screens.mjs -- the "map every screen" pass for the step-by-step redesign (QA of #248 failed:
// too busy). Opens every screen, panel and dialog with the flow-qa sample data at 390x844 and 1440x900,
// counts what is on screen at once (controls you can press, separate bits of text, colour chips), and
// saves a screenshot of each. Usage: python3 -m http.server 8196 (repo root), then node scripts/map-screens.mjs
// Output: docs/generated/friction-map/*.png and counts.json
import { createRequire } from 'node:module';
import { writeFileSync } from 'node:fs';
const require = createRequire('/opt/node22/lib/node_modules/');
const { chromium } = require('playwright');
const OUT = new URL('../docs/generated/friction-map/', import.meta.url).pathname;
const BASE = 'http://127.0.0.1:8196/';
const b = await chromium.launch();
const rows = [];
const count = (page) => page.evaluate(() => {
  const vis = (e) => { const r = e.getBoundingClientRect(); const s = getComputedStyle(e); return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none' && r.bottom > 0 && r.top < innerHeight; };
  const controls = [...document.querySelectorAll('button, a[href], input:not([type=hidden]), select, textarea, [role=button], [contenteditable=true]')].filter(vis).length;
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  let texts = 0; for (let n; (n = walker.nextNode());) if (n.textContent.trim() && n.parentElement && vis(n.parentElement) && !n.parentElement.closest('button,a,select,option,script,style')) texts++;
  const chips = [...document.querySelectorAll('[class*=chip], [class*=badge], .tr-chip, .pill')].filter(vis).length;
  return { controls, texts, chips };
});
async function shot(page, name, w) { await page.waitForTimeout(400); const c = await count(page); rows.push({ name, width: w, ...c }); await page.screenshot({ path: OUT + name + '-' + w + '.png' }); }
const clickIf = async (page, sel) => { try { const l = page.locator(sel).first(); if (await l.count() && await l.isVisible()) { await l.click({ timeout: 3000 }); return true; } } catch { /* a locked or covered control: that state is not reachable this way */ } return false; };
for (const [w, h] of [[390, 844], [1440, 900]]) {
  const ctx = await b.newContext({ viewport: { width: w, height: h }, serviceWorkers: 'block' });
  const page = await ctx.newPage();
  const go = async (s) => { await page.goto(BASE + 'docs/generated/flow-qa/seed.html#' + s); await page.waitForURL(/app\/index\.html/); await page.waitForSelector('#app *'); await page.waitForTimeout(500); };
  await go('sort'); await shot(page, '01-sort-step1', w);
  if (await clickIf(page, '.sleeve')) { await clickIf(page, '.sleeve[data-facing], .sleeve.is-picked, .sleeve'); await clickIf(page, 'button:has-text("High")'); await shot(page, '02-sort-project-picked', w); }
  if (await clickIf(page, '[data-action="sort-step"][data-step="2"]:not(.locked), [data-action="sort-next"]')) await shot(page, '03-sort-step2-labels', w);
  if (await clickIf(page, '[data-action="sort-step"][data-step="3"]:not(.locked), [data-action="sort-next"]')) await shot(page, '04-sort-step3-links', w);
  await go('sort'); if (await clickIf(page, '[data-action="bulk-toggle"]')) await shot(page, '05-sort-select-many', w);
  await go('tidy'); await shot(page, '06-tidy', w);
  await go('triage'); await shot(page, '07-triage', w);
  await go('roadmap'); await shot(page, '08-roadmap-all', w);
  await go('roadmap'); await clickIf(page, '[data-action="view-mode"][data-mode="area"]'); await shot(page, '09-view-switch-area-list', w);
  await go('roadmap'); await clickIf(page, '[data-action="view-mode"][data-mode="project"]'); await page.waitForTimeout(300);
  await clickIf(page, '[data-action="view-pick"]:has-text("Open source")'); await shot(page, '10-roadmap-project', w);
  if (await clickIf(page, '[data-action="rm-add"][data-kind="task"]')) await shot(page, '11-roadmap-add-task', w);
  await page.keyboard.press('Escape');
  if (await clickIf(page, '[data-action="rm-settings"]')) { await shot(page, '12-milestone-settings', w); await page.keyboard.press('Escape'); }
  if (await clickIf(page, '[data-action="rm-task"], .rm-task-title')) { await shot(page, '13-task-details', w); await page.keyboard.press('Escape'); }
  if (await clickIf(page, 'button:has-text("Edit project")')) { await shot(page, '14-edit-project', w); await page.keyboard.press('Escape'); }
  if (await clickIf(page, 'button:has-text("New project")')) { await shot(page, '15-new-project', w); await page.keyboard.press('Escape'); }
  await go('focus'); await clickIf(page, '[data-action="view-mode"][data-mode="all"]'); await shot(page, '16-focus-pick', w);
  if (await clickIf(page, '[data-action="pick-for-me"]')) await shot(page, '17-focus-task', w);
  await go('review'); await shot(page, '18-review', w);
  await page.goto(BASE + 'app/settings.html'); await page.waitForTimeout(600); await shot(page, '19-settings', w);
  const heads = page.locator('.set-head'); const n = await heads.count(); for (let i = 0; i < n; i++) await heads.nth(i).click().catch(() => {});
  await page.screenshot({ path: OUT + '20-settings-all-open-' + w + '.png', fullPage: true }); rows.push({ name: '20-settings-all-open', width: w, ...(await count(page)), rows: n });
  await ctx.close();
  const fresh = await b.newContext({ viewport: { width: w, height: h }, serviceWorkers: 'block' });
  const fp = await fresh.newPage(); await fp.goto(BASE + 'app/index.html'); await fp.waitForTimeout(800); await shot(fp, '21-onboarding', w); await fresh.close();
}
await b.close();
writeFileSync(OUT + 'counts.json', JSON.stringify(rows, null, 1));
for (const r of rows) console.log(r.width, r.name.padEnd(28), 'controls', String(r.controls).padStart(3), 'text bits', String(r.texts).padStart(3), 'chips', r.chips);
