// scripts/check-desktop-browser.mjs -- real-Chromium check of the wide-screen desk (#128, #130, #129)
// at 1440x900 in dark and light: the desk column beside the projects, the wallets laid flat with every
// card showing, one click to pick a folder (the categories narrow), a click on a category draws, the
// in-tray filed by clicks alone, project folders on paper in both themes, and resizing to a phone
// width brings the flip-through wallets back (and back again).
// Usage: CHROMIUM=/opt/pw-browsers/chromium-1194/chrome-linux/chrome node scripts/check-desktop-browser.mjs
// Serves the repo root itself on 127.0.0.1:8134 for the length of the run (no separate server).
// Screenshots: docs/generated/pr128/.
import { createRequire } from 'node:module';
import { mkdirSync, readFileSync, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import { join, extname, normalize } from 'node:path';
const require = createRequire('/opt/node22/lib/node_modules/');
const { chromium } = require('playwright');
const ROOT = fileURLToPath(new URL('..', import.meta.url));
const OUT = join(ROOT, 'docs/generated/pr128/');
mkdirSync(OUT, { recursive: true });
const BASE = 'http://127.0.0.1:8134/app/';
const STATE_KEY = 'focusdeck-state-v1';

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' };
const server = createServer((req, res) => {
  const rel = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname)).replace(/^[/\\]+/, '');
  let file = join(ROOT, rel);
  if (!file.startsWith(ROOT)) { res.writeHead(403); return res.end(); }
  if (existsSync(file) && statSync(file).isDirectory()) file = join(file, 'index.html');
  if (!existsSync(file)) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': TYPES[extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
  res.end(readFileSync(file));
});
await new Promise((ok) => server.listen(8134, '127.0.0.1', ok));

const results = [];
const check = (name, ok, extra = '') => { results.push(ok); console.log((ok ? 'PASS ' : 'FAIL ') + name + (extra ? '  [' + extra + ']' : '')); };
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM, args: ['--no-sandbox'] });

const cats = ['Chore', 'Study', 'Bug', 'Art', 'Errand', 'Music'].map((n, i) => ({ id: 'c' + i, name: n, color: ['#3E8E5E', '#4D6FB8', '#C9584F', '#C2731E', '#8A6FB8', '#2F8F8F'][i] }));
const names = { Home: ['Bins out Thursday', 'Mop the kitchen', 'Fix the gate latch'], School: ['Read chapter 4', 'History essay draft'], Website: ['Footer link to old blog', 'Contact form sends twice'], Band: ['Learn the bridge'], Garden: ['Plant the bulbs', 'Fix the hose'] };
const projects = Object.entries(names).map(([n, ts], i) => ({ id: 'p' + i, name: n, color: ['#3E8E5E', '#4D6FB8', '#C9584F', '#8A6FB8', '#2F8F8F'][i],
  tasks: ts.map((t, j) => ({ id: 'p' + i + 't' + j, title: t, status: 'next', categoryIds: [cats[(i + j) % 6].id], priority: ['high', 'medium', 'low'][j % 3] })) }));
const seed = { projects, categories: cats, inbox: [{ id: 'i1', text: 'Call the dentist', createdAt: Date.now() - 3600e3 }], completedLog: [], deletedTaskIds: {}, choosingMode: { mode: 'twice', updatedAt: 1 } };

async function open(scheme, viewport = { width: 1440, height: 900 }) {
  const ctx = await browser.newContext({ viewport, colorScheme: scheme, serviceWorkers: 'block' });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => check(`[${scheme}] no page error: ` + e.message, false));
  await page.addInitScript(([s, k]) => { if (!localStorage.getItem(k)) { localStorage.setItem('focusdeck-onboarding', 'done'); localStorage.setItem(k, JSON.stringify(s)); } }, [seed, STATE_KEY]);
  await page.goto(BASE);
  await page.waitForSelector('.flip-track');
  await page.waitForTimeout(400);
  return { ctx, page };
}
const keys = (page, w) => page.$$eval(`[data-wallet="${w}"] .sleeve`, (els) => els.map((e) => e.dataset.key));
const visibleCards = (page, w) => page.$$eval(`[data-wallet="${w}"] .sleeve`, (els) => {
  const vw = innerWidth;
  return els.filter((e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.left >= 0 && r.right <= vw; }).length;
});
const click = async (page, w, key) => {
  const b = await (await page.$(`[data-wallet="${w}"] .sleeve[data-key="${key}"] .icard`)).boundingBox();
  await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2);
  await page.waitForTimeout(300);
};

for (const scheme of ['dark', 'light']) {
  const tag = `[${scheme}]`;
  const { ctx, page } = await open(scheme);

  // layout: the desk beside the projects, nothing sideways
  const desk = await (await page.$('.desk-col')).boundingBox();
  const projs = await (await page.$('.projects-col')).boundingBox();
  check(`${tag} the desk column sits left of the projects, both starting at the top`, desk.x + desk.width <= projs.x && Math.abs(desk.y - projs.y) < 4, JSON.stringify({ desk: Math.round(desk.x + desk.width), projects: Math.round(projs.x) }));
  const firstFolder = await (await page.$('.project-card')).boundingBox();
  check(`${tag} the first project folder is on the first screen`, firstFolder.y < 900);
  const wide = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
  check(`${tag} no sideways page scroll`, wide <= 0, 'overflow ' + wide + 'px');

  // wallets laid flat: every card showing at once
  const projKeys = await keys(page, 'projects');
  const catKeys = await keys(page, 'categories');
  check(`${tag} every folder shows at once`, (await visibleCards(page, 'projects')) === projKeys.length, projKeys.length + ' folders');
  check(`${tag} every category card shows at once`, (await visibleCards(page, 'categories')) === catKeys.length, catKeys.length + ' cards');
  check(`${tag} the hint says click`, ((await page.$eval('.focus-empty .flip-hint', (e) => e.textContent)) || '') === 'Click a folder to pick it, then a card to draw');
  await page.screenshot({ path: OUT + `desktop-${scheme}.png` });

  // one click picks a folder: the categories narrow to it, nothing drawn yet
  await click(page, 'projects', 'p3'); // Band: one task, category c3 (Art)
  check(`${tag} one click picks the folder`, (await page.$eval('[data-wallet="projects"] .sleeve.is-centre', (e) => e.dataset.key)) === 'p3' && !(await page.$('.focus-active')));
  const narrowed = await keys(page, 'categories');
  check(`${tag} the categories narrow to that folder`, narrowed.includes('c3') && !narrowed.includes('c1'), narrowed.join());
  // one click on a category draws
  await click(page, 'categories', 'c3');
  await page.waitForSelector('.focus-active', { timeout: 3000 }).catch(() => {});
  const title = await page.$eval('.focus-title', (e) => e.textContent).catch(() => '');
  check(`${tag} one click on a category draws from the picked folder`, title === 'Learn the bridge', title);
  await page.screenshot({ path: OUT + `desktop-${scheme}-drawn.png` });

  // project folders are paper in both themes
  const bg = await page.$eval('.project-card', (e) => getComputedStyle(e).backgroundColor);
  check(`${tag} project folders are paper (light) in this theme too`, bg === 'rgb(251, 250, 247)', bg);
  await ctx.close();
}

// the in-tray by clicks alone
{
  const { ctx, page } = await open('dark');
  await page.$eval('.inbox-card', (e) => e.scrollIntoView());
  await click(page, 'tray-folders', 'p1');
  await click(page, 'tray-flags', 'c1');
  check('in-tray: a click picks the folder and one sticks a flag', ((await page.$eval('.slip-dest', (e) => e.textContent)) || '').includes('School') && (await page.$$('.slip-flag')).length === 1);
  await page.screenshot({ path: OUT + 'desktop-dark-tray.png' });
  await page.click('.file-btn');
  await page.waitForTimeout(300);
  const st = JSON.parse(await page.evaluate((k) => localStorage.getItem(k), STATE_KEY));
  const filed = st.projects.find((p) => p.id === 'p1').tasks.find((t) => t.title === 'Call the dentist');
  check('in-tray: filed into School with the flag', !!filed && filed.categoryIds.includes('c1'));
  await ctx.close();
}

// resizing: phone width brings back the flip-through wallets, and wide lays them flat again
{
  const { ctx, page } = await open('dark');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(500);
  check('narrowed to a phone: the wallets flip again', !(await page.$('.flip-track.is-spread')) && (await visibleCards(page, 'projects')) < (await keys(page, 'projects')).length);
  const stacked = await page.evaluate(() => { const d = document.querySelector('.desk-col').getBoundingClientRect(), p = document.querySelector('.projects-col').getBoundingClientRect(); return p.top >= d.bottom - 1; });
  check('narrowed to a phone: the projects stack under the desk', stacked);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.waitForTimeout(500);
  check('widened again: laid flat again', (await page.$$('.flip-track.is-spread')).length >= 2);
  await ctx.close();
}

await browser.close();
server.close();
const failed = results.filter((ok) => !ok).length;
console.log(`\n${results.length - failed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
