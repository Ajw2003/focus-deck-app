// Screenshots each picture in part3.html. Usage: node shoot-part3.mjs (writes PNGs beside this file)
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const require = createRequire('/opt/node22/lib/node_modules/');
const { chromium } = require('playwright');
const here = fileURLToPath(new URL('.', import.meta.url));
const browser = await chromium.launch();
for (const [id, w, h] of [["flow5", 1440, 520], ["sort5", 390, 844], ["roadmap-group5", 1440, 900], ["roadmap-proj5", 1440, 900], ["milestone5", 390, 844], ["focus5", 1440, 900], ["review5", 390, 844], ["inventory5", 1280, 0]]) {
  const page = await browser.newPage({ viewport: { width: w, height: h || 900 }, deviceScaleFactor: 2 });
  await page.goto('file://' + here + 'part3.html#' + id); await page.waitForTimeout(300);
  await page.locator('#' + id + ' > div').screenshot({ path: here + 'p3-' + id + '.png' });
  await page.close();
}
await browser.close();
