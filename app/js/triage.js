// focus-deck-app/js/triage.js -- Triage (#256): the open tasks in a view, ranked (pickOrder), your saved
// order on top, split into Now / Next / Later. Pure. See docs/4-systems/triage.md
import { inView } from './areas.js';
import { pickOrder, reasonOf } from './pick-order.js';

export const NOW_SIZE = 3, NEXT_SIZE = 8; // Later is the rest

const hasRank = (t) => typeof t.triageRank === 'number' && Number.isFinite(t.triageRank);

// Rules order, then the saved (dragged) order wins: tasks with a triageRank fill, in rank order, the places
// the saved tasks hold in the rules order; a task without one (new) keeps its place by the rules.
// shortcut: ranks are per task and compared across the whole list, so two views saved separately interleave
// by number; upgrade if people save in many views.
export function triageOrder(entries, st, today) {
  const ranked = pickOrder(entries, st, today);
  const saved = ranked.filter((e) => hasRank(e.t)).sort((a, b) => a.t.triageRank - b.t.triageRank);
  let k = 0;
  return ranked.map((e) => (hasRank(e.t) ? saved[k++] : e));
}

// { now, next, later: [{ id, task, project, reason, n }], total, saved } for the view; n is the 1-based place.
export function triageLists(st, view, today) {
  const entries = [];
  (st.projects || []).forEach((p) => { if (inView(st, view, p)) (p.tasks || []).forEach((t) => { if (t.status !== 'done') entries.push({ t, p }); }); });
  const rows = triageOrder(entries, st, today).map((e, i) => ({ id: e.t.id, task: e.t, project: e.p, reason: reasonOf(e.t, st, today), n: i + 1 }));
  return { now: rows.slice(0, NOW_SIZE), next: rows.slice(NOW_SIZE, NOW_SIZE + NEXT_SIZE), later: rows.slice(NOW_SIZE + NEXT_SIZE), total: rows.length, saved: entries.some((e) => hasRank(e.t)) };
}

// The flat id list after moving `id` to place `to` (0-based) in `ids`.
export function moveId(ids, id, to) {
  const rest = ids.filter((x) => x !== id);
  rest.splice(Math.max(0, Math.min(to, rest.length)), 0, id);
  return rest;
}
