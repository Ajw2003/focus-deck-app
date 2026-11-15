// scripts/check-sort-skip-browser.mjs -- Sort's "Not this one" sends the slip to the back, and it stays there after a
// reload. Run: node scripts/check-sort-skip-browser.mjs   (FOCUS_DATA=<a saved copy .json> runs it on real data)
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
const require = createRequire('/opt/node22/lib/node_modules/');
const { chromium } = require('playwright');

const PORT = 8235;
const srv = spawn('python3', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1'], { cwd: new URL('..', import.meta.url).pathname, stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 800));
const now = Date.now();
const seed = process.env.FOCUS_DATA ? readFileSync(process.env.FOCUS_DATA, 'utf8') : JSON.stringify({ projects: [{ id: 'p1', name: 'P', tasks: [] }], categories: [],
  inbox: ['first thought', 'second thought', 'third thought'].map((text, i) => ({ id: 'i' + i, text, createdAt: now - (10 - i) * 60e3 })) });
const browser = await chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {});
let ok = false;
try {
  const page = await browser.newPage({ viewport: { width: 390, height: 800 } });
  await page.addInitScript((s) => { if (localStorage.getItem('focusdeck-state-v1')) return; localStorage.setItem('focusdeck-state-v1', s); localStorage.setItem('focusdeck-onboarding', JSON.stringify({ done: true })); localStorage.setItem('focusdeck-screen', 'sort'); }, seed);
  await page.goto('http://127.0.0.1:' + PORT + '/app/');
  await page.waitForTimeout(800);
  const slip = async () => (await page.textContent('.jot-slip .slip-text')).trim();
  const first = await slip();
  await page.click('[data-action="unsorted-skip"]');
  await page.waitForTimeout(300);
  const second = await slip();
  await page.reload();
  await page.waitForTimeout(800);
  const afterReload = await slip();
  const checks = {
    'Not this one shows the next slip': second !== first,
    'after a reload the skipped slip stays at the back': afterReload === second,
  };
  Object.entries(checks).forEach(([k, v]) => console.log((v ? 'PASS ' : 'FAIL ') + k));
  ok = Object.values(checks).every(Boolean);
} finally { await browser.close(); srv.kill(); }
process.exit(ok ? 0 : 1);
