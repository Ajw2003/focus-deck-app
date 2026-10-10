// focus-deck-app/js/category-filter.js
// Settings > Category choices (#133): when sorting a task into a project, offer only the categories
// that project already uses, with the rest one tap away. Applies to the in-tray's flag cards and the
// task forms' label pickers. No DOM; tested in category-filter.test.mjs.
// See docs/4-systems/in-tray.md#category-choices

export const DEFAULT_CATEGORY_FILTER = true;

// The stored setting, { on, updatedAt }, read back safely (an old save has none: on by default).
export function normalizeCategoryFilter(value) {
  if (!value || typeof value !== 'object') return { on: DEFAULT_CATEGORY_FILTER, updatedAt: 0 };
  return { on: value.on !== false, updatedAt: Number(value.updatedAt) || 0 };
}

// Ids of the categories on any of the project's tasks.
export function categoriesUsedIn(project) {
  const used = new Set();
  ((project && project.tasks) || []).forEach((t) => (t.categoryIds || []).forEach((id) => used.add(id)));
  return used;
}

// Splits `categories` into the ones to show now and the ones behind "show all".
// - Filtering off, no project, or a project that uses no categories yet: everything shows.
// - Otherwise: the project's categories, plus anything already picked (never hide a ticked box).
// Order is kept as given. Returns { shown, hidden }.
export function splitCategories(categories, project, { on, selected = [] }) {
  const used = categoriesUsedIn(project);
  if (!on || !project || !used.size) return { shown: categories.slice(), hidden: [] };
  const keep = (c) => used.has(c.id) || selected.includes(c.id);
  return { shown: categories.filter(keep), hidden: categories.filter((c) => !keep(c)) };
}
