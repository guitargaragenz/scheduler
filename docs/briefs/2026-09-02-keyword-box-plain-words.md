doc_status: live

# Scope: the Settings keyword box should take plain words

Written 2026-09-02. Nothing built yet. Supersedes the "clean up the saved list"
approach in `2026-09-01-keyword-cleanup.md` — that one fixes today's 16 bad
rows by hand and leaves the box exactly as able to create the next 16.

## The problem in one line

Settings saves whatever you type straight into the matching engine as a regex,
so a plain word like `top` matches inside "stop" and `crack` matches inside
"crackling", and the only way to stop that is to type `\btop\b`.

Verified 2026-09-01:

- `KeywordEditor.add()` (`SettingsModal.jsx:82`) does `raw.trim().toLowerCase()`
  and nothing else. No escaping, no fencing.
- `inferBench()` joins the list with `|` into one `RegExp` (`jobs.js:107`).
- The shipped defaults carry the marks (`\\bcrack\\b`, `\\btop\\b`,
  `bridge(?!\\s*pup|\\s*pickup)`). The **saved** Luthier list has none of them,
  plus a bare `broken`. That is the drift behind the 16 pending job moves.

Nobody typing into that box is expected to know regex. The box is the bug.

## What to build

**1. Keywords become plain text.** Everything typed is treated as literal words,
never as a pattern. Regex characters are escaped at match time.

**2. Whole-word fencing is automatic.** `top` matches "top", not "stop".
Multi-word phrases (`lower bout`) match as a whole phrase, still fenced at both
ends. Trailing-`s` behaviour must be decided (see open question 1).

**3. Quotes keep their current meaning.** A quoted keyword still wins priority
over every unquoted one (shipped in #55). Unchanged.

**4. A way to say "but not this".** `bridge(?!\s*pup|\s*pickup)` exists so a
bridge pickup job doesn't land on Luthier. Plain words cannot express that.
Proposal: a keyword typed with a leading minus — `-bridge pickup` — suppresses
that bench when the phrase is present. Needs Trevor's sign-off on the shape.

**5. Migrate the defaults and the saved lists.** Convert both to plain words in
the same change:
- strip every `\b`
- split `broken neck|broken headstock|broken brace|broken bridge` (currently one
  entry in the shipped defaults) into separate keywords
- turn `bridge(?!...)` into `bridge` plus the exclusion from (4)
- drop the saved bare `broken` — it is the single worst entry, and with fencing
  it still wrongly claims "broken keys" and "broken presence pots" for Luthier
- `\\bkeys?\\b` loses its optional `s` — see open question 1

**6. Show what will move before it moves.** Today the first keystroke in that
tab silently re-benches every job (`App.jsx:265`). After this change matching
shifts for everyone at once, so: compute the diff, show "N jobs change bench"
with the list, and write only on confirm. This is the safety net for the whole
change and is not optional.

## Out of scope

- The bench-matching ORDER, the split rules, `createSubtasks`.
- The hard-coded regexes at `jobs.js:361`, `381`, `396-398` — they are code,
  not user input, and are not what this fixes. Leave them.
- Any change to what a quoted keyword does.

## Answered by Trevor, 2026-09-02 — build to these

1. **Plurals: no auto-`s` rule.** `string` fenced does not match "strings", and
   that is fine — both words stay in the list as separate keywords, which is
   what the Setup list already does. In his words: *"string and strings are the
   same all setup bench"*. Do not add plural matching; it would widen every
   keyword on the board for one convenience.
2. **Exclusions: the leading minus.** `-bridge pickup`. No separate UI box.
3. **The preview is all-or-nothing.** One confirm for the whole set of moves,
   no per-job ticking.

## Still to do before the build

Council (protocol step 2). Not waived — Trevor waived it for PR #55 on the
grounds that it was UI only; this one changes how matching works and writes
`bench` on live jobs.

## Rules that bind this

- Blast-radius: writes `bench` on live jobs. Full agent-team protocol unless
  Trevor waives council in writing.
- `finish` on Luthier is load-bearing for the refinish split — check
  `createSubtasks` before touching it.
- Live Supabase credentials are in the web session. All measuring is READ-ONLY;
  scripts go to the scratchpad, never the repo.
- Git discipline per CLAUDE.md.
