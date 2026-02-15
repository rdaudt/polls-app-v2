#!/usr/bin/env node

/**
 * Poll Fetch Responses Skill
 * Fetches poll responses from Gmail and saves as text files
 */

const fs = require('fs');
const path = require('path');
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
    console.error('Error parsing participants:', err.message);
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
      console.error('✗ Error loading polls-config.json:', err.message);
      process.exit(1);
    }

    // Validate config
    if (!config.pollsEmailSubjectPrefix) {
      console.error('✗ pollsEmailSubjectPrefix not set in polls-config.json');
      process.exit(1);
    }

    // Check Gmail authentication
    if (!gmailAuth.isAuthenticated()) {
      console.error('\n✗ Gmail not configured');
      console.error('Run: /poll-gmail-setup');
      process.exit(1);
    }

    const authClient = await gmailAuth.getAuthClient();
    if (!authClient) {
      console.error('\n✗ Gmail authentication failed');
      console.error('Run: /poll-gmail-setup');
      process.exit(1);
    }

    const gmail = gmailAuth.createGmailClient(authClient);
    const pollFolder = path.join(config.pollsRoot, config.activePoll);
    const pollMdPath = path.join(pollFolder, 'Poll.md');
    const inboxFolder = config.inboxFolder;

    console.log('\n📧 Fetching poll responses from Gmail...\n');

    // Create inbox folder if it doesn't exist
    if (!fs.existsSync(inboxFolder)) {
      fs.mkdirSync(inboxFolder, { recursive: true });
    }

    // Parse participants from Poll.md
    const participants = parseParticipants(pollMdPath);
    if (participants.size === 0) {
      console.warn('⚠ No participants found in Poll.md');
    } else {
      console.log(`Found ${participants.size} participant(s)`);
    }

    // Build search query
    const query = fetchAll
      ? `subject:"${config.pollsEmailSubjectPrefix}"`
      : `is:unread subject:"${config.pollsEmailSubjectPrefix}"`;

    console.log(`\nSearching for: ${query}`);

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
      console.error('✗ Gmail search failed:', err.message);
      process.exit(1);
    }

    console.log(`Found ${messages.length} message(s)\n`);

    if (messages.length === 0) {
      console.log('No matching responses found.');
      process.exit(0);
    }

    // Process each message
    let fetched = 0;
    let skipped = 0;
    let errors = 0;

    console.log('Processing responses:');

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
          console.error(`  ✗ ${from} - skipped (invalid email)`);
          skipped++;
          continue;
        }

        // Validate sender is a participant
        if (!participants.has(senderEmail)) {
          console.error(`  ✗ ${senderEmail} - skipped (not in participants list)`);
          skipped++;
          continue;
        }

        // Parse email body
        const bodyText = gmailHelpers.parseEmailBody(msg);
        if (!bodyText) {
          console.error(`  ✗ ${senderEmail} - skipped (no body text)`);
          skipped++;
          continue;
        }

        // Extract responses
        const responses = gmailHelpers.extractResponses(bodyText);
        if (responses.length === 0) {
          console.error(`  ✗ ${senderEmail} - skipped (no valid responses found)`);
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

        console.log(`  ✓ ${senderEmail} - saved as ${filename}`);

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
            console.warn(`    ⚠ Could not mark as read:`, err.message);
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
            console.warn(`    ⚠ Could not apply label:`, err.message);
          }
        }

        fetched++;
      } catch (err) {
        console.error(`  ✗ Error processing message ${message.id}:`, err.message);
        errors++;
      }
    }

    console.log(`\nSummary: ${fetched} responses fetched, ${skipped} skipped`);
    if (errors > 0) {
      console.log(`${errors} errors encountered`);
    }

    console.log(`\nResponse files ready in: ${inboxFolder}`);
    if (fetched > 0) {
      console.log('Next: run /poll-process-responses to update Poll.md\n');
    }

    process.exit(errors > 0 ? 1 : 0);
  } catch (err) {
    console.error('✗ Error:', err.message);
    process.exit(1);
  }
}

main();
