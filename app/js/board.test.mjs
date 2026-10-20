// run with: node --test app/js/board.test.mjs  (Board columns, #143)
import test from 'node:test';
import assert from 'node:assert';
import { boardColumns, boardList, weekStart } from './board.js';

const NOW = new Date(2026, 9, 8, 15, 0).getTime(); // Thursday 8 Oct 2026, local
const MON = new Date(2026, 9, 5, 0, 0).getTime();
const task = (id, status, extra) => Object.assign({ id, title: id, status }, extra);
const proj = (id, tasks) => ({ id, name: id, tasks });
const ids = (l) => l.map((t) => t.id);
const state = () => ({
  inbox: [{ id: 'cap1', text: 'thought' }],
  projects: [
    proj('p1', [task('a', 'next', { sortOrder: 2 }), task('b', 'next', { sortOrder: 1 }), task('c', 'doing'), task('d', 'next')]),
    proj('p2', [task('e', 'next', { sortOrder: 1 }), task('f', 'doing', { sortOrder: 1 })]),
  ],
});

test('weekStart is the Monday 00:00 before now', () => {
  assert.strictEqual(weekStart(NOW), MON);
  assert.strictEqual(weekStart(MON), MON);
});

test('all projects: each project keeps its order, projects in st.projects order', () => {
  const c = boardColumns(state(), null, NOW);
  assert.deepStrictEqual(ids(c.next), ['b', 'a', 'd', 'e']);
  assert.deepStrictEqual(ids(c.doing), ['c', 'f']);
});

test('one project only', () => {
  const c = boardColumns(state(), 'p2', NOW);
  assert.deepStrictEqual(ids(c.next), ['e']);
  assert.deepStrictEqual(ids(c.doing), ['f']);
});

test('a single project column matches sortTasks order', () => {
  const c = boardColumns(state(), 'p1', NOW);
  assert.deepStrictEqual(ids(c.next), ['b', 'a', 'd']);
});

test('done: this week only, newest first, completedAt wins over updatedAt', () => {
  const st = state();
  st.projects[0].tasks.push(
    task('old', 'done', { completedAt: MON - 1 }),
    task('mon', 'done', { completedAt: MON }),
    task('new', 'done', { completedAt: NOW - 1000 }),
    task('fallback', 'done', { updatedAt: NOW - 5000 }),
    task('stale', 'done', { completedAt: MON - 5, updatedAt: NOW }),
  );
  st.projects[1].tasks.push(task('mid', 'done', { completedAt: MON + 1000 }));
  const c = boardColumns(st, null, NOW);
  assert.deepStrictEqual(ids(c.done), ['new', 'fallback', 'mid', 'mon']);
  assert.deepStrictEqual(ids(boardColumns(st, 'p2', NOW).done), ['mid']);
});

test('counts match the columns', () => {
  const st = state();
  st.projects[0].tasks.push(task('x', 'done', { completedAt: NOW - 1 }));
  const c = boardColumns(st, null, NOW);
  assert.deepStrictEqual(c.counts, { next: c.next.length, doing: c.doing.length, done: c.done.length });
  assert.deepStrictEqual(c.counts, { next: 4, doing: 2, done: 1 });
});

test('empty state and unknown project', () => {
  const empty = { inbox: [], projects: [] };
  assert.deepStrictEqual(boardColumns(empty, null, NOW), { next: [], doing: [], done: [], counts: { next: 0, doing: 0, done: 0 } });
  assert.strictEqual(boardColumns(state(), 'nope', NOW).counts.next, 0);
});

test('completedAt wins over updatedAt for Done this week; updatedAt is the fallback (#145)', () => {
  const st = { projects: [proj('p', [
    task('old-edited', 'done', { completedAt: MON - 86400e3, updatedAt: NOW - 3600e3 }), // finished last week, edited today
    task('fresh', 'done', { completedAt: NOW - 7200e3, updatedAt: 1 }),                   // finished today, stale updatedAt
    task('legacy', 'done', { updatedAt: NOW - 3600e3 }),                                  // no completedAt: falls back
  ])] };
  assert.deepStrictEqual(ids(boardColumns(st, null, NOW).done), ['legacy', 'fresh']);
});

test('boardList: tab, project, Find, Show and subtasks (#200)', () => {
  const st = {
    categories: [{ id: 'c1', name: 'Garden' }],
    projectCategories: [],
    projects: [
      proj('p', [
        task('a', 'next', { sortOrder: 1 }),
        task('b', 'next', { sortOrder: 2, categoryIds: ['c1'], waitsOn: ['a'], title: 'Mop' }),
        task('s', 'next', { sortOrder: 3, parentId: 'a' }),
        task('d', 'doing'),
      ]),
      Object.assign(proj('q', [task('e', 'next', { sortOrder: 1 })]), { name: 'Allotment', categoryId: 'pc1' }),
    ],
  };
  const list = (o) => ids(boardList(st, Object.assign({ tab: 'next' }, o), NOW).tasks);
  assert.deepStrictEqual(list({}), ['a', 'b', 'e'], 'subtasks of a live parent are not cards');
  assert.deepStrictEqual(boardList(st, { tab: 'next' }, NOW).counts, { next: 3, doing: 1, done: 0 }, 'counts leave out subtasks');
  assert.deepStrictEqual(list({ project: 'q' }), ['e']);
  assert.deepStrictEqual(list({ pcat: 'pc1' }), ['e']);
  assert.deepStrictEqual(list({ find: 'MOP' }), ['b'], 'task title');
  assert.deepStrictEqual(list({ find: 'allot' }), ['e'], 'project name');
  assert.deepStrictEqual(list({ find: 'garden' }), ['b'], 'label name');
  assert.deepStrictEqual(list({ show: 'subs' }), ['a']);
  assert.deepStrictEqual(list({ show: 'waits' }), ['a', 'b'], 'a waits on its open subtask, b on a');
  assert.deepStrictEqual(list({ show: 'holds' }), ['a'], 'a holds b up');
  assert.deepStrictEqual(ids(boardList(st, { tab: 'doing' }, NOW).tasks), ['d']);
});

test('boardList counts follow the same narrowing as the list (#217)', () => {
  const st = {
    projects: [
      proj('p', [
        task('a', 'next', { sortOrder: 1 }),
        task('b', 'next', { sortOrder: 2, title: 'Mop', waitsOn: ['a'] }),
        task('s', 'next', { sortOrder: 3, parentId: 'a' }),
        task('d', 'doing'),
      ]),
      Object.assign(proj('q', [task('e', 'next'), task('f', 'doing'), task('g', 'doing', { title: 'Mop' })]), { name: 'Allotment' }),
    ],
  };
  const counts = (o) => boardList(st, Object.assign({ tab: 'next' }, o), NOW).counts;
  assert.deepStrictEqual(counts({}), { next: 3, doing: 3, done: 0 }, 'nothing narrowed');
  assert.deepStrictEqual(counts({ project: 'q' }), { next: 1, doing: 2, done: 0 }, 'picked project only');
  assert.deepStrictEqual(counts({ find: 'mop' }), { next: 1, doing: 1, done: 0 }, 'Find word');
  assert.deepStrictEqual(counts({ show: 'subs' }), { next: 1, doing: 0, done: 0 }, 'Show subs');
  assert.deepStrictEqual(counts({ show: 'waits' }), { next: 2, doing: 0, done: 0 }, 'Show waits');
  assert.deepStrictEqual(counts({ tab: 'doing', project: 'q' }), counts({ project: 'q' }), 'same on every tab');
});
