export const meta = {
  name: 'sunday-board-meeting',
  description: 'Weekly GGNZ board meeting: live backlog/finance/admin/parking-lot reports synthesized into a draft, editable week schedule',
  whenToUse: 'Run on Sundays (or on demand) to turn the current job backlog, finances, parts/admin state, and parking-lot into an actionable week schedule. Requires args: { todayISO, weekStartISO } (weekStartISO = Monday of the week being planned).',
  phases: [
    { title: 'Gather', detail: 'pull live Firestore data + admin/context/parking-lot.md' },
    { title: 'Reports', detail: 'Ops / Finance / Admin / Triage seats' },
    { title: 'Schedule', detail: 'Plan Advisor drafts the week schedule with defaults' },
  ],
}

phase('Gather')
const todayISO = args?.todayISO
const weekStartISO = args?.weekStartISO
const weekKey = weekStartISO

const rawExport = await agent(
  'Run `node scripts/board_meeting_export.mjs` from the repo root and return ONLY the raw stdout JSON it prints, verbatim, with no commentary, no markdown fences.',
  { label: 'firestore-export', phase: 'Gather' }
)

let data
try {
  data = JSON.parse(rawExport)
} catch (e) {
  throw new Error('board_meeting_export.mjs did not return valid JSON: ' + String(rawExport).slice(0, 500))
}

const jobs = (data.jobs || []).filter(j => !j.parentId)
const backlog = jobs.filter(j => j.backlog)
const schedulableNow = backlog.filter(j => j.schedulable || j.readyToStart)
const partsJobs = backlog.filter(j => j.action === 'PARTS' || j.inTransit)
const customerWaitingJobs = backlog.filter(j => j.awaiting || j.action === 'CI')
const stuck30 = backlog.filter(j => j.days >= 30 && j.days < 60)
const stuck60 = backlog.filter(j => j.days >= 60)
const quickWinCandidates = schedulableNow
  .filter(j => Number(j.hours) > 0 && Number(j.hours) <= 2)
  .sort((a, b) => Number(a.hours) - Number(b.hours))
const completedThisWeek = (data.completedJobs || []).filter(r => r.weekKey === weekKey)
const invoicedTotal = completedThisWeek.reduce((s, r) => s + (Number(r.invoiceAmount) || 0), 0)

log(`Loaded ${jobs.length} jobs (${backlog.length} backlog), ${completedThisWeek.length} completed this week, ${data.parkingLotItems.length} live parking-lot items`)

phase('Reports')
const [opsReport, financeReport, adminReport, triageReport] = await parallel([
  () => agent(
    `You are the Ops/Scheduler seat at GGNZ's weekly board meeting. Give a 2-3 line report, no preamble, plain text.
Data: ${backlog.length} backlog jobs total. ${stuck30.length} stuck 30-60 days. ${stuck60.length} stuck 60+ days.
Oldest 5 by age: ${JSON.stringify(backlog.sort((a,b)=>b.days-a.days).slice(0,5).map(j=>({job:j.job, customer:j.customer, mfr:j.mfr, model:j.model, days:j.days, status:j.status})))}
Report backlog health and name the worst offenders by job number. Do not propose a schedule — that's the Plan Advisor's job.`,
    { label: 'ops-report', phase: 'Reports' }
  ),
  () => agent(
    `You are the Finance seat at GGNZ's weekly board meeting. Give a 2-3 line report, no preamble, plain text.
Data: ${completedThisWeek.length} jobs completed this week (week starting ${weekStartISO}). Invoiced total (incl GST): $${invoicedTotal.toFixed(2)}. Ex-GST (÷1.15): $${(invoicedTotal/1.15).toFixed(2)}.
Report the numbers plainly. Trevor mentioned he is currently low on cash — note that context if the numbers are thin, but don't editorialize beyond one line.`,
    { label: 'finance-report', phase: 'Reports' }
  ),
  () => agent(
    `You are the Admin seat at GGNZ's weekly board meeting — a new seat added because parts, maintenance, and customer-comms admin work was previously invisible and competing for Trevor's time without ever competing for his bench-time schedule. Give a short report (4-6 lines max), plain text, no preamble.
Parts-blocked or in-transit jobs (${partsJobs.length}): ${JSON.stringify(partsJobs.slice(0,10).map(j=>({job:j.job, customer:j.customer, status:j.status})))}
Customer waiting on input/update (${customerWaitingJobs.length}): ${JSON.stringify(customerWaitingJobs.slice(0,10).map(j=>({job:j.job, customer:j.customer, action:j.action})))}
Ad-hoc/maintenance tasks tracked in the app: ${JSON.stringify(data.adHocTasks)}
List: (1) parts to chase this week, by job number, (2) customers who need a call/update, by job number, (3) note plainly that there is currently no digital tracking for shop/tool maintenance — Trevor should flag anything due verbally, it won't be caught automatically.
Each of these should be phrased as something that could take a real bench-time slot, not just an FYI.`,
    { label: 'admin-report', phase: 'Reports' }
  ),
  () => agent(
    `You are the Triage seat at GGNZ's weekly board meeting, reviewing the admin/context/parking-lot.md file (read it with the Read tool). Give a short report, plain text, no preamble.
Do a kill/keep/promote pass: identify at most 1-2 items worth promoting to real work this week (open [ ] items, not already [x] done), and note anything stale that should be marked resolved or removed. Cap promotions at 2 — this is a hard rule, do not exceed it even if more look tempting.`,
    { label: 'triage-report', phase: 'Reports' }
  ),
])

phase('Schedule')
const schedule = await agent(
  `You are the Plan Advisor, synthesizing GGNZ's weekly board meeting into ONE draft week schedule for Trevor (a guitar/amp repair tech with ADHD who wants to edit a finished draft, not answer open questions).

Reports from the other seats:
--- OPS ---
${opsReport}
--- FINANCE ---
${financeReport}
--- ADMIN ---
${adminReport}
--- TRIAGE ---
${triageReport}
---

Quick-win candidates (schedulable, <=2hrs, sorted smallest-first): ${JSON.stringify(quickWinCandidates.slice(0,15).map(j=>({job:j.job, customer:j.customer, mfr:j.mfr, model:j.model, hours:j.hours, bench:j.bench})))}
Full schedulable backlog (ranked by age, oldest first): ${JSON.stringify(schedulableNow.sort((a,b)=>b.days-a.days).slice(0,20).map(j=>({job:j.job, customer:j.customer, mfr:j.mfr, model:j.model, hours:j.hours, bench:j.bench, days:j.days})))}

CRITICAL RULES:
1. Trevor is currently low on cash. Monday and Tuesday MUST be built almost entirely from the quick-win candidates list (smallest hours, already schedulable) — the goal is fastest possible path to invoicing, not oldest-job-first. Wednesday-Friday can use the full backlog, oldest/priority first.
2. Weave in Admin's parts-to-chase and customer-call items as their own scheduled slots on specific days — they take real bench time too, don't list them separately as an afterthought.
3. Include Triage's promoted item(s) as a slot on one day (treat as a small app-work task).
4. For any job/task where you're making a judgment call Trevor might disagree with (e.g. holding an old job vs prioritizing it), state your DEFAULT choice inline directly in the schedule line, and mark it "(skip = accept default)" — Trevor should be able to skip every single one of these and still get a usable schedule. Do not phrase these as open questions requiring an answer — always give the default first.
5. Output format: a Monday-Friday schedule, each day a short bullet list of job numbers + customer + task + hours. Keep it scannable — this is meant to be read in under a minute, not studied.
6. End with a single line noting which decisions have a "(skip = accept default)" marker so Trevor knows what to scan for.

Do not invent job numbers or data not present above.`,
  { label: 'plan-advisor', phase: 'Schedule' }
)

return { schedule, reports: { opsReport, financeReport, adminReport, triageReport }, stats: {
  backlogCount: backlog.length, stuck30: stuck30.length, stuck60: stuck60.length,
  completedThisWeek: completedThisWeek.length, invoicedTotal, exGst: invoicedTotal / 1.15,
} }
