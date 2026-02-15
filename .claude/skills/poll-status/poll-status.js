/**
 * Poll Status Skill
 * 
 * Displays the current state of the active poll (read-only).
 * Shows vote tally, frontrunner, and response status.
 */

const fs = require('fs');
const path = require('path');
const { parsePollFile } = require('../poll-shared/poll-parser');
const { tallyVotes } = require('../poll-shared/vote-tally');

// Load configuration
function loadConfig() {
  const configPath = path.resolve(process.cwd(), 'polls-config.json');
  if (!fs.existsSync(configPath)) {
    throw new Error('polls-config.json not found in current directory');
  }
  return JSON.parse(fs.readFileSync(configPath, 'utf-8'));
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

    if (!fs.existsSync(pollFilePath)) {
      throw new Error(`Poll.md not found at ${pollFilePath}`);
    }

    // Parse poll data
    const pollData = parsePollFile(pollFilePath);

    // Count respondents (those with respondedOn date)
    const respondents = pollData.participants.filter(p => p.respondedOn && p.respondedOn.trim());
    const respondentCount = respondents.length;
    const totalParticipants = pollData.participants.length;

    // Get non-respondents
    const nonRespondents = pollData.participants
      .filter(p => !p.respondedOn || !p.respondedOn.trim())
      .map(p => p.name);

    // Tally votes
    const tally = tallyVotes(pollData.responses, totalParticipants);

    // Display poll status
    console.log(`\n📊 Poll Status: ${pollData.pollTitle}\n`);

    console.log(`Event: ${pollData.description.eventTitle}`);
    console.log(`Organizer: ${pollData.description.organizer} (${pollData.description.organizerEmail})`);
    console.log(`Title: ${pollData.description.organizerTitle}`);
    console.log(`Deadline: ${pollData.description.deadline}`);
    console.log(`\nParticipants: ${respondentCount} / ${totalParticipants} responded\n`);

    // Display vote tally
    if (pollData.choices.length > 0 && tally.tally.length > 0) {
      console.log('Vote Tally:');
      console.log('  Choice  Date/Time               Yes  As Needed');
      console.log('  ------  ----------------------  ---  ---------');

      tally.tally.forEach(result => {
        const choice = pollData.choices[result.choiceNumber - 1];
        const formattedChoice = choice.padEnd(22);
        const yesStr = result.yesCount.toString().padEnd(3);
        const asNeededStr = result.asNeededCount.toString().padEnd(9);
        console.log(`  ${result.choiceNumber}       ${formattedChoice}  ${yesStr}  ${asNeededStr}`);
      });

      // Display frontrunner
      if (tally.frontrunner) {
        const winnerChoice = pollData.choices[tally.frontrunner.choiceNumber - 1];
        console.log(`\n🏆 Frontrunner: Choice ${tally.frontrunner.choiceNumber} (${winnerChoice})`);
        console.log(`   ${tally.frontrunner.yesCount} Yes, ${tally.frontrunner.asNeededCount} As Needed`);
      } else {
        console.log('\nNo votes yet.');
      }
    } else {
      console.log('No choices or votes yet.');
    }

    // Display current state
    console.log('\nCurrent State:');

    // Check if invitations have been sent
    const invitationsSent = pollData.participants.some(p => p.polledOn && p.polledOn.trim());
    console.log(`  - Invitations sent: ${invitationsSent ? 'Yes' : 'No'}`);

    // Responses received
    console.log(`  - Responses received: ${respondentCount} / ${totalParticipants}`);

    // Non-respondents
    if (nonRespondents.length > 0) {
      console.log(`  - Non-respondents: ${nonRespondents.join(', ')}`);
    }

    // Check if reminders have been sent
    const remindersSent = pollData.participants.some(p => p.remindedOn && p.remindedOn.trim());
    if (remindersSent) {
      console.log(`  - Reminders sent: Yes`);
    }

    // Check if results communicated
    const resultsCommunicated = pollData.participants.some(p => p.resultsCommunicatedOn && p.resultsCommunicatedOn.trim());
    if (resultsCommunicated) {
      console.log(`  - Results communicated: Yes`);
    }

    console.log('');

  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
}

main().catch(error => {
  console.error(`Fatal error: ${error.message}`);
  process.exit(1);
});
