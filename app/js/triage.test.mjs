// focus-deck-app/js/triage.test.mjs -- run with: node --test app/js/triage.test.mjs
import test from 'node:test';
import assert from 'node:assert';
import { triageLists, moveId, NOW_SIZE, NEXT_SIZE } from './triage.js';

const T = '2026-11-12';
const task = (id, o = {}) => Object.assign({ id, status: 'next', deadline: null, priority: null, categoryIds: [] }, o);
const mk = (a, b = []) => ({ categories: [], projectCategories: [{ id: 'a1', name: 'A' }, { id: 'a2', name: 'B' }], projects: [{ id: 'p1', categoryId: 'a1', tasks: a }, { id: 'p2', categoryId: 'a2', tasks: b }] });
const all = { mode: 'all', id: null };
const flat = (l) => [...l.now, ...l.next, ...l.later].map((r) => r.id);

test('the seven rules put tasks in order, with the chip of the rule that applies', () => {
  const st = mk([task('old'), task('soon', { deadline: '2026-11-20' }), task('holds'), task('w', { waitsOn: ['holds'] }), task('urgent', { priority: 'urgent' }), task('due', { deadline: '2026-11-12' }), task('doing', { status: 'doing' }), task('rev', { status: 'review' }), task('low', { priority: 'low' })]);
  const l = triageLists(st, all, T);
  assert.deepEqual(flat(l), ['rev', 'doing', 'due', 'urgent', 'holds', 'soon', 'old', 'w', 'low']);
  assert.deepEqual([...l.now, ...l.next].map((r) => r.reason), ['Needs review', 'In progress', 'Due today', 'Urgent', 'Holds up 1', 'Due Fri', 'Oldest first', 'Oldest first', 'Low']);
  assert.deepEqual(l.now.concat(l.next, l.later).map((r) => r.n), [1, 2, 3, 4, 5, 6, 7, 8, 9]);
});

test('ties keep the order tasks sit in', () => {
  assert.deepEqual(flat(triageLists(mk([task('a', { priority: 'high' }), task('b', { priority: 'high' })]), all, T)), ['a', 'b']);
});

test('Now is 3, Next the following 8, Later the rest; done tasks never count', () => {
  const st = mk(Array.from({ length: 15 }, (_, i) => task('t' + i)).concat([task('gone', { status: 'done' })]));
  const l = triageLists(st, all, T);
  assert.deepEqual([l.now.length, l.next.length, l.later.length, l.total], [NOW_SIZE, NEXT_SIZE, 4, 15]);
  assert.equal(l.later[0].n, 12);
});

test('a saved order wins over the rules; a new task slots in by the rules', () => {
  const a = [task('a'), task('b'), task('c', { priority: 'urgent' })];
  assert.deepEqual(flat(triageLists(mk(a), all, T)), ['c', 'a', 'b']);
  [['a', 1], ['b', 2], ['c', 3]].forEach(([id, r]) => { a.find((t) => t.id === id).triageRank = r; });
  const st = mk(a);
  assert.deepEqual(flat(triageLists(st, all, T)), ['a', 'b', 'c']);
  st.projects[0].tasks.push(task('new', { priority: 'urgent' })); // the rules put it where the saved Urgent one sat; the saved three keep their order
  assert.deepEqual(flat(triageLists(st, all, T)), ['a', 'new', 'b', 'c']);
  st.projects[0].tasks.push(task('late', { priority: 'low' }));
  assert.deepEqual(flat(triageLists(st, all, T)), ['a', 'new', 'b', 'c', 'late']);
});

test('the view narrows the list', () => {
  const st = mk([task('h1')], [task('w1'), task('w2')]);
  assert.deepEqual(flat(triageLists(st, { mode: 'area', id: 'a2' }, T)), ['w1', 'w2']);
  assert.deepEqual(flat(triageLists(st, { mode: 'project', id: 'p1' }, T)), ['h1']);
});

test('moveId puts an id at a place and clamps', () => {
  assert.deepEqual(moveId(['a', 'b', 'c'], 'a', 2), ['b', 'c', 'a']);
  assert.deepEqual(moveId(['a', 'b', 'c'], 'c', 0), ['c', 'a', 'b']);
  assert.deepEqual(moveId(['a', 'b'], 'a', 9), ['b', 'a']);
});
