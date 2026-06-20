#!/bin/zsh
export PATH=/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin
cd "$(dirname "$0")"

LOG="$(dirname "$0")/pipeline.log"
log() { local m="[$(date '+%Y-%m-%d %H:%M:%S')] $1"; echo "$m"; echo "$m" >> "$LOG"; }

log "══════════════════════════════════════════════"
log "sheet_to_csv started (manual run)"
log "══════════════════════════════════════════════"

# Pipe all output to both terminal and log
exec > >(tee -a "$LOG") 2>&1

python3 << 'EOF'
import json, csv, pathlib, os, warnings
warnings.filterwarnings('ignore')
import gspread
from google.oauth2.credentials import Credentials

TOKEN_FILE  = pathlib.Path(os.path.expanduser('~/Library/Mobile Documents/com~apple~CloudDocs/Guitar Garage NZ/Admin/CRM/token.json'))
CONFIG_FILE = pathlib.Path(os.path.expanduser('~/Library/Mobile Documents/com~apple~CloudDocs/Desktop/SCHEDULER_old/sheets_config.json'))
CSV_FILE    = pathlib.Path(os.path.expanduser('~/Library/Mobile Documents/com~apple~CloudDocs/Desktop/SCHEDULER_old/jobs.csv'))

MANUAL_FIELDS = ['FirstSeen', 'Days', 'Tag', 'Hours', 'Action', 'VB', 'BL', 'PJ']

print("─────────────────────────────────────────────")
print("  Google Sheet → jobs.csv sync")
print("  Updates: FirstSeen, Days, Tag, Hours, Action, VB, BL, PJ")
print("─────────────────────────────────────────────")

# ── Load Google Sheet ─────────────────────────────────────────────────────────
config = json.load(open(CONFIG_FILE))
creds  = Credentials.from_authorized_user_file(str(TOKEN_FILE))
gc     = gspread.authorize(creds)
sh     = gc.open_by_key(config['sheet_id'])
ws     = sh.get_worksheet(0)

all_rows = ws.get_all_values()
if not all_rows:
    print("ERROR: Sheet appears empty.")
    exit(1)

header   = all_rows[0]
data_rows = all_rows[1:]

# Find column indices dynamically from header
def col(name):
    try:
        return header.index(name)
    except ValueError:
        return None

job_col        = col('Job')
customer_col   = col('Customer')
firstseen_col  = col('FirstSeen')
days_col       = col('Days')
tag_col        = col('Tag')
hours_col      = col('Hours')
action_col     = col('Action')
vb_col         = col('VB')
bl_col         = col('BL')
pj_col         = col('PJ')

if job_col is None:
    print("ERROR: Can't find 'Job' column in sheet header.")
    exit(1)

# Build lookup: job_num → manual field values
sheet_data = {}
for row in data_rows:
    job_num = str(row[job_col]).strip()
    if not job_num:
        continue
    sheet_data[job_num] = {
        'FirstSeen': row[firstseen_col].strip() if firstseen_col is not None else '',
        'Days':      row[days_col].strip()      if days_col      is not None else '',
        'Tag':       row[tag_col].strip()       if tag_col       is not None else '',
        'Hours':     row[hours_col].strip()     if hours_col     is not None else '',
        'Action':    row[action_col].strip()    if action_col    is not None else '',
        'VB':        row[vb_col].strip()        if vb_col        is not None else '',
        'BL':        row[bl_col].strip()        if bl_col        is not None else '',
        'PJ':        row[pj_col].strip()        if pj_col        is not None else '',
    }

print(f"Sheet: {len(sheet_data)} jobs loaded")

# ── Load jobs.csv ─────────────────────────────────────────────────────────────
with open(CSV_FILE, newline='', encoding='utf-8') as f:
    reader   = csv.DictReader(f)
    fieldnames = list(reader.fieldnames or [])
    csv_rows   = list(reader)

# Ensure PJ is in fieldnames even if missing from old CSV
if 'PJ' not in fieldnames:
    fieldnames.append('PJ')
    print("Added missing PJ column to CSV")

print(f"CSV:   {len(csv_rows)} jobs loaded")

# ── Merge ─────────────────────────────────────────────────────────────────────
updated = 0
not_found = 0

for row in csv_rows:
    job_num = str(row.get('Job', '')).strip()
    if job_num in sheet_data:
        changes = []
        for field in MANUAL_FIELDS:
            sheet_val = sheet_data[job_num].get(field, '')
            csv_val   = str(row.get(field, '')).strip()
            if sheet_val != csv_val:
                changes.append(f"{field}: '{csv_val}' → '{sheet_val}'")
                row[field] = sheet_val
        if changes:
            updated += 1
            print(f"  #{job_num}: {', '.join(changes)}")
    else:
        not_found += 1

# ── Push new jobs to Sheet: add rows for jobs in CSV not yet in sheet ──────────
new_rows = []
for row in csv_rows:
    job_num = str(row.get('Job', '')).strip()
    if job_num and job_num not in sheet_data:
        # Build row aligned to the sheet's actual header columns
        sheet_row = [row.get(col_name, '') for col_name in header]
        new_rows.append(sheet_row)

if new_rows:
    print(f"\nAdding {len(new_rows)} new job(s) to Sheet:")
    for r in new_rows:
        job_val = r[job_col] if job_col is not None and job_col < len(r) else '?'
        print(f"  #{job_val}")
    ws.append_rows(new_rows, value_input_option='RAW')
    print("Sheet updated with new jobs.")
else:
    print("No new jobs to add to Sheet.")

# ── Push PDF-owned fields back to existing Sheet rows ─────────────────────────
PDF_FIELDS = ['Customer', 'Mfr', 'Model', 'Status', 'Desc']
csv_map = {str(r.get('Job', '')).strip(): r for r in csv_rows}
pdf_updates = []
for i, row in enumerate(data_rows, start=2):
    job = str(row[job_col]).strip() if job_col is not None else ''
    if not job or job not in csv_map:
        continue
    for field in PDF_FIELDS:
        col_idx = col(field)
        if col_idx is None:
            continue
        sheet_val = row[col_idx].strip() if col_idx < len(row) else ''
        csv_val = str(csv_map[job].get(field, '')).strip()
        if csv_val and csv_val != sheet_val:
            col_letter = chr(65 + col_idx)
            pdf_updates.append({'range': f'{col_letter}{i}', 'values': [[csv_val]]})
if pdf_updates:
    ws.batch_update(pdf_updates)
    print(f"Updated {len(pdf_updates)} PDF-field cell(s) on Sheet.")
else:
    print("Sheet PDF fields already up to date.")

# ── Write CSV ─────────────────────────────────────────────────────────────────
with open(CSV_FILE, 'w', newline='', encoding='utf-8') as f:
    w = csv.DictWriter(f, fieldnames=fieldnames, extrasaction='ignore')
    w.writeheader()
    w.writerows(csv_rows)

print()
print(f"Updated : {updated} jobs")
print(f"No change: {len(csv_rows) - updated - not_found} jobs")
print(f"Not in sheet: {not_found} jobs (kept as-is)")
print(f"CSV saved: {CSV_FILE}")

# ── Auto-clean Sheet: remove rows for completed jobs not in CSV ────────────────
csv_job_set = {str(r.get('Job', '')).strip() for r in csv_rows}
to_delete = []
for i, row in enumerate(data_rows, start=2):  # 1-indexed, row 1 is header
    job = str(row[job_col]).strip() if job_col is not None else ''
    if job and job not in csv_job_set:
        to_delete.append((i, job))

if to_delete:
    print(f"\nRemoving {len(to_delete)} completed job(s) from Sheet:")
    for idx, job in to_delete:
        print(f"  #{job}")
    for idx, job in reversed(to_delete):
        ws.delete_rows(idx)
    print("Sheet cleaned.")
else:
    print("Sheet already in sync — nothing to remove.")

print("─────────────────────────────────────────────")

EOF

# ── Firebase upload ────────────────────────────────────────────────────────────
python3 << 'FBEOF'
import csv, json, re, math, pathlib, urllib.request, urllib.error
from datetime import datetime, timezone

CSV_FILE     = pathlib.Path.home() / 'Library/Mobile Documents/com~apple~CloudDocs/Desktop/SCHEDULER_old/jobs.csv'
FIREBASE_API_KEY = 'AIzaSyC_t5tO9-vaCyo1pNePk7nT2bhoTubfv5M'
PROJECT_ID       = 'ggnz-scheduler'
DOC_URL = (
    f'https://firestore.googleapis.com/v1/projects/{PROJECT_ID}'
    f'/databases/(default)/documents/ggnz/schedule?key={FIREBASE_API_KEY}'
)

print("─────────────────────────────────────────────")
print("  CSV → Firebase sync")
print("─────────────────────────────────────────────")

# ── Helpers ────────────────────────────────────────────────────────────────────
DEFAULT_KEYWORDS = {
    'Fretwork':    ['refret', 'fret level', 'fret dress', 'fret polish'],
    'Luthier':     [r'bridge(?!\s*pup|\s*pickup)', r'\bcrack\b', 'brace', r'\breset\b', r'\btop\b', 'lower bout', 'inlay',
                    'binding', 'finish', 'restoration', r'\bsplit\b', 'lifting', 'lifted', 'broken'],
    'Electronics': ['power', 'output', 'tube', 'fuse', 'amp', 'recap', 'blown', 'doa',
                    'caps', 'opamp', 'voltage', 'pcb', 'speaker', 'voice chip', 'calibrate',
                    'impedance', 'mute', 'phantom', 'preamp', 'mains', 'dc power', 'wire feed',
                    'keyboard', 'synth', 'mixer', 'console', 'interface', 'desk', 'rack',
                    'valve', r'\bhead\b', 'combo', 'bias', 'jack', 'pot', 'wiring'],
    'Setup':       ['setup', 'stp', 'intonation', 'pups', 'pickup', 'wiring', 'strings',
                    'restring', 'switch', 'trem', 'nut', 'saddle', 'string height'],
}

def infer_bench(desc, status, action, model, mfr):
    act = (action or '').strip().upper()
    if status == 'In Transit': return 'Admin'
    if status == 'Waiting' and act not in ('INC', 'CI'): return 'Admin'
    d = (desc + ' ' + model).lower()
    m = mfr.lower()
    def rx(bench): return re.compile('|'.join(DEFAULT_KEYWORDS[bench]))
    if rx('Fretwork').search(d): return 'Fretwork'
    if rx('Luthier').search(d): return 'Luthier'
    if rx('Electronics').search(d): return 'Electronics'
    if rx('Setup').search(d): return 'Setup'
    if re.search(r'passport|pa\s*\d', d): return 'Electronics'
    if re.search(r'db tech|rcf|turbosound|allen|hughes|behringer|ampeg|roland|marshall|matchless|casio|yamaha|trident|m audio|dynaudio|peavey|mackie|qsc|crown|crest|electro.voice|jbl|bose|bossweld|subtle noise|beesneez', m): return 'Electronics'
    if re.search(r'fender|gibson|martin|taylor|maton|cole clark|takamine|aria|cort|hofner|solar|samick|suzuki|alegria|ibanez|epiphone|gretsch|rickenbacker|guild|larrivee|seagull', m): return 'Setup'
    return 'Admin'

def infer_tag(h):
    if not h or h <= 0: return 'EZ'
    if h <= 1.5: return 'EZ'
    if h <= 3:   return 'T'
    if h <= 5.5: return 'M'
    return 'H'

def hours_range(h):
    if not h or h <= 0: return '—'
    lo, hi = math.floor(h), math.ceil(h)
    return str(h) if lo == hi else f'{lo}-{hi}'

# ── Parse CSV → job objects ────────────────────────────────────────────────────
with open(CSV_FILE, newline='', encoding='utf-8') as f:
    raw = [l for l in f if not l.lstrip().startswith('#')]
rows = list(csv.DictReader(raw))

ACCEPTED = {'On Hold', 'Waiting', 'To Be Inv', 'In Transit'}
jobs = []
skipped = []
for obj in rows:
    status = obj.get('Status', '')
    act    = (obj.get('Action', '') or '').strip().upper()
    raw_hours = str(obj.get('Hours') or '').strip()
    if '-' in raw_hours:
        parts = raw_hours.split('-')
        try: hours = (float(parts[0]) + float(parts[1])) / 2
        except: hours = 0.0
    else:
        try: hours = float(raw_hours) if raw_hours else 0.0
        except: hours = 0.0
    days   = obj.get('Days', '').strip()
    ready_to_start = status == 'On Hold' and obj.get('BL') == 'Y' and act == 'GTS'
    awaiting       = status == 'Waiting' and act in ('INC', 'CI')
    in_transit     = status == 'In Transit'
    schedulable    = status in ('Active', 'Booked In') or ready_to_start
    if not schedulable and status not in ACCEPTED:
        continue
    # Skip jobs missing Hours or Days — not ready to schedule
    if not hours or not days:
        skipped.append(f"#{obj['Job']} {obj.get('Mfr','')} {obj.get('Model','')} (missing: {'Hours' if not hours else ''} {'Days' if not days else ''})")
        continue
    effective_hours = hours if not (hours == 0 and schedulable) else 1.0
    bench = infer_bench(obj.get('Desc',''), status, obj.get('Action',''), obj.get('Model',''), obj.get('Mfr',''))
    jobs.append({
        'id':           str(obj['Job']),
        'job':          obj['Job'],
        'mfr':          obj.get('Mfr', ''),
        'model':        obj.get('Model', ''),
        'status':       status,
        'schedulable':  schedulable,
        'readyToStart': ready_to_start,
        'awaiting':     awaiting,
        'inTransit':    in_transit,
        'days':         int(obj.get('Days') or 0),
        'tag':          obj.get('Tag') or infer_tag(effective_hours),
        'hours':        effective_hours,
        'hoursRange':   hours_range(effective_hours),
        'action':       obj.get('Action', ''),
        'desc':         obj.get('Desc', ''),
        'customer':     obj.get('Customer', ''),
        'vb':           obj.get('VB') == 'Y',
        'backlog':      obj.get('BL') == 'Y',
        'project':      obj.get('PJ') == 'Y',
        'bench':        bench,
        'scheduled':    False,
    })

print(f"Parsed {len(jobs)} jobs from CSV")
if skipped:
    print(f"Skipped {len(skipped)} incomplete jobs (missing Hours or Days):")
    for s in skipped:
        print(f"  {s}")

# ── Fetch existing scheduledSlots from Firestore ───────────────────────────────
scheduled_slots = {}
try:
    req = urllib.request.Request(DOC_URL, method='GET')
    with urllib.request.urlopen(req, timeout=10) as resp:
        doc = json.loads(resp.read())
    raw_slots = doc.get('fields', {}).get('scheduledSlots', {}).get('mapValue', {}).get('fields', {})
    for k, v in raw_slots.items():
        val = v.get('stringValue') or v.get('integerValue') or ''
        if val:
            scheduled_slots[k] = str(val)
    print(f"Fetched {len(scheduled_slots)} scheduled slots from Firestore")
except urllib.error.HTTPError as e:
    if e.code == 404:
        print("No existing Firestore doc — will create fresh")
    else:
        print(f"WARNING: Could not fetch existing slots ({e.code}) — proceeding with empty slots")
except Exception as e:
    print(f"WARNING: Could not fetch existing slots ({e}) — proceeding with empty slots")

# ── Serialise to Firestore REST format ─────────────────────────────────────────
def to_fs(val):
    if isinstance(val, bool): return {'booleanValue': val}
    if isinstance(val, int):  return {'integerValue': str(val)}
    if isinstance(val, float):
        return {'integerValue': str(int(val))} if val == int(val) else {'doubleValue': val}
    if isinstance(val, str):  return {'stringValue': val}
    if isinstance(val, list): return {'arrayValue': {'values': [to_fs(v) for v in val]}}
    if isinstance(val, dict): return {'mapValue': {'fields': {k: to_fs(v) for k, v in val.items()}}}
    if val is None:           return {'nullValue': None}
    return {'stringValue': str(val)}

body = json.dumps({
    'fields': {
        'jobs':           to_fs(jobs),
        'scheduledSlots': to_fs(scheduled_slots),
        'updatedAt':      {'stringValue': datetime.now(timezone.utc).isoformat()},
    }
}).encode()

# ── PATCH to Firestore ─────────────────────────────────────────────────────────
patch_url = DOC_URL + '&currentDocument.exists=false' if not scheduled_slots and len(jobs) == 0 else DOC_URL
try:
    req = urllib.request.Request(
        DOC_URL, data=body, method='PATCH',
        headers={'Content-Type': 'application/json'}
    )
    with urllib.request.urlopen(req, timeout=15) as resp:
        resp.read()
    print(f"Firebase updated — {len(jobs)} jobs pushed")
    print("─────────────────────────────────────────────")
    print("Done! All Macs will update within seconds.")
    print("─────────────────────────────────────────────")
except Exception as e:
    print(f"ERROR: Firebase upload failed: {e}")
    print("Jobs are saved in CSV — re-upload manually if needed.")
    print("─────────────────────────────────────────────")

FBEOF

log "sheet_to_csv finished"
