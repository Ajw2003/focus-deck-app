// focus-deck-app/js/tidy.js -- Tidy up (#255): pure grouping of what looks finished, repeated or forgotten.
// A task is in at most one group, in the order of GROUPS; done tasks never appear. Nothing here changes state.
// See docs/4-systems/tidy-up.md
import { inView } from './areas.js';

export const STALE_DAYS = 60;
export const GROUPS = [
  { key: 'review', title: 'Built, waiting for your review', reason: 'Their status is Review: the work is built and only needs your look.' },
  { key: 'replaced', title: 'Replaced by newer work', reason: 'The title or notes say "replaced by" or "superseded by", point with "see #N" to a newer open task, or the task has a superseded, replaced or obsolete label.' },
  { key: 'same', title: 'Looks the same as another', reason: 'Two open tasks with the same title once case, punctuation and spacing are ignored, or one title inside the other, or one or two letters apart.' },
  { key: 'stale', title: 'Not touched in ' + STALE_DAYS + ' days', reason: 'Open, and not changed for over ' + STALE_DAYS + ' days.' },
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
  const isReplaced = (t) => {
    const text = (t.title || '') + ' ' + (t.notes || '');
    if (/\b(replaced|superseded) by\b/i.test(text)) return true;
    const m = /\bsee #(\d+)/i.exec(text);
    if (m && newerIssue(t, m[1])) return true;
    return (t.categoryIds || []).some((id) => /superseded|replaced|obsolete/i.test(catNames.get(id) || ''));
  };
  const taken = new Set(), out = {};
  const take = (key, t, extra) => { taken.add(t.id); (out[key] = out[key] || []).push(Object.assign({ id: t.id, task: t, project: owner.get(t.id) }, extra)); };
  mine.filter((t) => t.status === 'review').forEach((t) => take('review', t));
  mine.filter((t) => !taken.has(t.id) && isReplaced(t)).forEach((t) => take('replaced', t));
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

// marks: { [taskId]: 'keep' | 'close' | 'merge' }. The ids Confirm closes: marked close/merge AND listed in this view now.
export function confirmIds(st, view, marks, now = Date.now()) {
  const ids = [];
  tidyGroups(st, view, now).groups.forEach((g) => g.items.forEach((i) => {
    if (marks[i.id] === 'close' || (marks[i.id] === 'merge' && g.key === 'same')) ids.push(i.id);
  }));
  return ids;
}
