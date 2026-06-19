#!/usr/bin/env python3
"""Push structured rows to GG Workshop Log Google Sheet.

Called programmatically by Claude — not intended for manual use.
"""

import sys
import os
import warnings
warnings.filterwarnings('ignore')

SHEET_ID = '1N2RvNlYWpmeuSHR8had9d4ydSZ6lyx77XIIbeKkHA8M'
CREDS_FILE = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'jt-backup-ggnz-35a126beb4ca.json')
SCOPES = ['https://www.googleapis.com/auth/spreadsheets']

HEADERS = ['Date', 'Category', 'Job #', 'Make / Model', 'Customer', 'Notes']

def push_rows(rows, entry_date, session_title):
    from google.oauth2 import service_account
    from googleapiclient.discovery import build

    creds = service_account.Credentials.from_service_account_file(CREDS_FILE, scopes=SCOPES)
    service = build('sheets', 'v4', credentials=creds)
    sheet = service.spreadsheets()

    # Ensure header row exists
    result = sheet.values().get(spreadsheetId=SHEET_ID, range='A1:F1').execute()
    if not result.get('values'):
        sheet.values().update(
            spreadsheetId=SHEET_ID, range='A1:F1',
            valueInputOption='RAW',
            body={'values': [HEADERS]}
        ).execute()

    # Build row data — first row has session title as a divider
    data = [[entry_date, f'=== {session_title} ===', '', '', '', '']]
    for r in rows:
        data.append([
            entry_date,
            r.get('category', ''),
            r.get('job', ''),
            r.get('make_model', ''),
            r.get('customer', ''),
            r.get('notes', ''),
        ])
    data.append(['', '', '', '', '', ''])  # blank spacer

    sheet.values().append(
        spreadsheetId=SHEET_ID, range='A:F',
        valueInputOption='RAW',
        insertDataOption='INSERT_ROWS',
        body={'values': data}
    ).execute()

    print(f"Done — pushed {len(rows)} rows to GG Workshop Log")

if __name__ == '__main__':
    # Quick test
    push_rows([
        {'category': 'Test', 'job': '#0000', 'make_model': 'Test Guitar', 'customer': 'Test Customer', 'notes': 'Test entry'},
    ], '2026-06-20', 'Test push')

