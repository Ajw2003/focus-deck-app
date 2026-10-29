// Quick-add options: injects mock markup (the app's own classes) into the seed app and shoots each
// option. A = the jotter gets a "To:" project picker; B = one "New task" card from a + button;
// C = an add row on the Board list. Run: node docs/generated/quick-add/mock.mjs
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
await new Promise((ok) => server.listen(8254, '127.0.0.1', ok));
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM, args: ['--no-sandbox'] });
const CSS = `
.to-stamp{flex:none; min-height:36px; padding:4px 10px; border:1.5px dashed var(--paper-ink); border-radius:3px; background:transparent; color:var(--paper-ink); font:700 var(--text-sm) var(--font-paper); white-space:nowrap; display:inline-flex; align-items:center; gap:6px}
.to-stamp .dot{width:9px;height:9px;border-radius:50%;display:inline-block}
.to-menu{position:absolute; right:70px; top:100%; margin-top:6px; z-index:1200; width:230px; max-height:300px; overflow:auto; background:var(--surface); border:1px solid var(--line); border-radius:var(--r-control); box-shadow:var(--shadow); padding:6px; font-size:var(--text-sm)}
.to-menu div{display:flex; align-items:center; gap:8px; padding:7px 8px; border-radius:6px; color:var(--ink)}
.to-menu div.on{background:var(--surface-2); font-weight:700}
.to-menu .dot{width:9px;height:9px;border-radius:50%}
.to-menu hr{border:0;border-top:1px solid var(--line);margin:4px 0}
.nt label{display:block;font-size:var(--text-sm);font-weight:600;color:var(--ink-soft);margin:10px 0 4px}
.nt input,.nt select{width:100%;padding:9px 10px;border:1px solid var(--line);border-radius:var(--r-control);background:var(--surface);color:var(--ink);font:inherit;box-sizing:border-box}
.nt .row{display:flex;gap:8px}.nt .row>*{flex:1}
.nt h3{margin:0 0 4px}
.qa-row{display:flex;gap:8px;align-items:center;padding:10px 12px;margin-bottom:10px;border:1.5px dashed var(--line);border-radius:var(--r-control);background:var(--surface)}
.qa-row input{flex:1;border:0;background:transparent;font:inherit;color:var(--ink);outline:none}
.qa-row select{padding:6px 8px;border:1px solid var(--line);border-radius:var(--r-control);background:var(--surface-2);color:var(--ink);font:inherit;font-size:var(--text-sm)}
.plus-task{display:flex;align-items:center;gap:10px;margin:0 0 10px;width:100%;justify-content:center}
`;
async function open(w, h, hash) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, serviceWorkers: 'block', colorScheme: 'light' });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.log('PAGE ERROR', hash, e.message));
  await page.goto('http://127.0.0.1:8254/docs/generated/sort-steps/seed.html#' + hash);
  await page.waitForTimeout(800);
  await page.addStyleTag({ content: CSS });
  return { ctx, page };
}
const projects = async (page) => page.evaluate(() => [...document.querySelectorAll('.rail, body')].length && JSON.parse(localStorage.getItem(Object.keys(localStorage).find((k) => /state|deck/i.test(k)) || '{}') || '{}'));
// A: jotter "To:" stamp
async function optionA(page, { menu, chosen, text, toast }) {
  await page.evaluate(({ menu, chosen, text, toast }) => {
    const form = document.getElementById('capture-form');
    const input = document.getElementById('capture-input');
    if (text) input.value = text;
    const add = form.querySelector('.jot-add');
    const stamp = document.createElement('button');
    stamp.type = 'button'; stamp.className = 'to-stamp';
    stamp.innerHTML = chosen ? '<span class="dot" style="background:#4c9a6a"></span>To: ' + chosen + ' ▾' : 'To: Tray ▾';
    add.before(stamp);
    if (chosen) add.textContent = 'Add task';
    if (menu) {
      form.style.position = 'relative';
      const m = document.createElement('div'); m.className = 'to-menu';
      const cols = ['#8e6bbf', '#4c9a6a', '#d0832b', '#8e6bbf', '#4c9a6a', '#4c9a6a', '#3f6fc4', '#4c9a6a'];
      const names = ['Band', 'Car', 'Family', 'Finances', 'Fitness', 'Garden', 'Holiday in Portugal', 'Home'];
      m.innerHTML = '<div class="on">✓ Tray (sort later)</div><hr>' + names.map((n, i) => '<div><span class="dot" style="background:' + cols[i] + '"></span>' + n + '</div>').join('');
      form.appendChild(m);
    }
    if (toast) {
      const t = document.createElement('div');
      t.className = 'toast'; t.setAttribute('role', 'status');
      t.innerHTML = '<p class="toast-text">' + toast + '</p><button type="button" class="btn ghost" style="margin-left:auto;margin-right:6px;padding:6px 14px;font-weight:700">Open</button><button type="button" class="toast-close">×</button>';
      document.body.appendChild(t);
    }
  }, { menu, chosen, text, toast });
}
// B: one New task card
async function optionB(page, phone) {
  await page.evaluate((phone) => {
    const btn = '<button type="button" class="btn primary plus-task">+ New task</button>';
    if (!phone) document.querySelector('.rail').insertAdjacentHTML('afterbegin', btn);
    const d = document.createElement('div');
    d.innerHTML = '<div class="move-dialog-backdrop"><form class="move-dialog nt"><h3>New task</h3>'
      + '<label>Task</label><input value="Ring the plumber about the boiler">'
      + '<label>Project</label><select><option>● Home</option></select>'
      + '<details style="margin-top:12px"><summary style="cursor:pointer;font-weight:600;color:var(--ink-soft);font-size:var(--text-sm)">More: steps, priority, due date, labels</summary></details>'
      + '<div class="move-dialog-actions" style="margin-top:16px"><button type="button" class="btn-text">Cancel</button><button type="button" class="btn primary">Add task</button></div></form></div>';
    document.body.appendChild(d.firstElementChild);
  }, phone);
}
// C: add row on the board list
async function optionC(page) {
  await page.evaluate(() => {
    const list = document.querySelector('.screen-board [role="tabpanel"], .screen-board .board-list, .screen-board ol, .screen-board ul');
    const first = document.querySelector('.screen-board [data-task], .screen-board .board-card, .screen-board li');
    const row = '<form class="qa-row"><span style="font-weight:700;color:var(--accent)">+</span><input placeholder="Add a task…" value="Ring the plumber about the boiler"><select><option>Home</option></select></form>';
    (first || list).insertAdjacentHTML('beforebegin', row);
  });
}
async function slimForm(page) {
  await page.locator('[data-action="open-add-task"]').first().click();
  await page.waitForTimeout(300);
  await page.evaluate(() => {
    const f = document.querySelector('.add-task-form');
    f.innerHTML = '<div class="qa-row" style="margin:0;flex:1 1 100%"><span style="font-weight:700;color:var(--accent)">+</span><input placeholder="Add a task…" value="Ring the plumber about the boiler"><button type="button" class="btn-text">More</button><button type="button" class="btn primary" style="padding:6px 14px">Add</button></div>';
  });
}
const jobs = [
  ['slim-1440', 1440, 900, 'projects', slimForm],
  ['a-menu-390', 390, 844, 'board', (p) => optionA(p, { menu: true, text: 'Ring the plumber about the boiler' })],
  ['a-chosen-1440', 1440, 900, 'focus', (p) => optionA(p, { chosen: 'Home', toast: 'Added “Ring the plumber about the boiler” to Home · Up next' })],
  ['b-1440', 1440, 900, 'board', (p) => optionB(p, false)],
  ['b-390', 390, 844, 'focus', (p) => optionB(p, true)],
  ['c-1440', 1440, 900, 'board', optionC],
];
for (const [name, w, h, hash, fn] of jobs) {
  const { ctx, page } = await open(w, h, hash);
  await fn(page);
  await page.waitForTimeout(250);
  await page.screenshot({ path: OUT + name + '.png' });
  console.log('shot', name);
  await ctx.close();
}
await browser.close(); server.close();
