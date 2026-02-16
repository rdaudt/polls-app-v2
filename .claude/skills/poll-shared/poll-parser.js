/**
 * Poll.md Parser and Updater
 *
 * Safely parses and updates Poll.md files while preserving formatting.
 * Poll.md is the single source of truth for all poll data.
 */

const fs = require('fs');

/**
 * Parse a complete Poll.md file
 *
 * @param {string} filePath - Absolute path to Poll.md
 * @returns {object} Parsed poll data structure
 * @throws {Error} If file not found or format is invalid
 */
function parsePollFile(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Poll.md not found: ${filePath}`);
  }

  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');

  const result = {
    pollTitle: '',
    description: {
      eventTitle: '',
      organizer: '',
      organizerEmail: '',
      organizerTitle: '',
      organizerTZ: '',
      deadline: ''
    },
    participants: [],
    choices: [],
    responses: [],
    currentState: {
      invitationsSent: false,
      responsesReceived: '0 / 0',
      nonRespondents: [],
      frontrunner: null
    }
  };

  let currentSection = null;
  let tableMode = false;
  let tableHeaders = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Detect section headers
    if (line.startsWith('## Poll description')) {
      currentSection = 'description';
      tableMode = false;
      continue;
    } else if (line.startsWith('## Participants')) {
      currentSection = 'participants';
      tableMode = true;
      continue;
    } else if (line.startsWith('## Date/time choices')) {
      currentSection = 'choices';
      tableMode = false;
      continue;
    } else if (line.startsWith('## Responses')) {
      currentSection = 'responses';
      tableMode = true;
      continue;
    } else if (line.startsWith('## Current state')) {
      currentSection = 'state';
      tableMode = false;
      continue;
    }

    // Parse based on current section
    if (currentSection === 'description') {
      const match = line.match(/^([^:]+):\s*(.*)$/);
      if (match) {
        const key = match[1].trim();
        const value = match[2].trim();
        if (key === 'Poll title') result.pollTitle = value;
        else if (key === 'Event name') result.description.eventTitle = value;
        else if (key === 'Organizer') result.description.organizer = value;
        else if (key === 'Organizer email') result.description.organizerEmail = value;
        else if (key === 'Organizer title') result.description.organizerTitle = value;
        else if (key === 'Organizer time zone') result.description.organizerTZ = value;
        else if (key === 'Deadline for Responses') result.description.deadline = value;
      }
    } else if (currentSection === 'participants') {
      if (line.startsWith('|') && (line.includes('----') || line.includes('Name'))) {
        // Header row or separator line - skip
        continue;
      } else if (line.startsWith('|')) {
        const rawCells = line.split('|');
        const cells = rawCells.slice(1, rawCells.length - 1).map(c => c.trim());
        if (cells.length >= 3) {
          result.participants.push({
            name: cells[0],
            email: cells[1],
            tz: cells[2],
            polledOn: cells[3] || '',
            respondedOn: cells[4] || '',
            remindedOn: cells[5] || '',
            resultsCommunicatedOn: cells[6] || ''
          });
        }
      }
    } else if (currentSection === 'choices') {
      const match = line.match(/^\d+\.\s+(.+)$/);
      if (match) {
        result.choices.push(match[1].trim());
      }
    } else if (currentSection === 'responses') {
      if (line.startsWith('|') && (line.includes('----') || line.includes('Date/time'))) {
        // Header row or separator line - skip
        continue;
      } else if (line.startsWith('|')) {
        const rawCells = line.split('|');
        const cells = rawCells.slice(1, rawCells.length - 1).map(c => c.trim());
        if (cells.length >= 5) {
          // Parse Yes and As needed columns (comma-separated choice numbers)
          const yesChoices = cells[3] ? cells[3].split(',').map(x => x.trim()).filter(x => x) : [];
          const asNeededChoices = cells[4] ? cells[4].split(',').map(x => x.trim()).filter(x => x) : [];

          for (const choice of yesChoices) {
            result.responses.push({
              participant: cells[1],
              choice: parseInt(choice),
              timestamp: cells[0],
              responseType: 'Yes'
            });
          }

          for (const choice of asNeededChoices) {
            result.responses.push({
              participant: cells[1],
              choice: parseInt(choice),
              timestamp: cells[0],
              responseType: 'As Needed'
            });
          }
        }
      }
    } else if (currentSection === 'state') {
      const match = line.match(/^([^:]+):\s*(.*)$/);
      if (match) {
        const key = match[1].trim();
        const value = match[2].trim();
        if (key === 'Count of participants who responded') {
          result.currentState.responsesReceived = value;
        } else if (key === 'Frontrunner choice') {
          result.currentState.frontrunner = value ? parseInt(value) : null;
        }
      }
    }
  }

  return result;
}

/**
 * Update a participant's row in Poll.md
 *
 * @param {string} filePath - Path to Poll.md
 * @param {string} participantEmail - Email to match (case-insensitive)
 * @param {object} updates - Fields to update: {polledOn, respondedOn, remindedOn, resultsCommunicatedOn}
 * @throws {Error} If participant not found or file error
 */
function updateParticipantRow(filePath, participantEmail, updates) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');

  let inParticipantsSection = false;
  let updated = false;

  for (let i = 0; i < lines.length; i++) {
    if (lines[i].startsWith('## Participants')) {
      inParticipantsSection = true;
      continue;
    } else if (lines[i].startsWith('##') && i > 0) {
      inParticipantsSection = false;
      continue;
    }

    if (inParticipantsSection && lines[i].startsWith('|') && !lines[i].includes('----')) {
      const cells = lines[i].split('|').map(c => c.trim()).filter((c, idx) => idx > 0 && idx < lines[i].split('|').length - 1);
      if (cells[1] && cells[1].toLowerCase() === participantEmail.toLowerCase()) {
        // Found the participant - update their row
        const name = cells[0];
        const email = cells[1];
        const tz = cells[2];
        const polledOn = updates.polledOn !== undefined ? updates.polledOn : cells[3];
        const respondedOn = updates.respondedOn !== undefined ? updates.respondedOn : cells[4];
        const remindedOn = updates.remindedOn !== undefined ? updates.remindedOn : cells[5];
        const resultsCommunicatedOn = updates.resultsCommunicatedOn !== undefined ? updates.resultsCommunicatedOn : cells[6];

        lines[i] = `| ${name} | ${email} | ${tz} | ${polledOn} | ${respondedOn} | ${remindedOn} | ${resultsCommunicatedOn} |`;
        updated = true;
        break;
      }
    }
  }

  if (!updated) {
    throw new Error(`Participant not found: ${participantEmail}`);
  }

  fs.writeFileSync(filePath, lines.join('\n'), 'utf-8');
}

/**
 * Add a response to the Responses table
 *
 * @param {string} filePath - Path to Poll.md
 * @param {string} participantName - Participant name
 * @param {number} choiceNumber - Choice number (1, 2, 3, etc.)
 * @param {string} timestamp - ISO8601 or formatted timestamp
 * @param {string} responseType - 'Yes' or 'As Needed'
 * @throws {Error} If file error
 */
function addResponse(filePath, participantName, choiceNumber, timestamp, responseType = 'Yes') {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');

  let inResponsesSection = false;
  let responseTableEndIndex = -1;

  for (let i = 0; i < lines.length; i++) {
    if (lines[i].startsWith('## Responses')) {
      inResponsesSection = true;
      continue;
    } else if (lines[i].startsWith('##') && i > 0 && inResponsesSection) {
      responseTableEndIndex = i;
      break;
    }
  }

  if (responseTableEndIndex === -1) {
    responseTableEndIndex = lines.length;
  }

  // Parse Poll.md to get participant email
  const pollData = parsePollFile(filePath);
  const participant = pollData.participants.find(p => p.name === participantName);
  const email = participant ? participant.email : 'unknown@example.com';

  // Format timestamp
  const formattedTimestamp = timestamp.includes(',') ? timestamp : new Date(timestamp).toLocaleString();

  // Build new response row
  const newRow = `| ${formattedTimestamp} | ${participantName} | ${email} | ${choiceNumber} | |`;

  // Find the insertion point (after header row, before next section)
  let insertIndex = -1;
  for (let i = 0; i < responseTableEndIndex; i++) {
    if (lines[i].startsWith('## Responses')) {
      // Skip header and separator
      insertIndex = i + 3;
      break;
    }
  }

  if (insertIndex === -1) {
    // Responses section not found - create it
    lines.push('');
    lines.push('## Responses');
    lines.push('| Date/time | Name | Email | Yes | As needed |');
    lines.push('| --------- | ---- | ----- | --- | --------- |');
    lines.push(newRow);
  } else {
    lines.splice(insertIndex, 0, newRow);
  }

  fs.writeFileSync(filePath, lines.join('\n'), 'utf-8');
}

/**
 * Update the Current state section
 *
 * @param {string} filePath - Path to Poll.md
 * @param {object} state - Fields to update
 * @throws {Error} If file error
 */
function updateCurrentState(filePath, state) {
  const content = fs.readFileSync(filePath, 'utf-8');
  let lines = content.split('\n');

  let currentStateIndex = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].startsWith('## Current state')) {
      currentStateIndex = i;
      break;
    }
  }

  if (currentStateIndex === -1) {
    // Create Current state section
    lines.push('');
    lines.push('## Current state');
    lines.push(`Assessed on: ${new Date().toLocaleString()}`);
    if (state.responsesReceived) {
      lines.push(`Count of participants who responded: ${state.responsesReceived}`);
    }
    if (state.frontrunner) {
      lines.push(`Frontrunner choice: ${state.frontrunner}`);
    }
    lines.push('Frontrunner choice overwrite:');
  } else {
    // Update existing section
    const nextSectionIndex = lines.findIndex((l, i) => i > currentStateIndex && l.startsWith('##'));
    const endIndex = nextSectionIndex === -1 ? lines.length : nextSectionIndex;

    // Find and update each field
    let found = {
      assessedOn: false,
      responded: false,
      frontrunner: false,
      overwrite: false
    };

    for (let i = currentStateIndex + 1; i < endIndex; i++) {
      if (lines[i].startsWith('Assessed on:')) {
        lines[i] = `Assessed on: ${new Date().toLocaleString()}`;
        found.assessedOn = true;
      } else if (lines[i].startsWith('Count of participants who responded:')) {
        if (state.responsesReceived) {
          lines[i] = `Count of participants who responded: ${state.responsesReceived}`;
          found.responded = true;
        }
      } else if (lines[i].startsWith('Frontrunner choice:')) {
        if (state.frontrunner) {
          lines[i] = `Frontrunner choice: ${state.frontrunner}`;
          found.frontrunner = true;
        }
      } else if (lines[i].startsWith('Frontrunner choice overwrite:')) {
        found.overwrite = true;
      }
    }

    // Add missing fields
    let insertIndex = endIndex - 1;
    if (!found.assessedOn) {
      lines.splice(insertIndex, 0, `Assessed on: ${new Date().toLocaleString()}`);
      insertIndex++;
    }
    if (!found.responded && state.responsesReceived) {
      lines.splice(insertIndex, 0, `Count of participants who responded: ${state.responsesReceived}`);
      insertIndex++;
    }
    if (!found.frontrunner && state.frontrunner) {
      lines.splice(insertIndex, 0, `Frontrunner choice: ${state.frontrunner}`);
      insertIndex++;
    }
    if (!found.overwrite) {
      lines.splice(insertIndex, 0, 'Frontrunner choice overwrite:');
    }
  }

  fs.writeFileSync(filePath, lines.join('\n'), 'utf-8');
}

module.exports = {
  parsePollFile,
  updateParticipantRow,
  addResponse,
  updateCurrentState
};
