// run with: node --test app/js/board.test.mjs  (Board columns, #143)
import test from 'node:test';
import assert from 'node:assert';
import { boardColumns, weekStart } from './board.js';

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
