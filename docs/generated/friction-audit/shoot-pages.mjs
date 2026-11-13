// Screenshots every page in part3-pages.html, desktop (d-*) and phone (p-*). Usage: node shoot-pages.mjs
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const require = createRequire('/opt/node22/lib/node_modules/');
const { chromium } = require('playwright');
const here = fileURLToPath(new URL('.', import.meta.url));
const pages = ['sort', 'tidy', 'triage', 'roadmap-group', 'roadmap-proj', 'milestone', 'focus', 'focus-task', 'review', 'settings'];
const browser = await chromium.launch();
for (const name of pages) for (const [k, w, h] of [['d', 1440, 900], ['p', 390, 844]]) {
  const id = k + '-' + name;
  const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 2 });
  await page.goto('file://' + here + 'part3-pages.html#' + id); await page.waitForTimeout(300);
  await page.locator('#' + id + ' > div').screenshot({ path: here + 'pg-' + id + '.png' });
  await page.close();
}
await browser.close();
console.log('shot', pages.length * 2);
