// Screenshots each picture in mockups.html. Usage: node shoot-mockups.mjs (writes PNGs beside this file)
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const require = createRequire('/opt/node22/lib/node_modules/');
const { chromium } = require('playwright');
const here = fileURLToPath(new URL('.', import.meta.url));
const browser = await chromium.launch();
for (const [id, w, h] of [['flow', 1280, 800], ['a-phone', 390, 844], ['a-desk', 1440, 900], ['b-settings', 390, 844], ['c-phone', 390, 844], ['d', 1200, 400]]) {
  const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 2 });
  await page.goto('file://' + here + 'mockups.html#' + id); await page.waitForTimeout(300);
  await page.locator('#' + id + ' > div').screenshot({ path: here + 'mock-' + id + '.png' });
  await page.close();
}
await browser.close();
