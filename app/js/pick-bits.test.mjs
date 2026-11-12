import test from 'node:test';
import assert from 'node:assert/strict';
const store = {};
globalThis.localStorage = { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: (k) => { delete store[k]; } };
const { parseDue, dueDates, renderPickBlocks } = await import('./pick-bits.js');
const M = await import('./mutations.js');
const { state } = await import('./state.js');

const thu = new Date(2026, 10, 12); // Thursday 12 Nov 2026

test('dueDates: Friday and next week are the coming ones', () => {
  assert.deepEqual(dueDates(thu), { today: '2026-11-12', tomorrow: '2026-11-13', friday: '2026-11-13', nextweek: '2026-11-16' });
  assert.equal(dueDates(new Date(2026, 10, 13)).friday, '2026-11-20', 'on a Friday, the next Friday');
});

test('parseDue reads words, weekdays and dates', () => {
  const t = (s) => parseDue(s, thu);
  assert.equal(t('today'), '2026-11-12');
  assert.equal(t(' Tomorrow '), '2026-11-13');
  assert.equal(t('fri'), '2026-11-13');
  assert.equal(t('thu'), '2026-11-19', 'the same weekday means next week');
  assert.equal(t('monday'), '2026-11-16');
  assert.equal(t('next week'), '2026-11-16');
  assert.equal(t('15 dec'), '2026-12-15');
  assert.equal(t('dec 15'), '2026-12-15');
  assert.equal(t('3rd March'), '2027-03-03', 'already past this year: next year');
  assert.equal(t('3 mar 2030'), '2030-03-03');
  assert.equal(t('2026-12-01'), '2026-12-01');
  for (const bad of ['', 'soon', '31 feb', '32 dec', 'foo 12']) assert.equal(t(bad), null, bad);
});

test('addTaskPicked refuses without a priority and stores priority and date', () => {
  state.projects.length = 0;
  state.projects.push({ id: 'p1', name: 'P', color: '#000', tasks: [] });
  assert.equal(M.addTaskPicked('p1', 'x', '', [], '', ''), undefined);
  assert.equal(M.addTaskPicked('p1', 'x', '', [], '', 'bogus'), undefined);
  assert.equal(state.projects[0].tasks.length, 0);
  const t = M.addTaskPicked('p1', 'x', '2026-11-13', [], '', 'high');
  assert.equal(t.priority, 'high');
  assert.equal(t.deadline, '2026-11-13');
});

test('pick blocks: four priorities, six due options, aria-pressed on the picked one', () => {
  const h = renderPickBlocks({ priority: 'high', due: '2026-11-13' }, 'add', { project: 'p1' }, false, thu);
  for (const l of ['Urgent', 'High', 'Medium', 'Low', 'Today', 'Tomorrow', 'Friday', 'Next week', 'Pick a date…', 'None']) assert.ok(h.includes('>' + l + '<'), l);
  assert.ok(h.includes('aria-pressed="true" data-action="pick-set" data-field="priority" data-value="high"'));
  assert.ok(h.includes('aria-pressed="true" data-action="pick-set" data-field="due" data-value="friday"'));
  assert.ok(h.includes('name="priority" value="high"') && h.includes('name="deadline" value="2026-11-13"'));
  const empty = renderPickBlocks({}, 'add', {}, true);
  assert.ok(empty.includes('Priority · needed') && empty.includes('class="pick-blocks" hidden'));
});
