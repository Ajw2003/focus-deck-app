// focus-deck-app/js/project-filter.test.mjs — run with: node js/project-filter.test.mjs
import { filterAndSortProjects, sortProjects } from './project-filter.js';
import assert from 'node:assert';

function proj(overrides) {
  return Object.assign({ id: 'p', name: 'Proj', categoryId: null, source: 'manual', deadline: null, tasks: [] }, overrides);
}

// categoryId filter
const projects = [
  proj({ id: 'p1', name: 'Alpha', categoryId: 'work' }),
  proj({ id: 'p2', name: 'Beta', categoryId: null }),
  proj({ id: 'p3', name: 'Gamma', categoryId: 'work' }),
];
assert.deepStrictEqual(filterAndSortProjects(projects, {}).map((p) => p.id), ['p1', 'p2', 'p3'], 'no categoryId filter (undefined) should keep all projects, sorted by name');
assert.deepStrictEqual(filterAndSortProjects(projects, { categoryId: 'work' }).map((p) => p.id), ['p1', 'p3'], 'categoryId filter should keep only matching projects');
assert.deepStrictEqual(filterAndSortProjects(projects, { categoryId: null }).map((p) => p.id), ['p2'], 'categoryId: null should match Uncategorized projects');

// query filter — case-insensitive substring match on name
assert.deepStrictEqual(filterAndSortProjects(projects, { query: 'al' }).map((p) => p.id), ['p1'], 'query should case-insensitively substring-match project names');
assert.deepStrictEqual(filterAndSortProjects(projects, { query: 'ZZZ' }).map((p) => p.id), [], 'query with no match should return an empty list');

// sortProjects: name (default)
assert.deepStrictEqual(sortProjects([proj({ id: 'p1', name: 'Zeta' }), proj({ id: 'p2', name: 'Alpha' })], 'name').map((p) => p.id), ['p2', 'p1'], 'name sort should be alphabetical');

// sortProjects: open-tasks (most open tasks first)
const withTasks = [
  proj({ id: 'p1', name: 'A', tasks: [{ status: 'next' }, { status: 'done' }] }), // 1 open
  proj({ id: 'p2', name: 'B', tasks: [{ status: 'next' }, { status: 'doing' }, { status: 'next' }] }), // 3 open
];
assert.deepStrictEqual(sortProjects(withTasks, 'open-tasks').map((p) => p.id), ['p2', 'p1'], 'open-tasks sort should put the most open tasks first');

// sortProjects: deadline (closest first, from task deadlines and the project's own deadline; undated last)
const withDeadlines = [
  proj({ id: 'p1', name: 'A', deadline: '2026-12-01' }),
  proj({ id: 'p2', name: 'B', tasks: [{ status: 'next', deadline: '2026-10-01' }] }),
  proj({ id: 'p3', name: 'C' }),
];
assert.deepStrictEqual(sortProjects(withDeadlines, 'deadline').map((p) => p.id), ['p2', 'p1', 'p3'], 'deadline sort should put the closest upcoming deadline first, undated projects last');

// sortProjects: recent-sync (GitHub projects by lastSyncedAt desc, manual projects fall back to name)
const withSync = [
  proj({ id: 'p1', name: 'Older', source: 'github', lastSyncedAt: 1000 }),
  proj({ id: 'p2', name: 'Newer', source: 'github', lastSyncedAt: 2000 }),
  proj({ id: 'p3', name: 'Manual' }),
];
assert.deepStrictEqual(sortProjects(withSync, 'recent-sync').map((p) => p.id), ['p2', 'p1', 'p3'], 'recent-sync sort should rank most-recently-synced GitHub projects first, manual projects last by name');

console.log('PROJECT FILTER/SORT TESTS PASSED');
