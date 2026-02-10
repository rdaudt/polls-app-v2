# Time Zone Conversion Rules

## Direction of Conversion

- **Poll.md stores all times in the organizer's time zone** (specified in "Organizer time zone" field).
- **Outbound** (drafting emails): Convert from organizer's TZ → participant's TZ. Append the participant's TZ abbreviation to the displayed time.
- **Inbound** (processing responses): Convert from participant's TZ → organizer's TZ before writing to Poll.md.

## Supported Time Zone Abbreviations and UTC Offsets

| Abbreviation | Name                    | UTC Offset |
| ------------ | ----------------------- | ---------- |
| HST          | Hawaii Standard Time    | UTC-10     |
| AKST         | Alaska Standard Time    | UTC-9      |
| PST          | Pacific Standard Time   | UTC-8      |
| PDT          | Pacific Daylight Time   | UTC-7      |
| MST          | Mountain Standard Time  | UTC-7      |
| MDT          | Mountain Daylight Time  | UTC-6      |
| CST          | Central Standard Time   | UTC-6      |
| CDT          | Central Daylight Time   | UTC-5      |
| EST          | Eastern Standard Time   | UTC-5      |
| EDT          | Eastern Daylight Time   | UTC-4      |
| AST          | Atlantic Standard Time  | UTC-4      |
| NST          | Newfoundland Std Time   | UTC-3:30   |
| NDT          | Newfoundland Daylight   | UTC-2:30   |

## Conversion Procedure

1. Look up the UTC offset for both the source TZ and the target TZ.
2. Compute the difference: `target_offset - source_offset`.
3. Add that difference to the source time.
4. If the result crosses midnight, adjust the date accordingly.

### Example

Organizer TZ: PST (UTC-8). Participant TZ: EST (UTC-5).

- Difference: (-5) - (-8) = +3 hours
- Organizer time `Feb 16, 2026, 10:00 PST` → Participant time `Feb 16, 2026, 13:00 EST`

### Example (Reverse — Processing Response)

Participant TZ: EST (UTC-5). Organizer TZ: PST (UTC-8).

- Difference: (-8) - (-5) = -3 hours
- Participant time `Feb 16, 2026, 13:00 EST` → Organizer time `Feb 16, 2026, 10:00 PST`

## Display Format

When displaying converted times in emails, use the format:
```
<Month> <Day>, <Year>, <HH:MM> <TZ>
```
Example: `Feb 16, 2026, 13:00 EST`
