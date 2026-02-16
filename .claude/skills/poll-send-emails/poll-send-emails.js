#!/usr/bin/env node

/**
 * Poll Send Emails Skill
 * Sends draft emails from outbox folder via Gmail API
 */

const fs = require('fs');
const path = require('path');
const logger = require('../poll-shared/logger');
const gmailAuth = require('../poll-shared/gmail-auth');
const gmailHelpers = require('../poll-shared/gmail-helpers');

async function main() {
  try {
    const args = process.argv.slice(2);
    const dryRun = args.includes('--dry-run');
    const typeFilter = args.includes('--type') ? args[args.indexOf('--type') + 1] : null;

    // Load config
    let config;
    try {
      const configPath = path.join(process.cwd(), 'polls-config.json');
      config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    } catch (err) {
      logger.error('Error loading polls-config.json: ' + err.message);
      process.exit(1);
    }

    const pollFolder = path.join(config.pollsRoot, config.activePoll);
    const outboxFolder = path.join(pollFolder, 'outbox');
    const sentFolder = path.join(outboxFolder, 'sent');

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
    logger.info('Sending poll emails' + (dryRun ? ' (dry-run mode)' : '') + '...\n');

    // Scan outbox for draft files
    if (!fs.existsSync(outboxFolder)) {
      logger.warn('No outbox folder found. Run /poll-draft-emails first.');
      process.exit(0);
    }

    const draftFiles = fs.readdirSync(outboxFolder)
      .filter(f => f.startsWith('draft-') && f.endsWith('.txt'));

    if (draftFiles.length === 0) {
      logger.warn('No draft files found in ' + outboxFolder);
      process.exit(0);
    }

    // Apply type filter if specified
    let filteredFiles = draftFiles;
    if (typeFilter) {
      const validTypes = ['poll', 'reminder', 'results'];
      if (!validTypes.includes(typeFilter)) {
        logger.error(`Invalid type: ${typeFilter}`);
        logger.error(`Valid types: ${validTypes.join(', ')}`);
        process.exit(1);
      }
      filteredFiles = draftFiles.filter(f => f.includes(`draft-${typeFilter}-`));
    }

    // Parse all draft files
    const drafts = [];
    for (const file of filteredFiles) {
      try {
        const content = fs.readFileSync(path.join(outboxFolder, file), 'utf8');
        const parsed = gmailHelpers.parseDraftFile(content);
        if (!parsed) {
          logger.error(`Invalid format in ${file}`);
          continue;
        }

        if (!gmailHelpers.isValidEmail(parsed.to)) {
          logger.error(`Invalid email address in ${file}: ${parsed.to}`);
          continue;
        }

        drafts.push({
          filename: file,
          ...parsed
        });
      } catch (err) {
        logger.error(`Error reading ${file}: ${err.message}`);
      }
    }

    if (drafts.length === 0) {
      logger.warn('No valid draft files to send.');
      process.exit(0);
    }

    logger.info(`Parsed ${drafts.length} draft(s):\n`);
    for (const draft of drafts) {
      logger.debug(`  - to: ${draft.to}, subject: "${draft.subject}"`);
    }

    if (dryRun) {
      logger.info(`[DRY RUN] Would send ${drafts.length} email(s). Re-run without --dry-run to actually send.\n`);
      process.exit(0);
    }

    // Send emails with rate limiting
    logger.info(`Sending... (${drafts.length} total)\n`);

    let sent = 0;
    let failed = 0;

    // Create sent folder if it doesn't exist
    if (!fs.existsSync(sentFolder)) {
      fs.mkdirSync(sentFolder, { recursive: true });
    }

    // Send in batches with delays
    const batchSize = 10;
    for (let i = 0; i < drafts.length; i += batchSize) {
      const batch = drafts.slice(i, i + batchSize);

      for (const draft of batch) {
        try {
          const encoded = gmailHelpers.encodeEmail(draft.to, draft.subject, draft.body);
          await gmail.users.messages.send({
            userId: 'me',
            requestBody: {
              raw: encoded
            }
          });

          logger.debug(`${draft.to} - sent`);

          // Move to sent folder
          const sourcePath = path.join(outboxFolder, draft.filename);
          const destPath = path.join(sentFolder, draft.filename);
          fs.renameSync(sourcePath, destPath);

          sent++;
        } catch (err) {
          logger.error(`${draft.to} - failed: ${err.message}`);
          failed++;
        }
      }

      // Rate limiting: 1 second delay between batches
      if (i + batchSize < drafts.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    if (logger.isVerbose()) {
      logger.info(`Summary: ${sent} sent, ${failed} failed`);
      logger.info(`Moved ${sent} draft(s) to outbox/sent/\n`);
    }
    logger.summary(`${sent} email(s) sent, ${failed} failed`);

    process.exit(failed > 0 ? 1 : 0);
  } catch (err) {
    logger.error('Error: ' + err.message);
    process.exit(1);
  }
}

main();
