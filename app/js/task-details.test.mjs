// focus-deck-app/js/task-details.test.mjs -- run with: node app/js/task-details.test.mjs
import { notesSummary, whenSummary, labelsSummary, subtasksSummary, linksSummary, renderTaskDetails } from './task-details.js';
import { renderBoard } from './board-view.js';
import assert from 'node:assert';

const now = new Date('2026-10-08T12:00:00').getTime();
const cats = [{ id: 'c1', name: 'Bug', color: '#c00' }, { id: 'c2', name: 'Study', color: '#06c' }];

// Notes: first line, shortened, or None
assert.strictEqual(notesSummary(''), 'None');
assert.strictEqual(notesSummary(undefined), 'None');
assert.strictEqual(notesSummary('  \n '), 'None');
assert.strictEqual(notesSummary('Call the plumber'), 'Call the plumber');
assert.strictEqual(notesSummary('First line\nsecond line'), 'First line…');
assert.strictEqual(notesSummary('x'.repeat(50)), 'x'.repeat(40) + '…');

// Priority and due date use card-key's due wording
assert.strictEqual(whenSummary({ status: 'next' }, 'amber', now), 'None set');
assert.strictEqual(whenSummary({ status: 'next', priority: 'high', deadline: '2026-10-10' }, 'amber', now), 'High priority · Due in 2 days');
assert.strictEqual(whenSummary({ status: 'next', priority: 'low' }, 'amber', now), 'Low priority');
assert.strictEqual(whenSummary({ status: 'next', deadline: '2026-10-08' }, 'amber', now), 'Due today');
assert.strictEqual(whenSummary({ status: 'next', deadline: '2026-10-01' }, 'amber', now), 'Past its date');
assert.strictEqual(whenSummary({ status: 'next', deadline: '2026-10-01' }, 'red', now), 'Overdue');

// Labels: names in order, first is the category
assert.strictEqual(labelsSummary({ categoryIds: ['c2', 'c1'] }, cats), 'Study, Bug');
assert.strictEqual(labelsSummary({ categoryIds: ['gone'] }, cats), 'None');
assert.strictEqual(labelsSummary({}, cats), 'None');

// Subtasks and links
assert.strictEqual(subtasksSummary([]), 'None');
assert.strictEqual(subtasksSummary([{ status: 'done' }, { status: 'next' }]), '1 of 2 done');
assert.strictEqual(linksSummary(false, 0, 0), 'None');
assert.strictEqual(linksSummary(false, 1, 2), 'Waits on 1, holds up 2');
assert.strictEqual(linksSummary(true, 0, 0), 'Part of 1');
assert.strictEqual(linksSummary(true, 1, 0), 'Part of 1, waits on 1');

// The panel
const st = {
  categories: cats,
  projects: [{ id: 'p1', name: 'Home', color: '#3E8E5E', tasks: [
    { id: 't1', title: 'Boiler <b>', status: 'next', priority: 'high', deadline: '2026-10-10', notes: 'Book it\nsoon', categoryIds: ['c2', 'c1'] },
    { id: 's1', title: 'Find number', status: 'done', parentId: 't1' },
    { id: 's2', title: 'Ring them', status: 'next', parentId: 't1', waitsOn: ['t3'] },
    { id: 't3', title: 'Get quote', status: 'next', waitsOn: ['t1'] },
  ] }],
};
{
  const h = renderTaskDetails(st, {}, 't1', now);
  assert.ok(h.includes('Task details') && h.includes('Close ×'), 'heading and Close');
  assert.ok(h.includes('Boiler &lt;b&gt;') && h.includes('in Home'), 'title (escaped) and project');
  assert.ok(h.includes('<option value="doing">In progress</option>'), 'status menu');
  assert.strictEqual((h.match(/class="set-head"/g) || []).length, 5, 'five folded rows');
  assert.strictEqual((h.match(/class="set-body"/g) || []).length, 0, 'none open to start with');
  ['Book it…', 'High priority · Due in 2 days', 'Study, Bug', '1 of 2 done', 'Holds up 1'].forEach((v) => assert.ok(h.includes('>' + v + '<'), 'summary ' + v));
  assert.ok(h.includes('Changes save as you make them.') && h.includes('Focus on this') && h.includes('Delete'), 'footer');
}
{
  const h = renderTaskDetails(st, { boardOpen: 'subtasks' }, 't1', now);
  assert.strictEqual((h.match(/class="set-body"/g) || []).length, 1, 'one row open');
  assert.ok(h.includes('class="set open"') && h.includes('aria-expanded="true"'), 'open row marked');
  assert.ok(h.includes('waiting') && h.includes('+ Add a subtask'), 'waiting subtask and add button');
  assert.ok(h.includes('data-action="toggle-task" data-task="s1" data-project="p1" checked'), 'tick is the shared toggle');
}
{
  const h = renderTaskDetails(st, { boardOpen: 'labels' }, 't1', now);
  assert.ok(h.includes('Category') && h.includes('Make category') && h.includes('data-cat="c1"'), 'first label is Category, others can be made one');
  assert.ok(h.includes('Add or remove labels') && h.includes('name="categoryIds"'), 'the label picker');
}
{
  const h = renderTaskDetails(st, { boardOpen: 'links' }, 't3', now);
  assert.ok(h.includes('Waits on') && h.includes('data-action="detail-goto" data-task-id="t1"'), 'linked task is a button that selects it');
  assert.ok(renderTaskDetails(st, { boardOpen: 'nonsense' }, 't1', now).indexOf('set-body') < 0, 'unknown row id opens nothing');
}
{
  const ui = { boardCol: 'next', boardSelected: 't1' };
  assert.ok(renderBoard(st, ui, now).includes('Task details'), 'the Board shows the panel for the selected card');
  assert.ok(renderBoard(st, { ...ui, boardSelected: null }, now).includes('No task selected.'), 'and the hint when nothing is selected');
}
console.log('task-details tests passed');
