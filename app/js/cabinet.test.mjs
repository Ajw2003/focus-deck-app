// run with: node --test app/js/cabinet.test.mjs  (docs/4-systems/wallets.md#the-filing-cabinet)
import { test } from 'node:test';
import assert from 'node:assert';
import { cabinetDrawers, startDrawer, cabinetInner } from './cabinet.js';

const areas = [{ id: 'apps', name: 'Apps', color: 'red' }, { id: 'games', name: 'Games', color: 'blue' }, { id: 'home', name: 'Home', color: 'green' }, { id: 'pcat_unsorted', name: 'Unsorted', color: 'grey' }];
const files = [
  { key: 'b', name: 'Plunderspell', areaId: 'games' },
  { key: 'a', name: 'Focus Deck', areaId: 'apps' },
  { key: 'c', name: 'AjsClaudeCodeTools', areaId: 'apps' },
  { key: 'd', name: 'Old ideas', areaId: 'pcat_unsorted' },
];

test('Everything first with every file A to Z, then one drawer per area that has files, in the areas order', () => {
  const d = cabinetDrawers(files, areas, { lead: [{ key: 'all', name: 'All projects' }] });
  assert.deepStrictEqual(d.map((x) => x.id), ['all', 'apps', 'games', 'pcat_unsorted'], 'Home has no files, so no drawer');
  assert.deepStrictEqual(d[0].files.map((f) => f.key), ['all', 'c', 'a', 'd', 'b'], 'the lead file first, then A to Z');
  assert.deepStrictEqual(d[1].files.map((f) => f.key), ['c', 'a'], 'each drawer A to Z, and no lead');
});

test('a caller can keep its own order (the Projects tab sort)', () => {
  const d = cabinetDrawers(files, areas, { sort: () => 0 });
  assert.deepStrictEqual(d[0].files.map((f) => f.key), ['b', 'a', 'c', 'd']);
});

test('the drawer open last time comes back if it still exists', () => {
  const d = cabinetDrawers(files, areas);
  assert.strictEqual(startDrawer(d, 'games'), 2);
  assert.strictEqual(startDrawer(d, 'home'), 0, 'a drawer that is gone falls back to Everything');
  assert.strictEqual(startDrawer(d, undefined), 0);
});

test('markup: the open file is marked in every drawer it hangs in, names are escaped, a progress bar only when asked', () => {
  const html = cabinetInner({ wallet: 'projects', aria: 'Projects', drawers: cabinetDrawers([{ key: 'x', name: '<b>&', areaId: 'apps', pct: 40 }], areas), facing: 'x' });
  assert.strictEqual((html.match(/cab-file is-centre/g) || []).length, 2, 'in Everything and in Apps');
  assert.ok(html.includes('&lt;b&gt;&amp;') && !html.includes('<b><b>&'), 'escaped');
  assert.ok(html.includes('aria-label="40% done"'));
  assert.ok(!cabinetInner({ wallet: 'p', aria: '', drawers: cabinetDrawers([{ key: 'y', name: 'Y', areaId: 'apps' }], areas), facing: 'y' }).includes('% done'), 'no pct, no bar');
});
