# Pending — the Settings keyword box should take plain words

doc_status: live

Scoped 2026-09-02, and Trevor answered the three open questions the same day —
see **Answered** below. Still to do: council (step 2), then build.

## Build

1. Keywords are plain text, never a pattern. Regex characters escaped at match
   time.
2. Whole-word fencing is automatic — `top` matches "top", not "stop". Phrases
   match as a whole phrase.
3. Quoted keywords keep the priority meaning shipped in #55. Unchanged.
4. A way to say "but not this", replacing `bridge(?!\s*pup|\s*pickup)`.
   Proposed: a leading minus, `-bridge pickup`.
5. Migrate the shipped defaults AND the saved lists to plain words in the same
   change. Drop the saved bare `broken`.
6. **Preview before write.** Settings currently re-benches every job on the
   first keystroke (`App.jsx:265`). Show "N jobs change bench" plus the list,
   write only on confirm. Not optional — it is the safety net for all of it.

## Out of scope

- Bench matching ORDER, split rules, `createSubtasks`.
- The hard-coded regexes at `jobs.js:361`, `381`, `396-398` — code, not user
  input.
- What a quoted keyword does.

## Answered by Trevor, 2026-09-02

1. **Plurals: no auto-`s` rule.** Both words stay in the list as separate
   keywords. In his words: *"string and strings are the same all setup bench"*
   — same meaning, both on Setup, both listed. Do not add plural matching.
2. **Exclusions: the leading minus is fine.** `-bridge pickup`.
3. **The preview is all-or-nothing.** No per-job ticking.

## Rules

- Blast-radius (writes `bench` on live jobs) — full protocol unless Trevor
  waives council in writing.
- `finish` on Luthier is load-bearing for the refinish split. Check
  `createSubtasks` first.
- Measuring against live data is READ-ONLY; scripts to the scratchpad.

## Background, do NOT open to start work

`docs/briefs/2026-09-02-keyword-box-plain-words.md` has the evidence and the
reasoning. The older `2026-09-01-keyword-cleanup.md` is the by-hand fix this
replaces.
