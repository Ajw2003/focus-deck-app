// scripts/lib/touch.mjs -- a real finger drag for the browser checks: touch events sent through the
// Chrome DevTools Protocol, so the browser's own touch scrolling, touch-action and pointer events all
// run as they do on a phone (Playwright's touchscreen can only tap).
export async function swipe(page, from, to, { steps = 12, holdMs = 0 } = {}) {
  const cdp = await page.context().newCDPSession(page);
  const point = (x, y) => [{ x: Math.round(x), y: Math.round(y), id: 1, radiusX: 4, radiusY: 4, force: 1 }];
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: point(from.x, from.y) });
  if (holdMs) await page.waitForTimeout(holdMs);
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: point(from.x + (to.x - from.x) * t, from.y + (to.y - from.y) * t) });
    await page.waitForTimeout(16);
  }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await cdp.detach();
  await page.waitForTimeout(500); // the snap settles
}
