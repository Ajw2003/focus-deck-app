// docs/generated/design-audit/shoot-final.mjs -- the finished build in the real app (#286): Focus, Roadmap, Sort, Review and
// Triage at 390x844 and 1440x900, in light and dark, with 8 projects (shoot.mjs's seed) and with 26 projects in 8 areas.
// Writes final-<data>-<theme>-<size>-<screen>.png beside itself and prints, per shot, how far the page is taller than the
// window and how many text elements are under 13px. Usage: node shoot-final.mjs
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
const require = createRequire('/opt/node22/lib/node_modules/');
const { chromium } = require('playwright');
const OUT = new URL('.', import.meta.url).pathname;
const ROOT = new URL('../../../', import.meta.url).pathname;
const srv = spawn('python3', ['-m', 'http.server', '8279', '--bind', '127.0.0.1'], { cwd: ROOT, stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 800));
const src = readFileSync(OUT + 'shoot.mjs', 'utf8');
const small = new Function(src.slice(src.indexOf('const now'), src.indexOf('const browser')) + '; return state;')();
const now = Date.now();
const AREAS = ['Work', 'Games', 'Home', 'Health', 'School', 'Family', 'Money', 'Tools'].map((name, i) => ({ id: 'a' + i, name, color: ['#4D6FB8', '#8A6FB8', '#3E8E5E', '#C9584F', '#C2731E', '#B8527E', '#2F8F8F', '#6A6FD1'][i] }));
const TITLES = ['Fix the icon on mobile', 'Reply to the invoice email', 'Rig the boss model', 'Book the dentist', 'Pay the phone bill', 'Write the devlog', 'Refactor the input system', 'Move the remaining gameplay numbers into tuning assets', 'Call about the car', 'Plan next sprint'];
let k = 0;
const big = { projectCategories: AREAS, categories: [{ id: 'c1', name: 'Code', color: '#3E8E5E' }], inbox: Array.from({ length: 19 }, (_, i) => ({ id: 'i' + i, text: 'Thought ' + i, createdAt: now - i * 3600e3 })), completedLog: [], deletedTaskIds: {}, choosingMode: { mode: 'twice', updatedAt: 1 },
  projects: Array.from({ length: 26 }, (_, i) => ({ id: 'p' + i, name: 'Project ' + String.fromCharCode(65 + i), color: AREAS[i % 8].color, categoryId: AREAS[i % 8].id, sortOrder: i,
    sections: i ? [] : [{ id: 's0', name: 'Main', order: 1, updatedAt: 1 }], milestones: i ? [] : [{ id: 'm0', name: 'Unplanned', sectionId: 's0', order: 1, updatedAt: 1 }],
    tasks: Array.from({ length: i ? 16 : 150 }, (_, j) => { k++; const status = i ? ['next', 'next', 'doing', 'review', 'done'][j % 5] : (j < 18 ? 'next' : j < 83 ? 'doing' : j < 101 ? 'review' : 'done');
      return { id: 't' + k, title: TITLES[k % TITLES.length], status, sortOrder: j, updatedAt: now - 1000, categoryIds: ['c1'], priority: [null, 'urgent', 'high', 'medium', 'low'][k % 5], deadline: k % 6 === 0 ? new Date(now + ((k % 5) - 2) * 864e5).toISOString().slice(0, 10) : undefined, milestoneId: i ? undefined : 'm0', completedAt: status === 'done' ? now - 3600e3 : undefined }; }) })) };
const browser = await chromium.launch();
let bad = 0;
for (const [data, state] of [['8', small], ['26', big]]) for (const theme of ['light', 'dark']) for (const [size, w, h] of [['phone', 390, 844], ['desk', 1440, 900]]) for (const screen of ['focus', 'roadmap', 'sort', 'review', 'triage']) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, serviceWorkers: 'block', colorScheme: theme });
  const page = await ctx.newPage();
  await page.addInitScript(([s, sc]) => { if (localStorage.getItem('seeded')) return; localStorage.setItem('seeded', '1'); localStorage.setItem('focusdeck-state-v1', JSON.stringify(s)); localStorage.setItem('focusdeck-onboarding', 'done'); localStorage.setItem('focusdeck-screen', sc); localStorage.setItem('focusdeck-last-project', 'p0'); }, [state, screen]);
  await page.goto('http://127.0.0.1:8279/app/');
  await page.waitForTimeout(700);
  const m = await page.evaluate(() => ({ over: document.documentElement.scrollHeight - innerHeight, wide: document.documentElement.scrollWidth - innerWidth,
    small: [...document.querySelectorAll('#app *')].filter((e) => [...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim()) && parseFloat(getComputedStyle(e).fontSize) < 13 && e.getClientRects().length).length }));
  if (m.over || m.wide || m.small) bad++;
  console.log(`${data} projects, ${theme}, ${size}, ${screen}: page ${m.over}px taller and ${m.wide}px wider than the window, ${m.small} text elements under 13px`);
  await page.screenshot({ path: OUT + `final-${data}-${theme}-${size}-${screen}.png` });
  await ctx.close();
}
console.log(bad ? bad + ' shots do not fit' : 'all 40 shots fit');
await browser.close(); srv.kill();
process.exit(bad ? 1 : 0);
