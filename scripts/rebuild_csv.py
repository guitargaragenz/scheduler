"""Rebuild jobs.csv from the Google Sheet. READ-ONLY on the Sheet.

Recovery tool for the 2026-07-26 truncation: the normal sheet_to_csv.command
treats jobs.csv as authoritative for which jobs exist, so it can never restore
rows the CSV lost. This goes the other direction, once.
"""
import csv, json, os, pathlib, shutil, warnings
warnings.filterwarnings('ignore')
import gspread
from google.oauth2.credentials import Credentials

H = os.path.expanduser
TOKEN  = pathlib.Path(H('~/Library/Mobile Documents/com~apple~CloudDocs/Guitar Garage NZ/Admin/CRM/token.json'))
CONFIG = pathlib.Path(H('~/Library/Mobile Documents/com~apple~CloudDocs/Desktop/SCHEDULER_old/sheets_config.json'))
CSV    = pathlib.Path(H('~/Library/Mobile Documents/com~apple~CloudDocs/Desktop/SCHEDULER_old/jobs.csv'))

# Column order the rest of the pipeline and the app's CSV parser expect.
FIELDS = ['Job','Customer','Mfr','Model','Status','FirstSeen','Days','Tag',
          'Hours','Action','Desc','VB','BL','PJ']

creds = Credentials.from_authorized_user_file(str(TOKEN))
ws = gspread.authorize(creds).open_by_key(json.load(open(CONFIG))['sheet_id']).get_worksheet(0)
rows = ws.get_all_values()
header, data = rows[0], rows[1:]

def idx(name):
    return header.index(name) if name in header else None

cols = {f: idx(f) for f in FIELDS}
# The Sheet has no FirstSeen column (it has 'Date', which the live script also
# fails to find) — keep it blank so this run changes nothing but the row set.
print("unmapped columns (left blank):", [f for f, i in cols.items() if i is None])

out, seen = [], set()
for row in data:
    job = row[cols['Job']].strip() if cols['Job'] is not None else ''
    if not job or job in seen:
        continue
    seen.add(job)
    out.append({f: (row[i].strip() if i is not None and i < len(row) else '')
                for f, i in cols.items()})

if len(out) < 40:
    raise SystemExit(f"REFUSING to write: Sheet only yielded {len(out)} jobs. "
                     "Expected ~45 — restore the Sheet before running this.")

backup = CSV.with_name(f'jobs.csv.bak-truncated-{len(csv.DictReader(open(CSV)).fieldnames or [])}col')
shutil.copy2(CSV, backup)
print("backed up old CSV →", backup.name)

with open(CSV, 'w', newline='', encoding='utf-8') as f:
    w = csv.DictWriter(f, fieldnames=FIELDS, extrasaction='ignore')
    w.writeheader()
    w.writerows(out)

print(f"wrote {len(out)} jobs to {CSV}")
print("blank Mfr count:", sum(1 for r in out if not r['Mfr']))
