---
name: poll-remind
description: Draft reminder emails for participants who haven't responded
user_invocable: true
---

# /poll-remind

Identify participants who have been polled but haven't responded, and draft reminder emails for them.

## Setup

1. Read `polls-config.json` from the repo root.
2. Resolve the active poll folder: `<pollsRoot>/<activePoll>/`.
3. Read `Poll.md` from the active poll folder.
4. Read `Poll reminder email.md` from the active poll folder.

## Behavior

1. Identify participants who meet ALL of these criteria:
   - Have a "Polled on" date (they were sent the poll)
   - Do NOT have a "(last) Responded on" date (they haven't responded)
2. If no participants need reminding, report that and exit.
3. For each participant needing a reminder:
   a. Merge the reminder email template following `.claude/skills/poll-shared/template-merge.md`:
      - Substitute all `{$...$}` fields
      - Convert date/time choices to the participant's TZ per `.claude/skills/poll-shared/tz-conversion.md`
      - Expand the `{$DateTimeChoice.N$}` pattern for all choices
      - Set `{$NowDateTime$}` to the current date/time
   b. Write a draft file to `outbox/draft-reminder-<email>.txt` with the format:
      ```
      To: <participant email>
      Subject: <merged subject>

      <merged body with <br> converted to newlines>
      ```
   c. Update the "(last) Reminded on" column for this participant in Poll.md with the current date/time (organizer's TZ format).
4. Save the updated `Poll.md`.

## Output

Report to the organizer:
- Number of reminder drafts created
- List of participants reminded (name + email)
- Location of draft files in `outbox/`
