// scripts/check-note-faces-browser.mjs -- real-Chromium check of the Note writing setting (#122).
// Usage: CHROMIUM=/opt/pw-browsers/chromium-1194/chrome-linux/chrome node scripts/check-note-faces-browser.mjs
// Serves the repo root itself on 127.0.0.1:8125 for the length of the run (no separate server).
// Checks all three faces on the sticky note and the jotter in dark and light (computed font-family,
// document.fonts), the setting stored and applied after a reload, a long title fitting, the Settings
// page, and OpenDyslexic OFFLINE from the service worker's cache. Screenshots: docs/generated/pr122/.
import { createRequire } from 'node:module';
import { mkdirSync, readFileSync, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import { join, extname, normalize } from 'node:path';
const require = createRequire('/opt/node22/lib/node_modules/');
const { chromium } = require('playwright');
const ROOT = fileURLToPath(new URL('..', import.meta.url));
const OUT = join(ROOT, 'docs/generated/pr122/');
mkdirSync(OUT, { recursive: true });
const PORT = 8125;
const BASE = `http://127.0.0.1:${PORT}/app/`;

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.txt': 'text/plain' };
const server = createServer((req, res) => {
  const rel = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname)).replace(/^[/\\]+/, '');
  let file = join(ROOT, rel);
  if (!file.startsWith(ROOT)) { res.writeHead(403); return res.end(); }
  if (existsSync(file) && statSync(file).isDirectory()) file = join(file, 'index.html');
  if (!existsSync(file)) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': TYPES[extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
  res.end(readFileSync(file));
});
await new Promise((ok) => server.listen(PORT, '127.0.0.1', ok));

const LONG = 'Renegotiate the quarterly supplier contract with accounting before Friday';
const task = (id, title, cats) => ({ id, title, status: 'next', categoryIds: cats, priority: 'high', sortOrder: 0 });
const seed = (face) => ({
  projects: [{ id: 'pHome', name: 'Home', color: '#3E8E5E', tasks: [task('h1', LONG, ['c_chore'])] }],
  categories: [{ id: 'c_chore', name: 'Chore', color: '#3E8E5E' }],
  inbox: [], completedLog: [], deletedTaskIds: [],
  choosingMode: { mode: 'tap', updatedAt: 1 },
  ...(face ? { noteFace: { face, updatedAt: 1 } } : {}),
});
const FIRST = { hand: 'Kalam', print: 'Atkinson Hyperlegible', dyslexic: 'OpenDyslexic' };

const results = [];
const check = (name, ok, extra = '') => { results.push([ok, name]); console.log((ok ? 'PASS ' : 'FAIL ') + name + (extra ? '  [' + extra + ']' : '')); };
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM, args: ['--no-sandbox'] });

async function open(face, scheme, { sw = false, url = BASE } = {}) {
  const ctx = await browser.newContext({ viewport: { width: 420, height: 900 }, colorScheme: scheme, serviceWorkers: sw ? 'allow' : 'block' });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => check('no page error: ' + e.message, false));
  await page.addInitScript((s) => { if (!localStorage.getItem('focusdeck-state-v1')) localStorage.setItem('focusdeck-state-v1', JSON.stringify(s)); }, seed(face));
  await page.goto(url);
  return { ctx, page };
}
const fam = (page, sel) => page.$eval(sel, (e) => getComputedStyle(e).fontFamily);
const size = (page, sel) => page.$eval(sel, (e) => parseFloat(getComputedStyle(e).fontSize));
async function draw(page) {
  await page.waitForSelector('.flip-track');
  await page.waitForTimeout(300);
  await page.click('[data-wallet="categories"] .sleeve.is-centre .icard').catch(() => {});
  await page.waitForSelector('.focus-active', { timeout: 4000 }).catch(() => {});
}

const sizes = {};
for (const scheme of ['dark', 'light']) {
  for (const face of ['hand', 'print', 'dyslexic']) {
    const tag = `[${face}/${scheme}]`;
    const { ctx, page } = await open(face, scheme);
    await draw(page);
    check(`${tag} <html data-note-face="${face}"`, (await page.evaluate(() => document.documentElement.dataset.noteFace)) === face);
    check(`${tag} sticky note exists`, !!(await page.$('.focus-title')));
    const tf = await fam(page, '.focus-title'), jf = await fam(page, '#capture-input');
    check(`${tag} sticky note font-family starts ${FIRST[face]}`, tf.replace(/"/g, '').startsWith(FIRST[face]), tf);
    check(`${tag} jotter font-family starts ${FIRST[face]}`, jf.replace(/"/g, '').startsWith(FIRST[face]), jf);
    const ui = await fam(page, '.topbar h1');
    check(`${tag} interface text unchanged (heading still Young Serif)`, ui.replace(/"/g, '').startsWith('Young Serif'), ui);
    // document.fonts: the self-hosted face must report loaded; Kalam/Atkinson come from Google Fonts
    // (blocked in some sandboxes), so for them it is reported, not required.
    const loaded = await page.evaluate(async (name) => {
      await document.fonts.load(`700 20px "${name}"`).catch(() => {});
      await document.fonts.ready;
      return { check: document.fonts.check(`700 20px "${name}"`), faces: [...document.fonts].filter((f) => f.family.replace(/"/g, '') === name).map((f) => f.status) };
    }, FIRST[face]);
    if (face === 'dyslexic') check(`${tag} document.fonts reports OpenDyslexic loaded`, loaded.check && loaded.faces.includes('loaded'), JSON.stringify(loaded));
    else console.log(`INFO ${tag} document.fonts ${FIRST[face]}: ${JSON.stringify(loaded)} (Google Fonts; needs network)`);
    // a long title fits the note, and takes about the same space
    const fit = await page.evaluate(() => {
      const t = document.querySelector('.focus-title'), n = document.querySelector('.note');
      const a = t.getBoundingClientRect(), b = n.getBoundingClientRect();
      const lh = parseFloat(getComputedStyle(t).lineHeight);
      return { inside: a.left >= b.left - 0.5 && a.right <= b.right + 0.5 && a.bottom <= b.bottom + 0.5, noOverflow: t.scrollWidth <= t.clientWidth + 1, lines: Math.round(a.height / lh), h: Math.round(a.height), size: parseFloat(getComputedStyle(t).fontSize) };
    });
    sizes[face + scheme] = fit;
    check(`${tag} long title fits inside the note`, fit.inside && fit.noOverflow, JSON.stringify(fit));
    check(`${tag} no sideways page scroll`, (await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)) <= 0);
    await page.screenshot({ path: OUT + `${scheme}-${face}.png` });
    // stored and applied after reload (no flash: attribute is set by the head script before CSS paints)
    const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('focusdeck-state-v1')).noteFace.face);
    // A drawn task stays in focus across a reload, so the page may come back on the note, not the wallets.
    await page.reload(); await page.waitForSelector('.flip-track, .focus-active');
    console.log(`INFO ${tag} after reload showing: ${(await page.$('.focus-active')) ? 'the drawn task' : 'the wallets'}`);
    check(`${tag} stored (${stored}) and applied after reload`, stored === face && (await page.evaluate(() => document.documentElement.dataset.noteFace)) === face);
    await ctx.close();
  }
}
for (const scheme of ['dark', 'light']) {
  const h = sizes['hand' + scheme].lines, d = sizes['dyslexic' + scheme].lines, p = sizes['print' + scheme].lines;
  check(`[${scheme}] title lines: hand ${h}, print ${p}, dyslexic ${d} (dyslexic not more than hand + 1)`, d <= h + 1);
}

// no-flash: the attribute is on <html> by DOMContentLoaded-start, before app.js runs
{
  const { ctx, page } = await open('dyslexic', 'dark', { url: 'about:blank' });
  await page.goto(BASE, { waitUntil: 'commit' });
  await page.waitForSelector('html[data-note-face="dyslexic"]', { timeout: 4000 }).catch(() => {});
  const early = await page.evaluate(() => ({ attr: document.documentElement.dataset.noteFace, appRendered: !!document.querySelector('.flip-track') }));
  console.log('INFO first-paint attribute: ' + JSON.stringify(early));
  await ctx.close();
}

// Settings page: change via the radios, preview in each face, persists and syncs shape
for (const scheme of ['dark', 'light']) {
  const { ctx, page } = await open(null, scheme, { url: BASE + 'settings.html' });
  await page.waitForSelector('.note-face-sample');
  const fams = await page.$$eval('.note-face-sample', (els) => els.map((e) => getComputedStyle(e).fontFamily.replace(/"/g, '').split(',')[0]));
  check(`[settings/${scheme}] three previews, each in its own face`, fams.join('|') === 'Kalam|Atkinson Hyperlegible|OpenDyslexic', fams.join('|'));
  check(`[settings/${scheme}] default is Handwriting`, await page.$eval('input[value="hand"]', (i) => i.checked));
  await page.check('input[value="dyslexic"]');
  await page.waitForTimeout(200);
  const st = await page.evaluate(() => ({ s: JSON.parse(localStorage.getItem('focusdeck-state-v1')).noteFace, a: document.documentElement.dataset.noteFace }));
  check(`[settings/${scheme}] choosing OpenDyslexic stores and applies it`, st.s.face === 'dyslexic' && st.s.updatedAt > 1 && st.a === 'dyslexic', JSON.stringify(st));
  await page.screenshot({ path: OUT + `${scheme}-settings.png`, fullPage: true });
  await page.reload(); await page.waitForSelector('.note-face-sample');
  check(`[settings/${scheme}] still chosen after reload`, await page.$eval('input[value="dyslexic"]', (i) => i.checked));
  await ctx.close();
}

// OpenDyslexic OFFLINE: let the service worker install, go offline, reload, the font comes from cache.
{
  const { ctx, page } = await open('dyslexic', 'dark', { sw: true });
  await page.waitForSelector('.flip-track');
  const swState = await page.evaluate(async () => { const r = await navigator.serviceWorker.ready; return r.active && r.active.state; });
  check('service worker installed and active', swState === 'activated' || swState === 'activating', swState);
  const cached = await page.evaluate(async () => { const r = await caches.match(new URL('fonts/opendyslexic-latin-700-normal.woff2', location.href)); const names = await caches.keys(); return { hit: !!r, names }; });
  check('font file is in the service worker cache', cached.hit && cached.names.some((n) => n.endsWith('v5')), JSON.stringify(cached));
  await page.reload({ waitUntil: 'load' }); // now controlled by the worker
  await ctx.setOffline(true);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.flip-track', { timeout: 8000 }).catch(() => {});
  await draw(page);
  check('offline: page still loads', !!(await page.$('.focus-title')));
  const off = await page.evaluate(async () => {
    await document.fonts.load('700 20px "OpenDyslexic"');
    return { check: document.fonts.check('700 20px "OpenDyslexic"'), status: [...document.fonts].filter((f) => f.family.replace(/"/g, '') === 'OpenDyslexic').map((f) => f.status), online: navigator.onLine,
      fam: getComputedStyle(document.querySelector('.focus-title')).fontFamily };
  });
  check('offline: OpenDyslexic loaded from cache', off.check && off.status.includes('loaded') && !off.online, JSON.stringify(off));
  await page.screenshot({ path: OUT + 'offline-dyslexic.png' });
  await ctx.setOffline(false);
  await ctx.close();
}

await browser.close();
server.close();
const bad = results.filter(([ok]) => !ok);
console.log(`\n${results.length - bad.length}/${results.length} checks passed`);
if (bad.length) { console.log('FAILED:\n' + bad.map(([, n]) => ' - ' + n).join('\n')); process.exit(1); }
console.log('NOTE FACES BROWSER CHECK PASSED');
