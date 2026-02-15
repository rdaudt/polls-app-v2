/**
 * Poll Draft Emails Skill
 * 
 * Generates invitation draft emails for participants who haven't been polled yet.
 * Creates draft-poll-*.txt files in the outbox folder.
 */

const fs = require('fs');
const path = require('path');
const { parsePollFile, updateParticipantRow } = require('../poll-shared/poll-parser');
const { mergeTemplate, extractSubjectAndBody } = require('../poll-shared/template-engine');

// Load configuration
function loadConfig() {
  const configPath = path.resolve(process.cwd(), 'polls-config.json');
  if (!fs.existsSync(configPath)) {
    throw new Error('polls-config.json not found in current directory');
  }
  return JSON.parse(fs.readFileSync(configPath, 'utf-8'));
}

// Format date for participant column (Mon DD, YYYY, HH:MM)
function getFormattedDate() {
  const now = new Date();
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const month = monthNames[now.getMonth()];
  const day = now.getDate();
  const year = now.getFullYear();
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  return `${month} ${day}, ${year}, ${hours}:${minutes}`;
}

// Main function
async function main() {
  try {
    const config = loadConfig();

    if (!config.pollsRoot || !config.activePoll) {
      throw new Error('pollsRoot and activePoll not configured in polls-config.json');
    }

    const pollPath = path.join(config.pollsRoot, config.activePoll);
    const pollFilePath = path.join(pollPath, 'Poll.md');
    const outboxPath = path.join(pollPath, 'outbox');

    if (!fs.existsSync(pollFilePath)) {
      throw new Error(`Poll.md not found at ${pollFilePath}`);
    }

    // Create outbox directory if needed
    if (!fs.existsSync(outboxPath)) {
      fs.mkdirSync(outboxPath, { recursive: true });
    }

    // Parse poll data
    const pollData = parsePollFile(pollFilePath);

    // Find unpolled participants
    const unpolledParticipants = pollData.participants.filter(p => !p.polledOn || !p.polledOn.trim());

    if (unpolledParticipants.length === 0) {
      console.log('\nNo unpolled participants. All have been invited.');
      return;
    }

    console.log(`\nCreating poll invitation drafts...\n`);
    console.log(`Found ${unpolledParticipants.length} unpolled participant${unpolledParticipants.length !== 1 ? 's' : ''}:`);
    unpolledParticipants.forEach(p => {
      console.log(`  - ${p.email} (${p.name})`);
    });

    // Read template
    const templatePath = path.join(pollPath, 'Poll email template.md');
    if (!fs.existsSync(templatePath)) {
      throw new Error(`Template not found: ${templatePath}`);
    }

    const templateContent = fs.readFileSync(templatePath, 'utf-8');
    const formattedDate = getFormattedDate();

    console.log('\nMerging templates and creating drafts...');

    // Generate drafts for each unpolled participant
    for (const participant of unpolledParticipants) {
      try {
        // Merge template
        const mergedTemplate = mergeTemplate(templateContent, pollData.description, participant, {
          nowDateTime: new Date().toISOString()
        });

        // Extract subject and body
        const { subject, body } = extractSubjectAndBody(mergedTemplate);

        // Create draft file
        const draftFilename = `draft-poll-${participant.email}.txt`;
        const draftPath = path.join(outboxPath, draftFilename);

        const draftContent = `To: ${participant.email}\nSubject: ${subject}\n\n${body}`;
        fs.writeFileSync(draftPath, draftContent, 'utf-8');

        console.log(`  ✓ ${draftFilename} - created`);

        // Update participant row in Poll.md
        updateParticipantRow(pollFilePath, participant.email, {
          polledOn: formattedDate
        });

      } catch (error) {
        console.error(`  ✗ Failed for ${participant.email}: ${error.message}`);
      }
    }

    console.log(`\nUpdated Poll.md: Marked ${unpolledParticipants.length} participant${unpolledParticipants.length !== 1 ? 's' : ''} as polled on ${formattedDate}`);
    console.log(`\nSummary: ${unpolledParticipants.length} invitation draft${unpolledParticipants.length !== 1 ? 's' : ''} created in outbox/`);
    console.log('Next: Review drafts, then run /poll-send-emails to send via Gmail\n');

  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
}

main().catch(error => {
  console.error(`Fatal error: ${error.message}`);
  process.exit(1);
});
