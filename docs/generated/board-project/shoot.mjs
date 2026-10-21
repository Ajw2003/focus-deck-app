// Board project options: serves the repo, opens the seed Board, picks the first project, rewrites the
// tab counts to that project's own numbers (the change all options share), then dresses the toolbar
// for each option and shoots it at 390 and 1440 wide in light mode. Run from anywhere with
// CHROMIUM set: node docs/generated/board-project/shoot.mjs
import { createRequire } from 'node:module';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { join, extname, normalize } from 'node:path';
const require = createRequire('/opt/node22/lib/node_modules/');
const { chromium } = require('playwright');
const OUT = new URL('./', import.meta.url).pathname;
const ROOT = join(OUT, '..', '..', '..');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.woff2': 'font/woff2', '.svg': 'image/svg+xml' };
const server = createServer((req, res) => {
  const rel = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname)).replace(/^[/\\]+/, '');
  let file = join(ROOT, rel);
  if (existsSync(file) && statSync(file).isDirectory()) file = join(file, 'index.html');
  if (!existsSync(file)) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': TYPES[extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
  res.end(readFileSync(file));
});
await new Promise((ok) => server.listen(8252, '127.0.0.1', ok));

// Each option runs in the page after the project is picked; p is { name, color, counts }.
const OPTIONS = {
  now: null,
  a: (p) => {
    // A: the heading names the project in its colour, and the menu takes the same colour.
    const h = document.querySelector('.board-title');
    h.innerHTML = '<span style="display:inline-flex;align-items:center;gap:10px"><i style="width:14px;height:14px;border-radius:50%;background:' + p.color + '"></i>' + p.name + '</span><span style="display:block;font:600 .85rem var(--font-ui);color:var(--ink-soft);margin-top:2px">Board · one project</span>';
    h.style.borderLeft = '6px solid ' + p.color; h.style.paddingLeft = '10px';
    const s = document.querySelector('.calm-tools select');
    s.style.cssText += ';border:2px solid ' + p.color + ';background:color-mix(in srgb,' + p.color + ' 14%, var(--surface));font-weight:700';
  },
  b: (p, all) => {
    // B: the menu becomes a row of project buttons; the chosen one is filled in its colour.
    const s = document.querySelector('.calm-tools select');
    const row = document.createElement('div');
    row.style.cssText = 'display:flex;gap:6px;overflow-x:auto;width:100%;padding-bottom:2px';
    row.innerHTML = [{ name: 'All', color: '#59627A' }].concat(all).map((q) => {
      const on = q.name === p.name;
      return '<span style="flex:none;padding:7px 12px;border-radius:999px;font:700 var(--text-sm) var(--font-ui);border:2px solid ' + q.color + ';'
        + (on ? 'background:' + q.color + ';color:#fff' : 'background:var(--surface);color:var(--ink)') + '">' + (on ? '✓ ' : '') + q.name + '</span>';
    }).join('');
    s.replaceWith(row);
  },
  c: (p) => {
    // C: a coloured banner under the toolbar says which project is showing, with a way back to All.
    const tabs = document.querySelector('.calm-tabs');
    const b = document.createElement('div');
    b.style.cssText = 'display:flex;align-items:center;gap:10px;margin:0 0 12px;padding:10px 12px;border-radius:8px;background:color-mix(in srgb,' + p.color + ' 16%, var(--surface));border:2px solid ' + p.color + ';font:700 var(--text-body) var(--font-ui);color:var(--ink)';
    b.innerHTML = '<i style="width:12px;height:12px;border-radius:50%;background:' + p.color + '"></i><span style="flex:1">Showing ' + p.name + ' only</span><span style="font-weight:600;text-decoration:underline">Show all</span>';
    tabs.before(b);
  },
};

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM, args: ['--no-sandbox'] });
for (const [w, h] of [[390, 844], [1440, 900]]) {
  for (const [name, dress] of Object.entries(OPTIONS)) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, serviceWorkers: 'block', colorScheme: 'light' });
    const page = await ctx.newPage();
    page.on('pageerror', (e) => console.log('PAGE ERROR', name, e.message));
    await page.goto('http://127.0.0.1:8252/docs/generated/sort-steps/seed.html#board?ties');
    await page.waitForSelector('.board-card');
    const projects = await page.evaluate(() => JSON.parse(localStorage.getItem('focusdeck-state-v1')).projects.map((p) => ({ id: p.id, name: p.name, color: p.color })));
    const pick = projects[0];
    await page.selectOption('.calm-tools select', pick.id);
    await page.waitForTimeout(200);
    const before = await page.$$eval('.calm-tab b', (els) => els.map((e) => e.textContent).join('/'));
    if (name !== 'now') {
      // the shared change: each tab counts only the chosen project's tasks (subtasks left out)
      await page.evaluate((id) => {
        const p = JSON.parse(localStorage.getItem('focusdeck-state-v1')).projects.find((x) => x.id === id);
        const ids = new Set(p.tasks.map((t) => t.id));
        const top = p.tasks.filter((t) => !(t.parentId && ids.has(t.parentId)));
        const weekAgo = Date.now() - 7 * 864e5;
        const n = { next: top.filter((t) => t.status === 'next').length, doing: top.filter((t) => t.status === 'doing').length, done: top.filter((t) => t.status === 'done' && (t.completedAt || 0) >= weekAgo).length };
        document.querySelectorAll('.calm-tab').forEach((b) => { b.querySelector('b').textContent = n[b.dataset.col]; });
      }, pick.id);
      await page.evaluate(([fn, p, all]) => new Function('p', 'all', '(' + fn + ')(p, all)')(p, all), [dress.toString(), pick, projects]);
    }
    const after = await page.$$eval('.calm-tab b', (els) => els.map((e) => e.textContent).join('/'));
    const top = await page.locator('.board-title').boundingBox();
    const clip = w > 1000 ? { x: top.x - 10, y: top.y - 10, width: 700, height: 520 } : { x: 0, y: top.y - 10, width: 390, height: 600 };
    await page.screenshot({ path: OUT + name + '-' + w + '.png', clip });
    console.log(name, w, pick.name, 'counts before', before, 'after', after, 'sideways', await page.evaluate(() => document.documentElement.scrollWidth > innerWidth));
    await ctx.close();
  }
}
await browser.close(); server.close();
