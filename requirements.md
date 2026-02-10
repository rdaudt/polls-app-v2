1. organizer describes poll in an md file (see Poll description section in poll.md file)
- poll name: PanCanada Monthly Meeting Feb 2026
- poll title: PanCanada Monthly Meeting Feb 2026
- event name (optional): PanCanada Monthly Meeting Feb 2026
- organizer name: Roque Daudt
- organizer email: roque.daudt@gmail.com
- organizer title: Director of Everything & More
- organizer time zone: PST
- participants list; for each participant
-- name
-- email
-- time zone

2. organizer creates and saves poll email and poll reminder email templates

3. organizer request preview of the poll email
- using the poll email template, solution prepares sends email preview to organizer

4. organizer requests solution to prepare poll draft emails
- solution merges poll email template with participants list, numbered date/time choices and creates in the organizer's mailbox one draft email for each participant.
- solution understands that times were expressed by the organizer in the organizer's time zone
- for this reason, for the body of the draft emails, solution adjust the date/times to the participants' time zones
- solution annotates in poll.md the date/time (in the organizer's time zone) that the draft poll emails were prepared; this is annotated in the "Polled on" column 

5. participants respond email with their choices 
- for each response, solution parses out and understand the participant's response, maps the time zone of the choices back to the organizer time zone, creates a record of the response in poll.md, annotate the response date/time in poll.md
- for each response, solution updates the poll current state

6. organizer requests solution to send out poll reminder
- using the poll reminder email template, solution sends poll reminder for participants that haven't responded yet

7. organizer updates participants list (new participants) and requests solution to send out poll email to participants who haven't received it yet
- solution works as described in item 4 in this document, for the newly entered participants

8. organizer requests update about current state of the poll
- solution reviews responses, updates Current State section in poll.md and shows the current state to the organizer

9. organizer requests solution to wrap up the poll
- solution updates the poll current state 
- solution prepares poll result draft emails to respondents and non respondents