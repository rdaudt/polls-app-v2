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

/**
 * Parse Poll.md to get list of participants
 */
function parseParticipants(pollMdPath) {
  try {
    const content = fs.readFileSync(pollMdPath, 'utf8');
    const participants = new Set();

    // Look for Participants section and extract emails
    const participantsMatch = content.match(/## Participants[\s\S]*?(?=##|$)/);
    if (participantsMatch) {
      const lines = participantsMatch[0].split('\n');
      for (const line of lines) {
        // Match email pattern
        const emailMatch = line.match(/[\w.-]+@[\w.-]+\.\w+/);
        if (emailMatch) {
          participants.add(emailMatch[0].toLowerCase());
        }
      }
    }

    return participants;
  } catch (err) {
    logger.error('Error parsing participants: ' + err.message);
    return new Set();
  }
}

/**
 * Format date string for response file
 */
function formatDate(dateString) {
  try {
    const date = new Date(dateString);
    return date.toISOString().replace('T', ' ').slice(0, 19) + ' UTC';
  } catch {
    return dateString;
  }
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

    // Validate config
    if (!config.pollsEmailSubjectPrefix) {
      logger.error('pollsEmailSubjectPrefix not set in polls-config.json');
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

    // Parse participants from Poll.md
    const participants = parseParticipants(pollMdPath);
    if (participants.size === 0) {
      logger.warn('No participants found in Poll.md');
    } else {
      logger.debug('Found ' + participants.size + ' participant(s)');
    }

    // Build search query
    const query = fetchAll
      ? 'subject:"' + config.pollsEmailSubjectPrefix + '"'
      : 'is:unread subject:"' + config.pollsEmailSubjectPrefix + '"';

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

    // Process each message
    let fetched = 0;
    let skipped = 0;
    let errors = 0;

    logger.info('Processing responses:');

    // Create label if configured
    let labelId = null;
    if (config.pollsEmailLabel) {
      labelId = await gmailHelpers.getOrCreateLabel(gmail, config.pollsEmailLabel);
    }

    for (const message of messages) {
      try {
        // Fetch full message
        const res = await gmail.users.messages.get({
          userId: 'me',
          id: message.id,
          format: 'full'
        });

        const msg = res.data;
        const headers = msg.payload.headers || [];

        // Extract headers
        const from = headers.find(h => h.name === 'From')?.value || '';
        const date = headers.find(h => h.name === 'Date')?.value || '';
        const subject = headers.find(h => h.name === 'Subject')?.value || '';

        // Extract email from "Name <email@domain.com>" format
        const emailMatch = from.match(/[\w.-]+@[\w.-]+\.\w+/);
        const senderEmail = emailMatch ? emailMatch[0].toLowerCase() : '';

        if (!senderEmail) {
          logger.warn('  ' + from + ' - skipped (invalid email)');
          skipped++;
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

        // Extract responses
        const responses = gmailHelpers.extractResponses(bodyText);
        if (responses.length === 0) {
          logger.warn('  ' + senderEmail + ' - skipped (no valid responses found)');
          skipped++;
          continue;
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

        logger.success('  ' + senderEmail + ' - saved as ' + filename);

        // Mark as read unless --keep-unread
        if (!keepUnread) {
          try {
            await gmail.users.messages.modify({
              userId: 'me',
              id: message.id,
              requestBody: {
                removeLabelIds: ['UNREAD']
              }
            });
          } catch (err) {
            logger.warn('    Could not mark as read: ' + err.message);
          }
        }

        // Apply label if configured
        if (labelId) {
          try {
            await gmail.users.messages.modify({
              userId: 'me',
              id: message.id,
              requestBody: {
                addLabelIds: [labelId]
              }
            });
          } catch (err) {
            logger.warn('    Could not apply label: ' + err.message);
          }
        }

        fetched++;
      } catch (err) {
        logger.error('  Error processing message ' + message.id + ': ' + err.message);
        errors++;
      }
    }

    logger.info('Summary: ' + fetched + ' responses fetched, ' + skipped + ' skipped');
    if (errors > 0) {
      logger.info(errors + ' errors encountered');
    }

    if (logger.isVerbose()) {
      logger.info('Response files ready in: ' + inboxFolder);
      if (fetched > 0) {
        logger.info('Next: run /poll-process-responses to update Poll.md');
      }
    }
    logger.summary('Fetched ' + fetched + ' response(s)');

    process.exit(errors > 0 ? 1 : 0);
  } catch (err) {
    logger.error('Error: ' + err.message);
    process.exit(1);
  }
}

main();
