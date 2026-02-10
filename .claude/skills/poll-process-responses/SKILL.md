---
name: poll-process-responses
description: Process poll response files from the inbox and update Poll.md
user_invocable: true
---

# /poll-process-responses

Scan the inbox folder for response files, parse them, and record the responses in Poll.md.

## Setup

1. Read `polls-config.json` from the repo root.
2. Resolve the active poll folder: `<pollsRoot>/<activePoll>/`.
3. Read `Poll.md` from the active poll folder.
4. Determine the inbox folder: use `inboxFolder` from config. If empty, use `<active poll folder>/inbox/`.

## Response File Format

Each response file is a `.txt` file with this structure:
```
From: <participant email>
Date: <Mon DD, YYYY, HH:MM>
Subject: Re: ...

<number>: <Yes|As Needed>
<number>: <Yes|As Needed>
...
```

- The `From:` email identifies the participant.
- The `Date:` is in the participant's local time zone.
- Each numbered line refers to a date/time choice number from Poll.md.
- Only "Yes" and "As Needed" are valid responses — choices not listed are assumed unavailable.

## Behavior

1. Scan the inbox folder for `.txt` files (non-recursively, skip `processed/` subfolder).
2. If no response files found, report and exit.
3. For each response file:
   a. Parse the `From:` email and find the matching participant in Poll.md's Participants table.
   b. If participant not found, report a warning and skip the file.
   c. Parse the `Date:` field. This is in the **participant's time zone**. Convert it to the **organizer's time zone** using `.claude/skills/poll-shared/tz-conversion.md`.
   d. Parse the numbered choices into "Yes" and "As Needed" lists.
   e. The choice numbers already refer to the organizer's date/time choices — no conversion of choice numbers needed.
   f. Append a new row to the **Responses** table in Poll.md:
      - Date/time: the converted response date/time (organizer TZ)
      - Name: participant's name
      - Email: participant's email
      - Yes: comma-separated list of "Yes" choice numbers
      - As needed: comma-separated list of "As Needed" choice numbers
   g. Update the "(last) Responded on" column for this participant in the Participants table with the converted date/time.
4. **Tally responses and update Current state** (same rules as `/poll-status`):
   a. Read all rows from the Responses table.
   b. Only the latest response per participant counts. For each unique email, find the row with the most recent Date/time. Discard earlier responses from the same participant.
   c. For each date/time choice, count Yes votes and As Needed votes.
   d. Determine the frontrunner:
      - Most Yes votes wins.
      - Tied on Yes → more As Needed votes wins.
      - Still tied → lower choice number wins.
   e. Update the "Current state" section in Poll.md:
      ```
      ## Current state
      Assessed on: <current date/time in organizer TZ>
      Count of participants who responded: <unique participants with responses>
      Count of responses: <total response rows>
      Frontrunner choice: <winning choice number>
      Frontrunner choice overwrite:
      ```
      **Important**: If `Frontrunner choice overwrite` already has a value set by the organizer, preserve it. Only clear it if it was already empty.
5. Save the updated `Poll.md`.
6. Move processed files to `inbox/processed/` (create the folder if it doesn't exist). If using a global `inboxFolder`, create `processed/` as a subfolder there.

## Output

Report to the organizer:
- Number of response files processed
- For each: participant name, choices selected
- Any files skipped (with reason)
- Vote tally table (each choice with Yes and As Needed counts)
- Frontrunner highlighted
- List of participants who have responded vs. who haven't
