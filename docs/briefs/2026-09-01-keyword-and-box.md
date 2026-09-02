# Keyword "and" box — match two words in one description

doc_status: closed

Requested by Trevor 2026-09-01. Builds AFTER the keyword-warning dialog
(PR #58) is browser-tested and merged — that build owns the scope lock until then.

## The problem

To match a job whose description contains BOTH "install" and "pickup", Trevor
currently has to type a raw regular expression into the keyword box:

    (?=.*install)(?=.*pickup)

That works (`src/data/jobs.js:107` passes keyword text through to `RegExp`
unescaped), but it is developer syntax in a tab a service tech uses.

## Build this

An "and" entry in Settings → Keywords, alongside the existing single-keyword box:

1. Two (or more) plain word inputs, joined by the word "and" in the UI.
2. On save, store the lookahead pattern that already works — do not invent a new
   matching mechanism.
3. Show the saved entry as a readable chip, e.g. `install + pickup`, not as the
   raw pattern. Removing the chip removes the whole entry.
4. It must flow through the same confirmation dialog built in PR #58 — an "and"
   entry moves jobs like any other keyword, so it gets the same warning first.

## Not in scope

- Sentence-level matching. This checks the whole description; there is no
  sentence option and we are not building one.
- Any change to `inferBench` or how patterns are matched. This build only
  produces a pattern string that the existing matcher already understands.
- The quoted-keyword priority behaviour. If an "and" entry needs to jump the
  bench order, it uses the existing double-quote rule unchanged.

## Rules that bind this

- Editing keywords re-runs bench matching over live jobs, so `jobs[]` is in
  play. Full protocol.
- Plain English in the UI. The word "regex" must not appear anywhere Trevor
  can see it.
- Escaping: user-typed words go into a pattern. Make sure a word containing a
  regex character cannot break the pattern or match wrongly.
