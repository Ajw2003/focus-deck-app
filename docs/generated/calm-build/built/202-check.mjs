// Card colour (#202) browser check. Usage: node 202-check.mjs <port>
import { createRequire } from 'node:module';
const require = createRequire('/opt/node22/lib/node_modules/');
const { chromium } = require('playwright');
const port = process.argv[2];
const b = await chromium.launch();
const out = 'docs/generated/calm-build/built/';
for (const [w, h] of [[1440, 900], [390, 844]]) {
  const p = await (await b.newContext({ viewport: { width: w, height: h } })).newPage();
  const errs = [];
  p.on('pageerror', (e) => errs.push(String(e)));
  p.on('console', (m) => m.type() === 'error' && errs.push(m.text()));
  await p.goto(`http://localhost:${port}/docs/generated/sort-steps/seed.html#board?ties`);
  await p.waitForSelector('.board-card');
  const read = () => p.$$eval('.board-card', (cs) => cs.map((c) => [c.querySelector('.board-card-title').textContent, c.querySelector('.cchip').textContent, getComputedStyle(c).borderLeftWidth, c.style.getPropertyValue('--proj-color')]));
  console.log(w, 'default', JSON.stringify(await read()));
  await p.screenshot({ path: out + `202-board-${w}.png` });
  if (w === 1440) {
    await p.evaluate(async () => {
      const { state } = await import('/app/js/state.js'); const M = await import('/app/js/mutations.js');
      const day = (n) => new Date(Date.now() + n * 864e5).toISOString().slice(0, 10);
      const set = (title, f) => state.projects.forEach((p) => p.tasks.forEach((t) => t.title === title && Object.assign(t, f)));
      set('Renew passport before the Lisbon trip', { priority: 'urgent', deadline: day(-2) });
      set('Contact form sends twice', { priority: 'high' });
      set('Fix the gate latch', { priority: 'low' });
      set('Book boiler service', { deadline: day(2) });
      M.setColourBy(['due', 'priority', 'category']); // the Settings setter; also saves
    });
    await p.goto(new URL("/app/index.html#board?ties", p.url()).href);
    await p.waitForSelector('.board-card');
    console.log(w, 'reordered', JSON.stringify(await read()));
    await p.screenshot({ path: out + `202-reordered-${w}.png` });
  }
  console.log(w, 'overflow-ok', await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'errors', JSON.stringify(errs));
}
await b.close();
