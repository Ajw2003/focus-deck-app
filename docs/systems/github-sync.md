# GitHub Sync

## What it owns

`js/github-sync.js` keeps local tasks/projects in sync with GitHub issues: pulling
issues into tasks, pushing local category changes back as labels, mirroring
completion state (open/closed) in both directions, and linking/unlinking individual
tasks to specific issues.

## How it works

### Category resolution from labels — `applyCategoryFromLabels` (js/github-sync.js:22)

Resolves a task's category from an issue's labels: a label matching an existing
category name wins; otherwise the first label that isn't a priority/status label
becomes a brand-new category (auto-created here). If neither applies, the task's
current category is left alone — most issues won't carry a category-shaped label at
all, and that shouldn't clear one already set.

Priority/status labels (see `energyFromLabels`/`statusFromLabels`) are never mistaken
for a category — this keeps "urgent" or "wip" from becoming a bogus auto-created
category. These are listed in `RESERVED_LABELS`.

The provenance labels `Claude created this` and `Claude completed this` are also
reserved, and are read into `task.claudeCreated` / `task.claudeCompleted` in the same
pass (see [claude-integration.md](./claude-integration.md)).

### Reopen cleanup and closed-issue label refresh — `dropStaleCompletedLabel`, `refreshClosedTaskLabels`

`claudeCompleted` only means something while a task is done, so when a task is no longer
done but its issue still carries `Claude completed this`, `dropStaleCompletedLabel`
removes that label from the issue (best-effort; errors are surfaced, never rolled back).
It runs in the repo-wide pass, the standalone-linked pass, and `linkTaskToIssue`.
`refreshClosedTaskLabels` covers the opposite blind spot: a newly closed issue leaves the
open-issue list, so its labels would never be read; each task `upsertRepoProject` newly
marked done gets its issue fetched once and its labels applied if it is closed.

### Pushing a category back to GitHub — `pushCategoryToIssue` (js/github-sync.js:70)

Pushes a task's local category onto its linked issue as a label: adds the new
category's label (creating it on the repo first if needed) and removes the old one,
if any — every other label on the issue (priority, status, anything unrelated) is
left untouched.

### Completion sync — `syncIssueCompletion` (js/github-sync.js:90)

Closes or reopens a task's linked issue to match its local status. Fire-and-forget:
local state already reflects the toggle by the time this is called, so a failure
here just means GitHub didn't follow — it's surfaced but never rolled back locally.

### Linking a task to an issue — `linkTaskToIssue` (js/github-sync.js:123)

Links an existing task (manual or already GitHub-sourced) to a specific issue: pulls
the issue's title/state/labels in immediately, and if the task already had a local
category but the issue has no category-equivalent label, pushes that category onto
the issue so both sides end up in sync rather than the pull silently winning.

### Unlinking a task — `unlinkTask` (js/github-sync.js:161)

Detaches a task from its linked issue without touching either side's content: the
task stays exactly as it is locally (now a manual task), the issue is untouched on
GitHub, and the issue is remembered as excluded so the next repo-wide sync doesn't
recreate a duplicate task for it.

### Creating an issue from a task — `createGithubIssueFromTask` (js/github-sync.js:176)

Creates a brand-new GitHub issue from a task that doesn't have one yet, and links the
two — the reverse of `linkTaskToIssue` (which attaches to an issue that already
exists). The task's steps (if any) become the issue body as a checklist, and its
category (if any) becomes a label, created on the repo first if it isn't there yet.
If the task is already marked done locally, the new issue is opened and then
immediately closed to match.

### Standalone-linked-tasks reconciliation pass — `syncGithub` (js/github-sync.js:348-374)

Tasks manually linked (via `linkTaskToIssue`) to an issue in a repo that isn't itself
being synced in the main candidates loop (e.g. the task lives in an unrelated
project) still need their status/labels reconciled — this pass fetches each such
issue individually and applies the same completion/category sync as the normal
repo-wide path.

### Label colors — `ensureLabelExists` (js/github.js:101), `pushCategoryColorToLinkedIssues` (js/github-sync.js:92)

<!-- ref:0c0e -->
Creates the repo label if it doesn't exist yet, so adding a category to an issue
never fails just because that category has never been used as a label in this repo
before. `color` (a hex string, with or without a leading #) is Focus Deck's own
color for the category — when given, it's applied on create and, if the label
already exists with a different color, patched to match, so a category's color
stays in sync going forward instead of drifting from whatever GitHub's default was.
Omitting it keeps the old gray-default create-only behavior.

<!-- ref:fce6 -->
`pushCategoryColorToLinkedIssues` is fire-and-forget, called after a category is
recolored (see `setCategoryColor` in `mutations.js`). It pushes the new color to
that category's label in every repo a github-sourced task is currently using it in
— recoloring doesn't change any task's `categoryId`, so nothing else would ever
tell those repos' labels to catch up.

## Invariants

- A GitHub label's color always follows Focus Deck's category color; GitHub-side
  manual recoloring is never pulled back into Focus Deck — sync is one-directional,
  Focus Deck to GitHub.
- `RESERVED_LABELS` (priority/status labels) are never treated as category
  candidates in `applyCategoryFromLabels`.
- `applyCategoryFromLabels` must be called *after* `task.status` is set, because
  `claudeCompleted` depends on it.
- `pushCategoryToIssue` only ever adds the new category label and removes the old
  one; it never touches other labels on the issue.
- `syncIssueCompletion` never rolls back local state on failure — GitHub failing to
  follow is surfaced as an error, not undone locally.
- `unlinkTask` never mutates the GitHub issue; it only changes local task fields and
  records the issue in `state.excludedIssues`.
- Every task linked to an issue outside the currently-synced repo candidate set must
  still get its status/category reconciled each `syncGithub()` run (see the
  standalone-linked-tasks pass above).
- `createGithubIssueFromTask` refuses to run on a task that's already linked
  (`task.source === 'github'`) — unlink it first.

## Traps

- Don't assume `syncGithub()`'s main repo loop covers every linked task — a task can
  be linked to an issue in a repo that isn't pinned, isn't in the open-issue
  candidate set, or has since been excluded; it only gets reconciled by the
  standalone pass.
- `applyCategoryFromLabels` can silently create new categories as a side effect of
  syncing labels — this is intentional, not a bug, but it means syncing can grow
  `state.categories` without any explicit user action.
- `createGithubIssueFromTask` persists the newly-linked task *before* the done-task
  close-issue call; if that close call fails, the task is still linked locally even
  though the GitHub issue is left open.
- Color resolution depends on `cssColorToHex` (`js/state.js:121`), which needs a
  live DOM/stylesheet to resolve a category's CSS color — including the
  `var(--proj-sat)`/`var(--proj-light)` custom properties, which literally differ
  between light/dark theme. So the color GitHub ends up seeing is whatever theme is
  active in the browser at the moment of the push, and there's no single "true" hex
  value independent of that.
