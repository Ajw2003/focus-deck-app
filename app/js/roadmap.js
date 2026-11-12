// focus-deck-app/js/roadmap.js -- the Roadmap (#257): a project's sections, milestones and the tasks in each.
// Pure. A project gets `sections: [{id,name,order,updatedAt}]` and `milestones: [{id,name,sectionId,order,
// githubMilestone?,parentTaskId?,measure?,updatedAt}]`; a task is in a milestone by `milestoneId`, or by its
// GitHub milestone title (`githubMilestone`), or by being a subtask of a milestone's parent task; else it is in
// "Unplanned". Old saves have none of these and load unchanged. See docs/4-systems/roadmap.md

export const COLS = [['next', 'Up next'], ['doing', 'In progress'], ['review', 'Review'], ['done', 'Done']];
export const UNPLANNED = 'unplanned';

const byOrder = (a, b) => (a.order || 0) - (b.order || 0);
const mkid = (k) => k + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
export const percent = (done, total) => (total ? Math.round((done / total) * 100) : 0);
export const colOf = (t) => (COLS.some((c) => c[0] === t.status) ? t.status : 'next');

// The section a milestone shows in: its own, or '' (the leading virtual "Milestones" one) when that is gone.
const secIdOf = (p, m) => ((p.sections || []).some((s) => s.id === m.sectionId) ? m.sectionId : '');

// Sections in order; milestones with no section sit in a leading virtual one, id ''.
export function sectionsOf(p) {
  const secs = (p.sections || []).slice().sort(byOrder);
  return (p.milestones || []).some((m) => secIdOf(p, m) === '') ? [{ id: '', name: 'Milestones', virtual: true }].concat(secs) : secs;
}
export const milestonesIn = (p, sectionId) => (p.milestones || []).filter((m) => secIdOf(p, m) === sectionId).sort(byOrder);

// The milestone id a task is in (UNPLANNED when none).
export function milestoneOf(p, t) {
  const ms = p.milestones || [];
  if (t.milestoneId && ms.some((m) => m.id === t.milestoneId)) return t.milestoneId;
  const g = t.githubMilestone && ms.find((m) => m.githubMilestone === t.githubMilestone);
  if (g) return g.id;
  const par = t.parentId && ms.find((m) => m.parentTaskId === t.parentId);
  return par ? par.id : UNPLANNED;
}

// { pct, done, total, sections: [{id,name,virtual,n,milestones:[M]}], unplanned: M|null, currentId }
// M = { id, name, measure, cols:{next,doing,review,done}, done, total, pct, parentTaskId, unplanned }
// A milestone's own parent task is not one of its tasks.
export function roadmapOf(p) {
  const asParent = new Set((p.milestones || []).map((m) => m.parentTaskId).filter(Boolean));
  const mine = (p.tasks || []).filter((t) => !asParent.has(t.id));
  const by = new Map();
  mine.forEach((t) => { const k = milestoneOf(p, t); if (!by.has(k)) by.set(k, []); by.get(k).push(t); });
  const build = (m, unplanned) => {
    const ts = by.get(m.id) || [], cols = {};
    COLS.forEach(([k]) => { cols[k] = ts.filter((t) => colOf(t) === k); });
    return { id: m.id, name: m.name, measure: m.measure || 'tasks', cols, done: cols.done.length, total: ts.length, pct: percent(cols.done.length, ts.length), parentTaskId: m.parentTaskId, unplanned: !!unplanned };
  };
  const sections = sectionsOf(p).map((s, i) => ({ id: s.id, name: s.name, virtual: !!s.virtual, n: i + 1, milestones: milestonesIn(p, s.id).map((m) => build(m)) }));
  const un = by.get(UNPLANNED) ? build({ id: UNPLANNED, name: 'Unplanned' }, true) : null;
  const all = sections.flatMap((s) => s.milestones).concat(un ? [un] : []);
  const cur = all.find((m) => m.done < m.total || m.total === 0);
  const done = mine.filter((t) => t.status === 'done').length;
  return { pct: percent(done, mine.length), done, total: mine.length, sections, unplanned: un, currentId: cur ? cur.id : null };
}

// ---- changes (each stamps what it touches; the caller persists) -------------------------------------
export function addSection(p, name, now = Date.now()) {
  const s = { id: mkid('sec'), name: String(name).trim(), order: Math.max(0, ...(p.sections || []).map((x) => x.order || 0)) + 1, updatedAt: now };
  (p.sections = p.sections || []).push(s);
  return s;
}
// A new milestone goes at the end of `sectionId` (the last section when not given; '' when there are none).
export function addMilestone(p, name, sectionId, now = Date.now()) {
  const secs = sectionsOf(p);
  const sid = sectionId !== undefined && sectionId !== null ? sectionId : (secs.length ? secs[secs.length - 1].id : '');
  const order = Math.max(0, ...milestonesIn(p, sid).map((x) => x.order || 0)) + 1;
  const m = { id: mkid('ms'), name: String(name).trim(), sectionId: sid, order, updatedAt: now };
  (p.milestones = p.milestones || []).push(m);
  return m;
}
// Renumbers `list` 1..n in its order, stamping only the ones whose number changed.
function renumber(list, now) { list.forEach((x, i) => { if (x.order !== i + 1) { x.order = i + 1; x.updatedAt = now; } }); }

// Moves a milestone to place `index` (0-based) of section `toSectionId`.
export function moveMilestone(p, id, toSectionId, index, now = Date.now()) {
  const m = (p.milestones || []).find((x) => x.id === id);
  if (!m) return false;
  const from = secIdOf(p, m);
  const dest = milestonesIn(p, toSectionId).filter((x) => x !== m);
  dest.splice(Math.max(0, Math.min(index, dest.length)), 0, m);
  if (m.sectionId !== toSectionId) { m.sectionId = toSectionId; m.updatedAt = now; }
  renumber(dest, now);
  if (from !== toSectionId) renumber(milestonesIn(p, from), now);
  return true;
}
export function moveSection(p, id, index, now = Date.now()) {
  const s = (p.sections || []).find((x) => x.id === id);
  if (!s) return false;
  const rest = (p.sections || []).slice().sort(byOrder).filter((x) => x !== s);
  rest.splice(Math.max(0, Math.min(index, rest.length)), 0, s);
  renumber(rest, now);
  return true;
}
// Alt+Up / Alt+Down and the phone's buttons: one place along the milestone's section; at the end of a section
// it steps into the neighbouring one.
export function stepMilestone(p, id, dir, now = Date.now()) {
  const secs = sectionsOf(p), m = (p.milestones || []).find((x) => x.id === id);
  if (!m) return false;
  const si = secs.findIndex((s) => s.id === secIdOf(p, m)), list = milestonesIn(p, secs[si].id), i = list.indexOf(m);
  if (i + dir >= 0 && i + dir < list.length) return moveMilestone(p, id, secs[si].id, i + dir, now);
  const next = secs[si + dir];
  return next ? moveMilestone(p, id, next.id, dir < 0 ? milestonesIn(p, next.id).length : 0, now) : false;
}
export function stepSection(p, id, dir, now = Date.now()) {
  const list = (p.sections || []).slice().sort(byOrder), i = list.findIndex((s) => s.id === id);
  return i >= 0 && i + dir >= 0 && i + dir < list.length ? moveSection(p, id, i + dir, now) : false;
}

// A parent task with subtasks becomes a milestone of its own (its subtasks are its tasks).
export function makeMilestone(p, task, sectionId, now = Date.now()) {
  if ((p.milestones || []).some((m) => m.parentTaskId === task.id)) return null;
  const m = addMilestone(p, task.title, sectionId, now);
  m.parentTaskId = task.id;
  return m;
}

// GitHub milestones (read only): every milestone title seen on a task gets a milestone here, once.
// shortcut: nothing is written back to GitHub, and a title is not renamed here if it is renamed there.
export function syncGithubMilestones(p, now = Date.now()) {
  let n = 0;
  (p.tasks || []).forEach((t) => {
    if (!t.githubMilestone || (p.milestones || []).some((m) => m.githubMilestone === t.githubMilestone)) return;
    addMilestone(p, t.githubMilestone, undefined, now).githubMilestone = t.githubMilestone; n += 1;
  });
  return n;
}
