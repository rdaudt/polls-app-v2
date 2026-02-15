# /poll-remind

**Generate reminder email drafts for participants who haven't responded yet**

## Overview

Creates reminder email draft files in `outbox/` for each participant who was invited but hasn't responded yet. Updates the poll to mark them as reminded.

This skill:
- Reads the "Poll reminder email.md" template
- Generates personalized reminder emails with timezone-converted date/time choices
- Creates `outbox/draft-reminder-<email>.txt` files
- Updates Poll.md participant table to mark as reminded
- Reports summary of created drafts

## Usage

```
/poll-remind              # Quiet mode (default)
/poll-remind --verbose    # Verbose mode with details
```

### Quiet Mode (Default)

By default, output is minimal - just the final result:

```
1 reminder draft created
```

### Verbose Mode

For detailed progress information, use the `--verbose` flag:

```
Creating reminder drafts...

Found 1 non-respondent:
  - bob@example.com (Bob Smith) - polled on Feb 10, 2026, no response yet

Merging templates and creating drafts...
  draft-reminder-bob@example.com.txt - created

Updated Poll.md: Marked 1 participant as reminded on Feb 14, 2026

Summary: 1 reminder draft created in outbox/
Next: Review drafts, then run /poll-send-emails --type reminder to send
```

## File Format

Each draft file is plain text with this format:

```
To: participant@example.com
Subject: Reminder: Event Title

[Merged email body with timezone-converted times]
```

## When to Use

- After initial invitation period expires
- When approaching the response deadline
- Multiple times to remind non-respondents (updates remindedOn each time)

## Error Handling

- No active poll configured → Shows error message
- Poll.md not found → Shows error message
- Template file not found → Shows error message
- No non-respondents → Shows message and exits
- Failed to create outbox directory → Shows error message

## Implementation

Uses shared modules:
- `poll-parser.js` — Parse Poll.md, update participant table
- `template-engine.js` — Merge template fields
- `tz-converter.js` — Convert date/times to participant's timezone

## Related Commands

- `/poll-draft-emails` — Generate invitation emails
- `/poll-send-emails --type reminder` — Send reminders via Gmail
- `/poll-status` — View response progress
