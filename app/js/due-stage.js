// focus-deck-app/js/due-stage.js
// Pure: no imports, no DOM, no clock of its own (the caller passes `now`), so it is unit-tested like
// js/project-filter.js. See docs/4-systems/due-dates.md
//
// A task's stage is worked out from the clock on every render and never stored, so it cannot get
// stuck: moving a due date later can take a task from red back to white, which is correct.

const HOUR = 3600000;

// Percent of the span that must still be left for a stage to begin. A 90-day task turns yellow with
// 30 days left and red with 9; a 3-day task with 1 day and about 7 hours.
export const DEFAULT_DUE_DEFAULTS = { yellowPct: 33, redPct: 10 };

// The plain-term lead times the skippable step offers, longest first. 1 hour is here so a task due
// later today still has something shorter than its yellow choice for red.
export const LEAD_CHOICES = [
  { hours: 720, label: '1 month' },
  { hours: 168, label: '1 week' },
  { hours: 72, label: '3 days' },
  { hours: 24, label: '1 day' },
  { hours: 4, label: '4 hours' },
  { hours: 1, label: '1 hour' },
];

const isPct = (n) => typeof n === 'number' && isFinite(n) && n > 0 && n < 100;

// Settings can hold garbage after a bad sync or hand edit: fall back per field, never throw.
export function normalizeDueDefaults(defaults) {
  const d = defaults || {};
  return {
    yellowPct: isPct(d.yellowPct) ? d.yellowPct : DEFAULT_DUE_DEFAULTS.yellowPct,
    redPct: isPct(d.redPct) ? d.redPct : DEFAULT_DUE_DEFAULTS.redPct,
  };
}

// The end of the due day in the viewer's local time (dueTime arrives in a later PR). Built from
// the date parts, not by adding 24h to midnight, so a daylight-saving change cannot shift it.
export function dueMoment(task) {
  if (!task || !task.deadline) return null;
  const ms = new Date(task.deadline + 'T23:59:59').getTime();
  return isNaN(ms) ? null : ms;
}

// When the span began: when the date was set, else when the task was created, else now (a task
// with neither never leaves white until it is overdue).
function spanStart(task, now) {
  const t = [task.dueSetAt, task.createdAt].find((v) => typeof v === 'number' && isFinite(v));
  // Clamp to now: a start in the future (clock skew between devices) must not make left > span.
  return Math.min(t === undefined ? now : t, now);
}

// How much of the span must be left at or below which `spec` applies, in ms.
function cutoffMs(spec, span, fallbackPct) {
  if (spec && typeof spec.leadHours === 'number' && spec.leadHours > 0) return spec.leadHours * HOUR;
  const pct = spec && isPct(spec.pct) ? spec.pct : fallbackPct;
  return span * pct / 100;
}

export function dueStage(task, now, defaults) {
  if (!task) return 'white';
  if (task.status === 'done') return 'done';
  const due = dueMoment(task);
  if (due === null) return 'white';
  if (now > due) return 'red';
  const d = normalizeDueDefaults(defaults);
  const span = due - spanStart(task, now);
  const left = due - now;
  const stages = task.dueStages || {};
  if (left <= cutoffMs(stages.red, span, d.redPct)) return 'red';
  if (left <= cutoffMs(stages.yellow, span, d.yellowPct)) return 'yellow';
  return 'white';
}

// The lead times shorter than the span, longest first. A task due in 3 days is never offered
// "1 month". `maxHours` (exclusive) lets the red list stop at the chosen yellow.
export function leadChoices(spanMs, maxHours) {
  return LEAD_CHOICES.filter((c) => c.hours * HOUR < spanMs && (maxHours === undefined || c.hours < maxHours));
}

// The choice nearest (in proportion) to `pct` of the span, to preselect in the step.
export function suggestLead(spanMs, pct, maxHours) {
  const choices = leadChoices(spanMs, maxHours);
  if (!choices.length) return null;
  const target = spanMs * pct / 100 / HOUR;
  return choices.reduce((best, c) => (Math.abs(Math.log(c.hours / target)) < Math.abs(Math.log(best.hours / target)) ? c : best));
}

// For the Settings preview: when a task whose span is `spanMs` and whose due moment is `dueAt`
// turns yellow and red under `defaults`. Same arithmetic as dueStage, so the preview cannot drift.
export function stageMoments(dueAt, spanMs, defaults) {
  const d = normalizeDueDefaults(defaults);
  return {
    yellowAt: dueAt - spanMs * d.yellowPct / 100,
    redAt: dueAt - spanMs * d.redPct / 100,
  };
}
