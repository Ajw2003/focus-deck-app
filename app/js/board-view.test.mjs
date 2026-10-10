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

{
  const h = renderBoard(st, { boardProject: null, boardCol: 'next' }, now);
  assert.ok(h.includes('aria-pressed="true" data-action="board-project" data-project-id=""'), 'All projects pressed');
  assert.strictEqual(count(h, /data-action="board-project"/g), 3, 'All + one pill per project');
  assert.ok(h.includes('<b class="board-count">1</b>'), 'column counts shown');
  assert.strictEqual(count(h, /<article class="board-card/g), 3, 'three cards');
  assert.ok(h.includes('data-task-id="t1" data-status="next"') && h.includes('data-status="doing"') && h.includes('data-status="done"'), 'cards carry id and status');
  assert.ok(h.includes('data-action="toggle-task" data-task="t1" data-project="pa"'), 'checkbox uses toggle-task');
  assert.ok(h.includes('<span class="board-card-proj">Home</span>') && h.includes('Bug · Study'), 'project and category names');
  assert.ok(h.includes('priority-chip') && h.includes('>High<'), 'priority chip');
  assert.ok(h.includes('Paint &lt;b&gt;') && !h.includes('Paint <b>'), 'titles are escaped');
  assert.ok(!h.includes('board-frame') && !h.includes('Back to all projects'), 'no frame when all');
  assert.ok(h.includes('data-action="board-col" data-col="doing"') && h.includes('Up next <b'), 'phone switch');
  assert.ok(h.includes('class="board-col is-current" data-col="next"'), 'default column is next');
}
{
  const h = renderBoard(st, { boardProject: 'pa', boardCol: 'done' }, now);
  assert.ok(h.includes('class="board-frame" style="--proj-color:#3E8E5E"'), 'narrowed frame in the project colour');
  assert.ok(h.includes('data-action="board-project" data-project-id="">&larr; Back to all projects'), 'back button');
  assert.ok(h.includes('data-project-id="pa"') && /aria-pressed="true" data-action="board-project" data-project-id="pa"/.test(h), 'project pill pressed');
  assert.ok(!h.includes('board-card-proj'), 'project name not repeated inside its own frame');
  assert.ok(h.includes('class="board-col is-current" data-col="done"'), 'ui.boardCol picks the phone column');
}
{
  const h = renderBoard(st, { boardProject: 'pb' }, now);
  assert.strictEqual(count(h, /class="board-empty"/g), 3, 'an empty line per column');
  assert.ok(h.includes('Nothing waiting.') && h.includes('Nothing in progress.') && h.includes('Nothing finished yet this week.'));
  assert.ok(h.includes('<b class="board-count">0</b>'), 'zero counts');
}
{
  const h = renderBoard(st, { boardProject: 'gone', boardCol: 'bogus' }, now);
  assert.ok(!h.includes('board-frame') && h.includes('data-col="next"'), 'unknown project reads as all, unknown column as next');
  assert.strictEqual(normalizeBoardCol('doing'), 'doing');
  assert.strictEqual(normalizeBoardCol(undefined), 'next');
}
console.log('board-view tests passed');
