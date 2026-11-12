// focus-deck-app/js/pick-bits.js
// The priority and due-date pickers (#249): one set of buttons used by the add row, the Sort slip,
// bulk sort and the chips on task rows and Board cards, plus the small pure date helpers behind
// them. What a tap does is in js/app.js ('pick-set'). See docs/4-systems/quick-add.md
import { esc, PRIORITY, PRIORITY_ORDER, deadlineChip } from './state.js';

// The chip that is open on a task row or Board card: { field, taskId, dateOpen }. app.js uses this
// same object as ui.pick, so renderers need no extra argument.
export const pickState = { field: null, taskId: null, dateOpen: false };

const iso = (d) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
const addDays = (now, n) => new Date(now.getFullYear(), now.getMonth(), now.getDate() + n);
// the coming weekday (0 = Sunday): never today, so Friday on a Friday is a week away
const coming = (now, dow) => addDays(now, ((dow - now.getDay() + 6) % 7) + 1);

export function dueDates(now = new Date()) {
  return { today: iso(now), tomorrow: iso(addDays(now, 1)), friday: iso(coming(now, 5)), nextweek: iso(coming(now, 1)) };
}

const DAYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

// "fri", "tomorrow", "next week", "15 dec", "dec 15 2027", "2026-12-15" -> 'YYYY-MM-DD', else null.
// A day and month already past this year mean next year. shortcut: English only, no "in 3 days".
export function parseDue(text, now = new Date()) {
  const s = String(text || '').trim().toLowerCase().replace(/[,.]/g, ' ').replace(/\s+/g, ' ').trim();
  if (!s) return null;
  const dd = dueDates(now);
  if (s === 'today') return dd.today;
  if (s === 'tomorrow' || s === 'tmrw') return dd.tomorrow;
  if (s === 'next week') return dd.nextweek;
  if (/^(sun|mon|tue|wed|thu|fri|sat)[a-z]*$/.test(s)) return iso(coming(now, DAYS.indexOf(s.slice(0, 3))));
  let y = null, mo, d, m;
  if ((m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/))) { y = +m[1]; mo = +m[2] - 1; d = +m[3]; }
  else if ((m = s.match(/^(\d{1,2})(?:st|nd|rd|th)? ([a-z]{3})[a-z]*(?: (\d{4}))?$/))) { d = +m[1]; mo = MONTHS.indexOf(m[2]); y = m[3] ? +m[3] : null; }
  else if ((m = s.match(/^([a-z]{3})[a-z]* (\d{1,2})(?:st|nd|rd|th)?(?: (\d{4}))?$/))) { d = +m[2]; mo = MONTHS.indexOf(m[1]); y = m[3] ? +m[3] : null; }
  else return null;
  if (mo < 0) return null;
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  let out = new Date(y == null ? now.getFullYear() : y, mo, d);
  if (y == null && out < today) out = new Date(now.getFullYear() + 1, mo, d);
  return out.getMonth() === mo && out.getDate() === d ? iso(out) : null;
}

const attrs = (o) => Object.entries(o).filter(([, v]) => v != null).map(([k, v]) => ' data-' + k + '="' + esc(v) + '"').join('');
const opt = (field, value, label, on, ctx) =>
  '<button type="button" class="pick-opt' + (on ? ' on' : '') + '" aria-pressed="' + !!on + '" data-action="pick-set" data-field="' + field + '" data-value="' + value + '"' + attrs(ctx) + '>' + esc(label) + '</button>';

// ctx: extra data-attributes put on each button (e.g. { task: id }); S: { priority, due, dateOpen }.
export function priorityButtons(S, ctx = {}) {
  return '<div class="pick-group" role="group" aria-label="Priority">'
    + PRIORITY_ORDER.map((l) => opt('priority', l, PRIORITY[l].label, S.priority === l, ctx)).join('') + '</div>';
}

export function dueButtons(S, ctx = {}, now = new Date()) {
  const dd = dueDates(now), due = S.due || '';
  const presets = [['today', 'Today'], ['tomorrow', 'Tomorrow'], ['friday', 'Friday'], ['nextweek', 'Next week']];
  const custom = !!due && !presets.some(([k]) => dd[k] === due);
  return '<div class="pick-group" role="group" aria-label="Due date">'
    + presets.map(([k, label]) => opt('due', k, label, due === dd[k], ctx)).join('')
    + opt('due', 'date', custom ? 'Date: ' + due : 'Pick a date…', custom || S.dateOpen, ctx)
    + opt('due', 'none', 'None', !due, ctx) + '</div>'
    + (S.dateOpen ? '<div class="pick-date"><input type="date" data-pick-date value="' + esc(due) + '" aria-label="Due date"' + attrs(ctx)
      + '><input type="text" data-pick-type placeholder="or type: fri, 15 dec" aria-label="Type a date"' + attrs(ctx) + '></div>' : '');
}

// The add row's / Sort slip's / bulk panel's two blocks, plus hidden inputs a form submit reads.
// `scope` names the state they edit ('add', 'sort', 'bulk'); `hidden` hides them until there is a title.
export function renderPickBlocks(S, scope, ctx = {}, hidden = false, now = new Date(), hint = '') {
  const c = Object.assign({ scope }, ctx);
  return '<div class="pick-blocks"' + (hidden ? ' hidden' : '') + '>'
    + '<div class="pick-block"><span class="pick-label">' + (S.priority ? 'Priority' : 'Priority · needed') + '</span>' + priorityButtons(S, c) + (hint && !S.priority ? '<span class="pick-hint" role="status">' + esc(hint) + '</span>' : '') + '</div>'
    + '<div class="pick-block"><span class="pick-label">Due</span>' + dueButtons(S, c, now) + '</div></div>'
    + '<input type="hidden" name="priority" value="' + esc(S.priority || '') + '"><input type="hidden" name="deadline" value="' + esc(S.due || '') + '">';
}

// The chip on a task row or Board card and, when it is the open one, its small picker.
export function pickChip(field, t, now = new Date()) {
  const open = pickState.field === field && pickState.taskId === t.id;
  const ctx = { scope: 'task', task: t.id };
  const isPrio = field === 'priority';
  const has = isPrio ? !!(t.priority && PRIORITY[t.priority]) : !!t.deadline;
  const label = isPrio ? (has ? PRIORITY[t.priority].label : 'Priority') : 'Due';
  const inner = !isPrio && has ? deadlineChip(t.deadline, t).replace(/<\/span>$/, ' ▾</span>') : esc(label) + ' ▾';
  const cls = !isPrio && has ? 'pick-bare' : 'chip pick-chip small' + (isPrio ? ' priority-chip' : '') + (has ? '' : ' is-empty');
  const style = isPrio && has ? ' style="--chip-color:var(--prio-' + t.priority + ')"' : '';
  const btn = '<button type="button" class="' + cls + '" data-action="open-pick" data-field="' + field + '" data-task="' + esc(t.id) + '" aria-haspopup="true" aria-expanded="' + open + '"'
    + ' title="' + (isPrio ? 'Priority' : 'Due date') + ' — tap to change"' + style + '>' + inner + '</button>';
  const body = isPrio ? priorityButtons({ priority: t.priority }, ctx) : dueButtons({ due: t.deadline, dateOpen: pickState.dateOpen }, ctx, now);
  return '<span class="pick-wrap">' + btn + (open ? '<div class="pick-pop">' + body + '</div>' : '') + '</span>';
}
