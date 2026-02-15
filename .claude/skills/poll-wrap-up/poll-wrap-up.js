const fs = require('fs');
const path = require('path');
const { parsePollFile, updateParticipantRow, updateCurrentState } = require('../poll-shared/poll-parser');
const { mergeTemplate, extractSubjectAndBody } = require('../poll-shared/template-engine');

function loadConfig() {
  const configPath = path.resolve(process.cwd(), 'polls-config.json');
  if (!fs.existsSync(configPath)) {
    throw new Error('polls-config.json not found');
  }
  return JSON.parse(fs.readFileSync(configPath, 'utf-8'));
}

function getFormattedDate() {
  const now = new Date();
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const m = months[now.getMonth()];
  const d = now.getDate();
  const y = now.getFullYear();
  const h = String(now.getHours()).padStart(2, '0');
  const min = String(now.getMinutes()).padStart(2, '0');
  return `${m} ${d}, ${y}, ${h}:${min}`;
}

async function main() {
  const args = process.argv.slice(2);
  
  try {
    if (!args[0]) {
      throw new Error('Usage: /poll-wrap-up <selected-choice>');
    }

    const selectedChoice = parseInt(args[0]);
    const config = loadConfig();

    if (!config.pollsRoot || !config.activePoll) {
      throw new Error('pollsRoot and activePoll not configured');
    }

    const pollPath = path.join(config.pollsRoot, config.activePoll);
    const pollFilePath = path.join(pollPath, 'Poll.md');
    const outboxPath = path.join(pollPath, 'outbox');

    if (!fs.existsSync(pollFilePath)) {
      throw new Error(`Poll.md not found`);
    }

    if (!fs.existsSync(outboxPath)) {
      fs.mkdirSync(outboxPath, { recursive: true });
    }

    const pollData = parsePollFile(pollFilePath);

    if (selectedChoice < 1 || selectedChoice > pollData.choices.length) {
      throw new Error(`Invalid choice: ${selectedChoice}. Valid range: 1-${pollData.choices.length}`);
    }

    const selectedDateTime = pollData.choices[selectedChoice - 1];
    const formattedDate = getFormattedDate();

    console.log(`\nWrapping up poll with selected choice: ${selectedChoice} (${selectedDateTime})\n`);
    console.log('Creating results drafts for all participants...\n');

    let respondentCount = 0;
    let nonRespondentCount = 0;

    for (const participant of pollData.participants) {
      const isRespondent = participant.respondedOn && participant.respondedOn.trim();
      const templateName = isRespondent 
        ? 'Poll results email template - Respondent.md'
        : 'Poll results email template - Non-Respondent.md';

      const templatePath = path.join(pollPath, templateName);
      if (!fs.existsSync(templatePath)) {
        throw new Error(`Template not found: ${templatePath}`);
      }

      const templateContent = fs.readFileSync(templatePath, 'utf-8');

      const merged = mergeTemplate(templateContent, pollData.description, participant, {
        selectedDateTime: selectedDateTime,
        nowDateTime: new Date().toISOString()
      });

      const { subject, body } = extractSubjectAndBody(merged);
      const draftFile = `draft-results-${participant.email}.txt`;
      const draftPath = path.join(outboxPath, draftFile);
      const draftContent = `To: ${participant.email}\nSubject: ${subject}\n\n${body}`;

      fs.writeFileSync(draftPath, draftContent, 'utf-8');

      updateParticipantRow(pollFilePath, participant.email, {
        resultsCommunicatedOn: formattedDate
      });

      const type = isRespondent ? 'respondent' : 'non-respondent';
      console.log(`  ✓ ${draftFile} - created (${type} template)`);

      if (isRespondent) {
        respondentCount++;
      } else {
        nonRespondentCount++;
      }
    }

    updateCurrentState(pollFilePath, {
      responsesReceived: `Poll completed on ${formattedDate}`
    });

    console.log(`\nUpdated Poll.md:`);
    console.log(`  - Marked all ${pollData.participants.length} participants as results communicated`);
    console.log(`  - Poll status: Completed\n`);
    console.log(`Summary: ${respondentCount + nonRespondentCount} results drafts created`);
    console.log(`  (${respondentCount} respondent${respondentCount !== 1 ? 's' : ''}, ${nonRespondentCount} non-respondent${nonRespondentCount !== 1 ? 's' : ''})`);
    console.log('Next: Review drafts, then run /poll-send-emails --type results to send\n');

  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
}

main().catch(error => {
  console.error(`Fatal: ${error.message}`);
  process.exit(1);
});
