// docs/generated/design-audit/shoot-mockups.mjs -- shoots each .frame of mockups.html to after-<id>.png beside it. Usage: node shoot-mockups.mjs
import { createRequire } from 'node:module';
const require = createRequire('/opt/node22/lib/node_modules/');
const { chromium } = require('playwright');
const HERE = new URL('.', import.meta.url).pathname;
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1500, height: 1000 }, deviceScaleFactor: 2 });
await page.goto('file://' + HERE + 'mockups.html');
await page.waitForTimeout(1500);
for (const f of await page.locator('.frame').all()) {
  const id = await f.getAttribute('id');
  const over = await f.evaluate((e) => [...e.querySelectorAll('*')].filter((c) => { const r = c.getBoundingClientRect(), p = e.getBoundingClientRect(); return r.width && (r.bottom > p.bottom + 1 || r.right > p.right + 1); }).length);
  console.log(`${id}: ${over} elements spill outside the frame`);
  await f.screenshot({ path: HERE + `after-${id}.png` });
}
console.log('fonts loaded: ' + await page.evaluate(() => [document.fonts.check('700 20px Kalam'), document.fonts.check('20px "Young Serif"')].join(', ')));
await browser.close();
