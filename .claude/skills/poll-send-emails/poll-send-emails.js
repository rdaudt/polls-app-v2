#!/usr/bin/env node

/**
 * Poll Send Emails Skill
 * Sends draft emails from outbox folder via Gmail API
 */

const fs = require('fs');
const path = require('path');
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
      console.error('✗ Error loading polls-config.json:', err.message);
      process.exit(1);
    }

    const pollFolder = path.join(config.pollsRoot, config.activePoll);
    const outboxFolder = path.join(pollFolder, 'outbox');
    const sentFolder = path.join(outboxFolder, 'sent');

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
    console.log('\n📧 Sending poll emails' + (dryRun ? ' (dry-run mode)' : '') + '...\n');

    // Scan outbox for draft files
    if (!fs.existsSync(outboxFolder)) {
      console.log('No outbox folder found. Run /poll-draft-emails first.');
      process.exit(0);
    }

    const draftFiles = fs.readdirSync(outboxFolder)
      .filter(f => f.startsWith('draft-') && f.endsWith('.txt'));

    if (draftFiles.length === 0) {
      console.log('No draft files found in ' + outboxFolder);
      process.exit(0);
    }

    // Apply type filter if specified
    let filteredFiles = draftFiles;
    if (typeFilter) {
      const validTypes = ['poll', 'reminder', 'results'];
      if (!validTypes.includes(typeFilter)) {
        console.error(`✗ Invalid type: ${typeFilter}`);
        console.error(`Valid types: ${validTypes.join(', ')}`);
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
          console.error(`✗ Invalid format in ${file}`);
          continue;
        }

        if (!gmailHelpers.isValidEmail(parsed.to)) {
          console.error(`✗ Invalid email address in ${file}: ${parsed.to}`);
          continue;
        }

        drafts.push({
          filename: file,
          ...parsed
        });
      } catch (err) {
        console.error(`✗ Error reading ${file}:`, err.message);
      }
    }

    if (drafts.length === 0) {
      console.log('No valid draft files to send.');
      process.exit(0);
    }

    console.log(`Parsed ${drafts.length} draft(s):\n`);
    for (const draft of drafts) {
      console.log(`  - to: ${draft.to}, subject: "${draft.subject}"`);
    }

    if (dryRun) {
      console.log(`\n[DRY RUN] Would send ${drafts.length} email(s). ` +
                  'Re-run without --dry-run to actually send.\n');
      process.exit(0);
    }

    // Send emails with rate limiting
    console.log(`\nSending... (${drafts.length} total)\n`);

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

          console.log(`✓ ${draft.to} - sent`);

          // Move to sent folder
          const sourcePath = path.join(outboxFolder, draft.filename);
          const destPath = path.join(sentFolder, draft.filename);
          fs.copyFileSync(sourcePath, destPath);

          sent++;
        } catch (err) {
          console.error(`✗ ${draft.to} - failed:`, err.message);
          failed++;
        }
      }

      // Rate limiting: 1 second delay between batches
      if (i + batchSize < drafts.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    console.log(`\nSummary: ${sent} sent, ${failed} failed`);
    console.log(`Moved ${sent} draft(s) to outbox/sent/\n`);

    process.exit(failed > 0 ? 1 : 0);
  } catch (err) {
    console.error('✗ Error:', err.message);
    process.exit(1);
  }
}

main();
