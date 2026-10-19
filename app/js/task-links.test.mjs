// focus-deck-app/js/task-links.test.mjs -- run with: node --test app/js/task-links.test.mjs
// One test per rule in docs/4-systems/task-links.md
import test from 'node:test';
import assert from 'node:assert';
import { canSetParent, canWaitOn, holdsUp, subtasksOf, dropLinksTo, detachForMove, tiesOf, isBlocked, unblockCount, rankFocusPool, tieSummary, tieLineHtml } from './task-links.js';

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

test('the focus ranking drops blocked tasks and picks the biggest unblocker', () => {
  const ps = mk(); // a1 has open subtask a2; b1 waits on a3; a3 holds up b1 (b2 is done)
  assert.ok(isBlocked(ps, 'a1') && isBlocked(ps, 'b1') && !isBlocked(ps, 'a3') && !isBlocked(ps, 'a2'));
  assert.strictEqual(unblockCount(ps, 'a3'), 1);
  assert.strictEqual(unblockCount(ps, 'a2'), 1, 'a subtask frees its open parent');
  assert.strictEqual(unblockCount(ps, 'b1'), 0);
  assert.deepStrictEqual(rankFocusPool(ps, ['a1', 'a2', 'a3', 'b1']), { candidates: ['a2', 'a3'], allBlocked: false });
  assert.deepStrictEqual(rankFocusPool(ps, ['a1', 'b1', 'a3']).candidates, ['a3'], 'blocked ones are left out');
  ps[1].tasks.push({ id: 'b3', status: 'next' });
  assert.deepStrictEqual(rankFocusPool(ps, ['b3', 'b1', 'a1']).candidates, ['b3'], 'all zero: every unblocked id');
});

test('when every task is blocked the whole pool comes back marked allBlocked', () => {
  assert.deepStrictEqual(rankFocusPool(mk(), ['a1', 'b1']), { candidates: ['a1', 'b1'], allBlocked: true });
});

test('tieSummary: parent only when asked, subtask counts, open waits-on with other folder, holds-up, isWaiting', () => {
  const ps = mk();
  ps[0].name = 'Home'; ps[1].name = 'Work';
  ps[0].tasks.forEach((t) => { t.title = t.id.toUpperCase(); });
  assert.deepStrictEqual(tieSummary(ps, 'a2', { showParent: true }).parent, { id: 'a1', title: 'A1' });
  assert.strictEqual(tieSummary(ps, 'a2').parent, null);
  const a1 = tieSummary(ps, 'a1');
  assert.deepStrictEqual(a1.subs, { total: 1, done: 0 });
  assert.ok(a1.isWaiting, 'an open subtask makes the parent wait');
  const b1 = tieSummary(ps, 'b1');
  assert.deepStrictEqual(b1.waits, [{ id: 'a3', title: 'A3', folder: 'Home' }]);
  assert.ok(b1.isWaiting);
  assert.strictEqual(tieSummary(ps, 'a3').holds, 1, 'only the open waiter counts');
  assert.ok(!tieSummary(ps, 'b2').isWaiting, 'a done task never waits');
  assert.strictEqual(tieLineHtml(tieSummary(ps, 'nope')), '', 'no ties, no line');
});

test('tieLineHtml: text, escaped names, same-folder waits show no folder', () => {
  const ps = [{ id: 'p', name: 'P', tasks: [{ id: 'x', title: 'Do <it>', status: 'next', waitsOn: ['y'] }, { id: 'y', title: 'Y & Z', status: 'next' }] }];
  const h = tieLineHtml(tieSummary(ps, 'x'));
  assert.ok(h.includes('waits on <button type="button" class="tie-name" data-action="scroll-to-task" data-task="y">Y &amp; Z</button></span>'), h);
  assert.ok(tieLineHtml(tieSummary(ps, 'y')).includes('holds up 1'));
});
