---
name: poll-gmail-setup
description: One-time Gmail OAuth2 authentication setup for automated email workflows
user_invocable: true
---

# poll-gmail-setup

Complete one-time OAuth2 authentication setup for Gmail integration. Required before using `/poll-send-emails` and `/poll-fetch-responses` skills.

## Usage

```
/poll-gmail-setup
```

## Description

This skill guides you through the OAuth2 authentication process to enable automated email sending and response fetching. The setup requires:

1. A Google Cloud project with Gmail API enabled
2. OAuth2 credentials downloaded from Google Cloud Console
3. One-time browser-based authorization

The process is needed only once — credentials are saved securely for future use.

## Prerequisites

### Step 1: Create Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create a new project (or use existing)
3. Name it "Polls Service" or similar
4. Wait for project to initialize

### Step 2: Enable Gmail API

1. In Google Cloud Console, go to **APIs & Services** → **Library**
2. Search for "Gmail API"
3. Click **Gmail API** → **Enable**

### Step 3: Create OAuth2 Credentials

1. Go to **APIs & Services** → **Credentials**
2. Click **+ Create Credentials** → **OAuth client ID**
3. Choose application type: **Desktop application**
4. Name it "Polls Service"
5. Click **Create**
6. You'll see a popup with credentials. Click **Download** (download icon)
7. Save the JSON file as `client_secret.json`
8. Move to credentials directory: `~/.gmail-credentials/client_secret.json`

### Step 4: Run Setup Skill

Run this skill to complete OAuth2 flow:

```
/poll-gmail-setup
```

This will:
- Check for `client_secret.json` in `~/.gmail-credentials/`
- Open your browser to Google's authorization screen
- Request permission to send emails and read/modify Gmail
- Save refresh tokens securely
- Verify successful setup

## Workflow

1. **Client Secret Check**
   - Looks for `~/.gmail-credentials/client_secret.json`
   - If missing: Shows instructions to download from Google Cloud Console

2. **OAuth2 Authorization**
   - Starts local HTTP server for callback
   - Opens browser to Google consent screen
   - You authorize the Polls Service app
   - Credentials exchanged and saved

3. **Verification**
   - Tests Gmail API connection
   - Confirms required scopes granted
   - Displays success message

## Output

```
Gmail OAuth2 Setup

Checking for client credentials...
✓ Found credentials at ~/.gmail-credentials/client_secret.json

Opening browser for authorization...
[Browser opens to Google consent screen]

[You authorize the app]

Exchanging authorization code...
✓ Authorization successful!
✓ Credentials saved to ~/.gmail-credentials/credentials.json

Gmail is now configured for:
  - Sending emails
  - Reading responses
  - Managing labels

You can now use:
  - /poll-send-emails
  - /poll-fetch-responses
```

## Error Messages

### Missing client_secret.json

```
Error: Client credentials not found.

To set up Gmail:

1. Go to https://console.cloud.google.com
2. Create a new project or select existing
3. Enable Gmail API
4. Create OAuth2 credentials (Desktop application)
5. Download JSON file
6. Save to: ~/.gmail-credentials/client_secret.json

Then run: /poll-gmail-setup
```

### Port Already in Use

```
Error: Port 3000 is already in use.
Please close other applications using port 3000, then try again.
```

### OAuth Authorization Denied

```
Error: Authorization was denied.

You must grant permission for the Polls Service to:
  - Send emails on your behalf
  - Read your Gmail inbox
  - Modify Gmail labels

Please try again and click "Allow" when prompted.
```

### Timeout

```
Error: OAuth authorization timeout (5 minutes)

The authorization window closed without completing.
Please run the skill again to restart the process.
```

## Security

- Credentials stored in `~/.gmail-credentials/` (outside project directory)
- Files protected with restricted permissions (mode 600)
- OAuth2 refresh tokens never expire unless you revoke them
- Access tokens auto-refresh (expire after 1 hour)
- No credentials ever committed to git

## Required Permissions

The skill requests these Gmail scopes:
- `gmail.send` - Send emails on your behalf
- `gmail.readonly` - Read your Gmail inbox
- `gmail.modify` - Manage labels and mark messages as read

These are the minimum required for the polls service.

## Troubleshooting

### "Browser won't open"

If the browser doesn't automatically open:
1. Copy the URL displayed in terminal
2. Paste into your web browser
3. Complete authorization
4. The process will continue automatically

### "Already authenticated"

If credentials already exist:
- Run again to verify they're still valid
- If expired, delete `~/.gmail-credentials/credentials.json` and re-run

### "Permission denied" errors later

If `/poll-send-emails` or `/poll-fetch-responses` fail with permission errors:
1. Delete: `~/.gmail-credentials/credentials.json`
2. Re-run: `/poll-gmail-setup`
3. Make sure to click "Allow" during authorization

### Credential path issues

The skill creates the directory if needed:
- Windows: `C:\Users\<YourName>\.gmail-credentials\`
- macOS: `/Users/<YourName>/.gmail-credentials/`
- Linux: `/home/<YourName>/.gmail-credentials/`

## See Also

- `/poll-send-emails` - Send draft emails via Gmail
- `/poll-fetch-responses` - Retrieve responses from Gmail
- [USER-GUIDE.md](../../USER-GUIDE.md#gmail-integration) - Complete Gmail setup guide
