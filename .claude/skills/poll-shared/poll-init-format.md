# Poll init.md Format

A simplified input format for creating new polls. Contains only the essential data needed to initialize a poll.

## Structure

### Section: Poll description

Key-value pairs (format: `Key: Value`), one per line:

```
## Poll description
Poll title: <title>
Event name: <event name>
Organizer: <organizer full name>
Organizer email: <email>
Organizer title: <job title>
Organizer time zone: <TZ abbreviation>
Deadline for Responses: <Mon DD, YYYY>
```

- **Poll title** (required): The internal identifier for the poll
- **Event name** (required): The display name of the event (may differ from poll title)
- **Organizer** (required): Organizer's full name
- **Organizer email** (required): Organizer's email address
- **Organizer title** (optional): Organizer's job title (used in templates)
- **Organizer time zone** (required): TZ abbreviation (see tz-conversion.md for valid values)
- **Deadline for Responses** (required): Date in format `Mon DD, YYYY` (e.g., `Feb 28, 2026`)

### Section: Participants

Markdown table with 3 columns: Name, Email, Time Zone

```
## Participants
| Name | Email | Time Zone |
| ---- | ----- | --------- |
| John Doe | jdoe@yahoo.com | PST |
| Mary Smith | msmith@example.com | EST |
```

- **Name** (required): Participant's full name
- **Email** (required): Participant's email address
- **Time Zone** (required): TZ abbreviation (see tz-conversion.md for valid values)

At least 1 participant is required.

### Section: Date/time choices

Numbered list in organizer's time zone:

```
## Date/time choices
1. Mar 15, 2026, 10:00
2. Mar 15, 2026, 12:00
3. Mar 16, 2026, 14:00
```

- Format: `N. Mon DD, YYYY, HH:MM` (e.g., `Feb 16, 2026, 14:00`)
- All times must be in the organizer's time zone
- At least 1 choice is required

## Parsing Rules

1. **Poll description**:
   - Split by section header `## Poll description`
   - For each line, split by the first `: ` character
   - Left side is the key, right side is the value
   - Trim whitespace from both key and value

2. **Participants**:
   - Split by section header `## Participants`
   - Find lines starting with `|` (table rows)
   - Skip the header row (first `|` line) and separator row (contains `----`)
   - For each data row, split by `|`
   - Extract columns: Name (index 1), Email (index 2), Time Zone (index 3)
   - Trim whitespace from each field

3. **Date/time choices**:
   - Split by section header `## Date/time choices`
   - Find lines matching pattern `N. ` at the start (where N is a number)
   - Strip the leading `N. ` prefix
   - Keep remaining text as the choice

## Validation Rules

After parsing, validate:

1. **Required fields present**:
   - Poll title, Organizer, Organizer email, Organizer time zone, Deadline for Responses
   - At least 1 participant (with name, email, and time zone)
   - At least 1 date/time choice

2. **Optional fields**:
   - Event name: defaults to Poll title if omitted
   - Organizer title: may be empty or omitted

3. **Field formats**:
   - Deadline matches `Mon DD, YYYY` (e.g., `Feb 28, 2026`)
   - Date/time choices match `Mon DD, YYYY, HH:MM` (e.g., `Mar 15, 2026, 10:00`)
   - Time zones are valid TZ abbreviations (check against tz-conversion.md)
   - Dates are valid calendar dates

4. **If validation fails**:
   - Report specific field errors clearly (e.g., "Organizer email is missing", "Choice 2 has invalid time format")
   - Prompt the user interactively for missing or invalid fields only
   - Allow the user to fix one field at a time

## Example Poll init.md

```markdown
## Poll description
Poll title: PanCanada Monthly Meeting Feb 2026
Event name: PanCanada Monthly Meeting
Organizer: Jane Smith
Organizer email: jane.smith@company.com
Organizer title: Director of Engineering
Organizer time zone: PST
Deadline for Responses: Feb 25, 2026

## Participants
| Name | Email | Time Zone |
| ---- | ----- | --------- |
| Alice Johnson | alice@company.com | EST |
| Bob Chen | bob@company.com | CST |
| Carol White | carol@company.com | PST |

## Date/time choices
1. Feb 16, 2026, 10:00
2. Feb 16, 2026, 14:00
3. Feb 17, 2026, 10:00
```
