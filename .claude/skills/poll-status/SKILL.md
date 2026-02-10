---
name: poll-status
description: Display the current state of the active poll (read-only)
user_invocable: true
---

# /poll-status

Display the current state of the active poll. This is a **read-only** skill — it does not modify any files.

## Setup

1. Read `polls-config.json` from the repo root.
2. Resolve the active poll folder: `<pollsRoot>/<activePoll>/`.
3. Read `Poll.md` from the active poll folder.

## Behavior

1. Read the **"Current state"** section from Poll.md.
2. If the Current state section is empty (no `Assessed on` line), report that no responses have been processed yet and suggest running `/poll-process-responses`.

## Important

- This skill is **read-only**. Do NOT write any files or modify Poll.md.
- The Current state section is kept up to date by `/poll-process-responses`, which tallies votes and updates the frontrunner every time it runs.

## Output

Display the following to the organizer:
- The full numbered list of date/time choices from the "Date/time choices" section
- Assessed on date/time
- Count of participants who responded
- Count of responses
- Frontrunner choice (and its date/time from the Date/time choices list)
- Frontrunner choice overwrite (if set by the organizer, with its date/time)
