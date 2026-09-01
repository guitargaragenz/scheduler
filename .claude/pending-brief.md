# Pending — keyword work is built and waiting on a browser test

doc_status: live

**Read `docs/briefs/2026-09-01-handoff-keyword-work.md` first.** It is the live
state, not background.

Short version, 2026-09-01:

- Two builds are done, verified and merged to main (PR #58). Do not rebuild.
  - warning dialog: a keyword change lists which jobs would move and waits;
    cancel writes nothing.
  - "and" box: two word inputs joined by "and", saved as a chip `install + pickup`.
- **Unresolved:** his live test showed the dialog listing 10 jobs that have
  nothing to do with the edit he made. The cause is NOT established. Do not
  guess at it and do not patch around it — the handoff says what is known and
  what is not.

This supersedes the earlier "the saved keyword lists need a clean-up" scope
lock, which described work that is no longer what is being built.
