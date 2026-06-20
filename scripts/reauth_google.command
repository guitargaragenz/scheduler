#!/bin/bash
# ── Re-authorise Google Sheets OAuth token ────────────────────────────────────
# Run this whenever sheet_to_csv.command fails with "Token has been expired or revoked"
# It opens a browser window, you log in to Google, and a new token.json is saved.

echo "══════════════════════════════════════════════"
echo "  GGNZ — Google Sheets Re-authorisation"
echo "══════════════════════════════════════════════"
echo ""
echo "A browser window will open. Log in with the Guitar Garage Google account."
echo "After authorising, come back here — the token will be saved automatically."
echo ""

python3 - <<'PYEOF'
import pathlib, json, sys

CREDENTIALS_FILE = pathlib.Path(
    '~/Library/Mobile Documents/com~apple~CloudDocs/Guitar Garage NZ/Admin/CRM/credentials.json'
).expanduser()

TOKEN_FILE = pathlib.Path(
    '~/Library/Mobile Documents/com~apple~CloudDocs/Guitar Garage NZ/Admin/CRM/token.json'
).expanduser()

SCOPES = [
    'https://www.googleapis.com/auth/spreadsheets',
    'https://www.googleapis.com/auth/drive',
]

if not CREDENTIALS_FILE.exists():
    print(f"ERROR: credentials.json not found at:\n  {CREDENTIALS_FILE}")
    sys.exit(1)

try:
    from google_auth_oauthlib.flow import InstalledAppFlow
except ImportError:
    print("Installing required package...")
    import subprocess
    subprocess.run([sys.executable, '-m', 'pip', 'install', 'google-auth-oauthlib'], check=True)
    from google_auth_oauthlib.flow import InstalledAppFlow

flow = InstalledAppFlow.from_client_secrets_file(str(CREDENTIALS_FILE), SCOPES)
creds = flow.run_local_server(port=0)

TOKEN_FILE.write_text(creds.to_json())
print("")
print(f"✓ Token saved to:")
print(f"  {TOKEN_FILE}")
print("")
print("You can now run sheet_to_csv.command normally.")
PYEOF

echo ""
echo "══════════════════════════════════════════════"
read -p "Press Enter to close..."
