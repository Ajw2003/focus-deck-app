// focus-deck-app/js/card-key.js -- what colours a Board card and is the one chip on it (#202).
// It is the first entry in Settings > Comfort > Card colour that the task has: `category` (the task's
// first label), `priority`, `due`, or `label:<id>`. Pure; spec: docs/generated/calm-test/index.html.
import { PRIORITY } from './state.js';

export const NO_CATEGORY = { name: 'No category', color: '#9aa3ad' };
export const PRIORITY_COLOURS = { urgent: '#b42318', high: '#C2731E', medium: '#4D6FB8', low: '#7F8C8D' };

// { name, color } for a task that is not done and has a deadline (YYYY-MM-DD), else null.
export function dueKey(t, overdue, now = Date.now()) {
  if (!t.deadline || t.status === 'done') return null;
  const today = new Date(new Date(now).toDateString());
  const due = new Date(t.deadline + 'T00:00');
  const days = Math.round((due - today) / 864e5);
  if (days < 0) return overdue === 'red' ? { name: 'Overdue', color: '#b42318' } : { name: 'Past its date', color: '#c98a12' };
  if (days === 0) return { name: 'Due today', color: '#b42318' }; // always red, like the chip (#214)
  if (days <= 3) return { name: 'Due in ' + days + ' day' + (days === 1 ? '' : 's'), color: '#C2731E' };
  return { name: 'Due ' + due.toLocaleDateString(undefined, { day: 'numeric', month: 'short' }), color: '#4D6FB8' };
}

// Returns { name, color, source }; source is null for the grey "No category".
export function cardKey(t, st, colourBy, now = Date.now()) {
  const cats = (st && st.categories) || [];
  for (const source of colourBy || []) {
    if (source === 'category') {
      const c = cats.find((x) => x.id === (t.categoryIds || [])[0]);
      if (c) return { name: c.name, color: c.color, source };
    } else if (source === 'priority') {
      if (t.priority && PRIORITY[t.priority]) return { name: PRIORITY[t.priority].label + ' priority', color: PRIORITY_COLOURS[t.priority], source };
    } else if (source === 'due') {
      const d = dueKey(t, st && st.comfort && st.comfort.overdue && st.comfort.overdue.value, now);
      if (d) return Object.assign(d, { source });
    } else if (typeof source === 'string' && source.startsWith('label:')) {
      const c = cats.find((x) => 'label:' + x.id === source);
      if (c && (t.categoryIds || []).includes(c.id)) return { name: c.name, color: c.color, source };
    }
  }
  return Object.assign({ source: null }, NO_CATEGORY);
}
