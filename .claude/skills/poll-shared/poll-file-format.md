# Poll.md Canonical Format

`Poll.md` is the single source of truth for all poll data. It contains the following sections in order.

## Section: Poll description

Key-value pairs, one per line:
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

## Section: Participants

Markdown table with these columns:

| Column                       | Description                                      |
| ---------------------------- | ------------------------------------------------ |
| Name                         | Participant's full name                          |
| Email                        | Participant's email address                      |
| Time Zone                    | Participant's TZ abbreviation                    |
| Polled on                    | Date/time the poll email was drafted for them     |
| (last) Responded on          | Date/time of their most recent response          |
| (last) Reminded on           | Date/time the last reminder was drafted for them |
| Poll Results Communicated on | Date/time the results email was drafted for them |

Date/time format in this table: `Mon DD, YYYY, HH:MM` (e.g., `Jan 01, 2026, 10:00`). All times in organizer's TZ.

```
## Participants
| Name | Email | Time Zone | Polled on | (last) Responded on | (last) Reminded on | Poll Results Communicated on |
| ---- | ----- | --------- | --------- | ------------------- | ------------------ | ---------------------------- |
```

## Section: Date/time choices

Numbered list of date/time options, all in the organizer's time zone:
```
## Date/time choices
1. Feb 16, 2026, 10:00
2. Feb 16, 2026, 14:00
3. Feb 17, 2026, 08:00
```

## Section: Responses

Markdown table logging every response received. Multiple rows may exist for the same participant (if they respond more than once). Only the latest response per participant counts for tallying.

| Column    | Description                                                |
| --------- | ---------------------------------------------------------- |
| Date/time | When the response was received (organizer's TZ)            |
| Name      | Participant name                                           |
| Email     | Participant email                                          |
| Yes       | Comma-separated choice numbers the participant said Yes to |
| As needed | Comma-separated choice numbers marked As Needed            |

```
## Responses
| Date/time | Name | Email | Yes | As needed |
| --------- | ---- | ----- | --- | --------- |
```

## Section: Current state

Updated by `/poll-process-responses` (which tallies votes each time it runs):
```
## Current state
Assessed on: <Mon DD, YYYY, HH:MM>
Count of participants who responded: <N>
Count of responses: <N>
Frontrunner choice: <choice number>
Frontrunner choice overwrite:
```

- **Count of participants who responded**: Number of unique participants with at least one response.
- **Count of responses**: Total number of response rows in the Responses table.
- **Frontrunner choice**: The choice number with the most "Yes" votes. Use "As Needed" as tiebreaker (more As Needed wins). If still tied, pick the earlier choice number.
- **Frontrunner choice overwrite**: Optional. The organizer may set this to a choice number to override the computed frontrunner before running `/poll-wrap-up`. If set, `/poll-wrap-up` uses this value instead of `Frontrunner choice`. Left empty by default; only the organizer edits this field manually.
