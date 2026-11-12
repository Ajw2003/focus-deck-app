// focus-deck-app/js/areas.js
// Pure, no imports. Areas (the stored `projectCategories`) and kinds of work (the stored
// `categories`, with an optional `kind` tick and `priority` mapping). See docs/4-systems/areas.md.

export const UNSORTED_ID = 'pcat_unsorted';
// Ids are fixed (not uid()) so two devices that each add a missing default produce the same record,
// and the id-based merge keeps one copy.
export const DEFAULT_AREAS = [
  { id: 'pcat_personal', name: 'Personal', color: 'hsl(150 50% 40%)' },
  { id: 'pcat_lists', name: 'Lists', color: 'hsl(190 55% 40%)' },
  { id: 'pcat_home', name: 'Home', color: 'hsl(25 65% 48%)' },
  { id: 'pcat_apps', name: 'Apps', color: 'hsl(265 45% 55%)' },
  { id: 'pcat_games', name: 'Games', color: 'hsl(330 55% 52%)' },
  { id: 'pcat_work', name: 'Work', color: 'hsl(210 55% 45%)' },
  { id: 'pcat_school', name: 'School', color: 'hsl(45 70% 42%)' },
  { id: UNSORTED_ID, name: 'Unsorted', color: 'hsl(215 10% 55%)' },
];

const norm = (s) => String(s || '').trim().toLowerCase();

// One-time: adds the default areas an existing user lacks, matched by name. Sets st.areasMigrated.
// Returns true when it ran. Idempotent: the flag stops a second run, and the name match means even
// without it nothing would be added twice.
export function migrateAreas(st) {
  if (st.areasMigrated) return false;
  if (!Array.isArray(st.projectCategories)) st.projectCategories = [];
  DEFAULT_AREAS.forEach((d) => {
    const has = st.projectCategories.some((c) => norm(c.name) === norm(d.name) || c.id === d.id);
    if (!has) st.projectCategories.push(Object.assign({}, d));
  });
  st.areasMigrated = true;
  return true;
}

// The area a project is in: no area, or one that no longer exists, is Unsorted.
export function areaIdOf(st, project) {
  const id = project && project.categoryId;
  return id && id !== UNSORTED_ID && (st.projectCategories || []).some((c) => c.id === id) ? id : UNSORTED_ID;
}
export const areaCount = (st, areaId) => (st.projects || []).filter((p) => areaIdOf(st, p) === areaId).length;

// Labels that mean a workflow state or a priority, not a kind of work: unticked until the user ticks them.
const WORKFLOW = /^(needsreview|duplicate|ajsagentcreatedthis|inprogress|wip|(priority:?\/?)?(urgent|high|medium|low)(priority)?|p[0-4]|asap)$/;
export const isWorkflowLabel = (name) => WORKFLOW.test(norm(name).replace(/[\s_-]+/g, ''));

// A kind of work: ticked by the user (c.kind), else by default unless it is a workflow label.
export const isKindOfWork = (c) => (typeof c.kind === 'boolean' ? c.kind : !isWorkflowLabel(c.name));
export const kindsOfWork = (st) => (st.categories || []).filter(isKindOfWork);

export const LEVELS = ['urgent', 'high', 'medium', 'low'];
// The task's own priority, else the one a label of its maps to (the most urgent if several).
export function effectivePriority(t, st) {
  if (t.priority && LEVELS.includes(t.priority)) return t.priority;
  const mapped = (t.categoryIds || []).map((id) => ((st.categories || []).find((c) => c.id === id) || {}).priority).filter((l) => LEVELS.includes(l));
  return LEVELS.find((l) => mapped.includes(l)) || null;
}
