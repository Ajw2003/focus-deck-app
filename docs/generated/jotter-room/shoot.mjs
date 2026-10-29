// Jotter room options: the jotter at phone width (393), dark, on the Board narrowed to "To Buy", with a
// multi-line thought typed. now = today's layout; A = writing on its own line, stamp and Add below;
// B = stamp shrunk to a folder icon; C = like A, but the second line only shows while you write.
// Run: node docs/generated/jotter-room/shoot.mjs
import { createRequire } from 'node:module';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { join, extname, normalize } from 'node:path';
const require = createRequire('/opt/node22/lib/node_modules/');
const { chromium } = require('playwright');
const OUT = new URL('./', import.meta.url).pathname;
const ROOT = join(OUT, '..', '..', '..');
const T = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.woff2': 'font/woff2', '.png': 'image/png', '.svg': 'image/svg+xml' };
const server = createServer((q, r) => { let f = join(ROOT, normalize(decodeURIComponent(new URL(q.url, 'http://x').pathname))); if (existsSync(f) && statSync(f).isDirectory()) f = join(f, 'index.html'); if (!existsSync(f)) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'Content-Type': T[extname(f)] || 'application/octet-stream', 'Cache-Control': 'no-store' }); r.end(readFileSync(f)); });
await new Promise((ok) => server.listen(8192, '127.0.0.1', ok));
const browser = await chromium.launch({ args: ['--no-sandbox'] });
const st = { projects: [{ id: 'pBuy', name: 'To Buy', color: '#5fc9b0', tasks: [{ id: 't1', title: 'Milk', status: 'next', categoryIds: [] }] }, { id: 'pHome', name: 'Home', color: '#3E8E5E', tasks: [] }], categories: [], inbox: [], completedLog: [], deletedTaskIds: [] };
const ICON = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7h7l2 2h9v10H3z"/></svg>';
const CSS = {
  a: '@media (max-width:640px){#capture-form{flex-wrap:wrap} #capture-input{flex:1 1 100%} #capture-to{margin-right:auto; max-width:none}}',
  b: '#capture-to{display:none} .to-icon{flex:none; min-height:36px; min-width:44px; display:inline-flex; align-items:center; justify-content:center; gap:2px; border:1.5px dashed var(--paper-ink); border-radius:3px; background:transparent; color:var(--paper-ink); font:700 var(--text-sm) var(--font-paper)}',
  c: '@media (max-width:640px){#capture-form:focus-within{flex-wrap:wrap} #capture-form:focus-within #capture-input{flex:1 1 100%} #capture-to{margin-right:auto; max-width:none} #capture-form:not(:focus-within) #capture-to{display:none}}',
};
async function shot(name, css, { text, focus, icon }) {
  const ctx = await browser.newContext({ viewport: { width: 393, height: 760 }, deviceScaleFactor: 2, colorScheme: 'dark', hasTouch: true, serviceWorkers: 'block' });
  await ctx.addInitScript((s) => { localStorage.setItem('focusdeck-onboarding', 'done'); localStorage.setItem('focusdeck-state-v1', JSON.stringify(s)); localStorage.setItem('focusdeck-screen', 'board'); localStorage.setItem('focusdeck-board-project', 'pBuy'); }, st);
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.log('PAGE ERROR', name, e.message));
  await page.goto('http://127.0.0.1:8192/app/');
  await page.waitForSelector('#capture-to');
  if (css) await page.addStyleTag({ content: css });
  if (icon) await page.evaluate((i) => { document.querySelector('#capture-form .jot-add').insertAdjacentHTML('beforebegin', '<button type="button" class="to-icon" aria-label="Add to: To Buy">' + i + '▾</button>'); }, ICON);
  if (text) { await page.fill('#capture-input', text); await page.dispatchEvent('#capture-input', 'input'); }
  if (focus) await page.focus('#capture-input'); else await page.evaluate(() => document.activeElement && document.activeElement.blur());
  await page.waitForTimeout(250);
  const wide = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
  await page.screenshot({ path: OUT + name + '.png', clip: { x: 0, y: 0, width: 393, height: 520 } });
  console.log(name, 'stamp:', await page.$eval('#capture-to', (e) => e.options[e.selectedIndex].text), 'overflow:', wide);
  await ctx.close();
}
const text = 'today i did this tomorrow i did not';
await shot('now', '', { text, focus: true });
await shot('a', CSS.a, { text, focus: true });
await shot('b', CSS.b, { text, focus: true, icon: true });
await shot('c-rest', CSS.c, { focus: false });
await shot('c-typing', CSS.c, { text, focus: true });
await browser.close(); server.close();
