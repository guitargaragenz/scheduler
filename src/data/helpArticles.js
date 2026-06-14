// GGNZ Scheduler — help articles
// Each article: { id, section, title, keywords[], body (plain text, use \n for paragraphs) }

export const HELP_ARTICLES = [

  // ─── SCHEDULER ────────────────────────────────────────────────────────────

  {
    id: 'upload-csv',
    section: 'Scheduler',
    title: 'Uploading jobs.csv',
    keywords: ['upload', 'csv', 'load', 'import', 'jobs', 'multitrack'],
    body: `Click the "Upload CSV" button at the top of the sidebar. Select your jobs.csv file from the desktop. Jobs load instantly — the sidebar will show a count of how many loaded.

The CSV comes from your weekly Multitrack PDF export. Run the pdf_jobs_to_csv.command script on the desktop after printing the Multitrack PDF each week. It automatically adds new jobs, updates existing ones, and removes completed jobs.

Re-uploading a CSV preserves any Pomodoro session logs already recorded against jobs. Manual fields (Tag, Hours, Action, VB, BL) are preserved for existing jobs and only updated if they were blank.

If the upload returns 0 jobs, the file is rejected as a safety check.`,
  },

  {
    id: 'dragging-jobs',
    section: 'Scheduler',
    title: 'Dragging jobs to the calendar',
    keywords: ['drag', 'drop', 'schedule', 'calendar', 'slot', 'place'],
    body: `Drag any job card from the sidebar onto a time slot in the calendar grid. The job will occupy consecutive 30-minute slots based on its estimated hours (e.g. a 2h job takes 4 slots). A 30-minute buffer slot is automatically placed after the job.

Jobs can only be placed in valid work hours — weekdays 10am–6pm and 9pm–11pm, Saturday 10am–2pm, Sunday 10am–4pm. Lunch (12–1pm weekdays) is locked.

To move a scheduled job, drag it from its current slot to a new one. To unschedule, drag it back to the sidebar, or open the job drawer and it will be removed.

The drag mode toggle at the top of the sidebar switches between Regular (normal placement) and Urgent (red border, placed at the top of the next available slot).`,
  },

  {
    id: 'urgent-mode',
    section: 'Scheduler',
    title: 'Urgent mode',
    keywords: ['urgent', 'priority', 'rush', 'red', 'emergency'],
    body: `Switch to Urgent mode using the "Urgent" toggle at the top of the sidebar. In urgent mode, dragged jobs show a red border and are placed at the very next available slot, pushing ahead of normal scheduling order.

Use urgent mode when a customer is waiting or a job needs to jump the queue. Switch back to Regular mode when done.`,
  },

  {
    id: 'week-navigation',
    section: 'Scheduler',
    title: 'Navigating weeks',
    keywords: ['week', 'navigate', 'arrow', 'previous', 'next', 'date'],
    body: `Use the left (‹) and right (›) arrows in the header to move between weeks. The current date range is shown in the centre.

Scheduled jobs stay on their assigned dates as you navigate — the calendar always shows the full 7-day week for whatever week you're viewing.`,
  },

  {
    id: 'job-drawer',
    section: 'Scheduler',
    title: 'Editing a job (Job Drawer)',
    keywords: ['edit', 'drawer', 'hours', 'bench', 'split', 'subtask', 'notes'],
    body: `Click any job card in the sidebar to open the Job Drawer. From here you can:

• Adjust estimated hours for the job
• Change the bench type (Electronics, Setup, Luthier, Fretwork, Admin)
• Split the job across multiple bench sessions — e.g. 1h Electronics + 2h Setup
• Add notes

Splits create separate draggable cards for each session. All split cards must be scheduled before the focus highlight clears.

Click Save to apply changes. The job card in the sidebar updates immediately.`,
  },

  {
    id: 'work-hours',
    section: 'Scheduler',
    title: 'Work hours and locked slots',
    keywords: ['hours', 'work', 'lunch', 'evening', 'locked', 'weekend', 'saturday', 'sunday'],
    body: `Work hours shown in the calendar:

Weekdays: 10am–6pm, then 9pm–11pm (evening session). The 7–9pm gap is hidden behind the EVENING divider.
Saturday: 10am–2pm
Sunday: 10am–4pm

Lunch (12–1pm, weekdays only) is locked and cannot be scheduled. The lock icon shows in that slot.

Evening slots on weekends are greyed out and unavailable.`,
  },

  {
    id: 'google-calendar-sync',
    section: 'Scheduler',
    title: 'Google Calendar sync',
    keywords: ['google', 'calendar', 'sync', 'gcal', 'connect', 'sign in'],
    body: `Click the green Sync button in the header to push scheduled jobs to Google Calendar. Each job creates or updates a calendar event with the job number, make, model, bench type, and hours.

To connect Google Calendar: open Settings (⚙) and click Sign In. You'll be prompted to authorise access. The sync dot in the header shows connection status — green = synced, grey = idle, red = error.

When you unschedule a job, its Google Calendar event is automatically deleted.

If a #PERSONAL block is detected in your Google Calendar overlapping a scheduled job, the job is automatically moved back to the sidebar and you're notified via a toast.`,
  },

  {
    id: 'firebase-sync',
    section: 'Scheduler',
    title: 'Cross-device sync (Firebase)',
    keywords: ['firebase', 'sync', 'cross-device', 'phone', 'tablet', 'cloud', 'save'],
    body: `The scheduler automatically saves to Firebase Firestore in real time. Any device signed into the same Firebase account will see the same schedule.

Changes are debounced — saved 1.5 seconds after you stop making changes. When another device makes a change, your view updates automatically within a few seconds.

Echo suppression prevents your own saves from triggering an unnecessary reload.`,
  },

  // ─── SIDEBAR ──────────────────────────────────────────────────────────────

  {
    id: 'sidebar-sections',
    section: 'Sidebar',
    title: 'Sidebar sections explained',
    keywords: ['sidebar', 'sections', 'tiers', 'active', 'backlog', 'ready', 'awaiting', 'hold', 'transit'],
    body: `Jobs are sorted into 6 sections automatically based on their CSV status and flags:

ACTIVE JOBS — Status Active or Booked In, not backlog. Full opacity, draggable. Your main working queue.

BACKLOG — Active or Booked In with BL=Y. Slightly dimmed. Scheduled when the active queue clears.

READY TO START — On Hold with BL=Y and Action=GTS (Good To Start). Amber header. Parts have arrived, bench work can begin. Fully draggable.

AWAITING — Waiting status with Action=INC (incubating) or CI (customer input). Indigo header. Locked — not schedulable yet.

IN TRANSIT — Status In Transit. Cyan header. Locked.

ON HOLD — Everything else non-schedulable. Heavily dimmed, locked.

Sections update automatically when you re-upload the CSV.`,
  },

  {
    id: 'job-cards',
    section: 'Sidebar',
    title: 'Reading job cards',
    keywords: ['job card', 'colour', 'bench', 'tag', 'hours', 'action', 'vb', 'bl'],
    body: `Each job card shows:

• Job number (#XXX)
• Manufacturer and model
• Estimated hours (e.g. 1.5–2h)
• Bench type with colour: Electronics (blue), Setup (green), Luthier (orange), Fretwork (purple), Admin (grey)
• Action label — next required step (GTS / INC / CI / RS / RS-C / DG / Parts / Tubes etc.)
• VB badge — Virtual Booking (customer keeps instrument until near bench time)
• BL badge — Backlog

Difficulty tags: EZ (≤1.5h), T (≤3h), M (≤5.5h), H (>5.5h). Inferred from hours if not set in CSV.`,
  },

  {
    id: 'search-jobs',
    section: 'Sidebar',
    title: 'Searching jobs',
    keywords: ['search', 'find', 'filter', 'job', 'make', 'model', 'bench'],
    body: `Type in the search box at the top of the sidebar to filter jobs by job number, manufacturer, model, or bench type. The list filters live as you type.

Clear the search box to show all jobs again.`,
  },

  // ─── POMODORO ─────────────────────────────────────────────────────────────

  {
    id: 'pomodoro-timer',
    section: 'Pomodoro',
    title: 'Using the Pomodoro timer',
    keywords: ['pomodoro', 'timer', 'pomo', 'session', 'bench', 'time', 'track', 'log'],
    body: `Tap any scheduled job in the calendar grid to open the Pomodoro timer panel (bottom-right corner).

The timer defaults to 25-minute sessions. Use the +/- buttons to adjust. Press Start to begin.

Phases:
• Work — counts down the session
• Break — 5-minute break after each pomo
• Done — session complete, ready to log

After a session, add an optional note (e.g. "replaced output transformer") and click Log Session. The session is saved to Firebase against that specific job.

Pomo dots show how many sessions you've completed for the job. Past sessions are listed below the timer with timestamps and notes.

The timer is separate from the sidebar job drawer — tapping a calendar job opens the timer, tapping a sidebar job opens the edit drawer.`,
  },

  {
    id: 'weekly-summary',
    section: 'Pomodoro',
    title: 'Weekly summary',
    keywords: ['summary', 'weekly', 'planned', 'actual', 'hours', 'bench', 'report'],
    body: `Click the Summary button in the header to open the Weekly Summary modal.

This shows a breakdown by bench type (Electronics, Setup, Luthier, Fretwork, Admin) for the current week view:

• Planned hours — from scheduled job estimates
• Actual time — total minutes logged via Pomodoro sessions
• Pomo count — number of completed sessions

Use this to see how actual bench time compares to your planned schedule at the end of each week.`,
  },

  // ─── PARTS INVENTORY ──────────────────────────────────────────────────────

  {
    id: 'parts-open',
    section: 'Parts Inventory',
    title: 'Opening the parts inventory',
    keywords: ['parts', 'inventory', 'partsbox', 'open', 'drawer'],
    body: `Click the Parts button in the header. The inventory drawer opens on the right, loading all 848 parts from your live Partsbox account.

The drawer sits alongside the calendar — the calendar shifts left to make room. Click Parts again or the × to close.`,
  },

  {
    id: 'parts-search',
    section: 'Parts Inventory',
    title: 'Searching parts',
    keywords: ['search', 'find', 'filter', 'parts', 'name', 'description', 'location', 'tag'],
    body: `The search box matches across part name, description, MPN (part number), tags, and storage location names.

Multiple terms are AND'd — all terms must match:
  cap 10uF         → parts containing both "cap" AND "10uF"
  resistor 100k    → resistors that are 100k

Exclude with a minus prefix:
  cap 10uF -SMD    → 10uF caps that are NOT SMD

Use quotes for exact phrases (needed for location names with spaces):
  "PTS-BIN 4"      → only parts in that specific bin
  cap -"SMD"       → caps excluding SMD

Search is instant — runs against the locally cached part list with no API call.`,
  },

  {
    id: 'parts-locations',
    section: 'Parts Inventory',
    title: 'Location tags (PB codes)',
    keywords: ['PB', 'location', 'bin', 'drawer', 'tag', 'physical', 'shelf'],
    body: `Amber tags starting with PB indicate physical drawer locations in the parts bins.

Format: PB[bin][row][col]
  PB2E5 = Parts Bin 2, Row E (A at top, E at bottom), Column 5 (left to right)

Click any PB tag on a part to instantly filter to all parts in that drawer location. Hover over a tag to see the human-readable location (e.g. "Parts Bin 2, Row E, Col 5").

Grey tags are category labels (resistor, caps, pot, etc.) — click to filter by category.`,
  },

  {
    id: 'parts-low-stock',
    section: 'Parts Inventory',
    title: 'Low stock filter',
    keywords: ['low stock', 'low', 'filter', 'reorder', 'empty', 'zero', 'alert'],
    body: `Click the Low stock button below the search box to show only parts at or below their low-stock threshold.

Currently 269 of 848 parts are flagged low. Parts with zero stock show a "LOW" badge in amber next to their count.

The threshold per part is set in Partsbox (part/low-stock field). Parts without a set threshold default to ≤2 as a fallback.

Combine with search: switch to Low stock, then type a category (e.g. "caps") to see only low-stock capacitors.`,
  },

  {
    id: 'parts-add-stock',
    section: 'Parts Inventory',
    title: 'Adding stock',
    keywords: ['add', 'stock', 'restock', 'quantity', 'location', 'supplier'],
    body: `Click the green + Add button on any part row. An inline form expands below the part:

• Qty — number to add
• Location — pick from your 44 storage locations
• Note — optional (e.g. "Restocked from Jaycar", "Order #123")

Click Add to stock to confirm. The part list refreshes automatically showing the new quantity.

The form closes when confirmed or when you click Cancel. Clicking + Add on another part while one is open switches to the new one.`,
  },

  {
    id: 'parts-remove-stock',
    section: 'Parts Inventory',
    title: 'Removing / using stock',
    keywords: ['remove', 'use', 'stock', 'consume', 'job', 'quantity', 'take'],
    body: `Click the red − Use button on any part row. The form fetches real per-lot quantities from Partsbox before opening, so you always see exactly what's available at each location.

• Qty — number to remove (capped at available in the selected location)
• Location — shows each storage location with actual available quantity, e.g. "LDB-1 (11 available)"
• Note — optional (e.g. "Job 456 Fender Strat")

The quantity field shows the max allowed for the chosen location and won't accept more than what's there.

Click Remove from stock to confirm.`,
  },

  // ─── JOB TRACKER ──────────────────────────────────────────────────────────

  {
    id: 'job-tracker-open',
    section: 'Job Tracker',
    title: 'Opening the Job Tracker',
    keywords: ['job tracker', 'tracker', 'open', 'html', 'standalone'],
    body: `The Job Tracker is a standalone HTML app separate from the scheduler.

Open it at: localhost:5173/job-tracker

Or open the file directly: Job Tracker Files/guitar-garage-job-tracker-v35.html

It runs entirely in your browser with no server needed when opened as a file.`,
  },

  {
    id: 'job-tracker-csv',
    section: 'Job Tracker',
    title: 'Loading jobs into Job Tracker',
    keywords: ['load', 'csv', 'upload', 'jobs', 'import', 'job tracker'],
    body: `Click Load CSV in the Job Tracker and select your jobs.csv file. Jobs with Tag=SKP are automatically excluded.

The tracker shows all current jobs with status, bench type, hours estimate, action required, and days in shop.`,
  },

  {
    id: 'job-tracker-filter',
    section: 'Job Tracker',
    title: 'Filtering jobs in Job Tracker',
    keywords: ['filter', 'bench', 'status', 'search', 'job tracker', 'sort'],
    body: `Use the filter controls to narrow the job list by:

• Bench type (Electronics, Setup, Luthier, Fretwork, Admin)
• Status (Active, Booked In, Waiting, On Hold, In Transit)
• Action (GTS, INC, CI, Parts, Tubes, etc.)

Click any column header to sort. The tracker is read-only — edits happen in Multitrack, then re-exported via the CSV pipeline.`,
  },

  // ─── CSV PIPELINE ─────────────────────────────────────────────────────────

  {
    id: 'csv-pipeline',
    section: 'CSV Pipeline',
    title: 'How the CSV pipeline works',
    keywords: ['csv', 'pipeline', 'multitrack', 'pdf', 'extract', 'script', 'weekly'],
    body: `The pipeline converts your weekly Multitrack PDF into a jobs.csv that feeds both the scheduler and job tracker.

Steps each week:
1. Print your Multitrack report to PDF as usual
2. Run pdf_jobs_to_csv.command on the desktop (double-click)
3. The script extracts jobs using pdfplumber, compares to the existing CSV, and reports new/updated/removed counts
4. Upload the new jobs.csv to the scheduler via the sidebar button

The script:
• Adds new job numbers not in the current CSV
• Updates Status, Days, and Description for existing jobs
• Removes jobs that no longer appear in the PDF (completed/closed)
• Auto-detects VB flag from "VB:" prefix in the description
• Strips pricing from descriptions ($300inc, Q:$391 inc GST etc.)
• Preserves manual fields: Tag, Hours, Action, VB, BL
• Refuses to overwrite if the PDF returns 0 jobs (safety check)`,
  },

  {
    id: 'csv-columns',
    section: 'CSV Pipeline',
    title: 'CSV column reference',
    keywords: ['csv', 'columns', 'fields', 'tag', 'hours', 'action', 'vb', 'bl', 'skp'],
    body: `CSV columns: Job, Mfr, Model, Status, Days, Tag, Hours, Action, Desc, VB, BL

Job — Multitrack job number
Mfr — Manufacturer
Model — Instrument/equipment model
Status — Active / Booked In / Waiting / On Hold / In Transit
Days — Days in shop (from Multitrack)
Tag — Difficulty: EZ / T / M / H (auto-inferred from Hours if blank)
Hours — Estimated bench hours (numeric)
Action — Next step abbreviation:
  GTS = Good To Start · INC = Incubating · CI = Customer Input
  RS = Research · RS-C = Research w/ Claude · DG = Diagnose
  Finish · Parts · Trial run · Tubes · Tubes/TX · Cleats
  Bridge pins · Bronze frets · Undo glue · Call customer
Desc — Job description (pricing stripped automatically)
VB — Virtual Booking: Y/N (customer keeps instrument until bench time)
BL — Backlog: Y/N
SKP — If Tag=SKP, job is excluded from Job Tracker (not a real column, set Tag to SKP)

Tag auto-thresholds:
EZ = ≤1.5h · T = ≤3h · M = ≤5.5h · H = >5.5h`,
  },

  // ─── SETTINGS ─────────────────────────────────────────────────────────────

  {
    id: 'settings',
    section: 'Settings',
    title: 'Settings panel',
    keywords: ['settings', 'gear', 'google', 'sign in', 'changelog', 'history'],
    body: `Click ⚙ Settings in the header to open the settings panel.

From here you can:
• Connect / disconnect Google Calendar (Sign In / Sign Out)
• View the session changelog — a timestamped log of every scheduling action taken this session (jobs scheduled, moved, synced, unscheduled)

The changelog is session-only and clears on page refresh. It's useful for reviewing what you've done during a planning session.`,
  },

];

export const SECTIONS = [...new Set(HELP_ARTICLES.map(a => a.section))];
