const fs = require('fs');
const path = require('path');
const logger = require('../poll-shared/logger');
const { parsePollFile, updateParticipantRow, addResponse, updateCurrentState } = require('../poll-shared/poll-parser');
const { convertDateTime } = require('../poll-shared/tz-converter');
const { tallyVotes } = require('../poll-shared/vote-tally');

function loadConfig() {
  const configPath = path.resolve(process.cwd(), 'polls-config.json');
  if (!fs.existsSync(configPath)) {
    throw new Error('polls-config.json not found');
  }
  return JSON.parse(fs.readFileSync(configPath, 'utf-8'));
}

function parseResponseFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');

  const result = {
    from: null,
    date: null,
    subject: null,
    choices: []
  };

  let inBody = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (line.startsWith('From:')) {
      result.from = line.substring(5).trim();
    } else if (line.startsWith('Date:')) {
      result.date = line.substring(5).trim();
    } else if (line.startsWith('Subject:')) {
      result.subject = line.substring(8).trim();
    } else if (line.trim() === '' && !inBody) {
      inBody = true;
    } else if (inBody && line.trim()) {
      const match = line.trim().match(/^(\d+):\s*(Yes|As\s+Needed)$/i);
      if (match) {
        const responseType = match[2].toLowerCase().includes('needed') ? 'As Needed' : 'Yes';
        result.choices.push({
          choiceNumber: parseInt(match[1]),
          responseType: responseType
        });
      }
    }
  }

  return result;
}

function validateResponseFile(response) {
  if (!response.from) {
    return { valid: false, error: 'Missing From field' };
  }
  if (!response.date) {
    return { valid: false, error: 'Missing Date field' };
  }
  if (response.choices.length === 0) {
    return { valid: false, error: 'No choices found' };
  }
  return { valid: true };
}

async function main() {
  try {
    const config = loadConfig();

    if (!config.pollsRoot || !config.activePoll) {
      throw new Error('pollsRoot and activePoll not configured');
    }

    const pollPath = path.join(config.pollsRoot, config.activePoll);
    const pollFilePath = path.join(pollPath, 'Poll.md');
    const inboxFolder = config.inboxFolder || path.join(pollPath, 'inbox');
    const processedFolder = path.join(inboxFolder, 'processed');

    if (!fs.existsSync(pollFilePath)) {
      throw new Error(`Poll.md not found at ${pollFilePath}`);
    }

    if (!fs.existsSync(inboxFolder)) {
      fs.mkdirSync(inboxFolder, { recursive: true });
    }
    if (!fs.existsSync(processedFolder)) {
      fs.mkdirSync(processedFolder, { recursive: true });
    }

    const pollData = parsePollFile(pollFilePath);
    const files = fs.readdirSync(inboxFolder);
    const responseFiles = files.filter(f => f.endsWith('.txt') && !f.startsWith('processed'));

    if (responseFiles.length === 0) {
      logger.summary('No response files found in inbox.');
      return;
    }

    logger.info('Processing poll responses...');
    logger.debug('Found ' + responseFiles.length + ' response file' + (responseFiles.length !== 1 ? 's' : '') + ' in inbox/');
    logger.info('Processing:');

    let successCount = 0;
    let skipCount = 0;

    for (const filename of responseFiles) {
      const filePath = path.join(inboxFolder, filename);

      try {
        const response = parseResponseFile(filePath);
        const validation = validateResponseFile(response);

        if (!validation.valid) {
          logger.warn('  ' + filename + ' - Skipped: ' + validation.error);
          skipCount++;
          continue;
        }

        const participant = pollData.participants.find(
          p => p.email.toLowerCase() === response.from.toLowerCase()
        );

        if (!participant) {
          logger.warn('  ' + filename + ' - Skipped: ' + response.from + ' not in participants');
          skipCount++;
          continue;
        }

        let validChoicesCount = 0;
        const convertedDate = convertDateTime(
          response.date,
          participant.tz,
          pollData.description.organizerTZ
        );

        for (const choice of response.choices) {
          if (choice.choiceNumber < 1 || choice.choiceNumber > pollData.choices.length) {
            logger.warn('  ' + filename + ' - Warning: Invalid choice ' + choice.choiceNumber);
            continue;
          }

          addResponse(
            pollFilePath,
            participant.name,
            choice.choiceNumber,
            convertedDate,
            choice.responseType
          );
          validChoicesCount++;
        }

        updateParticipantRow(pollFilePath, participant.email, {
          respondedOn: convertedDate
        });

        logger.success('  ' + filename + ' - ' + validChoicesCount + ' choice' + (validChoicesCount !== 1 ? 's' : '') + ' recorded');
        successCount++;

        const newPath = path.join(processedFolder, filename);
        fs.renameSync(filePath, newPath);

      } catch (error) {
        logger.warn('  ' + filename + ' - Error: ' + error.message);
        skipCount++;
      }
    }

    const updatedPollData = parsePollFile(pollFilePath);
    const tally = tallyVotes(updatedPollData.responses, updatedPollData.participants.length);
    const respondents = updatedPollData.participants.filter(p => p.respondedOn && p.respondedOn.trim());

    updateCurrentState(pollFilePath, {
      responsesReceived: `${respondents.length} / ${updatedPollData.participants.length}`,
      frontrunner: tally.frontrunner ? tally.frontrunner.choiceNumber : null
    });

    logger.info('Updated Poll.md:');
    logger.info('  - Recorded ' + successCount + ' response' + (successCount !== 1 ? 's' : ''));
    logger.info('  - Marked ' + respondents.length + ' participant' + (respondents.length !== 1 ? 's' : '') + ' as responded');
    logger.info('  - Updated vote tally');

    if (tally.frontrunner) {
      const choice = updatedPollData.choices[tally.frontrunner.choiceNumber - 1];
      logger.info('  - Current frontrunner: Choice ' + tally.frontrunner.choiceNumber + ' (' + choice + ')');
    }

    logger.info('Moved ' + successCount + ' response file' + (successCount !== 1 ? 's' : '') + ' to inbox/processed/');
    if (logger.isVerbose()) {
      logger.info('Next: Run /poll-status to see updated tally');
    }
    logger.summary('Processed ' + successCount + ' response' + (successCount !== 1 ? 's' : '') + ', ' + skipCount + ' skipped');

  } catch (error) {
    logger.error('Error: ' + error.message);
    process.exit(1);
  }
}

main().catch(error => {
  logger.error('Fatal error: ' + error.message);
  process.exit(1);
});
