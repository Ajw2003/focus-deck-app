// focus-deck-app/js/pick-order.test.mjs -- run with: node --test app/js/pick-order.test.mjs
import test from 'node:test';
import assert from 'node:assert';
import { pickOrder } from './pick-order.js';

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
