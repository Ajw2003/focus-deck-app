# Claude ↔ Focus Deck: Autonomous Daily Check-In (Part 2, phase 1, read-only) Plan

> **For agentic workers:** This plan is operational, not code. Execute it directly (no TDD subagents needed) once Part 1 (`2026-09-21-claude-issues-provenance.md`) is complete and pushed.

**Goal:** A daily, read-only scheduled task that reads the Focus Deck sync Gist and push-notifies a layered report (overdue & stale → changed → everything else open).

**Architecture:** One scheduled task created with the `create_trigger` MCP tool (never the local cron tools). Each firing is a fresh session, so the stored prompt is fully self-contained. Data source is one unauthenticated `GET https://api.github.com/gists/{gist_id}` (secret gists are readable by anyone with the ID). No writes of any kind.

**Tech Stack:** `mcp__claude-code-remote__create_trigger` / `fire_trigger` / `list_triggers`, `PushNotification`, `curl`.

**Spec:** `docs/archive/2026-09-21-claude-focus-deck-integration-design.md` (Part 2).

## Global Constraints

- **Read-only, full stop:** no issue creation, no Gist writes, no Focus Deck mutations.
- **Never delete anything.**
- Cadence: daily. Delivery: push notification. Stale threshold: 14 days. Changed lookback: 25 hours.
- Silence when there is nothing to report.

## Required input (blocker at time of writing)

- **The sync Gist ID.** It lives in the browser's Focus Deck state (`state.gistId`, set when cross-device sync is turned on in Settings) and is not stored anywhere in this repo or reachable from a cloud session. It must be supplied by Ayden (Focus Deck → Settings, or the gist URL `https://gist.github.com/<user>/<GIST_ID>`). The gist file is named `focus-deck-state.json` (`js/sync.js`).

### Task 1: Create the scheduled task

- [ ] **Step 1:** Obtain the Gist ID (see above). Verify it: `curl -s https://api.github.com/gists/<GIST_ID> | python3 -c "import sys,json; g=json.load(sys.stdin); print(list(g['files']))"` → expect `['focus-deck-state.json']`.
- [ ] **Step 2:** Call `create_trigger` with `initiation: "human_request"`, name `Focus Deck daily check-in`, `cron_expression` for the morning in Ayden's timezone (evaluated in UTC), `notifications: {push: true}`, `requires_local_device` omitted, and this prompt (substituting the verified Gist ID):

```
READ-ONLY daily check-in for the Focus Deck app. Do not create/edit/close/reopen/comment on GitHub issues, do not write to any Gist, do not change anything anywhere. Never delete anything.

1. Fetch the state (no auth needed): curl -s https://api.github.com/gists/<GIST_ID>  — parse files["focus-deck-state.json"].content as JSON. If the fetch or parse fails, send a push notification saying the check-in could not read the Gist, with the error, then stop.
2. For every task in state.projects[].tasks[] compute, using today's date:
   a. OVERDUE: task.deadline (YYYY-MM-DD) is before today and status != "done".
      STALE: no deadline, status != "done", and updatedAt (ms epoch) older than 14 days.
   b. CHANGED: updatedAt within the last 25 hours, or a state.completedLog entry with completedAt within the last 25 hours.
   c. OTHER OPEN: every remaining task with status != "done".
3. Report in that order: overdue & stale first, then what changed, then a rundown of everything else open. Name the project for each task.
4. If overdue+stale and changed are both empty, send NO notification (silence is correct) and just end with one line saying nothing needed attention.
5. Otherwise send one PushNotification (status "proactive") wrapped in <routine_summary> tags: the first sentence is the most urgent item; the rest is the full layered report.
```

- [ ] **Step 3:** Verify with `list_triggers` (task present, enabled, `next_run_at` set).
- [ ] **Step 4 (test):** `fire_trigger` once against the real Gist; confirm the report buckets tasks correctly. (Spec's seeded-gist test needs a scratch Gist Ayden creates; optional.)
- [ ] **Step 5:** Record the trigger id and the chosen time/timezone at the bottom of this file and commit.

## Progress checklist

- [x] Gist ID obtained (supplied by Ayden on 2026-09-21)
- [x] Scheduled task created
- [ ] Test-fired and verified (see execution notes)

## Execution notes (2026-09-21)

- Scheduled task "Focus Deck daily check-in" created: id `trig_01DrH7KqRxHMEzANb9kgbYKe`, cron `0 13 * * *` (13:00 UTC daily, about 8-9am US Central/Eastern; Ayden's timezone was not stated, so this is an assumption and easy to change), push notification on, runs in the cloud only.
- Step 1 could not be verified from the authoring session: this sandbox's git/API proxy answers `403 This GitHub API path is not available: sessions are bound to their configured repositories` for `api.github.com/gists/...`. That is an environment restriction, not evidence about the Gist itself. The task's prompt tells a scheduled run NOT to work around a block (no mirrors or alternate hosts) and to push-notify the exact error instead.
- A test firing was started (`fire_trigger`, session `cse_01WEwFTW9BkR9DYFCvP5ADWg`). If scheduled sessions carry the same restriction, Ayden gets a "could not read the Gist" notification; the design needs a rethink then (for example a scheduled session that is allowed gist reads, or a repo-scoped data source such as a file committed to this repo).
