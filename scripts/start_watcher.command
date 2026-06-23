#!/bin/zsh
export PATH=/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin

# ── GGNZ Scheduler — PDF DropBox Watcher ──────────────────────────────────────
# Watches the DropBox folder for new PDFs from Multitrack.
# When a PDF lands, automatically runs patch_customer_names.command,
# then sheet_to_csv.command (which pushes to Firebase).
#
# Run on Micky (iMac). Keep this Terminal window open while working.
# ──────────────────────────────────────────────────────────────────────────────

DROPBOX="/Users/admin/Library/Mobile Documents/com~apple~CloudDocs/Desktop/SCHEDULER_old/DropBox"
SCRIPTS="/Users/admin/Library/Mobile Documents/com~apple~CloudDocs/Desktop/SCHEDULER_old"
LOG="$SCRIPTS/pipeline.log"

log() {
  local msg="[$(/bin/date '+%Y-%m-%d %H:%M:%S')] $1"
  echo "$msg"
  echo "$msg" >> "$LOG"
}

log "──────────────────────────────────────────────"
log "Watcher started — watching DropBox for PDFs..."
log "DropBox: $DROPBOX"
log "──────────────────────────────────────────────"
echo ""
echo "  Drop a Multitrack PDF into:"
echo "  ~/Desktop/SCHEDULER_old/DropBox/"
echo ""
echo "  The pipeline will run automatically."
echo "  Press Ctrl+C to stop the watcher."
echo ""

# ── Process a PDF through the full pipeline ───────────────────────────────────
process_pdf() {
  local pdf="$1"
  local filename=$(/usr/bin/basename "$pdf")

  log "PDF detected: $filename"

  # Guard: bail immediately if file was already moved by a prior event
  if [[ ! -f "$pdf" ]]; then
    log "Skipping — file no longer exists (duplicate event): $filename"
    return 0
  fi

  # ── Step 1: Wait for iCloud to finish downloading ─────────────────────────
  # iCloud creates a stub immediately; the real file arrives seconds later.
  # We trigger brktag via brdownload first, then poll up to 3 minutes.
  log "Checking file is fully downloaded..."
  /usr/bin/brctl download "$pdf" 2>/dev/null || true
  local attempts=0
  while [[ $attempts -lt 36 ]]; do
    local size=$(/usr/bin/stat -f%z "$pdf" 2>/dev/null || echo 0)
    if [[ $size -ge 20000 ]]; then
      log "File ready: ${size} bytes"
      break
    fi
    log "  File is ${size} bytes — waiting for iCloud download... (attempt $((attempts+1))/36)"
    /bin/sleep 5
    ((attempts++))
  done

  if [[ $attempts -ge 36 ]]; then
    log "ERROR: PDF never reached 20KB after 3 minutes — aborting. Check iCloud sync."
    return 1
  fi

  # ── Step 2: Run patch_customer_names (PDF → jobs.csv) ─────────────────────
  log "Running PDF parser..."
  /usr/bin/python3 << PYEOF >> "$LOG" 2>&1
import sys; sys.stderr = sys.stdout
import re, csv, pathlib, pdfplumber, time

jobs_pdf_path = pathlib.Path("$pdf")
out_csv       = pathlib.Path("$SCRIPTS/jobs.csv")
FIELDS        = ['Job','Customer','Mfr','Model','Status','FirstSeen','Days','Tag','Hours','Action','Desc','VB','BL','PJ']

existing    = {}
comment_lines = []
if out_csv.exists():
    with open(out_csv, newline='', encoding='utf-8') as f:
        raw_lines = f.readlines()
    comment_lines = [l for l in raw_lines if l.lstrip().startswith('#')]
    filtered = ''.join(l for l in raw_lines if not l.lstrip().startswith('#'))
    for row in csv.DictReader(filtered.splitlines()):
        existing[str(row['Job']).strip()] = dict(row)
    print(f"Loaded {len(existing)} existing jobs from CSV")

pdf_jobs    = {}
fault_map   = {}
current_job = None
col_job     = None

with pdfplumber.open(jobs_pdf_path) as pdf:
    for page in pdf.pages:
        for table in (page.extract_tables() or []):
            for row in table:
                if not row: continue
                cell0 = str(row[0] or '').strip()
                cell0_lo = cell0.lower()
                if cell0_lo.startswith('fault:') or cell0_lo.startswith('fault :'):
                    if current_job:
                        raw  = cell0[cell0.index(':')+1:].strip()
                        vb   = bool(re.match(r'^VB:', raw, re.IGNORECASE))
                        desc = re.sub(r'^VB:\s*', '', raw, flags=re.IGNORECASE)
                        desc = re.sub(r'\s*Q?:?\s*\$[\d.,]+(?:\s*inc(?:\s*GST)?)?\s*$', '', desc, flags=re.IGNORECASE).strip()
                        fault_map[current_job] = (desc, vb)
                    continue
                headers_lo = [str(c or '').strip().lower() for c in row]
                if 'job' in headers_lo and 'customer' in headers_lo:
                    col_job = headers_lo.index('job')
                    continue
                if cell0_lo in {'', 'customer', 'manufacturer', 'model', 'status', 'job',
                                'top of page', 'back to menu', 'medium job search',
                                'create a job', 'list jobs', 'my jobs', 'search jobs', 'home'}:
                    continue
                if cell0_lo.startswith('tip:') or cell0_lo.startswith('customer like'): continue
                if 'jobs found' in cell0_lo or 'mtrack' in cell0_lo: continue
                if col_job is None:
                    col_job = 4 if len(row) >= 5 else len(row) - 1
                if len(row) <= col_job: continue
                job_cell = str(row[col_job] or '').strip()
                # If expected col_job isn't a digit, try the last cell — some pages have
                # an extra blank column inserted (e.g. 6-col rows where job is at index 5)
                if (not re.match(r'^\d+$', job_cell) or int(job_cell) == 0) and len(row) > col_job + 1:
                    last_cell = str(row[-1] or '').strip()
                    if re.match(r'^\d+$', last_cell) and int(last_cell) > 0:
                        job_cell = last_cell
                if not re.match(r'^\d+$', job_cell) or int(job_cell) == 0: continue
                customer = cell0.replace('\n', ' ').strip()
                mfr      = str(row[1] or '').replace('\n', ' ').strip() if len(row) > 1 else ''
                # Model is between Mfr and Status; skip any blank middle columns
                non_empty_model = ''
                for ci in range(2, len(row) - 2):
                    v = str(row[ci] or '').replace('\n', ' ').strip()
                    if v:
                        non_empty_model = v
                model    = non_empty_model if non_empty_model else (str(row[2] or '').replace('\n', ' ').strip() if len(row) > 2 else '')
                status   = str(row[-2] or '').strip()                   if len(row) > 2 else ''
                current_job = job_cell
                pdf_jobs[job_cell] = {'Customer': customer, 'Mfr': mfr, 'Model': model, 'Status': status}

print(f"PDF: extracted {len(pdf_jobs)} jobs, {len(fault_map)} fault descriptions")
if not pdf_jobs:
    print("ERROR: no jobs found in PDF — aborting.")
    exit(1)

patched = added = removed = 0
output  = []
missing = [j for j in existing if j not in pdf_jobs]
if missing:
    print(f"Completed/removed ({len(missing)}) — dropping from CSV")
    removed = len(missing)

for job_num, pdf_data in pdf_jobs.items():
    if job_num in existing:
        row = dict(existing[job_num])
        changes = []
        for field, new_val in [('Customer', pdf_data['Customer']), ('Status', pdf_data['Status']),
                               ('Mfr', pdf_data['Mfr']), ('Model', pdf_data['Model'])]:
            old_val = row.get(field, '')
            if old_val != new_val:
                changes.append(f"{field.lower()}: '{old_val}' → '{new_val}'")
            row[field] = new_val
        if job_num in fault_map:
            new_desc, new_vb = fault_map[job_num]
            old_desc = row.get('Desc', '')
            if old_desc != new_desc and new_desc:
                changes.append(f"desc: '{old_desc}' → '{new_desc}'")
                row['Desc'] = new_desc
            if new_vb: row['VB'] = 'Y'
        if changes:
            print(f"  Updated #{job_num}: {', '.join(changes)}")
            patched += 1
        output.append(row)
    else:
        added += 1
        desc_raw, is_vb = fault_map.get(job_num, ('', False))
        output.append({
            'Job': job_num, 'Customer': pdf_data['Customer'],
            'Mfr': pdf_data['Mfr'], 'Model': pdf_data['Model'],
            'Status': pdf_data['Status'], 'FirstSeen': '', 'Days': '',
            'Tag': '', 'Hours': '', 'Action': '',
            'Desc': desc_raw, 'VB': 'Y' if is_vb else '', 'BL': '', 'PJ': '',
        })

output.sort(key=lambda r: int(r.get('Days') or 0), reverse=True)

with open(out_csv, 'w', newline='', encoding='utf-8') as f:
    for line in comment_lines:
        f.write(line if line.endswith('\n') else line + '\n')
    w = csv.DictWriter(f, fieldnames=FIELDS, extrasaction='ignore')
    w.writeheader()
    w.writerows(output)

print(f"CSV updated — {added} new, {patched} patched, {removed} removed, {len(output)} total")
PYEOF

  if [[ $? -ne 0 ]]; then
    log "ERROR: PDF parser failed — check log above"
    return 1
  fi

  # ── Step 3: Run sheet_to_csv (merge Sheet + push to Firebase) ─────────────
  log "Syncing Google Sheet and pushing to Firebase..."
  /bin/zsh "$SCRIPTS/sheet_to_csv.command" >> "$LOG" 2>&1

  if [[ $? -ne 0 ]]; then
    log "WARNING: sheet_to_csv had errors — check log"
  else
    log "Pipeline complete ✓ — all Macs updated"
  fi

  # ── Step 4: Move processed PDF to an archive subfolder ────────────────────
  local archive="$DROPBOX/processed"
  /bin/mkdir -p "$archive"
  /bin/mv "$pdf" "$archive/${filename%.pdf}_$(/bin/date '+%Y%m%d_%H%M%S').pdf"
  log "PDF archived to DropBox/processed/"
  log "──────────────────────────────────────────────"
}

# ── Google Sheet poller ───────────────────────────────────────────────────────
# Runs in background — checks every 2 minutes if the Sheet has been edited.
# If yes, runs sheet_to_csv.command to merge + push to Firebase.
sheet_poller() {
  local last_modified=""
  local token_file="$HOME/Library/Mobile Documents/com~apple~CloudDocs/Guitar Garage NZ/Admin/CRM/token.json"
  local config_file="$SCRIPTS/sheets_config.json"

  log "Sheet poller started — checking every 2 minutes for edits"

  while true; do
    /bin/sleep 120

    # Get Sheet last-modified time via Google Drive API
    current_modified=$(python3 << 'PYEOF' 2>/dev/null
import json, pathlib, os, warnings
warnings.filterwarnings('ignore')
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build

token_file  = pathlib.Path(os.path.expanduser('~/Library/Mobile Documents/com~apple~CloudDocs/Guitar Garage NZ/Admin/CRM/token.json'))
config_file = pathlib.Path(os.path.expanduser('~/Library/Mobile Documents/com~apple~CloudDocs/Desktop/SCHEDULER_old/sheets_config.json'))

try:
    creds   = Credentials.from_authorized_user_file(str(token_file))
    config  = json.load(open(config_file))
    service = build('drive', 'v3', credentials=creds, cache_discovery=False)
    f = service.files().get(fileId=config['sheet_id'], fields='modifiedTime').execute()
    print(f['modifiedTime'])
except Exception as e:
    print(f"ERROR: {e}", end='')
PYEOF
)

    # Skip if we couldn't fetch or got an error
    if [[ -z "$current_modified" || "$current_modified" == ERROR* ]]; then
      continue
    fi

    # First run — just record the current state, don't trigger
    if [[ -z "$last_modified" ]]; then
      last_modified="$current_modified"
      log "Sheet poller: baseline set ($last_modified)"
      continue
    fi

    # Sheet has changed — run the pipeline
    if [[ "$current_modified" != "$last_modified" ]]; then
      log "Sheet change detected — running merge + Firebase push..."
      last_modified="$current_modified"
      /bin/zsh "$SCRIPTS/sheet_to_csv.command" >> "$LOG" 2>&1
      log "Sheet sync complete ✓"
    fi
  done
}

# Start sheet poller in background
sheet_poller &
POLLER_PID=$!

# Ensure poller is killed when watcher exits
trap "/bin/kill $POLLER_PID 2>/dev/null; log 'Watcher stopped.'" EXIT INT TERM

# ── PDF watch loop ────────────────────────────────────────────────────────────
declare -A _processing
# Process substitution (not pipe) keeps the while loop in the current shell,
# so functions, PATH, and _processing array are all available.
while IFS= read -r -d '' path; do
  # Only process PDF files in root of DropBox — ignore processed/ subfolder
  if [[ "$path" != *"/processed/"* && ("$path" == *.pdf || "$path" == *.PDF) ]]; then
    if [[ -z "${_processing[$path]}" ]]; then
      _processing[$path]=1
      process_pdf "$path"
      unset "_processing[$path]"
    fi
  fi
done < <(/usr/local/bin/fswatch -0 --event Created --event Renamed --event Updated --exclude '/processed/' "$DROPBOX")
