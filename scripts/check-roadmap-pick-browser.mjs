// scripts/check-roadmap-pick-browser.mjs -- a project picked on the Roadmap stays the Roadmap's: Focus and Sort
// still offer every project, and their tape offers no One project. Run: node scripts/check-roadmap-pick-browser.mjs
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { cab, everyFile, fileKeys, chooseFile, openFile, openKey } from './lib/cabinet.mjs';
const require = createRequire('/opt/node22/lib/node_modules/');
const { chromium } = require('playwright');

const PORT = 8233;
const srv = spawn('python3', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1'], { cwd: new URL('..', import.meta.url).pathname, stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 800));
const projects = Array.from({ length: 26 }, (_, i) => ({ id: 'p' + i, name: 'Project ' + String.fromCharCode(65 + i), color: 'hsl(' + i * 13 + ' 50% 50%)', tasks: [{ id: 't' + i, title: 'Task ' + i, status: 'next', categoryIds: ['c1'] }] }));
const seed = { projects, inbox: [], categories: [{ id: 'c1', name: 'build', color: '#888' }] };
const browser = await chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {});
let ok = false;
try {
  const page = await browser.newPage({ viewport: { width: 400, height: 860 } });
  await page.addInitScript((s) => {
    if (localStorage.getItem('focusdeck-state-v1')) return;
    localStorage.setItem('focusdeck-state-v1', s);
    localStorage.setItem('focusdeck-onboarding', JSON.stringify({ done: true }));
    localStorage.setItem('focusdeck-screen', 'roadmap');
    localStorage.setItem('focusdeck-view', JSON.stringify({ mode: 'project', id: 'p3' }));
    localStorage.setItem('focusdeck-last-project', 'p3');
  }, JSON.stringify(seed));
  await page.goto('http://127.0.0.1:' + PORT + '/app/');
  await page.waitForTimeout(600);
  const roadmapTape = (await page.textContent('.vs-pick-name')).trim();
  await page.locator('[data-screen="focus"]:visible').first().click();
  await page.waitForTimeout(400);
  const focusTape = (await page.textContent('.vs-pick-name')).trim();
  const folders = (await fileKeys(page, 'projects')).length; // Everything: a file can also hang in its area's drawer
  await page.click('.vs-tape');
  const menu = await page.textContent('.vs-pop');
  await page.click('.vs-x');
  await page.locator('[data-screen="roadmap"]:visible').first().click();
  await page.waitForTimeout(300);
  const backTape = (await page.textContent('.vs-pick-name')).trim();
  const checks = {
    'Roadmap shows the picked project': roadmapTape === 'Project D',
    'Focus tape says Everything': focusTape === 'Everything',
    'Focus offers all 26 projects plus All projects': folders === 27,
    'Focus tape has no One project': !/One project/.test(menu),
    'Roadmap still shows the picked project': backTape === 'Project D',
  };
  Object.entries(checks).forEach(([k, v]) => console.log((v ? 'PASS ' : 'FAIL ') + k));
  if (!Object.values(checks).every(Boolean)) console.log(JSON.stringify({ roadmapTape, focusTape, folders, backTape }));
  ok = Object.values(checks).every(Boolean);
} finally { await browser.close(); srv.kill(); }
process.exit(ok ? 0 : 1);
