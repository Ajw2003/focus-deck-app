// focus-deck-app/js/sort-order.test.mjs — run with: node --test app/js/sort-order.test.mjs
//
// Custom project order (PR 9): sortOrder numbering, where a drag lands, the Custom sort, and the
// property the whole design rests on -- a move changes ONE record, so stampChanges stamps one
// record and the per-record Gist merge keeps two devices' moves. See docs/4-systems/gist-sync.md.
import test from 'node:test';
import assert from 'node:assert';
import { ensureSortOrder, positionBetween, moveProject, sortProjects, MIN_SORT_GAP } from './project-filter.js';
import { stampChanges, mergeStates } from './merge.js';

const proj = (id, sortOrder, extra) => Object.assign({ id, name: id.toUpperCase(), tasks: [] }, sortOrder === undefined ? {} : { sortOrder }, extra);
const ids = (list) => list.map((p) => p.id);
const apply = (projects, changes) => projects.map((p) => (p.id in changes ? Object.assign({}, p, { sortOrder: changes[p.id] }) : p));
const customOrder = (projects) => ids(sortProjects(projects, 'custom'));
const five = () => ['a', 'b', 'c', 'd', 'e'].map((id, i) => proj(id, i + 1));

test('ensureSortOrder numbers unnumbered projects after the max, in array order', () => {
  const list = [proj('a'), proj('b', 5), proj('c'), proj('d', 2), proj('e')];
  assert.strictEqual(ensureSortOrder(list), 3);
  assert.deepStrictEqual(list.map((p) => p.sortOrder), [6, 5, 7, 2, 8]);
  assert.strictEqual(ensureSortOrder(list), 0, 'a second run changes nothing');
});

test('ensureSortOrder on all-old data keeps the stored order, starting at 1', () => {
  const list = [proj('a'), proj('b'), proj('c')];
  ensureSortOrder(list);
  assert.deepStrictEqual(list.map((p) => p.sortOrder), [1, 2, 3]);
  assert.deepStrictEqual(customOrder(list), ['a', 'b', 'c']);
});

test('ensureSortOrder puts a newly added project at the end, even after negative sortOrders', () => {
  const list = [proj('a', -3), proj('b', -1)];
  list.push(proj('new'));
  ensureSortOrder(list);
  assert.strictEqual(list[2].sortOrder, 0);
  assert.strictEqual(customOrder(list).at(-1), 'new');
});

test('positionBetween: middle, both ends, only project', () => {
  assert.strictEqual(positionBetween(1, 2), 1.5);
  assert.strictEqual(positionBetween(null, 4), 3, 'first place: one before the next');
  assert.strictEqual(positionBetween(4, null), 5, 'last place: one after the previous');
  assert.strictEqual(positionBetween(null, null), 0);
  assert.strictEqual(positionBetween(undefined, 0), -1);
});

test('positionBetween: a gap too small to split returns null (the caller renumbers)', () => {
  assert.strictEqual(positionBetween(1, 1 + MIN_SORT_GAP / 2), null);
  assert.strictEqual(positionBetween(1, 1), null);
  assert.strictEqual(positionBetween(1, 1 + Number.EPSILON), null);
});

test('moveProject: down, up, to first, to last', () => {
  const list = five();
  const order = ids(list);
  assert.deepStrictEqual(customOrder(apply(list, moveProject(list, 'b', 3, order))), ['a', 'c', 'd', 'b', 'e'], 'b down to index 3');
  assert.deepStrictEqual(customOrder(apply(list, moveProject(list, 'd', 1, order))), ['a', 'd', 'b', 'c', 'e'], 'd up to index 1');
  assert.deepStrictEqual(customOrder(apply(list, moveProject(list, 'd', 0, order))), ['d', 'a', 'b', 'c', 'e'], 'd to first');
  assert.deepStrictEqual(customOrder(apply(list, moveProject(list, 'b', 4, order))), ['a', 'c', 'd', 'e', 'b'], 'b to last');
});

test('moveProject: same place, or an unknown id, changes nothing', () => {
  const list = five();
  assert.deepStrictEqual(moveProject(list, 'c', 2, ids(list)), {});
  assert.deepStrictEqual(moveProject(list, 'zzz', 0, ids(list)), {});
});

test('moveProject changes only the moved project, with a number strictly between its new neighbours', () => {
  const list = five();
  const changes = moveProject(list, 'a', 2, ids(list));
  assert.deepStrictEqual(Object.keys(changes), ['a']);
  assert.ok(changes.a > 3 && changes.a < 4, 'a lands between c (3) and d (4): ' + changes.a);
});

test('moveProject in a filtered list places it between the visible neighbours; hidden projects keep their numbers', () => {
  const list = five(); // a1 b2 c3 d4 e5
  const visible = ['a', 'c', 'e']; // b and d hidden
  const changes = moveProject(list, 'a', 1, visible); // a between c and e
  assert.deepStrictEqual(Object.keys(changes), ['a']);
  assert.ok(changes.a > 3 && changes.a < 4, 'right after c, before hidden d: ' + changes.a);
  const after = apply(list, changes);
  assert.deepStrictEqual(customOrder(after), ['b', 'c', 'a', 'd', 'e'], 'a is between c and e on screen; hidden d did not move');
  assert.strictEqual(after.find((p) => p.id === 'b').sortOrder, 2, 'hidden b unchanged');
  assert.strictEqual(after.find((p) => p.id === 'd').sortOrder, 4, 'hidden d unchanged');
});

test('moveProject when the displayed order is not the custom order adopts the displayed order', () => {
  // custom order is a,b,c,d but the screen shows them by name descending: d,c,b,a
  const list = [proj('a', 1), proj('b', 2), proj('c', 3), proj('d', 4)];
  const changes = moveProject(list, 'a', 0, ['d', 'c', 'b', 'a']); // drag a to the top of what's shown
  assert.deepStrictEqual(customOrder(apply(list, changes)), ['a', 'd', 'c', 'b']);
});

test('moveProject: a tiny gap renumbers everything 1..n, moved project in its new place', () => {
  const list = [proj('a', 1), proj('b', 2), proj('c', 2 + MIN_SORT_GAP / 10), proj('d', 3)];
  const changes = moveProject(list, 'd', 2, ['a', 'b', 'c', 'd']); // between b and c, 1e-7 apart
  const after = apply(list, changes);
  assert.deepStrictEqual(customOrder(after), ['a', 'b', 'd', 'c']);
  assert.deepStrictEqual(after.map((p) => p.sortOrder).sort((x, y) => x - y), [1, 2, 3, 4]);
});

test('sortProjects custom: ascending sortOrder, unnumbered last, ties by name', () => {
  const list = [proj('c', 3), proj('a', 1), proj('z'), proj('b', 2), proj('y', 2)];
  assert.deepStrictEqual(customOrder(list), ['a', 'b', 'y', 'c', 'z']);
  assert.deepStrictEqual(ids(list), ['c', 'a', 'z', 'b', 'y'], 'sorting does not reorder the input');
});

test('picking another sort does not touch sortOrder, so Custom restores the order', () => {
  const list = five();
  const moved = apply(list, moveProject(list, 'e', 0, ids(list)));
  const before = JSON.stringify(moved);
  sortProjects(moved, 'name');
  sortProjects(moved, 'open-tasks');
  assert.strictEqual(JSON.stringify(moved), before);
  assert.deepStrictEqual(customOrder(moved), ['e', 'a', 'b', 'c', 'd']);
});

test('a move stamps exactly one record with stampChanges', () => {
  const previous = { projects: five().map((p) => Object.assign(p, { updatedAt: 100 })) };
  const st = JSON.parse(JSON.stringify(previous));
  const changes = moveProject(st.projects, 'd', 0, ids(st.projects));
  st.projects.forEach((p) => { if (p.id in changes) p.sortOrder = changes[p.id]; });
  stampChanges(st, previous, 5000);
  assert.deepStrictEqual(st.projects.filter((p) => p.updatedAt !== 100).map((p) => p.id), ['d']);
  assert.strictEqual(st.projects.find((p) => p.id === 'd').updatedAt, 5000);
  assert.deepStrictEqual(st.deletedRecordIds.projects, {}, 'nothing tombstoned');
});

test('two devices moving different projects: the merge keeps both moves', () => {
  const base = { projects: five().map((p) => Object.assign(p, { updatedAt: 100 })), inbox: [], categories: [] };
  const device = (id, toIndex, now) => {
    const st = JSON.parse(JSON.stringify(base));
    const changes = moveProject(st.projects, id, toIndex, ids(st.projects));
    st.projects.forEach((p) => { if (p.id in changes) p.sortOrder = changes[p.id]; });
    stampChanges(st, base, now);
    return st;
  };
  const A = device('a', 4, 1000); // a to the end
  const B = device('e', 0, 2000); // e to the front
  assert.deepStrictEqual(customOrder(mergeStates(A, B).projects), ['e', 'b', 'c', 'd', 'a']);
  assert.deepStrictEqual(customOrder(mergeStates(B, A).projects), ['e', 'b', 'c', 'd', 'a'], 'same either way round');
});
