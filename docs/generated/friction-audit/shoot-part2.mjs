// Screenshots each picture in part2.html. Usage: node shoot-part2.mjs (writes PNGs beside this file)
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const require = createRequire('/opt/node22/lib/node_modules/');
const { chromium } = require('playwright');
const here = fileURLToPath(new URL('.', import.meta.url));
const browser = await chromium.launch();
for (const [id, w, h] of [["add-phone", 390, 844], ["add-phone-off", 390, 844], ["add-desk", 1440, 900], ["car-desk", 1440, 900], ["car-phone", 390, 844], ["tidy-desk", 1440, 900], ["triage-desk", 1440, 900], ["roadmap-desk", 1440, 900], ["roadmap-phone", 390, 844], ["map2", 1280, 560], ["areas-settings", 390, 844], ["roadmap-area", 1440, 900], ["roadmap-one", 1440, 900], ["tidy-area", 1440, 900], ["triage-area-phone", 390, 844]]) {
  const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 2 });
  await page.goto('file://' + here + 'part2.html#' + id); await page.waitForTimeout(300);
  await page.locator('#' + id + ' > div').screenshot({ path: here + 'p2-' + id + '.png' });
  await page.close();
}
await browser.close();
