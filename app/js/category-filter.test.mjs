// focus-deck-app/js/category-filter.test.mjs -- run with: node --test app/js/category-filter.test.mjs
// Settings > Category choices (#133). See docs/4-systems/in-tray.md#category-choices
import test from 'node:test';
import assert from 'node:assert';
import { splitCategories, categoriesUsedIn, normalizeCategoryFilter } from './category-filter.js';

const cats = ['a', 'b', 'c', 'd'].map((id) => ({ id, name: id.toUpperCase() }));
const project = { id: 'p', tasks: [{ categoryIds: ['c'] }, { categoryIds: ['a', 'c'] }, { categoryIds: [] }] };
const ids = (list) => list.map((c) => c.id);

test('on: only the project’s categories show, in the given order; the rest are hidden', () => {
  const out = splitCategories(cats, project, { on: true });
  assert.deepStrictEqual(ids(out.shown), ['a', 'c']);
  assert.deepStrictEqual(ids(out.hidden), ['b', 'd']);
});

test('a category already picked always shows', () => {
  assert.deepStrictEqual(ids(splitCategories(cats, project, { on: true, selected: ['d'] }).shown), ['a', 'c', 'd']);
});

test('off, no project, or a project with no categories yet: everything shows', () => {
  assert.deepStrictEqual(ids(splitCategories(cats, project, { on: false }).shown), ['a', 'b', 'c', 'd']);
  assert.deepStrictEqual(ids(splitCategories(cats, null, { on: true }).shown), ['a', 'b', 'c', 'd']);
  assert.deepStrictEqual(splitCategories(cats, { tasks: [{ categoryIds: [] }] }, { on: true }).hidden, []);
});

test('categoriesUsedIn collects across tasks', () => {
  assert.deepStrictEqual([...categoriesUsedIn(project)].sort(), ['a', 'c']);
});

test('the setting: on by default, an old save reads as on, a stored off stays off', () => {
  assert.deepStrictEqual(normalizeCategoryFilter(undefined), { on: true, updatedAt: 0 });
  assert.deepStrictEqual(normalizeCategoryFilter({ on: false, updatedAt: '5' }), { on: false, updatedAt: 5 });
  assert.deepStrictEqual(normalizeCategoryFilter({ updatedAt: 3 }), { on: true, updatedAt: 3 });
});

test('sync: the newer setting wins either way, and a device without one keeps the other’s', async () => {
  const { mergeStates } = await import('./merge.js');
  const base = { projects: [], inbox: [], categories: [], githubSync: {} };
  const off = { ...base, categoryFilter: { on: false, updatedAt: 200 } };
  const on = { ...base, categoryFilter: { on: true, updatedAt: 100 } };
  assert.strictEqual(mergeStates(on, off).categoryFilter.on, false, 'remote newer wins');
  assert.strictEqual(mergeStates(off, on).categoryFilter.on, false, 'local newer wins');
  assert.strictEqual(mergeStates(base, off).categoryFilter.on, false, 'local has none: take remote');
});
