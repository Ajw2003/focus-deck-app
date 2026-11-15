// docs/generated/design-audit/shoot-focus.mjs -- walks Focus from "Which project?" to the task note and shoots each step.
// Usage: node shoot-focus.mjs   (reads the seed data out of shoot.mjs, which must sit beside it)
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
const require = createRequire('/opt/node22/lib/node_modules/');
const { chromium } = require('playwright');
const OUT = new URL('.', import.meta.url).pathname;
const ROOT = new URL('../../../', import.meta.url).pathname;
const srv = spawn('python3', ['-m', 'http.server', '8278', '--bind', '127.0.0.1'], { cwd: ROOT, stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 800));
const src = (await import('node:fs')).readFileSync(OUT + 'shoot.mjs', 'utf8');
const seedCode = src.slice(src.indexOf('const now'), src.indexOf('const browser'));
const state = new Function(seedCode + '; return state;')();
const browser = await chromium.launch();
for (const [tag, w, h] of [['phone', 390, 844], ['desk', 1440, 900]]) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, serviceWorkers: 'block' });
  const page = await ctx.newPage();
  await page.addInitScript(([s]) => { if (localStorage.getItem('seeded')) return; localStorage.setItem('seeded', '1'); localStorage.setItem('focusdeck-state-v1', JSON.stringify(s)); localStorage.setItem('focusdeck-onboarding', 'done'); localStorage.setItem('focusdeck-screen', 'focus'); }, [state]);
  await page.goto('http://127.0.0.1:8278/app/');
  await page.waitForTimeout(700);
  for (const [step, action] of [[1, 'focus-next'], [2, 'focus-show']]) {
    await page.click('[data-action="' + action + '"]'); await page.waitForTimeout(600);
    const m = await page.evaluate(() => { const vis = (e) => e.getClientRects().length; const note = document.querySelector('#app .dk-paper'); const r = note ? note.getBoundingClientRect() : { width: 0, height: 0 };
      return { heading: (document.querySelector('#app h2') || {}).textContent || '', controls: [...document.querySelectorAll('#app button, #app a, #app input, #app select')].filter(vis).length, paperShare: Math.round(100 * r.width * r.height / (innerWidth * innerHeight)) }; });
    console.log(`${tag} after ${action}: heading "${m.heading.trim()}", ${m.controls} visible controls, the paper covers ${m.paperShare}% of the window`);
    await page.screenshot({ path: OUT + `now-${tag}-focus-step${step}.png` });
  }
  await ctx.close();
}
await browser.close(); srv.kill();
