/**
 * NLP Response Parser
 *
 * Intelligent fallback for parsing natural language poll responses.
 * Uses regex first (fast, free), then falls back to Claude Haiku API
 * when regex returns nothing and ANTHROPIC_API_KEY is available.
 *
 * Requires: Node 20+ (native fetch)
 * No external dependencies.
 */

const gmailHelpers = require('./gmail-helpers');
const logger = require('./logger');

const API_URL = 'https://api.anthropic.com/v1/messages';
const MODEL = 'claude-haiku-4-5-20251001';
const TIMEOUT_MS = 15000;

const SYSTEM_PROMPT = `You are a poll response parser. The user will provide:
1. A numbered list of date/time choices from a poll
2. The text of an email reply from a participant

Your job is to determine which choices the participant selected, and whether each is a firm "Yes" or a conditional "As Needed" (meaning maybe/backup/if needed).

Rules:
- Map natural language date/time references to the numbered poll choices
- "Yes" means firm/definite/works/available/good
- "As Needed" means conditional/maybe/backup/if needed/last resort/could work
- Handle patterns like: "all work", "all except #2", "the first one", ordinals ("first", "second"), date references ("March 16"), time references ("the 10am one")
- Return ONLY a JSON array: [{"number": 1, "choice": "Yes"}, ...]
- Return [] if nothing can be determined
- Never fabricate choices that were not in the original list
- Only output the JSON array, no other text`;

/**
 * Build the user message for the Claude API call
 * @param {string} bodyText - Email body text
 * @param {string[]} pollChoices - Array of choice strings from Poll.md
 * @returns {string}
 */
function buildUserMessage(bodyText, pollChoices) {
  const choiceList = pollChoices
    .map((c, i) => `${i + 1}. ${c}`)
    .join('\n');

  // Strip quoted reply text (everything after "On ... wrote:")
  const replyMarker = bodyText.search(/On\s+\w+day,\s+\w+\s+\d/i);
  const ownText = replyMarker > 0 ? bodyText.substring(0, replyMarker).trim() : bodyText.trim();

  return `Poll choices:\n${choiceList}\n\nParticipant's email reply:\n${ownText}`;
}

/**
 * Parse and validate the JSON response from Claude
 * @param {string} rawText - Raw text from Claude API
 * @param {number} maxChoice - Maximum valid choice number
 * @returns {Array<{number: number, choice: string}>}
 */
function parseNLPResponse(rawText, maxChoice) {
  // Strip markdown code fencing if present
  let text = rawText.trim();
  text = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');

  // Find JSON array in the response
  const arrayMatch = text.match(/\[[\s\S]*\]/);
  if (!arrayMatch) return [];

  let parsed;
  try {
    parsed = JSON.parse(arrayMatch[0]);
  } catch {
    return [];
  }

  if (!Array.isArray(parsed)) return [];

  // Validate and deduplicate
  const seen = new Set();
  const results = [];

  for (const entry of parsed) {
    const num = parseInt(entry.number);
    if (isNaN(num) || num < 1 || num > maxChoice) continue;
    if (seen.has(num)) continue;

    const choice = typeof entry.choice === 'string' && entry.choice.toLowerCase().startsWith('as')
      ? 'As Needed'
      : 'Yes';

    seen.add(num);
    results.push({ number: num, choice });
  }

  return results;
}

/**
 * Call Claude Haiku API to interpret a natural language response
 * @param {string} bodyText - Email body text
 * @param {string[]} pollChoices - Array of choice strings
 * @returns {Promise<Array<{number: number, choice: string}>>}
 */
async function callClaudeAPI(bodyText, pollChoices) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    logger.debug('No ANTHROPIC_API_KEY set, skipping NLP fallback');
    return [];
  }

  const userMessage = buildUserMessage(bodyText, pollChoices);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 256,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: userMessage }]
      }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errBody = await response.text().catch(() => '');
      logger.warn('Claude API returned ' + response.status + ': ' + errBody.substring(0, 200));
      return [];
    }

    const data = await response.json();
    const text = data.content?.[0]?.text || '';
    return parseNLPResponse(text, pollChoices.length);
  } catch (err) {
    clearTimeout(timeoutId);
    if (err.name === 'AbortError') {
      logger.warn('Claude API call timed out after ' + TIMEOUT_MS + 'ms');
    } else {
      logger.warn('Claude API call failed: ' + err.message);
    }
    return [];
  }
}

/**
 * Extract responses from email body text, with NLP fallback.
 *
 * Flow:
 * 1. Try regex parsing (fast, free)
 * 2. If regex returns nothing and pollChoices provided, try Claude Haiku
 * 3. Return results with method indicator
 *
 * @param {string} bodyText - Email body text
 * @param {string[]} pollChoices - Array of choice strings from Poll.md (needed for NLP)
 * @returns {Promise<{responses: Array<{number: number, choice: string}>, method: string}>}
 */
async function extractResponsesWithNLP(bodyText, pollChoices) {
  // Step 1: regex (always tried first)
  const regexResults = gmailHelpers.extractResponses(bodyText);
  if (regexResults.length > 0) {
    return { responses: regexResults, method: 'regex' };
  }

  // Step 2: NLP fallback
  if (!pollChoices || pollChoices.length === 0) {
    return { responses: [], method: 'none' };
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    logger.debug('Hint: set ANTHROPIC_API_KEY to enable NLP fallback for natural language responses');
    return { responses: [], method: 'none' };
  }

  logger.debug('Regex found no responses, trying NLP fallback...');
  const nlpResults = await callClaudeAPI(bodyText, pollChoices);

  if (nlpResults.length > 0) {
    return { responses: nlpResults, method: 'nlp' };
  }

  return { responses: [], method: 'none' };
}

module.exports = {
  extractResponsesWithNLP,
  // Exported for testing
  parseNLPResponse,
  buildUserMessage
};
