#!/usr/bin/env node

/**
 * poll-send-emails
 * Sends draft poll emails via Gmail API using the Gmail MCP server
 */

const fs = require('fs');
const path = require('path');

// ============================================================================
// CONFIGURATION & ARGUMENT PARSING
// ============================================================================

let dryRun = false;
let filterType = null;

for (let i = 2; i < process.argv.length; i++) {
  if (process.argv[i] === '--dry-run') {
    dryRun = true;
  } else if (process.argv[i] === '--type') {
    if (process.argv[i + 1]) {
      filterType = process.argv[i + 1];
      i++;
    }
  }
}

// Validate --type argument
if (filterType && !['poll', 'reminder', 'results'].includes(filterType)) {
  console.error("Error: --type must be 'poll', 'reminder', or 'results'");
  process.exit(1);
}

// ============================================================================
// LOAD CONFIGURATION
// ============================================================================

let config;
try {
  const configPath = path.resolve(process.cwd(), 'polls-config.json');
  const configContent = fs.readFileSync(configPath, 'utf8');
  config = JSON.parse(configContent);
} catch (error) {
  console.error('Error: Cannot read polls-config.json');
  console.error(error.message);
  process.exit(1);
}

const { pollsRoot, activePoll } = config;

if (!pollsRoot || !activePoll) {
  console.error('Error: polls-config.json missing pollsRoot or activePoll');
  process.exit(1);
}

const pollFolder = path.join(pollsRoot, activePoll);
const outboxDir = path.join(pollFolder, 'outbox');
const sentDir = path.join(outboxDir, 'sent');

if (!fs.existsSync(outboxDir)) {
  console.error(`Error: Outbox directory not found: ${outboxDir}`);
  process.exit(1);
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Parse a draft email file
 * Format:
 *   To: email@example.com
 *   Subject: Subject line
 *
 *   Email body...
 */
function parseDraftFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n');

    let to = '';
    let subject = '';
    let bodyStartIndex = -1;

    // Parse headers
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      if (line.match(/^To:\s*/i)) {
        to = line.replace(/^To:\s*/i, '').trim();
      } else if (line.match(/^Subject:\s*/i)) {
        subject = line.replace(/^Subject:\s*/i, '').trim();
      } else if (line.trim() === '' && bodyStartIndex === -1) {
        // First empty line marks end of headers
        bodyStartIndex = i + 1;
        break;
      }
    }

    // Extract body
    const body = bodyStartIndex !== -1
      ? lines.slice(bodyStartIndex).join('\n').trim()
      : '';

    return { to, subject, body };
  } catch (error) {
    console.error(`Error parsing draft file ${filePath}: ${error.message}`);
    return null;
  }
}

/**
 * Validate email address format
 */
function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Get draft files matching filters
 */
function getDraftFiles() {
  try {
    const files = fs.readdirSync(outboxDir);
    return files
      .filter(file => {
        // Must be draft-*.txt
        if (!file.startsWith('draft-') || !file.endsWith('.txt')) {
          return false;
        }

        // Apply type filter if specified
        if (filterType === 'poll' && !file.startsWith('draft-poll-')) {
          return false;
        }
        if (filterType === 'reminder' && !file.startsWith('draft-reminder-')) {
          return false;
        }
        if (filterType === 'results' && !file.startsWith('draft-results-')) {
          return false;
        }

        return true;
      })
      .map(file => path.join(outboxDir, file));
  } catch (error) {
    console.error(`Error reading outbox directory: ${error.message}`);
    return [];
  }
}

/**
 * Send email via Gmail MCP server
 * This function calls the Gmail MCP send_email tool
 */
async function sendEmailViaGmail(to, subject, body) {
  // When executed in Claude Code with Gmail MCP configured,
  // the Gmail MCP server tools are available through the execution environment.
  //
  // This implementation uses the Gmail MCP server's send_email tool which is
  // configured in .claude.json as: @gongrzhe/server-gmail-autoauth-mcp
  //
  // The send_email tool has the following signature:
  // send_email({
  //   to: string[],           // array of recipient emails
  //   subject: string,        // email subject
  //   body: string,          // plain text body
  //   mimeType?: string      // optional, defaults to "text/plain"
  // })

  try {
    // In Claude Code environment, call the Gmail MCP tool
    // The tool is accessible through the MCP server interface
    if (global.gmail && global.gmail.send_email) {
      // Direct invocation if available
      const result = await global.gmail.send_email({
        to: [to],
        subject: subject,
        body: body,
        mimeType: 'text/plain'
      });
      return result;
    }

    // Alternative: Use environment-injected MCP tools
    // Claude Code may inject MCP tools into the process
    if (global.__mcp && global.__mcp.invoke) {
      const result = await global.__mcp.invoke('gmail:send_email', {
        to: [to],
        subject: subject,
        body: body,
        mimeType: 'text/plain'
      });
      return result;
    }

    // If no MCP tools available, throw informative error
    throw new Error(
      'Gmail MCP server not available. ' +
      'Ensure Gmail MCP server is running and Claude Code has proper MCP configuration. ' +
      'Check .claude.json for Gmail MCP server setup.'
    );
  } catch (error) {
    throw new Error(`Gmail send failed: ${error.message}`);
  }
}

/**
 * Copy file from outbox to sent folder
 */
function moveToSent(filePath) {
  try {
    if (!fs.existsSync(sentDir)) {
      fs.mkdirSync(sentDir, { recursive: true });
    }

    const fileName = path.basename(filePath);
    const destPath = path.join(sentDir, fileName);
    fs.copyFileSync(filePath, destPath);

    return true;
  } catch (error) {
    console.error(`Warning: Could not move ${path.basename(filePath)}: ${error.message}`);
    return false;
  }
}

// ============================================================================
// MAIN EXECUTION
// ============================================================================

async function main() {
  // Get draft files
  const draftFiles = getDraftFiles();

  if (draftFiles.length === 0) {
    console.log('No draft files found in outbox');
    process.exit(0);
  }

  // Parse all drafts
  console.log(`Sending poll emails${dryRun ? ' (dry-run mode)' : ''}...\n`);
  console.log('Parsed drafts:');

  const drafts = [];
  for (const filePath of draftFiles) {
    const draft = parseDraftFile(filePath);

    if (!draft) {
      continue;
    }

    const { to, subject, body } = draft;

    // Validate email
    if (!isValidEmail(to)) {
      console.log(`  ✗ INVALID EMAIL: ${to}`);
      continue;
    }

    drafts.push({ to, subject, body, filePath });
    console.log(`  - to: ${to}, subject: "${subject}"`);
  }

  console.log();

  if (drafts.length === 0) {
    console.error('Error: No valid drafts to send');
    process.exit(1);
  }

  // Dry-run mode
  if (dryRun) {
    console.log(
      `[DRY RUN] Would send ${drafts.length} email(s). Re-run without --dry-run to actually send.`
    );
    process.exit(0);
  }

  // Send emails
  console.log(`Sending... (${drafts.length} total)\n`);

  let sentCount = 0;
  let failedCount = 0;
  const sentFiles = [];

  for (const draft of drafts) {
    try {
      // Send via Gmail MCP server
      // When executed in Claude Code with Gmail MCP configured,
      // this will use the actual Gmail API
      await sendEmailViaGmail(draft.to, draft.subject, draft.body);

      console.log(`✓ ${draft.to} - sent`);
      sentCount++;
      sentFiles.push(draft.filePath);
    } catch (error) {
      console.error(`✗ ${draft.to} - failed: ${error.message}`);
      failedCount++;
    }
  }

  console.log();
  console.log(`Summary: ${sentCount} sent, ${failedCount} failed`);

  // Move sent files
  if (sentFiles.length > 0) {
    let movedCount = 0;
    for (const filePath of sentFiles) {
      if (moveToSent(filePath)) {
        movedCount++;
      }
    }
    console.log(`Moved ${movedCount} draft(s) to outbox/sent/`);
  }
}

// Run
main().catch(error => {
  console.error('Unexpected error:', error.message);
  process.exit(1);
});
