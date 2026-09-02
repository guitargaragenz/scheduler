# Pending — a confirmed keyword change may not be saving

doc_status: live

**Read `docs/briefs/2026-09-02-handoff-keyword-save-not-sticking.md` first.** It
is the live state, not background — it carries what was verified, what was
already ruled out, and the failure mode that cost the 2026-09-02 session.

Short version:

- Job **1616** was listed by the keyword confirmation dialog, Trevor confirmed
  it, and **it did not move**. That is the bug to chase.
- If a confirmed change never lands, that also explains the same 10 unrelated
  jobs reappearing on every save — the board never changes, so every save
  starts from the same stale state.
- Cause **not** established. Nothing is approved to build yet.

Rules that bind this work:

- **No guessing at a cause.** Three were floated on 2026-09-02 and two were
  wrong. The live job data is not readable from a web session; say so rather
  than filling the gap with a theory.
- **Do not rebuild** the warning dialog or the "and" box. Both are shipped and
  verified (PR #58). The "and" box was tested directly and matches correctly.
- **Do not** revive the keyword-list "clean-up" — Trevor: *"a mistake by bad
  council decision"*, closed 2026-09-01.
- This reaches `jobs[]` and `useSupabase.js`, so once a fix is scoped it goes
  through the **full protocol**.

Tool already committed, never run: `scripts/diagnose_bench_disagreements.mjs` —
read-only, needs `.env`, so Micky only.
