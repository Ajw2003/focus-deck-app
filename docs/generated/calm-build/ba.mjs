import { createRequire } from 'node:module';
const require = createRequire('/opt/node22/lib/node_modules/');
const { chromium } = require('playwright');
const O = process.argv[2]; const b = await chromium.launch(); const errs = [];
const V = { width: 1440, height: 900 };
const pg = async () => { const p = await b.newPage({ viewport: V }); p.on('pageerror', (e) => errs.push(p.url()+' '+e.message)); return p; };
// today's app
let p = await pg();
await p.goto('http://localhost:8765/docs/generated/sort-steps/seed.html#board?ties'); await p.waitForTimeout(1500);
await p.screenshot({ path: O + '/before-board.png' });
await p.locator('.board-card', { hasText: 'Book boiler service' }).first().click(); await p.waitForTimeout(600);
await p.screenshot({ path: O + '/before-task.png' });
p = await pg(); await p.goto('http://localhost:8765/app/settings.html'); await p.waitForTimeout(1200);
await p.screenshot({ path: O + '/before-settings.png' });
// the build
const T = 'http://localhost:8765/docs/generated/calm-test/index.html';
p = await pg(); await p.goto(T + '#board'); await p.evaluate(() => localStorage.clear()); await p.reload(); await p.waitForTimeout(1200);
await p.screenshot({ path: O + '/after-board.png' });
await p.locator('.calm-card', { hasText: 'Book boiler service' }).click(); await p.waitForTimeout(200);
await p.screenshot({ path: O + '/after-task.png' });
await p.locator('[data-fold="task:subtasks"]').click(); await p.waitForTimeout(150);
await p.screenshot({ path: O + '/after-task-open.png' });
await p.locator('[data-go=comfort]').click(); await p.waitForTimeout(300);
await p.screenshot({ path: O + '/after-settings.png' });
await p.locator('[data-go=projects]').click(); await p.waitForTimeout(300);
await p.screenshot({ path: O + '/after-projects.png' });
console.log('errors', JSON.stringify(errs)); await b.close();
