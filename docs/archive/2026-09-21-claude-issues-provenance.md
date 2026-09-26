# Claude ↔ Focus Deck: On-Demand Issues Integration (Part 1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let Focus Deck show, per task, whether Claude created the linked GitHub issue and whether Claude completed it, via two reserved provenance labels rendered as chips, and write down the four-operation Claude/Issues contract as a tier-4 doc.

**Architecture:** Two new reserved labels (`Claude created this`, `Claude completed this`) are read by `applyCategoryFromLabels` into two task booleans (`claudeCreated` sticky, `claudeCompleted` live). "Live" means: true only while the label is present AND the task is `done`; when a reopen is detected (local uncheck, or a sync pass that sees a stale label on a non-done task) Focus Deck removes the stale label from the issue best-effort. `render.js` shows the booleans as `.chip` variants. Claude's own side of the contract (create/comment/close/reopen only, never delete, ≥1 label per issue) is a docs-only artifact.

**Tech Stack:** Vanilla ES modules, no build step, plain `node` assert test files (`node js/<name>.test.mjs`), static PWA served from the repo root.

**Spec:** `docs/archive/2026-09-21-claude-focus-deck-integration-design.md` (Part 1 only; Part 2 is `docs/archive/2026-09-21-claude-daily-checkin.md`).

## Global Constraints

- **Never delete anything** — no deleting issues, labels, files, or git history; no force-push. Removing a stale `Claude completed this` label *from one issue* (a reopen cleanup performed by Focus Deck's own code, exactly like the existing `pushCategoryToIssue` label removal) is the only "remove" in this plan; the label definition on the repo is never deleted.
- Claude's only operations against GitHub Issues: **create, comment, close, reopen**. Nothing else.
- Every issue Claude creates must carry ≥1 label (`upsertRepoProject` ignores unlabeled issues — `js/github-sync.js` `labeled` filter).
- Reserved labels, exact spelling: `Claude created this` and `Claude completed this`. `Claude created this` is sticky; `Claude completed this` is live (cleared when the issue reopens, by anyone, from anywhere).
- Both labels must be reserved so they are never chosen as a task's category (`RESERVED_LABELS`).
- Chips reuse the existing `.chip` styling; no separate badge system.
- No long explanatory comment blocks in source: keep comments to a line plus a `docs/4-systems/...` pointer; long-form goes in the docs (delegate the move to `house-rules:archivist` if a long block is ever written).
- Every changed file under `js/`, `css/` requires bumping `CACHE_NAME` in `service-worker.js` once (Task 3) because the shell is cache-first.
- Run all four existing test files before calling any task done: `for f in js/*.test.mjs; do node "$f"; done` (each prints its own `... PASSED` line).

## File Structure

- Modify `js/github-sync.js` — constants, `RESERVED_LABELS`, `applyCategoryFromLabels` (now exported), `dropStaleCompletedLabel`, `refreshClosedTaskLabels`, `syncIssueCompletion`, `upsertRepoProject` (now exported, returns newly-closed tasks), call-site wiring in `linkTaskToIssue` / `addRepoManually` / `syncGithub`.
- Modify `js/github-sync.test.mjs` — extend (the spec says to extend this file).
- Modify `js/render.js` — two chips in `renderTaskRow`.
- Create `js/render.test.mjs` — chip rendering tests.
- Modify `css/app.css` — `.chip.claude-chip` styles.
- Modify `service-worker.js` — `CACHE_NAME` v6 → v7.
- Create `docs/4-systems/claude-integration.md` — the tier-4 contract.
- Modify `docs/4-systems/README.md`, `docs/4-systems/github-sync.md` — index + provenance section.

---

### Task 1: Read the provenance labels in `applyCategoryFromLabels`

**Files:**
- Modify: `js/github-sync.js:10-29`
- Test: `js/github-sync.test.mjs`

**Interfaces:**
- Produces: exported `CLAUDE_CREATED_LABEL = 'Claude created this'`, `CLAUDE_COMPLETED_LABEL = 'Claude completed this'`; exported `applyCategoryFromLabels(task, labels)` which additionally sets `task.claudeCreated = true` (never clears) and sets/deletes `task.claudeCompleted` (`true` iff the completed label is present **and** `task.status === 'done'`). Callers must set `task.status` before calling it.

- [x] **Step 1: Write the failing tests**

In `js/github-sync.test.mjs`, replace the two import lines at the top with:

```js
import {
  energyFromLabels, statusFromLabels, parseRepoInput, resolveIssueEnergy,
  applyCategoryFromLabels, CLAUDE_CREATED_LABEL, CLAUDE_COMPLETED_LABEL,
} from './github-sync.js';
import { state } from './state.js';
import assert from 'node:assert';
```

Insert immediately before the final `console.log('GITHUB SYNC HEURISTIC TESTS PASSED');` line:

```js
// --- provenance labels ---
{
  const catsBefore = state.categories.length;

  // created label sets the sticky flag and is never a category candidate
  let t = { status: 'next' };
  applyCategoryFromLabels(t, [CLAUDE_CREATED_LABEL]);
  assert.strictEqual(t.claudeCreated, true, '"Claude created this" should set claudeCreated');
  assert.strictEqual(t.categoryId, undefined, 'a provenance label must not become a category');
  assert.strictEqual(state.categories.length, catsBefore, 'a provenance label must not auto-create a category');

  // existing category still wins alongside a provenance label
  t = { status: 'next' };
  applyCategoryFromLabels(t, [CLAUDE_CREATED_LABEL, 'Bug']);
  assert.strictEqual(t.categoryId, 'cat_bug', 'a real category label alongside the provenance label should still resolve the category');
  assert.strictEqual(t.claudeCreated, true);

  // an unknown real label becomes the category even when a provenance label is listed first
  t = { status: 'done' };
  applyCategoryFromLabels(t, [CLAUDE_COMPLETED_LABEL, 'Epic']);
  const epic = state.categories.find((c) => c.name === 'Epic');
  assert.ok(epic, 'the real label "Epic" should be auto-created as a category');
  assert.strictEqual(t.categoryId, epic.id, 'the category must be the real label, not the provenance label');
  assert.strictEqual(t.claudeCompleted, true, 'completed label on a done task should set claudeCompleted');
  state.categories.splice(state.categories.indexOf(epic), 1);

  // claudeCompleted is live: a stale label on a non-done (reopened) task reads as false
  t = { status: 'next', claudeCompleted: true };
  applyCategoryFromLabels(t, [CLAUDE_COMPLETED_LABEL]);
  assert.ok(!t.claudeCompleted, 'a reopened (non-done) task must not read as claudeCompleted, even if the label is stale');

  // ...and it clears when the label is gone
  t = { status: 'done', claudeCompleted: true };
  applyCategoryFromLabels(t, ['Bug']);
  assert.ok(!t.claudeCompleted, 'claudeCompleted should clear when the label is no longer on the issue');

  // claudeCreated is sticky: never cleared, even with no labels or without the label
  t = { status: 'next', claudeCreated: true };
  applyCategoryFromLabels(t, []);
  assert.strictEqual(t.claudeCreated, true, 'claudeCreated must survive an empty label list');
  applyCategoryFromLabels(t, ['Bug']);
  assert.strictEqual(t.claudeCreated, true, 'claudeCreated must survive labels that omit the provenance label');

  // spelling/case tolerance, same as other reserved labels
  t = { status: 'next' };
  applyCategoryFromLabels(t, ['claude-created-this']);
  assert.strictEqual(t.claudeCreated, true, 'label matching should normalize case/hyphens like other reserved labels');

  // no labels, no flags
  t = { status: 'done' };
  applyCategoryFromLabels(t, []);
  assert.strictEqual(t.claudeCompleted, undefined);
  assert.strictEqual(t.claudeCreated, undefined);
}

```

- [x] **Step 2: Run the test to verify it fails**

Run: `cd /home/claude/focus-deck-app && node js/github-sync.test.mjs`
Expected: FAIL with a `SyntaxError` / "does not provide an export named 'applyCategoryFromLabels'".

- [x] **Step 3: Write the minimal implementation**

In `js/github-sync.js`, replace lines 10-29 (from `function normLabel` through the end of `applyCategoryFromLabels`) with:

```js
function normLabel(s) { return String(s).toLowerCase().replace(/[\s_-]+/g, ''); }

// Provenance labels — see docs/4-systems/claude-integration.md
export const CLAUDE_CREATED_LABEL = 'Claude created this';
export const CLAUDE_COMPLETED_LABEL = 'Claude completed this';

// Reserved so priority/status/provenance labels can't be mistaken for a category.
// See docs/4-systems/github-sync.md#category-resolution-from-labels--applycategoryfromlabels-jsgithub-syncjs20
const RESERVED_LABELS = ['highpriority', 'critical', 'urgent', 'blocker', 'p0', 'p1', 'lowpriority', 'goodfirstissue', 'easy', 'p3', 'p4', 'inprogress', 'wip', 'doing', normLabel(CLAUDE_CREATED_LABEL), normLabel(CLAUDE_COMPLETED_LABEL)];

// Callers must set task.status BEFORE calling (claudeCompleted depends on it).
// See docs/4-systems/github-sync.md#category-resolution-from-labels--applycategoryfromlabels-jsgithub-syncjs20
export function applyCategoryFromLabels(task, labels) {
  labels = labels || [];
  const norm = labels.map(normLabel);
  if (norm.includes(normLabel(CLAUDE_CREATED_LABEL))) task.claudeCreated = true; // sticky: never cleared here
  if (norm.includes(normLabel(CLAUDE_COMPLETED_LABEL)) && task.status === 'done') task.claudeCompleted = true;
  else delete task.claudeCompleted; // live: absent label or reopened task
  if (!labels.length) return;
  let match = state.categories.find((c) => labels.some((l) => normLabel(l) === normLabel(c.name)));
  if (!match) {
    const candidate = labels.find((l) => !RESERVED_LABELS.includes(normLabel(l)));
    if (candidate) {
      match = { id: uid('cat'), name: candidate, color: 'hsl(' + nextHue() + ' var(--proj-sat) var(--proj-light))' };
      state.categories.push(match);
    }
  }
  if (match) task.categoryId = match.id;
}
```

- [x] **Step 4: Run all tests to verify they pass**

Run: `cd /home/claude/focus-deck-app && for f in js/*.test.mjs; do node "$f"; done`
Expected: four `... PASSED` lines, including `GITHUB SYNC HEURISTIC TESTS PASSED`.

- [x] **Step 5: Commit**

```bash
git add js/github-sync.js js/github-sync.test.mjs
git commit -m "feat: read Claude provenance labels into claudeCreated/claudeCompleted"
```

---

### Task 2: Keep `claudeCompleted` live — reopen cleanup and closed-issue label refresh

**Files:**
- Modify: `js/github-sync.js` (`syncIssueCompletion`, `linkTaskToIssue`, `addRepoManually`, `upsertRepoProject`, `syncGithub`)
- Test: `js/github-sync.test.mjs`

**Interfaces:**
- Consumes: Task 1's `applyCategoryFromLabels`, `CLAUDE_COMPLETED_LABEL`; `removeLabelFromIssue(owner, repo, number, name)` and `getIssue(owner, repo, number)` from `js/github.js`.
- Produces:
  - `export async function dropStaleCompletedLabel(task, labels)` — if `task.status !== 'done'` and `labels` contains the completed label, removes it from the linked issue (404 tolerated by `removeLabelFromIssue`); errors go to `reportSyncError`. Returns the promise.
  - `export async function refreshClosedTaskLabels(tasks)` — for each task, `getIssue`; if `iss.state === 'closed'`, `applyCategoryFromLabels(task, iss.labels)`. Per-task failures are swallowed (chip just doesn't show).
  - `export function upsertRepoProject(repo, issues, ui)` — now exported and **returns an array of tasks it newly marked done** (empty array on early return).
  - `syncIssueCompletion(task)` — when reopening (`status !== 'done'`) a task with `claudeCompleted`, also removes the label and deletes the flag.

- [x] **Step 1: Write the failing tests**

Change the import block at the top of `js/github-sync.test.mjs` to add the new names:

```js
import {
  energyFromLabels, statusFromLabels, parseRepoInput, resolveIssueEnergy,
  applyCategoryFromLabels, CLAUDE_CREATED_LABEL, CLAUDE_COMPLETED_LABEL,
  dropStaleCompletedLabel, refreshClosedTaskLabels, syncIssueCompletion, upsertRepoProject,
} from './github-sync.js';
```

The following tests are async and use stubs. Insert immediately before the final `console.log(...)` line (after the block added in Task 1):

```js
// --- live claudeCompleted: stubbed GitHub API ---
{
  globalThis.localStorage = { getItem: () => 'test-token', setItem() {}, removeItem() {} };
  const calls = [];
  let nextJson = {};
  globalThis.fetch = async (url, opts = {}) => {
    calls.push({ url: String(url).replace('https://api.github.com', ''), method: opts.method || 'GET', body: opts.body });
    return { ok: true, status: 200, json: async () => nextJson };
  };
  const LABEL_PATH = '/repos/o/r/issues/5/labels/Claude%20completed%20this';
  const tick = () => new Promise((r) => setTimeout(r, 0));

  // dropStaleCompletedLabel: removes the stale label from a reopened task
  calls.length = 0;
  await dropStaleCompletedLabel({ status: 'next', repoFullName: 'o/r', issueNumber: 5 }, ['Bug', CLAUDE_COMPLETED_LABEL]);
  assert.deepStrictEqual(calls.map((c) => c.method + ' ' + c.url), ['DELETE ' + LABEL_PATH], 'a reopened task with a stale completed label should have that label removed from the issue');

  // ...but not when the task is done, or the label isn't there
  calls.length = 0;
  await dropStaleCompletedLabel({ status: 'done', repoFullName: 'o/r', issueNumber: 5 }, [CLAUDE_COMPLETED_LABEL]);
  await dropStaleCompletedLabel({ status: 'next', repoFullName: 'o/r', issueNumber: 5 }, ['Bug']);
  assert.strictEqual(calls.length, 0, 'no label removal when the task is done or the label is absent');

  // syncIssueCompletion: unchecking a Claude-completed task reopens the issue AND removes the label
  calls.length = 0;
  let t = { source: 'github', repoFullName: 'o/r', issueNumber: 5, status: 'next', claudeCompleted: true };
  await syncIssueCompletion(t);
  assert.deepStrictEqual(calls.map((c) => c.method + ' ' + c.url), ['PATCH /repos/o/r/issues/5', 'DELETE ' + LABEL_PATH], 'reopen should PATCH the issue open then remove the completed label');
  assert.strictEqual(JSON.parse(calls[0].body).state, 'open');
  assert.ok(!t.claudeCompleted, 'claudeCompleted should be cleared locally on reopen');

  // syncIssueCompletion: closing (done) never touches labels
  calls.length = 0;
  t = { source: 'github', repoFullName: 'o/r', issueNumber: 5, status: 'done' };
  await syncIssueCompletion(t);
  assert.deepStrictEqual(calls.map((c) => c.method + ' ' + c.url), ['PATCH /repos/o/r/issues/5']);

  // syncIssueCompletion: reopening a task that was never Claude-completed makes no label call
  calls.length = 0;
  t = { source: 'github', repoFullName: 'o/r', issueNumber: 5, status: 'next' };
  await syncIssueCompletion(t);
  assert.deepStrictEqual(calls.map((c) => c.method), ['PATCH']);

  // refreshClosedTaskLabels: closed issue with the label -> claudeCompleted
  calls.length = 0;
  nextJson = { number: 7, title: 'x', labels: [{ name: CLAUDE_COMPLETED_LABEL }, { name: 'Bug' }], body: '', state: 'closed', html_url: 'u' };
  t = { status: 'done', repoFullName: 'o/r', issueNumber: 7 };
  await refreshClosedTaskLabels([t]);
  assert.strictEqual(t.claudeCompleted, true, 'a newly-closed task whose issue carries the completed label should read as claudeCompleted');
  assert.strictEqual(t.categoryId, 'cat_bug');

  // refreshClosedTaskLabels: an issue that is actually open is ignored
  nextJson = { number: 7, title: 'x', labels: [{ name: CLAUDE_COMPLETED_LABEL }], body: '', state: 'open', html_url: 'u' };
  t = { status: 'done', repoFullName: 'o/r', issueNumber: 7 };
  await refreshClosedTaskLabels([t]);
  assert.ok(!t.claudeCompleted, 'an issue that is not closed must not set claudeCompleted');

  // refreshClosedTaskLabels: a failing fetch is swallowed
  const realFetch = globalThis.fetch;
  globalThis.fetch = async () => ({ ok: false, status: 500, json: async () => ({}) });
  await refreshClosedTaskLabels([{ status: 'done', repoFullName: 'o/r', issueNumber: 7 }]); // must not throw
  globalThis.fetch = realFetch;

  // upsertRepoProject: returns tasks newly closed (issue vanished from the open list)
  state.projects.length = 0;
  state.completedLog.length = 0;
  const repo = { full_name: 'o/r', name: 'r', html_url: 'https://github.com/o/r', private: false };
  state.projects.push({ id: 'p1', name: 'r', source: 'github', repoFullName: 'o/r', tasks: [
    { id: 't_closed', title: 'gone', status: 'next', source: 'github', repoFullName: 'o/r', issueNumber: 1 },
    { id: 't_reopen', title: 'back', status: 'done', source: 'github', repoFullName: 'o/r', issueNumber: 2, claudeCompleted: true },
    { id: 't_open', title: 'still', status: 'next', source: 'github', repoFullName: 'o/r', issueNumber: 3 },
  ] });
  calls.length = 0;
  const newlyClosed = upsertRepoProject(repo, [
    { number: 2, title: 'back', labels: ['Bug', CLAUDE_COMPLETED_LABEL], body: '', state: 'open' },
    { number: 3, title: 'still', labels: ['Bug'], body: '', state: 'open' },
  ], {});
  assert.deepStrictEqual(newlyClosed.map((x) => x.id), ['t_closed'], 'only the task whose issue left the open list is newly closed');
  const reopened = state.projects[0].tasks.find((x) => x.id === 't_reopen');
  assert.strictEqual(reopened.status, 'next', 'a done task whose issue is open again should reopen');
  assert.ok(!reopened.claudeCompleted, 'a reopened task must lose claudeCompleted');
  await tick();
  assert.deepStrictEqual(calls.map((c) => c.method + ' ' + c.url), ['DELETE /repos/o/r/issues/2/labels/Claude%20completed%20this'], 'the stale label should be removed from the reopened issue');
  assert.deepStrictEqual(upsertRepoProject({ full_name: 'x/y', name: 'y', html_url: 'u', private: false }, [], {}), [], 'early return yields an empty array');
  state.projects.length = 0;
  state.completedLog.length = 0;
}

```

Note: the `{ … }` blocks use top-level `await`, which is fine in a `.mjs` file.

- [x] **Step 2: Run the test to verify it fails**

Run: `cd /home/claude/focus-deck-app && node js/github-sync.test.mjs`
Expected: FAIL with "does not provide an export named 'dropStaleCompletedLabel'".

- [x] **Step 3: Write the minimal implementation**

In `js/github-sync.js`:

(a) After `reportSyncError`, add:

```js
// Reopen cleanup: the completed label is "live", so once a task is no longer done, take it off the issue.
// See docs/4-systems/claude-integration.md
export async function dropStaleCompletedLabel(task, labels) {
  if (task.status === 'done') return;
  if (!(labels || []).some((l) => normLabel(l) === normLabel(CLAUDE_COMPLETED_LABEL))) return;
  const [owner, name] = task.repoFullName.split('/');
  try {
    await removeLabelFromIssue(owner, name, task.issueNumber, CLAUDE_COMPLETED_LABEL);
  } catch (e) {
    reportSyncError('Couldn’t clear the “' + CLAUDE_COMPLETED_LABEL + '” label: ' + e.message);
  }
}

// Newly-closed issues vanish from the open list, so their labels are never seen — fetch them once.
export async function refreshClosedTaskLabels(tasks) {
  for (const t of tasks) {
    try {
      const [owner, name] = t.repoFullName.split('/');
      const iss = await getIssue(owner, name, t.issueNumber);
      if (iss.state === 'closed') applyCategoryFromLabels(t, iss.labels);
    } catch (e) { /* best-effort: the chip just won't show */ }
  }
}
```

(b) Replace `syncIssueCompletion` with:

```js
export async function syncIssueCompletion(task) {
  if (task.source !== 'github' || !task.repoFullName || task.issueNumber == null) return;
  const [owner, name] = task.repoFullName.split('/');
  try {
    await setIssueState(owner, name, task.issueNumber, task.status === 'done' ? 'closed' : 'open');
    if (task.status !== 'done' && task.claudeCompleted) {
      delete task.claudeCompleted;
      await removeLabelFromIssue(owner, name, task.issueNumber, CLAUDE_COMPLETED_LABEL);
      persist();
    }
  } catch (e) {
    reportSyncError('Couldn’t update the linked issue: ' + e.message);
  }
}
```

(c) In `linkTaskToIssue`, directly after `applyCategoryFromLabels(task, iss.labels);` add:

```js
    dropStaleCompletedLabel(task, iss.labels); // fire-and-forget
```

(d) Change `function upsertRepoProject(repo, issues, ui) {` to `export function upsertRepoProject(repo, issues, ui) {`. Make it return newly-closed tasks: change the early return `if (!project && labeled.length === 0 && !state.pinnedRepos.includes(repo.full_name)) return;` to `... return [];`; add `const newlyClosed = [];` right after `const openNumbers = ...`; inside the `project.tasks.forEach` that marks tasks done, add `newlyClosed.push(t);` after `t.updatedAt = Date.now();`; in the `existing` branch, after `applyCategoryFromLabels(existing, iss.labels);` add `dropStaleCompletedLabel(existing, iss.labels);`; after the whole `labeled.forEach(...)` block (end of function) add `return newlyClosed;`.

(e) In `addRepoManually`, replace `upsertRepoProject(repo, issues, ui);` with:

```js
    const closedNow = upsertRepoProject(repo, issues, ui);
    await refreshClosedTaskLabels(closedNow);
```

(f) In `syncGithub`, add `const closedNow = [];` before the `for (const repo of candidates)` loop; inside it replace `upsertRepoProject(repo, issues, ui);` with `closedNow.push(...upsertRepoProject(repo, issues, ui));`; in the standalone-linked pass, after `applyCategoryFromLabels(t, iss.labels);` add `dropStaleCompletedLabel(t, iss.labels);`; and immediately before `state.githubSync = { user: username, lastSyncedAt: Date.now() };` add `await refreshClosedTaskLabels(closedNow);`.

- [x] **Step 4: Run all tests to verify they pass**

Run: `cd /home/claude/focus-deck-app && for f in js/*.test.mjs; do node "$f"; done`
Expected: all four `... PASSED` lines.

- [x] **Step 5: Commit**

```bash
git add js/github-sync.js js/github-sync.test.mjs
git commit -m "feat: keep claudeCompleted live - clear stale label on reopen, read labels of newly closed issues"
```

---

### Task 3: Render the chips

**Files:**
- Modify: `js/render.js:123-130` (`renderTaskRow`)
- Modify: `css/app.css` (after the `.chip.cat-chip` rule)
- Modify: `service-worker.js:2` (`CACHE_NAME`)
- Create: `js/render.test.mjs`

**Interfaces:**
- Consumes: `task.claudeCreated`, `task.claudeCompleted` from Tasks 1–2.
- Produces: `renderTaskRow` output containing `<span class="chip claude-chip claude-created-chip small" ...>Claude created</span>` when `t.claudeCreated`, and `<span class="chip claude-chip claude-completed-chip small" ...>Claude completed</span>` only when `t.claudeCompleted && t.status === 'done'` (so unchecking hides it instantly, before any network round trip).

- [x] **Step 1: Write the failing test** — create `js/render.test.mjs`:

```js
// focus-deck-app/js/render.test.mjs — run with: node js/render.test.mjs
import { renderTaskRow } from './render.js';
import assert from 'node:assert';

const p = { id: 'p1', name: 'P' };
const cats = [{ id: 'cat_bug', name: 'Bug', color: 'hsl(4 70% 55%)' }];
const ui = { editingTask: null };
const base = { id: 't1', title: 'T', energy: 'low', status: 'next', source: 'github', repoFullName: 'o/r', issueNumber: 1, url: 'https://github.com/o/r/issues/1', categoryId: 'cat_bug' };
const row = (over) => renderTaskRow({ ...base, ...over }, p, cats, ui);

assert.ok(!row({}).includes('claude-chip'), 'a plain task shows no Claude chips');

const created = row({ claudeCreated: true });
assert.ok(created.includes('claude-created-chip') && created.includes('>Claude created<'), 'claudeCreated renders the created chip');
assert.ok(!created.includes('claude-completed-chip'), 'created alone does not render the completed chip');

const completed = row({ claudeCompleted: true, status: 'done' });
assert.ok(completed.includes('claude-completed-chip') && completed.includes('>Claude completed<'), 'claudeCompleted on a done task renders the completed chip');

assert.ok(!row({ claudeCompleted: true, status: 'next' }).includes('claude-completed-chip'), 'a reopened task must not show the completed chip even if the flag is stale');

const both = row({ claudeCreated: true, claudeCompleted: true, status: 'done' });
assert.ok(both.includes('claude-created-chip') && both.includes('claude-completed-chip'), 'both chips can show together');
assert.ok(both.indexOf('cat-chip') < both.indexOf('claude-created-chip'), 'Claude chips come after the category chip so they never displace it');
assert.ok(both.indexOf('claude-created-chip') < both.indexOf('claude-completed-chip'), 'created chip precedes completed chip');

console.log('RENDER CHIP TESTS PASSED');
```

- [x] **Step 2: Run to verify it fails**

Run: `cd /home/claude/focus-deck-app && node js/render.test.mjs`
Expected: FAIL — `AssertionError: claudeCreated renders the created chip`.

- [x] **Step 3: Implement**

In `js/render.js`, in `renderTaskRow`, after the `const catChip = ...;` line add:

```js
  const claudeChips = (t.claudeCreated ? '<span class="chip claude-chip claude-created-chip small" title="Claude opened this issue">Claude created</span>' : '')
    + (t.claudeCompleted && isDone ? '<span class="chip claude-chip claude-completed-chip small" title="Claude closed this issue">Claude completed</span>' : '');
```

and change `+ ghBadge + catChip` to `+ ghBadge + catChip + claudeChips`.

In `css/app.css`, directly after the `.chip.cat-chip{...}` rule add:

```css
.chip.claude-chip{border-color:transparent; background:color-mix(in srgb, var(--accent) 14%, transparent); color:var(--accent);}
.chip.claude-chip.small{font-size:.7rem; padding:3px 8px;}
```

In `service-worker.js` change `'focus-deck-shell-v6'` to `'focus-deck-shell-v7'`.

- [x] **Step 4: Run all tests**

Run: `cd /home/claude/focus-deck-app && for f in js/*.test.mjs; do node "$f"; done`
Expected: five `... PASSED` lines (now including `RENDER CHIP TESTS PASSED`).

- [x] **Step 5: Commit**

```bash
git add js/render.js js/render.test.mjs css/app.css service-worker.js
git commit -m "feat: show Claude created/completed chips on task rows"
```

---

### Task 4: Write the contract and update the systems docs

**Files:**
- Create: `docs/4-systems/claude-integration.md`
- Modify: `docs/4-systems/README.md`
- Modify: `docs/4-systems/github-sync.md`

**Interfaces:** none (docs only). Follow the tier-4 shape used by `docs/4-systems/github-sync.md`: What it owns / How it works / Invariants / Traps.

- [x] **Step 1: Create `docs/4-systems/claude-integration.md`** with these sections (write full prose; content below is the required substance):
  - **What it owns:** the contract governing any Claude session (chat, scheduled, Claude Code) that acts on Focus Deck tasks through GitHub Issues, and the two provenance labels.
  - **The contract (non-negotiable):** Claude's only operations against GitHub Issues are **create, comment, close, reopen**. Never delete an issue, a label, a comment, or anything else. Closing is reversible and is not deleting. Every issue Claude creates carries ≥1 label (unlabeled issues are invisible to `upsertRepoProject`). Claude applies `Claude created this` once when it opens an issue; applies `Claude completed this` when it closes one (whether or not it created it); Claude never removes either label itself (Focus Deck removes `Claude completed this` on reopen).
  - **How it works:** label → task-flag mapping (`claudeCreated` sticky, `claudeCompleted` live = label present AND task done); reopen cleanup paths (`syncIssueCompletion`, `dropStaleCompletedLabel` in the repo pass, standalone-link pass and `linkTaskToIssue`); `refreshClosedTaskLabels` because closed issues leave the open list; chips in `renderTaskRow` (completed chip additionally gated on `status === 'done'`); how the user reverts Claude's work (existing delete/unlink buttons; the completion checkbox).
  - **Invariants:** the two labels are in `RESERVED_LABELS`; `claudeCreated` is never cleared by sync; `claudeCompleted` is never true for a non-done task; the app removes the completed label only from the individual issue, never deletes the label from the repo.
  - **Traps:** callers of `applyCategoryFromLabels` must set `task.status` first; label setting by Claude needs `ensureLabelExists`-equivalent (create the repo label if missing — creating labels is allowed, deleting is not); a reopen made directly on GitHub is only noticed on the next Sync; Part 2 (daily read-only check-in) is a separate read-only mechanism and adds no write ability.

- [x] **Step 2: Update the index** — append to `docs/4-systems/README.md`:

```markdown
- [claude-integration.md](./claude-integration.md) — the contract for Claude acting on Focus Deck via
  GitHub Issues (create/comment/close/reopen only, never delete) and the provenance labels
  (`js/github-sync.js`, `js/render.js`).
```

- [x] **Step 3: Update `docs/4-systems/github-sync.md`** — in "Category resolution from labels", add a paragraph: provenance labels `Claude created this` / `Claude completed this` are also reserved and are read into `task.claudeCreated` / `task.claudeCompleted` in the same pass (see `claude-integration.md`). Add to Invariants: "`applyCategoryFromLabels` must be called *after* `task.status` is set." Add a "Reopen cleanup and closed-issue label refresh" subsection describing `dropStaleCompletedLabel` and `refreshClosedTaskLabels`.

- [x] **Step 4: Check doc pointers** — invoke the `house-rules:docref` skill in check mode; the `github-sync.js` edits shifted line numbers that existing `docs/4-systems/github-sync.md#...js/github-sync.js<line>` anchors encode. Repair with the skill's repair mode if it reports drift.

- [x] **Step 5: Run all tests, then commit**

Run: `cd /home/claude/focus-deck-app && for f in js/*.test.mjs; do node "$f"; done`

```bash
git add docs/4-systems js/github-sync.js
git commit -m "docs: tier-4 Claude<->Focus Deck contract; document provenance labels and reopen cleanup"
```

---

### Task 5: Visual verification (Playwright)

**Files:** none in the repo (scratch script goes in the session scratchpad; **do not commit it**).

- [x] **Step 1:** Serve the repo: `python3 -m http.server 8123 --directory /home/claude/focus-deck-app &` and confirm with `curl -sI localhost:8123/index.html | head -1` → `200`.
- [x] **Step 2:** With Playwright (Chromium at `/opt/pw-browsers/chromium`; `executablePath` if needed), seed `localStorage['focusdeck-state-v1']` with one project containing three github-sourced tasks: (a) `claudeCreated`, (b) `claudeCreated` + `claudeCompleted` + `status:'done'` (expand the "done" group), (c) a plain task with a category chip and energy chip. Screenshot at 1280px and at 390px width.
- [x] **Step 3:** View the screenshots. Confirm: chips render with the accent tint, sit after the category chip, wrap cleanly at 390px without overlapping the title/Unlink/energy controls. Also toggle task (b)'s checkbox in the page and confirm the "Claude completed" chip disappears immediately.
- [x] **Step 4:** Stop the server (`pkill -f "http.server 8123"`; a nonzero/144 exit code from `pkill` in this sandbox is expected — confirm with `curl` instead). Report any layout issue; fix CSS only (then re-run tests and re-commit).

---

## Self-Review (spec coverage)

- Contract of four operations, no delete, doc as tier-4 → Task 4 (`claude-integration.md`) + Global Constraints.
- ≥1 label per created issue → Task 4 (contract) — enforced by Claude's behavior, not app code, per spec.
- Reserved labels never compete for category → Task 1 (`RESERVED_LABELS`, tested).
- `claudeCreated` sticky / `claudeCompleted` live, cleared on reopen by anyone → Tasks 1–2 (tests for both paths: local uncheck, GitHub-side reopen seen by sync).
- Chips use existing `.chip` → Task 3.
- Ensure labels created on the repo via `ensureLabelExists` → Task 4 (documented as the contract's label-creation step; no app code needed — spec says "no new code").
- Reverting reuses existing UI → Task 4 docs; no code.
- Playwright pass for chip collisions → Task 5.
- Gap noted and covered beyond spec text: closed issues leave the open list, so their labels are never read → `refreshClosedTaskLabels` (Task 2).
- Type consistency: `applyCategoryFromLabels`, `dropStaleCompletedLabel`, `refreshClosedTaskLabels`, `upsertRepoProject`, `CLAUDE_CREATED_LABEL`, `CLAUDE_COMPLETED_LABEL`, `claudeCreated`, `claudeCompleted` used identically across tasks.

## Progress checklist (for a future session)

- [x] Task 1 — provenance labels in `applyCategoryFromLabels`
- [x] Task 2 — live `claudeCompleted` (reopen cleanup, closed-issue refresh)
- [x] Task 3 — chips + CSS + cache bump
- [x] Task 4 — contract doc + systems docs
- [x] Task 5 — visual verification

## Execution notes (2026-09-21, unattended run)

- All five tasks executed via subagents and verified independently (all five `js/*.test.mjs` files pass; Task 5 screenshots reviewed at 1280px and 390px, no overlap, completed chip disappears immediately on uncheck, no console errors).
- Task 4 deviation: `house-rules:docref check` tracks no pointers in this repo, so the stale `docs/4-systems/github-sync.md#...js/github-sync.js<line>` anchors were renumbered by hand (doc headings and source comments). Also linked the new doc from the root `README.md`.
- Part 2 is blocked on the sync Gist ID — see `2026-09-21-claude-daily-checkin.md`.
