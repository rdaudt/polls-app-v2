# /poll-status

**Display the current state of the active poll (read-only)**

## Overview

Shows a summary of the active poll including:
- Event title and organizer info
- Response deadline
- Participant count and responses received
- Vote tally (Yes and As Needed counts for each choice)
- Current frontrunner with vote counts
- Non-respondents

This is a **read-only** command that does not modify any files.

## Usage

```
/poll-status
```

No arguments or options.

## Output Example

```
Poll Status: Team Lunch Planning

Organizer: Alice Johnson (alice@example.com)
Deadline: Feb 28, 2026

Participants: 2 / 3 responded

Vote Tally:
  Choice  Date/Time               Yes  As Needed
  ------  ----------------------  ---  ---------
  1       Feb 16, 2026, 13:00     2    0
  2       Feb 17, 2026, 10:00     1    1
  3       Feb 18, 2026, 15:00     0    2

🏆 Frontrunner: Choice 1 (Feb 16, 2026, 13:00) - 2 Yes, 0 As Needed

Current State:
  - Invitations sent: Yes
  - Responses received: 2 / 3
  - Non-respondents: Bob Smith
  - Reminders sent: Yes
```

## Error Handling

- No active poll configured → Shows error message
- Poll.md file not found → Shows error message
- No participants → Shows empty tally
- No responses yet → Shows frontrunner as null

## Implementation

Uses shared modules:
- `poll-parser.js` — Parse Poll.md
- `vote-tally.js` — Tally votes and determine frontrunner

## Related Commands

- `/poll-preview` — Preview merged email for a participant
- `/poll-draft-emails` — Generate invitation emails
- `/poll-remind` — Draft reminder emails
- `/poll-wrap-up` — Finalize poll with results
