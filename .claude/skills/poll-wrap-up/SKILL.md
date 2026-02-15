# /poll-wrap-up

**Finalize the poll by generating results emails to all participants**

## Overview

Finalizes the poll with a selected winning choice and generates results email drafts for all participants. Creates two types of result emails:
- **Respondent results** — For participants who responded to the poll
- **Non-respondent results** — For participants who didn't respond

## Usage

```
/poll-wrap-up <selected-choice>                # Quiet mode (default)
/poll-wrap-up <selected-choice> --verbose      # Verbose mode with details
```

### Arguments

- `<selected-choice>` (required) — Choice number (1, 2, 3, etc.) that won the poll

### Quiet Mode (Default)

By default, output is minimal - just the final result:

```
3 results drafts created (2 respondents, 1 non-respondent)
```

### Verbose Mode

For detailed progress information, use the `--verbose` flag:

```
Wrapping up poll with selected choice: 1 (Feb 16, 2026, 13:00)

Creating results drafts for all participants...

Respondents (2):
  draft-results-alice@example.com.txt - created (respondent template)
  draft-results-charlie@example.com.txt - created (respondent template)

Non-Respondents (1):
  draft-results-bob@example.com.txt - created (non-respondent template)

Updated Poll.md:
  - Marked all 3 participants as results communicated on Feb 14, 2026, 10:30
  - Poll status: Completed

Summary: 3 results drafts created in outbox/ (2 respondents, 1 non-respondent)
Next: Review drafts, then run /poll-send-emails --type results to send
```

## Templates Used

The skill uses different result templates based on participant status:

- **Respondent template**: `Poll results email template - Respondent.md`
  - Sent to participants who responded
  - Shows the selected date/time
  - Can thank them for their participation

- **Non-Respondent template**: `Poll results email template - Non-Respondent.md`
  - Sent to participants who didn't respond
  - Informs them of the selected date/time
  - Different tone appropriate for non-respondents

## Merge Fields

Both templates can use these merge fields:
- `{$SelectedDateTime$}` — Selected date/time (in participant's TZ)
- `{$EventTitle$}` — Event name
- `{$Participant.Name$}` — Recipient's name
- `{$Organizer.Name$}` — Organizer's name
- And all other standard merge fields

## Error Handling

- No active poll configured → Shows error message
- Poll.md not found → Shows error message
- Invalid choice number → Shows error with valid range
- Result template file not found → Shows error message
- Missing outbox directory → Creates it automatically

## Implementation

Uses shared modules:
- `poll-parser.js` — Parse Poll.md, update participant table
- `template-engine.js` — Merge template fields
- `tz-converter.js` — Convert selected date/time to participant's timezone

## Related Commands

- `/poll-status` — View current poll state before wrap-up
- `/poll-send-emails --type results` — Send results emails via Gmail
- `/poll-remind` — Remind non-respondents before wrap-up
