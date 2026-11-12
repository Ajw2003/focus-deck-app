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
    // small print: any visible text in a phone under 13px
    const small = [];
    for (const ph of document.querySelectorAll('.phone')) for (const el of ph.querySelectorAll('*')) {
      const own = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
      const fs = parseFloat(getComputedStyle(el).fontSize);
      if (own && fs > 0 && fs < 13) small.push(ph.dataset.screen + ':' + el.textContent.trim().slice(0, 20));
    }
    const tall = [...document.querySelectorAll('.phone')].filter((ph) => ph.getBoundingClientRect().height > 660).map((ph) => ph.dataset.screen);
    return { screens: ids.length, notShown: ids.filter((i) => !inFlows.has(i)), badLinks: [...new Set(bad)], cutOff: [...new Set(cut)], tallerThanAPhone: [...new Set(tall)], smallText: [...new Set(small)].slice(0, 30) };
  });
  console.log(JSON.stringify(r));
  if (r.badLinks.length || r.cutOff.length || r.tallerThanAPhone.length || r.smallText.length || r.notShown.length) process.exitCode = 1;
  for (const f of await p.evaluate(() => [...document.querySelectorAll('section.flow')].map((s) => s.id))) {
    await p.locator('#' + f).screenshot({ path: __dirname + '/p-' + f + '.png' }); console.log('shot', f);
  }
  await b.close();
})();
