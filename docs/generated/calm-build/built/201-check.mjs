// #201 Task details check: node 201-check.mjs <port>  (server on the repo root). Real Chromium, sample data.
import { createRequire } from 'node:module';
const require = createRequire('/opt/node22/lib/node_modules/');
const { chromium } = require('playwright');
const port = process.argv[2];
const OUT = new URL('.', import.meta.url).pathname;
const URL_ = 'http://localhost:' + port + '/docs/generated/sort-steps/seed.html#board?ties';
const browser = await chromium.launch();
const errors = [];
let fails = 0;
const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
async function boot(width, height) {
  const ctx = await browser.newContext({ viewport: { width, height } });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(width + ' pageerror ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(width + ' console ' + m.text()); });
  page.on('dialog', (d) => d.accept());
  await page.goto(URL_);
  await page.waitForSelector('.calm-card');
  return { ctx, page };
}
async function selectBoiler(page) {
  for (const tab of ['next', 'doing', 'done']) {
    await page.click('[data-col="' + tab + '"]');
    const c = page.locator('.calm-card', { hasText: 'Book boiler service' });
    if (await c.count()) { await c.first().locator('.board-card-title').click(); return; }
  }
  throw new Error('no boiler card');
}
const noScroll = (page) => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth);

// ---- 1440
{
  const { ctx, page } = await boot(1440, 900);
  await selectBoiler(page);
  ok((await page.locator('.cw-detail .cw-name').textContent()) === 'Task details', 'panel headed Task details');
  ok(await page.locator('.cw-detail h3').innerText() === 'Book boiler service', 'title shown');
  await page.screenshot({ path: OUT + '201-details-closed-1440.png' });
  await page.click('[data-key="subtasks"]');
  ok(await page.locator('.cw-detail .set.open').count() === 1, 'one row open');
  await page.click('[data-key="notes"]');
  ok(await page.locator('.cw-detail .set.open').count() === 1 && await page.locator('#fold-task-notes').count() === 1, 'opening another closes the first');
  await page.click('[data-key="subtasks"]');
  await page.screenshot({ path: OUT + '201-subtasks-open-1440.png' });
  // title
  await page.click('.cw-detail h3');
  await page.keyboard.press('End');
  await page.keyboard.type(' (annual)');
  await page.keyboard.press('Enter');
  ok((await page.locator('.cw-detail h3').innerText()) === 'Book boiler service (annual)', 'title edit kept');
  // status
  await page.selectOption('[data-detail-status]', 'next');
  ok((await page.locator('[data-detail-status]').inputValue()) === 'next', 'status changed');
  // notes
  await page.click('[data-key="notes"]');
  await page.fill('[data-detail-notes]', 'Ring Mon\nsecond');
  ok((await page.locator('[data-summary="notes"]').innerText()) === 'Ring Mon…', 'notes summary live');
  await page.locator('[data-detail-notes]').blur();
  ok((await page.locator('[data-summary="notes"]').innerText()) === 'Ring Mon…', 'notes summary after save');
  // priority + due
  await page.click('[data-key="when"]');
  await page.selectOption('[data-detail-priority]', 'high');
  const d = new Date(Date.now() + 2 * 864e5); const iso = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  await page.fill('[data-detail-due]', iso);
  ok((await page.locator('[data-summary="when"]').innerText()) === 'High priority · Due in 2 days', 'when summary: ' + await page.locator('[data-summary="when"]').innerText());
  // labels: add two via picker then Make category
  await page.click('[data-key="labels"]');
  await page.locator('.detail-labels summary').click();
  const boxes = page.locator('.detail-labels .label-option:not(.is-extra)');
  await boxes.nth(0).locator('span').first().click();
  await boxes.nth(1).locator('span').first().click();
  const sum = await page.locator('[data-summary="labels"]').innerText();
  ok(sum.includes(','), 'two labels: ' + sum);
  const second = sum.split(', ')[1];
  await page.locator('[data-action="detail-make-cat"]').first().click();
  ok((await page.locator('[data-summary="labels"]').innerText()).startsWith(second), 'Make category moves it first');
  // subtasks
  await page.click('[data-key="subtasks"]');
  await page.click('[data-action="detail-add-sub-open"]');
  await page.fill('[data-detail-newsub]', 'Get quotes');
  await page.keyboard.press('Enter');
  ok(/^0 of \d+ done$/.test(await page.locator('[data-summary="subtasks"]').innerText()) && await page.locator('.bm-sub', { hasText: 'Get quotes' }).count() === 1, 'subtask added: ' + await page.locator('[data-summary="subtasks"]').innerText());
  await page.locator('.bm-sub', { hasText: 'Get quotes' }).locator('input').check();
  ok(/^1 of \d+ done$/.test(await page.locator('[data-summary="subtasks"]').innerText()), 'subtask ticked: ' + await page.locator('[data-summary="subtasks"]').innerText());
  await page.screenshot({ path: OUT + '201-details-saved-1440.png' });
  ok(await noScroll(page), 'no sideways scroll 1440');
  // reload survives
  await page.reload();
  await page.waitForSelector('.calm-card');
  const sv = await page.evaluate(() => JSON.stringify(JSON.parse(localStorage.getItem(Object.keys(localStorage).find((k) => /focus/i.test(k) && localStorage.getItem(k).includes('Get quotes')) || '')).projects.flatMap((p) => p.tasks).filter((t) => /boiler|Get quotes/.test(t.title)).map((t) => [t.title, t.status, t.priority, t.deadline, t.notes, (t.categoryIds || []).join('+'), !!t.parentId])));
  console.log(sv);
  ok(sv.includes('(annual)') && sv.includes('"high"') && sv.includes('Ring Mon') && sv.includes('Get quotes'), 'saved in storage after reload');
  // deselect three ways
  await page.click('[data-col="next"]');
  await page.locator('.calm-card', { hasText: 'boiler' }).first().locator('.board-card-title').click();
  ok(await page.locator('.cw-detail .cw-name').count() === 1, 'reselect after reload');
  await page.locator('.calm-card.on .board-card-title').click();
  ok((await page.locator('.cw-detail .cw-name').count()) === 0 && (await page.locator('.cw-detail').innerText()).includes('No task selected'), 'second click deselects');
  await page.locator('.calm-card').first().locator('.board-card-title').click();
  await page.keyboard.press('Escape');
  ok((await page.locator('.cw-detail .cw-name').count()) === 0, 'Escape deselects');
  await page.locator('.calm-card').first().locator('.board-card-title').click();
  await page.click('[data-action="detail-close"]');
  ok((await page.locator('.cw-detail .cw-name').count()) === 0, 'Close deselects');
  await ctx.close();
}
// ---- 390
{
  const { ctx, page } = await boot(390, 844);
  await selectBoiler(page);
  const box = await page.locator('.cw-detail').boundingBox();
  ok(box && box.width >= 389 && box.height >= 843, 'panel is full screen on a phone ' + JSON.stringify(box));
  await page.click('[data-key="subtasks"]');
  await page.screenshot({ path: OUT + '201-subtasks-open-390.png' });
  ok(await noScroll(page), 'no sideways scroll 390');
  await page.click('[data-action="detail-close"]');
  ok(await page.locator('.cw-detail:visible').count() === 0, 'Close goes back to the list');
  await page.screenshot({ path: OUT + '201-closed-390.png' });
  await ctx.close();
}
console.log('errors: ' + (errors.length ? '\n' + errors.join('\n') : 'none'));
await browser.close();
process.exit(fails || errors.length ? 1 : 0);
