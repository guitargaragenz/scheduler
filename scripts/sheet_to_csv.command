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
import json, csv, pathlib, os, sys, warnings
warnings.filterwarnings('ignore')
import gspread
from google.oauth2.credentials import Credentials
import google.auth.exceptions

TOKEN_FILE  = pathlib.Path(os.path.expanduser('~/Library/Mobile Documents/com~apple~CloudDocs/Guitar Garage NZ/Admin/CRM/token.json'))
CREDS_FILE  = pathlib.Path(os.path.expanduser('~/Library/Mobile Documents/com~apple~CloudDocs/Guitar Garage NZ/Admin/CRM/credentials.json'))
CONFIG_FILE = pathlib.Path(os.path.expanduser('~/Library/Mobile Documents/com~apple~CloudDocs/Desktop/SCHEDULER_old/sheets_config.json'))
CSV_FILE    = pathlib.Path(os.path.expanduser('~/Library/Mobile Documents/com~apple~CloudDocs/Desktop/SCHEDULER_old/jobs.csv'))

SCOPES = [
    'https://www.googleapis.com/auth/spreadsheets',
    'https://www.googleapis.com/auth/drive',
]

MANUAL_FIELDS = ['FirstSeen', 'Days', 'Tag', 'Hours', 'Action', 'VB', 'BL', 'PJ']

print("─────────────────────────────────────────────")
print("  Google Sheet → jobs.csv sync")
print("  Updates: FirstSeen, Days, Tag, Hours, Action, VB, BL, PJ")
print("─────────────────────────────────────────────")

def do_reauth():
    """Run the OAuth browser flow, save new token, return fresh Credentials."""
    from google_auth_oauthlib.flow import InstalledAppFlow
    print("⚠️  Google OAuth token expired — opening browser for re-authentication...")
    flow = InstalledAppFlow.from_client_secrets_file(str(CREDS_FILE), SCOPES)
    new_creds = flow.run_local_server(port=0)
    TOKEN_FILE.write_text(new_creds.to_json())
    print("✓ New token saved. Retrying Sheet sync...")
    return new_creds

def open_sheet(creds):
    gc = gspread.authorize(creds)
    config = json.load(open(CONFIG_FILE))
    sh = gc.open_by_key(config['sheet_id'])
    return sh.get_worksheet(0)

# ── Load Google Sheet ─────────────────────────────────────────────────────────
try:
    creds = Credentials.from_authorized_user_file(str(TOKEN_FILE))
    ws = open_sheet(creds)
except (google.auth.exceptions.RefreshError, google.auth.exceptions.TransportError):
    try:
        creds = do_reauth()
        ws = open_sheet(creds)
    except Exception as e:
        print(f"ERROR: Re-authentication failed: {e}")
        sys.exit(1)

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

CSV_FILE     = pathlib.Path.home() / 'Library/Mobile Documents/com~apple~CloudDocs/Desktop/SCHEDULER_old/jobs.csv'
FIREBASE_API_KEY = 'AIzaSyC_t5tO9-vaCyo1pNePk7nT2bhoTubfv5M'
PROJECT_ID       = 'ggnz-scheduler'
BASE_URL = f'https://firestore.googleapis.com/v1/projects/{PROJECT_ID}/databases/(default)/documents'

def master_url(job_id):
    return f'{BASE_URL}/jobsMaster/{job_id}?key={FIREBASE_API_KEY}'

print("─────────────────────────────────────────────")
print("  CSV → jobsMaster sync")
print("─────────────────────────────────────────────")
print("This script is jobsMaster's ONLY writer. It never touches")
print("scheduling/split/pomodoro state (that lives in jobsState now).")

# ── Helpers ────────────────────────────────────────────────────────────────────
DEFAULT_KEYWORDS = {
    'Fretwork':    ['refret', 'fret level', 'fret dress', 'fret polish'],
    'Luthier':     [r'bridge(?!\s*pup|\s*pickup)', r'\bcrack\b', 'brace', r'\breset\b', r'\btop\b', 'lower bout', 'inlay',
                    'binding', 'refinish', 'restoration', r'\bsplit\b', 'lifting', 'lifted',
                    'broken neck', 'broken headstock', 'broken brace', 'broken bridge'],
    'Electronics': ['power', 'output', 'input', 'tube', 'fuse', 'amp', 'recap', 'blown', 'doa',
                    'caps', 'opamp', 'voltage', 'pcb', 'speaker', 'voice chip', 'calibrate',
                    'impedance', 'mute', 'phantom', 'preamp', 'mains', 'dc power', 'wire feed',
                    'keyboard', r'\bkeys?\b', 'synth', 'mixer', 'console', 'interface', 'desk', 'rack',
                    'valve', r'\bhead\b', 'combo', 'bias', 'jack', 'pot', 'wiring', 'scratchy'],
    'Setup':       ['setup', 'stp', 'intonation', 'pups', 'pickup', 'wiring', r'\bstring\b', 'strings',
                    'restring', 'switch', 'trem', 'nut', 'saddle', 'string height'],
}

# NOTE: this table + infer_bench() are hand-kept in sync with src/data/jobs.js's
# DEFAULT_BENCH_KEYWORDS/inferBench() (JS side is authoritative — this is the
# CSV/Sheet pipeline's copy). Keep the setup-priority-before-Electronics rule
# below aligned with the JS version if either changes.
def infer_bench(desc, status, action, model, mfr):
    act = (action or '').strip().upper()
    if status == 'In Transit': return 'Admin'
    if status == 'Waiting' and act not in ('INC', 'CI'): return 'Admin'
    if status == 'On Hold': return 'Admin'
    d = (desc + ' ' + model).lower()
    m = mfr.lower()
    def rx(bench): return re.compile('|'.join(DEFAULT_KEYWORDS[bench]))
    if rx('Fretwork').search(d): return 'Fretwork'
    if rx('Luthier').search(d): return 'Luthier'
    # "setup", "stp", or "restring" take priority over Electronics keywords like "pot" —
    # mirrors src/data/jobs.js inferBench so "setup + pot" classifies Setup, not Electronics.
    if re.search(r'\bsetup\b|\bstp\b|\brestring\b', d): return 'Setup'
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

# ── Fetch current jobsMaster document ids from Firestore ───────────────────────
# We need the full current id set up front so we can compute, after parsing
# the CSV below, which jobsMaster docs need to be deleted (jobs that dropped
# out of the accepted-status list). If this fetch fails outright, abort
# loudly rather than proceed with an incomplete picture of what to delete —
# same caution as the old script's "abort to protect calendar bookings",
# just scoped to jobsMaster now (deleting a jobsMaster doc can no longer
# touch scheduling data, but an incomplete delete pass could still leave
# stale/duplicate rows the app has to reconcile).
existing_master_ids = set()
try:
    page_token = None
    while True:
        list_url = f'{BASE_URL}/jobsMaster?key={FIREBASE_API_KEY}&pageSize=300&mask.fieldPaths=job'
        if page_token:
            list_url += f'&pageToken={page_token}'
        req = urllib.request.Request(list_url, method='GET')
        with urllib.request.urlopen(req, timeout=15) as resp:
            page = json.loads(resp.read())
        for d in page.get('documents', []):
            name = d.get('name', '')
            doc_id = name.rsplit('/', 1)[-1]
            if doc_id:
                existing_master_ids.add(doc_id)
        page_token = page.get('nextPageToken')
        if not page_token:
            break
    print(f"Fetched {len(existing_master_ids)} existing jobsMaster doc id(s) from Firestore")
except urllib.error.HTTPError as e:
    if e.code == 404:
        print("No existing jobsMaster documents — will create fresh")
    else:
        print(f"ERROR: Could not fetch existing jobsMaster ids ({e.code}) — aborting to protect jobsMaster from an incomplete delete pass")
        import sys; sys.exit(1)
except Exception as e:
    print(f"ERROR: Could not fetch existing jobsMaster ids ({e}) — aborting to protect jobsMaster from an incomplete delete pass")
    import sys; sys.exit(1)

# ── Parse CSV → job objects ────────────────────────────────────────────────────
with open(CSV_FILE, newline='', encoding='utf-8') as f:
    raw = [l for l in f if not l.lstrip().startswith('#')]
rows = list(csv.DictReader(raw))

ACCEPTED = {'On Hold', 'Waiting', 'To Be Inv', 'In Transit'}
jobs = []
skipped = []
# Job ids skipped ONLY for missing Hours/Days — these are still real, open
# jobs (e.g. not yet quoted/measured), just not schedulable yet. Their
# jobsMaster doc must be left alone: not upserted (no new data to write),
# and — critically — never fed into the delete computation below. A job
# with no Hours/Days has no jobsState doc yet either, so if its jobsMaster
# doc were deleted it would vanish from the app with zero trace, not even
# surface as an orphan. This is tracked separately from the accepted-status
# filter's "continue" above it, which legitimately means "gone, delete it."
skipped_incomplete_ids = set()
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
    # Skip jobs missing Hours or Days — not ready to schedule, but NOT gone.
    # Track the id so the delete pass below can explicitly spare it.
    if not hours or not days:
        skipped.append(f"#{obj['Job']} {obj.get('Mfr','')} {obj.get('Model','')} (missing: {'Hours' if not hours else ''} {'Days' if not days else ''})")
        skipped_incomplete_ids.add(str(obj['Job']))
        continue
    effective_hours = hours if not (hours == 0 and schedulable) else 1.0
    bench = infer_bench(obj.get('Desc',''), status, obj.get('Action',''), obj.get('Model',''), obj.get('Mfr',''))
    job_id = str(obj['Job'])
    # CSV/Sheet-owned fields only — matches src/data/joinJobs.js's
    # pickMasterFields() (NON_MASTER_FIELDS minus this script's own 'id' key,
    # which becomes the Firestore document id, not a field inside the doc).
    # No live-state field (scheduled/calendarSlot/gcalEventId/gcalEventIds/
    # pomoLog/done) is ever read, written, or preserved here — this script
    # has no code path capable of touching that data anymore.
    jobs.append({
        'id':           job_id,
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
    })

print(f"Parsed {len(jobs)} jobs from CSV")
if skipped:
    print(f"Skipped {len(skipped)} incomplete jobs (missing Hours or Days):")
    for s in skipped:
        print(f"  {s}")

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

# ── Upsert one jobsMaster/{jobId} doc per accepted CSV row ─────────────────────
# jobsMaster is a one-writer collection (this script). Each write is a full-
# document overwrite (no updateMask) since jobsMaster docs carry no other
# fields this script needs to preserve — unlike the old ggnz/schedule doc,
# there's no live-state data living alongside these fields to protect.
upserted = 0
upsert_errors = []
for j in jobs:
    doc_id = j['id']
    fields = {k: to_fs(v) for k, v in j.items() if k != 'id'}
    body = json.dumps({'fields': fields}).encode()
    try:
        req = urllib.request.Request(
            master_url(doc_id), data=body, method='PATCH',
            headers={'Content-Type': 'application/json'}
        )
        with urllib.request.urlopen(req, timeout=15) as resp:
            resp.read()
        upserted += 1
    except Exception as e:
        upsert_errors.append(f"#{doc_id}: {e}")

print(f"Upserted {upserted}/{len(jobs)} jobsMaster doc(s)")
if upsert_errors:
    print(f"ERRORS upserting {len(upsert_errors)} jobsMaster doc(s):")
    for e in upsert_errors:
        print(f"  {e}")

# ── Delete jobsMaster docs for jobs that dropped out of the accepted set ───────
# Previously this was an implicit side effect of rebuilding the whole `jobs`
# array; now jobsMaster is per-document, so it needs to be explicit. This is
# safe under the new architecture (unlike the old whole-array-rebuild bug):
# deleting a jobsMaster doc can no longer delete or orphan anything in
# jobsState — at worst it surfaces as an orphan in the app's revenue-review
# banner if real scheduling data still exists for that id, which is the
# intended safety net, not a bug.
#
# EXCEPT: jobs skipped only for missing Hours/Days are real, open jobs with
# no jobsState doc to surface as an orphan — never delete those (see
# skipped_incomplete_ids above). They're spared here, not upserted either,
# so their existing jobsMaster doc is simply left untouched until real
# Hours/Days data shows up.
current_job_ids = {j['id'] for j in jobs}
candidate_delete = (existing_master_ids - current_job_ids) - skipped_incomplete_ids
spared_incomplete = sorted((existing_master_ids - current_job_ids) & skipped_incomplete_ids)
if spared_incomplete:
    print(f"\nSparing {len(spared_incomplete)} jobsMaster doc(s) missing Hours/Days (not deleted, not upserted):")
    for doc_id in spared_incomplete:
        print(f"  #{doc_id}")

to_delete = sorted(candidate_delete)
deleted = 0
delete_errors = []

# ── Sanity floor: refuse to run the delete pass on a suspiciously empty or
# suspiciously large-fraction result. A hiccup that leaves `jobs` empty (or
# near-empty) without raising — a race with the first heredoc's CSV write,
# a transiently truncated read, etc — must not be read as "every job is
# gone." Real CSV syncs never legitimately remove a large chunk of active
# jobs in one pass, so that shape indicates a bad read, not real state.
# The upsert pass above already ran (new/changed data is still real and
# safe to write); only the delete pass is gated here.
DELETE_FRACTION_LIMIT = 0.3  # refuse to delete more than 30% of existing docs in one run
delete_guard_tripped = None
if len(jobs) == 0:
    delete_guard_tripped = "CSV parse produced 0 accepted jobs — likely a transient/truncated read, not a real empty backlog"
elif existing_master_ids and (len(to_delete) / len(existing_master_ids)) > DELETE_FRACTION_LIMIT:
    delete_guard_tripped = (
        f"delete pass would remove {len(to_delete)}/{len(existing_master_ids)} "
        f"({len(to_delete) / len(existing_master_ids):.0%}) of existing jobsMaster docs in one run "
        f"— exceeds the {DELETE_FRACTION_LIMIT:.0%} sanity floor"
    )

if delete_guard_tripped:
    print(f"\nABORTING delete pass — {delete_guard_tripped}.")
    print("Upserts above still ran normally. Re-run once the CSV read is confirmed good;")
    print("no jobsMaster docs were deleted this run.")
elif to_delete:
    print(f"\nRemoving {len(to_delete)} jobsMaster doc(s) no longer in the accepted-status set:")
    for doc_id in to_delete:
        print(f"  #{doc_id}")
        try:
            req = urllib.request.Request(master_url(doc_id), method='DELETE')
            with urllib.request.urlopen(req, timeout=15) as resp:
                resp.read()
            deleted += 1
        except Exception as e:
            delete_errors.append(f"#{doc_id}: {e}")
    if delete_errors:
        print(f"ERRORS deleting {len(delete_errors)} jobsMaster doc(s):")
        for e in delete_errors:
            print(f"  {e}")
else:
    print("No jobsMaster docs to remove — nothing dropped out of the accepted set.")

print()
print(f"jobsMaster upserted: {upserted}")
print(f"jobsMaster deleted:  {deleted}")
if upsert_errors or delete_errors:
    print("─────────────────────────────────────────────")
    print("Done with ERRORS — see above. Re-run to retry failed writes.")
    print("─────────────────────────────────────────────")
else:
    print("─────────────────────────────────────────────")
    print("Done! All Macs will update within seconds.")
    print("─────────────────────────────────────────────")

FBEOF

log "sheet_to_csv finished"
