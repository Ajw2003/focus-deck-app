// focus-deck-app/js/pick-order.js -- "Or let me pick for you": the order open tasks are offered in.
// The seven rules, in order: 1 Needs review, 2 In progress, 3 past its date or due today, 4 priority
// (Urgent, High, Medium/none, Low), 5 holds up other open tasks (most first), 6 due soonest, 7 oldest.
// Also the ranking under Triage (#256). Pure. shortcut: tasks carry no created time, so "oldest" is the
// order they sit in (project order, then task order); upgrade when tasks get a createdAt.
import { effectivePriority } from './areas.js';

// open tasks that wait on each task id (the same count as task-links.js holdsUp, done once for the list)
function holdCounts(st) {
  const n = new Map();
  ((st && st.projects) || []).forEach((p) => (p.tasks || []).forEach((t) => {
    if (t.status !== 'done') (t.waitsOn || []).forEach((id) => n.set(id, (n.get(id) || 0) + 1));
  }));
  return n;
}

const DAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
// The chip: the first rule that applies to this task (the rule that put it where it is).
export function reasonOf(t, st, today) {
  if (t.status === 'review') return 'Needs review';
  if (t.status === 'doing') return 'In progress';
  if (t.deadline && t.deadline < today) return 'Overdue';
  if (t.deadline === today) return 'Due today';
  const pri = effectivePriority(t, st);
  if (pri === 'urgent') return 'Urgent';
  if (pri === 'high') return 'High';
  const n = holdCounts(st).get(t.id);
  if (n) return 'Holds up ' + n;
  if (t.deadline) return 'Due ' + DAY[new Date(t.deadline + 'T12:00:00').getDay()];
  return pri === 'low' ? 'Low' : 'Oldest first';
}

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
