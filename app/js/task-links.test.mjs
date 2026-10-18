// focus-deck-app/js/task-links.test.mjs -- run with: node --test app/js/task-links.test.mjs
// One test per rule in docs/4-systems/task-links.md
import test from 'node:test';
import assert from 'node:assert';
import { canSetParent, canWaitOn, holdsUp, subtasksOf, dropLinksTo, detachForMove, tiesOf } from './task-links.js';

const mk = () => [
  { id: 'pA', tasks: [{ id: 'a1', status: 'next' }, { id: 'a2', status: 'next', parentId: 'a1' }, { id: 'a3', status: 'next' }] },
  { id: 'pB', tasks: [{ id: 'b1', status: 'next', waitsOn: ['a3'] }, { id: 'b2', status: 'done', waitsOn: ['a3'] }] },
];

test('a parent is in the same project and not the task itself', () => {
  const ps = mk();
  assert.ok(canSetParent(ps, 'a3', 'a1'));
  assert.ok(!canSetParent(ps, 'a3', 'b1'), 'other project');
  assert.ok(!canSetParent(ps, 'a3', 'a3'), 'itself');
  assert.ok(!canSetParent(ps, 'a3', 'gone'), 'missing');
});
test('one level deep: no second-level subtask, and a task with subtasks stays a parent', () => {
  const ps = mk();
  assert.ok(!canSetParent(ps, 'a3', 'a2'), 'a subtask cannot be a parent');
  assert.ok(!canSetParent(ps, 'a1', 'a3'), 'a parent cannot become a subtask');
});
test('a waits-on never loops, including through three tasks', () => {
  const ps = [{ id: 'p', tasks: [{ id: 'x', waitsOn: ['y'] }, { id: 'y', waitsOn: ['z'] }, { id: 'z' }] }];
  assert.ok(!canWaitOn(ps, 'x', 'x'));
  assert.ok(!canWaitOn(ps, 'z', 'x'), 'z->x->y->z');
  assert.ok(canWaitOn(ps, 'x', 'z'));
  assert.ok(!canWaitOn(ps, 'x', 'gone'), 'a task that does not exist');
});
test('holds up is read from waitsOn, open tasks only; subtasksOf lists children', () => {
  const ps = mk();
  assert.deepStrictEqual(holdsUp(ps, 'a3').map((t) => t.id), ['b1']);
  assert.deepStrictEqual(subtasksOf(ps, 'a1').map((t) => t.id), ['a2']);
});
test('deleting a task drops it from every parentId and waitsOn', () => {
  const ps = mk();
  assert.ok(dropLinksTo(ps, 'a1') && !ps[0].tasks[1].parentId);
  assert.ok(dropLinksTo(ps, 'a3') && !ps[1].tasks[0].waitsOn);
  assert.ok(!dropLinksTo(ps, 'a3'), 'nothing left to change');
});
test('moving detaches the task from its parent and its subtasks from it', () => {
  const ps = mk();
  assert.ok(detachForMove(ps, 'a2') && !ps[0].tasks[1].parentId);
  const qs = mk();
  assert.ok(detachForMove(qs, 'a1') && !qs[0].tasks[1].parentId);
});
test('links to ids that no longer exist are ignored when read', () => {
  const ps = [{ id: 'p', tasks: [{ id: 'k', parentId: 'gone', waitsOn: ['gone', 'k2'] }, { id: 'k2' }] }];
  assert.deepStrictEqual(tiesOf(ps, 'k'), { parent: null, subtasks: [], waitsOn: ['k2'], holdsUp: [] });
  assert.ok(canSetParent(ps, 'k2', 'k'), 'a dangling parent does not make k a subtask');
});
