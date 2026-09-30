// focus-deck-app/js/due-dates.test.mjs -- run with: node --test js/due-dates.test.mjs
//
// Due-date stages (#106, PR 1) around the pure js/due-stage.js: dueSetAt stamping in the mutations,
// the state.dueDefaults field (defaults, survives save and load, merge rule), the stage class on the
// deadline chip, and the skippable step markup. See docs/4-systems/due-dates.md.
import test from 'node:test';
import assert from 'node:assert';

const store = {};
globalThis.localStorage = { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: (k) => { delete store[k]; } };
globalThis.fetch = async () => ({ ok: true, status: 200, json: async () => ({}) });

const { state, serializeState, loadState, saveStateLocal, deadlineChip } = await import('./state.js');
const { mergeStates } = await import('./merge.js');
const M = await import('./mutations.js');
const { renderTaskRow, renderDueStageStep, dueRedOptions } = await import('./render.js');
const { DEFAULT_DUE_DEFAULTS } = await import('./due-stage.js');

const D = 86400000;
const isoDay = (offsetDays) => {
  const d = new Date(); d.setDate(d.getDate() + offsetDays);
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
};
function freshProject() {
  state.projects.length = 0;
  const p = { id: 'p1', name: 'P', tasks: [] };
  state.projects.push(p);
  return p;
}

test('addTask with a deadline stamps dueSetAt; without one it does not', () => {
  const p = freshProject();
  const before = Date.now();
  const withDate = M.addTask('p1', 'Dated', isoDay(10), [], '', '');
  const without = M.addTask('p1', 'Undated', '', [], '', '');
  assert.ok(withDate.dueSetAt >= before && withDate.dueSetAt <= Date.now());
  assert.ok(!('dueSetAt' in without));
  assert.strictEqual(p.tasks.length, 2);
});

test('addTask stores chosen dueStages only with a deadline', () => {
  freshProject();
  const stages = { yellow: { leadHours: 168 }, red: { leadHours: 24 } };
  assert.deepStrictEqual(M.addTask('p1', 'A', isoDay(30), [], '', '', stages).dueStages, stages);
  assert.ok(!('dueStages' in M.addTask('p1', 'B', isoDay(30), [], '', '')), 'skipped: nothing stored');
  assert.ok(!('dueStages' in M.addTask('p1', 'C', '', [], '', '', stages)), 'no date, no stages');
});

test('editTask restamps only when the deadline really changes', () => {
  freshProject();
  const t = M.addTask('p1', 'T', isoDay(20), [], '', '');
  t.dueSetAt = 1000; // pretend it was set long ago
  M.editTask(t.id, 'p1', { title: 'T2', deadline: t.deadline });
  assert.strictEqual(t.dueSetAt, 1000, 'same deadline, title edit: no restamp');
  M.editTask(t.id, 'p1', { deadline: isoDay(40) });
  assert.ok(t.dueSetAt > 1000 && t.dueSetAt <= Date.now(), 'new deadline restamps');
  const stamped = t.dueSetAt;
  M.editTask(t.id, 'p1', { deadline: '' });
  assert.strictEqual(t.deadline, null);
  assert.ok(!('dueSetAt' in t), 'clearing the date clears the span start');
  assert.notStrictEqual(stamped, undefined);
});

test('editTask: a moved date drops old stage choices, new ones replace them, same date keeps them', () => {
  freshProject();
  const stages = { yellow: { leadHours: 168 }, red: { leadHours: 24 } };
  const t = M.addTask('p1', 'T', isoDay(30), [], '', '', stages);
  M.editTask(t.id, 'p1', { title: 'renamed', deadline: t.deadline });
  assert.deepStrictEqual(t.dueStages, stages, 'unchanged date keeps the choices');
  M.editTask(t.id, 'p1', { deadline: isoDay(60) });
  assert.ok(!('dueStages' in t), 'a moved date is a new span: choices made for the old one are dropped');
  const fresh = { yellow: { leadHours: 72 }, red: { leadHours: 4 } };
  M.editTask(t.id, 'p1', { deadline: isoDay(90), dueStages: fresh });
  assert.deepStrictEqual(t.dueStages, fresh);
});

test('state.dueDefaults defaults, and a save and load keeps it', () => {
  assert.strictEqual(state.dueDefaults.yellowPct, DEFAULT_DUE_DEFAULTS.yellowPct);
  assert.strictEqual(state.dueDefaults.redPct, DEFAULT_DUE_DEFAULTS.redPct);
  assert.strictEqual(M.setDueDefaults(40, 15), true);
  assert.strictEqual(state.dueDefaults.yellowPct, 40);
  assert.ok(state.dueDefaults.updatedAt > 0);
  assert.ok(JSON.parse(serializeState(state)).dueDefaults.redPct === 15, 'serializeState carries it');
  saveStateLocal(state);
  const loaded = loadState();
  assert.deepStrictEqual({ y: loaded.dueDefaults.yellowPct, r: loaded.dueDefaults.redPct }, { y: 40, r: 15 }, 'and load returns it');
  M.resetDueDefaults();
  assert.deepStrictEqual({ y: state.dueDefaults.yellowPct, r: state.dueDefaults.redPct }, { y: 33, r: 10 });
});

test('a save from before this field loads with the defaults', () => {
  store['focusdeck-state-v1'] = JSON.stringify({ projects: [] });
  const loaded = loadState();
  assert.strictEqual(loaded.dueDefaults.yellowPct, 33);
  assert.strictEqual(loaded.dueDefaults.redPct, 10);
  assert.strictEqual(loaded.dueDefaults.updatedAt, 0);
});

test('setDueDefaults refuses numbers the stage arithmetic cannot use', () => {
  M.resetDueDefaults();
  const before = JSON.stringify(state.dueDefaults);
  for (const [y, r] of [[10, 33], [33, 33], [0, 0], [100, 10], [33, -1], ['x', 10], [33, '']]) {
    assert.strictEqual(M.setDueDefaults(y, r), false, y + ',' + r);
  }
  assert.strictEqual(JSON.stringify(state.dueDefaults), before, 'nothing changed');
});

test('merge: dueDefaults newest updatedAt wins, either direction; absent on one side keeps the other', () => {
  const base = { projects: [], inbox: [], categories: [], githubSync: {} };
  const older = Object.assign({}, base, { dueDefaults: { yellowPct: 50, redPct: 20, updatedAt: 100 } });
  const newer = Object.assign({}, base, { dueDefaults: { yellowPct: 25, redPct: 5, updatedAt: 200 } });
  assert.strictEqual(mergeStates(older, newer).dueDefaults.yellowPct, 25, 'remote newer wins');
  assert.strictEqual(mergeStates(newer, older).dueDefaults.yellowPct, 25, 'local newer wins');
  assert.strictEqual(mergeStates(older, base).dueDefaults.yellowPct, 50, 'remote has none: keep local');
  assert.strictEqual(mergeStates(base, newer).dueDefaults.yellowPct, 25, 'local has none: take remote');
  assert.ok(!('dueDefaults' in mergeStates(base, base)), 'neither has one: nothing invented');
  const tie = mergeStates(older, Object.assign({}, base, { dueDefaults: { yellowPct: 60, redPct: 30, updatedAt: 100 } }));
  assert.strictEqual(tie.dueDefaults.yellowPct, 50, 'a tie keeps local');
});

test('merge: a due-date edit on a task travels with the task (dueSetAt, dueStages)', () => {
  const mk = (extra, at) => ({ projects: [{ id: 'p', tasks: [Object.assign({ id: 't', title: 'T', updatedAt: at }, extra)] }], inbox: [], categories: [], githubSync: {} });
  const merged = mergeStates(mk({}, 100), mk({ deadline: '2026-12-01', dueSetAt: 150, dueStages: { yellow: { leadHours: 24 }, red: { leadHours: 4 } } }, 200));
  const t = merged.projects[0].tasks[0];
  assert.strictEqual(t.dueSetAt, 150);
  assert.deepStrictEqual(t.dueStages.red, { leadHours: 4 });
});

test('deadline chip: task stage classes, words unchanged, red gets the icon, project chip stays neutral', () => {
  M.resetDueDefaults();
  const now = Date.now();
  const mk = (deadline, setDaysAgo, extra) => Object.assign({ id: 'x', status: 'next', deadline, dueSetAt: now - setDaysAgo * D }, extra);
  const white = deadlineChip(isoDay(80), mk(isoDay(80), 10));
  assert.ok(white.includes('due-white') && white.includes('due in 80d') && !white.includes('<svg'));
  const yellow = deadlineChip(isoDay(3), mk(isoDay(3), 14)); // about 3.5 of 17.5 days left (20%)
  assert.ok(yellow.includes('due-yellow') && yellow.includes('due in 3d') && !yellow.includes('<svg'));
  const red = deadlineChip(isoDay(0), mk(isoDay(0), 30));
  assert.ok(red.includes('due-red') && red.includes('due today') && red.includes('<svg'), 'red carries the flame');
  const overdue = deadlineChip(isoDay(-2), mk(isoDay(-2), 30));
  assert.ok(overdue.includes('due-red') && overdue.includes('2d overdue'));
  const done = deadlineChip(isoDay(-2), mk(isoDay(-2), 30, { status: 'done' }));
  assert.ok(!/due-(white|yellow|red)/.test(done) && done.includes('2d overdue'), 'a done task has no stage colour');
  const project = deadlineChip(isoDay(0));
  assert.strictEqual(project, '<span class="chip deadline-chip">due today</span>', 'a project deadline is the neutral chip');
});

test('the task row and the stage chip stay one chip wide-class: only the deadline chip changes, nothing else in the row', () => {
  freshProject();
  const t = M.addTask('p1', 'Write the report', isoDay(0), [], '', 'high');
  t.dueSetAt = Date.now() - 20 * D;
  const row = renderTaskRow(t, state.projects[0], [], { editingTask: null });
  assert.ok(row.includes('due-red'), 'the row renders the stage chip');
  assert.ok(row.includes('priority-chip'), 'beside the priority chip');
  assert.ok(/--chips-max:\d+%/.test(row), 'the chips column width comes from the title alone');
});

test('step markup: choices shorter than the span only, red shorter than yellow', () => {
  const html3d = renderDueStageStep(3 * D, DEFAULT_DUE_DEFAULTS);
  assert.ok(html3d.includes('class="due-step"'));
  assert.ok(!html3d.includes('1 month') && !html3d.includes('1 week') && html3d.includes('1 day left'), 'due in 3 days is never offered 1 month');
  const yellow = html3d.match(/name="dueYellow"[^>]*>([\s\S]*?)<\/select>/)[1];
  assert.ok(!yellow.includes('1 hour'), 'yellow never offers the last choice, so red has one below it');
  const html90 = renderDueStageStep(90 * D, DEFAULT_DUE_DEFAULTS);
  assert.ok(html90.includes('1 month left') && html90.includes('selected'));
  assert.strictEqual(renderDueStageStep(30 * 60000, DEFAULT_DUE_DEFAULTS), '', 'a half-hour span offers nothing');
  const red = dueRedOptions(90 * D, 24, 4);
  assert.ok(red.includes('value="4" selected') && !red.includes('value="24"') && !red.includes('value="168"'));
  assert.ok(html90.includes('name="dueStepChosen" value=""'), 'untouched means nothing is stored');
  assert.ok(html90.includes('aria-label="Turn yellow') && html90.includes('aria-label="Turn red') && html90.includes('data-action="skip-due-step"'));
});
