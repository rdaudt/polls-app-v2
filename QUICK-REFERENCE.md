# Polls App Quick Reference

## Command Summary

| Command | Purpose | When to Use |
| ------- | ------- | ----------- |
| `/poll-create` | Initialize a new poll | Start of workflow — create poll folder and files |
| `/poll-preview` | Preview merged email for one participant | Before drafting — verify formatting & time zones |
| `/poll-draft-emails` | Generate invitation emails for all participants | Ready to send invitations |
| `/poll-gmail-setup` | One-time Gmail OAuth2 authentication | Once per system — enable Gmail integration (optional) |
| `/poll-send-emails` | Send draft emails automatically via Gmail | [Optional] If Gmail integration enabled |
| `/poll-process-responses` | Read response files and tally votes | Responses arrive from participants |
| `/poll-fetch-responses` | Fetch responses from Gmail automatically | [Optional] If Gmail integration enabled |
| `/poll-remind` | Draft reminder emails for non-respondents | Approaching deadline, some haven't responded |
| `/poll-status` | View current poll status (read-only) | Anytime — check progress without editing |
| `/poll-wrap-up` | Finalize poll and draft result emails | After deadline — communicate winner |

---

## Poll Lifecycle Flowchart

```
START
  │
  ├─→ [Once] /poll-gmail-setup (Optional)
  │   Enable Gmail integration (one-time setup)
  │   ↓
  ├─→ /poll-create
  │   Create poll folder & files
  │   ↓
  ├─→ /poll-preview (Optional but recommended!)
  │   Verify email formatting & time zones
  │   ↓
  ├─→ /poll-draft-emails
  │   Generate invitation emails
  │   ↓
  │   ├─ Manual: Copy/paste to email client
  │   └─ Gmail: /poll-send-emails [--dry-run]
  │   ↓
  │   Participants respond...
  │   ↓
  │   ├─ Manual: Save responses to inbox folder
  │   └─ Gmail: /poll-fetch-responses [--all]
  │   ↓
  ├─→ /poll-process-responses (Repeat as responses arrive)
  │   Record votes & update frontrunner
  │   ↓
  ├─→ /poll-status (Optional, repeat anytime)
  │   Check progress without making changes
  │   ↓
  ├─→ /poll-remind (Optional)
  │   Draft reminder emails
  │   ↓
  │   ├─ Manual: Copy/paste to email client
  │   └─ Gmail: /poll-send-emails --type reminder
  │   ↓
  ├─→ /poll-wrap-up
  │   Finalize & draft result emails
  │   ↓
  │   ├─ Manual: Copy/paste to email client
  │   └─ Gmail: /poll-send-emails --type results
  │   ↓
  END
```

---

## Essential File Paths

```
<pollsRoot>/                          [Config: pollsRoot]
├── Poll init.md                      [Input for /poll-create]
├── <activePoll>/                     [Current active poll]
│   ├── Poll.md                       [Single source of truth]
│   ├── outbox/                       [Draft email outputs]
│   │   ├── draft-poll-*.txt
│   │   ├── draft-reminder-*.txt
│   │   ├── draft-results-*.txt
│   │   └── sent/                     [Sent emails (Gmail)]
│   └── inbox/
│       ├── *.txt                     [Response files (input)]
│       └── processed/                [After /poll-process-responses]
```

**Key Locations**:
- Config: `polls-config.json` (repo root)
- Current poll data: `<pollsRoot>/<activePoll>/Poll.md`
- Inbox: `<inboxFolder>/` (check `polls-config.json`)
- Templates: `<pollsRoot>/<activePoll>/Poll *.md`

---

## Poll.md Structure at a Glance

```markdown
## Poll description
Poll title: ...
Event name: ...
Organizer: ...
Organizer email: ...
Organizer title: ...
Organizer time zone: [EST|PST|CST|etc]
Deadline for Responses: Mon DD, YYYY

## Participants
| Name | Email | Time Zone | Polled on | (last) Responded on | (last) Reminded on | Poll Results Communicated on |
| ---- | ----- | --------- | --------- | ------------------- | ------------------ | ---------------------------- |

## Date/time choices
1. Mon DD, YYYY, HH:MM
2. Mon DD, YYYY, HH:MM

## Responses
| Date/time | Name | Email | Yes | As needed |
| --------- | ---- | ----- | --- | --------- |

## Current state
Assessed on: [auto-filled]
Count of participants who responded: [auto-filled]
Count of responses: [auto-filled]
Frontrunner choice: [auto-filled or can override]
Frontrunner choice overwrite: [optional organizer override]
```

---

## Poll init.md Template

Quick template for creating new polls:

```markdown
## Poll description
Poll title: <your title>
Event name: <event name>
Organizer: <your name>
Organizer email: <your email>
Organizer title: <job title>
Organizer time zone: <EST|PST|CST|EDT|PDT|CDT|etc>
Deadline for Responses: Mon DD, YYYY

## Participants
| Name | Email | Time Zone |
| ---- | ----- | --------- |
| Person 1 | email@example.com | EST |
| Person 2 | email@example.com | PST |

## Date/time choices
1. Mon DD, YYYY, HH:MM
2. Mon DD, YYYY, HH:MM
```

---

## Key Merge Fields

| Field | Where Used | Example |
| ----- | ---------- | ------- |
| `{$EventTitle$}` | All templates | Team Meeting |
| `{$Participant.Name$}` | All | Alice Johnson |
| `{$Participant.Email$}` | All | alice@example.com |
| `{$DateTimeChoice.1$}` | Invitations, Results | 1. Feb 16, 2026, 13:00 EST |
| `{$DateTimeChoice.2$}` | (auto-expands for all choices) | 2. Feb 16, 2026, 17:00 EST |
| `{$ResponseDeadline$}` | All | Feb 15, 2026 |
| `{$SelectedDateTime$}` | Results only | Feb 16, 2026, 13:00 EST |
| `{$Organizer.Name$}` | All | Jane Smith |
| `{$Organizer.Title$}` | All | Manager |

---

## Time Zone Abbreviations

**North American**:
- HST = Hawaii (UTC-10)
- AKST = Alaska (UTC-9)
- PST / PDT = Pacific (UTC-8 / UTC-7)
- MST / MDT = Mountain (UTC-7 / UTC-6)
- CST / CDT = Central (UTC-6 / UTC-5)
- EST / EDT = Eastern (UTC-5 / UTC-4)
- AST = Atlantic (UTC-4)
- NST / NDT = Newfoundland (UTC-3:30 / UTC-2:30)

**Daylight Saving Time**: Use EDT/PDT/CDT in Mar-Nov, EST/PST/CST in Dec-Feb

---

## Response File Format

Participants create response files like this:

```
From: alice@company.com
Date: Feb 10, 2026, 14:30
Subject: Re: You're invited to Team Meeting

1: Yes
2: As Needed
```

- Each line after blank line: `<choice number>: <Yes|As Needed>`
- Organizer processes with `/poll-process-responses`
- Times converted back to organizer's TZ automatically

---

## Common Workflows

### "I want to check progress"
```
/poll-status
→ See who responded, current frontrunner, who needs reminding
```

### "Responses are coming in, update the tally"
```
/poll-process-responses
→ Scans inbox, records votes, updates frontrunner
(Run this frequently!)
```

### "I need to send reminders to people who haven't responded"
```
/poll-remind
→ Drafts reminder emails to outbox/
(Send manually)
```

### "I disagree with the auto-calculated frontrunner"
1. Edit Poll.md → Current state section
2. Set `Frontrunner choice overwrite: 2` (your choice)
3. Run `/poll-wrap-up` → Uses your override

### "Time zones look wrong in the preview"
1. Run `/poll-preview` for that participant
2. Check their "Time Zone" in Poll.md
3. Verify it matches a supported TZ abbreviation
4. Fix and re-generate drafts

---

## FAQ Quick Answers

**Q: How do I send draft emails?**
A: **Manual**: Copy/paste from draft files into your email client. **Gmail**: Use `/poll-send-emails` to send automatically (requires OAuth2 setup).

**Q: How do I set up Gmail integration?**
A: See USER-GUIDE.md Gmail Integration section. Requires Google Cloud project, OAuth2 credentials, and one-time authentication.

**Q: Can participants respond twice?**
A: Yes — only their latest response counts. All responses logged for audit trail.

**Q: What if deadline passed and someone responds?**
A: Add to Responses table manually, re-run `/poll-process-responses`, check if frontrunner changed.

**Q: Can I override the frontrunner?**
A: Yes — edit Poll.md's "Current state" section, set `Frontrunner choice overwrite: N`, re-run `/poll-wrap-up`.

**Q: How do I switch to a different poll?**
A: Edit `polls-config.json`, change `activePoll` field to new folder name. Save, all commands now use new poll.

**Q: Are there keyboard shortcuts for the commands?**
A: Type `/poll-create` (or any command) in Claude Code. Autocomplete shows all available /poll-* commands.

**Q: What time zone should I use — EST or EDT?**
A: EST for winter (Dec-Feb), EDT for summer (Mar-Nov) in Eastern US. Same for other regions.

---

## Troubleshooting Quick Links

- **Email shows wrong time zone** → Check Participant TZ in Poll.md, run `/poll-preview`
- **Response not processing** → Check file format, From: email matches participant, check inbox path
- **Poll init.md validation failed** → Check format (date must be `Mon DD, YYYY`), time zones are valid
- **Frontrunner seems wrong** → Run `/poll-status` for detailed vote breakdown, check for duplicate responses
- **Can't send emails** → Copy draft content manually into your email client

---

## Remember

✓ All times in Poll.md = Organizer's time zone
✓ Template times auto-convert per participant
✓ Only latest response per participant counts
✓ Run `/poll-preview` before `/poll-draft-emails`
✓ Run `/poll-process-responses` frequently
✓ `/poll-status` is read-only (safe to run anytime)
✓ Manual workflow: Copy/paste drafts to email client (no setup needed)
✓ Gmail workflow: Use `/poll-send-emails` & `/poll-fetch-responses` (requires OAuth2 setup)
✓ Manual and Gmail workflows can be mixed (fallback always available)
✓ See USER-GUIDE.md for detailed documentation
