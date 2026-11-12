// focus-deck-app/js/tidy.js -- Tidy up (#255): pure grouping of what looks finished, repeated or forgotten.
// A task is in at most one group, in the order of GROUPS; done tasks never appear. Nothing here changes state.
// See docs/4-systems/tidy-up.md
import { inView } from './areas.js';

export const STALE_DAYS = 60;
// One screen per reason, in this order (#266): Finished?, Replaced?, The same?, Still want it?
export const GROUPS = [
  { key: 'review', title: 'Finished?' },
  { key: 'replaced', title: 'Replaced?' },
  { key: 'same', title: 'The same?' },
  { key: 'stale', title: 'Still want it?' },
];

export const normTitle = (s) => String(s || '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();

function dist(a, b) {
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    prev = cur;
  }
  return prev[b.length];
}
export function lookSame(a, b) {
  if (!a || !b) return false;
  if (a === b) return true;
  const [s, l] = a.length <= b.length ? [a, b] : [b, a];
  if (s.length >= 5 && l.includes(s)) return true;
  return l.length >= 8 && dist(a, b) <= Math.min(2, Math.floor(l.length * 0.15));
}
// shortcut: GitHub's updated_at is not stored on tasks, so only updatedAt/createdAt count; a task with neither is never "forgotten"
const stamp = (t) => t.updatedAt || t.createdAt || 0;

// Returns { groups: [{ ...GROUPS[i], items: [{ id, task, project, other? }] }] (non-empty only), owner, open }.
// For a "same" item, id/task is the older one (what Merge closes) and `other` is the newer one (kept).
export function tidyGroups(st, view, now = Date.now()) {
  const owner = new Map(), all = [];
  (st.projects || []).forEach((p) => (p.tasks || []).forEach((t) => { owner.set(t.id, p); all.push(t); }));
  const mine = all.filter((t) => t.status !== 'done' && inView(st, view, owner.get(t.id)));
  const newerIssue = (t, n) => all.some((o) => o.status !== 'done' && o.id !== t.id && String(o.issueNumber) === n && o.issueNumber > (t.issueNumber || 0));
  const catNames = new Map((st.categories || []).map((c) => [c.id, c.name]));
  // '' = replaced by something unnamed; a string = the "new" half of "old ➜ new" (a task title, or the words after "replaced by")
  const replacedBy = (t) => {
    const text = (t.title || '') + ' ' + (t.notes || '');
    const m = /\bsee #(\d+)/i.exec(text);
    const newer = m && newerIssue(t, m[1]) ? all.find((o) => o.status !== 'done' && String(o.issueNumber) === m[1]) : null;
    if (newer) return newer.title;
    const w = /\b(?:replaced|superseded) by\s+([^.;\n]{1,40})/i.exec(text);
    if (w) return w[1].trim();
    return (t.categoryIds || []).some((id) => /superseded|replaced|obsolete/i.test(catNames.get(id) || '')) ? '' : null;
  };
  const taken = new Set(), out = {};
  const take = (key, t, extra) => { taken.add(t.id); (out[key] = out[key] || []).push(Object.assign({ id: t.id, task: t, project: owner.get(t.id) }, extra)); };
  mine.filter((t) => t.status === 'review').forEach((t) => take('review', t));
  mine.filter((t) => !taken.has(t.id) && replacedBy(t) !== null).forEach((t) => take('replaced', t, { to: replacedBy(t) }));
  const rest = mine.filter((t) => !taken.has(t.id)), norms = new Map(rest.map((t) => [t.id, normTitle(t.title)]));
  for (let i = 0; i < rest.length; i++) { // shortcut: O(n^2) pair scan, fine for a few hundred open tasks
    if (taken.has(rest[i].id)) continue;
    for (let j = i + 1; j < rest.length; j++) {
      if (taken.has(rest[j].id) || !lookSame(norms.get(rest[i].id), norms.get(rest[j].id))) continue;
      const [older, newer] = stamp(rest[i]) <= stamp(rest[j]) ? [rest[i], rest[j]] : [rest[j], rest[i]];
      taken.add(newer.id);
      take('same', older, { other: newer });
      break;
    }
  }
  mine.filter((t) => !taken.has(t.id) && stamp(t) && now - stamp(t) > STALE_DAYS * 864e5).forEach((t) => take('stale', t));
  const groups = GROUPS.filter((g) => out[g.key]).map((g) => Object.assign({}, g, { items: out[g.key] }));
  return { groups, owner, open: mine.length };
}

// marks: { [taskId]: 'keep' | 'close' | 'merge' }. What Confirm closes: marked close/merge AND listed in this view now.
// [{ id, task, merge }]: merge is true for the older half of a "same" pair (the "Close these?" screen draws it with a 📎).
export function confirmItems(st, view, marks, now = Date.now()) {
  const out = [];
  tidyGroups(st, view, now).groups.forEach((g) => g.items.forEach((i) => {
    const merge = marks[i.id] === 'merge' && g.key === 'same';
    if (marks[i.id] === 'close' || merge) out.push({ id: i.id, task: i.task, merge });
  }));
  return out;
}
export const confirmIds = (st, view, marks, now) => confirmItems(st, view, marks, now).map((i) => i.id);
