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
 * Format: "1: Yes" or "2: As Needed"
 * @param {string} bodyText - Email body
 * @returns {Array} Array of { number, choice }
 */
function extractResponses(bodyText) {
  const responses = [];
  const regex = /^\s*(\d+)\s*:\s*(Yes|As\s+Needed)/gim;
  let match;

  while ((match = regex.exec(bodyText)) !== null) {
    responses.push({
      number: parseInt(match[1]),
      choice: match[2].trim()
    });
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
