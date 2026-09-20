# Project Categories & Auto Focus-Tier Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add project categories (with a filter/search/sort bar for the projects grid) and an auto-assigned low/medium/high focus tier (for both manually-created tasks and GitHub-synced issues) to the already-deployed Focus Deck PWA.

**Architecture:** Two independent, additive features layered onto the existing `state.js` / `mutations.js` / `render.js` / `app.js` / `github-sync.js` module split. Project categories mirror the existing task-category pattern (separate list + chip + "+ Add new…" inline creation). Auto focus-tier is a new pure scoring module (`complexity.js`) consumed by both the manual-task mutation path and the GitHub-issue sync path, with the existing priority-label logic (`energyFromLabels`) keeping final say when a label matches. A new pure `project-filter.js` module handles the filter/search/sort bar's logic, mirroring how `sync.js`'s `mergeStates` and `github-sync.js`'s label heuristics are already pure and unit-tested.

**Tech Stack:** Vanilla ES modules, no build step, no framework, no test runner beyond plain `node` + `node:assert` (matches `js/sync.test.mjs` and `js/github-sync.test.mjs`, the only existing tests in this project).

**Spec:** The user-approved design proposal doc — [Focus Deck: Project Categories & Auto Focus-Tier](https://claude.ai/code/artifact/fa53e3dc-f909-4559-8aa9-bce48358b563). This plan implements it in full, including its exact data model, UI decisions, and scoring rubric. Where the spec left an open question (separate vs. shared category list; single- vs multi-select filter), this plan follows the spec's own stated default, which the user approved as-is ("exactly what I'd envisioned").

## Global Constraints

- No new dependencies, no bundler, no build step — plain ES modules loaded directly by the browser, exactly like every existing file under `js/`.
- Every new **pure** function (no `state` singleton access, no DOM, no network) gets a `node js/<name>.test.mjs` unit test file, run with plain `node js/<name>.test.mjs`, using `node:assert` in the exact style of the existing `js/sync.test.mjs` and `js/github-sync.test.mjs`. Do not add a test framework.
- Every task that changes UI-reachable behavior gets a Playwright verification pass **and** an explicit regression check of prior core flows (task add/edit/toggle/delete/cycle-energy, project add/remove, inbox capture/file/discard, the focus picker, GitHub settings) before being marked done. This is an explicit, non-negotiable requirement from the user for this build — do not skip it to save time.
- Match existing code style exactly: string concatenation (`+`) for HTML in `render.js` — no template literals, no JSX, no innerHTML-building via arrays; 2-space indentation; `const`/`let`; `uid('prefix')` for new ids; comments only where a non-obvious decision needs explaining (the existing files do this sparingly — see `sync.js`'s comment above `mergeStates` and `app.js`'s comment above `ui.editingTask = null`).
- Reuse existing CSS custom properties (`--line`, `--surface`, `--surface-2`, `--accent`, `--ink`, `--ink-soft`, `--ink-faint`, `--radius`, `--chip-color`) — do not invent new design tokens.
- New optional parameters on existing exported functions (`addProject`, `addTask`, `editTask`) must be trailing and default-safe, so a call site that hasn't been updated yet in an earlier task never breaks (JS `undefined` args are fine — treat as "not set").
- The local git worktree is `/home/claude/focus-deck-app/.worktrees/focus-deck-pwa-port` on branch `focus-deck-pwa-port`. Commit at the end of each task there with `git -C /home/claude/focus-deck-app/.worktrees/focus-deck-pwa-port ...` (this session's shell working directory has been unreliable across calls — always pass an explicit `-C` path rather than relying on a prior `cd`).
- **`git push` is permanently blocked for this session** (confirmed repeatedly: `access denied by the git proxy`). The final push to `main` (Task 7) must go through the `mcp__GitHub__push_files` / `mcp__GitHub__create_or_update_file` MCP tools, the same workaround already used to deploy this app. Do not spend time retrying `git push`.
- **Do not touch anything under `.github/workflows/`.** This plan's scope needs no workflow changes, and that path cannot be written from this session at all (a confirmed hard wall — `Insufficient scope: required "repo workflow"` from every available channel). If a task ever seems to need a workflow change, stop and flag it rather than attempting one.
- To serve the app locally for Playwright verification, run a plain static server from the worktree root, e.g. `python3 -m http.server 8080 --directory /home/claude/focus-deck-app/.worktrees/focus-deck-pwa-port`, and point Playwright at `http://localhost:8080/index.html`.

---

## Task 1: Project categories — data model, mutations, and UI

**Files:**
- Modify: `js/state.js`
- Modify: `js/mutations.js`
- Modify: `js/render.js`
- Modify: `js/app.js`
- Modify: `css/app.css`

**Interfaces:**
- Consumes: `state.categories` pattern already established in `state.js`/`mutations.js`/`render.js` (this task is a parallel, separate list — see Global Constraints on why separate).
- Produces (used by later tasks): `state.projectCategories` (array of `{id, name, color}`), `project.categoryId` (string id or `null`), `addProjectCategory(name, nextHue) -> id`, `removeProjectCategory(id)`, `setProjectCategory(projectId, categoryId)`, `addProject(name, nextHue, categoryId)`. `renderProjectCard(p, ui, categories, projectCategories)` and `renderAddProjectForm(projectCategories)` gain their new trailing/required params here — Task 5 (filter bar) and Task 6 (GitHub integration) both call `renderProjectCard` with this new 4-arg signature.

- [ ] **Step 1: Add `projectCategories` to the state data model**

In `js/state.js`, add a separate `projectCategories` list to `defaultState()` (right after the existing `categories` field) and fold it into `loadState()`'s migration fallback, exactly like `categories` already is:

```javascript
function defaultState() {
  return {
    projects: [],
    inbox: [],
    focus: null,
    completedLog: [],
    excludedRepos: [],
    pinnedRepos: [],
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
```

A project created before this change simply has no `categoryId` property, which every read site below treats the same as `null` (via `p.categoryId || null`) — no migration of existing `projects` entries is needed, matching how `task.categoryId` already works with no special migration.

- [ ] **Step 2: Verify the state change loads cleanly**

Run: `node -e "import('./js/state.js').then(m => console.log(JSON.stringify(m.loadState().projectCategories)))"` from `/home/claude/focus-deck-app/.worktrees/focus-deck-pwa-port`

Expected: prints the three seeded categories (Work/Personal/Learning) as JSON — confirms no syntax error and the new field is present. (This will fail with a `localStorage is not defined` ReferenceError since `state.js` reads `localStorage` at module scope — that's expected outside a browser; a cleaner check is to open the app in a browser via Playwright in Step 8 instead. If the `node -e` check fails with that specific ReferenceError, treat it as inconclusive rather than a real failure, and rely on Step 8's Playwright check.)

- [ ] **Step 3: Add project-category mutations, and extend `addProject`**

In `js/mutations.js`, update `addProject` to accept an optional trailing `categoryId`, and add three new functions mirroring the existing `addCategory`/`removeCategory` pattern:

```javascript
export function addProject(name, nextHue, categoryId) {
  name = (name || '').trim();
  if (!name) return;
  const hue = nextHue();
  state.projects.push({ id: uid('proj'), name, color: 'hsl(' + hue + ' var(--proj-sat) var(--proj-light))', deadline: null, source: 'manual', categoryId: categoryId || null, tasks: [] });
  persist();
}

export function addProjectCategory(name, nextHue) {
  name = (name || '').trim();
  if (!name) return null;
  const existing = state.projectCategories.find((c) => c.name.toLowerCase() === name.toLowerCase());
  if (existing) return existing.id;
  const id = uid('pcat');
  state.projectCategories.push({ id, name, color: 'hsl(' + nextHue() + ' var(--proj-sat) var(--proj-light))' });
  persist();
  return id;
}

export function removeProjectCategory(id) {
  state.projectCategories = state.projectCategories.filter((c) => c.id !== id);
  state.projects.forEach((p) => { if (p.categoryId === id) p.categoryId = null; });
  persist();
}

export function setProjectCategory(projectId, categoryId) {
  const project = state.projects.find((p) => p.id === projectId);
  if (!project) return;
  project.categoryId = categoryId || null;
  persist();
}
```

`addProject`'s new third parameter is trailing and optional, so the pre-existing call in `app.js` (`M.addProject(name, nextHue)`) keeps working unchanged until Step 5 updates it. `removeProjectCategory` and `setProjectCategory` are spec-mandated data-layer functions (see the proposal doc's "Proposed addition to state" section) but, like the existing `removeCategory` for task categories, have no dedicated UI control in this task — only category *creation* (via the add-project form's "+ Add new…") and *display* (the chip) are wired to UI here, matching the existing precedent for task categories.

- [ ] **Step 4: Add the category select to the add-project form, and the category chip to project cards**

In `js/render.js`, update `renderAddProjectForm` to take the project-categories list and add a `<select>` next to the name field, using the exact "+ Add new…" pattern already used for task categories in `renderProjectCard`'s add-task form:

```javascript
export function renderAddProjectForm(projectCategories) {
  const catOptions = projectCategories.map((c) => '<option value="' + c.id + '">' + esc(c.name) + '</option>').join('');
  return '<form class="add-project-form" data-action="add-project">'
    + '<input type="text" name="name" placeholder="New project name…" maxlength="60" required>'
    + '<select name="category"><option value="">No category</option>' + catOptions + '<option value="__new__">+ Add new…</option></select>'
    + '<button type="submit">+ Add project</button>'
    + '</form>'
    + '<form class="add-project-form" data-action="add-repo" style="margin-top:8px;">'
    + '<input type="text" name="repo" placeholder="owner/repo or a GitHub URL…" maxlength="200" required>'
    + '<button type="submit">+ Track repo</button>'
    + '</form>';
}
```

Update `renderProjectCard` to accept `projectCategories` as a new fourth parameter and render a chip next to the existing GitHub badge, same visual language as the `cat-chip` already used on task rows:

```javascript
export function renderProjectCard(p, ui, categories, projectCategories) {
  const doing = p.tasks.filter((t) => t.status === 'doing');
  const next = p.tasks.filter((t) => t.status === 'next');
  const done = p.tasks.filter((t) => t.status === 'done');
  const total = p.tasks.length;
  const pct = total ? Math.round((done.length / total) * 100) : 0;
  const doneOpen = !!ui.doneOpen[p.id];
  const pendingRemove = !!ui.pendingRemove[p.id];
  const ghBadge = p.source === 'github' ? '<a class="chip gh-chip small" href="' + esc(p.htmlUrl || '#') + '" target="_blank" rel="noopener">' + (p.private ? '🔒 ' : '') + 'GitHub ↗</a>' : '';
  const projCat = projectCategories.find((c) => c.id === p.categoryId);
  const projCatChip = projCat ? '<span class="chip cat-chip small" style="--chip-color:' + projCat.color + '">' + esc(projCat.name) + '</span>' : '';
  const rightControls = pendingRemove
    ? '<span class="remove-confirm">Remove' + (total ? (' &amp; ' + total + ' task' + (total === 1 ? '' : 's')) : '') + '? <button type="button" class="btn-text danger" data-action="confirm-remove-project" data-project="' + p.id + '">Yes</button><button type="button" class="btn-text" data-action="cancel-remove-project" data-project="' + p.id + '">No</button></span>'
    : '<button type="button" class="btn-text" data-action="remove-project" data-project="' + p.id + '">Remove</button>';
  return '<section class="card project-card" id="proj-' + p.id + '" style="--proj-color:' + p.color + '">'
    + '<div class="project-head">'
      + '<div class="project-title"><span class="dot"></span><h3>' + esc(p.name) + '</h3>' + ghBadge + projCatChip + '</div>'
      + '<div class="project-head-right">' + (p.deadline ? deadlineChip(p.deadline) : '') + rightControls + '</div>'
    + '</div>'
    + '<div class="progress-track"><div class="progress-fill" style="width:' + pct + '%"></div></div>'
    + (doing.length ? '<div class="task-group"><h4 class="group-label">In progress</h4>' + doing.map((t) => renderTaskRow(t, p, categories, ui)).join('') + '</div>' : '')
    + (next.length ? '<div class="task-group"><h4 class="group-label">Up next</h4>' + next.map((t) => renderTaskRow(t, p, categories, ui)).join('') + '</div>' : '')
    + (!doing.length && !next.length ? '<p class="muted small">Nothing open — add a task below.</p>' : '')
    + (done.length ? (
        '<button type="button" class="section-toggle small" data-action="toggle-done" data-project="' + p.id + '">' + (doneOpen ? '−' : '+') + ' ' + done.length + ' done</button>'
        + (doneOpen ? '<div class="task-group done-group">' + done.map((t) => renderTaskRow(t, p, categories, ui)).join('') + '</div>' : '')
      ) : '')
    + '<form class="add-task-form" data-action="add-task" data-project="' + p.id + '">'
      + '<input type="text" name="title" placeholder="Add a task…" maxlength="140" required>'
      + '<select name="energy">'
        + '<option value="low">Low</option>'
        + '<option value="medium" selected>Medium</option>'
        + '<option value="high">High</option>'
      + '</select>'
      + '<select name="category">'
        + '<option value="">No category</option>'
        + categories.map((c) => '<option value="' + c.id + '">' + esc(c.name) + '</option>').join('')
        + '<option value="__new__">+ Add new…</option>'
      + '</select>'
      + '<input type="date" name="deadline">'
      + '<button type="submit" aria-label="Add task">+</button>'
    + '</form>'
    + '</section>';
}
```

(Only the `ghBadge`/`projCat`/`projCatChip` lines and the function signature/header line changed from the existing file — the rest of `renderProjectCard`'s body is unchanged and shown here for exact context so the diff is unambiguous. The add-task form's energy/steps fields are extended separately in Task 3.)

- [ ] **Step 5: Wire the new form and chip into `app.js`**

In `js/app.js`, update `renderApp` to pass `st.projectCategories` through to both render calls, and update the `add-project` submit handler to read the category field and handle `__new__`:

```javascript
export function renderApp(st) {
  st._ui = ui; // renderSyncStatus reads sync UI state off the state object it's already passed
  return R.renderSyncStatus(st) + R.renderStats(st) + R.renderFocus(st, findTaskWithProject) + R.renderDone(st) + R.renderInbox(st, ui)
    + '<div class="projects-grid">' + st.projects.map((p) => R.renderProjectCard(p, ui, st.categories, st.projectCategories)).join('') + '</div>'
    + R.renderAddProjectForm(st.projectCategories);
}
```

```javascript
  const addProjectForm = e.target.closest('[data-action="add-project"]');
  if (addProjectForm) {
    e.preventDefault();
    const fd = new FormData(addProjectForm);
    let categoryId = fd.get('category');
    if (categoryId === '__new__') {
      const name = prompt('New project category name:');
      categoryId = name ? M.addProjectCategory(name, nextHue) : '';
    }
    M.addProject(fd.get('name'), nextHue, categoryId);
    return;
  }
```

(This replaces the existing shorter `addProjectForm` block in `onAppSubmit` — everything else in `onAppSubmit`/`onAppClick`/`onAppChange`/`onAppKeydown`/`init` is unchanged in this task.)

- [ ] **Step 6: Style the new select**

In `css/app.css`, add a select rule next to the existing `.add-project-form` rules (which currently only style `input`/`button`):

```css
.add-project-form select{
  padding:11px 10px; border:1.5px dashed var(--line); border-radius:var(--radius); background:transparent; color:var(--ink); font-size:.9rem;
}
```

- [ ] **Step 7: Playwright verification**

Serve the app locally and drive it with Playwright:
1. Load `index.html`. Confirm the "+ Add project" form now shows a category `<select>` between the name field and the submit button, defaulted to "No category", with options "Work", "Personal", "Learning", and "+ Add new…".
2. Fill the name field with `Test Project A`, select "Work" from the category dropdown, submit. Confirm a new project card appears titled "Test Project A" with a chip reading "Work" next to its title.
3. Fill the name field with `Test Project B`, select "+ Add new…" (this triggers a native `prompt()` — register a Playwright `page.on('dialog', d => d.accept('Client X'))` handler before submitting), submit. Confirm the new card shows a chip reading "Client X", and that re-opening the add-project form's category dropdown now also lists "Client X" as a selectable option (proves `addProjectCategory` persisted it to `state.projectCategories`).
4. Reload the page. Confirm both project cards and their chips are still present (proves `localStorage` persistence of `projectCategories` and `project.categoryId`).

- [ ] **Step 8: Regression check**

On the same loaded page: add a task to "Test Project A" via its add-task form, toggle it done and back, edit its title via the inline edit control, and delete it — confirm all four still work exactly as before. Confirm the inbox capture field still adds and files an item. Confirm an existing project's "Remove" confirm/cancel flow is unaffected. Take a screenshot of the grid showing both new project cards with their chips.

- [ ] **Step 9: Commit**

```bash
git -C /home/claude/focus-deck-app/.worktrees/focus-deck-pwa-port add js/state.js js/mutations.js js/render.js js/app.js css/app.css
git -C /home/claude/focus-deck-app/.worktrees/focus-deck-pwa-port commit -m "feat: add project categories with add-project category select and card chip"
```

---

## Task 2: Complexity rubric — pure functions + unit tests

**Files:**
- Create: `js/complexity.js`
- Create: `js/complexity.test.mjs`

**Interfaces:**
- Consumes: nothing (fully pure, no imports from other project files).
- Produces (used by Tasks 3 and 6): `parseSteps(text) -> string[]`, `parseChecklistItems(body) -> string[]`, `wordCount(text) -> number`, `estimateComplexity({stepCount, text, wordCount, labelCount}) -> number` (0–100), `tierFromScore(score) -> 'low'|'medium'|'high'`.

- [ ] **Step 1: Write the failing tests**

Create `js/complexity.test.mjs`:

```javascript
// focus-deck-app/js/complexity.test.mjs — run with: node js/complexity.test.mjs
import { parseSteps, parseChecklistItems, wordCount, estimateComplexity, tierFromScore } from './complexity.js';
import assert from 'node:assert';

// parseSteps: splits on newlines, trims, drops blank lines
assert.deepStrictEqual(parseSteps('Step one\n  Step two  \n\nStep three'), ['Step one', 'Step two', 'Step three'], 'parseSteps should trim and drop blanks');
assert.deepStrictEqual(parseSteps(''), [], 'parseSteps of empty text should be []');
assert.deepStrictEqual(parseSteps(undefined), [], 'parseSteps of undefined should be []');

// parseChecklistItems: counts markdown checklist lines, checked or unchecked, - or *, tolerant of leading space
assert.strictEqual(parseChecklistItems('- [ ] one\n- [x] two\n  * [X] three\nnot a step').length, 3, 'parseChecklistItems should count checklist lines regardless of check state or bullet char');
assert.strictEqual(parseChecklistItems('').length, 0, 'parseChecklistItems of empty body should be 0');
assert.strictEqual(parseChecklistItems(undefined).length, 0, 'parseChecklistItems of undefined body should be 0');

// wordCount
assert.strictEqual(wordCount('one two three'), 3, 'wordCount should count whitespace-separated words');
assert.strictEqual(wordCount('  '), 0, 'wordCount of blank text should be 0');
assert.strictEqual(wordCount(''), 0, 'wordCount of empty text should be 0');

// estimateComplexity: step count bands (0-1 +0, 2-4 +15, 5-8 +30, 9+ +45)
assert.strictEqual(estimateComplexity({ stepCount: 0 }), 0, '0 steps should score +0');
assert.strictEqual(estimateComplexity({ stepCount: 1 }), 0, '1 step should score +0');
assert.strictEqual(estimateComplexity({ stepCount: 2 }), 15, '2 steps should score +15');
assert.strictEqual(estimateComplexity({ stepCount: 4 }), 15, '4 steps should score +15');
assert.strictEqual(estimateComplexity({ stepCount: 5 }), 30, '5 steps should score +30');
assert.strictEqual(estimateComplexity({ stepCount: 8 }), 30, '8 steps should score +30');
assert.strictEqual(estimateComplexity({ stepCount: 9 }), 45, '9 steps should score +45');
assert.strictEqual(estimateComplexity({ stepCount: 20 }), 45, 'step score should not exceed +45');

// estimateComplexity: description length bands (<15 +0, 15-60 +10, 60+ +20)
assert.strictEqual(estimateComplexity({ wordCount: 5 }), 0, '<15 words should score +0');
assert.strictEqual(estimateComplexity({ wordCount: 15 }), 10, '15 words should score +10');
assert.strictEqual(estimateComplexity({ wordCount: 60 }), 20, '60 words should score +20');
assert.strictEqual(estimateComplexity({ wordCount: 200 }), 20, 'length score should not exceed +20');

// estimateComplexity: keyword scan — complexity words add +15 each, capped at +30
assert.strictEqual(estimateComplexity({ text: 'Design the new onboarding flow' }), 15, 'one complexity word should score +15');
assert.strictEqual(estimateComplexity({ text: 'Design and migrate and refactor the pipeline' }), 30, 'three complexity words should cap at +30');

// estimateComplexity: simplicity words subtract 15 each, total floored at 0 (never negative)
assert.strictEqual(estimateComplexity({ text: 'Fix a typo' }), 0, 'a simplicity word alone should not push the score negative');
assert.strictEqual(estimateComplexity({ text: 'Design something, but actually just a quick tweak' }), 0, 'simplicity words should cancel a complexity word rather than go negative');

// estimateComplexity: GitHub-only label bonus — beyond the first, +5 each capped at +15
assert.strictEqual(estimateComplexity({ labelCount: 0 }), 0, '0 labels should score +0');
assert.strictEqual(estimateComplexity({ labelCount: 1 }), 0, 'the first label should score +0');
assert.strictEqual(estimateComplexity({ labelCount: 2 }), 5, 'a second label should score +5');
assert.strictEqual(estimateComplexity({ labelCount: 4 }), 15, 'a fourth label should score +15');
assert.strictEqual(estimateComplexity({ labelCount: 10 }), 15, 'label score should not exceed +15');

// estimateComplexity: signals combine, overall clamped to 100
assert.strictEqual(estimateComplexity({ stepCount: 9, wordCount: 60, text: 'Design and overhaul the sync layer', labelCount: 4 }), 100, 'combined max signals (45+20+30+15=110) should clamp at 100');

// tierFromScore
assert.strictEqual(tierFromScore(0), 'low', 'score 0 should be low');
assert.strictEqual(tierFromScore(24), 'low', 'score 24 should be low');
assert.strictEqual(tierFromScore(25), 'medium', 'score 25 should be medium');
assert.strictEqual(tierFromScore(54), 'medium', 'score 54 should be medium');
assert.strictEqual(tierFromScore(55), 'high', 'score 55 should be high');
assert.strictEqual(tierFromScore(100), 'high', 'score 100 should be high');

console.log('COMPLEXITY RUBRIC TESTS PASSED');
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node js/complexity.test.mjs` from `/home/claude/focus-deck-app/.worktrees/focus-deck-pwa-port`
Expected: FAIL — `Cannot find module './complexity.js'` (the module doesn't exist yet).

- [ ] **Step 3: Implement `complexity.js`**

Create `js/complexity.js`:

```javascript
// focus-deck-app/js/complexity.js
// Pure, synchronous complexity estimation — no network or DOM, mirroring mergeStates and the
// GitHub label heuristics in being directly unit-testable. Implements the rubric from the
// approved "Project Categories & Auto Focus-Tier" proposal: a 0-100 score built from step
// count, description length, a keyword scan, and (GitHub only) label count, mapped to a
// low/medium/high tier via two tunable thresholds. These starting weights are a first guess
// (see the proposal's "Decisions and next steps"), meant to be retuned once there's real usage
// to look at — retune here, in tierFromScore and the score-band functions below, not by adding
// a second scoring path elsewhere.

const COMPLEXITY_WORDS = ['design', 'architecture', 'migrate', 'refactor', 'investigate', 'research', 'overhaul', 'rewrite'];
const SIMPLICITY_WORDS = ['typo', 'rename', 'bump', 'tweak', 'quick', 'minor'];

export function parseSteps(text) {
  return (text || '').split('\n').map((l) => l.trim()).filter(Boolean);
}

export function parseChecklistItems(body) {
  return (body || '').split('\n').filter((l) => /^\s*[-*]\s*\[[ xX]\]/.test(l));
}

export function wordCount(text) {
  return (text || '').trim().split(/\s+/).filter(Boolean).length;
}

function stepScore(count) {
  if (count >= 9) return 45;
  if (count >= 5) return 30;
  if (count >= 2) return 15;
  return 0;
}

function lengthScore(words) {
  if (words >= 60) return 20;
  if (words >= 15) return 10;
  return 0;
}

function keywordDelta(text) {
  const lower = (text || '').toLowerCase();
  let complexityPoints = 0;
  COMPLEXITY_WORDS.forEach((w) => { if (lower.includes(w)) complexityPoints += 15; });
  complexityPoints = Math.min(complexityPoints, 30);
  let simplicityPoints = 0;
  SIMPLICITY_WORDS.forEach((w) => { if (lower.includes(w)) simplicityPoints += 15; });
  return complexityPoints - simplicityPoints;
}

function labelScore(labelCount) {
  return Math.min(Math.max(labelCount - 1, 0) * 5, 15);
}

export function estimateComplexity({ stepCount = 0, text = '', wordCount: words = 0, labelCount = 0 } = {}) {
  const raw = stepScore(stepCount) + lengthScore(words) + keywordDelta(text) + labelScore(labelCount);
  return Math.max(0, Math.min(100, raw));
}

export function tierFromScore(score) {
  if (score < 25) return 'low';
  if (score < 55) return 'medium';
  return 'high';
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `node js/complexity.test.mjs`
Expected: PASS — prints `COMPLEXITY RUBRIC TESTS PASSED` with no assertion errors.

- [ ] **Step 5: Commit**

```bash
git -C /home/claude/focus-deck-app/.worktrees/focus-deck-pwa-port add js/complexity.js js/complexity.test.mjs
git -C /home/claude/focus-deck-app/.worktrees/focus-deck-pwa-port commit -m "feat: add pure complexity-scoring rubric with unit tests"
```

---

## Task 3: Manual task auto-energy — steps field + Auto option

**Files:**
- Modify: `js/mutations.js`
- Modify: `js/render.js`
- Modify: `js/app.js`
- Modify: `css/app.css`

**Interfaces:**
- Consumes: `parseSteps`, `wordCount`, `estimateComplexity`, `tierFromScore` from `js/complexity.js` (Task 2).
- Produces: `task.steps` (string array, present only when non-empty), `task.energyAuto` (boolean), `addTask(projectId, title, energy, deadline, categoryId, stepsText)`, `editTask(taskId, projectId, fields)` where `fields` may include `steps` (raw textarea text) alongside the existing `title`/`energy`/`deadline`/`categoryId`.

- [ ] **Step 1: Add auto-energy computation and steps parsing to `mutations.js`**

In `js/mutations.js`, add the import and a local helper, then update `addTask`, `editTask`, and `cycleEnergy`:

```javascript
import { state, uid } from './state.js';
import { persist } from './sync.js';
import { parseSteps, wordCount, estimateComplexity, tierFromScore } from './complexity.js';

function computeAutoEnergy(title, steps) {
  const text = [title, (steps || []).join(' ')].filter(Boolean).join(' ');
  const score = estimateComplexity({ stepCount: (steps || []).length, text, wordCount: wordCount(text) });
  return tierFromScore(score);
}
```

(The import line replaces the existing `import { state, uid } from './state.js';` / `import { persist } from './sync.js';` pair at the top of the file — add the new `complexity.js` import as a third line, keep the first two unchanged.)

```javascript
export function addTask(projectId, title, energy, deadline, categoryId, stepsText) {
  title = (title || '').trim();
  if (!title) return;
  const project = state.projects.find((p) => p.id === projectId);
  if (!project) return;
  const steps = parseSteps(stepsText);
  const energyAuto = !energy || energy === 'auto';
  const resolvedEnergy = energyAuto ? computeAutoEnergy(title, steps) : energy;
  const task = { id: uid('t'), title, energy: resolvedEnergy, energyAuto, status: 'next', deadline: deadline || null, categoryId: categoryId || null, source: 'manual', updatedAt: Date.now() };
  if (steps.length) task.steps = steps;
  project.tasks.push(task);
  persist();
}

export function editTask(taskId, projectId, fields) {
  const project = state.projects.find((p) => p.id === projectId);
  if (!project) return;
  const task = project.tasks.find((t) => t.id === taskId);
  if (!task) return;
  if (fields.title !== undefined) { const t = fields.title.trim(); if (t) task.title = t; }
  if (fields.steps !== undefined) {
    const steps = parseSteps(fields.steps);
    if (steps.length) task.steps = steps; else delete task.steps;
  }
  if (fields.deadline !== undefined) task.deadline = fields.deadline || null;
  if (fields.categoryId !== undefined) task.categoryId = fields.categoryId || null;
  if (fields.energy !== undefined) {
    if (fields.energy === 'auto') {
      task.energyAuto = true;
      task.energy = computeAutoEnergy(task.title, task.steps || []);
    } else {
      task.energyAuto = false;
      task.energy = fields.energy;
    }
  }
  task.updatedAt = Date.now();
  persist();
}

export function cycleEnergy(taskId, projectId) {
  const project = state.projects.find((p) => p.id === projectId);
  if (!project) return;
  const task = project.tasks.find((t) => t.id === taskId);
  if (!task || task.status === 'done') return;
  const order = ['low', 'medium', 'high'];
  task.energy = order[(order.indexOf(task.energy) + 1) % order.length];
  task.energyAuto = false;
  task.updatedAt = Date.now();
  persist();
}
```

`fields.steps` is handled before `fields.energy` above so an Auto recompute on save uses the just-updated steps, not the stale ones.

- [ ] **Step 2: Add the steps textarea and Auto option to both task forms**

In `js/render.js`, update `renderTaskEditForm` (Auto-aware select, steps textarea):

```javascript
export function renderTaskEditForm(t, p, categories) {
  const catOptions = categories.map((c) => '<option value="' + c.id + '"' + (t.categoryId === c.id ? ' selected' : '') + '>' + esc(c.name) + '</option>').join('');
  const energyValue = t.energyAuto ? 'auto' : t.energy;
  return '<form class="task-edit-form" data-action="save-task-edit" data-task="' + t.id + '" data-project="' + p.id + '">'
    + '<input type="text" name="title" value="' + esc(t.title) + '" maxlength="140" required autofocus>'
    + '<textarea name="steps" placeholder="Steps (optional, one per line)…" rows="2">' + esc((t.steps || []).join('\n')) + '</textarea>'
    + '<select name="energy">'
      + '<option value="auto"' + (energyValue === 'auto' ? ' selected' : '') + '>Auto</option>'
      + ['low', 'medium', 'high'].map((lvl) => '<option value="' + lvl + '"' + (energyValue === lvl ? ' selected' : '') + '>' + ENERGY[lvl].label + '</option>').join('')
    + '</select>'
    + '<select name="category"><option value="">No category</option>' + catOptions + '<option value="__new__">+ Add new…</option></select>'
    + '<input type="date" name="deadline" value="' + (t.deadline || '') + '">'
    + '<button type="submit">Save</button>'
    + '<button type="button" data-action="cancel-task-edit">Cancel</button>'
    + '</form>';
}
```

And the add-task form inside `renderProjectCard` (add a steps textarea; make Auto the default selected energy option, replacing the previous Medium default):

```javascript
    + '<form class="add-task-form" data-action="add-task" data-project="' + p.id + '">'
      + '<input type="text" name="title" placeholder="Add a task…" maxlength="140" required>'
      + '<textarea name="steps" placeholder="Steps (optional, one per line)…" rows="2"></textarea>'
      + '<select name="energy">'
        + '<option value="auto" selected>Auto</option>'
        + '<option value="low">Low</option>'
        + '<option value="medium">Medium</option>'
        + '<option value="high">High</option>'
      + '</select>'
      + '<select name="category">'
        + '<option value="">No category</option>'
        + categories.map((c) => '<option value="' + c.id + '">' + esc(c.name) + '</option>').join('')
        + '<option value="__new__">+ Add new…</option>'
      + '</select>'
      + '<input type="date" name="deadline">'
      + '<button type="submit" aria-label="Add task">+</button>'
    + '</form>'
```

(This replaces just the `add-task-form` block inside `renderProjectCard` from Task 1 — the rest of that function, including the Task 1 category-chip changes, is unchanged.)

- [ ] **Step 3: Read the new `steps` field in `app.js`**

In `js/app.js`'s `onAppSubmit`, update the `add-task` and `save-task-edit` handlers to pass the steps textarea through:

```javascript
  const addTaskForm = e.target.closest('[data-action="add-task"]');
  if (addTaskForm) {
    e.preventDefault();
    const fd = new FormData(addTaskForm);
    let categoryId = fd.get('category');
    if (categoryId === '__new__') {
      const name = prompt('New category name:');
      categoryId = name ? M.addCategory(name, nextHue) : '';
    }
    M.addTask(addTaskForm.getAttribute('data-project'), fd.get('title'), fd.get('energy'), fd.get('deadline'), categoryId, fd.get('steps'));
    return;
  }
```

```javascript
  const editForm = e.target.closest('[data-action="save-task-edit"]');
  if (editForm) {
    e.preventDefault();
    const fd = new FormData(editForm);
    // ui.editingTask is cleared *before* the mutation: M.editTask -> persist() repaints
    // synchronously, so clearing it after the call would still show the edit form for
    // this task in that repaint.
    ui.editingTask = null;
    let editCategoryId = fd.get('category');
    if (editCategoryId === '__new__') {
      const name = prompt('New category name:');
      editCategoryId = name ? M.addCategory(name, nextHue) : '';
    }
    M.editTask(editForm.getAttribute('data-task'), editForm.getAttribute('data-project'), {
      title: fd.get('title'), energy: fd.get('energy'), deadline: fd.get('deadline'), categoryId: editCategoryId, steps: fd.get('steps'),
    });
    return;
  }
```

- [ ] **Step 4: Style the textareas**

In `css/app.css`, add a rule covering both forms' new textarea, next to the existing `.task-edit-form`/`.add-task-form` input/select rules:

```css
.task-edit-form textarea,.add-task-form textarea{
  flex:1 1 160px; min-width:0; padding:6px 9px; border:1px solid var(--line); border-radius:6px; background:var(--surface); color:var(--ink); font:inherit; font-size:.82rem; resize:vertical;
}
```

- [ ] **Step 5: Playwright verification**

1. On a project card, use the add-task form: title `Design the new onboarding flow`, steps textarea with 5 lines (`Draft wireframes`, `Write copy`, `Build components`, `Wire up API`, `QA and ship`), leave energy on its default "Auto", submit.
2. Confirm the new task row's energy chip reads **High** (stepScore 5 steps = +30, wordCount of title+steps ≈ 20 words = +10, keyword "design" = +15 → score 55 → high).
3. Click the task title to open its edit form. Confirm the energy `<select>` shows "Auto" selected (not "High") — proves `energyAuto` round-trips correctly.
4. Cancel the edit, then click the energy chip directly to cycle it manually. Confirm the chip value changes. Re-open the edit form and confirm the select now shows the manually-cycled level selected, **not** "Auto" — proves `cycleEnergy` correctly turns `energyAuto` off.
5. Add a second task with title `Fix a typo`, no steps, energy left on Auto. Confirm its chip reads **Low**.

- [ ] **Step 6: Regression check**

Confirm task add/toggle/delete still work on a task with no steps and an explicitly-chosen (non-Auto) energy level. Confirm project-category chips from Task 1 are unaffected. Confirm the focus picker (low/medium/high buttons) still surfaces tasks correctly by energy level, including the two new auto-scored tasks. Confirm inbox capture/file/discard still works.

- [ ] **Step 7: Commit**

```bash
git -C /home/claude/focus-deck-app/.worktrees/focus-deck-pwa-port add js/mutations.js js/render.js js/app.js css/app.css
git -C /home/claude/focus-deck-app/.worktrees/focus-deck-pwa-port commit -m "feat: add optional steps field and Auto energy option to manual tasks"
```

---

## Task 4: Project filter/search/sort — pure function + unit tests

**Files:**
- Create: `js/project-filter.js`
- Create: `js/project-filter.test.mjs`
- Modify: `js/github-sync.js` (one-line addition: stamp `project.lastSyncedAt`, needed for the "Recently synced" sort mode to have real data to sort by)

**Interfaces:**
- Consumes: nothing from other project files for the pure logic; `js/github-sync.js`'s `upsertRepoProject` gains a `project.lastSyncedAt = Date.now()` side effect.
- Produces (used by Task 5): `filterAndSortProjects(projects, {categoryId, query, sortBy}) -> Project[]`, `sortProjects(list, sortBy) -> Project[]`.

- [ ] **Step 1: Write the failing tests**

Create `js/project-filter.test.mjs`:

```javascript
// focus-deck-app/js/project-filter.test.mjs — run with: node js/project-filter.test.mjs
import { filterAndSortProjects, sortProjects } from './project-filter.js';
import assert from 'node:assert';

function proj(overrides) {
  return Object.assign({ id: 'p', name: 'Proj', categoryId: null, source: 'manual', deadline: null, tasks: [] }, overrides);
}

// categoryId filter
const projects = [
  proj({ id: 'p1', name: 'Alpha', categoryId: 'work' }),
  proj({ id: 'p2', name: 'Beta', categoryId: null }),
  proj({ id: 'p3', name: 'Gamma', categoryId: 'work' }),
];
assert.deepStrictEqual(filterAndSortProjects(projects, {}).map((p) => p.id), ['p1', 'p2', 'p3'], 'no categoryId filter (undefined) should keep all projects, sorted by name');
assert.deepStrictEqual(filterAndSortProjects(projects, { categoryId: 'work' }).map((p) => p.id), ['p1', 'p3'], 'categoryId filter should keep only matching projects');
assert.deepStrictEqual(filterAndSortProjects(projects, { categoryId: null }).map((p) => p.id), ['p2'], 'categoryId: null should match Uncategorized projects');

// query filter — case-insensitive substring match on name
assert.deepStrictEqual(filterAndSortProjects(projects, { query: 'al' }).map((p) => p.id), ['p1'], 'query should case-insensitively substring-match project names');
assert.deepStrictEqual(filterAndSortProjects(projects, { query: 'ZZZ' }).map((p) => p.id), [], 'query with no match should return an empty list');

// sortProjects: name (default)
assert.deepStrictEqual(sortProjects([proj({ id: 'p1', name: 'Zeta' }), proj({ id: 'p2', name: 'Alpha' })], 'name').map((p) => p.id), ['p2', 'p1'], 'name sort should be alphabetical');

// sortProjects: open-tasks (most open tasks first)
const withTasks = [
  proj({ id: 'p1', name: 'A', tasks: [{ status: 'next' }, { status: 'done' }] }), // 1 open
  proj({ id: 'p2', name: 'B', tasks: [{ status: 'next' }, { status: 'doing' }, { status: 'next' }] }), // 3 open
];
assert.deepStrictEqual(sortProjects(withTasks, 'open-tasks').map((p) => p.id), ['p2', 'p1'], 'open-tasks sort should put the most open tasks first');

// sortProjects: deadline (closest first, from task deadlines and the project's own deadline; undated last)
const withDeadlines = [
  proj({ id: 'p1', name: 'A', deadline: '2026-12-01' }),
  proj({ id: 'p2', name: 'B', tasks: [{ status: 'next', deadline: '2026-10-01' }] }),
  proj({ id: 'p3', name: 'C' }),
];
assert.deepStrictEqual(sortProjects(withDeadlines, 'deadline').map((p) => p.id), ['p2', 'p1', 'p3'], 'deadline sort should put the closest upcoming deadline first, undated projects last');

// sortProjects: recent-sync (GitHub projects by lastSyncedAt desc, manual projects fall back to name)
const withSync = [
  proj({ id: 'p1', name: 'Older', source: 'github', lastSyncedAt: 1000 }),
  proj({ id: 'p2', name: 'Newer', source: 'github', lastSyncedAt: 2000 }),
  proj({ id: 'p3', name: 'Manual' }),
];
assert.deepStrictEqual(sortProjects(withSync, 'recent-sync').map((p) => p.id), ['p2', 'p1', 'p3'], 'recent-sync sort should rank most-recently-synced GitHub projects first, manual projects last by name');

console.log('PROJECT FILTER/SORT TESTS PASSED');
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node js/project-filter.test.mjs`
Expected: FAIL — `Cannot find module './project-filter.js'`.

- [ ] **Step 3: Implement `project-filter.js`**

Create `js/project-filter.js`:

```javascript
// focus-deck-app/js/project-filter.js
// Pure, synchronous — filtering/sorting the projects grid. Takes the project list and view
// options as plain arguments (no state.js import) so it's directly unit-testable, the same way
// mergeStates and the GitHub label heuristics already are.

function openTaskCount(p) { return p.tasks.filter((t) => t.status !== 'done').length; }

function closestDeadlineMs(p) {
  const dates = p.tasks.filter((t) => t.status !== 'done' && t.deadline).map((t) => new Date(t.deadline + 'T00:00:00').getTime());
  if (p.deadline) dates.push(new Date(p.deadline + 'T00:00:00').getTime());
  return dates.length ? Math.min(...dates) : Infinity;
}

export function sortProjects(list, sortBy) {
  const sorted = list.slice();
  if (sortBy === 'open-tasks') {
    sorted.sort((a, b) => openTaskCount(b) - openTaskCount(a));
  } else if (sortBy === 'deadline') {
    sorted.sort((a, b) => closestDeadlineMs(a) - closestDeadlineMs(b));
  } else if (sortBy === 'recent-sync') {
    sorted.sort((a, b) => {
      const aTime = a.source === 'github' && a.lastSyncedAt ? a.lastSyncedAt : -1;
      const bTime = b.source === 'github' && b.lastSyncedAt ? b.lastSyncedAt : -1;
      if (aTime !== bTime) return bTime - aTime; // most recently synced first
      return a.name.localeCompare(b.name); // ties (including all-manual) fall back to name
    });
  } else {
    sorted.sort((a, b) => a.name.localeCompare(b.name));
  }
  return sorted;
}

export function filterAndSortProjects(projects, { categoryId, query, sortBy } = {}) {
  let list = projects;
  if (categoryId !== undefined) list = list.filter((p) => (p.categoryId || null) === categoryId);
  if (query) list = list.filter((p) => p.name.toLowerCase().includes(query.toLowerCase()));
  return sortProjects(list, sortBy);
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `node js/project-filter.test.mjs`
Expected: PASS — prints `PROJECT FILTER/SORT TESTS PASSED`.

- [ ] **Step 5: Stamp `lastSyncedAt` on GitHub-sourced projects**

In `js/github-sync.js`'s `upsertRepoProject`, add one line after the create/update branch so "Recently synced" has real data:

```javascript
  if (!project) {
    project = { id: uid('gh'), name: repo.name, color: 'hsl(' + nextHue() + ' var(--proj-sat) var(--proj-light))', deadline: null, source: 'github', repoFullName: repo.full_name, htmlUrl: repo.html_url, private: !!repo.private, tasks: [] };
    state.projects.push(project);
  } else {
    project.htmlUrl = repo.html_url;
    project.private = !!repo.private;
  }
  project.lastSyncedAt = Date.now();
```

(Only the added `project.lastSyncedAt = Date.now();` line is new — the `if (!project) {...} else {...}` block above it is unchanged, shown for exact placement.)

- [ ] **Step 6: Commit**

```bash
git -C /home/claude/focus-deck-app/.worktrees/focus-deck-pwa-port add js/project-filter.js js/project-filter.test.mjs js/github-sync.js
git -C /home/claude/focus-deck-app/.worktrees/focus-deck-pwa-port commit -m "feat: add pure project filter/sort function with unit tests"
```

---

## Task 5: Filter/search/sort — UI bar + wiring

**Files:**
- Modify: `js/render.js`
- Modify: `js/app.js`
- Modify: `css/app.css`

**Interfaces:**
- Consumes: `filterAndSortProjects` from `js/project-filter.js` (Task 4); `state.projectCategories`/`project.categoryId` from Task 1.
- Produces: `ui.projectFilter` (`undefined` = All, `null` = Uncategorized, or a category id), `ui.projectQuery` (string), `ui.projectSort` (one of `'name'|'open-tasks'|'deadline'|'recent-sync'`), `renderProjectFilterBar(st, ui)`.

- [ ] **Step 1: Add the filter bar renderer**

In `js/render.js`, add a new exported function (place it just above `renderProjectCard`, since it renders immediately before the grid):

```javascript
export function renderProjectFilterBar(st, ui) {
  if (!st.projects.length) return '';
  const usedCategoryIds = new Set(st.projects.map((p) => p.categoryId).filter(Boolean));
  const hasUncategorized = st.projects.some((p) => !p.categoryId);
  const pills = [{ key: '', label: 'All' }]
    .concat(st.projectCategories.filter((c) => usedCategoryIds.has(c.id)).map((c) => ({ key: c.id, label: c.name })))
    .concat(hasUncategorized ? [{ key: '__uncat__', label: 'Uncategorized' }] : []);
  const activeKey = ui.projectFilter === undefined ? '' : (ui.projectFilter === null ? '__uncat__' : ui.projectFilter);
  const pillsHTML = pills.map((pill) => {
    const active = pill.key === activeKey;
    return '<button type="button" class="filter-pill' + (active ? ' active' : '') + '" data-action="set-project-filter" data-category="' + pill.key + '">' + esc(pill.label) + '</button>';
  }).join('');
  const sortOptions = [
    ['name', 'Name (A–Z)'], ['open-tasks', 'Most open tasks'], ['deadline', 'Closest deadline'], ['recent-sync', 'Recently synced'],
  ].map(([value, label]) => '<option value="' + value + '"' + (ui.projectSort === value ? ' selected' : '') + '>' + esc(label) + '</option>').join('');
  return '<div class="project-filter-bar">'
    + '<div class="filter-pills">' + pillsHTML + '</div>'
    + '<input type="text" class="project-search" data-action="set-project-query" placeholder="Search projects…" value="' + esc(ui.projectQuery || '') + '">'
    + '<select class="project-sort-select" data-action="set-project-sort">' + sortOptions + '</select>'
    + '</div>';
}
```

- [ ] **Step 2: Wire filtering into `renderApp`, and add the pill/search/sort event handlers in `app.js`**

In `js/app.js`, add the import, extend `ui`, and update `renderApp`:

```javascript
import { state, findTaskWithProject, findProjectIdForTask, candidatesForEnergy, nextHue } from './state.js';
import * as M from './mutations.js';
import * as R from './render.js';
import { registerPaint, initSyncLifecycle, pullFromGist } from './sync.js';
import { syncGithub, addRepoManually } from './github-sync.js';
import { filterAndSortProjects } from './project-filter.js';

export const ui = { inboxOpen: true, doneOpen: {}, pendingRemove: {}, syncing: false, syncError: null, editingTask: null, projectFilter: undefined, projectQuery: '', projectSort: 'name' };

export function renderApp(st) {
  st._ui = ui; // renderSyncStatus reads sync UI state off the state object it's already passed
  const visibleProjects = filterAndSortProjects(st.projects, { categoryId: ui.projectFilter, query: ui.projectQuery, sortBy: ui.projectSort });
  return R.renderSyncStatus(st) + R.renderStats(st) + R.renderFocus(st, findTaskWithProject) + R.renderDone(st) + R.renderInbox(st, ui)
    + R.renderProjectFilterBar(st, ui)
    + '<div class="projects-grid">' + visibleProjects.map((p) => R.renderProjectCard(p, ui, st.categories, st.projectCategories)).join('')
      + (st.projects.length && !visibleProjects.length ? '<p class="muted small">No projects match.</p>' : '')
    + '</div>'
    + R.renderAddProjectForm(st.projectCategories);
}
```

Update `paint()` to preserve focus and cursor position in the search box across re-renders (without this, every keystroke would blur the input, since `paint()` replaces `#app`'s entire innerHTML on every `persist()`/UI-state change — unlike the always-visible `#capture-input`, which lives outside `#app` in `index.html` and never gets re-rendered):

```javascript
export function paint() {
  const scrollY = window.scrollY;
  const active = document.activeElement;
  const restoreSearch = active && active.matches && active.matches('.project-search') ? { start: active.selectionStart, end: active.selectionEnd } : null;
  document.getElementById('app').innerHTML = renderApp(state);
  window.scrollTo(0, scrollY);
  if (restoreSearch) {
    const el = document.querySelector('.project-search');
    if (el) { el.focus(); el.setSelectionRange(restoreSearch.start, restoreSearch.end); }
  }
}
```

Add the pill click handler inside `onAppClick` (anywhere in the existing if/else chain, e.g. right after the `edit-task`/`cancel-task-edit` branches):

```javascript
  else if (action === 'set-project-filter') {
    const cat = el.getAttribute('data-category');
    ui.projectFilter = cat === '' ? undefined : (cat === '__uncat__' ? null : cat);
    paint();
  }
```

Extend `onAppChange` to handle the sort dropdown:

```javascript
function onAppChange(e) {
  if (e.target.matches && e.target.matches('[data-action="toggle-task"]')) {
    M.toggleTask(e.target.getAttribute('data-task'), e.target.getAttribute('data-project'));
  } else if (e.target.matches && e.target.matches('[data-action="set-project-sort"]')) {
    ui.projectSort = e.target.value;
    paint();
  }
}
```

Add a new `onAppInput` handler for live search-as-you-type (mirroring how the spec calls for "no submit button, just filters on every keystroke"), and wire it up in `init()`:

```javascript
function onAppInput(e) {
  if (e.target.matches && e.target.matches('[data-action="set-project-query"]')) {
    ui.projectQuery = e.target.value;
    paint();
  }
}
```

```javascript
function init() {
  paint();
  initSyncLifecycle();
  const app = document.getElementById('app');
  app.addEventListener('click', onAppClick);
  app.addEventListener('change', onAppChange);
  app.addEventListener('input', onAppInput);
  app.addEventListener('submit', onAppSubmit);
  app.addEventListener('keydown', onAppKeydown);
  const captureForm = document.getElementById('capture-form');
  captureForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const input = document.getElementById('capture-input');
    M.addCapture(input.value);
    input.value = '';
    input.focus();
  });
}
```

(Only the `app.addEventListener('input', onAppInput);` line is new inside `init()`.)

- [ ] **Step 3: Style the filter bar**

In `css/app.css`, add:

```css
.project-filter-bar{display:flex; flex-wrap:wrap; align-items:center; gap:8px; margin-bottom:14px;}
.filter-pills{display:flex; flex-wrap:wrap; gap:6px;}
.filter-pill{
  border:1px solid var(--line); background:var(--surface); border-radius:999px;
  padding:6px 13px; font-size:.8rem; font-weight:600; color:var(--ink-soft);
}
.filter-pill.active{background:var(--accent); color:var(--accent-ink); border-color:transparent;}
.project-search{
  flex:1 1 160px; min-width:0; padding:7px 12px; border:1px solid var(--line); border-radius:999px; background:var(--surface); color:var(--ink); font-size:.85rem;
}
.project-sort-select{
  padding:7px 10px; border:1px solid var(--line); border-radius:999px; background:var(--surface); color:var(--ink); font-size:.82rem;
}
```

- [ ] **Step 4: Playwright verification**

Using the two categorized projects from Task 1 plus at least one more manual project left Uncategorized:
1. Confirm the filter bar shows pills: "All" (active by default), "Work", "Client X" (or whichever categories are in use), and "Uncategorized" — and confirms it does **not** show unused seeded categories (e.g. "Personal", "Learning", if no project uses them).
2. Click the "Work" pill. Confirm only the Work-categorized project card remains visible, and the pill shows the active style.
3. Type into the search box a substring matching only one visible project's name, one character at a time. Confirm the grid live-filters on every keystroke, and — critically — confirm the search input never loses focus and each typed character lands correctly (i.e., the full string ends up in the box, not a truncated/reordered one), which would fail if the focus/cursor-restore logic in `paint()` were missing or wrong.
4. Change the sort dropdown to "Most open tasks". Add an extra task to one visible project so open-task counts differ, and confirm the order updates accordingly.
5. Click "All" to reset the filter and confirm every project reappears.

- [ ] **Step 5: Regression check**

Confirm `renderStats` (the top summary pills) still lists every project regardless of the active filter (it reads `st.projects` directly, not the filtered list — this is intentional and should be verified, not "fixed"). Confirm task add/edit/toggle/delete still work on a project visible under an active filter. Confirm the focus picker and inbox are unaffected. Confirm a full page reload preserves project data (filter/search/sort UI state is intentionally *not* persisted — the spec calls this out explicitly as a view preference, not synced data — so after reload the filter bar should reset to "All" / empty search / "Name (A–Z)", which is correct behavior, not a bug).

- [ ] **Step 6: Commit**

```bash
git -C /home/claude/focus-deck-app/.worktrees/focus-deck-pwa-port add js/render.js js/app.js css/app.css
git -C /home/claude/focus-deck-app/.worktrees/focus-deck-pwa-port commit -m "feat: add project filter/search/sort bar"
```

---

## Task 6: GitHub-issue auto-complexity integration

**Files:**
- Modify: `js/github.js`
- Modify: `js/github-sync.js`
- Modify: `js/github-sync.test.mjs`

**Interfaces:**
- Consumes: `parseChecklistItems`, `wordCount`, `estimateComplexity`, `tierFromScore` from `js/complexity.js` (Task 2).
- Produces: `listIssues()` results gain a `body` field; `resolveIssueEnergy(iss)` (new exported pure function in `github-sync.js`, used in place of the direct `energyFromLabels(iss.labels)` call at task-creation time).

- [ ] **Step 1: Include issue body in `listIssues`**

In `js/github.js`, add `body` to the mapped issue shape:

```javascript
export async function listIssues(owner, repo) {
  const raw = await ghFetch('/repos/' + owner + '/' + repo + '/issues?state=open&per_page=100');
  // the REST issues endpoint includes pull requests — exclude them (the MCP list_issues tool
  // used earlier in this project did this filtering internally; here it's explicit)
  return raw.filter((i) => !i.pull_request).map((i) => ({
    number: i.number,
    title: i.title,
    labels: i.labels.map((l) => (typeof l === 'string' ? l : l.name)),
    body: i.body || '',
  }));
}
```

- [ ] **Step 2: Add `resolveIssueEnergy` and use it in `upsertRepoProject`**

In `js/github-sync.js`, add the import and the new exported function:

```javascript
import { state, uid, nextHue } from './state.js';
import { validateToken, listRepos, listIssues, ghFetch } from './github.js';
import { persist } from './sync.js';
import { parseChecklistItems, wordCount, estimateComplexity, tierFromScore } from './complexity.js';
```

```javascript
export function resolveIssueEnergy(iss) {
  const labelEnergy = energyFromLabels(iss.labels);
  if (labelEnergy !== 'medium') return labelEnergy; // an explicit priority label always wins
  const body = iss.body || '';
  const text = [iss.title, body].filter(Boolean).join(' ');
  const score = estimateComplexity({
    stepCount: parseChecklistItems(body).length,
    text,
    wordCount: wordCount(body),
    labelCount: (iss.labels || []).length,
  });
  return tierFromScore(score);
}
```

Then, in `upsertRepoProject`, replace the direct call at task creation:

```javascript
  labeled.forEach((iss) => {
    const existing = project.tasks.find((t) => t.source === 'github' && t.issueNumber === iss.number);
    if (existing) {
      existing.title = iss.title;
      existing.url = repo.html_url + '/issues/' + iss.number;
    } else {
      project.tasks.push({ id: uid('t'), title: iss.title, energy: resolveIssueEnergy(iss), status: statusFromLabels(iss.labels), deadline: null, categoryId: null, source: 'github', issueNumber: iss.number, url: repo.html_url + '/issues/' + iss.number, updatedAt: Date.now() });
    }
  });
```

(Only `energy: energyFromLabels(iss.labels)` changed to `energy: resolveIssueEnergy(iss)` on that one line — everything else in `upsertRepoProject`, including the `existing` branch and the `project.lastSyncedAt` line from Task 4, is unchanged.)

- [ ] **Step 3: Extend the unit tests**

In `js/github-sync.test.mjs`, add the import and new assertions (append to the existing file, don't remove any existing assertions):

```javascript
import { energyFromLabels, statusFromLabels, parseRepoInput, resolveIssueEnergy } from './github-sync.js';
```

```javascript
// resolveIssueEnergy: an explicit priority label wins over the complexity estimate
assert.strictEqual(resolveIssueEnergy({ title: 'x', body: '', labels: ['high-priority'] }), 'high', 'an explicit high-priority label should win over the complexity estimate');
assert.strictEqual(resolveIssueEnergy({ title: 'x', body: '', labels: ['good-first-issue'] }), 'low', 'an explicit low-priority label should win over the complexity estimate');

// resolveIssueEnergy: no priority label -> falls back to the complexity estimate
assert.strictEqual(resolveIssueEnergy({ title: 'Quick typo fix', body: '', labels: [] }), 'low', 'a simple issue with no priority label should estimate low');
assert.strictEqual(
  resolveIssueEnergy({
    title: 'Design and overhaul the sync layer',
    body: '- [ ] one\n- [ ] two\n- [ ] three\n- [ ] four\n- [ ] five\n- [ ] six\n- [ ] seven\n- [ ] eight\n- [ ] nine',
    labels: ['enhancement', 'backend', 'ui'],
  }),
  'high',
  'a complex issue with a 9-item checklist and 3 labels should estimate high even with no priority label'
);
```

(The `import ... from './github-sync.js'` line replaces the existing import line at the top of the file — it's the same import with `resolveIssueEnergy` added to the destructure. The new `assert.strictEqual` calls are appended just before the existing `console.log('GITHUB SYNC HEURISTIC TESTS PASSED');` line.)

- [ ] **Step 4: Run the tests to verify they pass**

Run: `node js/github-sync.test.mjs`
Expected: PASS — all existing assertions plus the four new ones succeed, prints `GITHUB SYNC HEURISTIC TESTS PASSED`.

- [ ] **Step 5: Regression-focused Playwright check**

Live GitHub API calls aren't available in this sandboxed environment, so this task's correctness is primarily covered by the unit tests above (the same boundary the codebase already draws: `energyFromLabels`/`statusFromLabels`/`parseRepoInput` are unit-tested precisely because they're pure, while `syncGithub` itself has never been Playwright-tested against live GitHub). For the UI regression pass: load the app, and if any GitHub-sourced project/task rows are already present in `localStorage` from earlier manual testing, confirm they still render correctly (title, energy chip, GitHub badge, issue link) — proving the `github-sync.js` changes didn't break rendering of previously-synced data. Confirm the Settings page (token save, "Create sync Gist", "Connect" by Gist ID) still loads and its buttons are present and clickable (without needing a real token to complete the flow).

- [ ] **Step 6: Commit**

```bash
git -C /home/claude/focus-deck-app/.worktrees/focus-deck-pwa-port add js/github.js js/github-sync.js js/github-sync.test.mjs
git -C /home/claude/focus-deck-app/.worktrees/focus-deck-pwa-port commit -m "feat: estimate focus tier for GitHub issues with no priority label"
```

---

## Task 7: Final whole-feature regression sweep and deploy

**Files:** None (verification and deployment only — no source changes expected; if verification surfaces a real bug, fix it in the relevant file from Tasks 1–6 above and note the fix before proceeding).

**Interfaces:** N/A — this task consumes everything built in Tasks 1–6 as a whole.

- [ ] **Step 1: Run every unit test**

```bash
node js/sync.test.mjs
node js/github-sync.test.mjs
node js/complexity.test.mjs
node js/project-filter.test.mjs
```

Expected: all four print their `PASSED` line with no assertion errors.

- [ ] **Step 2: Full Playwright regression — original PWA features**

Serve the app locally and, in one continuous session (reloading where noted), verify every pre-existing flow still works exactly as before this build: inbox capture, file, and discard; add/edit/toggle/delete a task; cycle a task's energy manually; the focus picker's low/medium/high buttons, "Surprise me", reroll, clear, and complete-focus; add a project and a tracked repo by `owner/repo`; a project's Remove confirm/cancel flow; the Settings page's token-save and Gist create/connect controls; and that state survives a full page reload.

- [ ] **Step 3: Full Playwright regression — new features together**

In the same session: add a project with a new category via "+ Add new…" and confirm its chip; filter the grid to that category, then to "Uncategorized", then back to "All"; search by a project-name substring; sort by each of the four modes and confirm each produces a sensible order; add a manual task with a multi-line steps field left on Auto energy and confirm the assigned tier matches the rubric; edit that task, confirm "Auto" shows selected in the energy dropdown; manually cycle its energy chip and confirm the dropdown no longer shows "Auto" on next edit. Reload the page and confirm every one of these — project categories, task steps, energy/auto state — persisted correctly.

- [ ] **Step 4: Push to GitHub**

Using the `mcp__GitHub__push_files` (or `mcp__GitHub__create_or_update_file` for single files) MCP tools against `Ajw2003/focus-deck-app`, push every file changed across Tasks 1–6 (`js/state.js`, `js/mutations.js`, `js/render.js`, `js/app.js`, `js/github.js`, `js/github-sync.js`, `js/github-sync.test.mjs`, `js/complexity.js`, `js/complexity.test.mjs`, `js/project-filter.js`, `js/project-filter.test.mjs`, `css/app.css`, plus the `generate_icons.py` reconciliation commit and this plan file under `docs/superpowers/plans/`) to the `main` branch. Do not attempt `git push` — it is blocked for this session (see Global Constraints). Do not include anything under `.github/workflows/` in this push (nothing in this plan should have touched it — double-check before pushing).

- [ ] **Step 5: Verify the live deploy**

Confirm the push triggered a new GitHub Actions run (it should, automatically, on every push to `main`, same as every prior deploy in this project). Watch it to completion. If it fails, diagnose from the run log the same way the `icons/` directory bug was diagnosed and fixed earlier in this project, fix, and push again. Once green, load `https://ajw2003.github.io/focus-deck-app/` directly and spot-check that project categories and the filter bar are visible and functional on the live site (a fresh, empty-`localStorage` load won't show pre-existing test data, so verify by adding a project/category live on the deployed site).

- [ ] **Step 6: Report to the user**

Tell the user the build is complete, summarize what shipped (project categories with filter/search/sort; auto-assigned focus tier for manual tasks via the new steps field and Auto option; auto-assigned focus tier for GitHub issues with no priority label), and that it's live and ready for them to test at the deployed URL.
