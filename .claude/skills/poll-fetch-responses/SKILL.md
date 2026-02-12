# poll-fetch-responses

Retrieve poll responses from Gmail inbox and save as text files.

## Usage

```
/poll-fetch-responses [--keep-unread] [--all]
```

## Arguments

- `--keep-unread` (optional) - Don't mark fetched emails as read (useful for testing)
- `--all` (optional) - Fetch all poll response emails, not just unread ones

## Description

This skill searches Gmail for poll response emails and saves them as text files in the inbox folder. Responses are then ready to be processed by `/poll-process-responses`.

### Workflow

1. Read `polls-config.json` to get:
   - `inboxFolder` - where to save response files
   - `pollsEmailSubjectPrefix` - subject prefix to filter on (e.g., "Poll Response:")
   - `activePoll` - for validation against participants
2. Search Gmail using query:
   - By default: `is:unread subject:"Poll Response:"`
   - With `--all`: `subject:"Poll Response:"`
3. For each matching email:
   - Read full message content using `read_email` tool
   - Extract: From, Date, Subject, Body
   - Parse numbered choices from body (e.g., "1: Yes", "2: As Needed")
   - Validate sender email is in participants list in Poll.md
   - Create response file: `<inboxFolder>/<email>-<timestamp>.txt`
   - Format:
     ```
     From: participant@example.com
     Date: 2026-02-12 14:30:00 UTC
     Subject: Re: Your poll: Team lunch planning

     1: Yes
     2: As Needed
     ```
   - Mark message as read (remove UNREAD label) unless `--keep-unread` flag
   - Optionally add custom label: "Polls/Responses"
4. Report summary: X responses fetched, Y skipped (invalid sender), Z errors

### Flags

- **--keep-unread** - Don't mark fetched emails as read. Useful for testing the fetch process without consuming messages.
- **--all** - Fetch all matching emails, not just unread. Useful to re-fetch responses or recover missed emails.

## Output

```
Fetching poll responses from Gmail...

Searching for: is:unread subject:Poll Response:
Found 3 messages

Processing responses:
  ✓ alice@example.com (2026-02-12 14:30:00 UTC) - saved as alice@example.com-1707746400.txt
  ✓ bob@example.com (2026-02-12 15:45:00 UTC) - saved as bob@example.com-1707750300.txt
  ✗ unknown@example.com (2026-02-12 16:00:00 UTC) - skipped (not in participants list)

Summary: 2 responses fetched, 1 skipped

Response files ready in: D:\polls-root\032026 Christmas Party Planning Meeting\inbox
Next: run /poll-process-responses to update Poll.md
```

## Prerequisites

- `polls-config.json` configured with `inboxFolder`, `pollsEmailSubjectPrefix`, and `activePoll`
- Gmail MCP server installed and authenticated
- `Poll.md` exists with participants list (for validation)
- Valid Gmail API access with read permissions

## Error Handling

- **Email from non-participant** - Log as skipped, don't create response file
- **Malformed email body** - Log error and skip
- **Missing From/Date headers** - Log error and skip
- **Gmail API error** - Log detailed error and stop fetching
- **File system error** - Log error and skip

## Implementation Notes

- Uses Gmail MCP tools:
  - `search_emails` - Find matching emails
    - Parameters: `query` (string), `maxResults` (number)
    - Returns: Array of message objects with id, threadId, snippet
  - `read_email` - Read full message content
    - Parameters: `messageId` (string)
    - Returns: from, to, subject, date, textBody, htmlBody, attachments
  - `modify_labels` - Manage email labels
    - Parameters: `messageId`, `addLabelIds` (array), `removeLabelIds` (array)
    - Use label IDs: "UNREAD", "INBOX", "IMPORTANT", or custom label names
- Creates `inboxFolder` directory if it doesn't exist
- Response filenames format: `<email>-<unix-timestamp>.txt`
- Timestamp uses seconds since epoch for unique filenames across multiple responses from same sender
- Validates response format before saving (must have numbered choices)

## Validation Rules

- **Sender email** - Must match a participant in Poll.md
- **Response body** - Must contain at least one numbered choice (e.g., "1: Yes")
- **Date header** - Must be parseable as valid date/time

## See Also

- `/poll-send-emails` - Send invitation and reminder emails
- `/poll-process-responses` - Parse response files and update Poll.md
- `/poll-status` - View current poll state and response tally
