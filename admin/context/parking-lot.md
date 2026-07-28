# Parking Lot

Currently-open items only — grouped by category, not by session date. Completed/dropped history lives in [`session-log.md`](session-log.md). Reviewed every Sunday.

> **Cleared out 2026-07-28.** Trevor reviewed all 46 open items and closed 40 of them in one
> pass: every bug except the Pomodoro timer, the whole Features & Ideas wishlist, all UX-friction
> items, all Scoped builds, and the Cowork IMAP item. Most had either shipped, died with the
> Firestore→Supabase move, or stopped mattering. **Nothing is lost** — the full list is in
> `git log -- admin/context/parking-lot.md`, and the history is in `session-log.md`.
>
> This file is deliberately short now. Keep it that way: if an idea isn't something you'd
> actually start, it doesn't belong here.

---

## Bugs

- [ ] **Pomodoro timer broken** — alarm doesn't sound at session end, and the timer itself doesn't work right (confirmed by Trevor 2026-07-01, on top of earlier alarm-only reports). Not touched yet.

---

## Housekeeping

- [x] Two unidentified screenshots on Desktop root — **dealt with, confirmed by Trevor 2026-07-28.**
- [x] Dangling `SCHEDULER` symlink on Desktop (old pointer to Moby's `/Users/trevorcollings/...`) — **gone, verified 2026-07-28**: no symlinks remain on Desktop root.
- [ ] **Revoke the `jt-backup-ggnz-35a126beb4ca.json` service-account key in Google Cloud Console** — moving it to `archive/job-tracker/` and gitignoring it locally doesn't invalidate the key itself; it stays live until revoked. Trevor doing this himself (needs his Google login). **Apple reminder set for 2026-07-28 8:30pm.** Tick off once confirmed.
- [ ] **`/read-the-manual` (personal skill, `~/.claude/skills/`) isn't reachable from git-worktree-isolated sessions** — confirmed 2026-07-11 when the build session running on `feature/daily-log-carry-forward` (a worktree) couldn't find the command at all. Personal skills are likely local-session-scoped in a way worktree-isolated sessions don't inherit. Not blocking (worktree sessions get their context from the plan/brief directly instead), but worth understanding/fixing if this skill is meant to be usable from any session type. **On the same 8:30pm reminder as the key, as a footnote.**

---

## Skills / Tooling

- [ ] **Build a "guitar wiring diagram" skill** (parked 2026-07-24) — bottle the approved schemdraw setup (venv, SVG backend, house style: text beside symbols, cap off volume wiper, tone ground faces right, etc.) + `guitar_draft.py` as reference + a render-and-check checklist. Scope narrow to guitar wiring, NOT general electronics. Deliberately parked until the bench switcher schematic is finished so real lessons feed in. Files live in `…/BUILDS/Bench Switcher/`. See memory `reference_schemdraw_wiring.md`.
