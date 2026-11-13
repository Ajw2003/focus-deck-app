// focus-deck-app/js/pick-order.test.mjs -- run with: node --test app/js/pick-order.test.mjs
import test from 'node:test';
import assert from 'node:assert';
import { pickOrder, reasonOf } from './pick-order.js';

const st = { categories: [] };
const e = (id, o = {}) => ({ t: Object.assign({ id, status: 'next', deadline: null, priority: null, categoryIds: [] }, o), p: {} });
const ids = (list, today = '2026-11-12') => pickOrder(list, st, today).map((x) => x.t.id);

test('the rules apply in order', () => {
  const list = [
    e('old'), e('soon', { deadline: '2026-11-20' }), e('high', { priority: 'high' }), e('urgent', { priority: 'urgent' }),
    e('today', { deadline: '2026-11-12' }), e('past', { deadline: '2026-11-01' }), e('doing', { status: 'doing' }),
  ];
  assert.deepEqual(ids(list), ['doing', 'past', 'today', 'urgent', 'high', 'soon', 'old']);
});

test('ties keep the older (earlier) task first, and the input is not changed', () => {
  const list = [e('a', { priority: 'high' }), e('b', { priority: 'high' })];
  assert.deepEqual(ids(list), ['a', 'b']);
  assert.deepEqual(list.map((x) => x.t.id), ['a', 'b']);
});

test('in progress beats an overdue urgent task; due soonest beats no date', () => {
  assert.equal(ids([e('late', { priority: 'urgent', deadline: '2026-01-01' }), e('doing', { status: 'doing' })])[0], 'doing');
  assert.deepEqual(ids([e('none'), e('dated', { deadline: '2027-01-01' })]), ['dated', 'none']);
});

test('rule 1: Needs review beats in progress and an overdue urgent task', () => {
  assert.deepEqual(ids([e('doing', { status: 'doing' }), e('late', { priority: 'urgent', deadline: '2026-01-01' }), e('rev', { status: 'review' })]), ['rev', 'doing', 'late']);
});

test('rule 4: Low goes after Medium/none; rule 5: holds up other open tasks beats a nearer date, most first', () => {
  assert.deepEqual(ids([e('low', { priority: 'low' }), e('none')]), ['none', 'low']);
  const list = [e('soon', { deadline: '2026-11-20' }), e('holds1'), e('holds2'), e('w1', { waitsOn: ['holds1', 'holds2'] }), e('w2', { waitsOn: ['holds2'] }), e('w3', { status: 'done', waitsOn: ['soon'] })];
  const st2 = { categories: [], projects: [{ tasks: list.map((x) => x.t) }] };
  assert.deepEqual(pickOrder(list, st2, '2026-11-12').map((x) => x.t.id), ['holds2', 'holds1', 'soon', 'w1', 'w2', 'w3']);
});

test('reasonOf names the first rule that applies', () => {
  const r = (o) => reasonOf(e('x', o).t, st, '2026-11-12');
  assert.deepEqual([r({ status: 'review' }), r({ status: 'doing' }), r({ deadline: '2026-11-12' }), r({ deadline: '2026-11-01' }), r({ priority: 'urgent' }), r({ priority: 'high' }), r({ deadline: '2026-11-20' }), r({ priority: 'low' }), r({})],
    ['Needs review', 'In progress', 'Due today', 'Overdue', 'Urgent', 'High', 'Due Fri', 'Low', 'Oldest first']);
});
