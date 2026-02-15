/**
 * Gmail OAuth2 Authentication Module
 * Handles one-time setup and token management for Gmail API
 */

const fs = require('fs');
const path = require('path');
const { google } = require('googleapis');
const { OAuth2Client } = require('google-auth-library');
const http = require('http');
const url = require('url');
const open = require('open');

// Directory for credentials (in user's home directory)
const CREDS_DIR = path.join(process.env.HOME || process.env.USERPROFILE, '.gmail-credentials');
const CLIENT_SECRET_PATH = path.join(CREDS_DIR, 'client_secret.json');
const CREDENTIALS_PATH = path.join(CREDS_DIR, 'credentials.json');

// Required Gmail scopes
const GMAIL_SCOPES = [
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.modify'
];

let authClient = null;

/**
 * Check if credentials directory exists and has required files
 */
function isAuthenticated() {
  try {
    return fs.existsSync(CLIENT_SECRET_PATH) && fs.existsSync(CREDENTIALS_PATH);
  } catch {
    return false;
  }
}

/**
 * Load client secret from file
 */
function loadClientSecret() {
  try {
    const content = fs.readFileSync(CLIENT_SECRET_PATH, 'utf8');
    return JSON.parse(content);
  } catch (err) {
    return null;
  }
}

/**
 * Load saved credentials from file
 */
function loadSavedCredentials() {
  try {
    const content = fs.readFileSync(CREDENTIALS_PATH, 'utf8');
    return JSON.parse(content);
  } catch {
    return null;
  }
}

/**
 * Save credentials to file with restricted permissions
 */
function saveCredentials(credentials) {
  try {
    // Create directory if it doesn't exist
    if (!fs.existsSync(CREDS_DIR)) {
      fs.mkdirSync(CREDS_DIR, { recursive: true, mode: 0o700 });
    }

    const content = JSON.stringify(credentials, null, 2);
    fs.writeFileSync(CREDENTIALS_PATH, content, { mode: 0o600 });
    return true;
  } catch (err) {
    console.error('Error saving credentials:', err.message);
    return false;
  }
}

/**
 * Create OAuth2 client from credentials
 */
function createOAuth2Client(clientSecret) {
  const { client_id, client_secret, redirect_uris } = clientSecret.installed || clientSecret.web;

  return new OAuth2Client({
    clientId: client_id,
    clientSecret: client_secret,
    redirectUri: redirect_uris[0] || 'http://localhost:3000/oauth2callback'
  });
}

/**
 * Generate OAuth2 authorization URL
 */
function getAuthorizationUrl(oauth2Client) {
  return oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: GMAIL_SCOPES,
    prompt: 'consent'
  });
}

/**
 * Exchange authorization code for tokens
 */
async function getTokensFromCode(oauth2Client, code) {
  try {
    const { tokens } = await oauth2Client.getToken(code);
    return tokens;
  } catch (err) {
    throw new Error(`Failed to exchange authorization code: ${err.message}`);
  }
}

/**
 * Validate tokens have required scopes
 */
function validateTokenScopes(tokens) {
  if (!tokens.scope) return false;
  const grantedScopes = tokens.scope.split(' ');
  return GMAIL_SCOPES.every(scope => grantedScopes.includes(scope));
}

/**
 * Authenticate user for the first time using OAuth2 flow
 */
async function authenticateUser() {
  const clientSecret = loadClientSecret();
  if (!clientSecret) {
    throw new Error(
      `Client credentials not found.\n\n` +
      `Please set up OAuth2 credentials:\n` +
      `1. Go to https://console.cloud.google.com\n` +
      `2. Create a new project or select existing\n` +
      `3. Enable Gmail API\n` +
      `4. Create OAuth2 credentials (Desktop application)\n` +
      `5. Download JSON and save to:\n` +
      `   ${CLIENT_SECRET_PATH}\n\n` +
      `Then run: /poll-gmail-setup`
    );
  }

  const oauth2Client = createOAuth2Client(clientSecret);
  const authUrl = getAuthorizationUrl(oauth2Client);

  console.log('Opening browser for authentication...');
  console.log(`If browser doesn't open, visit: ${authUrl}`);

  let server;
  let codePromise;

  try {
    // Create promise to receive authorization code
    codePromise = new Promise((resolve, reject) => {
      server = http.createServer(async (req, res) => {
        const parsedUrl = url.parse(req.url, true);
        const code = parsedUrl.query.code;
        const error = parsedUrl.query.error;

        if (error) {
          res.writeHead(400, { 'Content-Type': 'text/plain' });
          res.end(`Error: ${error}\n\nYou can close this window.`);
          server.close();
          reject(new Error(`OAuth authorization failed: ${error}`));
        } else if (code) {
          res.writeHead(200, { 'Content-Type': 'text/plain' });
          res.end('Authorization successful! You can close this window.');
          server.close();
          resolve(code);
        } else {
          res.writeHead(400, { 'Content-Type': 'text/plain' });
          res.end('Missing authorization code');
          server.close();
          reject(new Error('Missing authorization code'));
        }
      });

      server.on('error', (err) => {
        if (err.code === 'EADDRINUSE') {
          reject(new Error(`Port 3000 is already in use. Please close other applications using this port.`));
        } else {
          reject(err);
        }
      });

      server.listen(3000);

      // Add timeout
      setTimeout(() => {
        if (server) {
          server.close();
          reject(new Error('OAuth authorization timeout (5 minutes)'));
        }
      }, 5 * 60 * 1000);
    });

    // Try to open browser
    try {
      await open(authUrl);
    } catch {
      console.log(`\nPlease visit this URL to authorize:\n${authUrl}`);
    }

    // Wait for authorization code
    const code = await codePromise;

    const tokens = await getTokensFromCode(oauth2Client, code);

    if (!validateTokenScopes(tokens)) {
      throw new Error('Granted scopes do not match required scopes');
    }

    saveCredentials(tokens);
    console.log('✓ Authentication successful! Credentials saved.');
    return true;
  } catch (err) {
    throw err;
  } finally {
    if (server) {
      server.close();
    }
  }
}

/**
 * Get authenticated Gmail client
 * Returns null if not authenticated, authenticated client otherwise
 */
async function getAuthClient() {
  // Return cached client if available
  if (authClient) {
    return authClient;
  }

  // Check if authenticated
  if (!isAuthenticated()) {
    return null;
  }

  try {
    const clientSecret = loadClientSecret();
    const tokens = loadSavedCredentials();

    if (!clientSecret || !tokens) {
      return null;
    }

    const oauth2Client = createOAuth2Client(clientSecret);
    oauth2Client.setCredentials(tokens);

    // Test if tokens are valid by trying a simple API call
    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
    try {
      await gmail.users.getProfile({ userId: 'me' });
    } catch (err) {
      // Try to refresh tokens if they're expired
      if (err.message.includes('invalid_grant')) {
        return null; // Tokens expired and can't refresh, need re-auth
      }
    }

    authClient = oauth2Client;
    return authClient;
  } catch (err) {
    console.error('Error loading authentication:', err.message);
    return null;
  }
}

/**
 * Create authenticated Gmail client
 */
function createGmailClient(oauth2Client) {
  if (!oauth2Client) {
    return null;
  }
  return google.gmail({ version: 'v1', auth: oauth2Client });
}

module.exports = {
  isAuthenticated,
  authenticateUser,
  getAuthClient,
  createGmailClient,
  GMAIL_SCOPES,
  CREDS_DIR,
  CLIENT_SECRET_PATH,
  CREDENTIALS_PATH
};
