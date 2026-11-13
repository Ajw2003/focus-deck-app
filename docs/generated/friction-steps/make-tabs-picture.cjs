// Draws p-tabs.png: the Roadmap tab before the Projects split (from an older prototype saved as _old.html) beside the new Projects and Roadmap tabs.
// The before phone gets the old five tab colours back, since it is drawn with today's stylesheet.
// Run from the repo root with python3 -m http.server 8196 running, after: git show <commit>:docs/generated/friction-steps/prototype.html > docs/generated/friction-steps/_old.html
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ deviceScaleFactor: 2, viewport: { width: 1200, height: 900 } });
  const grab = async (file, id) => {
    await p.goto('http://127.0.0.1:8196/docs/generated/friction-steps/' + file + '?all'); await p.waitForTimeout(800);
    return p.evaluate((id) => document.querySelector('.phone[data-screen="' + id + '"]').outerHTML, id);
  };
  const old = await grab('_old.html', 'r0'), n0 = await grab('prototype.html', 'r0'), n2 = await grab('prototype.html', 'r2');
  const fr = (cap, h) => '<div class="frame"><p class="cap" style="font:600 16px Figtree">' + cap + '</p>' + h + '</div>';
  await p.goto('http://127.0.0.1:8196/docs/generated/friction-steps/prototype.html?all=kit'); await p.waitForTimeout(500);
  await p.evaluate((parts) => {
    document.getElementById('root').innerHTML = '<style>.frame:first-child .tabs button:nth-child(3){background:#C7D6F0}.frame:first-child .tabs button:nth-child(4){background:#F2C7B8}.frame:first-child .tabs button:nth-child(5){background:#DCCDEB}</style><section class="flow"><div class="frames" style="align-items:flex-end">' + parts[0]
      + '<div style="font:700 40px Figtree;align-self:center;padding:0 10px">→</div>' + parts[1] + parts[2] + '</div></section>';
  }, [fr('Before: Roadmap opens on all projects', old), fr('After: Projects tab', n0), fr('After: Roadmap tab', n2)]);
  await p.waitForTimeout(400);
  await p.locator('section.flow').screenshot({ path: 'docs/generated/friction-steps/p-tabs.png' });
  await b.close();
})();
