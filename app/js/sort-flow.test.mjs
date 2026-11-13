// focus-deck-app/js/sort-flow.test.mjs -- run with: node --test app/js/sort-flow.test.mjs
// The Sort tab's nine steps (#264): which screen Next, Skip and Back lead to, the month page and the
// warn page's lead times. See docs/4-systems/in-tray.md
import test from 'node:test';
import assert from 'node:assert';
import { navigate, monthGrid, shiftMonth, formatDue, warnPlan, canSkip } from './sort-flow.js';

const ctx = (over) => Object.assign({ hasProject: true, needsPriority: true, now: new Date('2026-11-12T09:00:00').getTime(), defaults: undefined }, over);
const u = (over) => Object.assign({ step: 1, sub: null, dateOpen: false, fromReceipt: false, priority: null, due: '', dueStages: null }, over);

test('Next walks 0 to 9, but not past a project or a thought\'s priority', () => {
  assert.deepStrictEqual(navigate(u({ step: 0 }), 'next', ctx()), { sub: null, step: 1, fromReceipt: false });
  assert.deepStrictEqual(navigate(u({ step: 1 }), 'next', ctx({ hasProject: false })), { why: 'Choose a project first.' });
  assert.deepStrictEqual(navigate(u({ step: 2 }), 'next', ctx()), { why: 'Pick a priority to go on.' });
  assert.strictEqual(navigate(u({ step: 2 }), 'next', ctx({ needsPriority: false })).step, 3, 'a task may have none');
  assert.strictEqual(navigate(u({ step: 2, priority: 'high' }), 'next', ctx()).step, 3);
  assert.strictEqual(navigate(u({ step: 8 }), 'next', ctx()).step, 9);
  assert.strictEqual(navigate(u({ step: 9 }), 'next', ctx()).step, 9, 'the receipt is the end');
});

test('Skip moves on without asking; only steps 3 to 8 offer it', () => {
  assert.strictEqual(navigate(u({ step: 3 }), 'skip', ctx()).step, 4);
  assert.strictEqual(navigate(u({ step: 4, due: '2026-11-20' }), 'skip', ctx()).step, 5, 'a skipped due step does not open the warn page');
  assert.deepStrictEqual([1, 2, 3, 4, 8, 9].map(canSkip), [false, false, true, true, true, false]);
});

test('a due date opens the warn page, which then goes on to step 5 (or Skip drops the stages)', () => {
  const now = ctx();
  assert.deepStrictEqual(navigate(u({ step: 4, due: '2026-11-20' }), 'next', now), { sub: 'warn' });
  assert.strictEqual(navigate(u({ step: 4 }), 'next', now).step, 5, 'no date, no warn page');
  assert.strictEqual(navigate(u({ step: 4, due: '2026-11-12' }), 'next', ctx({ now: new Date('2026-11-12T23:30:00').getTime() })).step, 5, 'half an hour left leaves no room for a choice');
  assert.deepStrictEqual(navigate(u({ step: 4, sub: 'warn', due: '2026-11-20' }), 'next', now), { sub: null, step: 5, fromReceipt: false });
  assert.deepStrictEqual(navigate(u({ step: 4, sub: 'warn', due: '2026-11-20' }), 'skip', now), { sub: null, step: 5, fromReceipt: false, dueStages: null });
});

test('Back leaves a sub-page first, then goes a step back; a receipt pencil returns to the receipt', () => {
  assert.deepStrictEqual(navigate(u({ step: 4, sub: 'warn' }), 'back', ctx()), { sub: null, dateOpen: false });
  assert.deepStrictEqual(navigate(u({ step: 4, dateOpen: true }), 'back', ctx()), { sub: null, dateOpen: false });
  assert.deepStrictEqual(navigate(u({ step: 5 }), 'back', ctx()), { step: 4, fromReceipt: false });
  assert.strictEqual(navigate(u({ step: 0 }), 'back', ctx()).step, 0);
  const pencil = navigate(u({ step: 9 }), 3, ctx());
  assert.deepStrictEqual(pencil, { step: 3, sub: null, dateOpen: false, fromReceipt: true });
  assert.strictEqual(navigate(u({ step: 3, fromReceipt: true }), 'next', ctx()).step, 9, 'Next from an edited step goes back to the receipt');
  assert.strictEqual(navigate(u({ step: 3, fromReceipt: true }), 'skip', ctx()).step, 9);
  assert.strictEqual(navigate(u({ step: 3, fromReceipt: true }), 'back', ctx()).step, 9);
});

test('monthGrid: Monday-first weeks, padded with nulls', () => {
  const g = monthGrid('2026-11'); // 1 Nov 2026 is a Sunday
  assert.ok(g.every((w) => w.length === 7));
  assert.deepStrictEqual(g[0], [null, null, null, null, null, null, '2026-11-01']);
  assert.strictEqual(g.flat().filter(Boolean).length, 30);
  assert.strictEqual(g.at(-1).at(-1), null);
  assert.strictEqual(monthGrid('2026-02').flat().filter(Boolean).length, 28);
  assert.strictEqual(monthGrid('2026-06')[0][0], '2026-06-01', 'a Monday start has no padding');
});

test('shiftMonth and formatDue', () => {
  assert.strictEqual(shiftMonth('2026-12', 1), '2027-01');
  assert.strictEqual(shiftMonth('2026-01', -1), '2025-12');
  assert.match(formatDue('2026-11-13'), /^Fri,? 13 Nov$/);
});

test('warnPlan: lead times shorter than the span, red shorter than yellow, none when there is no room', () => {
  const now = new Date('2026-11-12T09:00:00').getTime();
  const plan = warnPlan('2026-12-12', now, undefined, null);
  assert.ok(plan.yellowChoices.length > 1 && plan.redChoices.every((c) => c.hours < plan.yellow.hours));
  assert.ok(plan.red.hours < plan.yellow.hours);
  const picked = warnPlan('2026-12-12', now, undefined, { yellow: 168, red: 24 });
  assert.deepStrictEqual([picked.yellow.hours, picked.red.hours], [168, 24]);
  const clash = warnPlan('2026-12-12', now, undefined, { yellow: 24, red: 168 });
  assert.ok(clash.red.hours < 24, 'a red no shorter than the yellow is replaced');
  assert.strictEqual(warnPlan('2026-11-12', new Date('2026-11-12T23:30:00').getTime(), undefined, null), null, 'half an hour left: nothing to choose');
  assert.strictEqual(warnPlan('', now, undefined, null), null);
});
