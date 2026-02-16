---
name: poll-fetch-responses
description: Retrieve poll responses from Gmail inbox and save as text files
user_invocable: true
---

# poll-fetch-responses

Retrieve poll responses from Gmail inbox and save as text files.

## Usage

```
/poll-fetch-responses [--keep-unread] [--all]              # Quiet mode (default)
/poll-fetch-responses [--keep-unread] [--all] --verbose    # Verbose mode with details
```

### Arguments

- `--keep-unread` (optional) - Don't mark fetched emails as read (useful for testing)
- `--all` (optional) - Fetch all poll response emails, not just unread ones
- `--verbose` (optional) - Show detailed progress information

### Quiet Mode (Default)

By default, output is minimal - just the final result:

```
Fetched 2 response(s), 1 skipped
```

### Verbose Mode

For detailed progress information, use the `--verbose` flag:

```
Fetching poll responses from Gmail...

Searching for: is:unread subject:Poll Response:
Found 3 messages

Processing responses:
  alice@example.com (2026-02-12 14:30:00 UTC) - saved as alice@example.com-1707746400.txt
  bob@example.com (2026-02-12 15:45:00 UTC) - saved as bob@example.com-1707750300.txt
  unknown@example.com (2026-02-12 16:00:00 UTC) - skipped (not in participants list)

Summary: 2 responses fetched, 1 skipped

Response files ready in: D:\polls-root\032026 Christmas Party Planning Meeting\inbox
Next: run /poll-process-responses to update Poll.md
```

## Prerequisites

- `polls-config.json` configured with `inboxFolder`, `pollsEmailSubjectPrefix`, `activePoll`, and optionally `pollsEmailLabel`
- OAuth2 authentication completed via `/poll-gmail-setup`
- `Poll.md` exists with participants list (for validation)
- Valid Gmail API credentials with read and modify permissions

## Error Handling

- **Not authenticated** - Clear message directing user to run `/poll-gmail-setup`
- **Email from non-participant** - Log as skipped, don't create response file
- **Malformed email body** - Log error and skip
- **Missing headers** - Log error and skip
- **No valid responses in email** - Log as skipped
- **Gmail API error (401)** - Suggests re-running `/poll-gmail-setup`
- **File system error** - Log error and skip

## Implementation Notes

- Uses direct Gmail API via `googleapis` package
- OAuth2 authentication via `google-auth-library`
- Credentials stored securely in `~/.gmail-credentials/`
- Gmail API calls:
  - `gmail.users.messages.list()` - Search matching emails
  - `gmail.users.messages.get()` - Read full message content
  - `gmail.users.messages.modify()` - Remove UNREAD label and add custom labels
  - `gmail.users.labels.list/create()` - Manage custom labels
- Creates `inboxFolder` directory if it doesn't exist
- Response filenames format: `<email>-<unix-timestamp>.txt`
- Timestamp uses seconds since epoch for unique filenames
- Validates response format before saving (must have at least one numbered choice)
- Handles multipart emails and HTML-to-text conversion

## NLP Fallback

When regex parsing finds no numbered responses in an email, the skill can fall back to Claude Haiku API to intelligently interpret natural language replies (e.g., "March 16 works for me, the 17th if needed").

### How It Works

1. **Regex first** -- three tiers of pattern matching are always tried first (fast, free)
2. **NLP fallback** -- if regex returns nothing and `ANTHROPIC_API_KEY` is set, the email body is sent to Claude Haiku along with the poll's date/time choices
3. **Graceful degradation** -- if no API key is set or the API call fails, behavior is identical to the regex-only path (response skipped with a warning)

### Setup

Set the `ANTHROPIC_API_KEY` environment variable. No additional npm packages are required (uses Node 20 native `fetch()`).

### Output

- Responses parsed via NLP show an `[NLP]` tag in verbose output
- The summary line includes NLP count: `Fetched 3 response(s) (1 via NLP)`
- If no API key is set and regex fails, a debug hint is logged: `set ANTHROPIC_API_KEY to enable NLP fallback`

### Cost

Each NLP call uses Claude Haiku (~$0.0002 per response). Only triggered when regex parsing fails, so well-formatted numbered responses have zero added cost or latency.

## Validation Rules

- **Sender email** - Must match a participant in Poll.md
- **Response body** - Must contain at least one valid response (numbered format via regex, or natural language via NLP)
- **Date header** - Must be parseable as valid date/time

## See Also

- `/poll-send-emails` - Send invitation and reminder emails
- `/poll-process-responses` - Parse response files and update Poll.md
- `/poll-status` - View current poll state and response tally
