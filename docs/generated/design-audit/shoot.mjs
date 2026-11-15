// docs/generated/design-audit/shoot.mjs -- screenshots of every tab of the real app at 390x844 and 1440x900 with
// everyday-size data (8 projects in 4 areas, 56 tasks, 5 thoughts). Usage: node shoot.mjs   (writes now-*.png beside itself)
import { createRequire } from 'node:module';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { join, extname, normalize } from 'node:path';
const require = createRequire('/opt/node22/lib/node_modules/');
const { chromium } = require('playwright');
const ROOT = new URL('../../../', import.meta.url).pathname;
const OUT = new URL('.', import.meta.url).pathname;
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' };
const server = createServer((req, res) => {
  const rel = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname)).replace(/^[/\\]+/, '');
  let file = join(ROOT, rel);
  if (existsSync(file) && statSync(file).isDirectory()) file = join(file, 'index.html');
  if (!existsSync(file)) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': TYPES[extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' }); res.end(readFileSync(file));
});
await new Promise((ok) => server.listen(8277, '127.0.0.1', ok));
const now = Date.now();
const day = (n) => new Date(now + n * 864e5).toISOString().slice(0, 10);
const AREAS = [['a1', 'Work', '#4D6FB8'], ['a2', 'Games', '#8A6FB8'], ['a3', 'Home', '#3E8E5E'], ['a4', 'Health', '#C9584F']];
const PROJ = [['Focus Deck', 'a1'], ['Client site', 'a1'], ['Platformer', 'a2'], ['Souls-like', 'a2'], ['House', 'a3'], ['Finances', 'a3'], ['Car', 'a3'], ['Fitness', 'a4']];
const TITLES = ['Fix the icon on mobile', 'Reply to the invoice email', 'Rig the boss model', 'Book the dentist', 'Pay the phone bill', 'Write the devlog', 'Refactor the input system', 'Buy cables', 'Call about the car', 'Plan next sprint', 'Record audition tape', 'Clean the gutters', 'Renew insurance', 'Playtest level two'];
const cats = [['c1', 'Code', '#3E8E5E'], ['c2', 'Call', '#C2731E'], ['c3', 'Buy', '#B8527E'], ['c4', 'Art', '#6A6FD1'], ['c5', 'Paperwork', '#2F8F8F']].map(([id, name, color]) => ({ id, name, color }));
let k = 0;
const projects = PROJ.map(([name, categoryId], i) => {
  const milestones = i < 3 ? [{ id: `m${i}a`, name: 'First playable', sectionId: `s${i}`, order: 1, updatedAt: 1 }, { id: `m${i}b`, name: 'Polish', sectionId: `s${i}`, order: 2, updatedAt: 1 }] : [];
  const tasks = Array.from({ length: 7 }, (_, j) => { k++; return { id: 't' + k, title: TITLES[k % TITLES.length], status: ['next', 'next', 'next', 'doing', 'next', 'review', 'done'][j], sortOrder: j, updatedAt: now - 1000,
    categoryIds: [cats[k % cats.length].id], priority: [null, 'urgent', 'high', 'medium', 'low', null][k % 6], deadline: k % 4 === 0 ? day((k % 7) - 2) : undefined,
    milestoneId: milestones.length ? milestones[j % 2].id : undefined, completedAt: j === 6 ? now - 3600e3 : undefined }; });
  return { id: 'p' + i, name, color: AREAS.find((a) => a[0] === categoryId)[2], categoryId, sortOrder: i, sections: i < 3 ? [{ id: `s${i}`, name: 'Foundations', order: 1, updatedAt: 1 }] : [], milestones, tasks };
});
const state = { projectCategories: AREAS.map(([id, name, color]) => ({ id, name, color })), projects, categories: cats,
  inbox: ['Idea for the boss fight', 'Look into the widget', 'Get three quotes', 'Ask about the lease', 'Birthday present'].map((text, i) => ({ id: 'i' + i, text, createdAt: now - i * 3600e3 })),
  completedLog: [], deletedTaskIds: {}, choosingMode: { mode: 'twice', updatedAt: 1 } };
const browser = await chromium.launch();
for (const [tag, w, h] of [['phone', 390, 844], ['desk', 1440, 900]]) {
  for (const screen of ['sort', 'tidy', 'triage', 'projects', 'roadmap', 'focus', 'review']) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, serviceWorkers: 'block', deviceScaleFactor: 1 });
    const page = await ctx.newPage();
    await page.addInitScript(([s, sc]) => { if (localStorage.getItem('seeded')) return; localStorage.setItem('seeded', '1'); localStorage.setItem('focusdeck-state-v1', JSON.stringify(s)); localStorage.setItem('focusdeck-onboarding', 'done'); localStorage.setItem('focusdeck-screen', sc); localStorage.setItem('focusdeck-last-project', 'p0'); }, [state, screen]);
    await page.goto('http://127.0.0.1:8277/app/');
    await page.waitForTimeout(700);
    const m = await page.evaluate(() => ({ over: document.documentElement.scrollHeight - innerHeight, buttons: document.querySelectorAll('#app button, #app a, #app input, #app select').length,
      small: [...document.querySelectorAll('#app *')].filter((e) => e.childNodes.length && [...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim()) && parseFloat(getComputedStyle(e).fontSize) < 13 && e.getClientRects().length).length }));
    console.log(`${tag} ${screen}: page ${m.over}px taller than the window, ${m.buttons} controls, ${m.small} text elements under 13px`);
    await page.screenshot({ path: OUT + `now-${tag}-${screen}.png` });
    await ctx.close();
  }
}
await browser.close();
server.close();
