// #202: reorder Card colour in Settings, reload, and read the Board's chips. Usage: node <this> <port>
import { createRequire } from 'node:module';
const require = createRequire('/opt/node22/lib/node_modules/');
const { chromium } = require('playwright');
const port = process.argv[2]; const errs = [];
const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
p.on('pageerror', (e) => errs.push(e.message));
const chips = () => p.$$eval('.board-card', (cs) => cs.slice(0, 4).map((c) => (c.querySelector('.cchip') || {}).textContent));
await p.goto(`http://localhost:${port}/docs/generated/sort-steps/seed.html#board?ties`); await p.waitForTimeout(1500);
console.log('default:', await chips());
await p.goto(`http://localhost:${port}/app/settings.html`); await p.waitForTimeout(800);
await p.click('[aria-controls="fold-comfort-cardcolour-row"]'); await p.waitForTimeout(200);
await p.locator('[data-cb-move="2"][data-dir="-1"]').click(); await p.locator('[data-cb-move="1"][data-dir="-1"]').click();
console.log('list:', await p.$$eval('#comfort-colourby li, #comfort-colourby .cb-name', (n) => n.map((x) => x.textContent.trim().slice(0, 30))));
await p.goto(`http://localhost:${port}/app/index.html`); await p.waitForTimeout(1200);
console.log('after reorder + reload:', await chips());
console.log('errors', JSON.stringify(errs)); await b.close();
// Second pass: give the first card a date 2 days out (the sample data has none), reload, read its chip.
const b2 = await chromium.launch(); const q = await b2.newPage({ viewport: { width: 1440, height: 900 } });
await q.goto(`http://localhost:${port}/docs/generated/sort-steps/seed.html#board?ties`); await q.waitForTimeout(1500);
await q.goto(`http://localhost:${port}/app/settings.html`); await q.waitForTimeout(800);
await q.click('[aria-controls="fold-comfort-cardcolour-row"]'); await q.waitForTimeout(200);
await q.locator('[data-cb-move="2"][data-dir="-1"]').click(); await q.locator('[data-cb-move="1"][data-dir="-1"]').click();
await q.evaluate(() => { const k = 'focusdeck-state-v1'; const s = JSON.parse(localStorage.getItem(k)); const t = s.projects[0].tasks.find((x) => x.title === 'Learn the bridge'); const d = new Date(Date.now() + 2 * 864e5); t.deadline = d.toISOString().slice(0, 10); t.updatedAt = Date.now(); localStorage.setItem(k, JSON.stringify(s)); });
await q.goto(`http://localhost:${port}/app/index.html`); await q.waitForTimeout(1200);
console.log('Learn the bridge chip with Due date first:', await q.$eval('.board-card', (c) => [c.querySelector('.board-card-title, .board-title')?.textContent, c.querySelector('.cchip')?.textContent, getComputedStyle(c).borderLeftWidth]));
await b2.close();
