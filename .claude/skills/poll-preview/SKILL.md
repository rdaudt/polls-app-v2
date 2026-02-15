# /poll-preview

**Preview a merged poll email for a specific participant**

## Overview

Shows exactly how an email will look after template merge fields are substituted and time zones are converted. This is a **read-only** command useful for verifying formatting and accuracy before drafting.

## Usage

```
/poll-preview <participant-email> [options]
```

### Arguments

- `<participant-email>` (required) — Email of participant to preview (case-insensitive)

### Options

- `--template TYPE` (optional) — Template type: `poll` (default), `reminder`, `results-respondent`, `results-non-respondent`
- `--selected-choice N` (optional, required for results templates) — Choice number for the winning date/time

## Examples

**Preview invitation email:**
```
/poll-preview alice@example.com
```

**Preview reminder email:**
```
/poll-preview bob@example.com --template reminder
```

**Preview results email:**
```
/poll-preview alice@example.com --template results-respondent --selected-choice 1
```

## Output Example

```
Preview for: alice@example.com (Alice Johnson, EST)
Template: Poll email template.md

---
To: alice@example.com
Subject: You're invited: Team Lunch Planning

Alice Johnson,

You're invited to participate in a scheduling poll for **Team Lunch Planning**.

Please indicate your availability for the following time slots (all times in your local timezone):

1. Feb 16, 2026, 13:00 EST
2. Feb 17, 2026, 10:00 EST
3. Feb 18, 2026, 15:00 EST

Choose "Yes" if you can attend, or "As Needed" if you might be able to adjust your schedule.

**Deadline**: Feb 28, 2026

Reply with your choices in this format:
1: Yes
2: As Needed
3: Yes

Thanks,
Alice Johnson
Director of AI
---

[DRY RUN] Email not sent. Use /poll-draft-emails to create drafts.
```

## Error Handling

- Participant not found → Shows error message
- Poll.md not found → Shows error message
- Template file not found → Shows error message
- Invalid choice number for results template → Shows error message

## Implementation

Uses shared modules:
- `poll-parser.js` — Parse Poll.md
- `template-engine.js` — Merge template fields
- `tz-converter.js` — Convert date/times to participant's timezone

## Related Commands

- `/poll-draft-emails` — Generate actual draft files from templates
- `/poll-status` — View current poll state
- `/poll-send-emails` — Send draft emails via Gmail
