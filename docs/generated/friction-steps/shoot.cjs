// Shoots each row of mockups.html to its own PNG for the step-by-step redesign page.
const { chromium } = require('playwright');
(async () => { const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 2600, height: 900 }, deviceScaleFactor: 2 });
await p.goto('http://127.0.0.1:8196/docs/generated/friction-steps/mockups.html'); await p.waitForTimeout(1500);
for (const id of ['add', 'chrome', 'focus', 'organize', 'roadmap', 'desk']) { await p.locator('#' + id).screenshot({ path: __dirname + '/m-' + id + '.png' }); console.log('shot', id); }
await b.close(); })();
