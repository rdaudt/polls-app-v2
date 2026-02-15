#!/usr/bin/env node

/**
 * Poll Create Skill
 * Creates a new poll from init file or interactive prompts
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');

// Helper: read line from stdin
function promptUser(question) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

// Load config
function loadConfig() {
  try {
    const configPath = path.join(process.cwd(), 'polls-config.json');
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    return config;
  } catch (err) {
    console.error('✗ Error loading polls-config.json:', err.message);
    process.exit(1);
  }
}

// Validate TZ abbreviation
function isValidTZ(tz) {
  const validTZs = ['EST', 'EDT', 'CST', 'CDT', 'MST', 'MDT', 'PST', 'PDT', 'GMT', 'UTC', 'IST', 'AEST', 'AWST'];
  return validTZs.includes(tz.toUpperCase());
}

// Validate date format (Mon DD, YYYY)
function isValidDate(dateStr) {
  const dateRegex = /^[A-Za-z]{3} \d{1,2}, \d{4}$/;
  if (!dateRegex.test(dateStr)) return false;
  try {
    const date = new Date(dateStr);
    return !isNaN(date.getTime());
  } catch {
    return false;
  }
}

// Validate datetime format (Mon DD, YYYY, HH:MM)
function isValidDateTime(datetimeStr) {
  const dtRegex = /^[A-Za-z]{3} \d{1,2}, \d{4}, \d{1,2}:\d{2}$/;
  if (!dtRegex.test(datetimeStr)) return false;
  try {
    const date = new Date(datetimeStr);
    return !isNaN(date.getTime());
  } catch {
    return false;
  }
}

// Parse init file
function parseInitFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const sections = {};
    let currentSection = null;
    const lines = content.split('\n');

    for (const line of lines) {
      if (line.startsWith('## ')) {
        currentSection = line.replace('## ', '').toLowerCase();
        sections[currentSection] = [];
      } else if (currentSection && line.trim()) {
        sections[currentSection].push(line);
      }
    }

    const data = {};

    // Parse poll description
    if (sections['poll description']) {
      for (const line of sections['poll description']) {
        const [key, value] = line.split(': ');
        if (key && value) {
          data[key.toLowerCase().replace(/ /g, '_')] = value.trim();
        }
      }
    }

    // Parse participants
    data.participants = [];
    if (sections['participants']) {
      let skipCount = 0;
      for (const line of sections['participants']) {
        if (line.startsWith('|') && skipCount >= 2) {
          const parts = line.split('|').map(p => p.trim()).filter(p => p);
          if (parts.length >= 3) {
            data.participants.push({
              name: parts[0],
              email: parts[1],
              tz: parts[2]
            });
          }
        }
        if (line.includes('----')) skipCount++;
        else if (line.startsWith('|')) skipCount++;
      }
    }

    // Parse date/time choices
    data.choices = [];
    if (sections['date/time choices']) {
      for (const line of sections['date/time choices']) {
        const match = line.match(/^\d+\.\s+(.+)$/);
        if (match) {
          data.choices.push(match[1].trim());
        }
      }
    }

    return data;
  } catch (err) {
    console.error('✗ Error reading init file:', err.message);
    return null;
  }
}

// Interactive collection
async function collectInteractively() {
  console.log('\n📋 Poll Creation - Interactive Mode\n');

  const data = {};

  data.poll_title = await promptUser('Poll title: ');
  data.event_name = await promptUser('Event name (leave blank to use poll title): ') || data.poll_title;
  data.organizer = await promptUser('Organizer name: ');
  data.organizer_email = await promptUser('Organizer email: ');
  data.organizer_title = await promptUser('Organizer title (optional): ') || '';
  data.organizer_tz = await promptUser('Organizer time zone (e.g., EST, PST): ');

  data.participants = [];
  let addMore = true;
  while (addMore) {
    const name = await promptUser('Participant name: ');
    const email = await promptUser('Participant email: ');
    const tz = await promptUser('Participant time zone (e.g., EST, PST): ');

    data.participants.push({ name, email, tz });

    const another = await promptUser('Add another participant? (y/n): ');
    addMore = another.toLowerCase() === 'y';
  }

  data.choices = [];
  addMore = true;
  while (addMore) {
    const choice = await promptUser('Date/time choice (format: Mon DD, YYYY, HH:MM): ');
    data.choices.push(choice);

    const another = await promptUser('Add another choice? (y/n): ');
    addMore = another.toLowerCase() === 'y';
  }

  data.deadline = await promptUser('Deadline for responses (format: Mon DD, YYYY): ');

  return data;
}

// Validate data
function validateData(data) {
  const errors = [];

  if (!data.poll_title) errors.push('Poll title is required');
  if (!data.organizer) errors.push('Organizer name is required');
  if (!data.organizer_email || !data.organizer_email.includes('@')) errors.push('Valid organizer email is required');
  if (!data.organizer_tz || !isValidTZ(data.organizer_tz)) errors.push(`Organizer time zone "${data.organizer_tz}" is invalid`);
  if (!data.deadline || !isValidDate(data.deadline)) errors.push('Valid deadline date (Mon DD, YYYY) is required');

  if (!data.participants || data.participants.length === 0) {
    errors.push('At least one participant is required');
  } else {
    for (let i = 0; i < data.participants.length; i++) {
      const p = data.participants[i];
      if (!p.name) errors.push(`Participant ${i + 1} name is missing`);
      if (!p.email || !p.email.includes('@')) errors.push(`Participant ${i + 1} email is invalid`);
      if (!p.tz || !isValidTZ(p.tz)) errors.push(`Participant ${i + 1} time zone "${p.tz}" is invalid`);
    }
  }

  if (!data.choices || data.choices.length === 0) {
    errors.push('At least one date/time choice is required');
  } else {
    for (let i = 0; i < data.choices.length; i++) {
      if (!isValidDateTime(data.choices[i])) {
        errors.push(`Choice ${i + 1} has invalid format (expected: Mon DD, YYYY, HH:MM)`);
      }
    }
  }

  return errors;
}

// Create poll folder and files
function createPollFolder(config, data) {
  const month = new Date().getMonth() + 1;
  const year = new Date().getFullYear();
  const monthStr = String(month).padStart(2, '0');
  const yearStr = String(year).slice(2);
  const folderName = `${monthStr}${yearStr} ${data.event_name}`;
  const pollPath = path.join(config.pollsRoot, folderName);

  if (fs.existsSync(pollPath)) {
    console.error(`✗ Poll folder already exists: ${pollPath}`);
    process.exit(1);
  }

  fs.mkdirSync(pollPath, { recursive: true });
  fs.mkdirSync(path.join(pollPath, 'outbox'), { recursive: true });

  // Create Poll.md
  const pollMdContent = `# ${data.poll_title}

## Poll description

| Field | Value |
|-------|-------|
| Event title | ${data.event_name} |
| Organizer | ${data.organizer} |
| Organizer email | ${data.organizer_email} |
| Organizer title | ${data.organizer_title || '(none)'} |
| Organizer time zone | ${data.organizer_tz} |
| Deadline for Responses | ${data.deadline} |

## Participants

| Name | Email | Time Zone | Polled on | Responded on | Reminded on | Results Communicated on |
|------|-------|-----------|-----------|--------------|-------------|-------------------------|
${data.participants.map(p => `| ${p.name} | ${p.email} | ${p.tz} | | | | |`).join('\n')}

## Date/time choices

${data.choices.map((c, i) => `${i + 1}. ${c}`).join('\n')}

## Responses

| Participant | Choice | Timestamp |
|-------------|--------|-----------|

## Current state

- **Invitations sent**: No
- **Responses received**: 0 / ${data.participants.length}
- **Frontrunner**: None yet
`;

  fs.writeFileSync(path.join(pollPath, 'Poll.md'), pollMdContent);

  // Create email templates
  const invitationTemplate = `# Poll Invitation

| Field | Value |
|-------|-------|
| From | {$Organizer.Name$} |
| Subject | You're invited: {$EventTitle$} |

{$Participant.Name$},

You're invited to participate in a scheduling poll for **{$EventTitle$}**.

Please indicate your availability for the following time slots (all times in your local timezone):

${data.choices.map((c, i) => `${i + 1}. {$DateTimeChoice.${i + 1}$}`).join('\n')}

Choose "Yes" if you can attend, or "As Needed" if you might be able to adjust your schedule.

**Deadline**: {$ResponseDeadline$}

Reply with your choices in this format:
\`\`\`
1: Yes
2: As Needed
3: Yes
\`\`\`

Thanks,<br>
{$Organizer.Name$}<br>
{$Organizer.Title$}
`;

  const reminderTemplate = `# Poll Reminder

| Field | Value |
|-------|-------|
| From | {$Organizer.Name$} |
| Subject | Reminder: {$EventTitle$} scheduling poll |

{$Participant.Name$},

This is a friendly reminder to submit your availability for the **{$EventTitle$}** scheduling poll.

**Deadline**: {$ResponseDeadline$}

Please reply with your choices:
\`\`\`
1: Yes
2: As Needed
3: Yes
\`\`\`

Thanks!<br>
{$Organizer.Name$}
`;

  const resultsTemplateRespondent = `# Poll Results

| Field | Value |
|-------|-------|
| From | {$Organizer.Name$} |
| Subject | Results: {$EventTitle$} |

{$Participant.Name$},

Thank you for participating! The poll is closed.

**Selected time**: {$SelectedDateTime$}

See you then!<br>
{$Organizer.Name$}
`;

  const resultsTemplateNonRespondent = `# Poll Results

| Field | Value |
|-------|-------|
| From | {$Organizer.Name$} |
| Subject | Results: {$EventTitle$} |

{$Participant.Name$},

The poll for **{$EventTitle$}** is now closed.

**Selected time**: {$SelectedDateTime$}

We missed your input, but hope to see you then!<br>
{$Organizer.Name$}
`;

  fs.writeFileSync(path.join(pollPath, 'Poll email template.md'), invitationTemplate);
  fs.writeFileSync(path.join(pollPath, 'Poll reminder email.md'), reminderTemplate);
  fs.writeFileSync(path.join(pollPath, 'Poll results email template - Respondent.md'), resultsTemplateRespondent);
  fs.writeFileSync(path.join(pollPath, 'Poll results email template - Non-Respondent.md'), resultsTemplateNonRespondent);

  return { folderName, pollPath };
}

// Main
async function main() {
  try {
    const config = loadConfig();

    if (!config.pollsRoot) {
      console.error('✗ pollsRoot not configured in polls-config.json');
      process.exit(1);
    }

    let data;
    let initFilePath = process.argv[2];

    if (!initFilePath) {
      initFilePath = path.join(config.pollsRoot, 'Poll init.md');
    }

    if (fs.existsSync(initFilePath)) {
      console.log(`\n📋 Reading poll definition from: ${initFilePath}\n`);
      data = parseInitFile(initFilePath);
      if (!data) process.exit(1);
    } else {
      data = await collectInteractively();
    }

    // Validate data
    const errors = validateData(data);
    if (errors.length > 0) {
      console.error('\n✗ Validation errors:');
      errors.forEach(e => console.error(`  - ${e}`));
      process.exit(1);
    }

    // Create poll
    const { folderName, pollPath } = createPollFolder(config, data);

    // Update config
    config.activePoll = folderName;
    fs.writeFileSync(path.join(process.cwd(), 'polls-config.json'), JSON.stringify(config, null, 2));

    console.log('\n✓ Poll created successfully!\n');
    console.log(`📂 Folder: ${pollPath}`);
    console.log(`👥 Participants: ${data.participants.length}`);
    console.log(`📅 Date/time choices: ${data.choices.length}`);
    console.log(`✉️  Templates created: 4 (invitation, reminder, respondent results, non-respondent results)`);
    console.log(`\n✓ Active poll updated in polls-config.json\n`);

    process.exit(0);
  } catch (err) {
    console.error('✗ Error:', err.message);
    process.exit(1);
  }
}

main();
