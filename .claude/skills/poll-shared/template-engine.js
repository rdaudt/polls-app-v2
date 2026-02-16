/**
 * Template Engine for Poll Email Merging
 *
 * Handles template merge field substitution for all email templates.
 * Merge fields are replaced with actual data from poll configuration.
 */

const { convertDateTime } = require('./tz-converter');

/**
 * Format date/time for display in organizer's time zone
 * @param {string} dateTimeStr - ISO string or formatted date/time
 * @returns {string} Formatted "Mon DD, YYYY, HH:MM"
 */
function formatDateTimeForDisplay(dateTimeStr) {
  if (!dateTimeStr) return '';

  try {
    const date = new Date(dateTimeStr);
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const month = monthNames[date.getUTCMonth()];
    const day = date.getUTCDate();
    const year = date.getUTCFullYear();
    const hours = String(date.getUTCHours()).padStart(2, '0');
    const minutes = String(date.getUTCMinutes()).padStart(2, '0');
    return `${month} ${day}, ${year}, ${hours}:${minutes}`;
  } catch (e) {
    return dateTimeStr; // Return as-is if parsing fails
  }
}

/**
 * Extract Subject and Body from a merged template
 *
 * The template is parsed to find:
 * - First Subject: line is the subject
 * - First Body: line is the body
 * All subsequent lines after each are content until the next field
 *
 * @param {string} mergedTemplate - Merged template content
 * @returns {object} {subject: string, body: string}
 */
function extractSubjectAndBody(mergedTemplate) {
  const lines = mergedTemplate.split('\n');
  let subject = '';
  let body = '';

  for (const line of lines) {
    if (!line.startsWith('|')) continue;
    // Skip header and separator rows
    if (line.includes('----') || line.includes('Item')) continue;

    const rawCells = line.split('|');
    const cells = rawCells.slice(1, rawCells.length - 1).map(c => c.trim());
    if (cells.length < 2) continue;

    const key = cells[0].toLowerCase();
    const value = cells[1];

    if (key === 'subject') {
      subject = value;
    } else if (key === 'body') {
      // Convert <br> tags to newlines for draft files
      body = value.replace(/<br>/gi, '\n');
    }
  }

  return { subject, body };
}

/**
 * Merge template with participant data
 *
 * Replaces all {$Field$} merge fields with actual values.
 * Handles special case of {$DateTimeChoice.N$} expansion with timezone conversion.
 *
 * @param {string} templateContent - Raw template markdown with {$Field$} syntax
 * @param {object} pollData - Parsed Poll.md data
 *   - eventTitle: String
 *   - organizer: String
 *   - organizerEmail: String
 *   - organizerTitle: String
 *   - organizerTZ: String (TZ abbreviation)
 *   - deadline: String
 *   - choices: [String] (date/time choices in organizer TZ)
 * @param {object} participant - Participant info
 *   - name: String
 *   - email: String
 *   - tz: String (TZ abbreviation)
 * @param {object} options - Optional merge options
 *   - selectedDateTime: String (for results templates, in organizer TZ)
 *   - nowDateTime: String (ISO or formatted date/time)
 * @returns {string} Merged template with all fields substituted
 */
function mergeTemplate(templateContent, pollData, participant, options = {}) {
  let merged = templateContent;

  // Simple field replacements
  merged = merged.replace(/{?\$EventTitle\$?}/g, pollData.eventTitle || '');
  merged = merged.replace(/{?\$Participant\.Name\$?}/g, participant.name || '');
  merged = merged.replace(/{?\$Participant\.Email\$?}/g, participant.email || '');
  merged = merged.replace(/{?\$ResponseDeadline\$?}/g, pollData.deadline || '');
  merged = merged.replace(/{?\$Organizer\.Name\$?}/g, pollData.organizer || '');
  merged = merged.replace(/{?\$Organizer\.Title\$?}/g, pollData.organizerTitle || '');

  // NowDateTime field
  const nowDateTime = options.nowDateTime || new Date().toISOString();
  merged = merged.replace(/{?\$NowDateTime\$?}/g, formatDateTimeForDisplay(nowDateTime));

  // SelectedDateTime field (for results templates)
  if (options.selectedDateTime) {
    const selectedInParticipantTZ = convertDateTime(options.selectedDateTime, pollData.organizerTZ, participant.tz);
    merged = merged.replace(/{?\$SelectedDateTime\$?}/g, `${selectedInParticipantTZ} ${participant.tz}`);
  } else {
    merged = merged.replace(/{?\$SelectedDateTime\$?}/g, '');
  }

  // DateTimeChoice expansion - most complex
  // Find all {$DateTimeChoice.N$} placeholders and expand
  if (pollData.choices && pollData.choices.length > 0) {
    // Replace individual choice placeholders with converted times
    for (let i = 0; i < pollData.choices.length; i++) {
      const choiceIndex = i + 1; // 1-indexed
      const choice = pollData.choices[i];

      // Convert from organizer TZ to participant TZ
      const convertedChoice = convertDateTime(choice, pollData.organizerTZ, participant.tz);
      const formattedChoice = `${choiceIndex}. ${convertedChoice} ${participant.tz}`;

      // Replace the placeholder
      merged = merged.replace(new RegExp(`{?\\$DateTimeChoice\\.${choiceIndex}\\$?}`, 'g'), formattedChoice);
    }

    // Expand "..." with remaining choices (3, 4, ...) using the suffix pattern from choice 2
    if (merged.includes('...') && pollData.choices.length > 2) {
      // Extract the suffix pattern from the last explicit choice line (choice 2)
      // Look for the pattern: "2. <datetime> <TZ><suffix><br>..."
      const choice2Pattern = merged.match(/2\.\s+.+?\s+[A-Z]{2,4}([^<]*(?:<br>)?)\.\.\./);
      const suffix = choice2Pattern ? choice2Pattern[1].replace(/<br>$/, '') : ': (  ) **Yes**  (  ) **As Needed**';

      // Build expansion for choices 3+
      const expansionParts = [];
      for (let ci = 2; ci < pollData.choices.length; ci++) {
        const choiceIndex = ci + 1;
        const choice = pollData.choices[ci];
        const convertedChoice = convertDateTime(choice, pollData.organizerTZ, participant.tz);
        const formattedChoice = `${choiceIndex}. ${convertedChoice} ${participant.tz}`;
        expansionParts.push(`${formattedChoice}${suffix}`);
      }

      // Replace <br>...<br> or <br>... with expanded choices joined by <br>
      const expansion = expansionParts.join('<br>');
      merged = merged.replace(/<br>\.\.\.<br>/g, `<br>${expansion}<br>`);
      merged = merged.replace(/<br>\.\.\./g, `<br>${expansion}`);
      // Also handle standalone ... on its own line
      merged = merged.replace(/^\.\.\.$\n?/gm, expansionParts.join('\n') + '\n');
    } else {
      // No expansion needed or <= 2 choices — just remove any leftover "..."
      merged = merged.replace(/<br>\.\.\.<br>/g, '<br>');
      merged = merged.replace(/<br>\.\.\./g, '');
      merged = merged.replace(/^\.\.\.$\n?/gm, '');
    }

    // Clean up any unreplaced DateTimeChoice placeholders
    merged = merged.replace(/{\$DateTimeChoice\.\d+\$}/g, '');
  }

  return merged;
}

module.exports = {
  mergeTemplate,
  extractSubjectAndBody
};
