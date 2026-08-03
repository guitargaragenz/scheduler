// ============================================================================
// PHASE BOUNDARY (Brief D — .claude/pending-brief.md)
//
// This Workflow tool call covers ONLY:
//   1. Gather  — pull live Supabase data via scripts/board_meeting_export.mjs
//   2. Reports — Ops / Finance / Admin seats (auto-reportable only)
// ...and then STOPS, returning one structured object (see the `return` at
// the bottom) for the live chat session to read.
//
// Everything else in the 10-step Sunday ritual — not-completed reasons,
// coming-up deadlines, Admin's LIVE additions (parts Trevor mentions verbally
// this week, beyond what's already in the parts_to_order table), challenges,
// lessons, a real backlog triage conversation, the parking-lot review, and the
// three end-of-meeting writes (schedule -> scheduledSlots/calendarSlot, picked
// jobs -> focus_list via saveFocusList, new parts -> parts_to_order) — happens
// as LIVE CHAT TURNS outside of any Workflow call, using the data/reports this
// workflow returns. None of that belongs in this file. In particular:
//   - There is no Schedule/Plan-Advisor phase here anymore. Drafting the
//     week schedule is a live conversation with Trevor, not something to
//     pre-bake before he's seen the reports.
//   - There is no Triage seat here anymore. Steps 8-9 are a live conversation
//     over the parking-lot items this workflow returns.
//
// PARKING LOT — there is now exactly ONE (changed 2026-08-01, brief "One
// Parking Lot, fed from the Daily Log"). It is the Supabase `parking_lot`
// table, which backs the in-app Parking Lot page. That page is Trevor's own
// input channel into this meeting: the queries, ideas and bugs he logs during
// the week for the next Sunday.
//
// Read it from this workflow's own data — scripts/board_meeting_export.mjs
// returns it as `parkingLotItems` (open items only, newest first). Do NOT go
// looking for admin/context/parking-lot.md: that file has been deleted, and its
// items were migrated into the table by scripts/migrate_parking_lot_markdown.mjs.
//
// The history, because it cost real items: this comment block used to call the
// table "an unrelated product-idea feature this workflow never touches", and
// pointed the meeting at the markdown file instead. So the meeting never read
// Trevor's list — 8 items sat there unread from June 2026, one of them titled
// "Sunday board meeting with Claude + agents". If a future edit ever splits the
// parking lot in two again, that is the failure mode it recreates.
//
// Job age ("days stuck"): scripts/board_meeting_export.mjs does not return
// a `days` field — there is no clean Supabase equivalent for CSV intake
// date (see that script's header comment). Stuck-30/60-day reporting is
// therefore removed from this workflow entirely rather than guessed at.
// ============================================================================

export const meta = {
  name: 'sunday-board-meeting',
  description: 'Weekly GGNZ board meeting: auto-gathered backlog/finance/admin data and reports, handed off to a live chat session for the rest of the ritual',
  whenToUse: 'Run on Sundays (or on demand) as the FIRST step of the board meeting, before the live conversation. Requires args: { todayISO, weekStartISO } (weekStartISO = Monday of the week being planned). Returns reports + raw data; does not draft a schedule and does not write anything.',
  phases: [
    { title: 'Gather', detail: 'pull live Supabase data via scripts/board_meeting_export.mjs' },
    { title: 'Reports', detail: 'Ops / Finance / Admin seats (auto-reportable only) — everything else is a live chat turn, not part of this workflow' },
  ],
}

phase('Gather')
// `args` sometimes arrives as a JSON string rather than an object, which used to
// leave both dates undefined and crash the run on "Invalid Date" before a single
// agent had spawned. Accept either shape.
const parsedArgs = typeof args === 'string' ? JSON.parse(args) : (args || {})
const todayISO = parsedArgs.todayISO
const weekStartISO = parsedArgs.weekStartISO
if (!weekStartISO) throw new Error('sunday-board-meeting needs args { todayISO, weekStartISO }')
// The week we REPORT on is the one just worked, not the one being planned.
// `weekStartISO` is the Monday of the week ahead, so completed_jobs rows —
// which are stamped with the week the work happened in — never matched it and
// finance reported $0 every single week regardless of the real takings.
// Fixed 2026-07-31 after Trevor caught a "zero jobs finished" report on a week
// he'd actually invoiced 9 jobs.
const reportedWeekStart = new Date(weekStartISO + 'T00:00:00Z')
reportedWeekStart.setUTCDate(reportedWeekStart.getUTCDate() - 7)
const weekKey = reportedWeekStart.toISOString().slice(0, 10)

// Preferred path: the caller runs `node scripts/board_meeting_export.mjs` itself
// and passes the parsed object in as args.exportData. The old path — a subagent
// echoing the script's stdout back as text — kept failing outright, because the
// export is ~44KB and the agent refuses to reproduce a payload that size. There
// is no way to make that hop reliable, so don't reinstate it as the default.
let data = parsedArgs.exportData
if (!data) {
  const rawExport = await agent(
    'Run `node scripts/board_meeting_export.mjs` from the repo root and return ONLY the raw stdout JSON it prints, verbatim, with no commentary, no markdown fences.',
    { label: 'supabase-export', phase: 'Gather', model: 'sonnet' }
  )
  try {
    data = JSON.parse(rawExport)
  } catch (e) {
    throw new Error('board_meeting_export.mjs did not return valid JSON: ' + String(rawExport).slice(0, 500))
  }
}

// data.jobs is already top-level-only and parent_id-filtered by the export
// script itself — no `days` field is present (see header note above).
const jobs = data.jobs || []
const backlog = jobs.filter(j => j.backlog)
const schedulableNow = backlog.filter(j => j.schedulable || j.readyToStart)
// WP is Trevor's own "waiting parts" marker on the Action column (added
// 2026-07-31). It replaces the old 'PARTS' string, which never existed in
// ACTION_OPTIONS and so matched nothing — this count silently read 0 every
// week no matter how many jobs were actually parts-blocked.
// Searches ALL jobs, not just backlog: a job waiting on parts is very often
// off the backlog already, so filtering over `backlog` hid them. On
// 2026-08-03 that reported "nothing is parts-blocked" while 1705 and 1679
// were both sitting on WP.
const partsJobs = jobs.filter(j => j.action === 'WP' || j.inTransit)
const customerWaitingJobs = backlog.filter(j => j.awaiting || j.action === 'CI')
const quickWinCandidates = schedulableNow
  .filter(j => Number(j.hours) > 0 && Number(j.hours) <= 2)
  .sort((a, b) => Number(a.hours) - Number(b.hours))
const completedThisWeek = (data.completedJobs || []).filter(r => r.weekKey === weekKey)
// invoice_amount is stored EX GST — that is how Trevor quotes and records every
// revenue figure. This used to be treated as GST-inclusive and divided by 1.15,
// which understated the week's takings by 13% in every report ever run.
// Corrected 2026-07-31 on Trevor's instruction: "all figures I provide with
// revenue will be the same [ex GST]".
const invoicedExGst = completedThisWeek.reduce((s, r) => s + (Number(r.invoiceAmount) || 0), 0)
const invoicedIncGst = invoicedExGst * 1.15
const partsToOrder = data.partsToOrder || [] // already resolved=false only, per the export script

// What was actually built since the last meeting. Without this the meeting is
// data-only: it can see the workload but not the progress, so it re-proposes
// work that already shipped and Trevor risks approving fixes for things that
// are already fixed. Added 2026-08-04 after exactly that near-miss.
//
// The export returns [] if git isn't available, so an old export or a
// git-less environment degrades to the previous behaviour rather than failing.
const shipped = data.shippedSinceLastMeeting || []
const shippedBlock = shipped.length === 0
  ? 'No record of shipped work is available for this period — do not assume nothing shipped, and do not propose builds as if the app were unchanged.'
  : `ALREADY SHIPPED since the last meeting (${shipped.length} commits, newest first) — treat every one of these as DONE. Do not propose, re-propose, or flag any of it as work to do:
${shipped.slice(0,60).map(c => `- ${c.date} ${c.subject}`).join('\n')}`

log(`Loaded ${jobs.length} jobs (${backlog.length} backlog, ${schedulableNow.length} schedulable now), ${completedThisWeek.length} completed this week, ${partsToOrder.length} open parts_to_order item(s), ${shipped.length} commit(s) shipped since the last meeting`)

phase('Reports')
// Every agent() in this file pins model: 'sonnet'. Subagents otherwise inherit
// the session's model, so running the meeting from an Opus session spawned four
// Opus agents to turn a handful of counts into three lines each — the exact leak
// CLAUDE.md's "Model Discipline" section exists to stop. These are summarise-some-
// numbers jobs; Sonnet does them fine, and the meeting now costs the same whatever
// model Trevor happens to be on. The live half of the meeting is conversation, so
// it needs no premium model either.
const [opsReport, financeReport, adminReport] = await parallel([
  () => agent(
    `You are the Ops/Scheduler seat at GGNZ's weekly board meeting. Give a 2-3 line report, no preamble, plain text.
Data: ${backlog.length} backlog jobs total. ${schedulableNow.length} schedulable right now. ${partsJobs.length} parts-blocked/in-transit. ${customerWaitingJobs.length} awaiting customer.
${shippedBlock}

Report backlog health using these counts. Do not rank jobs by age — job-age tracking is not available (no intake-date data), so do not mention "days stuck" or similar. Do not propose a schedule — that's a live conversation with Trevor, not this report's job.`,
    { label: 'ops-report', phase: 'Reports', model: 'sonnet' }
  ),
  () => agent(
    `You are the Finance seat at GGNZ's weekly board meeting. Give a 2-3 line report, no preamble, plain text.
Data: ${completedThisWeek.length} jobs completed in the week just worked (week starting ${weekKey}; the week being planned is ${weekStartISO}). Invoiced total EX GST: $${invoicedExGst.toFixed(2)}. Incl GST (x1.15): $${invoicedIncGst.toFixed(2)}.
Lead with the ex-GST figure — that is the number Trevor works in.
Report the numbers plainly. Trevor mentioned he is currently low on cash — note that context if the numbers are thin, but don't editorialize beyond one line.`,
    { label: 'finance-report', phase: 'Reports', model: 'sonnet' }
  ),
  () => agent(
    `You are the Admin seat at GGNZ's weekly board meeting — a seat covering parts, maintenance, and customer-comms admin work that competes for Trevor's time without ever competing for his bench-time schedule. Give a short report (4-6 lines max), plain text, no preamble.
Parts-blocked or in-transit jobs (${partsJobs.length}): ${JSON.stringify(partsJobs.slice(0,10).map(j=>({job:j.job, customer:j.customer, status:j.status})))}
Customer waiting on input/update (${customerWaitingJobs.length}): ${JSON.stringify(customerWaitingJobs.slice(0,10).map(j=>({job:j.job, customer:j.customer, action:j.action})))}
Open parts-to-order items already tracked (${partsToOrder.length}): ${JSON.stringify(partsToOrder.slice(0,15).map(p=>({description:p.description, category:p.category, neededForJob:p.neededForJob})))}
Ad-hoc/maintenance tasks tracked in the app: ${JSON.stringify(data.adHocTasks)}
${shippedBlock}

List: (1) parts to chase this week, by job number, (2) customers who need a call/update, by job number, (3) anything in the open parts-to-order list that looks stale or worth flagging.
This is a SCAN-SIDE report only — a snapshot of what's already tracked. Do not ask Trevor questions or invite him to add items here; live additions happen later in the chat session, not in this report.
Each of these should be phrased as something that could take a real bench-time slot, not just an FYI.`,
    { label: 'admin-report', phase: 'Reports', model: 'sonnet' }
  ),
])

return {
  reports: { opsReport, financeReport, adminReport },
  data: {
    jobs, backlog, schedulableNow, partsJobs, customerWaitingJobs,
    quickWinCandidates, completedThisWeek, partsToOrder,
    adHocTasks: data.adHocTasks || [],
  },
  stats: {
    backlogCount: backlog.length,
    schedulableCount: schedulableNow.length,
    completedThisWeek: completedThisWeek.length,
    invoicedExGst, invoicedIncGst,
    openPartsToOrder: partsToOrder.length,
  },
}
