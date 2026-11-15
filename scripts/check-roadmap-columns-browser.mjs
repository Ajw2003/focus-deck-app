// scripts/check-roadmap-columns-browser.mjs -- the Roadmap's four columns and next-step note (#284) in real Chromium: at 1440x900 all four headings at once,
// no tab strip, the note, 8 then "Show 4 more", a mouse drag Up next -> Doing; at 390x844 the tab strip with the note above it on any tab, no overflow, no small text.
// Usage: CHROMIUM=/opt/pw-browsers/chromium-1243/chrome-linux/chrome node scripts/check-roadmap-columns-browser.mjs   (serves the repo on 127.0.0.1:8284)
import { createRequire } from 'node:module';
import { mkdirSync, readFileSync, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import { join, extname, normalize } from 'node:path';
import { cab, everyFile, fileKeys, chooseFile, openFile, openKey } from './lib/cabinet.mjs';
const require = createRequire('/opt/node22/lib/node_modules/');
const { chromium } = require('playwright');
const ROOT = fileURLToPath(new URL('..', import.meta.url));
const BASE = 'http://127.0.0.1:8284/app/';
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.png': 'image/png' };
const server = createServer((req, res) => {
  const rel = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname)).replace(/^[/\\]+/, '');
  let file = join(ROOT, rel);
  if (!file.startsWith(ROOT)) { res.writeHead(403); return res.end(); }
  if (existsSync(file) && statSync(file).isDirectory()) file = join(file, 'index.html');
  if (!existsSync(file)) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': TYPES[extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
  res.end(readFileSync(file));
});
await new Promise((ok) => server.listen(8284, '127.0.0.1', ok));

const now = Date.now();
const mk = (n, status, k) => Array.from({ length: k }, (_, i) => ({ id: status + i, title: status + ' task ' + i, status, updatedAt: now - 1000, sortOrder: i, categoryIds: [], milestoneId: 'm1' }));
const seed = () => ({
  projectCategories: [{ id: 'a1', name: 'Apps', color: '#C9584F' }],
  projects: [{ id: 'p0', name: 'Cols', color: '#C9584F', categoryId: 'a1', sortOrder: 1, sections: [{ id: 'sec1', name: 'One', order: 1, updatedAt: 1 }],
    milestones: [{ id: 'm1', name: 'Only milestone', sectionId: 'sec1', order: 1, updatedAt: 1 }],
    tasks: [...mk(0, 'next', 12), ...mk(0, 'doing', 3), ...mk(0, 'review', 2), ...mk(0, 'done', 10)] }],
  categories: [], inbox: [], completedLog: [], deletedTaskIds: {}, choosingMode: { mode: 'twice', updatedAt: 1 },
});
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM, args: ['--no-sandbox'] });
let bad = 0;
const check = (ok, name, extra) => { console.log((ok ? 'PASS ' : 'FAIL ') + name + (extra ? '  [' + extra + ']' : '')); if (!ok) bad++; };
for (const [w, h] of [[1440, 900], [390, 844]]) {
  const phone = w < 900, tag = w + ': ';
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, serviceWorkers: 'block', hasTouch: phone });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => { bad++; console.log('FAIL page error: ' + e.message); });
  await page.addInitScript((s) => {
    if (localStorage.getItem('seeded')) return;
    localStorage.setItem('seeded', '1');
    localStorage.setItem('focusdeck-onboarding', 'done');
    localStorage.setItem('focusdeck-state-v1', JSON.stringify(s));
  }, seed());
  await page.goto(BASE);
  await page.waitForSelector('.rail');
  await page.click('[data-screen="projects"]'); await page.waitForSelector('.pj');
  await chooseFile(page, 'projects-tab', 'p0'); await page.waitForSelector('.rm-main');
  const vis = (sel) => page.evaluate((q) => [...document.querySelectorAll(q)].some((e) => e.offsetParent && e.getBoundingClientRect().height > 0), sel);
  const taller = () => page.evaluate(() => document.documentElement.scrollHeight - window.innerHeight);
  const small = () => page.evaluate(() => [...document.querySelectorAll('.screen-roadmap *')].filter((e) => e.offsetParent && [...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim()) && parseFloat(getComputedStyle(e).fontSize) < 13).length);
  check(await vis('.rm-note'), tag + 'the next-step note shows');
  check((await page.textContent('.rm-note .rm-task-title')) === 'next task 0', tag + 'the note holds the first Up next title');
  if (!phone) {
    const heads = await page.$$eval('.rm-lane-h', (e) => e.filter((x) => x.offsetParent).map((x) => x.textContent.replace(/\s+/g, ' ').trim()).join('|'));
    check(heads === 'Up next 12|Doing 3|Review 2|Done 10', tag + 'all four column headings are visible at once', heads);
    check(!(await vis('.rm-tabs')), tag + 'the tab strip is hidden');
    check((await page.$$eval('.rm-lane[data-status="next"] .rm-task', (e) => e.length)) === 8 && (await page.textContent('.rm-more[data-col="next"]')) === 'Show 4 more', tag + 'Up next shows 8 (note + 7) and "Show 4 more"');
    await page.click('.rm-more[data-col="next"]');
    check((await page.$$eval('.rm-lane[data-status="next"] .rm-task', (e) => e.length)) === 12 && (await page.textContent('.rm-more[data-col="next"]')) === 'Show fewer', tag + 'pressing it shows 12; the button says Show fewer');
    check((await taller()) <= 0, tag + 'the page is 0px taller than the window', String(await taller()));
    const g = await (await page.$('.rm-task[data-task-id="next1"] .rm-grip')).boundingBox(), r = await (await page.$('.rm-lane[data-status="doing"] .rm-lane-h')).boundingBox();
    await page.mouse.move(g.x + g.width / 2, g.y + g.height / 2); await page.mouse.down();
    await page.mouse.move(g.x + 12, g.y + 12, { steps: 4 }); await page.mouse.move(r.x + 40, r.y + r.height / 2, { steps: 10 }); await page.mouse.up();
    const t = await page.evaluate(() => JSON.parse(localStorage.getItem('focusdeck-state-v1')).projects[0].tasks.find((x) => x.id === 'next1').status);
    check(t === 'doing', tag + 'dragging the second Up next task onto Doing saves status doing', t);
  } else {
    check(await vis('.rm-tabs'), tag + 'the tab strip is visible');
    await page.click('.rm-tab[data-col="doing"]');
    const [n, tb] = await Promise.all([page.$eval('.rm-note', (e) => e.getBoundingClientRect().bottom), page.$eval('.rm-tabs', (e) => e.getBoundingClientRect().top)]);
    check(await vis('.rm-note') && n <= tb + 1, tag + 'on the Doing tab the note is still visible, above the tabs', n + ' <= ' + tb);
    check((await taller()) <= 0, tag + 'the page is 0px taller than the window', String(await taller()));
    check((await small()) === 0, tag + 'no text under 13px');
  }
  await ctx.close();
}
await browser.close();
server.close();
console.log(bad ? bad + ' FAILED' : 'all passed');
process.exit(bad ? 1 : 0);
