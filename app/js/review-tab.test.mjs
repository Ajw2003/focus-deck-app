// run with: node --test app/js/review-tab.test.mjs  (docs/4-systems/review-tab.md)
import { test } from 'node:test';
import assert from 'node:assert';
import { reviewLists } from './board.js';
import { renderReview } from './review-view.js';
import { renderRail } from './render.js';
import { state } from './state.js';
import { setTaskStatus, undoDone } from './mutations.js';

const now = new Date('2026-10-08T12:00:00').getTime(); // a Thursday
const mk = () => ({
  projectCategories: [{ id: 'a1', name: 'Home', color: '#3a3' }],
  projects: [
    { id: 'pa', name: 'Alpha', color: '#3E8E5E', categoryId: 'a1', tasks: [
      { id: 'r1', title: 'Old <review>', status: 'review', updatedAt: 1, issueNumber: 7, url: 'https://x/7' },
      { id: 'r2', title: 'New review', status: 'review', updatedAt: 2 },
      { id: 'd1', title: 'Finished', status: 'done', completedAt: now - 1000, statusBeforeDone: 'doing' },
      { id: 'd0', title: 'Last month', status: 'done', completedAt: now - 20 * 864e5 },
    ] },
    { id: 'pb', name: 'Beta', color: '#46b', tasks: [{ id: 'r3', title: 'Beta review', status: 'review', updatedAt: 3 }] },
  ],
});
const ids = (l) => l.map((t) => t.id);

test('list selection: review only, newest first; done this week only', () => {
  const l = reviewLists(mk(), { mode: 'all', id: null }, now);
  assert.deepStrictEqual(ids(l.waiting), ['r3', 'r2', 'r1']);
  assert.deepStrictEqual(ids(l.done), ['d1']);
});
test('view filtering narrows both lists', () => {
  const st = mk();
  assert.deepStrictEqual(ids(reviewLists(st, { mode: 'project', id: 'pb' }, now).waiting), ['r3']);
  assert.deepStrictEqual(ids(reviewLists(st, { mode: 'project', id: 'pb' }, now).done), []);
  assert.deepStrictEqual(ids(reviewLists(st, { mode: 'area', id: 'a1' }, now).waiting), ['r2', 'r1']);
});
test('markup: one task on the clipboard, two stamps, dots, the Done this week tag, escaping, empty state, badge', () => {
  const ui = { view: { mode: 'all' } };
  const h = renderReview(mk(), ui, now);
  assert.ok(h.includes('Finished?') && h.includes('Beta review') && !h.includes('New review'), 'only the newest waiting task');
  assert.ok(h.includes('✓ Looks good') && h.includes('✎ More work') && h.includes('data-action="review-done"') && h.includes('data-action="review-more"') && h.includes('data-action="review-list"'));
  assert.ok(h.includes('aria-label="Step 1 of 3"') && !h.includes('Done ✓'));
  assert.ok(renderReview(mk(), { view: { mode: 'project', id: 'pa' } }, now).includes('Old &lt;review&gt;') === false, 'newest of Alpha is New review');
  const one = { projects: [{ id: 'p', name: 'Alpha', tasks: [{ id: 'x', title: 'Old <review>', status: 'review', issueNumber: 7, url: 'https://x/7' }] }] };
  const h1 = renderReview(one, ui, now);
  assert.ok(h1.includes('<a href="https://x/7"') && h1.includes('Old &lt;review&gt;') && h1.includes('Alpha'));
  const e = renderReview({ projects: [] }, ui, now);
  assert.ok(e.includes('All reviewed ✓') && !e.includes('review-done'));
  const l = renderReview(mk(), { view: { mode: 'all' }, rvList: true }, now);
  assert.ok(l.includes('Done this week') && l.includes('rv-struck') && l.includes('↶ Undo') && l.includes('data-kind="list"') && l.includes('review-back') && !l.includes('review-done'));
  assert.ok(renderRail('review', 0, 3).includes('aria-label="3 to review"'));
  assert.ok(!renderRail('review', 0, 0).includes('rail-count'));
});
test('the Undo slip shows only while the task is where the stamp left it', () => {
  state.projects.length = 0;
  state.projects.push({ id: 'p', name: 'p', tasks: [{ id: 'a', title: 'a', status: 'done', completedAt: now }, { id: 'b', title: 'b', status: 'doing' }, { id: 'c', title: 'c', status: 'review', updatedAt: 1 }] });
  const show = (last) => renderReview(state, { view: { mode: 'all' }, rvLast: last, rvDone: 1 }, now);
  assert.ok(show({ id: 'a', kind: 'done' }).includes('Done ✓') && show({ id: 'a', kind: 'done' }).includes('data-kind="done"'));
  assert.ok(show({ id: 'b', kind: 'more' }).includes('Sent back ✓'));
  assert.ok(!show({ id: 'a', kind: 'more' }).includes('Sent back ✓') && !show({ id: 'c', kind: 'done' }).includes('Done ✓'));
  assert.ok(show(null).includes('aria-label="Step 2 of 2"'));
  state.projects.length = 0;
});
test('actions and Undo, with GitHub calls', async () => {
  globalThis.localStorage = { getItem: () => 'tok', setItem() {}, removeItem() {} };
  const calls = [];
  globalThis.fetch = async (url, o = {}) => { calls.push((o.method || 'GET') + ' ' + String(url).replace('https://api.github.com', '')); return { ok: true, status: 200, json: async () => ({}) }; };
  const gh = { id: 'g', title: 'g', status: 'review', source: 'github', repoFullName: 'o/r', issueNumber: 5 };
  state.projects.length = 0;
  state.projects.push({ id: 'p', name: 'p', tasks: [gh, { id: 'g2', title: 'g2', status: 'review', source: 'github', repoFullName: 'o/r', issueNumber: 6 }, { id: 'n', title: 'n', status: 'done' }] });
  setTaskStatus('g', 'done'); // Looks good
  await new Promise((r) => setTimeout(r, 30));
  assert.strictEqual(gh.status, 'done');
  assert.ok(calls.includes('DELETE /repos/o/r/issues/5/labels/needs%20review'), calls.join(' | '));
  assert.ok(calls.some((c) => c.startsWith('PATCH /repos/o/r/issues/5')), 'issue closed: ' + calls.join(' | '));
  undoDone('g');
  assert.strictEqual(gh.status, 'review', 'Undo restores review');
  calls.length = 0;
  setTaskStatus('g2', 'doing'); // Needs more work
  await new Promise((r) => setTimeout(r, 30));
  assert.ok(calls.includes('DELETE /repos/o/r/issues/6/labels/needs%20review'), calls.join(' | '));
  undoDone('n'); // done with no stored previous status
  assert.strictEqual(state.projects[0].tasks[2].status, 'next');
  delete globalThis.fetch; delete globalThis.localStorage;
});
