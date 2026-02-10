# Polls App User Guide

## Table of Contents

1. [Introduction](#introduction)
2. [Prerequisites](#prerequisites)
3. [Quick Start](#quick-start)
4. [Complete Workflow Reference](#complete-workflow-reference)
5. [File Formats Reference](#file-formats-reference)
6. [Time Zone Handling](#time-zone-handling)
7. [Configuration](#configuration)
8. [Tips and Best Practices](#tips-and-best-practices)
9. [Troubleshooting](#troubleshooting)
10. [Appendices](#appendices)

---

## Introduction

### What is the Polls App?

The Polls App is a command-line poll scheduling service designed to help organizers coordinate meeting times with participants across different time zones. Instead of endless email threads asking "What time works for you?", the Polls App automates the entire process:

- **Organizer** creates a poll with event details and date/time options
- **Participants** respond with their availability
- **System** automatically tallies votes, handles time zone conversions, and generates results

### Key Benefits

- **No UI Required** — Everything works through simple slash commands (like `/poll-create`)
- **Markdown-Based** — All data stored as human-readable markdown files (easy to audit, version control, backup)
- **Timezone-Aware** — Automatically converts times between organizer and participant time zones
- **Audit Trail** — Every response is logged, so you can see exactly what participants said and when

### How It Works

The Polls App consists of 7 slash commands that guide you through the entire poll lifecycle:

1. `/poll-create` — Create a new poll
2. `/poll-preview` — Preview emails before sending
3. `/poll-draft-emails` — Draft invitation emails
4. `/poll-process-responses` — Record participant responses
5. `/poll-remind` — Send reminder emails
6. `/poll-status` — Check current poll status
7. `/poll-wrap-up` — Finalize and communicate results

---

## Prerequisites

- **Claude Code** installed and running on your machine
- **Repository cloned** — You have the polls app repository downloaded
- **Configuration** — The `polls-config.json` file in the repo root is set up with:
  - `pollsRoot` — Path to your polls folder
  - `inboxFolder` — Path where participant response files arrive
  - `activePoll` — Name of the current poll

### Configuration File Example

```json
{
  "pollsRoot": "D:\\polls-root",
  "activePoll": "032026 Christmas Party Planning Meeting",
  "inboxFolder": "D:\\polls-root\\032026 Christmas Party Planning Meeting\\inbox"
}
```

---

## Quick Start

### Example: Planning a Team Meeting

Let's walk through a complete example: organizing a monthly team meeting with 3 participants across different time zones.

#### Setup

- **Organizer**: Jane Smith (PST)
- **Participants**:
  - Alice Johnson (EST) — alice@company.com
  - Bob Chen (CST) — bob@company.com
  - Carol White (PST) — carol@company.com
- **Time Options**: Feb 16 at 10:00 AM and 2:00 PM PST

#### Step 1: Create the Poll

Run `/poll-create` in Claude Code. The system will either:

**Option A: Use a Poll init.md file** (if it exists at `<pollsRoot>/Poll init.md`)

Or

**Option B: Collect details interactively** (if no init file exists)

For our example, let's create a Poll init.md file first:

```markdown
## Poll description
Poll title: Team Meeting Feb 2026
Event name: February Team Meeting
Organizer: Jane Smith
Organizer email: jane.smith@company.com
Organizer title: Engineering Manager
Organizer time zone: PST
Deadline for Responses: Feb 15, 2026

## Participants
| Name | Email | Time Zone |
| ---- | ----- | --------- |
| Alice Johnson | alice@company.com | EST |
| Bob Chen | bob@company.com | CST |
| Carol White | carol@company.com | PST |

## Date/time choices
1. Feb 16, 2026, 10:00
2. Feb 16, 2026, 14:00
```

Save this as `D:\polls-root\Poll init.md`, then run `/poll-create`.

The system creates a new poll folder with:
- `Poll.md` — The central data file
- Email templates for invitations, reminders, and results
- `outbox/` folder for draft emails

**Poll.md is created** with participants, choices, and empty response tracking.

#### Step 2: Preview an Email (Optional but Recommended!)

Before sending emails to all participants, preview one to verify the formatting and time zone conversions:

Run `/poll-preview` in Claude Code and select a participant (e.g., Alice Johnson).

You'll see:
- **To:** alice@company.com
- **Subject:** [merged subject]
- **Body:**
  ```
  Hi Alice Johnson,

  We're scheduling our February Team Meeting. Please let us know
  your availability for:

  1. Feb 16, 2026, 13:00 EST  (  ) Yes  (  ) As Needed
  2. Feb 16, 2026, 17:00 EST  (  ) Yes  (  ) As Needed

  Respond by Feb 15, 2026.

  - Jane Smith
    Engineering Manager
  ```

Notice the times are converted to EST (Alice's time zone) from PST:
- 10:00 PST → 13:00 EST (3 hours ahead)
- 14:00 PST → 17:00 EST (3 hours ahead)

This is automatic! ✓

#### Step 3: Draft Invitation Emails

When you're ready to send, run `/poll-draft-emails`.

The system:
- Creates draft files in `outbox/` folder for each participant
- Updates `Poll.md` with the "Polled on" timestamp for each participant
- Does NOT send emails — you send them manually (copy/paste from the draft files)

Files created:
```
outbox/draft-poll-alice@company.com.txt
outbox/draft-poll-bob@company.com.txt
outbox/draft-poll-carol@company.com.txt
```

Each file contains:
```
To: alice@company.com
Subject: You're invited: February Team Meeting

Hi Alice Johnson,
...
```

You copy the content from each file and send via your email client.

#### Step 4: Participants Respond

Participants receive the email and click one of the date/time options. They create a response file with their answers.

For example, Alice responds:
```
From: alice@company.com
Date: Feb 10, 2026, 14:30
Subject: Re: You're invited: February Team Meeting

1: Yes
2: As Needed
```

This file lands in the `inboxFolder` (e.g., `D:\polls-root\032026 Christmas Party Planning Meeting\inbox\`).

#### Step 5: Process Responses

Run `/poll-process-responses` in Claude Code.

The system:
- Scans the inbox folder for response files
- Parses each response (converts times back to organizer's TZ)
- Records responses in the `Responses` section of `Poll.md`
- Moves processed files to `inbox/processed/`
- Recalculates the frontrunner (most popular choice)

`Poll.md` now shows:
```markdown
## Responses
| Date/time | Name | Email | Yes | As needed |
| --------- | ---- | ----- | --- | --------- |
| Feb 10, 2026, 11:30 | Alice Johnson | alice@company.com | 1 | 2 |
```

And updates "Current state":
```markdown
## Current state
Assessed on: Feb 10, 2026, 14:45
Count of participants who responded: 1
Count of responses: 1
Frontrunner choice: 1
Frontrunner choice overwrite:
```

#### Step 6: Check Status

Want to see where things stand? Run `/poll-status`.

Output shows:
- How many participants have responded
- Current frontrunner choice
- Who hasn't responded yet (for reminders)

#### Step 7: Send Reminders (Optional)

If the deadline is approaching and some participants haven't responded, run `/poll-remind`.

The system:
- Identifies participants who haven't responded yet
- Drafts reminder emails to `outbox/draft-reminder-*.txt`
- You send these manually

#### Step 8: Wrap Up and Communicate Results

After the deadline, run `/poll-wrap-up`.

The system:
- Calculates the final frontrunner choice
- Drafts result emails for:
  - **Respondents** — Shows the winning time and thanks them for responding
  - **Non-Respondents** — Shows the winning time and acknowledges they didn't respond

Results are drafted to `outbox/draft-results-*.txt` files.

You send these to all participants manually.

---

## Complete Workflow Reference

### Skill 1: Creating a Poll (`/poll-create`)

**Purpose**: Initialize a new poll with event details and participant information.

**Prerequisite**: Update `polls-config.json` to set `activePoll` to your new poll folder name (this folder will be created).

**How to Run**:

```
/poll-create <optional-path-to-init-file>
```

Examples:
- `/poll-create` — Reads from default location (`<pollsRoot>/Poll init.md`)
- `/poll-create D:\polls-root\TeamMeeting.md` — Reads from a specific file

**Process**:

1. **Option A - From Poll init.md**:
   - If a Poll init.md file exists, the system reads it
   - Validates all required fields
   - If any field is invalid or missing, prompts interactively for fixes
   - Creates the poll folder with all necessary files

2. **Option B - Interactive**:
   - If no Poll init.md exists, the system asks for:
     - Event title and name
     - Organizer details (name, email, title, time zone)
     - Response deadline
     - Participants (name, email, time zone)
     - Date/time choices
   - Validates each entry as you go

**Output**: A new poll folder with these files:
- `Poll.md` — Central data file (single source of truth)
- `Poll email template.md` — Invitation template
- `Poll reminder email.md` — Reminder template
- `Poll results email template - Respondent.md` — Results for those who responded
- `Poll results email template - Non-Respondent.md` — Results for those who didn't
- `outbox/` folder — Where draft emails go
- `inbox/` folder (optional) — For local response handling

**Common Options**:

- **Provide a Poll init.md file** — Fastest for similar polls (copy from previous poll, edit dates/participants)
- **Answer interactively** — Good for one-off polls or if you're unsure of details

> **Tip**: Save your Poll init.md file for future reference. Next time you create a similar poll, copy it and just update the dates and participants.

---

### Skill 2: Previewing Emails (`/poll-preview`)

**Purpose**: Preview a merged email for a specific participant before drafting to everyone.

**When to Use**: After creating a poll, before running `/poll-draft-emails`. This lets you catch template issues and verify time zone conversions.

**How to Run**:

```
/poll-preview
```

**Process**:

1. System lists all participants in the active poll
2. You select a participant
3. System merges the invitation template for that participant and displays:
   - **To**: Participant's email
   - **Subject**: Merged subject line
   - **Body**: Full email with times converted to their time zone

**Example Output**:

```
To: alice@company.com
Subject: You're invited: February Team Meeting

Dear Alice Johnson,

We're scheduling our February Team Meeting.
Please let us know your availability:

1. Feb 16, 2026, 13:00 EST  (  ) Yes  (  ) As Needed
2. Feb 16, 2026, 17:00 EST  (  ) Yes  (  ) As Needed

Respond by Feb 15, 2026.

—
Jane Smith
Engineering Manager
```

**What to Check**:

- Times are converted to the participant's time zone (EST in this example)
- TZ abbreviation appears after each time
- Participant name is correctly inserted
- Organizer title appears if provided
- Template formatting looks good

> **Tip**: Run this for at least one EST/CST/PST participant to verify time zone math!

---

### Skill 3: Drafting Invitation Emails (`/poll-draft-emails`)

**Purpose**: Generate invitation emails for all participants who haven't been polled yet.

**When to Use**: After previewing emails and confirming they look correct.

**How to Run**:

```
/poll-draft-emails
```

**Process**:

1. System identifies participants with empty "Polled on" field in Poll.md
2. Merges the invitation template for each
3. Creates draft files in `outbox/` folder (one per participant)
4. Updates Poll.md with the "Polled on" timestamp

**Output**:

Files in `outbox/`:
- `draft-poll-alice@company.com.txt`
- `draft-poll-bob@company.com.txt`
- `draft-poll-carol@company.com.txt`

Each contains:
```
To: <email>
Subject: <merged subject>

<merged body>
```

**Next Steps**:

1. Open each draft file
2. Copy the content
3. Create a new email in your email client
4. Paste the content and send

> **Note**: You must send emails manually. The system doesn't have email access — it only creates drafts. This gives you full control over who receives what when.

---

### Skill 4: Processing Responses (`/poll-process-responses`)

**Purpose**: Read response files from participants and record their votes.

**When to Use**: After participants respond to the invitation (they email back or drop files in the inbox).

**How to Run**:

```
/poll-process-responses
```

**What Responses Look Like**:

Participants create a file (or email back) with their response:

```
From: alice@company.com
Date: Feb 10, 2026, 14:30
Subject: Re: You're invited: February Team Meeting

1: Yes
2: As Needed
```

This means:
- Choice 1 → Yes, they can attend
- Choice 2 → As Needed, they could if necessary

**Process**:

1. System scans the inbox folder for response files
2. Parses each response:
   - Extracts participant email, date, and choices
   - Converts any times from participant's TZ back to organizer's TZ
3. Records in `Poll.md` under "Responses" section
4. Moves processed files to `inbox/processed/`
5. Recalculates "Current state":
   - Count of respondents
   - Count of responses (total, including repeats from same person)
   - Frontrunner choice (most "Yes" votes)

**Tallying Logic**:

- **Only the latest response per participant counts** — If someone responds twice, the first response is superseded
- **Frontrunner** is determined by:
  1. Most "Yes" votes wins
  2. If tied, "As Needed" votes break the tie
  3. If still tied, earliest choice number wins

**Example After Processing**:

Poll.md shows:
```markdown
## Responses
| Date/time | Name | Email | Yes | As needed |
| --------- | ---- | ----- | --- | --------- |
| Feb 10, 2026, 11:30 | Alice Johnson | alice@company.com | 1 | 2 |
| Feb 11, 2026, 09:15 | Bob Chen | bob@company.com | 2 | 1 |
| Feb 11, 2026, 16:20 | Carol White | carol@company.com | 1, 2 | |

## Current state
Assessed on: Feb 11, 2026, 16:30
Count of participants who responded: 3
Count of responses: 3
Frontrunner choice: 1
Frontrunner choice overwrite:
```

Interpretation:
- Alice: Yes to choice 1 (10:00 PST / 13:00 EST)
- Bob: Yes to choice 2 (14:00 PST / 17:00 EST)
- Carol: Yes to both choices
- **Choice 1 is winning** with 2 "Yes" votes (Alice and Carol)

---

### Skill 5: Sending Reminders (`/poll-remind`)

**Purpose**: Draft reminder emails for participants who haven't responded yet.

**When to Use**: When the response deadline is approaching or has passed, and some participants haven't responded.

**How to Run**:

```
/poll-remind
```

**Process**:

1. System identifies participants with empty "(last) Responded on" field
2. Merges the reminder template for each
3. Creates draft files in `outbox/draft-reminder-*.txt`
4. Updates Poll.md with the "(last) Reminded on" timestamp

**Output**:

Files like:
- `draft-reminder-bob@company.com.txt` (Bob hasn't responded)

Content:
```
To: bob@company.com
Subject: Reminder: February Team Meeting availability

Hi Bob,

We haven't received your availability for the February Team Meeting yet.
Please respond by Feb 15, 2026.

Options:
1. Feb 16, 2026, 17:00 CST  (  ) Yes  (  ) As Needed
2. Feb 16, 2026, 21:00 CST  (  ) Yes  (  ) As Needed

Thanks!
Jane Smith
Engineering Manager
```

> **Tip**: You can run this multiple times. It only reminders those who haven't responded to the original invitation.

---

### Skill 6: Checking Status (`/poll-status`)

**Purpose**: View the current state of the poll without making changes.

**When to Use**: Anytime you want a quick summary of responses, frontrunner, and who hasn't responded.

**How to Run**:

```
/poll-status
```

**Output**: A read-only summary showing:
- Total participants
- Number who have responded
- Current frontrunner choice
- List of non-respondents
- Response history (all responses received so far)

**Example Output**:

```
Poll: February Team Meeting
Organizer: Jane Smith (PST)
Active Until: Feb 15, 2026

Participants: 3
  ✓ Alice Johnson (EST) — responded Feb 10
  ✓ Bob Chen (CST) — responded Feb 11
  ✗ Carol White (PST) — no response

Frontrunner: Choice 1 (Feb 16, 2026, 10:00 PST)
  Choice 1: 2 Yes + 0 As Needed = 2 votes
  Choice 2: 0 Yes + 1 As Needed = 0.5 votes (tiebreaker)

Last Updated: Feb 11, 2026, 16:30
```

> **Tip**: Use this to quickly check progress without opening Poll.md directly.

---

### Skill 7: Wrapping Up (`/poll-wrap-up`)

**Purpose**: Finalize the poll and draft result emails to all participants.

**When to Use**: After the deadline has passed and you're ready to announce the winning time.

**How to Run**:

```
/poll-wrap-up
```

**What It Does**:

1. Determines the final winning choice:
   - Uses "Frontrunner choice" from Poll.md
   - OR uses "Frontrunner choice overwrite" if you manually set one (organizer override)
2. Merges two templates:
   - **Respondent template** — For those who responded (thanks + winning time)
   - **Non-Respondent template** — For those who didn't (winning time + gentle reminder)
3. Creates draft result files in `outbox/`

**Manual Override**: If you want to override the automatic frontrunner before running this:

1. Edit `Poll.md`
2. Find the "Current state" section
3. Set `Frontrunner choice overwrite:` to your chosen choice number (e.g., `2`)
4. Run `/poll-wrap-up` — it uses your override instead of auto-calculated frontrunner

**Output**:

Result emails for:
- Respondents: "Thanks for your input! We're going with choice 1."
- Non-respondents: "We've scheduled it for choice 1."

Each file:
```
outbox/draft-results-alice@company.com.txt
outbox/draft-results-bob@company.com.txt
outbox/draft-results-carol@company.com.txt
```

Send these manually to communicate the final decision.

> **Tip**: After running wrap-up, you can delete the contents of the `outbox/` folder (you no longer need the old drafts). The `inbox/processed/` folder keeps all responses for your records.

---

## File Formats Reference

### Poll init.md Format (Input)

The Poll init.md file is a simplified input format for creating new polls. Save it at `<pollsRoot>/Poll init.md` or pass a path to `/poll-create`.

**Structure**:

```markdown
## Poll description
Poll title: <title>
Event name: <event name>
Organizer: <full name>
Organizer email: <email>
Organizer title: <job title - optional>
Organizer time zone: <TZ abbreviation>
Deadline for Responses: <Mon DD, YYYY>

## Participants
| Name | Email | Time Zone |
| ---- | ----- | --------- |
| Name 1 | email@example.com | EST |
| Name 2 | email@example.com | PST |

## Date/time choices
1. Feb 16, 2026, 10:00
2. Feb 16, 2026, 14:00
3. Feb 17, 2026, 09:00
```

**Required Fields**:
- Poll title
- Organizer
- Organizer email
- Organizer time zone
- Deadline for Responses
- At least 1 participant (with name, email, TZ)
- At least 1 date/time choice

**Optional Fields**:
- Organizer title (defaults to empty)
- Event name (defaults to Poll title if omitted)

**Format Rules**:
- Deadline: `Mon DD, YYYY` (e.g., `Feb 28, 2026`)
- Date/time choices: `Mon DD, YYYY, HH:MM` (e.g., `Feb 16, 2026, 14:00`)
- Time zones: Valid abbreviations (EST, PST, CST, etc. — see appendix)

**Complete Example**:

```markdown
## Poll description
Poll title: Q1 Planning Meeting
Event name: Q1 Planning Meeting
Organizer: John Smith
Organizer email: john@company.com
Organizer title: Director
Organizer time zone: PST
Deadline for Responses: Feb 28, 2026

## Participants
| Name | Email | Time Zone |
| ---- | ----- | --------- |
| Alice Johnson | alice@company.com | EST |
| Bob Chen | bob@company.com | CST |
| Carol Davis | carol@company.com | PST |

## Date/time choices
1. Mar 10, 2026, 09:00
2. Mar 10, 2026, 14:00
3. Mar 11, 2026, 10:00
```

---

### Poll.md Format (Central Data File)

Poll.md is the single source of truth for all poll data. It's created by `/poll-create` and updated by other skills.

**Structure**:

```markdown
## Poll description
Poll title: <title>
Event name: <event name>
Organizer: <full name>
Organizer email: <email>
Organizer title: <job title>
Organizer time zone: <TZ abbreviation>
Deadline for Responses: <Mon DD, YYYY>

## Participants
| Name | Email | Time Zone | Polled on | (last) Responded on | (last) Reminded on | Poll Results Communicated on |
| ---- | ----- | --------- | --------- | ------------------- | ------------------ | ---------------------------- |
| Alice Johnson | alice@company.com | EST | | | | |
| Bob Chen | bob@company.com | CST | | | | |

## Date/time choices
1. Feb 16, 2026, 10:00
2. Feb 16, 2026, 14:00

## Responses
| Date/time | Name | Email | Yes | As needed |
| --------- | ---- | ----- | --- | --------- |

## Current state
Assessed on:
Count of participants who responded:
Count of responses:
Frontrunner choice:
Frontrunner choice overwrite:
```

**Column Definitions**:

- **Polled on**: When you drafted the invitation for this participant (filled by `/poll-draft-emails`)
- **(last) Responded on**: When they sent their most recent response (filled by `/poll-process-responses`)
- **(last) Reminded on**: When you last sent them a reminder (filled by `/poll-remind`)
- **Poll Results Communicated on**: When you sent them the final results (filled by `/poll-wrap-up`)

**Responses Table**:

Records every response received (even if the same person responds multiple times). Only the latest response per participant counts for tallying.

- **Yes**: Comma-separated choice numbers they said Yes to
- **As needed**: Comma-separated choice numbers marked As Needed

Example:
```markdown
| Feb 10, 2026, 11:30 | Alice Johnson | alice@company.com | 1 | 2 |
| Feb 11, 2026, 09:15 | Bob Chen | bob@company.com | 2 | 1, 3 |
| Feb 12, 2026, 14:00 | Alice Johnson | alice@company.com | 1, 2 | |
```

Alice responded twice (Feb 10 and Feb 12). Only her Feb 12 response (1, 2 = Yes) counts.

**Current State Section**:

- **Assessed on**: When the state was last calculated (filled by `/poll-process-responses`)
- **Count of participants who responded**: Unique participants with at least one response
- **Count of responses**: Total response rows (including duplicates)
- **Frontrunner choice**: Winning choice number (auto-calculated)
- **Frontrunner choice overwrite**: Organizer can override the auto-calculated frontrunner (optional)

---

### Email Template Format

All email templates use a markdown table with Item/Value columns.

**Structure**:

```markdown
| Item    | Value             |
| ------- | ----------------- |
| Subject | <subject line>    |
| Body    | <body with <br>>  |
|         |                   |
```

**Rules**:

- Subject line supports merge fields (e.g., `{$EventTitle$}`, `{$Organizer.Name$}`)
- Body supports merge fields and `<br>` for line breaks
- DateTimeChoice fields expand (e.g., `{$DateTimeChoice.1$}` → `1. Feb 16, 2026, 13:00 EST`)

**Example Invitation Template**:

```markdown
| Item    | Value |
| ------- | ----- |
| Subject | You're invited: {$EventTitle$} |
| Body    | Hi {$Participant.Name$},<br><br>We're scheduling **{$EventTitle$}**. Please let us know your availability:<br><br>{$DateTimeChoice.1$}: (  ) **Yes**  (  ) **As Needed**<br>{$DateTimeChoice.2$}: (  ) **Yes**  (  ) **As Needed**<br>...<br><br>Respond by {$ResponseDeadline$}.<br><br>—<br>{$Organizer.Name$}<br>{$Organizer.Title$} |
|         | |
```

**Available Merge Fields**:

| Field | Example | Source |
| ----- | ------- | ------ |
| `{$EventTitle$}` | Team Meeting | Poll.md → "Event name" |
| `{$Participant.Name$}` | Alice Johnson | Participants table |
| `{$Participant.Email$}` | alice@company.com | Participants table |
| `{$DateTimeChoice.1$}` | Feb 16, 2026, 13:00 EST | Converted to participant's TZ |
| `{$DateTimeChoice.2$}` | Feb 16, 2026, 17:00 EST | Converted to participant's TZ |
| `{$ResponseDeadline$}` | Feb 15, 2026 | Poll.md |
| `{$NowDateTime$}` | Feb 10, 2026, 14:30 | Current time |
| `{$SelectedDateTime$}` | Feb 16, 2026, 13:00 EST | Winning choice (results only) |
| `{$Organizer.Name$}` | Jane Smith | Poll.md |
| `{$Organizer.Title$}` | Engineering Manager | Poll.md |

**DateTimeChoice Expansion**:

The `...` pattern in templates expands to cover all choices:

Template:
```
{$DateTimeChoice.1$}: (  ) Yes<br>
{$DateTimeChoice.2$}: (  ) Yes<br>
...
```

Expands to (if 4 choices):
```
1. Feb 16, 2026, 13:00 EST: (  ) Yes
2. Feb 16, 2026, 17:00 EST: (  ) Yes
3. Feb 17, 2026, 11:00 EST: (  ) Yes
4. Feb 17, 2026, 13:00 EST: (  ) Yes
```

---

### Draft Email File Format

Draft email files are plain text with headers and body.

**Structure**:

```
To: <email>
Subject: <subject>

<body text>
```

**Example**:

```
To: alice@company.com
Subject: You're invited: February Team Meeting

Hi Alice Johnson,

We're scheduling our February Team Meeting. Please let us know
your availability for:

1. Feb 16, 2026, 13:00 EST  (  ) Yes  (  ) As Needed
2. Feb 16, 2026, 17:00 EST  (  ) Yes  (  ) As Needed

Respond by Feb 15, 2026.

—
Jane Smith
Engineering Manager
```

---

### Response File Format (Input)

Participants create response files in this format (or email the content back).

**Structure**:

```
From: <email>
Date: <date/time>
Subject: Re: <subject>

<choice>: <Yes|As Needed>
<choice>: <Yes|As Needed>
```

**Example**:

```
From: alice@company.com
Date: Feb 10, 2026, 14:30
Subject: Re: You're invited: February Team Meeting

1: Yes
2: As Needed
```

**Rules**:

- Each line after blank line is `<choice number>: <Yes or As Needed>`
- Choices can be in any order (2, 1, 3 is fine)
- Times in response are in the participant's local time zone
- System converts back to organizer's TZ before recording in Poll.md

---

## Time Zone Handling

### Core Concept

All times in Poll.md are stored in the **organizer's time zone**. When emails go out to participants in different zones, times are automatically converted.

### Conversion Direction

- **Outbound** (drafting emails): Organizer TZ → Participant TZ
- **Inbound** (processing responses): Participant TZ → Organizer TZ

### Supported Time Zones

| Abbreviation | Name | UTC Offset |
| ------------ | ---- | ---------- |
| HST | Hawaii Standard Time | UTC-10 |
| AKST | Alaska Standard Time | UTC-9 |
| PST | Pacific Standard Time | UTC-8 |
| PDT | Pacific Daylight Time | UTC-7 |
| MST | Mountain Standard Time | UTC-7 |
| MDT | Mountain Daylight Time | UTC-6 |
| CST | Central Standard Time | UTC-6 |
| CDT | Central Daylight Time | UTC-5 |
| EST | Eastern Standard Time | UTC-5 |
| EDT | Eastern Daylight Time | UTC-4 |
| AST | Atlantic Standard Time | UTC-4 |
| NST | Newfoundland Std Time | UTC-3:30 |
| NDT | Newfoundland Daylight | UTC-2:30 |

### Conversion Example

**Setup**:
- Organizer: Jane (PST, UTC-8)
- Participant: Alice (EST, UTC-5)
- Event time: Feb 16, 2026, 10:00 PST

**Outbound Conversion** (PST → EST):

1. Difference: UTC-5 minus UTC-8 = +3 hours
2. 10:00 PST + 3 hours = 13:00 EST
3. Alice sees: "Feb 16, 2026, 13:00 EST"

**Inbound Conversion** (EST → PST):

If Alice responds "I can do Feb 16, 2026, 13:00 EST":

1. Difference: UTC-8 minus UTC-5 = -3 hours
2. 13:00 EST - 3 hours = 10:00 PST
3. Poll.md records: "Feb 16, 2026, 10:00 PST"

### Time Format

All displayed times use this format:

```
<Mon> <DD>, <YYYY>, <HH:MM> <TZ>
```

Examples:
- Feb 16, 2026, 10:00 PST
- Feb 16, 2026, 13:00 EST
- Mar 17, 2026, 14:30 CST

---

## Configuration

### polls-config.json

Located at the root of the polls repository.

**Structure**:

```json
{
  "pollsRoot": "D:\\polls-root",
  "activePoll": "032026 Christmas Party Planning Meeting",
  "inboxFolder": "D:\\polls-root\\032026 Christmas Party Planning Meeting\\inbox"
}
```

**Fields**:

- **pollsRoot** — Absolute path to the directory containing all poll folders
  - Example: `D:\polls-root`
  - All polls live in subdirectories here

- **activePoll** — Name of the currently active poll (just the folder name, not a full path)
  - Example: `032026 Christmas Party Planning Meeting`
  - Full path is resolved as `<pollsRoot>/<activePoll>/`

- **inboxFolder** — Absolute path where participant response files arrive
  - Example: `D:\polls-root\032026 Christmas Party Planning Meeting\inbox`
  - Can be different for each poll, or shared across polls

### Switching Between Polls

To work on a different poll:

1. Open `polls-config.json`
2. Change the `activePoll` field to the new poll's folder name
3. Update `inboxFolder` if needed
4. Save the file
5. All slash commands now operate on the new active poll

Example:

```json
{
  "pollsRoot": "D:\\polls-root",
  "activePoll": "032026 Q1 Planning Meeting",
  "inboxFolder": "D:\\polls-root\\032026 Q1 Planning Meeting\\inbox"
}
```

---

## Tips and Best Practices

### Organizing Poll Folders

Use a naming convention that includes the date and event name:

```
polls-root/
  022026 Team Meeting/
  032026 Christmas Party Planning Meeting/
  032026 Q1 Planning Meeting/
  042026 Board Meeting/
```

This makes it easy to find historical polls and understand the timeline.

### Reusing Poll init.md

After creating a poll, save the Poll init.md file. For the next similar poll:

1. Copy the previous Poll init.md
2. Update:
   - Poll title (include new date)
   - Event name (if different)
   - Organizer time zone (if needed)
   - Deadline for Responses
   - Participants (add/remove/update)
   - Date/time choices (new dates)
3. Save as `<pollsRoot>/Poll init.md`
4. Run `/poll-create`

This is much faster than answering interactive questions!

### Preview Before Drafting

Always run `/poll-preview` for at least one participant in a different time zone before running `/poll-draft-emails`. This catches:

- Template formatting issues
- Time zone conversion errors
- Missing merge fields
- Typos in organizer name/title

It takes 30 seconds and can save you from sending 50 incorrect emails!

### Processing Responses Regularly

Run `/poll-process-responses` frequently (even if there are no new responses). This:

- Updates the frontrunner in real-time
- Keeps the "Current state" fresh
- Lets you monitor progress with `/poll-status`

You can safely run it multiple times — it's idempotent (same result).

### Handling Late Responses

If someone responds after you've sent results:

1. Manually add their response to the `Responses` table in Poll.md (copy the format from existing rows)
2. Run `/poll-process-responses` to recalculate the frontrunner
3. The new frontrunner appears in `/poll-status`

You can decide whether to notify participants if the frontrunner changed.

### Using Frontrunner Overwrite

If you disagree with the automatic frontrunner choice (e.g., "logically it should be choice 2 even though choice 1 got one more vote"):

1. Edit Poll.md
2. Find the "Current state" section
3. Set `Frontrunner choice overwrite: 2` (your chosen choice number)
4. Run `/poll-wrap-up` — it uses your override
5. All results emails will show your chosen time

The automatic frontrunner remains visible, so you have a record of what the system calculated.

### Testing with a Sample Poll

Before using the system in production:

1. Create a small test poll with 2-3 people and 2 choices
2. Walk through all 7 skills
3. Verify email formatting, time zone conversions, and response parsing
4. Check that Poll.md updates correctly at each step
5. Review the final result emails

This builds confidence before coordinating your company's all-hands meeting!

---

## Troubleshooting

### Problem: Poll init.md Validation Failed

**Symptoms**: When running `/poll-create`, you get errors like "Organizer email is missing" or "Choice 2 has invalid time format".

**Solution**:

1. Check the file is in the right location (`<pollsRoot>/Poll init.md`)
2. Verify format matches the canonical Poll init.md format (check Appendix A)
3. Common issues:
   - Missing section header (e.g., missing `## Participants`)
   - Wrong date format (should be `Mon DD, YYYY`, not `2026-02-16`)
   - Wrong time format (should be `HH:MM`, not `10:30 AM`)
   - Invalid time zone abbreviation (must match supported list in appendix)
4. Fix one issue at a time and try again
5. If still stuck, run `/poll-create` with no Poll init.md and answer interactively — the system will validate as you go

---

### Problem: Emails Show Incorrect Time Zone

**Symptoms**: Alice (EST) gets an email showing times in PST instead of EST.

**Solution**:

1. Check that Alice's "Time Zone" in Poll.md is set to EST (not PST or blank)
2. Verify the time zone abbreviation is in the supported list (Appendix B)
3. Run `/poll-preview` for Alice to see the exact output
4. If still wrong, edit Poll.md and correct Alice's time zone
5. Re-run `/poll-draft-emails` to generate new drafts

---

### Problem: Response File Not Being Processed

**Symptoms**: You put a response file in the inbox folder, but running `/poll-process-responses` doesn't pick it up.

**Solution**:

1. Check that the file is in the correct `inboxFolder` (check `polls-config.json`)
2. Verify the file format matches the canonical response format:
   - First line: `From: <email>`
   - Second line: `Date: <date/time>`
   - Third line: `Subject: Re: ...`
   - Blank line
   - Choice lines: `<number>: <Yes|As Needed>`
3. Check that the From: email matches a participant in Poll.md
4. Ensure there's a blank line between headers and choices
5. Try manually adding a test response to Poll.md's Responses table to verify the format is right

---

### Problem: Frontrunner Choice Seems Wrong

**Symptoms**: Choice 1 has 2 "Yes" votes and 1 "As Needed". Choice 2 has 1 "Yes" vote. But choice 2 is showing as frontrunner.

**Solution**:

1. Run `/poll-status` to see the detailed vote count
2. Tallying rules:
   - Count "Yes" votes first → Choice 1 wins (2 vs 1)
   - If tied, use "As Needed" as tiebreaker
   - If still tied, pick the earliest choice number
3. If the votes don't match what you see in `/poll-status`, check the Responses table in Poll.md
4. Remember: **only the latest response per participant counts** — if someone responded twice, the first is ignored
5. If the frontrunner is still wrong, manually set `Frontrunner choice overwrite: 1` and re-run `/poll-wrap-up`

---

### Problem: Same Participant Has Multiple Responses

**Symptoms**: Alice appears twice in the Responses table.

**This is normal!** It happens when someone responds multiple times. Only the latest response counts for tallying. You can:

1. Check both responses in Poll.md to see what changed
2. The "(last) Responded on" field in the Participants table shows the most recent response time
3. When tallying, only Alice's most recent response is counted
4. All responses are kept for the audit trail — this is intentional

---

### Problem: Can't Send Draft Emails

**Symptoms**: You have draft email files but aren't sure how to send them.

**Solution**:

The Polls App creates drafts but doesn't send emails (it doesn't have email access). To send:

1. Open a draft file (e.g., `draft-poll-alice@company.com.txt`)
2. Copy the content (everything after the blank line after Subject:)
3. Open your email client (Outlook, Gmail, etc.)
4. Create a new email
5. Paste the content into the body
6. For the subject, use the "Subject:" line from the draft
7. Send

Alternatively, if your email client supports plain text files, you might be able to import the draft directly (varies by email provider).

---

### Problem: Time Conversion Math Looks Wrong

**Symptoms**: PST 10:00 should be 13:00 EST (3-hour difference), but you're seeing a different result.

**Solution**:

1. Verify both time zones are correct (check Appendix B for UTC offsets)
2. Check the sign of the math:
   - EST (UTC-5) is **east** of PST (UTC-8), so east times are **earlier** (more negative)
   - Wait, that's backwards. EST is 3 hours **ahead** of PST
   - 10:00 PST (UTC-8) = 18:00 UTC
   - 18:00 UTC = 13:00 EST (UTC-5)
   - So 10:00 PST = 13:00 EST ✓
3. Use the conversion formula: `target_offset - source_offset`
   - From PST to EST: (-5) - (-8) = +3, so add 3 hours
4. If the system is showing something different, run `/poll-preview` and check the actual output
5. Report any discrepancies (it might be a bug!)

---

## Appendices

### Appendix A: Complete Poll init.md Example

Here's a fully populated example you can copy and customize:

```markdown
## Poll description
Poll title: Q1 Planning Session 2026
Event name: Q1 Planning Session
Organizer: Janet Rodriguez
Organizer email: janet.rodriguez@company.com
Organizer title: VP of Product
Organizer time zone: PST
Deadline for Responses: Mar 05, 2026

## Participants
| Name | Email | Time Zone |
| ---- | ----- | --------- |
| Alice Johnson | alice.johnson@company.com | EST |
| Bob Chen | bob.chen@company.com | CST |
| Carol Davis | carol.davis@company.com | PST |
| David Smith | david.smith@company.com | EST |
| Elena Martinez | elena.martinez@company.com | CST |

## Date/time choices
1. Mar 10, 2026, 09:00
2. Mar 10, 2026, 14:00
3. Mar 11, 2026, 10:00
4. Mar 12, 2026, 15:00
```

### Appendix B: Time Zone Reference

**Quick Lookup Table**:

| Abbreviation | Name | UTC Offset | Notes |
| ------------ | ---- | ---------- | ----- |
| HST | Hawaii Standard Time | UTC-10 | Always standard (no DST) |
| AKST | Alaska Standard Time | UTC-9 | Use AKDT in summer |
| PST | Pacific Standard Time | UTC-8 | Use PDT Mar-Nov |
| PDT | Pacific Daylight Time | UTC-7 | |
| MST | Mountain Standard Time | UTC-7 | Use MDT Mar-Nov |
| MDT | Mountain Daylight Time | UTC-6 | |
| CST | Central Standard Time | UTC-6 | Use CDT Mar-Nov |
| CDT | Central Daylight Time | UTC-5 | |
| EST | Eastern Standard Time | UTC-5 | Use EDT Mar-Nov |
| EDT | Eastern Daylight Time | UTC-4 | |
| AST | Atlantic Standard Time | UTC-4 | Canada (use ADT in summer) |
| NST | Newfoundland Std Time | UTC-3:30 | Canada (use NDT in summer) |
| NDT | Newfoundland Daylight | UTC-2:30 | |

**US Time Zone Map**:

```
Alaska (AKST/AKDT)  Hawaii (HST)
    UTC-9/8            UTC-10

Pacific (PST/PDT)   Mountain (MST/MDT)   Central (CST/CDT)   Eastern (EST/EDT)
UTC-8/-7            UTC-7/-6             UTC-6/-5            UTC-5/-4
```

### Appendix C: All Merge Fields Reference

**Complete Field List**:

| Field | Scope | Example | Notes |
| ----- | ----- | ------- | ----- |
| `{$EventTitle$}` | All | Team Meeting | From Poll.md "Event name" |
| `{$Participant.Name$}` | All | Alice Johnson | Current participant only |
| `{$Participant.Email$}` | All | alice@company.com | Current participant only |
| `{$DateTimeChoice.1$}` | Invitation, Reminder, Results | 1. Feb 16, 2026, 13:00 EST | Converted to participant TZ |
| `{$DateTimeChoice.2$}` | Invitation, Reminder, Results | 2. Feb 16, 2026, 17:00 EST | Converted to participant TZ |
| `{$DateTimeChoice.N$}` | Invitation, Reminder, Results | (any choice) | Expands based on template |
| `{$ResponseDeadline$}` | All | Feb 15, 2026 | From Poll.md |
| `{$NowDateTime$}` | Any | Feb 10, 2026, 14:30 | Organizer TZ |
| `{$SelectedDateTime$}` | Results only | Feb 16, 2026, 13:00 EST | Converted to participant TZ |
| `{$Organizer.Name$}` | All | Jane Smith | From Poll.md |
| `{$Organizer.Title$}` | All | Engineering Manager | From Poll.md (may be empty) |

### Appendix D: Poll Folder Structure Diagram

```
<pollsRoot>/
├── 022026 Team Meeting/
│   ├── Poll.md                                         [central data file]
│   ├── Poll email template.md                          [invitation template]
│   ├── Poll reminder email.md                          [reminder template]
│   ├── Poll results email template - Respondent.md     [results for respondents]
│   ├── Poll results email template - Non-Respondent.md [results for non-respondents]
│   ├── outbox/                                         [draft emails]
│   │   ├── draft-poll-alice@company.com.txt
│   │   ├── draft-poll-bob@company.com.txt
│   │   ├── draft-reminder-bob@company.com.txt
│   │   └── draft-results-alice@company.com.txt
│   └── inbox/
│       ├── response-alice.txt
│       ├── response-bob.txt
│       └── processed/                                  [moved after processing]
│           ├── response-alice.txt
│           └── response-bob.txt
│
├── 032026 Christmas Party/
│   ├── Poll.md
│   ├── Poll email template.md
│   ├── ... [same structure]
│
└── 032026 Q1 Planning Meeting/
    ├── Poll.md
    ├── ... [same structure]
```

---

## Final Checklist

Before using the Polls App for a real event:

- [ ] Read the Introduction section to understand the concept
- [ ] Ensure `polls-config.json` is configured correctly
- [ ] Create a small test poll and walk through all 7 skills
- [ ] Verify email formatting with `/poll-preview`
- [ ] Check that time zone conversions match your expectations
- [ ] Understand how responses are tallied
- [ ] Know how to manually edit Poll.md if needed
- [ ] Have a plan for sending draft emails manually
- [ ] Understand the frontrunner override feature

---

Good luck coordinating your polls! 🎉
