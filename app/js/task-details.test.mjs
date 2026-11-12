// focus-deck-app/js/task-details.test.mjs -- run with: node app/js/task-details.test.mjs
import { notesSummary, labelsSummary, subtasksSummary, renderTaskDetails } from './task-details.js';
import { saveTaskEdit } from './in-tray.js';
import assert from 'node:assert';

const now = new Date('2026-10-08T12:00:00').getTime();
const cats = [{ id: 'c1', name: 'Bug', color: '#c00' }, { id: 'c2', name: 'Study', color: '#06c' }];

// The receipt's values: the whole note on one line, labels in order, "n of m", or a dash
assert.strictEqual(notesSummary(''), '—');
assert.strictEqual(notesSummary(undefined), '—');
assert.strictEqual(notesSummary('  \n '), '—');
assert.strictEqual(notesSummary('Call the\nplumber'), 'Call the plumber');
assert.strictEqual(labelsSummary({ categoryIds: ['c2', 'c1'] }, cats), 'Study, Bug');
assert.strictEqual(labelsSummary({ categoryIds: ['gone'] }, cats), '—');
assert.strictEqual(subtasksSummary([]), '—');
assert.strictEqual(subtasksSummary([{ status: 'done' }, { status: 'next' }]), '1 of 2');

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
  assert.ok(h.includes('data-action="detail-close"') && h.includes('aria-label="Close task details"'), 'the x close');
  assert.ok(h.includes('Boiler &lt;b&gt;') && h.includes('>Home<'), 'title (escaped) and project');
  assert.ok(h.includes('data-action="detail-status-open"') && h.includes('>Up next<'), 'the status stamp');
  assert.strictEqual((h.match(/class="dk-pencil"/g) || []).length, 9, 'one pencil per receipt line');
  ['High', 'Study, Bug', '1 of 2', 'Book it soon'].forEach((v) => assert.ok(h.includes('<em>' + v + '</em>'), 'line ' + v));
  assert.ok(h.includes('<em>Due in 2 days</em>'), 'due line');
  assert.ok(renderTaskDetails(st, {}, 't3', now).includes('data-action="detail-goto" data-task-id="t1">Boiler &lt;b&gt;</button>'), 'waits on names the task, and tapping it opens that task');
  assert.ok(h.includes('data-action="detail-goto" data-task-id="t3">Get quote</button>'), 'holds up lists the task that waits on this one');
  assert.ok(['2', '4', '3', '7', 'notes'].every((n) => h.includes('data-action="detail-edit" data-step="' + n + '"')), 'pencils open the Sort steps');
  assert.ok(h.includes('data-action="detail-subs"') && h.includes('data-action="detail-github"'), 'smaller steps and GitHub have their own screens');
  assert.ok(h.includes('data-action="detail-more"') && h.includes('>◎ Focus<') && !h.includes('vs-pop'), 'the more tag and the Focus stamp, drawer shut');
}
{
  const h = renderTaskDetails(st, { boardDrawer: 'status' }, 't1', now);
  assert.deepStrictEqual([...h.matchAll(/data-action="detail-status" data-status="(\w+)"/g)].map((m) => m[1]), ['next', 'doing', 'review', 'done'], 'four status stamps');
  const m = renderTaskDetails(st, { boardDrawer: 'more' }, 't1', now);
  ['Rename', 'Move to another project', 'Part of…', 'Holds up…', 'Delete'].forEach((l) => assert.ok(m.includes(l), 'drawer ' + l));
  assert.ok(m.includes('data-action="detail-delete"') && m.includes('danger'), 'Delete is red');
}
{
  const h = renderTaskDetails(st, { boardScreen: 'subs' }, 't3', now);
  assert.ok(h.includes('data-detail-newsub') && h.includes('data-action="detail-add-sub"') && h.includes('>Done<'), 'smaller steps: add and Done');
  const sub = renderTaskDetails(st, { boardScreen: 'subs' }, 't1', now);
  assert.ok(sub.includes('data-action="toggle-task" data-task="s1" data-project="p1" checked'), 'tick is the shared toggle');
  assert.ok(renderTaskDetails(st, { boardScreen: 'github' }, 't1', now).includes('create-github-issue'), 'GitHub screen of an unlinked task');
  const gh = { ...st, projects: [{ ...st.projects[0], tasks: [{ id: 'g', title: 'G', status: 'next', source: 'github', issueNumber: 212, url: 'https://github.com/o/r/issues/212' }] }] };
  const g = renderTaskDetails(gh, { boardScreen: 'github' }, 'g', now);
  assert.ok(g.includes('href="https://github.com/o/r/issues/212"') && g.includes('unlink-github-issue'), 'Open on GitHub and Unlink');
  assert.ok(renderTaskDetails(gh, {}, 'g', now).includes('<em>#212</em>'), 'the receipt names the issue');
}
{
  const edit = { taskId: 't1', step: 2, sub: null, selected: ['c2'], priority: 'high', due: '', projectId: 'p1', find: '', pickQuery: '', parent: null, subtasks: [], waitsOn: [], holdsUp: [], newSubtasks: [], notes: '', title: null };
  const h = renderTaskDetails(st, { edit }, 't1', now);
  assert.ok(h.includes('How important?') && h.includes('data-action="edit-save"') && h.includes('>Save<') && !h.includes('data-action="sort-next"') && !h.includes('sort-dots') && !h.includes('slip-more'), 'the Sort step in edit mode: Save, no Next, no dots, no slip menu');
}
// Move offers every project even when the view tape shows only one
{
  const two = { ...st, _ui: { view: { mode: 'project', id: 'p1' } }, projects: [...st.projects, { id: 'p2', name: 'Garden', color: '#C2731E', tasks: [] }] };
  const edit = { taskId: 't1', step: 1, sub: null, selected: [], priority: null, due: '', projectId: 'p1', find: '', pickQuery: '', parent: null, subtasks: [], waitsOn: [], holdsUp: [], newSubtasks: [], notes: '', title: null };
  const h = renderTaskDetails(two, { edit }, 't1', now);
  assert.ok(h.includes('data-key="p1"') && h.includes('data-key="p2"'), 'the project step lists Home and Garden');
}
// Save writes only what changed, and taking every label off is a change
{
  const calls = [];
  const deps = { updateTaskFields: (id, f) => calls.push(['update', id, f]), applyTaskMove: (m) => calls.push(['move', m]), addTask: () => null, projects: st.projects, labelIdByName: (n) => n };
  const t = st.projects[0].tasks[0], base = { projectId: 'p1', selected: ['c2', 'c1'], priority: 'high', due: '2026-10-10', notes: 'Book it\nsoon', title: null, parent: null, subtasks: ['s1', 's2'], waitsOn: [], holdsUp: ['t3'], newSubtasks: [] };
  saveTaskEdit(t, st.projects[0], base, deps);
  assert.deepStrictEqual(calls, [], 'nothing changed, nothing written');
  saveTaskEdit(t, st.projects[0], { ...base, selected: [], priority: '', projectId: 'p2' }, deps);
  assert.deepStrictEqual(calls.slice(0, 2), [['move', { taskId: 't1', toProjectId: 'p2' }], ['update', 't1', { categoryIds: [], priority: null }]], 'move, then the changed fields');
}
console.log('task-details tests passed');
