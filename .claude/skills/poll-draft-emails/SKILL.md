# /poll-draft-emails

**Generate invitation draft email files for participants who haven't been polled yet**

## Overview

Creates draft invitation email files in `outbox/` folder for each participant who hasn't received an invitation yet. Updates the poll to mark them as polled.

This skill:
- Reads the "Poll email template.md" template
- Generates personalized emails with timezone-converted date/time choices
- Creates `outbox/draft-poll-<email>.txt` files
- Updates Poll.md participant table to mark as polled
- Reports summary of created drafts

## Usage

```
/poll-draft-emails              # Quiet mode (default)
/poll-draft-emails --verbose    # Verbose mode with details
```

### Quiet Mode (Default)

By default, output is minimal - just the final result:

```
2 invitation drafts created
```

This is ideal for non-technical users or when integrating into scripts.

### Verbose Mode

For detailed progress information, use the `--verbose` flag:

```
Creating poll invitation drafts...

Found 2 unpolled participants:
  - alice@example.com (Alice Johnson)
  - bob@example.com (Bob Smith)

Merging templates and creating drafts...
  draft-poll-alice@example.com.txt - created
  draft-poll-bob@example.com.txt - created

Updated Poll.md: Marked 2 participants as polled on Feb 14, 2026

Summary: 2 invitation drafts created in outbox/
Next: Review drafts, then run /poll-send-emails to send via Gmail
```

## File Format

Each draft file is plain text with this format:

```
To: participant@example.com
Subject: You're invited: Event Title

[Merged email body with timezone-converted times]
```

## Error Handling

- No active poll configured → Shows error message
- Poll.md not found → Shows error message
- Template file not found → Shows error message
- No unpolled participants → Shows message and exits
- Failed to create outbox directory → Shows error message

## Implementation

Uses shared modules:
- `poll-parser.js` — Parse Poll.md, update participant table
- `template-engine.js` — Merge template fields
- `tz-converter.js` — Convert date/times to participant's timezone

## Related Commands

- `/poll-preview` — Preview email before drafting
- `/poll-send-emails` — Send draft emails via Gmail
- `/poll-remind` — Draft reminder emails
