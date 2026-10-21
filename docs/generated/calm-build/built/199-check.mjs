// node 199-check.mjs <port> [suffix]  -- run from the repo root
const { createRequire } = await import('node:module'); const require = createRequire('/opt/node22/lib/node_modules/'); const { chromium } = require('playwright');
const port = process.argv[2]; const tag = process.argv[3] || '';
const b = await chromium.launch(); const errs = [];
for (const w of [1440, 1920, 390]) {
  const p = await b.newPage({ viewport: { width: w, height: w === 390 ? 844 : 900 } });
  p.on('pageerror', e => errs.push(w + ' ' + e.message)); p.on('console', m => m.type() === 'error' && errs.push(w + ' ' + m.text()));
  await p.goto(`http://localhost:${port}/docs/generated/sort-steps/seed.html#board?ties`); await p.waitForTimeout(1500);
  await p.screenshot({ path: `docs/generated/calm-build/built/199-board-${w}${tag}.png` });
  console.log(w, await p.evaluate(() => [document.documentElement.scrollWidth, innerWidth]));
  if (w === 1440 && !tag) {
    await p.evaluate(() => window.scrollTo(0, 600)); await p.waitForTimeout(300);
    console.log('scrollY, topbar top', await p.evaluate(() => [scrollY, document.querySelector('.topbar').getBoundingClientRect().top]));
    await p.screenshot({ path: 'docs/generated/calm-build/built/199-board-scrolled-1440.png' });
    for (const s of ['focus', 'sort', 'board', 'projects']) { await p.click(`.rail-item[data-screen="${s}"]`); await p.waitForTimeout(300); console.log(s, await p.evaluate(() => document.querySelector('.rail-item.is-on').dataset.screen)); }
  }
}
console.log('errors', errs); await b.close();
