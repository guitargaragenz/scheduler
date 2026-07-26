# Handoff — Sunday board meeting rebuild + PDF-drop import (replaces CSV)

**Written:** 2026-07-25. Delete this file once both ideas have brief docs (or are
scoped/rejected) in a fresh session.

## Plain English (read this first)

Two separate feature ideas Trevor wants to develop, captured here so a new session
doesn't need this one's history. Neither has been built or briefed yet — this is a
parking spot for the ideas, not an approved plan. Both are multi-file / UI changes,
so both need to go through the full Agent-Team Protocol (Brief → Council → Builder →
Verifier → Live Test → Merge) once scoped.

---

## 1. Rebuild the Sunday board meeting inside the Scheduler app

**Where this came from:** Trevor used to run Focus list picking via a column in the
Google Sheet — that died when the Sheet's role was replaced by Supabase. The
`focus_list` Supabase table and the `useFocusList` hook already exist and are fully
wired for *reading* — Sidebar, Job Shelf, and Daily Log all already highlight
"Focus" jobs. But nothing in the current UI actually *writes* to it anymore. The
only thing that ever wrote to it was `scripts/seed_focus_list.mjs`, a stale one-off
script (still in the repo, not deleted — separate call on whether to bin it).

**What Trevor wants:** rebuild the whole Sunday board meeting ritual as a proper
in-app feature, not a manual interview + script.

**Ideas discussed, not yet chosen between:**

- **Picking mechanism** — either (a) a star/checkbox directly on job cards in the
  existing job list/Sidebar for instant toggle, or (b) a dedicated "Board Meeting"
  screen that walks through jobs one at a time closer to the old interview format,
  with a "done reviewing" action that timestamps the session.
- **What else the meeting screen could surface**, since it's being built anyway:
  - Jobs with no activity in X days (stale-job flag)
  - Anything sitting in the parking lot
  - `pendingRevenueReview` items — jobs that vanished from a CSV/Sheet sync without
    being marked Done/invoiced. This currently sits silently with no UI surfacing
    it at all (see `addPendingRevenueReviewItem`/`loadPendingRevenueReview` in
    `src/utils/supabase.js`).
  - Last week's Focus list vs this week's, so progress is visible at a glance
- **Automation level** — fully manual toggle-as-you-go, or semi-automated (app
  pre-suggests candidates like overdue/stalled jobs, Trevor just confirms/rejects).

**Next step:** talk through the above with Trevor to land on a shape, then write
it up as a proper Brief (scope-locked, posted to `.claude/pending-brief.md`) before
any building starts.

---

## 2. Replace CSV import with a browser-based PDF-drop import

**Where this came from:** Trevor asked to look at the PDF-drop feature from a
different, newer scheduler build he has going — a separate Next.js project at:

```
/Users/admin/Desktop/1. PROJECTS/Business/AI FILES/BUILDS/NEW SCHEDULER BUILD/workshop-scheduler/
```

That's a **different codebase**, not part of this repo — worth keeping in mind if a
future session goes looking for it. It has an `/import` page that lets you drag a
Multitrack "Job Search" PDF straight into the browser, parses it client-side, shows
a preview of what's new vs already-known (matched by Multitrack job ref), and adds
only the new ones on confirm. No CSV file, no watcher script, no manual step at all.

**How today's Scheduler pipeline compares** (see
[SCHEDULER-ARCHITECTURE.md](SCHEDULER-ARCHITECTURE.md) "CSV pipeline" section):
today's flow is Multitrack PDF → dropped into a DropBox folder on Micky →
`start_watcher.command` (a background script, not the app) detects it → runs a
PDF parser outside the app → writes `jobs.csv` → `sheet_to_csv.command` pushes it
into the database. Several moving parts outside the actual Scheduler app, all
living in `~/Desktop/SCHEDULER_old/` — a separate hidden layer Trevor doesn't
interact with directly today.

**The idea:** port the workshop-scheduler's in-browser PDF parser
(`lib/parseMultitrackPdf.ts`, using `pdfjs-dist` to read text positions straight out
of the PDF) into *this* app, as a real Import page/dropzone — same pattern as its
`app/import/page.tsx` (drop or pick a PDF → preview new vs already-known jobs →
confirm to add). This would let Trevor drop the PDF directly into the Scheduler
app in the browser, no DropBox folder, no watcher script, no separate CSV file
step at all.

**Key technical facts for whoever scopes this:**
- The parser matches jobs by `ref` (Multitrack job number) to detect duplicates —
  this repo's job records use `Job` as the equivalent field per
  `SCHEDULER-ARCHITECTURE.md`'s CSV columns list, so the field-mapping needs
  checking, not assumed identical.
- The other build's parsed fields are narrower than this app's CSV columns
  (`ref, customer, manufacturer, model, status, fault` vs this app's
  `Job, Customer, Mfr, Model, Status, FirstSeen, Days, Tag, Hours, Action, Desc,
  VB, BL`) — manual fields (`Tag, Hours, Action, VB, BL, PJ`) currently come from
  the Google Sheet, not the PDF, in both builds. Bringing PDF-drop into this app
  does NOT remove the need for wherever those manual fields get set — that has to
  be part of the scope, not an afterthought.
- This is genuinely a `jobs[]` shape/identity change — **a blast-radius area per
  CLAUDE.md** — full Agent-Team Protocol required, no shortcuts.

**Next step:** decide whether this fully replaces the DropBox/watcher pipeline or
runs alongside it for a while, then write a Brief once that's settled.

---

## Do not do without Trevor's "yp" first
Neither idea above has been approved to build. This file exists so a fresh session
has the context to help Trevor turn either one into a proper Brief — not so it can
jump straight to building.
