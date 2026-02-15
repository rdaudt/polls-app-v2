---
name: poll-send-emails
description: Send draft emails from the poll outbox via Gmail API
user_invocable: true
---

# poll-send-emails

Send draft emails from the poll outbox via Gmail API.

## Usage

```
/poll-send-emails [--dry-run] [--type TYPE]              # Quiet mode (default)
/poll-send-emails [--dry-run] [--type TYPE] --verbose    # Verbose mode with details
```

### Arguments

- `--dry-run` (optional) - Show what would be sent without actually sending
- `--type` (optional) - Only send specific draft type: `poll`, `reminder`, or `results`. If omitted, sends all drafts.
- `--verbose` (optional) - Show detailed progress information

### Quiet Mode (Default)

By default, output is minimal - just the final result:

```
2 emails sent, 0 failed
```

### Verbose Mode

For detailed progress information, use the `--verbose` flag:

```
Sending poll emails...

Parsed drafts:
  - to: alice@example.com, subject: "Your poll: Team lunch planning"
  - to: bob@example.com, subject: "Your poll: Team lunch planning"

Sending... (2 total)

alice@example.com - sent
bob@example.com - sent

Summary: 2 sent, 0 failed
Moved 2 drafts to outbox/sent/
```

### Dry-Run Example

```
Sending poll emails (dry-run mode)...

Parsed drafts:
  - to: alice@example.com, subject: "Your poll: Team lunch planning"
  - to: bob@example.com, subject: "Your poll: Team lunch planning"

[DRY RUN] Would send 2 emails. Re-run without --dry-run to actually send.
```

## Prerequisites

- `polls-config.json` configured with valid `pollsRoot` and `activePoll`
- OAuth2 authentication completed via `/poll-gmail-setup`
- Draft files in `<pollsRoot>/<activePoll>/outbox/draft-*.txt` format
- Valid Gmail API credentials with send permission

## Error Handling

- **Not authenticated** - Clear message directing user to run `/poll-gmail-setup`
- **Invalid draft format** - Log error and skip
- **Invalid email address** - Log error and skip
- **Gmail API error (401)** - Suggests re-running `/poll-gmail-setup`
- **Gmail API error (429)** - Rate limited, auto-retries with backoff
- **Other API errors** - Logs error details and continues with next draft

## Implementation Notes

- Uses direct Gmail API via `googleapis` package
- OAuth2 authentication via `google-auth-library`
- Credentials stored securely in `~/.gmail-credentials/`
- Plain text emails only (no HTML formatting)
- Creates `outbox/sent/` directory if it doesn't exist
- Rate limiting: 1 second delay between batches (max 10 per batch)
- Preserves original draft files in `outbox/` (copies to sent, doesn't delete)

## See Also

- `/poll-draft-emails` - Generate draft files
- `/poll-fetch-responses` - Retrieve responses from Gmail
- `/poll-process-responses` - Process response files
