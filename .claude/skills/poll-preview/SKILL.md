---
name: poll-preview
description: Preview a merged poll email for a specific participant
user_invocable: true
---

# /poll-preview

Preview what a poll invitation email will look like for a specific participant, with times converted to their time zone.

## Arguments

- **participant email** (optional) — the email of the participant to preview for. If omitted, defaults to the first participant in the Participants table.

## Setup

1. Read `polls-config.json` from the repo root.
2. Resolve the active poll folder: `<pollsRoot>/<activePoll>/`.
3. Read `Poll.md` from the active poll folder.
4. Read `Poll email template.md` from the active poll folder.

## Behavior

1. Find the participant in the Participants table by email (or use the first participant).
2. If the participant is not found, report an error and list available participants.
3. Perform a template merge for this participant:
   - Follow the merge rules in `.claude/skills/poll-shared/template-merge.md`
   - Convert all date/time choices to the participant's time zone per `.claude/skills/poll-shared/tz-conversion.md`
   - Expand the `{$DateTimeChoice.N$}` pattern for all choices
4. Display the merged email to screen, showing:
   - **To:** participant email
   - **Subject:** merged subject line
   - **Body:** merged body (with `<br>` rendered as line breaks)

## Important

- This skill is **read-only**. Do NOT write any files.
- Do NOT update any dates in Poll.md.
- This is for organizer review only.
