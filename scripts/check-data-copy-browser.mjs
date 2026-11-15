// scripts/check-data-copy-browser.mjs -- Settings > "Save a copy of my data" downloads the stored state
// without the sync Gist ID or the GitHub key. Run: node scripts/check-data-copy-browser.mjs
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
const require = createRequire('/opt/node22/lib/node_modules/');
const { chromium } = require('playwright');

const PORT = 8231;
const srv = spawn('python3', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1'], { cwd: new URL('..', import.meta.url).pathname, stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 800));
const seed = { projects: [{ id: 'p1', name: 'Plunderspell', tasks: [{ id: 't1', title: 'Corner towers', status: 'next' }] }], inbox: [], gistId: 'secret-gist-id' };
const browser = await chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {});
let ok = false;
try {
  const page = await browser.newPage({ acceptDownloads: true });
  await page.addInitScript((s) => { if (!localStorage.getItem('focusdeck-state-v1')) { localStorage.setItem('focusdeck-state-v1', s); localStorage.setItem('focusdeck-github-token', 'github_pat_SECRET'); } }, JSON.stringify(seed));
  await page.goto('http://127.0.0.1:' + PORT + '/app/settings.html');
  await page.click('#data-copy-section .set-head');
  const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#save-data-copy')]);
  const text = readFileSync(await dl.path(), 'utf8'), copy = JSON.parse(text);
  const status = await page.textContent('#data-copy-status');
  const checks = {
    'file name': /^focus-deck-copy-\d{4}-\d\d-\d\d\.json$/.test(dl.suggestedFilename()),
    'has the project and task': copy.projects?.[0]?.name === 'Plunderspell' && copy.projects[0].tasks.length === 1,
    'no gist id': !text.includes('secret-gist-id'),
    'no github key': !text.includes('github_pat_SECRET'),
    'status line': /1 projects, 1 tasks/.test(status),
  };
  Object.entries(checks).forEach(([k, v]) => console.log((v ? 'PASS ' : 'FAIL ') + k));
  ok = Object.values(checks).every(Boolean);
} finally { await browser.close(); srv.kill(); }
process.exit(ok ? 0 : 1);
