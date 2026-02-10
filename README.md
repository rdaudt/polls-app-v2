# Polls App v2

A command-line poll scheduling service that helps organizers coordinate meeting times across participants in different time zones.

Built entirely with Claude Code skills (slash commands) — no UI required. All interaction happens through commands that read and write markdown files.

## Features

- 📧 **Email-based polling workflow** — invite participants and collect responses via email
- 🌍 **Automatic time zone conversion** — handle participants across multiple time zones
- 📝 **Markdown-based templates** — customizable email templates with merge fields
- 🎯 **7 specialized skills** — dedicated commands for each step of the workflow
- 📊 **Vote tallying** — automatic result calculation and frontrunner tracking
- 📖 **Comprehensive documentation** — detailed guides, quick references, and examples

## How It Works

This app runs entirely through Claude Code slash commands. There is no web UI — all interaction happens via `/poll-*` commands that read and write markdown files in your local polls directory.

### Poll Lifecycle

1. **Create** (`/poll-create`) — Set up a new poll with participant list, date/time choices, and response deadline
2. **Draft & Send** (`/poll-draft-emails`) — Generate invitation emails for each participant (with automatic time zone conversion)
3. **Preview** (`/poll-preview`) — Review a merged email before drafting
4. **Collect Responses** — Participants reply to emails with their choices (manual email handling)
5. **Process** (`/poll-process-responses`) — Parse incoming response files and update poll results
6. **Remind** (`/poll-remind`) — Draft reminder emails for participants who haven't responded yet
7. **Check Status** (`/poll-status`) — View current results and identify the frontrunner
8. **Wrap Up** (`/poll-wrap-up`) — Finalize the poll and draft results emails to all participants

## Quick Start

### Installation

1. Clone this repository:
   ```bash
   git clone https://github.com/YOUR_USERNAME/polls-app-v2.git
   cd polls-app-v2
   ```

2. Copy the example configuration:
   ```bash
   cp polls-config.example.json polls-config.json
   ```

3. Edit `polls-config.json` and set:
   - `pollsRoot` — absolute path where you'll store all polls
   - `activePoll` — name of the current poll (e.g., "022026 Monthly Meeting")
   - `inboxFolder` — where response files will be placed

### Create Your First Poll

```
/poll-create
```

The command will:
1. Prompt for event title, organizer info, participant list, date/time choices, and response deadline
2. Create a poll folder with `Poll.md` (the central data file) and email templates
3. Save all data in the organizer's time zone

### Draft Invitation Emails

```
/poll-draft-emails
```

This generates invitation emails to `outbox/draft-poll-*.txt` with:
- Automatic time zone conversion for each participant
- Filled merge fields from your templates
- Ready to copy and send via your email client

### Process Responses

Save response files from participants to your inbox, then run:

```
/poll-process-responses
```

This parses response emails and updates `Poll.md` with participant choices.

### Check Results

```
/poll-status
```

See current vote tallies and which date/time is winning.

### Finalize and Distribute Results

```
/poll-wrap-up
```

Generates results emails to all participants (separate templates for respondents and non-respondents).

## Documentation

- **[USER-GUIDE.md](USER-GUIDE.md)** — Comprehensive guide with detailed workflows, file formats, time zone handling, troubleshooting, and examples
- **[QUICK-REFERENCE.md](QUICK-REFERENCE.md)** — One-page cheat sheet with command summary, merge fields, and common tasks
- **[CLAUDE.md](CLAUDE.md)** — Project-level context and design decisions

## Configuration

The `polls-config.json` file defines where your polls live:

```json
{
  "pollsRoot": "C:\\Users\\YourName\\Documents\\Polls",
  "activePoll": "022026 Team Offsite",
  "inboxFolder": "C:\\Users\\YourName\\Documents\\Polls\\022026 Team Offsite\\inbox"
}
```

**Note:** Use `polls-config.example.json` as a template and create your own `polls-config.json` with your local paths. The `polls-config.json` file is excluded from version control to protect your local setup.

## File Structure

```
polls-app-v2/
├── .claude/
│   └── skills/
│       ├── poll-create/              # Create new polls
│       │   └── SKILL.md
│       ├── poll-draft-emails/        # Draft invitation emails
│       │   └── SKILL.md
│       ├── poll-preview/             # Preview merged emails
│       │   └── SKILL.md
│       ├── poll-process-responses/   # Process participant responses
│       │   └── SKILL.md
│       ├── poll-remind/              # Draft reminders
│       │   └── SKILL.md
│       ├── poll-status/              # View current results
│       │   └── SKILL.md
│       ├── poll-wrap-up/             # Finalize and send results
│       │   └── SKILL.md
│       └── poll-shared/              # Shared reference files
│           ├── poll-file-format.md
│           ├── tz-conversion.md
│           ├── template-merge.md
│           └── poll-init-format.md
├── CLAUDE.md                         # Project instructions
├── USER-GUIDE.md                     # Comprehensive user guide
├── QUICK-REFERENCE.md                # Command cheat sheet
├── README.md                         # This file
├── LICENSE                           # MIT License
├── polls-config.example.json         # Configuration template
└── .gitignore                        # Git ignore rules
```

## Key Concepts

### Single Source of Truth

`Poll.md` is the central data file for each poll. It contains:
- Event details (title, organizer, response deadline)
- Participant list with names, emails, and time zones
- Date/time choices (in organizer's time zone)
- Vote tallies and response status

### Time Zone Handling

- All dates/times in `Poll.md` are stored in the **organizer's time zone**
- When drafting emails, each participant's date/time choices are **automatically converted** to their local time zone
- When processing responses, participant times are **converted back** to the organizer's time zone
- Time zone abbreviations are appended to all converted times (e.g., "Feb 16, 2026, 13:00 EST")

### Template Merge Fields

Email templates use `{$Field$}` syntax to insert personalized data:

- `{$EventTitle$}` — Event name
- `{$Participant.Name$}` — Recipient's name
- `{$Participant.Email$}` — Recipient's email
- `{$DateTimeChoice.1$}`, `{$DateTimeChoice.2$}`, etc. — Date/time choices (auto-converted to participant's TZ)
- `{$ResponseDeadline$}` — Deadline date
- `{$Organizer.Name$}` — Organizer's name
- `{$Organizer.Title$}` — Organizer's title (e.g., "Meeting Coordinator")

See [USER-GUIDE.md](USER-GUIDE.md) for complete field reference.

### Response Processing

Participants respond to invitation emails with simple replies:

```
From: participant@example.com
Date: Feb 9, 2026, 10:30 AM

1: Yes
2: As Needed
3: Yes
```

Each line specifies their response (`Yes` or `As Needed`) for each date/time choice. The system records only the latest response from each participant, superseding any earlier replies.

## Requirements

- **Claude Code CLI** — Download from [claude.com/claude-code](https://claude.com/claude-code)
- **Polls directory** — A folder on your system to store poll data
- **Email client** — For sending and receiving poll emails (manual workflow)

## Tips & Tricks

### Bulk Initialization

Use the `/poll-create` command with an optional path to a `Poll init.md` file to pre-populate poll details:

```
/poll-create /path/to/Poll init.md
```

This is useful when creating polls with standard participants or recurring events.

### Dry Run

Before sending invitation emails, use `/poll-preview` to check how a participant will see their email:

```
/poll-preview
```

This shows the merged result with all fields filled in and times converted.

### Manual Email Workflow

The app generates draft emails but doesn't send them automatically. This gives you full control:

1. Review drafts in `outbox/`
2. Copy content into your email client
3. Send to participants
4. Move response files to your inbox folder
5. Run `/poll-process-responses` to tally votes

This approach works with any email provider and keeps everything under your control.

## Roadmap

- [ ] Yahoo Mail integration for automated email fetching/sending
- [ ] Support for additional email providers (Gmail, Outlook, etc.)
- [ ] Web-based UI (optional)
- [ ] Calendar integration (iCal export)

## License

MIT License — see [LICENSE](LICENSE) file for details. Copyright 2026.

## Contributing

This project is under active development. Contributions, issues, and feature requests are welcome!

## About

Built with [Claude Code](https://claude.com/claude-code) — Anthropic's CLI for AI-assisted software engineering.

---

**Have questions?** Check the [USER-GUIDE.md](USER-GUIDE.md) for detailed documentation or the [QUICK-REFERENCE.md](QUICK-REFERENCE.md) for a command cheat sheet.
