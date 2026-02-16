/**
 * Gmail Utilities Helper Module
 * Functions for encoding, parsing, and managing Gmail operations
 */

const fs = require('fs');

/**
 * Encode email message as RFC 2822 base64url format for Gmail API
 * @param {string} to - Recipient email address
 * @param {string} subject - Email subject
 * @param {string} body - Email body (plain text)
 * @returns {string} base64url encoded message
 */
function encodeEmail(to, subject, body) {
  const headers = [
    `From: <no-reply@gmail.com>`,
    `To: ${to}`,
    `Subject: ${subject}`,
    `MIME-Version: 1.0`,
    `Content-Type: text/plain; charset="UTF-8"`,
    `Content-Transfer-Encoding: 7bit`
  ];

  const message = headers.join('\r\n') + '\r\n\r\n' + body;

  // Base64url encode
  const base64 = Buffer.from(message).toString('base64');
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

/**
 * Parse draft email file format
 * Expected format:
 * To: email@example.com
 * Subject: Subject line
 *
 * Email body here
 *
 * @param {string} content - File content
 * @returns {Object} { to, subject, body } or null if invalid
 */
function parseDraftFile(content) {
  const lines = content.split('\n');
  const headers = {};
  let bodyStartIndex = 0;

  // Parse headers until blank line
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) {
      bodyStartIndex = i + 1;
      break;
    }

    const match = line.match(/^(\w+):\s*(.+)$/);
    if (match) {
      headers[match[1].toLowerCase()] = match[2].trim();
    }
  }

  if (!headers.to || !headers.subject) {
    return null;
  }

  const body = lines.slice(bodyStartIndex).join('\n').trim();

  return {
    to: headers.to,
    subject: headers.subject,
    body: body
  };
}

/**
 * Extract plain text from Gmail message payload
 * Handles multipart messages and HTML conversion
 * @param {Object} message - Gmail message object from API
 * @returns {string} Plain text body or empty string
 */
function parseEmailBody(message) {
  if (!message.payload) {
    return '';
  }

  const payload = message.payload;

  // If it's a simple message with body
  if (payload.body && payload.body.data) {
    const text = Buffer.from(payload.body.data, 'base64').toString('utf-8');
    return text;
  }

  // If it's multipart, find the text part
  if (payload.parts) {
    for (const part of payload.parts) {
      if (part.mimeType === 'text/plain' && part.body && part.body.data) {
        return Buffer.from(part.body.data, 'base64').toString('utf-8');
      }
    }

    // Fallback: try HTML and convert to text
    for (const part of payload.parts) {
      if (part.mimeType === 'text/html' && part.body && part.body.data) {
        const html = Buffer.from(part.body.data, 'base64').toString('utf-8');
        return htmlToPlainText(html);
      }
    }
  }

  return '';
}

/**
 * Convert HTML to plain text (simple conversion)
 * @param {string} html - HTML content
 * @returns {string} Plain text
 */
function htmlToPlainText(html) {
  // Remove script and style tags
  let text = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
  text = text.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '');

  // Remove HTML tags
  text = text.replace(/<[^>]+>/g, '');

  // Decode HTML entities
  text = text
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');

  // Clean up whitespace
  text = text
    .replace(/\n\s*\n/g, '\n\n') // Multiple newlines to double
    .trim();

  return text;
}

/**
 * Extract numbered responses from email body
 * Supports multiple formats:
 *   "1: Yes", "1. Yes", "1) Yes", "1 - Yes", "1 Yes"
 *   "2: As Needed", "2. As needed", "2: as needed"
 *   Checkbox style: "(X) Yes" or "[x] Yes" next to numbered items
 * @param {string} bodyText - Email body
 * @returns {Array} Array of { number, choice }
 */
function extractResponses(bodyText) {
  const responses = [];

  // Pattern 1: "N: Yes" / "N. Yes" / "N) Yes" / "N - Yes" (with optional separator)
  const directRegex = /^\s*(\d+)\s*[:.)\-]?\s*(Yes|As\s*Needed)\b/gim;
  let match;
  while ((match = directRegex.exec(bodyText)) !== null) {
    const choice = match[2].trim().replace(/\s+/g, ' ');
    responses.push({
      number: parseInt(match[1]),
      choice: choice.charAt(0).toUpperCase() + choice.slice(1).toLowerCase()
        === 'Yes' ? 'Yes' : 'As Needed'
    });
  }

  if (responses.length > 0) return responses;

  // Pattern 2: Checkbox style — look for (X) or [X] next to Yes/As Needed on lines with numbers
  // e.g., "1. Mar 16, 2026, 13:00 EST: (X) Yes  (  ) As Needed"
  const checkboxRegex = /(\d+)\.\s+.*?(?:\(X\)|\[X\])\s*(Yes|As\s*Needed)/gim;
  while ((match = checkboxRegex.exec(bodyText)) !== null) {
    const choice = match[2].trim().replace(/\s+/g, ' ');
    responses.push({
      number: parseInt(match[1]),
      choice: choice.toLowerCase().startsWith('as') ? 'As Needed' : 'Yes'
    });
  }

  if (responses.length > 0) return responses;

  // Pattern 3: Natural language — extract choice numbers from free-text responses
  // Only look at text BEFORE the quoted reply (before "On ... wrote:")
  const replyMarker = bodyText.search(/On\s+\w+day,\s+\w+\s+\d/i);
  const ownText = replyMarker > 0 ? bodyText.substring(0, replyMarker).trim() : bodyText.trim();

  if (!ownText) return responses;

  // Look for "as needed" mentions first to separate from plain "yes" choices
  const asNeededNumbers = new Set();
  const asNeededNL = /(?:option|choice|#)?\s*(\d+)\s+(?:as\s*needed|if\s*needed|maybe)/gi;
  while ((match = asNeededNL.exec(ownText)) !== null) {
    asNeededNumbers.add(parseInt(match[1]));
  }

  // Extract all mentioned choice numbers (1-9) from the user's own text
  // Patterns: "option 1", "choice 2", "#3", standalone digits in context
  const numberPattern = /(?:option|choice|#)\s*(\d+)/gi;
  const seen = new Set();
  while ((match = numberPattern.exec(ownText)) !== null) {
    const num = parseInt(match[1]);
    if (num >= 1 && num <= 9 && !seen.has(num)) {
      seen.add(num);
      responses.push({
        number: num,
        choice: asNeededNumbers.has(num) ? 'As Needed' : 'Yes'
      });
    }
  }

  if (responses.length > 0) return responses;

  // Last resort: look for bare digits (1-9) that appear to reference choices
  // Only if the own text is short (likely a simple reply like "1 and 3")
  if (ownText.length < 200) {
    const bareDigits = /\b(\d)\b/g;
    while ((match = bareDigits.exec(ownText)) !== null) {
      const num = parseInt(match[1]);
      if (num >= 1 && num <= 9 && !seen.has(num)) {
        seen.add(num);
        responses.push({
          number: num,
          choice: asNeededNumbers.has(num) ? 'As Needed' : 'Yes'
        });
      }
    }
  }

  return responses;
}

/**
 * Format response file per spec
 * @param {string} from - Sender email
 * @param {string} date - Date string
 * @param {string} subject - Email subject
 * @param {Array} responses - Array of { number, choice }
 * @returns {string} Formatted file content
 */
function formatResponseFile(from, date, subject, responses) {
  const lines = [
    `From: ${from}`,
    `Date: ${date}`,
    `Subject: ${subject}`,
    ''
  ];

  for (const response of responses) {
    lines.push(`${response.number}: ${response.choice}`);
  }

  return lines.join('\n') + '\n';
}

/**
 * Get or create Gmail label
 * @param {Object} gmail - Gmail API client
 * @param {string} labelName - Label name (e.g., "Polls/Responses")
 * @returns {Promise<string>} Label ID or null if error
 */
async function getOrCreateLabel(gmail, labelName) {
  try {
    // List existing labels
    const res = await gmail.users.labels.list({ userId: 'me' });
    const labels = res.data.labels || [];

    // Check if label exists
    const existing = labels.find(l => l.name === labelName);
    if (existing) {
      return existing.id;
    }

    // Create new label
    const createRes = await gmail.users.labels.create({
      userId: 'me',
      requestBody: {
        name: labelName,
        labelListVisibility: 'labelShow',
        messageListVisibility: 'show'
      }
    });

    return createRes.data.id;
  } catch (err) {
    console.error(`Error managing label "${labelName}":`, err.message);
    return null;
  }
}

/**
 * Validate email address format (basic)
 * @param {string} email - Email address
 * @returns {boolean} True if valid format
 */
function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Format bytes to human-readable size
 * @param {number} bytes - Number of bytes
 * @returns {string} Formatted size
 */
function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Sanitize filename
 * @param {string} filename - Original filename
 * @returns {string} Safe filename
 */
function sanitizeFilename(filename) {
  return filename.replace(/[^a-z0-9._-]/gi, '_');
}

module.exports = {
  encodeEmail,
  parseDraftFile,
  parseEmailBody,
  htmlToPlainText,
  extractResponses,
  formatResponseFile,
  getOrCreateLabel,
  isValidEmail,
  formatBytes,
  sanitizeFilename
};
