// Due-chip colour options for Board cards: serves a copy of the app (first argument) where "due today"
// is always red, gives sample tasks priorities and due dates, injects each yellow option's CSS, and
// shoots the cards in light mode at 1440 and 390 wide.
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
await new Promise((ok) => server.listen(8251, '127.0.0.1', ok));
const SAMPLE = { 'Learn the bridge': ['urgent', 0], 'History essay draft': ['high', 1], 'Contact form sends twice': ['medium', 6], 'Mop the kitchen': ['low', 25], 'Book boiler service': [null, 4], 'Renew passport before the Lisbon trip': ['high', -3] };
const Y = '.chip.deadline-chip.due-yellow';
const OPTIONS = {
  now: '',
  a: Y + '{background:#FFD43B; color:#3B2F00; border-color:#B38F00;}',
  b: Y + '{background:color-mix(in srgb, #E08A00 24%, transparent); color:#7A4000; border-color:#B86E00;}',
  c: Y + '{background:color-mix(in srgb, var(--due-soon) 34%, transparent); border-color:var(--due-soon);}',
};
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM, args: ['--no-sandbox'] });
for (const [w, h] of [[1440, 900], [390, 844]]) {
  for (const [name, css] of Object.entries(OPTIONS)) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, serviceWorkers: 'block', colorScheme: 'light' });
    const page = await ctx.newPage();
    page.on('pageerror', (e) => console.log('PAGE ERROR', name, e.message));
    await page.goto('http://127.0.0.1:8251/docs/generated/sort-steps/seed.html#board?ties');
    await page.waitForSelector('.board-card');
    await page.evaluate((SAMPLE) => {
      const s = JSON.parse(localStorage.getItem('focusdeck-state-v1'));
      const day = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };
      for (const p of s.projects) for (const t of p.tasks) {
        const x = SAMPLE[t.title];
        if (!x) continue;
        t.priority = x[0]; t.deadline = day(x[1]); t.dueSetAt = Date.now() - 30 * 864e5;
      }
      localStorage.setItem('focusdeck-state-v1', JSON.stringify(s));
    }, SAMPLE);
    await page.reload();
    await page.waitForSelector('.board-card');
    if (css) await page.addStyleTag({ content: css });
    const first = await page.locator('.board-card').first().boundingBox();
    const clip = w > 1000 ? { x: 280, y: first.y - 10, width: 670, height: 600 } : { x: 0, y: first.y - 10, width: 390, height: 660 };
    await page.screenshot({ path: OUT + name + '-' + w + '.png', clip });
    console.log(name, w, await page.$$eval('.deadline-chip', (els) => els.map((e) => e.className.replace('chip deadline-chip ', '') + ':' + e.textContent).join(' | ')));
    await ctx.close();
  }
}
await browser.close(); server.close();
