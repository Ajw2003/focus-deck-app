// Shoots each flow of prototype.html to p-<flow>.png and checks the drawing: every tap goes to a real
// screen, every screen is in a flow, and nothing is cut off at the bottom of a phone.
// Run from the repo root with python3 -m http.server 8196 running.
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1500, height: 900 }, deviceScaleFactor: 2 });
  await p.goto('http://127.0.0.1:8196/docs/generated/friction-steps/prototype.html?all'); await p.waitForTimeout(1500);
  const r = await p.evaluate(() => {
    const ids = Object.keys(window.SCREENS), inFlows = new Set(window.FLOWS.flatMap((f) => f[3].map((x) => x[0])));
    const bad = [...document.querySelectorAll('[data-go]')].map((e) => e.dataset.go).filter((g) => !window.SCREENS[g]);
    const cut = [...document.querySelectorAll('.phone')].filter((ph) => [...ph.querySelectorAll('.body')].some((b) => b.scrollHeight > b.clientHeight + 2)).map((ph) => ph.dataset.screen);
    return { screens: ids.length, notShown: ids.filter((i) => !inFlows.has(i)), badLinks: [...new Set(bad)], cutOff: [...new Set(cut)] };
  });
  console.log(JSON.stringify(r));
  for (const f of await p.evaluate(() => [...document.querySelectorAll('section.flow')].map((s) => s.id))) {
    await p.locator('#' + f).screenshot({ path: __dirname + '/p-' + f + '.png' }); console.log('shot', f);
  }
  await b.close();
})();
