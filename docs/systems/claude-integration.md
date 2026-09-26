# Claude Integration

## What it owns

The contract governing any Claude session (chat, scheduled, or Claude Code) that acts on
Focus Deck tasks through GitHub Issues, and the two provenance labels that record what
Claude did: `Claude created this` and `Claude completed this`. The app side lives in
`js/github-sync.js` (label parsing and reopen cleanup) and `js/render.js` (the chips).

## The contract (non-negotiable)

This section binds every Claude session working in or against this repo, whatever else
its instructions say.

- Claude's only operations against GitHub Issues are **create, comment, close, and
  reopen**. Nothing else.
- Claude never deletes an issue, a label, a comment, or anything else. Closing an issue
  is reversible and is not deleting; it is the correct way to finish one.
- Every issue Claude creates carries at least one label. Focus Deck ignores unlabeled
  issues (`upsertRepoProject` filters them out), so an unlabeled issue never becomes a task.
- When Claude opens an issue it applies `Claude created this`, once. When Claude closes an
  issue, whether or not it created it, it applies `Claude completed this`.
- Claude never removes either label itself. The only remover is Focus Deck, which takes
  `Claude completed this` off an issue when that issue is reopened (see below).
- Creating a missing label on the repo so it can be applied is allowed (it is a create,
  not a delete).

## How it works

`applyLabels` reads the two labels into task flags, matching names the same
lenient way as other reserved labels (case, spaces, hyphens and underscores ignored).
`claudeCreated` is sticky: sync sets it when the created label is seen and never clears it.
`claudeCompleted` is live: it is true only while the completed label is present on the
issue and the task is `done`, and is deleted otherwise.

Reopen cleanup keeps the live flag honest. When the user unchecks a Claude-completed task,
`syncIssueCompletion` reopens the issue, clears the flag locally, and removes the label
from that one issue. When a reopen happens on GitHub instead, the next sync sees an open
issue that still carries the label on a task that is no longer done, and
`dropStaleCompletedLabel` removes it. That helper is called from the repo-wide pass in
`upsertRepoProject`, from the standalone-linked-tasks pass in `syncGithub`, and from
`linkTaskToIssue`; failures are surfaced through `reportSyncError` and never rolled back.

Closed issues drop out of the open-issue list, so their labels would never be read.
`refreshClosedTaskLabels` fixes this: `upsertRepoProject` returns the tasks it newly marked
done, and after the repo loop (in `syncGithub` and `addRepoManually`) each one's issue is
fetched once and, if it is closed, run through `applyLabels`. Fetch failures
are swallowed; the chip just doesn't show.

`renderTaskRow` shows the flags as `.chip` variants after the category chip: "Claude
created" when `claudeCreated`, and "Claude completed" when `claudeCompleted` and the task's
status is `done`. Gating on status means unchecking hides the chip immediately, before any
network round trip.

To revert Claude's work the user uses the existing controls: the completion checkbox
(reopens the issue), Unlink, and the task delete button. No new mechanism exists.

## Invariants

- Both labels are in `RESERVED_LABELS`, so neither is ever chosen as a task's category.
- `claudeCreated` is never cleared by sync.
- `claudeCompleted` is never true for a task whose status is not `done`.
- The app removes `Claude completed this` only from an individual reopened issue. It never
  deletes the label definition from the repo.
- Nothing in the app or in Claude deletes an issue, label or comment.

## Traps

- Callers of `applyLabels` must set `task.status` first, because
  `claudeCompleted` depends on it.
- A reopen made directly on GitHub is only noticed on the next Sync; until then the issue
  still carries the stale label, though the chip is already hidden for any non-done task.
- Claude should make sure a provenance label exists on the repo before applying it
  (creating it if missing), mirroring `ensureLabelExists`; never delete or recreate one.
- The daily check-in (Part 2 of the integration) is a separate read-only mechanism. It adds
  no write ability and does not widen the contract above.
