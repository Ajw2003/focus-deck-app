// focus-deck-app/js/sort-flow.js
// The Sort tab's one-step-per-screen flow (#264), with no DOM: which screen comes next, the weeks of
// a month for the "Another date" page and the lead times the "When should it warn you?" page offers.
// js/sort-flow-view.js draws it and js/app.js wires the taps. See docs/4-systems/in-tray.md
import { dueMoment, leadChoices, suggestLead, normalizeDueDefaults } from './due-stage.js';

export const LAST_STEP = 9;
export const STEP_TITLES = [
  '', 'Which project?', 'How important?', 'What kind of work?', 'When is it due?', 'Part of a bigger task?',
  'Any smaller steps?', 'What has to happen first?', 'What is waiting on this?', 'All good?',
];
// every step after Priority can be skipped (the receipt, step 9, is the end)
export const canSkip = (step) => step >= 3 && step <= 8;

const pad = (n) => String(n).padStart(2, '0');
export const isoOf = (y, m, d) => y + '-' + pad(m + 1) + '-' + pad(d);

// 'YYYY-MM' moved by whole months.
export function shiftMonth(ym, dir) {
  const [y, m] = ym.split('-').map(Number);
  const d = new Date(y, m - 1 + dir, 1);
  return d.getFullYear() + '-' + pad(d.getMonth() + 1);
}

// The weeks of a month, Monday first: rows of 7 cells, each an ISO date or null (a day outside the month).
export function monthGrid(ym) {
  const [y, m] = ym.split('-').map(Number);
  const lead = (new Date(y, m - 1, 1).getDay() + 6) % 7;
  const days = new Date(y, m, 0).getDate();
  const cells = Array.from({ length: lead }, () => null).concat(Array.from({ length: days }, (_, i) => isoOf(y, m - 1, i + 1)));
  while (cells.length % 7) cells.push(null);
  return Array.from({ length: cells.length / 7 }, (_, r) => cells.slice(r * 7, r * 7 + 7));
}

// "Fri 13 Nov" for an ISO date.
export function formatDue(iso) {
  const d = new Date(iso + 'T12:00:00');
  return isNaN(d) ? iso : d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
}

// The two lead-time lists of the warn page, or null when the span leaves no room for a choice (then
// the page is skipped). `picked` is { yellow, red } in hours, or null for the suggestions.
export function warnPlan(due, now, defaults, picked) {
  const at = dueMoment({ deadline: due });
  if (at === null) return null;
  const span = at - now, d = normalizeDueDefaults(defaults);
  const yellowChoices = leadChoices(span).filter((c) => leadChoices(span, c.hours).length);
  if (!yellowChoices.length) return null;
  const sugY = (suggestLead(span, d.yellowPct) || {}).hours;
  const yellow = yellowChoices.find((c) => c.hours === (picked && picked.yellow)) || yellowChoices.find((c) => c.hours === sugY) || yellowChoices[yellowChoices.length - 1];
  const redChoices = leadChoices(span, yellow.hours);
  const red = redChoices.find((c) => c.hours === (picked && picked.red)) || suggestLead(span, d.redPct, yellow.hours);
  return { yellowChoices, yellow, redChoices, red };
}

// What a tap on Next, Skip or Back (or a receipt pencil, `how` a step number) does to the flow.
// `u` is ui.unsorted; ctx is { hasProject, needsPriority, now, defaults }. Returns the fields to write
// onto u, or { why } when Next must wait. A receipt pencil sets fromReceipt, so the step it opens
// goes straight back to the receipt instead of walking on through the rest.
export function navigate(u, how, ctx) {
  if (typeof how === 'number') return { step: how, sub: null, dateOpen: false, fromReceipt: how < LAST_STEP };
  if (how === 'back') {
    if (u.sub || (u.step === 4 && u.dateOpen)) return { sub: null, dateOpen: false };
    return { step: u.fromReceipt ? LAST_STEP : Math.max(0, u.step - 1), fromReceipt: false };
  }
  const onward = { sub: null, step: u.fromReceipt ? LAST_STEP : Math.min(LAST_STEP, u.step + 1), fromReceipt: false };
  if (u.sub === 'warn') return how === 'skip' ? Object.assign(onward, { dueStages: null }) : onward;
  if (how === 'next') {
    if (u.step === 1 && !ctx.hasProject) return { why: 'Choose a project first.' };
    if (u.step === 2 && ctx.needsPriority && !u.priority) return { why: 'Pick a priority to go on.' };
    if (u.step === 4 && u.due && warnPlan(u.due, ctx.now, ctx.defaults, u.dueStages)) return { sub: 'warn' };
  }
  return onward;
}
