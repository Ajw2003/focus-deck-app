import { createRequire } from 'node:module';
const require = createRequire('/opt/node22/lib/node_modules/');
const { chromium } = require('playwright');
const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1960, height: 1000 } });
await p.goto('file://' + process.argv[2]); await p.waitForTimeout(1500);
await p.screenshot({ path: process.argv[3], fullPage: true }); await b.close();
