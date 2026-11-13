// run with: node --test app/js/tidy.test.mjs  (docs/4-systems/tidy-up.md)
import { test } from 'node:test';
import assert from 'node:assert';
import { tidyGroups, confirmIds, confirmItems, normTitle, lookSame, within } from './tidy.js';
import { renderTidy } from './tidy-view.js';
import { state } from './state.js';
import { confirmTidy, undoDone } from './mutations.js';

const now = new Date('2026-10-08T12:00:00').getTime();
const day = 864e5;
const T = (id, title, extra) => Object.assign({ id, title, status: 'next', updatedAt: now - day }, extra);
const mk = () => ({
  projectCategories: [{ id: 'a1', name: 'Home', color: '#3a3' }, { id: 'a2', name: 'Work', color: '#36a' }],
  categories: [{ id: 'c1', name: 'Obsolete' }],
  projects: [
    { id: 'pa', name: 'Alpha', categoryId: 'a1', tasks: [
      T('r1', 'Built thing', { status: 'review' }),
      T('rp1', 'Old plan, replaced by the new plan'),
      T('rp2', 'Notes pointer', { notes: 'see #20', issueNumber: 10 }),
      T('rp3', 'Labelled', { categoryIds: ['c1'] }),
      T('s1', 'Buy milk!!', { updatedAt: now - 5 * day }),
      T('s2', 'buy  milk', { updatedAt: now - 2 * day }),
      T('o1', 'Ancient', { updatedAt: now - 61 * day }),
      T('o2', 'Edge', { updatedAt: now - 59 * day }),
      T('o3', 'No stamp', { updatedAt: undefined }),
      T('dn', 'Done old', { status: 'done', updatedAt: 1 }),
      T('r2', 'Review and replaced by x', { status: 'review' }),
    ] },
    { id: 'pb', name: 'Beta', categoryId: 'a2', tasks: [T('n20', 'Newer', { issueNumber: 20 }), T('b1', 'Beta stale', { updatedAt: now - 90 * day })] },
  ],
});
const ids = (g) => g.items.map((i) => i.id);
const get = (r, k) => (r.groups.find((g) => g.key === k) || { items: [] });

test('each rule, in order, one group per task, done never', () => {
  const r = tidyGroups(mk(), null, now);
  assert.deepStrictEqual(ids(get(r, 'review')), ['r1', 'r2']);
  assert.deepStrictEqual(ids(get(r, 'replaced')), ['rp1', 'rp2', 'rp3']);
  assert.deepStrictEqual(ids(get(r, 'same')), ['s1']); // older of the pair is what Merge closes
  assert.strictEqual(get(r, 'same').items[0].other.id, 's2');
  assert.deepStrictEqual(ids(get(r, 'stale')), ['o1', 'b1']);
  const all = r.groups.flatMap(ids);
  assert.strictEqual(new Set(all).size, all.length);
  assert.ok(!all.includes('dn') && !all.includes('o3') && !all.includes('o2'));
});
test('see #N needs a newer open task', () => {
  const st = mk(); st.projects[1].tasks[0].issueNumber = 5;
  assert.ok(!ids(get(tidyGroups(st, null, now), 'replaced')).includes('rp2'));
});
test('title matching', () => {
  assert.strictEqual(normTitle('  Buy, MILK!! 🍼 '), 'buy milk');
  assert.ok(lookSame('buy milk', 'buy milk today'));
  assert.ok(lookSame('write the report', 'write the reprot'));
  assert.ok(!lookSame('a', 'ab'));
  assert.ok(!lookSame('walk the dog', 'water the plants'));
});
test('within(k) agrees with the full edit distance', () => {
  const full = (a, b) => { let p = [...Array(b.length + 1).keys()]; for (let i = 1; i <= a.length; i++) { const c = [i]; for (let j = 1; j <= b.length; j++) c[j] = Math.min(p[j] + 1, c[j - 1] + 1, p[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)); p = c; } return p[b.length]; };
  let seed = 3; const r = (n) => (seed = (seed * 16807) % 2147483647) % n;
  const word = () => Array.from({ length: 4 + r(10) }, () => 'abcde '[r(6)]).join('');
  for (let n = 0; n < 2000; n++) {
    const a = word(), b = r(2) ? word() : a.slice(0, r(a.length + 1)) + 'xy'.slice(0, r(3)) + a.slice(r(a.length + 1));
    for (let k = 0; k <= 2; k++) assert.strictEqual(within(a, b, k), full(a, b) <= k, JSON.stringify([a, b, k]));
  }
});
test('Organize stays quick with 800 open tasks of long titles (it froze before)', () => {
  let seed = 7; const r = (n) => (seed = (seed * 16807) % 2147483647) % n;
  const words = 'corner tower guards balconies lights castle wall props courtyard roof sync device gist token skill session'.split(' ');
  const tasks = Array.from({ length: 800 }, (_, i) => T('big' + i, Array.from({ length: 5 + r(14) }, () => words[r(words.length)]).join(' ')));
  const st = { projects: [{ id: 'p', name: 'P', tasks }], categories: [], projectCategories: [] };
  const t0 = performance.now(); tidyGroups(st, null, now);
  assert.ok(performance.now() - t0 < 1500, 'took ' + Math.round(performance.now() - t0) + ' ms');
});
test('view filtering', () => {
  const a = tidyGroups(mk(), { mode: 'area', id: 'a2' }, now);
  assert.deepStrictEqual(a.groups.flatMap(ids), ['b1']);
  assert.strictEqual(a.open, 2);
  assert.deepStrictEqual(tidyGroups(mk(), { mode: 'project', id: 'pb' }, now).groups.flatMap(ids), ['b1']);
});
test('confirmIds: only close/merge marks that are in the view', () => {
  const marks = { r1: 'close', s1: 'merge', rp1: 'keep', b1: 'close', r2: 'merge', ghost: 'close' };
  assert.deepStrictEqual(confirmIds(mk(), null, marks, now).sort(), ['b1', 'r1', 's1']);
  assert.deepStrictEqual(confirmIds(mk(), { mode: 'area', id: 'a2' }, marks, now), ['b1']);
});
test('Confirm closes via done, Undo restores the status', () => {
  Object.keys(state).forEach((k) => delete state[k]);
  Object.assign(state, mk(), { completedLog: [], deletedTaskIds: {} });
  confirmTidy(['r1', 's1']);
  const t = (id) => state.projects[0].tasks.find((x) => x.id === id);
  assert.strictEqual(t('r1').status, 'done');
  assert.strictEqual(t('s1').status, 'done');
  assert.strictEqual(t('rp1').status, 'next');
  undoDone('r1'); undoDone('s1');
  assert.strictEqual(t('r1').status, 'review');
  assert.strictEqual(t('s1').status, 'next');
});
test('"to" of a replaced task: the newer task, the words after "replaced by", or empty for a label', () => {
  const st = mk(); st.projects[1].tasks[0].issueNumber = 20;
  const to = Object.fromEntries(get(tidyGroups(st, null, now), 'replaced').items.map((i) => [i.id, i.to]));
  assert.deepStrictEqual(to, { rp1: 'the new plan', rp2: 'Newer', rp3: '' });
});
test('confirmItems: the older of a merged pair is flagged for the 📎', () => {
  const items = confirmItems(mk(), null, { r1: 'close', s1: 'merge' }, now);
  assert.deepStrictEqual(items.map((i) => [i.id, i.merge]), [['r1', false], ['s1', true]]);
});
const ui0 = (o) => Object.assign({ view: { mode: 'all', id: null }, tidyMarks: {}, tidyTicks: {} }, o);
test('markup: the two cards, a tick list per reason, Close these?, escapes', () => {
  const st = mk(); st.projects[0].tasks[0].title = '<b>x';
  const home = renderTidy(st, ui0(), now);
  assert.match(home, /Organize/); assert.match(home, /🧹 Tidy up/); assert.match(home, /📌 Triage/); assert.match(home, />Start</);
  const s1 = renderTidy(st, ui0({ tidyStep: 1, tidyTicks: { r1: true } }), now);
  assert.match(s1, /Finished\?/); assert.match(s1, /&lt;b&gt;x/); assert.ok(!s1.includes('<b>x'));
  assert.match(s1, /data-tidy-tick="r1" checked/); assert.match(s1, /✓ All/); assert.match(s1, /Keep/); assert.match(s1, /Close/);
  assert.match(renderTidy(st, ui0({ tidyStep: 2 }), now), /Old plan, replaced by the new plan ➜ the new plan/);
  const s3 = renderTidy(st, ui0({ tidyStep: 3 }), now);
  assert.match(s3, /Buy milk!! = buy  milk/); assert.match(s3, /Keep both/); assert.match(s3, /Merge/);
  assert.match(renderTidy(st, ui0({ tidyStep: 4 }), now), /Still want it\?/);
  const s5 = renderTidy(st, ui0({ tidyStep: 5, tidyMarks: { r1: 'close', s1: 'merge' } }), now);
  assert.match(s5, /Close these\?/); assert.match(s5, /📎 Buy milk!!/); assert.match(s5, />Confirm</);
});
