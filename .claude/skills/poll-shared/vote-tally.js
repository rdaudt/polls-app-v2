/**
 * Vote Tallying Utilities
 *
 * Tallies votes from responses and determines the frontrunner choice.
 */

/**
 * Tally all votes and determine the frontrunner
 *
 * Algorithm:
 * 1. Filter to latest response per participant (by timestamp)
 * 2. Count Yes and As Needed votes for each choice
 * 3. Sort by: most Yes votes (desc), then most As Needed (desc), then lowest choice number (asc)
 * 4. Return tally array and frontrunner choice
 *
 * @param {Array} responses - Response objects from Poll.md
 *   Each response: { participant, choice, timestamp, responseType }
 *   - participant: String (participant name)
 *   - choice: Number (choice number 1, 2, 3, etc.)
 *   - timestamp: String (ISO8601 timestamp)
 *   - responseType: String ('Yes' or 'As Needed')
 * @param {number} participantCount - Total number of participants
 * @returns {object} {
 *   tally: [{ choiceNumber, yesCount, asNeededCount }, ...],
 *   frontrunner: { choiceNumber, yesCount, asNeededCount } or null,
 *   totalResponses: number
 * }
 */
function tallyVotes(responses, participantCount) {
  if (!responses || responses.length === 0) {
    return {
      tally: [],
      frontrunner: null,
      totalResponses: 0
    };
  }

  // Step 1: Filter to latest response per participant
  // Group responses by participant and find the latest timestamp
  const responsesByParticipant = {};

  responses.forEach(response => {
    const key = response.participant.toLowerCase(); // Case-insensitive

    if (!responsesByParticipant[key]) {
      responsesByParticipant[key] = [];
    }
    responsesByParticipant[key].push(response);
  });

  // For each participant, find the latest timestamp and keep ALL responses with that timestamp
  const latestResponses = [];

  Object.entries(responsesByParticipant).forEach(([participant, participantResponses]) => {
    // Find the latest timestamp for this participant
    const latestTimestamp = participantResponses.reduce((latest, response) => {
      const responseDate = new Date(response.timestamp);
      return !latest || responseDate > latest ? responseDate : latest;
    }, null);

    // Keep all responses with the latest timestamp
    participantResponses.forEach(response => {
      if (new Date(response.timestamp).getTime() === latestTimestamp.getTime()) {
        latestResponses.push(response);
      }
    });
  });

  // Step 2: Count votes for each choice
  const choiceTallyMap = {};

  latestResponses.forEach(response => {
    const choice = response.choice;
    const responseType = response.responseType; // 'Yes' or 'As Needed'

    if (!choiceTallyMap[choice]) {
      choiceTallyMap[choice] = { yesCount: 0, asNeededCount: 0 };
    }

    if (responseType === 'Yes') {
      choiceTallyMap[choice].yesCount += 1;
    } else if (responseType === 'As Needed') {
      choiceTallyMap[choice].asNeededCount += 1;
    }
  });

  // Step 3: Build tally array and sort
  const tally = Object.keys(choiceTallyMap)
    .map(choiceNumber => ({
      choiceNumber: parseInt(choiceNumber),
      yesCount: choiceTallyMap[choiceNumber].yesCount,
      asNeededCount: choiceTallyMap[choiceNumber].asNeededCount
    }))
    .sort((a, b) => {
      // Primary: Most Yes votes (descending)
      if (a.yesCount !== b.yesCount) {
        return b.yesCount - a.yesCount;
      }

      // Secondary: Most As Needed votes (descending)
      if (a.asNeededCount !== b.asNeededCount) {
        return b.asNeededCount - a.asNeededCount;
      }

      // Tertiary: Lowest choice number (ascending)
      return a.choiceNumber - b.choiceNumber;
    });

  // Step 4: Determine frontrunner
  const frontrunner = tally.length > 0 ? tally[0] : null;

  return {
    tally,
    frontrunner,
    totalResponses: latestResponses.length
  };
}

/**
 * Get the frontrunner from tally results
 * @param {object} tally - Tally object from tallyVotes()
 * @returns {object} Frontrunner choice or null
 */
function getFrontrunner(tally) {
  return tally.frontrunner || null;
}

module.exports = {
  tallyVotes,
  getFrontrunner
};
