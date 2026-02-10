---
name: poll-draft-emails
description: Draft poll invitation emails for all participants who haven't been polled yet
user_invocable: true
---

# /poll-draft-emails

Draft poll invitation emails for each participant who hasn't been polled yet and save them to the outbox.

## Setup

1. Read `polls-config.json` from the repo root.
2. Resolve the active poll folder: `<pollsRoot>/<activePoll>/`.
3. Read `Poll.md` from the active poll folder.
4. Read `Poll email template.md` from the active poll folder.

## Behavior

1. Identify participants without a "Polled on" date (empty cell in the Participants table).
2. If no participants need polling, report that all participants have already been polled and exit.
3. For each unpolled participant:
   a. Merge the poll email template following `.claude/skills/poll-shared/template-merge.md`:
      - Substitute all `{$...$}` fields
      - Convert date/time choices to the participant's TZ per `.claude/skills/poll-shared/tz-conversion.md`
      - Expand the `{$DateTimeChoice.N$}` pattern for all choices
   b. Write a draft file to `outbox/draft-poll-<email>.txt` with the format:
      ```
      To: <participant email>
      Subject: <merged subject>

      <merged body with <br> converted to newlines>
      ```
   c. Update the "Polled on" column for this participant in the Participants table of `Poll.md` with the current date/time (in organizer's TZ format: `Mon DD, YYYY, HH:MM`).
4. Save the updated `Poll.md`.

## Output

Report to the organizer:
- Number of draft emails created
- List of participants emailed (name + email)
- Location of draft files in `outbox/`
