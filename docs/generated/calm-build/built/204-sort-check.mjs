const { createRequire } = await import('node:module'); const require = createRequire('/opt/node22/lib/node_modules/'); const { chromium } = require('playwright');
const port = process.argv[2]; const b = await chromium.launch(); const errs = [];
for (const [w, h] of [[1440, 900], [390, 844]]) {
  const p = await b.newPage({ viewport: { width: w, height: h } });
  p.on('pageerror', (e) => errs.push(w + ' ' + e.message)); p.on('console', (m) => m.type() === 'error' && errs.push(w + ' ' + m.text()));
  await p.goto(`http://localhost:${port}/docs/generated/sort-steps/seed.html#sort`); await p.waitForTimeout(1500);
  console.log(w, 'overflow', await p.evaluate(() => document.documentElement.scrollWidth > innerWidth), (await p.textContent('.screen-sort')).slice(0, 160));
  await p.screenshot({ path: `docs/generated/calm-build/built/204-sort-${w}.png` });
}
console.log('errors', JSON.stringify(errs)); await b.close();
