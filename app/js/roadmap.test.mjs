// focus-deck-app/js/roadmap.test.mjs -- run with: node --test app/js/roadmap.test.mjs
import test from 'node:test';
import assert from 'node:assert';
import { split, sharesFor, sharesAfter, applyShares, applyMilestoneSettings, progressOf, roadmapOf, percent, addSection, addMilestone, moveMilestone, moveSection, stepMilestone, stepSection, makeMilestone, syncGithubMilestones, UNPLANNED } from './roadmap.js';
import { mergeStates } from './merge.js';
import { renderRoadmap } from './roadmap-view.js';
import { state } from './state.js';
import { setTaskStatus } from './mutations.js';

const t = (id, status, o = {}) => Object.assign({ id, title: id, status }, o);
const proj = () => ({ id: 'p', name: 'P', color: '#c55', tasks: [
  t('a', 'done', { milestoneId: 'm1' }), t('b', 'doing', { milestoneId: 'm1' }), t('c', 'next', { githubMilestone: 'v2' }),
  t('par', 'next'), t('s1', 'done', { parentId: 'par' }), t('s2', 'next', { parentId: 'par' }), t('loose', 'review'), t('stale', 'done', { milestoneId: 'gone' }),
], sections: [{ id: 's1', name: 'Foundations', order: 1 }, { id: 's2', name: 'Plan', order: 2 }],
milestones: [{ id: 'm1', name: 'One', sectionId: 's1', order: 1 }, { id: 'm2', name: 'GH', sectionId: 's1', order: 2, githubMilestone: 'v2' }, { id: 'm3', name: 'Par', sectionId: 's2', order: 1, parentTaskId: 'par' }] });
const ms = (p, sid) => roadmapOf(p).sections.find((s) => s.id === sid).milestones.map((m) => m.id);

test('percent done', () => {
  assert.deepEqual([percent(0, 0), percent(1, 3), percent(2, 4), percent(3, 3)], [0, 33, 50, 100]);
  const r = roadmapOf(proj());
  assert.deepEqual([r.done, r.total, r.pct], [3, 7, 38]); // the parent task that is a milestone is not a task; 4 equal shares (3 milestones + Unplanned): 50, 0, 50, 50 -> 37.5
});

test('tasks go into milestones: explicit, GitHub milestone, parent task, else Unplanned', () => {
  const r = roadmapOf(proj()), by = (id) => r.sections.flatMap((s) => s.milestones).find((m) => m.id === id);
  assert.deepEqual([by('m1').done, by('m1').total, by('m1').cols.doing.length], [1, 2, 1]);
  assert.deepEqual(by('m2').cols.next.map((x) => x.id), ['c']);
  assert.deepEqual([by('m3').done, by('m3').total], [1, 2]);
  assert.deepEqual(r.unplanned.cols.review.map((x) => x.id).concat(r.unplanned.cols.done.map((x) => x.id)), ['loose', 'stale']);
  assert.equal(r.unplanned.id, UNPLANNED);
  assert.equal(r.currentId, 'm1'); // first milestone with open tasks
});

test('a column move sets the status (done sets completedAt, moving back clears it)', () => {
  const p = proj(); state.projects.length = 0; state.projects.push(p);
  setTaskStatus('b', 'review');
  assert.equal(roadmapOf(p).sections[0].milestones[0].cols.review[0].id, 'b');
  setTaskStatus('b', 'done');
  assert.equal(typeof p.tasks.find((x) => x.id === 'b').completedAt, 'number');
  setTaskStatus('b', 'next');
  assert.equal(roadmapOf(p).sections[0].milestones[0].cols.next[0].id, 'b');
  assert.equal(p.tasks.find((x) => x.id === 'b').completedAt, undefined);
});

test('a milestone moves between sections and within one; sections reorder', () => {
  const p = proj();
  moveMilestone(p, 'm1', 's2', 0, 5);
  assert.deepEqual([ms(p, 's1'), ms(p, 's2')], [['m2'], ['m1', 'm3']]);
  assert.equal(p.milestones.find((m) => m.id === 'm1').updatedAt, 5);
  stepMilestone(p, 'm1', 1, 6); assert.deepEqual(ms(p, 's2'), ['m3', 'm1']);
  assert.equal(stepMilestone(p, 'm1', 1, 7), false); // last one in the last section: stays
  stepMilestone(p, 'm3', -1, 8); assert.deepEqual([ms(p, 's1'), ms(p, 's2')], [['m2', 'm3'], ['m1']]); // steps up into the section above
  moveSection(p, 's2', 0, 9);
  assert.deepEqual(roadmapOf(p).sections.map((s) => s.id), ['s2', 's1']);
  assert.equal(stepSection(p, 's2', -1), false);
  stepSection(p, 's2', 1); assert.deepEqual(roadmapOf(p).sections.map((s) => s.id), ['s1', 's2']);
});

test('adding sections and milestones; a parent task or a GitHub milestone becomes one', () => {
  const p = { id: 'p', tasks: [t('x', 'next', { githubMilestone: 'v9' }), t('par', 'next'), t('k', 'next', { parentId: 'par' })] };
  assert.equal(roadmapOf(p).sections.length, 0);
  addMilestone(p, ' First '); // no sections yet: it sits in a leading virtual one
  assert.deepEqual(roadmapOf(p).sections.map((s) => [s.id, s.name]), [['', 'Milestones']]);
  const s = addSection(p, 'Later'); const m = addMilestone(p, 'Second');
  assert.equal(m.sectionId, s.id);
  assert.equal(syncGithubMilestones(p), 1); assert.equal(syncGithubMilestones(p), 0);
  assert.equal(makeMilestone(p, p.tasks[1], s.id).parentTaskId, 'par'); assert.equal(makeMilestone(p, p.tasks[1]), null);
  const r = roadmapOf(p), all = r.sections.flatMap((x) => x.milestones);
  assert.deepEqual(all.map((x) => [x.name, x.total]), [['First', 0], ['Second', 0], ['v9', 1], ['par', 1]]);
  assert.equal(r.unplanned, null);
});

test('merge: sections and milestones merge by id, newest copy wins, both sides kept', () => {
  const L = { projects: [{ id: 'p', updatedAt: 1, tasks: [], sections: [{ id: 's1', name: 'Old', updatedAt: 1 }], milestones: [{ id: 'm1', name: 'L', updatedAt: 9 }] }] };
  const R = { projects: [{ id: 'p', updatedAt: 2, tasks: [], sections: [{ id: 's1', name: 'New', updatedAt: 5 }, { id: 's2', name: 'R only', updatedAt: 5 }], milestones: [{ id: 'm1', name: 'R', updatedAt: 3 }] }] };
  const m = mergeStates(L, R).projects[0];
  assert.deepEqual(m.sections.map((s) => s.name), ['New', 'R only']);
  assert.equal(m.milestones[0].name, 'L');
  const plain = mergeStates({ projects: [{ id: 'p', tasks: [] }] }, { projects: [{ id: 'p', tasks: [] }] }).projects[0];
  assert.ok(!('sections' in plain) && !('milestones' in plain), 'old saves stay as they were');
});

test('an old save (no sections, milestones or milestoneId) loads: every task is Unplanned', () => {
  const p = { id: 'p', name: 'Old', color: '#abc', tasks: [t('a', 'done'), t('b', 'next')] };
  const r = roadmapOf(p);
  assert.deepEqual([r.sections.length, r.unplanned.total, r.pct], [0, 2, 50]);
  const st = { projects: [p], projectCategories: [], categories: [] };
  const h = renderRoadmap(st, { view: { mode: 'all' } });
  assert.ok(h.includes('Roadmap: All') && h.includes('50% done') && h.includes('Unplanned'));
  assert.ok(renderRoadmap(st, { view: { mode: 'project', id: 'p' } }).includes('data-status="next"'));
});

// ---- milestone settings (#258) ----
const sum = (o) => Object.values(o).reduce((a, b) => a + b, 0);
test('split always adds up, leftovers to the largest', () => {
  for (const raw of [[1, 1, 1], [1, 2, 3, 4, 5, 6, 7], [5], [0, 0], [33, 33, 34], [1, 1, 1, 1, 1, 1]]) for (const total of [0, 1, 60, 100]) assert.equal(split(raw, total).reduce((a, b) => a + b, 0), total, raw + '/' + total);
  assert.deepEqual(split([1, 1, 1], 100), [34, 33, 33]);
  assert.deepEqual(split([1, 5], 100), [16, 84]);
});
test('shares: equal for old saves, stored weights kept, always 100', () => {
  const p = proj();
  const r = roadmapOf(p);
  assert.deepEqual(r.milestones.map((m) => m.share), [25, 25, 25, 25]); // 3 milestones + Unplanned (it has tasks)
  p.milestones.forEach((m, i) => { m.weight = [50, 30, 10][i]; }); p.unplannedWeight = 10;
  assert.deepEqual(roadmapOf(p).milestones.map((m) => m.share), [50, 30, 10, 10]);
  p.milestones.push({ id: 'new', name: 'N', sectionId: 's1', order: 9 }); // a milestone with no weight: equal shares again
  assert.equal(sum(sharesFor(p, ['m1', 'm2', 'm3', 'new', UNPLANNED])), 100);
  assert.equal(sharesFor({ milestones: [{ id: 'a' }] }, ['a']).a, 100);
  assert.deepEqual(sharesFor({ milestones: [] }, []), {});
});
test('moving one share rescales the others and keeps 100', () => {
  const base = { a: 34, b: 33, c: 33 };
  for (let v = 0; v <= 100; v++) for (const id of ['a', 'b', 'c']) { const o = sharesAfter(base, id, v); assert.equal(sum(o), 100); assert.equal(o[id], v); assert.ok(Object.values(o).every((x) => Number.isInteger(x) && x >= 0)); }
  assert.deepEqual(sharesAfter({ a: 50, b: 30, c: 20 }, 'a', 40), { a: 40, b: 36, c: 24 });
  assert.deepEqual(sharesAfter({ a: 100 }, 'a', 10), { a: 100 });
  assert.deepEqual(sharesAfter({ a: 100, b: 0 }, 'a', 40), { a: 40, b: 60 }); // the others held nothing: they share it equally
  assert.equal(sum(sharesAfter({ a: 20, b: 0, c: 0 }, 'a', 90)), 100);
});
test('adding and removing a milestone keeps shares at 100', () => {
  const p = proj(); p.tasks = []; p.milestones.forEach((m, i) => { m.weight = [60, 30, 10][i]; });
  assert.equal(sum(sharesFor(p, ['m1', 'm2', 'm3'])), 100);
  addMilestone(p, 'Four', 's1');
  assert.equal(sum(roadmapOf(p).milestones.reduce((o, m) => Object.assign(o, { [m.id]: m.share }), {})), 100);
  p.milestones = p.milestones.filter((m) => m.id !== 'm1');
  assert.equal(sum(sharesFor(p, p.milestones.map((m) => m.id))), 100);
});
test('the four measures', () => {
  const ts = [t('a', 'done', { size: 'large' }), t('b', 'done'), t('c', 'next', { size: 'medium' }), t('d', 'next', { size: 'small' })];
  assert.deepEqual(progressOf({}, ts), { pct: 50, text: 'tasks 2 of 4' });
  assert.deepEqual(progressOf({ measureBy: 'size' }, ts), { pct: 57, text: '4 of 7 points' }); // large 3 + unsized (small) 1 of 3+1+2+1
  assert.deepEqual(progressOf({ measureBy: 'number', number: { name: 'screens tested', current: 2, target: 4 } }, []), { pct: 50, text: 'screens tested 2 of 4' });
  assert.equal(progressOf({ measureBy: 'number', number: { name: 'x', current: 9, target: 4 } }, []).pct, 100);
  assert.equal(progressOf({ measureBy: 'number', number: { name: 'x', current: 1, target: 0 } }, []).pct, 0);
  assert.deepEqual(progressOf({ measureBy: 'checklist', checklist: [{ id: '1', text: 'a', done: true }, { id: '2', text: 'b', done: false }, { id: '3', text: 'c', done: false }] }, ts), { pct: 33, text: '1 of 3 items' });
  assert.equal(progressOf({ measureBy: 'checklist', checklist: [] }, ts).pct, 0);
});
test('project percent is the weighted sum of milestone progress', () => {
  const p = { id: 'p', name: 'P', tasks: [t('a', 'done', { milestoneId: 'x' }), t('b', 'next', { milestoneId: 'x' })],
    milestones: [{ id: 'x', name: 'X', order: 1, weight: 40 }, { id: 'y', name: 'Y', order: 2, weight: 60, measureBy: 'number', number: { name: 'n', current: 1, target: 2 } }] };
  const r = roadmapOf(p);
  assert.deepEqual(r.milestones.map((m) => [m.share, m.pct, m.contribution]), [[40, 50, 20], [60, 50, 30]]);
  assert.equal(r.pct, 50);
  p.milestones[1].number.current = 2;
  assert.equal(roadmapOf(p).pct, 80);
});
test('applyMilestoneSettings saves the draft, stamps and merges', () => {
  const p = proj(); p.milestones.forEach((m) => { m.updatedAt = 1; });
  const shares = sharesAfter(roadmapOf(p).milestones.reduce((o, m) => Object.assign(o, { [m.id]: m.share }), {}), 'm1', 40);
  assert.ok(applyMilestoneSettings(p, 'm1', { shares, measureBy: 'number', number: { name: ' screens ', current: '2', target: 4 }, checklist: [{ id: 'c1', text: ' a ', done: 1 }, { id: 'c2', text: '  ', done: false }] }, 99));
  const m1 = p.milestones[0];
  assert.deepEqual([m1.weight, m1.measureBy, m1.number, m1.checklist, m1.updatedAt], [40, 'number', { name: 'screens', current: 2, target: 4 }, [{ id: 'c1', text: 'a', done: true }], 99]);
  assert.equal(sum(shares), 100);
  assert.equal(p.unplannedWeight, shares[UNPLANNED]);
  assert.equal(applyMilestoneSettings(p, 'nope', {}), false);
  const remote = JSON.parse(JSON.stringify(proj())); remote.milestones.forEach((m) => { m.updatedAt = 50; m.weight = 5; }); remote.milestones[2].updatedAt = 150;
  const out = mergeStates({ projects: [p] }, { projects: [remote] }).projects[0];
  assert.equal(out.milestones.find((m) => m.id === 'm1').weight, 40); // newer copy (99) wins; the others (stamped 99 too or 50) follow theirs
  assert.equal(out.milestones.find((m) => m.id === 'm3').weight, 5);
});
