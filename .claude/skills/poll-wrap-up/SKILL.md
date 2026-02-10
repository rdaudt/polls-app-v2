---
name: poll-wrap-up
description: Finalize the poll — draft results emails to all participants
user_invocable: true
---

# /poll-wrap-up

Finalize the poll by drafting results emails for all participants. This skill does **not** tally votes — tallying is done by `/poll-process-responses`.

## Setup

1. Read `polls-config.json` from the repo root.
2. Resolve the active poll folder: `<pollsRoot>/<activePoll>/`.
3. Read `Poll.md` from the active poll folder.
4. Read both results templates:
   - `Poll results email template - Respondent.md`
   - `Poll results email template - Non-Respondent.md`

## Behavior

### Step 1: Determine the winning choice

Read the "Current state" section in Poll.md:
- If `Frontrunner choice overwrite` has a value (not empty), use it as the winning choice number.
- Otherwise, use `Frontrunner choice` as the winning choice number.
- If neither has a value, report an error and suggest running `/poll-process-responses` first.

### Step 2: Determine Respondents vs. Non-Respondents

- **Respondent**: A participant who has at least one entry in the Responses table.
- **Non-Respondent**: A participant with no entries in the Responses table.

### Step 3: Draft Results Emails

For each participant:

1. Determine which template to use (Respondent or Non-Respondent).
2. Merge the template following `.claude/skills/poll-shared/template-merge.md`:
   - Substitute all `{$...$}` fields
   - For `{$SelectedDateTime$}`: Use the winning choice's date/time (from Step 1), converted to the participant's TZ with TZ abbreviation appended (format: `Mon DD, HH:MM TZ`)
3. Write a draft file to `outbox/draft-results-<email>.txt` with the format:
   ```
   To: <participant email>
   Subject: <merged subject>

   <merged body with <br> converted to newlines>
   ```
4. Update the "Poll Results Communicated on" column for this participant in the Participants table with the current date/time (organizer's TZ format).

### Step 4: Save

Save the updated `Poll.md`.

## Output

Report to the organizer:
- Winning choice and its date/time (note if overwrite was used)
- Number of results emails drafted (respondents + non-respondents)
- Location of draft files in `outbox/`
