# Claude ↔ Focus Deck Integration — Design

## Goal

Let Claude act as a collaborator on the user's Focus Deck tasks — reading them, creating them,
and marking them complete — without ever being able to destroy something the user didn't ask it
to destroy, and without the user losing track of what Claude has touched or having any trouble
undoing it. Two pieces, built in order:

1. **On-demand** — Claude acts when asked, in a chat, through GitHub Issues.
2. **Autonomous (phase 1)** — a scheduled, read-only check-in. No writes yet; that's a follow-up
   once phase 1 is proven out.

## Part 1: On-demand (GitHub Issues)

### Why Issues, not the Gist

Focus Deck already has two ways data leaves the browser: the optional sync Gist (a full-state
mirror) and GitHub Issues (for repo-linked tasks specifically, synced bidirectionally by
`github-sync.js`). The on-demand piece uses **Issues only**. It reaches a narrower slice of data
(only tasks that are or become linked to a repo — a purely manual task Claude never touches) but
it reuses sync logic that's already built, tested, and running in production, and it needs no new
credential: this session's existing GitHub connector already has Issues read/write on the user's
repos.

### The contract

Claude gets exactly four operations against a repo's issues, and nothing else:

- **Create** an issue.
- **Comment** on an issue.
- **Close** an issue (mark complete).
- **Reopen** an issue (undo a completion).

Never delete an issue, a label, or anything else. This isn't purely a promise Claude has to
remember — GitHub's REST API doesn't expose issue deletion to a normal token at all (it requires
special admin/org-level permissions no ordinary PAT has), so "no delete" is close to structurally
enforced. Closing is never treated as deleting: it's reversible, exactly like the completion
toggle Focus Deck already has.

This contract is written down as a tier-4 doc in `docs/4-systems/` (alongside `github-sync.md`),
so it governs any Claude session working in this repo — this chat, a future one, Claude Code —
not just whichever session happens to be running right now.

### Category labels (existing behavior, unchanged)

Claude can create genuine category labels (`Epic`, `Feature`, `Bug`, `Chore`, etc.) exactly the
way it already does today via `ensureLabelExists` — no new code. Every issue Claude creates must
carry at least one label regardless, since `upsertRepoProject`'s repo-wide sync only picks up
issues that have one (`js/github-sync.js:225`) — an unlabeled issue is invisible to Focus Deck
entirely.

### Provenance labels (new)

Two new reserved labels, added to `RESERVED_LABELS` so they never compete with a real category
for the "this issue's category" slot:

- **`Claude created this`** — applied once, when Claude opens the issue. Sticky: once true,
  stays true forever, regardless of what happens to the issue afterward.
- **`Claude completed this`** — applied when Claude closes the issue (whether Claude created it
  or not). Live, not sticky: removed automatically the moment the issue reopens — by anyone,
  from anywhere (Focus Deck's checkbox, GitHub directly) — and reapplied only if Claude closes it
  again later.

Both get created on the repo the first time they're needed, through the same `ensureLabelExists`
call category labels already use.

`applyCategoryFromLabels` (`js/github-sync.js:17`) reads these two labels the same pass it
already reads every other label, setting two new task booleans: `task.claudeCreated`,
`task.claudeCompleted`. `render.js` renders them as small chips using the existing `.chip`
styling — the same visual language as the category chip, energy chip, and GitHub-link chip that
already sit side by side on a task row — rather than inventing a separate badge system.

### Reverting Claude's work

No new feature needed:

- **Unwanted Claude-created task** → the user's existing delete/unlink buttons, which already
  work on every task regardless of who created it. The "never delete" rule binds Claude, not the
  user.
- **Unwanted completion** → the user's existing completion checkbox, which already syncs both
  directions; unchecking it reopens the GitHub issue, which in turn clears `Claude completed
  this` per the live/sticky split above.

### Data flow (on-demand)

```
User (chat) → Claude → GitHub Issues API (create/comment/close/reopen, always ≥1 label)
                              │
                              ▼
              Focus Deck's existing sync (upsertRepoProject / applyCategoryFromLabels)
                              │
                              ▼
                 Task rows show category chip + claudeCreated/claudeCompleted chips
```

### Testing

Extends the existing `github-sync.test.mjs` coverage: `applyCategoryFromLabels` correctly reads
the two new reserved labels into the two new booleans without treating them as a category
candidate; a reopened issue clears `claudeCompleted` on the next sync pass. A Playwright pass
(matching the pattern already used for the create-issue and link-issue features earlier this
project) confirms the chips render correctly and don't collide with the category chip visually.

## Part 2: Autonomous check-in (phase 1 — read-only)

### Why the Gist here, and not Issues

Unlike the on-demand piece, the scheduled check-in reads the **sync Gist**, not Issues. Two
reasons this is the right source for this piece specifically:

- A fresh scheduled-task session has no way to know which repos are currently linked in Focus
  Deck (that list lives in the browser's `localStorage`) — the Gist already has it, since it's a
  full-state mirror.
- Focus Deck's `deadline` field is local-only; it is never synced to or from GitHub Issues
  (confirmed by reading `github-sync.js`: only title, labels/category, and open/closed state are
  synced — no dates). Reading Issues alone, "overdue" would be undetectable. The Gist has the
  real value.

This does **not** reopen the "should Claude write to the Gist" question — this phase only ever
reads it. Writing (to the Gist, or proactively to Issues) is out of scope until phase 1 has run
for a while and a safe design for phase 2 exists.

### Reading a secret Gist needs no credential

Verified against GitHub's own documentation: the Gist Focus Deck creates is a **secret** gist
(`"public": false`, `settings.html`), and secret gists are not access-controlled — they're merely
unlisted. Anyone with the direct ID can read one with a plain, unauthenticated
`GET https://api.github.com/gists/{gist_id}`. So there is no token to generate and no credential
to store for this piece. The only prerequisite is that a sync Gist actually exists (the user
turns on cross-device sync in Settings) and that its ID is known to the scheduled task's prompt.

### What it checks, every run — all from one Gist read

The user asked for a layered report, ordered by urgency, computed entirely from the fetched
state (no second data source needed):

1. **Overdue & stale, first.** Overdue = `task.deadline` is in the past and `status !== 'done'`
   (now directly knowable, since the Gist carries the real local deadline). Stale = no deadline,
   `status !== 'done'`, and `updatedAt` older than a threshold — defaulting to **14 days**, easy
   to adjust later; flagging this as an assumption rather than something asked about, since it's
   a trivial knob to turn.
2. **What's changed**, next. Any task whose `updatedAt` (or `completedLog` entry) falls inside
   the lookback window matching the run's cadence, with a little overlap so a late or skipped run
   never silently drops a change — e.g. a 25-hour lookback for a daily cadence.
3. **A rundown of everything else** still open, last.

### Cadence and delivery

No strong preference was expressed, so defaulting to the recommended options, stated here as an
assumption: **daily**, delivered as a **push notification**. Both are one-line changes to the
scheduled task's settings later if that turns out wrong.

### Mechanism

A scheduled task created with `create_trigger` (never a local/in-process cron — those don't
survive the session ending). Each firing starts a fresh session with no memory of prior runs, so
the prompt must be fully self-contained: the Gist ID, the exact report structure above, and an
explicit instruction that this run is **read-only** — no issue creation, no Gist writes, no
Focus Deck mutations of any kind, full stop.

### Data flow (autonomous, phase 1)

```
create_trigger (daily) → fresh Claude session
                              │
                              ▼
        GET https://api.github.com/gists/{id}   (no auth needed — secret gist, unauthenticated read)
                              │
                              ▼
   Bucket tasks: overdue/stale → changed-since-lookback → everything else open
                              │
                              ▼
                    Push notification to the user
```

### Testing

Since this is a fresh-session, scheduled flow rather than something exercised interactively, it's
verified by firing the trigger on demand (`fire_trigger`) against a Gist seeded with a mix of
overdue, stale, recently-changed, and quiet tasks, and confirming the report buckets them
correctly and sends nothing when there is genuinely nothing to report.

## Open items for phase 2 (not designed yet, deliberately)

Once phase 1 has run for a while: what safe, reversible actions an autonomous run could take on
its own (still bound by the same never-delete contract as the on-demand piece), and whether it
should require the user's confirmation before acting or only report-then-act on a delay. Not
decided now — explicitly deferred, per the user's own ordering ("figure out how to do that safely
once part 1 works").
