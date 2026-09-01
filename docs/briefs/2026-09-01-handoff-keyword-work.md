# Handoff — keyword warning dialog + "and" box

doc_status: live

Written 2026-09-01 at end of session. Start here.

## Where it stands

Two builds are done, verified and pushed to `claude/next-steps-d0zrqr` (PR #58,
draft, green). Nothing is merged. Nothing is uncommitted.

- `21ed13a` — warning dialog. A keyword change now shows which jobs would move
  (`#1635 — Setup → Wiring`) and waits. Cancel writes nothing at all.
- `55b3373` — "and" box. Two word inputs in Settings → Keywords joined by "and",
  saved as a chip reading `install + pickup`. Stored as a quoted keyword so it
  beats bench order.

810 tests pass, production build clean, verifier passed every checklist item on
both.

## The unresolved problem — this is the actual next task

Trevor tested it live. He added `install` on its own, and then `install + pickup`
as an and-entry, both on Wiring. **Both times the same 10 jobs came back, none of
them Wiring jobs and none containing those words.**

So the dialog works, but what it lists is not caused by the edit. Any keyword
change re-runs bench matching over every job, so the list is dominated by jobs
whose saved bench already disagrees with what the keywords produce.

What is NOT yet established: why those 10 disagree. Do not assume a cause —
several were floated in session and none were verified against live data.
Trevor was going to check the 10 against Multitrack and had not reported back.

Live job data is in Supabase and is not readable from a web session. This needs
either Trevor reading the 10 off the board, or a session on Micky with `.env`.

## Offered, not answered

Splitting the dialog into "moved by your change" vs "already out of date".
Trevor never answered. Not built. Do not build it before the cause above is
understood — it may be patching a symptom.

## Do not

- Merge PR #58 without Trevor clicking through the Vercel preview himself.
- Rebuild either of the two builds. They are verified and working as specified.
