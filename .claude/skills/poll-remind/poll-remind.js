/**
 * Poll Remind Skill
 * 
 * Generates reminder draft emails for participants who haven't responded yet.
 * Creates draft-reminder-*.txt files in the outbox folder.
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

// Format date for participant column
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

    // Find non-respondents (polled but not responded)
    const nonRespondents = pollData.participants.filter(p =>
      (p.polledOn && p.polledOn.trim()) &&
      (!p.respondedOn || !p.respondedOn.trim())
    );

    if (nonRespondents.length === 0) {
      console.log('\nAll participants have responded or haven\'t been polled yet.');
      return;
    }

    console.log(`\nCreating reminder drafts...\n`);
    console.log(`Found ${nonRespondents.length} non-respondent${nonRespondents.length !== 1 ? 's' : ''}:`);
    nonRespondents.forEach(p => {
      console.log(`  - ${p.email} (${p.name}) - polled on ${p.polledOn}, no response yet`);
    });

    // Read template
    const templatePath = path.join(pollPath, 'Poll reminder email.md');
    if (!fs.existsSync(templatePath)) {
      throw new Error(`Template not found: ${templatePath}`);
    }

    const templateContent = fs.readFileSync(templatePath, 'utf-8');
    const formattedDate = getFormattedDate();

    console.log('\nMerging templates and creating drafts...');

    // Generate reminders for each non-respondent
    for (const participant of nonRespondents) {
      try {
        // Merge template
        const mergedTemplate = mergeTemplate(templateContent, pollData.description, participant, {
          nowDateTime: new Date().toISOString()
        });

        // Extract subject and body
        const { subject, body } = extractSubjectAndBody(mergedTemplate);

        // Create draft file
        const draftFilename = `draft-reminder-${participant.email}.txt`;
        const draftPath = path.join(outboxPath, draftFilename);

        const draftContent = `To: ${participant.email}\nSubject: ${subject}\n\n${body}`;
        fs.writeFileSync(draftPath, draftContent, 'utf-8');

        console.log(`  ✓ ${draftFilename} - created`);

        // Update participant row in Poll.md
        updateParticipantRow(pollFilePath, participant.email, {
          remindedOn: formattedDate
        });

      } catch (error) {
        console.error(`  ✗ Failed for ${participant.email}: ${error.message}`);
      }
    }

    console.log(`\nUpdated Poll.md: Marked ${nonRespondents.length} participant${nonRespondents.length !== 1 ? 's' : ''} as reminded on ${formattedDate}`);
    console.log(`\nSummary: ${nonRespondents.length} reminder draft${nonRespondents.length !== 1 ? 's' : ''} created in outbox/`);
    console.log('Next: Review drafts, then run /poll-send-emails --type reminder to send\n');

  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
}

main().catch(error => {
  console.error(`Fatal error: ${error.message}`);
  process.exit(1);
});
