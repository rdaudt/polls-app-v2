#!/usr/bin/env node

/**
 * OAuth2 Setup Skill for Gmail Integration
 * Guides user through one-time authentication process
 */

const fs = require('fs');
const path = require('path');
const gmailAuth = require('../poll-shared/gmail-auth');

async function main() {
  try {
    console.log('\n📧 Gmail OAuth2 Setup\n');
    console.log('═'.repeat(50));

    // Check if already authenticated
    if (gmailAuth.isAuthenticated()) {
      console.log('\n✓ Gmail is already configured!');

      // Try to verify credentials are still valid
      try {
        const authClient = await gmailAuth.getAuthClient();
        if (authClient) {
          console.log('✓ Credentials verified and ready to use');
          console.log('\nYou can now use:');
          console.log('  - /poll-send-emails');
          console.log('  - /poll-fetch-responses');
          console.log('\nTo re-authenticate with different credentials,');
          console.log('delete: ' + gmailAuth.CREDENTIALS_PATH);
          console.log('Then run: /poll-gmail-setup\n');
          return;
        }
      } catch (err) {
        console.log('⚠ Credentials expired or invalid');
        console.log('Please complete setup again below\n');
      }
    }

    // Check for client_secret.json
    console.log('\nChecking for client credentials...');
    if (!fs.existsSync(gmailAuth.CLIENT_SECRET_PATH)) {
      console.error('\n✗ Client credentials not found!\n');
      console.log('To set up Gmail OAuth2:\n');
      console.log('1. Go to: https://console.cloud.google.com');
      console.log('2. Create a new project (or use existing)');
      console.log('3. Enable Gmail API:');
      console.log('   - APIs & Services → Library');
      console.log('   - Search "Gmail API" → Enable\n');
      console.log('4. Create OAuth2 credentials:');
      console.log('   - APIs & Services → Credentials');
      console.log('   - + Create Credentials → OAuth client ID');
      console.log('   - Application type: Desktop application');
      console.log('   - Download JSON file\n');
      console.log('5. Save to:\n   ' + gmailAuth.CLIENT_SECRET_PATH);
      console.log('\n6. Then run: /poll-gmail-setup\n');
      process.exit(1);
    }

    console.log('✓ Found credentials at: ' + gmailAuth.CLIENT_SECRET_PATH);

    // Run OAuth2 flow
    console.log('\nStarting OAuth2 flow...');
    console.log('(A browser window will open)\n');

    const success = await gmailAuth.authenticateUser();

    if (success) {
      console.log('\n✓ Gmail is now configured for:');
      console.log('  - Sending emails');
      console.log('  - Reading responses');
      console.log('  - Managing labels\n');
      console.log('✓ Credentials saved to:');
      console.log('  ' + gmailAuth.CREDENTIALS_PATH + '\n');
      console.log('You can now use:');
      console.log('  - /poll-send-emails');
      console.log('  - /poll-fetch-responses\n');
      process.exit(0);
    }
  } catch (err) {
    console.error('\n✗ Setup failed:', err.message);
    process.exit(1);
  }
}

main();
