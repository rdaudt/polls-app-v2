# Template Merge Rules

## Merge Field Syntax

All merge fields use the format `{$FieldName$}`. During merging, each field is replaced with its resolved value.

## Available Merge Fields

| Field                    | Source                                         | Description                                                             |
| ------------------------ | ---------------------------------------------- | ----------------------------------------------------------------------- |
| `{$EventTitle$}`         | Poll.md → "Event name"                         | The event name (used in bold in the body)                               |
| `{$Participant.Name$}`   | Participants table → Name column               | The current participant's full name                                     |
| `{$Participant.Email$}`  | Participants table → Email column              | The current participant's email                                         |
| `{$DateTimeChoice.N$}`   | Date/time choices, converted to participant TZ | The Nth choice formatted as `N. Mon DD, YYYY, HH:MM TZ`               |
| `{$ResponseDeadline$}`   | Poll.md → "Deadline for Responses"             | The deadline date as-is                                                 |
| `{$NowDateTime$}`        | System clock                                   | Current date/time at merge time, in organizer TZ format                 |
| `{$SelectedDateTime$}`   | Current state → frontrunner, converted to participant TZ | The winning date/time, formatted as `Mon DD, HH:MM TZ`        |
| `{$Organizer.Name$}`     | Poll.md → "Organizer"                          | The organizer's full name                                               |
| `{$Organizer.Title$}`    | Poll.md → "Organizer title"                    | The organizer's job title                                               |

## DateTimeChoice Expansion

Templates contain `{$DateTimeChoice.1$}`, `{$DateTimeChoice.2$}`, and `...` as a pattern. During merge:

1. Read all entries from the "Date/time choices" section in Poll.md.
2. For each choice, convert the time from the organizer's TZ to the participant's TZ.
3. Format as: `N. Mon DD, YYYY, HH:MM TZ` (where TZ is the participant's TZ abbreviation).
4. Replace each `{$DateTimeChoice.N$}` with the converted string.
5. Expand the `...` line — replace it with the remaining choices (3, 4, 5, ...) using the same pattern as the lines above. Each expanded choice gets its own `<br>` separated line with the `(  ) **Yes**  (  ) **As Needed**` suffix.
6. Remove the literal `...` line from the output.

### Example Expansion

Template fragment:
```
{$DateTimeChoice.1$}: (  ) **Yes**  (  ) **As Needed**<br>{$DateTimeChoice.2$}: (  ) **Yes**  (  ) **As Needed**<br>...
```

For a participant in EST with 4 choices, becomes:
```
1. Feb 16, 2026, 13:00 EST  (  ) **Yes**  (  ) As **needed**<br>2. Feb 16, 2026, 17:00 EST  (  ) **Yes**  (  ) As **needed**<br>3. Feb 17, 2026, 11:00 EST  (  ) **Yes**  (  ) As **needed**<br>4. Feb 17, 2026, 13:00 EST  (  ) **Yes**  (  ) As **needed**
```

## Template File Format

All templates are markdown files containing a single table with Item/Value columns:

```markdown
| Item    | Value             |
| ------- | ----------------- |
| Subject | <subject line>    |
| Body    | <body with <br>>  |
|         |                   |
```

- The **Subject** row contains the email subject line with merge fields.
- The **Body** row contains the full email body. Line breaks are represented as `<br>` tags.
- The empty row at the bottom is part of the format.

## Merge Procedure

1. Read the template file and extract the Subject and Body values from the table.
2. Resolve each `{$...$}` field against the poll data and participant context.
3. For DateTimeChoice fields, perform TZ conversion and expand the `...` pattern.
4. Return the merged Subject and Body as plain text (with `<br>` converted to newlines for draft files).
