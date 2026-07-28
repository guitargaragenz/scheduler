#!/usr/bin/env python3
"""
Blocks any subagent spawn that would silently inherit the session's model.

Why this exists (2026-07-28): subagents default to inheriting whatever model the main
session is running. So setting Opus for architecture work also meant every council
reviewer, verifier and scout spawned as Opus too — one `council this` was ~11 Opus
agents. That was the main cause of hitting rate limits.

The rule: every spawn must have its model decided on purpose. Either the agent
definition in .claude/agents/ pins one, or the call passes one explicitly. Premium
models are allowlisted to the agents that genuinely need them.

Exit 0 = allow. Exit 2 = block, and stderr is shown to Claude as the reason.
"""

import json
import os
import re
import sys

SPAWN_TOOLS = {"Task", "Agent"}

# Models that burn the rate limit fast. Allowed only for allowlisted agents.
PREMIUM_MODELS = {"opus", "fable"}

# The only agents permitted to run on a premium model. Keep this list short.
# ggnz-builder writes to live job-state code, where a cheap agent's mistake costs
# more than it saves.
PREMIUM_ALLOWED_AGENTS = {"ggnz-builder"}

FRONTMATTER_MODEL = re.compile(r"^model:\s*([A-Za-z0-9._-]+)\s*$", re.MULTILINE)


def pinned_model(agent_type):
    """Return the model pinned in .claude/agents/<agent_type>.md, or None."""
    if not agent_type:
        return None
    project_dir = os.environ.get("CLAUDE_PROJECT_DIR", os.getcwd())
    path = os.path.join(project_dir, ".claude", "agents", f"{agent_type}.md")
    try:
        with open(path, "r", encoding="utf-8") as handle:
            head = handle.read(4096)
    except OSError:
        return None
    match = FRONTMATTER_MODEL.search(head)
    return match.group(1).lower() if match else None


def block(message):
    sys.stderr.write(message.strip() + "\n")
    sys.exit(2)


def main():
    try:
        payload = json.load(sys.stdin)
    except (json.JSONDecodeError, ValueError):
        # Never wedge the session on a malformed payload.
        sys.exit(0)

    if payload.get("tool_name") not in SPAWN_TOOLS:
        sys.exit(0)

    tool_input = payload.get("tool_input") or {}
    agent_type = (tool_input.get("subagent_type") or "").strip()
    explicit = (tool_input.get("model") or "").strip().lower()
    effective = explicit or pinned_model(agent_type)

    if not effective:
        block(
            f"BLOCKED: agent spawn with no model set (subagent_type={agent_type or 'default'}).\n"
            "Subagents inherit the session model by default, which is what blows the rate limit.\n"
            "Fix it one of two ways:\n"
            "  1. Use a pinned GGNZ agent: ggnz-scout (haiku, lookups), ggnz-council (sonnet,\n"
            "     design review), ggnz-verifier (sonnet, checklist), ggnz-builder (opus, approved\n"
            "     blast-radius builds only).\n"
            "  2. Pass model explicitly, e.g. model: \"sonnet\".\n"
            "Default to sonnet. Haiku for pure lookups. Opus only via ggnz-builder."
        )

    if effective in PREMIUM_MODELS and agent_type not in PREMIUM_ALLOWED_AGENTS:
        block(
            f"BLOCKED: premium model '{effective}' requested for "
            f"subagent_type={agent_type or 'default'}.\n"
            f"Premium subagents are allowlisted to: {', '.join(sorted(PREMIUM_ALLOWED_AGENTS))}.\n"
            "Use sonnet for review/analysis work, haiku for lookups. If this genuinely needs a\n"
            "premium agent, ask Trevor first and say why — do not route around this hook."
        )

    sys.exit(0)


if __name__ == "__main__":
    main()
