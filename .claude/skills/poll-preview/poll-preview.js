/**
 * Poll Preview Skill
 * 
 * Preview merged template for a specific participant without creating draft files.
 * Shows exactly how the email will look after template merging and timezone conversion.
 */

const fs = require('fs');
const path = require('path');
const { parsePollFile } = require('../poll-shared/poll-parser');
const { mergeTemplate, extractSubjectAndBody } = require('../poll-shared/template-engine');

// Load configuration
function loadConfig() {
  const configPath = path.resolve(process.cwd(), 'polls-config.json');
  if (!fs.existsSync(configPath)) {
    throw new Error('polls-config.json not found in current directory');
  }
  return JSON.parse(fs.readFileSync(configPath, 'utf-8'));
}

// Parse command-line arguments
function parseArgs(args) {
  const options = {
    email: null,
    template: 'poll',
    selectedChoice: null
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--template' && i + 1 < args.length) {
      options.template = args[++i];
    } else if (arg === '--selected-choice' && i + 1 < args.length) {
      options.selectedChoice = parseInt(args[++i]);
    } else if (!arg.startsWith('--') && !options.email) {
      options.email = arg;
    }
  }

  return options;
}

// Get template file path based on type
function getTemplateFile(pollPath, templateType) {
  const mapping = {
    'poll': 'Poll email template.md',
    'reminder': 'Poll reminder email.md',
    'results-respondent': 'Poll results email template - Respondent.md',
    'results-non-respondent': 'Poll results email template - Non-Respondent.md'
  };

  const filename = mapping[templateType];
  if (!filename) {
    throw new Error(`Unknown template type: ${templateType}. Must be one of: poll, reminder, results-respondent, results-non-respondent`);
  }

  const templatePath = path.join(pollPath, filename);
  if (!fs.existsSync(templatePath)) {
    throw new Error(`Template file not found: ${templatePath}`);
  }

  return { path: templatePath, name: filename };
}

// Main function
async function main() {
  const args = process.argv.slice(2);

  try {
    const options = parseArgs(args);

    if (!options.email) {
      throw new Error('Participant email required. Usage: /poll-preview <email> [--template TYPE] [--selected-choice N]');
    }

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

    // Find participant
    const participant = pollData.participants.find(
      p => p.email.toLowerCase() === options.email.toLowerCase()
    );

    if (!participant) {
      throw new Error(`Participant not found: ${options.email}`);
    }

    // For results templates, validate selected choice
    let selectedDateTime = null;
    if (options.template.startsWith('results')) {
      if (!options.selectedChoice) {
        throw new Error(`--selected-choice required for results templates`);
      }
      if (options.selectedChoice < 1 || options.selectedChoice > pollData.choices.length) {
        throw new Error(`Invalid choice number: ${options.selectedChoice}. Valid range: 1-${pollData.choices.length}`);
      }
      selectedDateTime = pollData.choices[options.selectedChoice - 1];
    }

    // Get template file
    const templateInfo = getTemplateFile(pollPath, options.template);
    const templateContent = fs.readFileSync(templateInfo.path, 'utf-8');

    // Merge template
    const mergedTemplate = mergeTemplate(templateContent, pollData.description, participant, {
      selectedDateTime: selectedDateTime,
      nowDateTime: new Date().toISOString()
    });

    // Extract subject and body
    const { subject, body } = extractSubjectAndBody(mergedTemplate);

    // Display preview
    console.log(`\n📧 Preview for: ${participant.email} (${participant.name}, ${participant.tz})`);
    console.log(`Template: ${templateInfo.name}\n`);

    console.log('---');
    console.log(`To: ${participant.email}`);
    console.log(`Subject: ${subject}\n`);
    console.log(body);
    console.log('---\n');

    console.log('[DRY RUN] Email not sent. Use /poll-draft-emails or /poll-send-emails to send.\n');

  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
}

main().catch(error => {
  console.error(`Fatal error: ${error.message}`);
  process.exit(1);
});
