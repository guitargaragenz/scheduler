#!/usr/bin/env python3
"""
Keeps .claude/pending-brief.md a scope lock instead of a second copy of the brief.

Why this exists (2026-08-08): the revenue scope lock grew to ~300 lines — history, council
rulings, audit record, the lot — a near-duplicate of docs/briefs/revenue-data-loss-fix.md.
Every session that started work loaded the whole thing, and /next loaded the real brief too,
so the same audit arrived twice before any work happened. Trevor pays for that in context,
which is the thing he has least of.

A scope lock answers three questions: what to build, what is out, what rules bind. History,
rulings and checklists belong in docs/briefs/, linked, not inlined.

This fires AFTER the write, so the file is saved either way — nothing is lost and no work is
blocked. It is one bounce, not a loop: it names the limit and names where the extra belongs.
If a second pass is still over, stop and ask Trevor rather than shaving lines to beat the
counter. A squeezed page is worse than a long one; the win is splitting it, not trimming it.

Exit 0 = silent. Exit 2 = stderr is shown to Claude as a warning.
"""

import json
import os
import sys

WATCHED = ".claude/pending-brief.md"
LIMIT = 50


def main():
    try:
        payload = json.load(sys.stdin)
    except (json.JSONDecodeError, ValueError):
        sys.exit(0)

    if payload.get("tool_name") not in ("Write", "Edit", "MultiEdit", "NotebookEdit"):
        sys.exit(0)

    path = ((payload.get("tool_input") or {}).get("file_path") or "").strip()
    if not path.replace(os.sep, "/").endswith(WATCHED):
        sys.exit(0)

    try:
        with open(path, "r", encoding="utf-8") as handle:
            lines = handle.read().splitlines()
    except OSError:
        sys.exit(0)

    if len(lines) <= LIMIT:
        sys.exit(0)

    sys.stderr.write(
        f"⚠️  pending-brief.md is now {len(lines)} lines — a scope lock is capped at {LIMIT}.\n"
        "\n"
        "It is saved; nothing is lost. But it has stopped being a scope lock and started being a\n"
        "second copy of the brief, which every future session then loads twice.\n"
        "\n"
        "Keep on this page ONLY: what to build, what is explicitly out of scope, and the rules\n"
        "that bind the build. Move history, council rulings, audit records, verification\n"
        "checklists and code archaeology into the brief in docs/briefs/ and link to it — with the\n"
        "link labelled so the next session knows not to open it just to start work.\n"
        "\n"
        "Split it; do not trim it to fit. If it is still over after one honest split, stop and ask\n"
        "Trevor — a squeezed page is worse than a long one.\n"
    )
    sys.exit(2)


if __name__ == "__main__":
    main()
