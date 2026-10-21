// #206: a task past its date on the Board, amber (the default) then red (Settings > Comfort), at 1440 and 390 wide.
// Usage: CHROMIUM=/opt/pw-browsers/chromium-1194/chrome-linux/chrome node docs/generated/calm-build/built/206-pastdate.mjs
import { createRequire } from 'node:module';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import { join, extname, normalize } from 'node:path';
const require = createRequire('/opt/node22/lib/node_modules/');
const { chromium } = require('playwright');
const ROOT = fileURLToPath(new URL('../../../../', import.meta.url));
const OUT = join(ROOT, 'docs/generated/calm-build/built/');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' };
const server = createServer((req, res) => {
  const rel = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname)).replace(/^[/\\]+/, '');
  let file = join(ROOT, rel);
  if (existsSync(file) && statSync(file).isDirectory()) file = join(file, 'index.html');
  if (!existsSync(file)) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': TYPES[extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
  res.end(readFileSync(file));
});
await new Promise((ok) => server.listen(8207, '127.0.0.1', ok));
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM, args: ['--no-sandbox'] });
let fails = 0;
for (const [w, h] of [[1440, 900], [390, 844]]) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, serviceWorkers: 'block' });
  const page = await ctx.newPage();
  await page.goto('http://127.0.0.1:8207/docs/generated/sort-steps/seed.html#board?ties');
  await page.waitForSelector('.board-card');
  for (const style of ['amber', 'red']) {
    await page.evaluate((style) => {
      const s = JSON.parse(localStorage.getItem('focusdeck-state-v1'));
      for (const p of s.projects) for (const t of p.tasks) if (t.title === 'Renew passport before the Lisbon trip') t.deadline = '2026-01-02';
      s.comfort = Object.assign({}, s.comfort, { overdue: { value: style, updatedAt: Date.now() } });
      localStorage.setItem('focusdeck-state-v1', JSON.stringify(s));
    }, style);
    await page.reload();
    await page.waitForSelector('.board-card');
    const card = page.locator('.board-card', { hasText: 'Renew passport' });
    const txt = (await card.locator('.board-card-due').textContent().catch(() => '')) || '';
    const want = style === 'amber' ? 'past its date' : 'overdue';
    const ok = txt.includes(want);
    if (!ok) fails++;
    console.log((ok ? 'PASS' : 'FAIL') + ' ' + w + ' ' + style + ': card says "' + txt.trim() + '"');
    await card.scrollIntoViewIfNeeded();
    await page.screenshot({ path: OUT + '206-pastdate-' + style + '-' + w + '.png' });
  }
  await ctx.close();
}
await browser.close(); server.close();
console.log(fails ? fails + ' failed' : 'all passed');
process.exit(fails ? 1 : 0);
