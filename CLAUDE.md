# Polls Service

A command-line poll scheduling service that runs entirely through Claude Code skills (slash commands). It helps organizers coordinate meeting times across participants in different time zones. There is no UI — all interaction happens via slash commands that read/write markdown files.

## Configuration

- **Config file**: `polls-config.json` in the repo root
- **Fields**:
  - `pollsRoot` — absolute path to the directory containing all poll folders
  - `activePoll` — name of the currently active poll subfolder
  - `inboxFolder` — absolute path to the folder where response files arrive

The active poll folder is resolved as `<pollsRoot>/<activePoll>/`.

## Domain Model

### Poll Lifecycle
1. **Create** (`/poll-create`) — organizer provides details; a poll folder with `Poll.md` and email templates is created
2. **Draft & Send** (`/poll-draft-emails`) — invitation emails are drafted to `outbox/` for each participant
3. **Preview** (`/poll-preview`) — organizer previews a merged email before drafting
4. **Remind** (`/poll-remind`) — reminder emails are drafted for non-respondents
5. **Process Responses** (`/poll-process-responses`) — incoming response files are parsed and recorded in `Poll.md`
6. **Status** (`/poll-status`) — tally votes and identify the frontrunner
7. **Wrap Up** (`/poll-wrap-up`) — final tally, results emails drafted to all participants

### Key Rules
- **`Poll.md` is the single source of truth** for all poll data.
- **All date/times in `Poll.md` are stored in the organizer's time zone.**
- **Only the latest response per participant counts** when tallying. Earlier responses from the same participant are superseded.
- Date/time choice numbers in responses refer to the numbered list in the "Date/time choices" section of `Poll.md`.

## File & Folder Conventions

### Poll Folder Structure
```
<pollsRoot>/
  <pollName>/
    Poll.md                                         # Central data file
    Poll email template.md                          # Invitation template
    Poll reminder email.md                          # Reminder template
    Poll results email template - Respondent.md     # Results for respondents
    Poll results email template - Non-Respondent.md # Results for non-respondents
    outbox/                                         # Draft emails to send
      draft-poll-<email>.txt
      draft-reminder-<email>.txt
      draft-results-<email>.txt
    inbox/                                          # (optional, or use global inboxFolder)
      processed/                                    # Processed response files
```

### Draft Email File Format
Each draft `.txt` file in `outbox/` has this structure:
```
To: <participant email>
Subject: <merged subject line>

<merged body text>
```

### Response File Format
Response files in the inbox have this structure:
```
From: <participant email>
Date: <date/time>
Subject: Re: ...

<number>: <Yes|As Needed>
<number>: <Yes|As Needed>
```

## Template Merge Syntax

Templates use `{$Field$}` merge fields. Available fields:
- `{$EventTitle$}` — the event name from Poll.md
- `{$Participant.Name$}` — participant's name
- `{$Participant.Email$}` — participant's email
- `{$DateTimeChoice.N$}` — the Nth date/time choice, converted to the participant's time zone with TZ abbreviation appended (e.g., `1. Feb 16, 2026, 13:00 EST`)
- `{$ResponseDeadline$}` — the deadline date from Poll.md
- `{$NowDateTime$}` — current date/time at merge time
- `{$SelectedDateTime$}` — the winning date/time choice (used in results templates), converted to the participant's time zone
- `{$Organizer.Name$}` — organizer's name
- `{$Organizer.Title$}` — organizer's title

In templates, `{$DateTimeChoice.1$}`, `{$DateTimeChoice.2$}`, `...` indicates the pattern repeats for all choices. During merge, expand to cover all date/time choices in the poll.

## Time Zone Conversion

- Date/times in `Poll.md` are in the **organizer's time zone**.
- When merging templates for a participant, convert each date/time to the **participant's time zone** and append the TZ abbreviation.
- When processing responses, convert participant-local times **back** to the organizer's time zone before storing in `Poll.md`.
- See `.claude/skills/poll-shared/tz-conversion.md` for supported TZ abbreviations and offset table.

## Shared Skill References

All skills should consult these shared reference files:
- `.claude/skills/poll-shared/tz-conversion.md` — TZ conversion rules and offset table
- `.claude/skills/poll-shared/poll-file-format.md` — canonical Poll.md format
- `.claude/skills/poll-shared/template-merge.md` — merge field reference and expansion rules

## Gmail Integration (Optional)

The polls system includes **optional** Gmail integration for automated email sending and response collection. This is built on top of the file-based system and does not replace it.

### Architecture

- **MCP Server**: `@gongrzhe/server-gmail-autoauth-mcp` (Google's Gmail API wrapper)
- **Authentication**: OAuth2 with refresh tokens (one-time setup via browser)
- **Credentials**: Stored globally in `~/.gmail-mcp/credentials.json` (not in project)
- **Fallback**: Manual workflow always available if Gmail integration disabled

### Configuration

Gmail integration uses additional fields in `polls-config.json`:
- `pollsEmailSubjectPrefix` — Subject prefix to filter poll emails (e.g., "Poll Response:")
- `pollsEmailLabel` — Gmail label for poll responses (e.g., "Polls/Responses")

### Skills

Two new skills enable automated workflow:
- `/poll-send-emails` — Send draft emails via Gmail API
  - Optional flags: `--dry-run`, `--type poll|reminder|results`
  - Moves sent drafts to `outbox/sent/` folder
- `/poll-fetch-responses` — Retrieve poll responses from Gmail
  - Optional flags: `--keep-unread`, `--all`
  - Saves responses as text files to inbox folder

### Security

- Refresh tokens are long-lived (no expiration unless user revokes)
- Short-lived access tokens auto-refresh transparently
- Credentials stored globally at `~/.gmail-mcp/` (outside git repo)
- OAuth2 scopes limited to `gmail.send` and `gmail.readonly`

### Setup Instructions

See [USER-GUIDE.md](USER-GUIDE.md#gmail-integration) for detailed setup instructions including:
- Creating Google Cloud project
- Enabling Gmail API
- Creating OAuth2 credentials
- One-time authentication
- Troubleshooting common errors

## Documentation

- **USER-GUIDE.md** — Comprehensive guide for end users: complete workflow documentation, file formats, time zone handling, Gmail setup, tips, and troubleshooting
- **QUICK-REFERENCE.md** — One-page cheat sheet with command summary, lifecycle diagram, merge fields, and common workflows
