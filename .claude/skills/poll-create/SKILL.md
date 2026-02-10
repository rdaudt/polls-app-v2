---
name: poll-create
description: Create a new poll — reads from Poll init.md if available, otherwise collects details interactively
user_invocable: true
---

# /poll-create

Create a new poll by reading from a Poll init.md file (if available) or by interactively collecting details from the organizer.

## Setup

1. Read `polls-config.json` from the repo root. If `pollsRoot` is empty, ask the organizer to set it first.

## Data Collection

### Option A: Parse Poll init.md (if file exists)

The skill will attempt to use a Poll init.md file if available. The file location is determined in this order:
1. If a file path argument is provided to the skill, use that path
2. Otherwise, check for `Poll init.md` in the `pollsRoot` directory (default location)
3. If no init file is found at either location, proceed to interactive collection (Option B)

**Parsing Procedure:**

1. Read the Poll init.md file
2. Split content into sections by headers:
   - `## Poll description`
   - `## Participants`
   - `## Date/time choices`
3. Parse Poll description section:
   - For each line, split by the first `: ` character
   - Store extracted key-value pairs: poll_title, event_name, organizer, organizer_email, organizer_title, organizer_tz, deadline
4. Parse Participants section:
   - Find all lines starting with `|` (table rows)
   - Skip the first two rows (header row and separator row with `----`)
   - For each remaining row, split by `|`
   - Extract: Name (column 1), Email (column 2), Time Zone (column 3)
   - Trim whitespace from each field
5. Parse Date/time choices section:
   - Find all lines matching pattern `N. ` at the start (numbered list)
   - Strip leading `N. ` prefix
   - Store remaining text as the choice
6. Proceed to Validation section

**Validation:**

After parsing Poll init.md, validate the collected data:

1. **Required fields present**:
   - Poll title, Organizer, Organizer email, Organizer time zone, Deadline for Responses
   - At least 1 participant (with name, email, and time zone)
   - At least 1 date/time choice
2. **Optional fields**:
   - Event name: defaults to Poll title if omitted
   - Organizer title: may be empty or omitted
3. **Field formats**:
   - Deadline matches `Mon DD, YYYY` (e.g., `Feb 28, 2026`)
   - Date/time choices match `Mon DD, YYYY, HH:MM` (e.g., `Mar 15, 2026, 10:00`)
   - Time zones are valid TZ abbreviations (refer to `.claude/skills/poll-shared/tz-conversion.md`)
   - Dates are valid calendar dates
4. **If validation fails**:
   - Report specific field errors clearly (e.g., "Organizer email is missing", "Choice 2 has invalid time format")
   - Prompt the user interactively for missing or invalid fields only
   - Allow correction of one field at a time until validation passes

### Option B: Interactive Collection (if no init file or validation prompts needed)

If no Poll init.md file is found, or if the organizer needs to correct missing/invalid fields, ask for details interactively:

1. **Poll title** (e.g., "PanCanada Monthly Meeting Feb 2026")
2. **Event name** (defaults to the poll title if not specified)
3. **Organizer name**
4. **Organizer email**
5. **Organizer title** (e.g., "Director of AI")
6. **Organizer time zone** (TZ abbreviation — see `.claude/skills/poll-shared/tz-conversion.md`)
7. **Participants** — for each: name, email, and time zone. Ask "Add another participant?" after each.
8. **Date/time choices** — each as `Mon DD, YYYY, HH:MM` in the organizer's TZ. Ask "Add another choice?" after each.
9. **Deadline for responses** — date as `Mon DD, YYYY`

## Actions

1. **Create poll folder**: Under `pollsRoot`, create a subfolder. Use a naming convention like `MMYYYY <event name>` (e.g., `022026 PanCanada Monthly Meeting`).

2. **Create `Poll.md`** in the new folder following the format in `.claude/skills/poll-shared/poll-file-format.md`. Initialize:
   - Poll description section with all collected metadata
   - Participants table with all participants (Polled on, Responded on, Reminded on, Results Communicated on columns empty)
   - Date/time choices as a numbered list
   - Empty Responses table (header only)
   - Empty Current state section

3. **Create email templates** in the new folder:
   - `Poll email template.md` — poll invitation template
   - `Poll reminder email.md` — reminder template
   - `Poll results email template - Respondent.md` — results for respondents
   - `Poll results email template - Non-Respondent.md` — results for non-respondents

   Use the template format described in `.claude/skills/poll-shared/template-merge.md`. Model the templates after the example data in the `Polls/` folder.

4. **Create `outbox/`** subfolder (empty).

5. **Update `polls-config.json`**: Set `activePoll` to the new folder name.

## Output

Confirm to the organizer:
- Data source used (either path to Poll init.md file or "interactive collection")
- Poll folder created at `<path>`
- Number of participants added
- Number of date/time choices
- Active poll updated in config
