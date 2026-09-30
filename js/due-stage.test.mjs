// focus-deck-app/js/due-stage.test.mjs — run with: node --test js/due-stage.test.mjs
// Clock values are built with local Date constructors so the cases mean the same in any timezone;
// the DST cases pin a zone (America/New_York) because that is the only way to make a day 23 hours.
import test from 'node:test';
import assert from 'node:assert';
import {
  dueStage, dueMoment, leadChoices, suggestLead, stageMoments, normalizeDueDefaults,
  DEFAULT_DUE_DEFAULTS, LEAD_CHOICES,
} from './due-stage.js';

const H = 3600000;
const D = 24 * H;
// A task due on `deadline` (end of that day), whose date was set `setMsBeforeDue` before that moment.
function taskDueIn(deadline, setMsBeforeDue, extra = {}) {
  const due = new Date(deadline + 'T23:59:59').getTime();
  return { status: 'next', deadline, dueSetAt: due - setMsBeforeDue, ...extra };
}
const dueOf = (deadline) => new Date(deadline + 'T23:59:59').getTime();

test('defaults are 33 and 10 percent', () => {
  assert.deepStrictEqual(DEFAULT_DUE_DEFAULTS, { yellowPct: 33, redPct: 10 });
});

test('no deadline is white, a done task is done, even when overdue', () => {
  const now = Date.now();
  assert.strictEqual(dueStage({ status: 'next' }, now), 'white');
  assert.strictEqual(dueStage({ status: 'next', deadline: null }, now), 'white');
  assert.strictEqual(dueStage({ status: 'done', deadline: '2000-01-01' }, now), 'done');
  assert.strictEqual(dueStage({ status: 'done' }, now), 'done');
});

test('90-day span: white, yellow at 30 days left, red at 9 days left', () => {
  const t = taskDueIn('2026-12-31', 90 * D);
  const due = dueOf('2026-12-31');
  assert.strictEqual(dueStage(t, due - 31 * D, undefined), 'white');
  assert.strictEqual(dueStage(t, due - 30 * D - 1000, undefined), 'white');
  assert.strictEqual(dueStage(t, due - 29 * D, undefined), 'yellow');
  assert.strictEqual(dueStage(t, due - 9.5 * D, undefined), 'yellow');
  assert.strictEqual(dueStage(t, due - 8.9 * D, undefined), 'red');
});

test('boundaries are inclusive: exactly at the cut-off the stage has begun', () => {
  const t = taskDueIn('2026-12-31', 100 * D);
  const due = dueOf('2026-12-31');
  assert.strictEqual(dueStage(t, due - 33 * D, { yellowPct: 33, redPct: 10 }), 'yellow');
  assert.strictEqual(dueStage(t, due - 33 * D - 1, { yellowPct: 33, redPct: 10 }), 'white');
  assert.strictEqual(dueStage(t, due - 10 * D, { yellowPct: 33, redPct: 10 }), 'red');
  assert.strictEqual(dueStage(t, due - 10 * D - 1, { yellowPct: 33, redPct: 10 }), 'yellow');
});

test('3-day span: yellow with about a day left, red with about 7 hours left', () => {
  const t = taskDueIn('2026-10-05', 3 * D);
  const due = dueOf('2026-10-05');
  assert.strictEqual(dueStage(t, due - 2 * D, undefined), 'white');
  assert.strictEqual(dueStage(t, due - 23 * H, undefined), 'yellow');
  assert.strictEqual(dueStage(t, due - 8 * H, undefined), 'yellow');
  assert.strictEqual(dueStage(t, due - 7 * H, undefined), 'red');
});

test('1-day span: yellow with about 8 hours left, red with about 2', () => {
  const t = taskDueIn('2026-10-05', 1 * D);
  const due = dueOf('2026-10-05');
  assert.strictEqual(dueStage(t, due - 9 * H, undefined), 'white');
  assert.strictEqual(dueStage(t, due - 7 * H, undefined), 'yellow');
  assert.strictEqual(dueStage(t, due - 2 * H, undefined), 'red');
});

test('overdue is always red, whatever the span or overrides', () => {
  const t = taskDueIn('2026-10-05', 400 * D, { dueStages: { yellow: { leadHours: 1 }, red: { leadHours: 1 } } });
  assert.strictEqual(dueStage(t, dueOf('2026-10-05') + 1000, undefined), 'red');
  assert.strictEqual(dueStage(t, dueOf('2026-10-05') + 40 * D, undefined), 'red');
});

test('a date set for the day it falls on is red all day, unless the task chose its own lead times', () => {
  const morning = new Date(2026, 9, 5, 8, 0, 0).getTime();
  const t = { status: 'next', deadline: '2026-10-05', dueSetAt: morning };
  assert.strictEqual(dueStage(t, morning, undefined), 'red', 'due today, set a moment ago');
  assert.strictEqual(dueStage(t, new Date(2026, 9, 5, 15, 0, 0).getTime(), undefined), 'red', 'and still red mid-afternoon');
  const own = { ...t, dueStages: { yellow: { leadHours: 4 }, red: { leadHours: 1 } } };
  assert.strictEqual(dueStage(own, morning, undefined), 'white', 'explicit lead times win over the same-day rule');
  assert.strictEqual(dueStage({ ...t, status: 'done' }, morning, undefined), 'done');
  const tomorrow = { status: 'next', deadline: '2026-10-06', dueSetAt: morning };
  assert.strictEqual(dueStage(tomorrow, morning, undefined), 'white', 'set today for tomorrow is not the same-day rule');
});

test('a 5-minute span with its own percentages still produces three bands', () => {
  const due = dueOf('2026-10-05');
  const t = { status: 'next', deadline: '2026-10-05', dueSetAt: due - 5 * 60000, dueStages: { yellow: { pct: 33 }, red: { pct: 10 } } };
  assert.strictEqual(dueStage(t, due - 4 * 60000, undefined), 'white');
  assert.strictEqual(dueStage(t, due - 90 * 1000, undefined), 'yellow');
  assert.strictEqual(dueStage(t, due - 20 * 1000, undefined), 'red');
});

test('a 2-year span: yellow about 8 months out, red about 2.4 months out', () => {
  const t = taskDueIn('2028-09-30', 730 * D);
  const due = dueOf('2028-09-30');
  assert.strictEqual(dueStage(t, due - 300 * D, undefined), 'white');
  assert.strictEqual(dueStage(t, due - 200 * D, undefined), 'yellow');
  assert.strictEqual(dueStage(t, due - 70 * D, undefined), 'red');
});

test('leadHours overrides the percentages, per stage', () => {
  const due = dueOf('2026-12-31');
  const t = taskDueIn('2026-12-31', 90 * D, { dueStages: { yellow: { leadHours: 168 }, red: { leadHours: 24 } } });
  assert.strictEqual(dueStage(t, due - 8 * D, undefined), 'white'); // default would be white too
  assert.strictEqual(dueStage(t, due - 6 * D, undefined), 'yellow'); // default (30d) would say yellow earlier, this starts at 7d
  assert.strictEqual(dueStage(t, due - 25 * H, undefined), 'yellow');
  assert.strictEqual(dueStage(t, due - 23 * H, undefined), 'red');
  // the same moment under the defaults is already yellow, so the override genuinely delays it
  const plain = taskDueIn('2026-12-31', 90 * D);
  assert.strictEqual(dueStage(plain, due - 20 * D, undefined), 'yellow');
  assert.strictEqual(dueStage(t, due - 20 * D, undefined), 'white');
});

test('pct overrides and custom defaults', () => {
  const due = dueOf('2026-12-31');
  const t = taskDueIn('2026-12-31', 100 * D, { dueStages: { yellow: { pct: 50 }, red: { pct: 20 } } });
  assert.strictEqual(dueStage(t, due - 51 * D, undefined), 'white');
  assert.strictEqual(dueStage(t, due - 49 * D, undefined), 'yellow');
  assert.strictEqual(dueStage(t, due - 19 * D, undefined), 'red');
  const plain = taskDueIn('2026-12-31', 100 * D);
  assert.strictEqual(dueStage(plain, due - 49 * D, { yellowPct: 50, redPct: 20 }), 'yellow');
  assert.strictEqual(dueStage(plain, due - 49 * D, undefined), 'white');
});

test('one stage overridden leaves the other on the defaults', () => {
  const due = dueOf('2026-12-31');
  const t = taskDueIn('2026-12-31', 100 * D, { dueStages: { red: { leadHours: 48 } } });
  assert.strictEqual(dueStage(t, due - 32 * D, undefined), 'yellow'); // default yellow 33%
  assert.strictEqual(dueStage(t, due - 40 * H, undefined), 'red');
  assert.strictEqual(dueStage(t, due - 9 * D, undefined), 'yellow'); // default red (10d) not used
});

test('dueSetAt missing: createdAt, then now', () => {
  const due = dueOf('2026-12-31');
  const viaCreated = { status: 'next', deadline: '2026-12-31', createdAt: due - 90 * D };
  assert.strictEqual(dueStage(viaCreated, due - 29 * D, undefined), 'yellow');
  assert.strictEqual(dueStage(viaCreated, due - 50 * D, undefined), 'white');
  // with neither, the span starts now: everything is white until overdue
  const bare = { status: 'next', deadline: '2026-12-31' };
  assert.strictEqual(dueStage(bare, due - 3 * D, undefined), 'white');
  assert.strictEqual(dueStage(bare, due + 1000, undefined), 'red');
  // dueSetAt wins over createdAt
  const both = { status: 'next', deadline: '2026-12-31', createdAt: due - 400 * D, dueSetAt: due - 3 * D };
  assert.strictEqual(dueStage(both, due - 20 * H, undefined), 'yellow');
});

test('a dueSetAt in the future (clock skew) cannot make a task look ahead of its span', () => {
  const due = dueOf('2026-12-31');
  const t = { status: 'next', deadline: '2026-12-31', dueSetAt: due + D };
  assert.strictEqual(dueStage(t, due - 5 * D, undefined), 'white');
});

test('garbage defaults fall back per field instead of throwing', () => {
  assert.deepStrictEqual(normalizeDueDefaults(null), DEFAULT_DUE_DEFAULTS);
  assert.deepStrictEqual(normalizeDueDefaults({ yellowPct: 'x', redPct: 5 }), { yellowPct: 33, redPct: 5 });
  assert.deepStrictEqual(normalizeDueDefaults({ yellowPct: 0, redPct: 100 }), DEFAULT_DUE_DEFAULTS);
  const t = taskDueIn('2026-12-31', 90 * D);
  assert.strictEqual(dueStage(t, dueOf('2026-12-31') - 29 * D, { yellowPct: NaN }), 'yellow');
});

test('a malformed deadline is white, not a crash', () => {
  assert.strictEqual(dueMoment({ deadline: 'soon' }), null);
  assert.strictEqual(dueStage({ status: 'next', deadline: 'soon' }, Date.now(), undefined), 'white');
});

test('due moment is the end of the due day, local', () => {
  assert.strictEqual(dueMoment({ deadline: '2026-10-05' }), new Date(2026, 9, 5, 23, 59, 59).getTime());
});

test('daylight-saving change: the due moment is built from the date, so the day is 23 hours long', () => {
  const prev = process.env.TZ;
  process.env.TZ = 'America/New_York';
  try {
    // 2026-03-08 is the US spring-forward day. Set at local midnight on the 7th, due end of the 8th.
    const setAt = new Date(2026, 2, 7, 0, 0, 0).getTime();
    const t = { status: 'next', deadline: '2026-03-08', dueSetAt: setAt };
    assert.strictEqual(dueMoment(t), new Date(2026, 2, 8, 23, 59, 59).getTime());
    const span = dueMoment(t) - setAt;
    assert.strictEqual(span, 47 * H - 1000, 'two calendar days to the last second, one of them 23 hours');
    assert.strictEqual(dueStage(t, new Date(2026, 2, 7, 12, 0, 0).getTime(), undefined), 'white');
    assert.strictEqual(dueStage(t, new Date(2026, 2, 8, 12, 0, 0).getTime(), undefined), 'yellow'); // after the jump
    assert.strictEqual(dueStage(t, new Date(2026, 2, 8, 20, 0, 0).getTime(), undefined), 'red');
    assert.strictEqual(dueStage(t, new Date(2026, 2, 9, 0, 0, 1).getTime(), undefined), 'red'); // overdue
    // and fall-back, 2026-11-01: a 25-hour day. Set at midnight on the 31st, so the span is 49 hours.
    const fallSet = new Date(2026, 9, 31, 0, 0, 0).getTime();
    const f = { status: 'next', deadline: '2026-11-01', dueSetAt: fallSet };
    assert.strictEqual(dueStage(f, new Date(2026, 10, 1, 1, 0, 0).getTime(), undefined), 'white');
    assert.strictEqual(dueStage(f, new Date(2026, 10, 1, 10, 0, 0).getTime(), undefined), 'yellow');
    assert.strictEqual(dueStage(f, new Date(2026, 10, 1, 20, 0, 0).getTime(), undefined), 'red');
  } finally {
    if (prev === undefined) delete process.env.TZ; else process.env.TZ = prev;
  }
});

test('leadChoices lists only lead times shorter than the span', () => {
  assert.deepStrictEqual(leadChoices(90 * D).map((c) => c.label), ['1 month', '1 week', '3 days', '1 day', '4 hours', '1 hour']);
  assert.deepStrictEqual(leadChoices(3 * D).map((c) => c.label), ['1 day', '4 hours', '1 hour'], 'due in 3 days is never offered 1 month, 1 week or 3 days');
  assert.deepStrictEqual(leadChoices(10 * H).map((c) => c.label), ['4 hours', '1 hour']);
  assert.deepStrictEqual(leadChoices(30 * 60000), [], 'a half-hour span has nothing to offer');
  assert.deepStrictEqual(leadChoices(1 * H), [], 'a span equal to a choice is not longer than it');
  assert.deepStrictEqual(leadChoices(90 * D, 24).map((c) => c.label), ['4 hours', '1 hour'], 'maxHours is exclusive');
  assert.strictEqual(LEAD_CHOICES.length, 6);
});

test('suggestLead preselects the choice nearest the default percentage', () => {
  assert.strictEqual(suggestLead(90 * D, 33).label, '1 month'); // 29.7 days
  assert.strictEqual(suggestLead(90 * D, 10).label, '1 week'); // 9 days
  assert.strictEqual(suggestLead(3 * D, 33).label, '1 day');
  assert.strictEqual(suggestLead(3 * D, 10).label, '4 hours'); // 7.2h
  assert.strictEqual(suggestLead(90 * D, 10, 24).label, '4 hours', 'red stays shorter than the chosen yellow');
  assert.strictEqual(suggestLead(30 * 60000, 33), null);
});

test('stageMoments matches dueStage exactly', () => {
  const dueAt = dueOf('2026-12-31');
  const span = 90 * D;
  const m = stageMoments(dueAt, span, DEFAULT_DUE_DEFAULTS);
  const t = { status: 'next', deadline: '2026-12-31', dueSetAt: dueAt - span };
  assert.strictEqual(dueStage(t, m.yellowAt, undefined), 'yellow');
  assert.strictEqual(dueStage(t, m.yellowAt - 1, undefined), 'white');
  assert.strictEqual(dueStage(t, m.redAt, undefined), 'red');
  assert.strictEqual(dueStage(t, m.redAt - 1, undefined), 'yellow');
});
