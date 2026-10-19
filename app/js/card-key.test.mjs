// run with: node --test app/js/card-key.test.mjs  (Board card colour, #202)
import test from 'node:test';
import assert from 'node:assert';
import { cardKey, NO_CATEGORY } from './card-key.js';

const NOW = new Date(2026, 9, 19, 15, 0).getTime(); // Mon 19 Oct 2026, local
const st = (overdue) => ({
  categories: [{ id: 'bug', name: 'Bug', color: '#d33' }, { id: 'feat', name: 'Feature', color: '#3a3' }],
  comfort: overdue ? { overdue: { value: overdue, updatedAt: 1 } } : {},
});
const day = (n) => { const d = new Date(2026, 9, 19 + n); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
const T = (x) => Object.assign({ id: 't', status: 'next', categoryIds: [] }, x);
const ALL = T({ categoryIds: ['feat', 'bug'], priority: 'high', deadline: day(0) });

test('each source on its own', () => {
  assert.deepStrictEqual(cardKey(ALL, st(), ['category'], NOW), { name: 'Feature', color: '#3a3', source: 'category' });
  assert.deepStrictEqual(cardKey(ALL, st(), ['priority'], NOW), { name: 'High priority', color: '#C2731E', source: 'priority' });
  assert.deepStrictEqual(cardKey(ALL, st(), ['due'], NOW), { name: 'Due today', color: '#C2731E', source: 'due' });
  assert.deepStrictEqual(cardKey(ALL, st(), ['label:bug'], NOW), { name: 'Bug', color: '#d33', source: 'label:bug' });
});

test('priority colours', () => {
  const c = (p) => cardKey(T({ priority: p }), st(), ['priority'], NOW).color;
  assert.deepStrictEqual(['urgent', 'high', 'medium', 'low'].map(c), ['#b42318', '#C2731E', '#4D6FB8', '#7F8C8D']);
});

test('the order decides: first entry the task has wins', () => {
  assert.strictEqual(cardKey(ALL, st(), ['due', 'priority', 'category'], NOW).source, 'due');
  assert.strictEqual(cardKey(ALL, st(), ['priority', 'due'], NOW).source, 'priority');
  assert.strictEqual(cardKey(T({ priority: 'low', categoryIds: ['bug'] }), st(), ['due', 'priority'], NOW).source, 'priority');
  assert.strictEqual(cardKey(T({ categoryIds: ['bug'] }), st(), ['priority', 'due', 'category'], NOW).source, 'category');
});

test('a task with none shows No category', () => {
  assert.deepStrictEqual(cardKey(T(), st(), ['category', 'priority', 'due'], NOW), { source: null, name: NO_CATEGORY.name, color: '#9aa3ad' });
  assert.strictEqual(NO_CATEGORY.name, 'No category');
});

test('label:<id> needs the task to have it; a deleted label is skipped', () => {
  assert.strictEqual(cardKey(T({ categoryIds: ['feat'] }), st(), ['label:bug', 'category'], NOW).source, 'category');
  assert.strictEqual(cardKey(T({ categoryIds: ['gone'], priority: 'low' }), st(), ['label:gone', 'priority'], NOW).source, 'priority');
  assert.strictEqual(cardKey(T({ categoryIds: ['gone'] }), st(), ['category', 'label:gone'], NOW).source, null);
});

test('the overdue setting picks amber or red', () => {
  const late = T({ deadline: day(-2) });
  assert.deepStrictEqual(cardKey(late, st(), ['due'], NOW), { name: 'Past its date', color: '#c98a12', source: 'due' });
  assert.deepStrictEqual(cardKey(late, st('amber'), ['due'], NOW), { name: 'Past its date', color: '#c98a12', source: 'due' });
  assert.deepStrictEqual(cardKey(late, st('red'), ['due'], NOW), { name: 'Overdue', color: '#b42318', source: 'due' });
});

test('due-date wording', () => {
  const n = (d) => cardKey(T({ deadline: day(d) }), st(), ['due'], NOW).name;
  assert.strictEqual(n(0), 'Due today');
  assert.strictEqual(n(1), 'Due in 1 day');
  assert.strictEqual(n(3), 'Due in 3 days');
  assert.match(n(5), /^Due .*24.*|^Due .*Oct/);
  assert.strictEqual(cardKey(T({ deadline: day(5) }), st(), ['due'], NOW).color, '#4D6FB8');
});

test('a done task has no due key', () => {
  assert.strictEqual(cardKey(T({ deadline: day(0), status: 'done' }), st(), ['due'], NOW).source, null);
});
