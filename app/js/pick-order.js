// focus-deck-app/js/pick-order.js -- "Or let me pick for you": the order open tasks are offered in.
// In progress, then past its date or due today, then Urgent, then High, then due soonest, then
// oldest. Pure. shortcut: tasks carry no created time, so "oldest" is the order they sit in
// (project order, then task order); upgrade when tasks get a createdAt.
import { effectivePriority } from './areas.js';

// entries: [{ t, p }]; today: 'YYYY-MM-DD'. Returns a new array, best first.
export function pickOrder(entries, st, today) {
  const holds = holdCounts(st);
  const rank = ({ t }) => [
    t.status === 'review' ? 0 : 1,
    t.status === 'doing' ? 0 : 1,
    t.deadline && t.deadline <= today ? 0 : 1,
    { urgent: 0, high: 1, low: 3 }[effectivePriority(t, st)] ?? 2,
    -(holds.get(t.id) || 0),
    t.deadline || '9999-99-99',
  ];
  return entries.map((e, i) => ({ e, i, r: rank(e) })).sort((a, b) => {
    for (let k = 0; k < a.r.length; k++) if (a.r[k] !== b.r[k]) return a.r[k] < b.r[k] ? -1 : 1;
    return a.i - b.i;
  }).map((x) => x.e);
}
