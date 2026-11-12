// focus-deck-app/js/roadmap.test.mjs -- run with: node --test app/js/roadmap.test.mjs
import test from 'node:test';
import assert from 'node:assert';
import { roadmapOf, percent, addSection, addMilestone, moveMilestone, moveSection, stepMilestone, stepSection, makeMilestone, syncGithubMilestones, UNPLANNED } from './roadmap.js';
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
  assert.deepEqual([r.done, r.total, r.pct], [3, 7, 43]); // the parent task that is a milestone is not a task
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
