// Due-date and urgency options for Board cards: serves a scratch copy of the app with each option patched in
// (ROOT, first argument), adds sample priorities and due dates, and shoots the Board at 1440 and 390 wide.
import { createRequire } from 'node:module';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { join, extname, normalize } from 'node:path';
const require = createRequire('/opt/node22/lib/node_modules/');
const { chromium } = require('playwright');
const ROOT = process.argv[2];
const OUT = new URL('./', import.meta.url).pathname;
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.woff2': 'font/woff2' };
const server = createServer((req, res) => {
  const rel = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname)).replace(/^[/\\]+/, '');
  let file = join(ROOT, rel);
  if (existsSync(file) && statSync(file).isDirectory()) file = join(file, 'index.html');
  if (!existsSync(file)) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': TYPES[extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
  res.end(readFileSync(file));
});
await new Promise((ok) => server.listen(8231, '127.0.0.1', ok));
const SAMPLE = { 'Learn the bridge': ['urgent', 1], 'History essay draft': ['high', 6], 'Contact form sends twice': ['medium', null], 'Mop the kitchen': ['low', 25], 'Book boiler service': [null, 0], 'Renew passport before the Lisbon trip': ['high', -3] };
const OPTIONS = { today: { mode: 'none' }, a: { mode: 'all' }, b: { mode: 'matters' }, c: { mode: 'none', colourBy: ['due', 'priority', 'category'] } };
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM, args: ['--no-sandbox'] });
for (const [w, h] of [[1440, 900], [390, 844]]) {
  for (const [name, o] of Object.entries(OPTIONS)) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, serviceWorkers: 'block' });
    const page = await ctx.newPage();
    page.on('pageerror', (e) => console.log('PAGE ERROR', name, e.message));
    await page.goto('http://127.0.0.1:8231/docs/generated/sort-steps/seed.html#board?ties');
    await page.waitForSelector('.board-card');
    await page.evaluate(({ SAMPLE, o }) => {
      const s = JSON.parse(localStorage.getItem('focusdeck-state-v1'));
      const day = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };
      for (const p of s.projects) for (const t of p.tasks) {
        const x = SAMPLE[t.title];
        if (!x) continue;
        t.priority = x[0];
        if (x[1] !== null) { t.deadline = day(x[1]); t.dueSetAt = Date.now() - 20 * 864e5; }
      }
      if (o.colourBy) s.comfort = Object.assign({}, s.comfort, { colourBy: { value: o.colourBy, updatedAt: Date.now() } });
      localStorage.setItem('focusdeck-state-v1', JSON.stringify(s));
      localStorage.setItem('glance-mode', o.mode);
    }, { SAMPLE, o });
    await page.reload();
    await page.waitForSelector('.board-card');
    const list = await page.locator('.board-card').first().boundingBox();
    const shot = w > 1000 ? { x: 280, y: list.y - 70, width: 670, height: 640 } : { x: 0, y: list.y - 10, width: 390, height: 620 };
    await page.screenshot({ path: OUT + name + '-' + w + '.png', clip: shot });
    await ctx.close();
  }
}
await browser.close(); server.close();
console.log('shots written to ' + OUT);
