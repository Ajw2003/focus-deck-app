// focus-deck-app/js/board-view.test.mjs -- run with: node app/js/board-view.test.mjs
import { renderBoard, normalizeBoardCol } from './board-view.js';
import assert from 'node:assert';

const now = new Date('2026-10-08T12:00:00').getTime(); // a Thursday
const st = {
  categories: [{ id: 'c1', name: 'Bug', color: '#c00' }, { id: 'c2', name: 'Study', color: '#06c' }],
  projects: [
    { id: 'pa', name: 'Home', color: '#3E8E5E', tasks: [
      { id: 't1', title: 'Bins out', status: 'next', priority: 'high', categoryIds: ['c1', 'c2'] },
      { id: 't2', title: 'Mop', status: 'doing', categoryIds: [] },
      { id: 't3', title: 'Paint <b>', status: 'done', updatedAt: now - 3600e3, categoryIds: [] },
    ] },
    { id: 'pb', name: 'Empty one', color: '#4D6FB8', tasks: [] },
  ],
};
const count = (h, re) => (h.match(re) || []).length;
const ids = (h) => [...h.matchAll(/data-task-id="([^"]+)"/g)].map((m) => m[1]);
const UI = { boardProject: null, boardCol: 'next' };

{
  const h = renderBoard(st, UI, now);
  assert.ok(h.includes('Up next <b>1</b>') && h.includes('In progress <b>1</b>') && h.includes('Done this week <b>1</b>'), 'three tabs with counts');
  assert.ok(h.includes('aria-selected="true" class="calm-tab on" data-action="board-col" data-col="next"'), 'default tab is Up next');
  assert.deepStrictEqual(ids(h), ['t1'], 'only the open tab shows cards');
  assert.ok(h.includes('<option value="">Project: All</option>') && h.includes('<option value="pa">Home</option>'), 'Project menu');
  assert.ok(h.includes('data-board-find') && h.includes('data-action="board-filter"'), 'Find and Filter');
  assert.ok(!h.includes('calm-drawer'), 'drawer closed to start with');
  assert.ok(h.includes('data-action="board-move" data-task="t1" data-to="doing"') && h.includes('>In progress</button>'), 'Up next card moves to In progress');
  assert.ok(h.includes('data-action="toggle-task" data-task="t1" data-project="pa"'), 'checkbox uses toggle-task');
  assert.ok(h.includes('<span class="board-card-proj">Home</span>') && h.includes('<span class="cchip" style="--c:#c00"><i></i>Bug</span>') && !h.includes('Study</span>'), 'project name and the first label as the one chip');
  assert.ok(!h.includes('priority-chip'), 'no separate priority chip');
  assert.ok(h.includes('style="--proj-color:#c00"'), 'edge colour on --proj-color, from the chip');
  assert.ok(renderBoard(st, { ...UI, boardCol: 'doing' }, now).includes('<span class="cchip none">No category</span>'), 'a card with nothing shows No category');
  assert.ok(h.includes('No task selected. Choose a task on the left'), 'empty-panel hint');
  assert.ok(!h.includes('calm-card on'), 'nothing selected to start with');
  assert.ok(renderBoard(st, { ...UI, boardSelected: 't1' }, now).includes('calm-card on'), 'a selected card gets the ring');
  assert.ok(!renderBoard(st, { ...UI, boardSelected: 'gone' }, now).includes('calm-card on'), 'a selected id that is gone selects nothing');
}
{
  const doing = renderBoard(st, { ...UI, boardCol: 'doing' }, now);
  assert.deepStrictEqual(ids(doing), ['t2']);
  assert.ok(doing.includes('data-to="next"') && doing.includes('>Up next</button>'), 'In progress card moves back to Up next');
  const done = renderBoard(st, { ...UI, boardCol: 'done' }, now);
  assert.deepStrictEqual(ids(done), ['t3']);
  assert.ok(!done.includes('board-move') && done.includes('Paint &lt;b&gt;') && !done.includes('Paint <b>'), 'Done cards have no move button; titles are escaped');
  assert.strictEqual(normalizeBoardCol('bogus'), 'next');
}
{
  const h = renderBoard(st, { ...UI, boardProject: 'pa' }, now);
  assert.ok(!h.includes('board-card-proj') && h.includes('<option value="pa" selected>'), 'project name hidden on a card when narrowed');
  const none = renderBoard(st, { ...UI, boardProject: 'pb' }, now);
  assert.ok(none.includes('Nothing matches.') && !none.includes('<article'), 'empty narrowed list says so');
  assert.ok(renderBoard(st, { ...UI, boardCol: 'doing', boardFind: 'zzz' }, now).includes('Nothing matches.'));
  assert.ok(renderBoard({ projects: [] }, { boardCol: 'doing' }, now).includes('Nothing in progress. Press'), 'empty tab line');
}
{
  const withCat = { ...st, projectCategories: [{ id: 'pc1', name: 'Home life', color: '#3E8E5E' }] };
  const open = renderBoard(withCat, { ...UI, boardFilterOpen: true, boardShow: 'subs' }, now);
  assert.ok(open.includes('Filter (1)') && open.includes('calm-drawer') && open.includes('>Home life</button>'), 'drawer with Category');
  ['Everything', 'Has subtasks', 'Waiting on something', 'Holding others up'].forEach((l) => assert.ok(open.includes('>' + l + '</button>'), l));
  assert.ok(open.includes('Nothing matches.') && open.includes('Show 0 tasks'), 'Has subtasks narrows the list');
}
{
  const many = { categories: [], projects: [{ id: 'p', name: 'P', color: '#111', tasks: Array.from({ length: 12 }, (_, i) => ({ id: 'n' + i, title: 'Job ' + i, status: 'next', order: i, categoryIds: [] })) }] };
  const h = renderBoard(many, UI, now);
  assert.strictEqual(ids(h).length, 7, 'Cards at once defaults to 7');
  assert.ok(h.includes('Show 5 more (5 left)'), 'show more line');
  const more = renderBoard(many, { ...UI, boardShown: 14 }, now);
  assert.strictEqual(ids(more).length, 12);
  assert.ok(!more.includes('calm-more'));
  const five = renderBoard({ ...many, comfort: { chunk: { value: 5, updatedAt: 1 } } }, UI, now);
  assert.strictEqual(ids(five).length, 5, 'the setting sets the group size');
  assert.ok(five.includes('Show 5 more (7 left)'));
}

{
  const mkSt = (ties) => ({ categories: [], projects: [
    { id: 'pa', name: 'Home', color: '#3E8E5E', tasks: [
      { id: 'a', title: 'Parent', status: 'next', categoryIds: [] },
      { id: 'b', title: 'Child <i>', status: 'next', categoryIds: [], ...(ties ? { parentId: 'a' } : {}) },
      { id: 'c', title: 'Later', status: 'next', categoryIds: [], ...(ties ? { waitsOn: ['d'] } : {}) },
    ] },
    { id: 'pb', name: 'Work', color: '#4D6FB8', tasks: [{ id: 'd', title: 'Other', status: 'next', categoryIds: [] }] },
  ] });
  const h = renderBoard(mkSt(true), { boardProject: null, boardCol: 'next' }, now);
  assert.ok(h.includes('<b>0/1</b> done') && h.includes('board-segs') && !h.includes('1 subtask \u00b7'), 'parent shows its subtask as 0/1 done with the bar');
  assert.deepStrictEqual(ids(h), ['a', 'c', 'd'], 'the subtask is not a card of its own');
  assert.ok(h.includes('waits on <button type="button" class="tie-name" data-action="scroll-to-task" data-task="d">Other</button> \u00b7 Work'), 'other folder named');
  assert.ok(h.includes('holds up 1'), 'holds up');
  assert.strictEqual(count(h, /board-card calm-card is-waiting/g), 2, 'parent (open subtask) and waiter are soft');
  assert.ok(!h.includes('Child'), 'the subtask title is not on a card');
  const plain = renderBoard(mkSt(false), { boardProject: null, boardCol: 'next' }, now);
  assert.ok(!plain.includes('tie-line') && !plain.includes('is-waiting'), 'no ties, nothing added');
}
{
  // The priority and due date line (#211).
  const mk = (extra, colourBy = ['category']) => ({ categories: st.categories, comfort: { colourBy: { value: colourBy, updatedAt: 1 } },
    projects: [{ id: 'pa', name: 'Home', color: '#3E8E5E', tasks: [{ id: 'g1', title: 'Card', status: 'next', categoryIds: ['c1'], ...extra }] }] });
  const both = renderBoard(mk({ priority: 'urgent', deadline: '2020-01-01' }), UI, now);
  assert.ok(both.includes('gl-glance') && both.includes('gl-prio') && both.includes('Urgent') && both.includes('--c:#b42318') && both.includes('deadline-chip'), 'both shown');
  const prio = renderBoard(mk({ priority: 'low' }), UI, now);
  assert.ok(prio.includes('gl-prio') && prio.includes('Low') && !prio.includes('deadline-chip'), 'priority only');
  const date = renderBoard(mk({ deadline: '2099-01-01' }), UI, now);
  assert.ok(date.includes('gl-glance') && date.includes('deadline-chip') && !date.includes('gl-prio'), 'date only');
  assert.ok(!renderBoard(mk({}), UI, now).includes('gl-glance'), 'neither: no line');
  const pk = renderBoard(mk({ priority: 'high', deadline: '2099-01-01' }, ['priority']), UI, now);
  assert.ok(!pk.includes('gl-prio') && pk.includes('deadline-chip'), 'priority key: no priority in the line, date stays');
  const dk = renderBoard(mk({ priority: 'high', deadline: '2099-01-01' }, ['due']), UI, now);
  assert.ok(dk.includes('gl-prio') && !dk.includes('deadline-chip'), 'due key: no date chip in the line');
  const done = renderBoard(mk({ status: 'done', deadline: '2020-01-01', updatedAt: now - 3600e3 }), { ...UI, boardCol: 'done' }, now);
  assert.ok(done.includes('data-task-id="g1"') && !done.includes('deadline-chip') && !done.includes('gl-glance'), 'done task: no date');
}
console.log('board-view tests passed');

// The add row (#241): only with one project chosen, only on Up next, and it adds to that project
{
  assert.ok(!renderBoard(st, UI, now).includes('add-row'), 'no add row with Project: All');
  const h = renderBoard(st, { ...UI, boardProject: 'pa' }, now);
  assert.ok(h.includes('<form class="add-task-form add-row" data-action="add-task" data-project="pa">') && h.includes('placeholder="Add a task to Home…"'), 'Up next with Home chosen has Home\'s add row');
  assert.ok(h.indexOf('add-row') < h.indexOf('calm-cards'), 'the row sits above the list');
  assert.ok(!renderBoard(st, { ...UI, boardProject: 'pa', boardCol: 'doing' }, now).includes('add-row'), 'no add row on In progress');
  assert.ok(renderBoard(st, { ...UI, boardProject: 'pa', addDraft: { pa: 'Half' } }, now).includes('value="Half"'), 'a draft survives a repaint');
}
