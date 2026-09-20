// focus-deck-app/js/state.js
export const ENERGY = { low: { label: 'Low' }, medium: { label: 'Medium' }, high: { label: 'High' } };

const STORAGE_KEY = 'focusdeck-state-v1';

function defaultState() {
  return {
    projects: [],
    inbox: [],
    focus: null,
    completedLog: [],
    excludedRepos: [],
    pinnedRepos: [],
    excludedIssues: [], // "owner/repo#123" entries for issues explicitly unlinked — keeps repo sync from re-creating them
    categories: [
      { id: 'cat_bug', name: 'Bug', color: 'hsl(4 70% 55%)' },
      { id: 'cat_feature', name: 'Feature', color: 'hsl(150 55% 40%)' },
      { id: 'cat_chore', name: 'Chore', color: 'hsl(210 15% 55%)' },
    ],
    projectCategories: [
      { id: 'pcat_work', name: 'Work', color: 'hsl(210 55% 45%)' },
      { id: 'pcat_personal', name: 'Personal', color: 'hsl(150 50% 40%)' },
      { id: 'pcat_learning', name: 'Learning', color: 'hsl(35 65% 45%)' },
    ],
    githubSync: { user: null, lastSyncedAt: null },
    gistId: null,
  };
}

export function loadState() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      // fill in fields added after a user's save predates them
      const d = defaultState();
      return Object.assign(d, parsed, {
        projects: parsed.projects || d.projects,
        categories: parsed.categories || d.categories,
        projectCategories: parsed.projectCategories || d.projectCategories,
      });
    }
  } catch (e) { /* fall through to default */ }
  return defaultState();
}

export function saveStateLocal(state) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (e) { /* storage full/blocked — non-fatal */ }
}

export const state = loadState();

export function uid(prefix) { return prefix + '_' + Math.random().toString(36).slice(2, 9); }

export function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

export function findProjectIdForTask(taskId) {
  for (const p of state.projects) if (p.tasks.some((t) => t.id === taskId)) return p.id;
  return null;
}

export function findTaskWithProject(taskId) {
  for (const p of state.projects) {
    const t = p.tasks.find((t) => t.id === taskId);
    if (t) return { task: t, project: p };
  }
  return null;
}

export function candidatesForEnergy(level) {
  const doing = [], next = [];
  state.projects.forEach((p) => p.tasks.forEach((t) => {
    if (t.status === 'done' || t.energy !== level) return;
    (t.status === 'doing' ? doing : next).push(t);
  }));
  let list = doing.concat(next);
  if (list.length === 0) {
    state.projects.forEach((p) => p.tasks.forEach((t) => {
      if (t.status !== 'done') (t.status === 'doing' ? doing : next).push(t);
    }));
    list = doing.concat(next);
  }
  list.sort((a, b) => {
    const ad = a.deadline ? new Date(a.deadline).getTime() : Infinity;
    const bd = b.deadline ? new Date(b.deadline).getTime() : Infinity;
    return ad - bd;
  });
  return list.map((t) => t.id);
}

export function relTime(ts) {
  const diff = Date.now() - ts;
  const min = Math.round(diff / 60000);
  if (min < 1) return 'just now';
  if (min < 60) return min + 'm ago';
  const hr = Math.round(min / 60);
  if (hr < 24) return hr + 'h ago';
  return Math.round(hr / 24) + 'd ago';
}

export function deadlineChip(iso) {
  const d = new Date(iso + 'T00:00:00');
  const now = new Date();
  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const days = Math.round((d - startToday) / 86400000);
  const label = days < 0 ? Math.abs(days) + 'd overdue' : days === 0 ? 'due today' : 'due in ' + days + 'd';
  return '<span class="chip deadline-chip">' + label + '</span>';
}

export function shortName(name) { return name.length > 14 ? name.slice(0, 13) + '…' : name; }

export function nextHue() { return Math.round((state.projects.length * 137.508) % 360); }

// Resolves any category color string (literal hsl(), or one referencing var(--proj-sat)/
// var(--proj-light)) to #rrggbb, for pre-filling <input type="color">. Shared by settings.html
// and app.js.
export function cssColorToHex(cssColor) {
  const el = document.createElement('span');
  el.style.color = cssColor;
  document.body.appendChild(el);
  const rgb = getComputedStyle(el).color;
  document.body.removeChild(el);
  const nums = rgb.match(/\d+/g);
  if (!nums) return '#888888';
  return '#' + nums.slice(0, 3).map((n) => Number(n).toString(16).padStart(2, '0')).join('');
}
