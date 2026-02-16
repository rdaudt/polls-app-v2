#!/usr/bin/env node

/**
 * Poll Fetch Responses Skill
 * Fetches poll responses from Gmail and saves as text files
 */

const fs = require('fs');
const path = require('path');
const logger = require('../poll-shared/logger');
const gmailAuth = require('../poll-shared/gmail-auth');
const gmailHelpers = require('../poll-shared/gmail-helpers');
const { parsePollFile } = require('../poll-shared/poll-parser');
const { extractResponsesWithNLP } = require('../poll-shared/nlp-response-parser');

/**
 * Format date string for response file
 * Expected format: "Mon DD, YYYY, HH:MM" (e.g., "Feb 16, 2026, 01:58")
 */
function formatDate(dateString) {
  try {
    const date = new Date(dateString);
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const month = months[date.getMonth()];
    const day = date.getDate();
    const year = date.getFullYear();
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${month} ${day}, ${year}, ${hours}:${minutes}`;
  } catch {
    return dateString;
  }
}

/**
 * Parse a "Polled on" date string (e.g., "Feb 15, 2026, 09:00") into a Date object
 */
function parsePolledOnDate(dateStr) {
  const months = { Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5, Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11 };
  const match = dateStr.match(/(\w{3})\s+(\d{1,2}),\s*(\d{4})/);
  if (!match) return null;
  const [, mon, day, year] = match;
  if (!(mon in months)) return null;
  return new Date(parseInt(year), months[mon], parseInt(day));
}

async function main() {
  try {
    const args = process.argv.slice(2);
    const keepUnread = args.includes('--keep-unread');
    const fetchAll = args.includes('--all');

    // Load config
    let config;
    try {
      const configPath = path.join(process.cwd(), 'polls-config.json');
      config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    } catch (err) {
      logger.error('Error loading polls-config.json: ' + err.message);
      process.exit(1);
    }

    // Check Gmail authentication
    if (!gmailAuth.isAuthenticated()) {
      logger.error('Gmail not configured');
      logger.error('Run: /poll-gmail-setup');
      process.exit(1);
    }

    const authClient = await gmailAuth.getAuthClient();
    if (!authClient) {
      logger.error('Gmail authentication failed');
      logger.error('Run: /poll-gmail-setup');
      process.exit(1);
    }

    const gmail = gmailAuth.createGmailClient(authClient);
    const pollFolder = path.join(config.pollsRoot, config.activePoll);
    const pollMdPath = path.join(pollFolder, 'Poll.md');
    const inboxFolder = config.inboxFolder;

    logger.info('Fetching poll responses from Gmail...');

    // Create inbox folder if it doesn't exist
    if (!fs.existsSync(inboxFolder)) {
      fs.mkdirSync(inboxFolder, { recursive: true });
    }

    // Parse Poll.md using shared parser
    let pollData;
    try {
      pollData = parsePollFile(pollMdPath);
    } catch (err) {
      logger.error('Error parsing Poll.md: ' + err.message);
      process.exit(1);
    }

    const participants = new Set(pollData.participants.map(p => p.email.toLowerCase()));
    const eventTitle = pollData.description.eventTitle;
    const organizerEmail = (pollData.description.organizerEmail || '').toLowerCase();
    const polledOnDates = pollData.participants.map(p => p.polledOn).filter(Boolean);
    const pollChoices = pollData.choices;

    if (participants.size === 0) {
      logger.warn('No participants found in Poll.md');
    } else {
      logger.debug('Found ' + participants.size + ' participant(s)');
    }

    // Build smart search query using multiple signals
    const participantEmails = Array.from(participants);
    const fromClause = participantEmails.length > 0
      ? 'from:(' + participantEmails.join(' OR ') + ')'
      : '';

    const subjectTerms = [];
    if (eventTitle) {
      subjectTerms.push('subject:"' + eventTitle + '"');
    }
    if (config.pollsEmailSubjectPrefix) {
      subjectTerms.push('subject:"' + config.pollsEmailSubjectPrefix + '"');
    }
    subjectTerms.push('subject:"Date/Time Poll"');

    const subjectClause = subjectTerms.length > 1
      ? '{' + subjectTerms.join(' ') + '}'
      : subjectTerms[0] || '';

    // Date filter: only fetch emails after invitations were sent
    let afterClause = '';
    if (polledOnDates.length > 0) {
      const dates = polledOnDates.map(parsePolledOnDate).filter(d => d && !isNaN(d.getTime()));
      if (dates.length > 0) {
        dates.sort((a, b) => a - b);
        const earliest = dates[0];
        const yyyy = earliest.getFullYear();
        const mm = String(earliest.getMonth() + 1).padStart(2, '0');
        const dd = String(earliest.getDate()).padStart(2, '0');
        afterClause = 'after:' + yyyy + '/' + mm + '/' + dd;
        logger.debug('Date filter: ' + afterClause);
      }
    }

    const readFilter = fetchAll ? '' : 'is:unread';
    const query = [fromClause, subjectClause, afterClause, readFilter].filter(Boolean).join(' ');

    logger.debug('Searching for: ' + query);

    // Search for matching emails
    let messages;
    try {
      const res = await gmail.users.messages.list({
        userId: 'me',
        q: query,
        maxResults: 50
      });
      messages = res.data.messages || [];
    } catch (err) {
      logger.error('Gmail search failed: ' + err.message);
      process.exit(1);
    }

    logger.info('Found ' + messages.length + ' message(s)');

    if (messages.length === 0) {
      logger.summary('No matching responses found.');
      process.exit(0);
    }

    // Phase 1: Fetch all messages and extract metadata
    let fetched = 0;
    let skipped = 0;
    let errors = 0;
    let dedupSkipped = 0;
    let nlpCount = 0;

    logger.info('Processing responses:');

    // Create label if configured
    let labelId = null;
    if (config.pollsEmailLabel) {
      labelId = await gmailHelpers.getOrCreateLabel(gmail, config.pollsEmailLabel);
    }

    const messageDetails = [];
    for (const message of messages) {
      try {
        const res = await gmail.users.messages.get({
          userId: 'me',
          id: message.id,
          format: 'full'
        });

        const msg = res.data;
        const headers = msg.payload.headers || [];
        const from = headers.find(h => h.name === 'From')?.value || '';
        const date = headers.find(h => h.name === 'Date')?.value || '';
        const subject = headers.find(h => h.name === 'Subject')?.value || '';
        const emailMatch = from.match(/[\w.-]+@[\w.-]+\.\w+/);
        const senderEmail = emailMatch ? emailMatch[0].toLowerCase() : '';

        messageDetails.push({
          id: message.id,
          msg,
          from,
          date,
          subject,
          senderEmail,
          dateMs: new Date(date).getTime()
        });
      } catch (err) {
        logger.error('  Error fetching message ' + message.id + ': ' + err.message);
        errors++;
      }
    }

    // Phase 2: Dedup — keep only the newest message per sender
    const newestPerSender = new Map();
    for (const detail of messageDetails) {
      if (!detail.senderEmail) continue;
      const existing = newestPerSender.get(detail.senderEmail);
      if (!existing || detail.dateMs > existing.dateMs) {
        newestPerSender.set(detail.senderEmail, detail);
      }
    }
    const keptMessageIds = new Set(Array.from(newestPerSender.values()).map(d => d.id));
    if (messageDetails.length > keptMessageIds.size) {
      logger.debug('Dedup: keeping ' + keptMessageIds.size + ' of ' + messageDetails.length + ' messages (newest per participant)');
    }

    // Phase 3: Process messages — save only newest per sender, manage read/labels for all
    for (const detail of messageDetails) {
      const { id, msg, from, date, subject, senderEmail } = detail;
      const isNewest = keptMessageIds.has(id);

      if (!senderEmail) {
        logger.warn('  ' + from + ' - skipped (invalid email)');
        skipped++;
        continue;
      }

      // Mark as read and apply label for ALL messages (not just newest)
      if (!keepUnread) {
        try {
          await gmail.users.messages.modify({
            userId: 'me',
            id,
            requestBody: { removeLabelIds: ['UNREAD'] }
          });
        } catch (err) {
          logger.warn('  Could not mark as read: ' + err.message);
        }
      }
      if (labelId) {
        try {
          await gmail.users.messages.modify({
            userId: 'me',
            id,
            requestBody: { addLabelIds: [labelId] }
          });
        } catch (err) {
          logger.warn('  Could not apply label: ' + err.message);
        }
      }

      // Only save response file for the newest message per participant
      if (!isNewest) {
        logger.debug('  ' + senderEmail + ' - skipped older response (' + date + ')');
        dedupSkipped++;
        continue;
      }

      // Validate sender is a participant
      if (!participants.has(senderEmail)) {
        logger.warn('  ' + senderEmail + ' - skipped (not in participants list)');
        skipped++;
        continue;
      }

      // Parse email body
      const bodyText = gmailHelpers.parseEmailBody(msg);
      if (!bodyText) {
        logger.warn('  ' + senderEmail + ' - skipped (no body text)');
        skipped++;
        continue;
      }

      // Extract responses with NLP fallback
      const result = await extractResponsesWithNLP(bodyText, pollChoices);
      const responses = result.responses;

      if (responses.length === 0) {
        logger.warn('  ' + senderEmail + ' - skipped (no valid responses found)');
        if (bodyText) {
          logger.debug('    Body preview: ' + bodyText.substring(0, 200).replace(/\n/g, '\\n'));
        }
        skipped++;
        continue;
      }

      if (result.method === 'nlp') {
        nlpCount++;
      }

      // Format response file
      const responseContent = gmailHelpers.formatResponseFile(
        senderEmail,
        formatDate(date),
        subject,
        responses
      );

      // Generate filename: email-timestamp.txt
      const timestamp = Math.floor(new Date(date).getTime() / 1000);
      const sanitizedEmail = gmailHelpers.sanitizeFilename(senderEmail);
      const filename = `${sanitizedEmail}-${timestamp}.txt`;
      const filePath = path.join(inboxFolder, filename);

      // Save response file
      fs.writeFileSync(filePath, responseContent, 'utf8');

      const nlpTag = result.method === 'nlp' ? ' [NLP]' : '';
      logger.success('  ' + senderEmail + ' - saved as ' + filename + nlpTag);
      fetched++;
    }

    logger.info('Summary: ' + fetched + ' responses fetched, ' + skipped + ' skipped');
    if (nlpCount > 0) {
      logger.info(nlpCount + ' response(s) parsed via NLP');
    }
    if (dedupSkipped > 0) {
      logger.info(dedupSkipped + ' older duplicate(s) skipped');
    }
    if (errors > 0) {
      logger.info(errors + ' errors encountered');
    }

    if (logger.isVerbose()) {
      logger.info('Response files ready in: ' + inboxFolder);
      if (fetched > 0) {
        logger.info('Next: run /poll-process-responses to update Poll.md');
      }
    }
    logger.summary('Fetched ' + fetched + ' response(s)' + (nlpCount > 0 ? ' (' + nlpCount + ' via NLP)' : ''));

    process.exit(errors > 0 ? 1 : 0);
  } catch (err) {
    logger.error('Error: ' + err.message);
    process.exit(1);
  }
}

main();
