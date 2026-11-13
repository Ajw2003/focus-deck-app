// scripts/screens-final-272.mjs -- a screenshot of each tab at 390x844 and 1440x900 into docs/generated/final-272/ (#272).
// Not a check (check-all.sh does not run it). Usage: CHROMIUM=/opt/pw-browsers/chromium-1243/chrome-linux64/chrome node scripts/screens-final-272.mjs
import { createRequire } from 'node:module';
import { mkdirSync, readFileSync, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import { join, extname, normalize } from 'node:path';
const require = createRequire('/opt/node22/lib/node_modules/');
const { chromium } = require('playwright');
const ROOT = fileURLToPath(new URL('..', import.meta.url));
const OUT = join(ROOT, 'docs/generated/final-272/');
mkdirSync(OUT, { recursive: true });
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
await new Promise((ok) => server.listen(8272, '127.0.0.1', ok));
const now = Date.now();
const t = (id, title, status, extra) => Object.assign({ id, title, status, updatedAt: now - 1000, sortOrder: 1, categoryIds: [] }, extra);
const seed = { projectCategories: [{ id: 'a1', name: 'Apps', color: '#C9584F' }], projects: [{ id: 'p0', name: 'Focus Deck', color: '#8459c0', categoryId: 'a1', sortOrder: 1,
  sections: [{ id: 'sec1', name: 'Foundations', order: 1, updatedAt: 1 }], milestones: [{ id: 'm1', name: 'Start here screen', sectionId: 'sec1', order: 1, updatedAt: 1 }],
  tasks: [t('s1', 'Test on phone', 'next', { milestoneId: 'm1', priority: 'high', waitsOn: ['s2'], categoryIds: ['c1'] }), t('s2', 'Open on Start here', 'doing', { milestoneId: 'm1' }), t('s3', 'Ready to check', 'review', { milestoneId: 'm1' })] }],
  categories: [{ id: 'c1', name: 'Code', color: '#3E8E5E' }], inbox: [{ id: 'i1', text: 'Get three quotes', createdAt: now }], completedLog: [], deletedTaskIds: {}, choosingMode: { mode: 'twice', updatedAt: 1 } };
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM, args: ['--no-sandbox'] });
for (const [tag, w, h] of [['phone', 390, 844], ['desk', 1440, 900]]) {
  for (const [name, screen, acts] of [['sort', 'sort', []], ['sort-step', 'sort', ['[data-action="sort-next"]']], ['organize', 'tidy', []], ['projects', 'projects', []], ['roadmap', 'roadmap', []], ['roadmap-task', 'roadmap', ['[data-action="rm-task"]']], ['focus', 'focus', []], ['review', 'review', []]]) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, serviceWorkers: 'block' });
    const page = await ctx.newPage();
    await page.addInitScript(([s, sc]) => { if (localStorage.getItem('seeded')) return; localStorage.setItem('seeded', '1'); localStorage.setItem('focusdeck-state-v1', JSON.stringify(s)); localStorage.setItem('focusdeck-onboarding', 'done'); localStorage.setItem('focusdeck-screen', sc); localStorage.setItem('focusdeck-last-project', 'p0'); }, [seed, screen]);
    await page.goto('http://127.0.0.1:8272/app/');
    await page.waitForTimeout(700);
    for (const a of acts) { await page.click(a); await page.waitForTimeout(300); }
    const over = await page.evaluate(() => document.documentElement.scrollHeight - innerHeight);
    console.log(`${tag} ${name}: page over by ${over}px`);
    await page.screenshot({ path: OUT + `${tag}-${name}.png` });
    await ctx.close();
  }
}
await browser.close();
server.close();
