---
name: poll-send-emails
description: Send draft emails from the poll outbox via Gmail API
user_invocable: true
---

# poll-send-emails

Send draft emails from the poll outbox via Gmail API.

## Usage

```
/poll-send-emails [--dry-run] [--type TYPE]
```

## Arguments

- `--dry-run` (optional) - Show what would be sent without actually sending
- `--type` (optional) - Only send specific draft type: `poll`, `reminder`, or `results`. If omitted, sends all drafts.

## Description

This skill reads draft email files from the active poll's `outbox/` folder and sends them via Gmail API. Each draft file follows the format:

```
To: participant@example.com
Subject: Your poll invitation

Here is your poll content...
```

### Workflow

1. Read `polls-config.json` to get the active poll folder
2. Scan all `draft-*.txt` files in `<pollsRoot>/<activePoll>/outbox/`
3. Parse each draft file:
   - Extract recipient email from `To:` line
   - Extract subject from `Subject:` line
   - Extract body (everything after blank line)
4. Send via Gmail API using `send_email` tool
5. On success: move draft to `outbox/sent/<filename>`
6. On failure: log error and continue with next draft
7. Report summary: X sent, Y failed

### Flags

- **--dry-run** - Parse and display what would be sent without actually sending. Useful for verification before bulk sending.
- **--type** - Filter drafts by type:
  - `poll` - Only send `draft-poll-*.txt` files
  - `reminder` - Only send `draft-reminder-*.txt` files
  - `results` - Only send `draft-results-*.txt` files
  - Omit to send all types

## Output

```
Sending poll emails...

Parsed drafts:
  - to: alice@example.com, subject: "Your poll: Team lunch planning"
  - to: bob@example.com, subject: "Your poll: Team lunch planning"

Sending... (2 total)

✓ alice@example.com - sent
✓ bob@example.com - sent

Summary: 2 sent, 0 failed
Moved 2 drafts to outbox/sent/
```

## Dry-Run Example

```
Sending poll emails (dry-run mode)...

Parsed drafts:
  - to: alice@example.com, subject: "Your poll: Team lunch planning"
  - to: bob@example.com, subject: "Your poll: Team lunch planning"

[DRY RUN] Would send 2 emails. Re-run without --dry-run to actually send.
```

## Prerequisites

- `polls-config.json` configured with valid `pollsRoot` and `activePoll`
- Gmail MCP server installed and authenticated
- Draft files in `<pollsRoot>/<activePoll>/outbox/draft-*.txt` format
- Valid Gmail API access with send permissions

## Error Handling

- **Invalid draft format** - Log error and skip
- **Invalid email address** - Log error and skip
- **Gmail API error** - Log error with details and skip
- **Permission denied** - Clear error message directing user to re-authenticate

## Implementation Notes

- Uses Gmail MCP tool: `send_email`
- Parameters: `to` (array), `subject` (string), `body` (string), `isHtml` (boolean, set to false)
- Plain text emails only (no HTML formatting)
- Creates `outbox/sent/` directory if it doesn't exist
- Preserves original draft files in `outbox/` (copies to sent, doesn't delete)

## See Also

- `/poll-draft-emails` - Generate draft files
- `/poll-fetch-responses` - Retrieve responses from Gmail
- `/poll-process-responses` - Process response files
