// Parity check for the step-by-step prototype: every data-action the app has today (in app/js and app/*.html,
// plus the action names app.js handles) must be in feature-map.json, and every screen it names must exist in
// prototype.html. Run from the repo root with python3 -m http.server 8196 running.
const fs = require('fs'), path = require('path'), { chromium } = require('playwright');
const root = path.join(__dirname, '../../..');
const src = ['app/js', 'app'].flatMap((d) => fs.readdirSync(path.join(root, d)).filter((f) => /\.(js|html)$/.test(f) && !f.includes('.test.')).map((f) => fs.readFileSync(path.join(root, d, f), 'utf8'))).join('\n');
const actions = new Set([...src.matchAll(/data-action=\\?"([a-z-]+)/g), ...src.matchAll(/action === '([a-z-]+)'/g)].map((m) => m[1]));
const map = JSON.parse(fs.readFileSync(path.join(__dirname, 'feature-map.json'), 'utf8')).map.flatMap(([, rows]) => rows);
const mapped = new Set(map.map((r) => r[0]));
(async () => {
  const b = await chromium.launch(); const p = await b.newPage();
  await p.goto('http://127.0.0.1:8196/docs/generated/friction-steps/prototype.html?all'); await p.waitForTimeout(800);
  const screens = new Set(await p.evaluate(() => Object.keys(window.SCREENS))); await b.close();
  const missing = [...actions].filter((a) => !mapped.has(a)).sort();
  const badScreens = map.flatMap((r) => r[2].split(' ').filter((s) => s !== 'same' && !screens.has(s)).map((s) => r[0] + ' -> ' + s));
  console.log('actions in the app:', actions.size, '| mapped:', map.length, '| missing from map:', missing.join(' ') || 'none', '| map names a screen that does not exist:', badScreens.join(', ') || 'none');
  process.exit(missing.length || badScreens.length ? 1 : 0);
})();
