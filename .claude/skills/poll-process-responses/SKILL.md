# /poll-process-responses

**Process poll response files from the inbox and update Poll.md with votes**

## Overview

Reads response files from the inbox, parses participant choices, performs timezone conversion, and updates Poll.md with the responses. This is the most complex skill — it handles:

- **Response file parsing** — Extract From, Date, Subject, and numbered choices
- **Timezone conversion** — Convert participant local times back to organizer TZ
- **Vote recording** — Add responses to Poll.md responses table
- **Participant tracking** — Update respondedOn dates
- **Vote tallying** — Automatically tally votes and update current state
- **File management** — Move processed files to inbox/processed/

## Usage

```
/poll-process-responses
```

No arguments or options. Processes all unprocessed response files in the inbox.

## Response File Format

Response files in the inbox should follow this format:

```
From: participant@example.com
Date: Feb 11, 2026, 14:30
Subject: Re: You're invited: Event Title

1: Yes
2: As Needed
3: Yes
```

Each line after the blank line contains: `<choice_number>: <Yes|As Needed>`

## Output Example

```
Processing poll responses...

Found 2 response files in inbox/

Processing:
  ✓ alice@example.com-1707746400.txt - 3 choices recorded
  ✓ bob@example.com-1707750300.txt - 3 choices recorded

Updated Poll.md:
  - Recorded 6 total responses (3 per participant)
  - Marked 2 participants as responded
  - Updated vote tally
  - Current frontrunner: Choice 1 (Feb 16, 2026, 13:00)

Moved 2 response files to inbox/processed/

Summary: 2 responses processed, 0 skipped
Next: Run /poll-status to see updated tally
```

## How It Works

### Step 1: Scan Inbox
- Looks for all `.txt` files in `inboxFolder` (from polls-config.json)
- Skips files in `inbox/processed/` subdirectory
- Only processes unprocessed responses

### Step 2: Parse Response File
Each file should contain:
- **From:** Participant email (case-insensitive)
- **Date:** When response was sent
- **Subject:** Email subject (for reference)
- **Choices:** One per line, `<number>: <Yes|As Needed>`

### Step 3: Validate & Extract
- Check sender is in participants list
- Extract each choice number and response type
- Validate choice numbers exist in Poll.md

### Step 4: Timezone Conversion
- Parse Date field to extract timestamp
- Convert from participant's TZ to organizer's TZ
- Store in organizer's TZ in Poll.md

### Step 5: Record Response
- Add row to Responses table in Poll.md
- Update participant's respondedOn timestamp
- Keep all historical responses (latest response per participant wins in tallying)

### Step 6: Tally Votes
- Count Yes and As Needed for each choice
- Determine frontrunner using tiebreaker algorithm
- Update "Current state" section in Poll.md

### Step 7: Archive File
- Move processed file to `inbox/processed/` directory
- Prevents reprocessing same response

## Error Handling

- **Non-participant sender** — Logged as skipped, file not moved
- **Invalid choice numbers** — Logged as warning, other choices recorded
- **Malformed file** — Logged as skipped, file not moved
- **Invalid From/Date format** — File skipped with error message
- No inbox directory → Creates it automatically
- No inbox/processed/ directory → Creates it automatically

## Timezone Conversion

The skill converts response timestamps from participant's timezone back to organizer's timezone before storing in Poll.md. This ensures all dates/times in Poll.md remain in the organizer's timezone as per design rules.

Example:
- Participant TZ: EST, Response: "Feb 11, 2026, 14:30 EST"
- Organizer TZ: PST
- Stored as: "Feb 11, 2026, 11:30" (organizer TZ)

## Implementation

Uses shared modules:
- `poll-parser.js` — Parse Poll.md, update responses & participant table
- `tz-converter.js` — Convert response times to organizer TZ
- `vote-tally.js` — Tally votes and determine frontrunner

## Related Commands

- `/poll-status` — View current tally after processing
- `/poll-remind` — Remind non-respondents
- `/poll-wrap-up` — Finalize poll with results
