# Polls App Shared Modules

This document describes the shared utility modules used by all Polls App skills. These modules handle cross-cutting concerns like template merging, time zone conversion, file parsing, and vote tallying.

## Module Overview

| Module | Location | Purpose |
|--------|----------|---------|
| `template-engine.js` | `.claude/skills/poll-shared/` | Template merge field substitution |
| `tz-converter.js` | `.claude/skills/poll-shared/` | Time zone conversion |
| `poll-parser.js` | `.claude/skills/poll-shared/` | Parse and update Poll.md safely |
| `vote-tally.js` | `.claude/skills/poll-shared/` | Vote tallying and frontrunner calculation |
| `gmail-auth.js` | `.claude/skills/poll-shared/` | OAuth2 token management (Gmail only) |
| `gmail-helpers.js` | `.claude/skills/poll-shared/` | Email encoding, parsing, label management (Gmail only) |
| `nlp-response-parser.js` | `.claude/skills/poll-shared/` | NLP fallback for natural language poll responses |

---

## template-engine.js

Handles template merge field substitution for all email templates.

### API

#### `mergeTemplate(templateContent, pollData, participant, options = {})`

Merges template file content with merge fields substituted.

**Parameters:**
- `templateContent` (string) — Raw template markdown with `{$Field$}` syntax
- `pollData` (object) — Parsed Poll.md data with organizer info, choices, deadline
- `participant` (object) — Participant info: `{ name, email, tz }`
- `options` (object) — Optional: `{ selectedDateTime, nowDateTime }`

**Returns:** (string) Merged template with all fields substituted

**Example:**
```javascript
const template = fs.readFileSync('Poll email template.md', 'utf-8');
const merged = mergeTemplate(template, pollData, participant, {
  nowDateTime: new Date().toISOString()
});
```

#### `extractSubjectAndBody(mergedTemplate)`

Parses merged template to separate Subject and body content.

**Parameters:**
- `mergedTemplate` (string) — Full merged email template

**Returns:** (object) `{ subject: string, body: string }`

**Example:**
```javascript
const { subject, body } = extractSubjectAndBody(merged);
console.log('Subject:', subject);
console.log('Body:', body);
```

### Merge Fields Reference

| Field | Source | Notes |
|-------|--------|-------|
| `{$EventTitle$}` | `pollData.eventTitle` | Event name from Poll.md |
| `{$Participant.Name$}` | `participant.name` | Recipient's full name |
| `{$Participant.Email$}` | `participant.email` | Recipient's email address |
| `{$DateTimeChoice.N$}` | `pollData.choices[N-1]` | Nth choice, converted to participant's TZ + abbreviation |
| `{$ResponseDeadline$}` | `pollData.deadline` | Response deadline date from Poll.md |
| `{$NowDateTime$}` | `options.nowDateTime` | Current date/time at merge time |
| `{$SelectedDateTime$}` | `options.selectedDateTime` | Winning date/time (results templates), converted to participant's TZ |
| `{$Organizer.Name$}` | `pollData.organizer` | Organizer's full name |
| `{$Organizer.Title$}` | `pollData.organizerTitle` | Organizer's title (e.g., "Director of AI") |

### Special Handling

**Date/Time Choice Expansion:**
- Templates can use pattern: `{$DateTimeChoice.1$}`, `{$DateTimeChoice.2$}`, ...
- During merge, detect all choice placeholders
- Expand to include all available date/time choices
- Example: Template with `{$DateTimeChoice.1$}` and `{$DateTimeChoice.2$}` expands to all choices

**Time Zone Conversion:**
- Each `{$DateTimeChoice.N$}` is automatically converted from organizer TZ to participant TZ
- TZ abbreviation is appended: "Feb 16, 2026, 13:00 EST"
- Uses `tz-converter.js` for conversion logic

---

## tz-converter.js

Converts date/times between time zones.

### API

#### `convertDateTime(dateTimeStr, fromTZ, toTZ)`

Converts a date/time from one time zone to another.

**Parameters:**
- `dateTimeStr` (string) — Date/time in format "Mon DD, YYYY, HH:MM" (e.g., "Feb 16, 2026, 13:00")
- `fromTZ` (string) — Source TZ abbreviation (e.g., "EST")
- `toTZ` (string) — Target TZ abbreviation (e.g., "PST")

**Returns:** (string) Converted date/time in same format

**Example:**
```javascript
const converted = convertDateTime("Feb 16, 2026, 13:00", "EST", "PST");
// Returns: "Feb 16, 2026, 10:00"
```

#### `getTZOffset(tzAbbr)`

Gets UTC offset for a time zone abbreviation.

**Parameters:**
- `tzAbbr` (string) — TZ abbreviation (e.g., "EST")

**Returns:** (number) UTC offset in hours (negative for west of UTC)

**Example:**
```javascript
getTZOffset("EST");   // Returns: -5
getTZOffset("GMT");   // Returns: 0
getTZOffset("IST");   // Returns: 5.5
```

#### `isValidTZ(tzAbbr)`

Validates if a TZ abbreviation is supported.

**Parameters:**
- `tzAbbr` (string) — TZ abbreviation to validate

**Returns:** (boolean) True if valid, false otherwise

**Example:**
```javascript
isValidTZ("EST");   // Returns: true
isValidTZ("FOO");   // Returns: false
```

### Supported Time Zones

| Abbreviation | UTC Offset | Region |
|--------------|------------|--------|
| GMT, UTC | +0 | Greenwich Mean Time / Coordinated Universal Time |
| EST | -5 | Eastern Standard Time |
| EDT | -4 | Eastern Daylight Time |
| CST | -6 | Central Standard Time |
| CDT | -5 | Central Daylight Time |
| MST | -7 | Mountain Standard Time |
| MDT | -6 | Mountain Daylight Time |
| PST | -8 | Pacific Standard Time |
| PDT | -7 | Pacific Daylight Time |
| IST | +5:30 | Indian Standard Time |
| AEST | +10 | Australian Eastern Standard Time |
| AWST | +8 | Australian Western Standard Time |

**Note:** Consult `.claude/skills/poll-shared/tz-conversion.md` for complete list and DST handling.

### Algorithm

1. Parse `dateTimeStr` to extract date and time components
2. Get UTC offsets for `fromTZ` and `toTZ`
3. Convert to UTC: subtract `fromTZ` offset from time
4. Convert to target TZ: add `toTZ` offset
5. Handle date rollovers (date changes if time crosses midnight)
6. Format result back to "Mon DD, YYYY, HH:MM" format

---

## poll-parser.js

Safely parses Poll.md files and provides methods to update specific sections.

### API

#### `parsePollFile(filePath)`

Reads and parses a complete Poll.md file.

**Parameters:**
- `filePath` (string) — Absolute path to Poll.md

**Returns:** (object) Parsed poll data structure:
```javascript
{
  pollTitle: "Team Lunch Planning",
  description: {
    eventTitle: "Team Lunch",
    organizer: "Alice Johnson",
    organizerEmail: "alice@example.com",
    organizerTitle: "Director of AI",
    organizerTZ: "EST",
    deadline: "Feb 28, 2026"
  },
  participants: [
    { name: "Alice Johnson", email: "alice@example.com", tz: "EST",
      polledOn: "Feb 10, 2026", respondedOn: "Feb 11, 2026",
      remindedOn: "", resultsCommunicatedOn: "" },
    { name: "Bob Smith", email: "bob@example.com", tz: "PST",
      polledOn: "Feb 10, 2026", respondedOn: "",
      remindedOn: "Feb 14, 2026", resultsCommunicatedOn: "" }
  ],
  choices: ["Feb 16, 2026, 13:00", "Feb 17, 2026, 10:00", "Feb 18, 2026, 15:00"],
  responses: [
    { participant: "Alice Johnson", choice: 1, timestamp: "2026-02-11T14:32:00Z" },
    { participant: "Alice Johnson", choice: 2, timestamp: "2026-02-11T14:32:00Z" },
    { participant: "Bob Smith", choice: 2, timestamp: "2026-02-15T09:15:00Z" }
  ],
  currentState: {
    invitationsSent: true,
    responsesReceived: "2 / 3",
    nonRespondents: ["Charlie Brown"],
    frontrunner: { choiceNumber: 2, yesCount: 2, asNeededCount: 0 }
  }
}
```

#### `updateParticipantRow(filePath, participantEmail, updates)`

Updates specific columns in a participant's row.

**Parameters:**
- `filePath` (string) — Absolute path to Poll.md
- `participantEmail` (string) — Participant email to update
- `updates` (object) — Columns to update: `{ polledOn, respondedOn, remindedOn, resultsCommunicatedOn }`

**Example:**
```javascript
updateParticipantRow(pollPath, "alice@example.com", {
  polledOn: "Feb 10, 2026",
  respondedOn: "Feb 11, 2026"
});
```

#### `addResponse(filePath, participantName, choiceNumber, timestamp)`

Adds a new response to the Responses table.

**Parameters:**
- `filePath` (string) — Absolute path to Poll.md
- `participantName` (string) — Participant name
- `choiceNumber` (number) — Which choice (1, 2, 3, etc.)
- `timestamp` (string) — ISO8601 timestamp

**Example:**
```javascript
addResponse(pollPath, "Alice Johnson", 1, new Date().toISOString());
```

#### `updateCurrentState(filePath, state)`

Updates the "Current state" section.

**Parameters:**
- `filePath` (string) — Absolute path to Poll.md
- `state` (object) — State updates: `{ responsesReceived, frontrunner, pollCompleted }`

**Example:**
```javascript
updateCurrentState(pollPath, {
  responsesReceived: "2 / 3",
  frontrunner: "Choice 1 (Feb 16, 2026, 13:00) - 2 Yes, 0 As Needed"
});
```

### Implementation Notes

**Parsing Strategy:**
- Split file by `## ` headers to find sections
- "Poll description" table: extract Field/Value pairs
- "Participants" table: parse data rows (skip header with `----`)
- "Date/time choices": regex match numbered list items `^\d+\. (.+)$`
- "Responses" table: parse data rows
- "Current state": parse bullet list with key-value format

**Update Strategy:**
- Read entire file into memory
- Reconstruct modified sections
- Preserve exact markdown table alignment by calculating column widths
- Write atomically to avoid corruption

---

## vote-tally.js

Tallies votes and determines the poll frontrunner.

### API

#### `tallyVotes(responses, participantCount)`

Tallies all votes and returns sorted results with frontrunner.

**Parameters:**
- `responses` (array) — Response objects from Poll.md: `[{ participant, choice, timestamp }, ...]`
- `participantCount` (number) — Total number of participants

**Returns:** (object)
```javascript
{
  tally: [
    { choiceNumber: 1, yesCount: 2, asNeededCount: 0 },
    { choiceNumber: 2, yesCount: 1, asNeededCount: 1 },
    { choiceNumber: 3, yesCount: 0, asNeededCount: 2 }
  ],
  frontrunner: { choiceNumber: 1, yesCount: 2, asNeededCount: 0 },
  totalResponses: 2
}
```

**Example:**
```javascript
const pollData = parsePollFile('Poll.md');
const tally = tallyVotes(pollData.responses, pollData.participants.length);
console.log(`Frontrunner: Choice ${tally.frontrunner.choiceNumber}`);
console.log(`Responses: ${tally.totalResponses} / ${pollData.participants.length}`);
```

#### `getFrontrunner(tally)`

Extracts frontrunner from tally results.

**Parameters:**
- `tally` (object) — Tally object returned by `tallyVotes()`

**Returns:** (object) `{ choiceNumber, yesCount, asNeededCount }` or null if no responses

### Tally Algorithm

1. **Filter to latest per participant:**
   - Group responses by participant
   - Keep only the response with the latest timestamp for each participant
   - Discard earlier responses from same participant

2. **Count votes:**
   - For each remaining response, increment count for that choice
   - Separate "Yes" and "As Needed" counts

3. **Sort by priority:**
   - Primary: Most "Yes" votes (descending)
   - Secondary: Most "As Needed" votes (descending)
   - Tertiary: Lowest choice number (ascending) as tiebreaker

4. **Return frontrunner:**
   - Top choice is the frontrunner
   - Return null if no responses yet

### Edge Cases

- **No responses yet:** `frontrunner` is null
- **Multiple choices with same votes:** Tiebreaker uses choice number
- **Invalid choice numbers:** Skipped with warning
- **Duplicate participant responses:** Kept only latest by timestamp
- **No participants:** Returns empty tally

---

## gmail-auth.js

OAuth2 authentication and token management for Gmail integration (Gmail only).

### API

#### `isAuthenticated()`

Checks if Gmail OAuth2 credentials exist and are valid.

**Returns:** (boolean) True if credentials are available

**Example:**
```javascript
if (!isAuthenticated()) {
  console.log('Run /poll-gmail-setup first');
  return;
}
```

#### `authenticateUser(clientSecretPath)`

Initiates OAuth2 browser flow for first-time authentication.

**Parameters:**
- `clientSecretPath` (string) — Path to `client_secret.json` from Google Cloud Console

**Returns:** (Promise) Resolves when authentication completes

**Example:**
```javascript
await authenticateUser('~/.gmail-credentials/client_secret.json');
console.log('Authentication successful!');
```

#### `getAuthClient()`

Returns authenticated OAuth2 client for API calls.

**Returns:** (object) Google Auth client (oauth2Client)

**Example:**
```javascript
const authClient = getAuthClient();
const gmail = google.gmail({ version: 'v1', auth: authClient });
```

#### `createGmailClient()`

Creates a Gmail API client with current authentication.

**Returns:** (object) Gmail API v1 client

**Example:**
```javascript
const gmail = createGmailClient();
const messages = await gmail.users.messages.list({ userId: 'me' });
```

### Implementation Notes

- Uses **singleton pattern** for auth client (created once, reused)
- Tokens stored in `~/.gmail-credentials/`:
  - `client_secret.json` — OAuth2 credentials (downloaded once from GCP)
  - `credentials.json` — Access and refresh tokens (auto-managed)
- File permissions set to 600 (owner read/write only)
- Refresh tokens auto-refresh transparently before API calls
- OAuth2 scopes: `gmail.send`, `gmail.readonly`, `gmail.modify`

---

## gmail-helpers.js

Utilities for email encoding, parsing, and label management (Gmail only).

### API

#### `encodeEmail(to, subject, body)`

Encodes email for Gmail API `messages.send()`.

**Parameters:**
- `to` (string) — Recipient email address
- `subject` (string) — Email subject
- `body` (string) — Email body (plain text or HTML)

**Returns:** (string) Base64url-encoded email message

**Example:**
```javascript
const encoded = encodeEmail('alice@example.com', 'Poll Invitation', 'Please respond...');
await gmail.users.messages.send({
  userId: 'me',
  requestBody: { raw: encoded }
});
```

#### `parseEmailBody(messageData)`

Parses full Gmail message to extract subject and body.

**Parameters:**
- `messageData` (object) — Full Gmail message object from `messages.get()`

**Returns:** (object) `{ subject: string, from: string, date: string, body: string }`

**Example:**
```javascript
const message = await gmail.users.messages.get({ userId: 'me', id: messageId });
const { subject, from, body } = parseEmailBody(message);
```

#### `htmlToPlainText(html)`

Converts HTML email body to plain text.

**Parameters:**
- `html` (string) — HTML content

**Returns:** (string) Plain text equivalent

**Example:**
```javascript
const plainText = htmlToPlainText('<p>Hello <b>World</b></p>');
// Returns: "Hello World"
```

#### `extractResponses(bodyText)`

Extracts numbered poll responses from email body text using a three-tier regex cascade.

**Parameters:**
- `bodyText` (string) — Email body text (plain text)

**Returns:** (Array) `[{ number: 1, choice: 'Yes' }, { number: 2, choice: 'As Needed' }, ...]`

**Pattern cascade (tried in order, first match wins):**

1. **Direct format** — `N: Yes`, `N. As Needed`, `N) Yes`, `N - Yes`
2. **Filled-checkbox format** — Two checkbox groups per line:
   `1. Mar 16, 2026, 10:00 PST: (X) **Yes**  ( ) **As Needed**`
   Detects any non-whitespace mark inside parentheses. Handles optional markdown bold around Yes/As Needed. If both marked, prefers Yes.
3. **Natural language** — Extracts choice numbers from free-text replies (e.g., "option 1 and 3 work, 2 if needed"). Strips quoted reply text before parsing.

**Example:**
```javascript
const responses = extractResponses('1: Yes\n2: As Needed\n3: Yes');
// Returns: [{ number: 1, choice: 'Yes' }, { number: 2, choice: 'As Needed' }, { number: 3, choice: 'Yes' }]
```

#### `getOrCreateLabel(gmailClient, labelName)`

Gets or creates a Gmail label for organizing poll responses.

**Parameters:**
- `gmailClient` (object) — Gmail API client
- `labelName` (string) — Label name (e.g., "Polls/Responses")

**Returns:** (Promise<string>) Label ID

**Example:**
```javascript
const labelId = await getOrCreateLabel(gmail, 'Polls/Responses');
```

---

## nlp-response-parser.js

NLP fallback for parsing natural language poll responses. Tries regex first (fast, free), then falls back to Claude Haiku API when regex returns nothing and `ANTHROPIC_API_KEY` is available.

### API

#### `extractResponsesWithNLP(bodyText, pollChoices)`

Extract responses with NLP fallback.

**Parameters:**
- `bodyText` (string) — Email body text
- `pollChoices` (string[]) — Array of choice strings from Poll.md (e.g., `["Feb 16, 2026, 13:00", "Feb 17, 2026, 10:00"]`)

**Returns:** (Promise\<object\>) `{ responses: Array<{ number, choice }>, method: 'regex' | 'nlp' | 'none' }`

**Flow:**
1. Calls `gmail-helpers.extractResponses(bodyText)` (regex, three-tier cascade)
2. If regex returns results, returns `{ responses, method: 'regex' }`
3. If regex returns nothing and `ANTHROPIC_API_KEY` is set, calls Claude Haiku with the email body and poll choices
4. Returns `{ responses, method: 'nlp' }` on success, or `{ responses: [], method: 'none' }` on failure

**Example:**
```javascript
const { responses, method } = await extractResponsesWithNLP(bodyText, pollChoices);
if (responses.length > 0) {
  console.log(`Parsed ${responses.length} choices via ${method}`);
}
```

#### `parseNLPResponse(rawText, maxChoice)`

Parse and validate the JSON response from Claude API. Exported for testing.

**Parameters:**
- `rawText` (string) — Raw text from Claude API response
- `maxChoice` (number) — Maximum valid choice number

**Returns:** (Array) Validated `[{ number, choice }, ...]`

#### `buildUserMessage(bodyText, pollChoices)`

Build the user message for the Claude API call. Exported for testing.

**Parameters:**
- `bodyText` (string) — Email body text
- `pollChoices` (string[]) — Array of choice strings

**Returns:** (string) Formatted message with numbered choices and email body

### Configuration

- **Environment variable:** `ANTHROPIC_API_KEY` — required for NLP fallback; without it, NLP is silently skipped
- **Model:** `claude-haiku-4-5-20251001`
- **Cost:** ~$0.0002 per NLP call (only triggered when regex fails)
- **Timeout:** 15 seconds
- **No external dependencies** — uses Node 20+ native `fetch()`

### NLP System Prompt

The system prompt instructs Claude to:
- Map natural language date/time references to numbered poll choices
- Classify each as "Yes" (firm) or "As Needed" (conditional/maybe)
- Handle patterns like "all work", "all except #2", ordinals, date references
- Return only a JSON array: `[{"number": 1, "choice": "Yes"}, ...]`
- Never fabricate choices not in the original list

---

## Summary for Skill Developers

When implementing a new skill, import the modules you need:

```javascript
const { parsePollFile, updateParticipantRow, addResponse } = require('../poll-shared/poll-parser.js');
const { mergeTemplate, extractSubjectAndBody } = require('../poll-shared/template-engine.js');
const { convertDateTime } = require('../poll-shared/tz-converter.js');
const { tallyVotes } = require('../poll-shared/vote-tally.js');
const { isAuthenticated, createGmailClient } = require('../poll-shared/gmail-auth.js');
const { encodeEmail, parseEmailBody, extractResponses } = require('../poll-shared/gmail-helpers.js');
const { extractResponsesWithNLP } = require('../poll-shared/nlp-response-parser.js');
```

All modules are designed to be used independently and handle their own error cases. See individual skill implementations for usage examples.
