#!/usr/bin/env python3
"""
Warns whenever a closed/parked brief is read, no matter where in the file you land.

Why this exists (2026-07-28): Briefs E and F each took three build rounds because a
session found an old brief by search, entered it in the middle, and acted on a task list
that had been finished days earlier. The file had a "RESOLVED" note at the top — but you
only see the top if you enter at the top. A banner cannot fix a mid-file entry. A hook can.

Every brief now carries `doc_status:` frontmatter (live / parked / closed). This fires on
Read of anything in docs/briefs/ that is not live, and says so in a way the reader cannot
skip past.

Exit 0 = silent. Exit 2 = the tool has already run; stderr is shown to Claude as a warning.
"""

import json
import os
import re
import sys

STATUS = re.compile(r"^doc_status:\s*([A-Za-z-]+)\s*$", re.MULTILINE)

# Folders where a document can read like live work. Specs and plans belong here too: the
# job-blocking spec and plan both still said "not built, no commits without approval" days
# after the build had shipped and merged.
WATCHED_DIRS = ("/docs/briefs/", "/docs/superpowers/plans/", "/docs/superpowers/specs/")


def main():
    try:
        payload = json.load(sys.stdin)
    except (json.JSONDecodeError, ValueError):
        sys.exit(0)

    if payload.get("tool_name") != "Read":
        sys.exit(0)

    path = ((payload.get("tool_input") or {}).get("file_path") or "").strip()
    norm = path.replace(os.sep, "/")
    if not norm.endswith(".md") or norm.endswith("/README.md"):
        sys.exit(0)
    if not any(d in norm for d in WATCHED_DIRS):
        sys.exit(0)

    try:
        with open(path, "r", encoding="utf-8") as handle:
            head = handle.read(2048)
    except OSError:
        sys.exit(0)

    match = STATUS.search(head)
    if not match:
        sys.stderr.write(
            f"⚠️  {os.path.basename(path)} has no `doc_status:` frontmatter, so there is no way "
            "to tell whether it is live work or finished history.\n"
            "Do not act on anything in it until you have confirmed its status against "
            "docs/briefs/README.md, and add the frontmatter once you know.\n"
        )
        sys.exit(2)

    status = match.group(1).lower()
    if status == "live":
        sys.exit(0)

    if status == "parked":
        sys.stderr.write(
            f"⚠️  {os.path.basename(path)} is PARKED — scoped but deliberately not started, and "
            "not approved.\n"
            "Do not begin building it. If it looks like the obvious next job, ask Trevor first.\n"
        )
        sys.exit(2)

    sys.stderr.write(
        f"⛔ {os.path.basename(path)} is CLOSED — finished history, not live work.\n"
        "Whatever you just read, including any task list, 'next steps', 'awaiting approval' or\n"
        "'do this next' section, describes a situation that no longer exists. It is a record.\n"
        "\n"
        "Do NOT start work from this file. Do NOT treat its statements about the code as current —\n"
        "several closed briefs contain facts that were later proven wrong. Check the live code.\n"
        "\n"
        "The live brief is the one named in your starting prompt, or .claude/pending-brief.md.\n"
    )
    sys.exit(2)


if __name__ == "__main__":
    main()
