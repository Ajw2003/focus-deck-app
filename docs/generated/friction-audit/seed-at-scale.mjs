// Usage: node seed-at-scale.mjs <out dir> [b]   (b = workflow labels removed, as direction B would)
// Seeds the real app with Eden-scale data (26 projects, 420 tasks, 45 labels, 44 tray thoughts) and screenshots each screen.
import { createRequire } from 'node:module';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { join, extname, normalize } from 'node:path';
const require = createRequire('/opt/node22/lib/node_modules/');
const { chromium } = require('playwright');
const ROOT = new URL('../../../', import.meta.url).pathname;
const OUT = process.argv[2];
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.woff2': 'font/woff2' };
const server = createServer((req, res) => {
  const rel = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname)).replace(/^[/\\]+/, '');
  let file = join(ROOT, rel);
  if (existsSync(file) && statSync(file).isDirectory()) file = join(file, 'index.html');
  if (!existsSync(file)) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': TYPES[extname(file)] || 'application/octet-stream' }); res.end(readFileSync(file));
});
await new Promise((ok) => server.listen(8199, '127.0.0.1', ok));
const COLORS = ['#3E8E5E', '#4D6FB8', '#C9584F', '#8A6FB8', '#2F8F8F', '#C2731E', '#B8527E', '#5B8C2A', '#6A6FD1', '#A8742B'];
const P = ['Home','School','Focus Deck','AjsClaudeCodeTools','Unblocked','EdensProjectRouter','RockSkipping','AjsMusicAndSfxTools','AjwPlatformer','Models','UnamedSoulsLikeProject','SillyShootout','AjsCodeVisualizer','AjsContentCreation','CanadaSouls','CannaScraper','AjsCanadaPrty','AJ-s-motionControls','AjsAgyTools','canna-stock-finder','Finances','Health','Errands','Family','Car','Garden'];
const L = ['Feature','bug','enhancement','fix','build','Asap','highest priority','Up next','in progress','needs review','Qol','Ux','Chore','art','reminder','Review','documentation','question','accessibility','AjsAgent created this','Claude created this','settings','duplicate','wontfix','help wanted','Call','Email','Buy','Plan','Research','Repair','Clean','Cook','Money','Travel','Design','Code','Read','Practice','Deep work','Quick win','Someday','Weekend','Evening','Paperwork'];
const cats = L.map((n, i) => ({ id: 'c' + i, name: n, color: COLORS[(i * 3) % COLORS.length] }));
const projects = P.map((name, i) => ({ id: 'p' + i, name, color: COLORS[i % COLORS.length], tasks: [] }));
const now = Date.now();
for (let k = 0; k < 420; k++) {
  const pi = Math.floor(Math.pow((k * 0.6180339) % 1, 1.6) * P.length);
  const nc = 1 + (k % 4);
  projects[pi].tasks.push({ id: 't' + k, title: 'Task ' + k + ' ' + ['make sort many more like the regular sort screen','fix the icon on mobile','book dentist','reply to email','rig the boss model','refactor the input system','pay phone bill','write devlog'][k % 8],
    status: k % 13 === 0 ? 'done' : (k % 17 === 0 ? 'doing' : 'next'), categoryIds: Array.from({ length: nc }, (_, j) => cats[(k * 5 + j * 7) % cats.length].id),
    priority: [null, null, 'urgent', 'high', 'medium', 'low'][k % 6], deadline: k % 9 === 0 ? new Date(now + ((k % 5) - 2) * 864e5).toISOString().slice(0, 10) : undefined, updatedAt: 1, completedAt: k % 13 === 0 ? now - 3600e3 : undefined });
}
const inbox = Array.from({ length: 44 }, (_, i) => ({ id: 'cap' + i, text: 'Thought ' + i + ': ' + ['idea for the boss fight','look into widget','buy cables','grill the sort flow','call about the car'][i % 5], createdAt: now - i * 3600e3 }));
const WORKFLOW = ['Asap','highest priority','Up next','in progress','needs review','AjsAgent created this','Claude created this','duplicate','wontfix','help wanted','question','documentation','settings','Review'];
if (process.argv[3] === 'b') { const gone = new Set(cats.filter((c) => WORKFLOW.includes(c.name)).map((c) => c.id)); cats.splice(0, cats.length, ...cats.filter((c) => !gone.has(c.id))); }
const state = { projects, categories: cats, inbox, completedLog: [], deletedTaskIds: {}, choosingMode: { mode: 'twice', updatedAt: 1 } };
const browser = await chromium.launch();
const report = {};
for (const [w, h, tag] of [[1440, 900, 'desk'], [390, 844, 'phone']]) {
  for (const screen of (process.argv[3] === 'b' ? ['focus'] : ['focus', 'sort', 'board', 'projects'])) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h } });
    await ctx.addInitScript(([s, scr]) => { if (!sessionStorage.getItem('seeded')) { localStorage.setItem('focusdeck-onboarding', 'done'); localStorage.setItem('focusdeck-screen', scr); localStorage.setItem('focusdeck-state-v1', s); sessionStorage.setItem('seeded', '1'); } }, [JSON.stringify(state), screen]);
    const page = await ctx.newPage();
    const errs = []; page.on('pageerror', (e) => errs.push(e.message));
    await page.goto('http://127.0.0.1:8199/app/'); await page.waitForTimeout(800);
    const m = await page.evaluate(() => ({ nodes: document.querySelectorAll('*').length, buttons: document.querySelectorAll('button,a,[role=button],input,select').length, height: document.documentElement.scrollHeight,
      text: document.body.innerText.split(/\s+/).length, firstScreenText: document.body.innerText.slice(0, 1500) }));
    m.errs = errs; report[tag + '-' + screen] = m;
    await page.screenshot({ path: OUT + '/' + tag + '-' + screen + '.png' });
    await page.screenshot({ path: OUT + '/' + tag + '-' + screen + '-full.png', fullPage: true });
    await ctx.close();
  }
}
console.log(JSON.stringify(report, null, 1));
await browser.close(); server.close();
