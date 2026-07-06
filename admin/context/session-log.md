# Session Log

---

## 2026-06-13 — Session Cleanup

**Done:** Deleted the sync script and LaunchAgent plist that was auto-renaming and corrupting sessions. Broke the iCloud symlink and copied all 156 .jsonl files to local storage. Renamed all 36 sessions with clean date-based names (Scheduler v1–v8, Tube Buy Sheet, Job Tracker, Pomodoro, Partsbox CRM, Landing Page, Setup). Wrote ADHD Focus Protocol into CLAUDE.md.

**Parked:**
- [ ] Online session journal
- [ ] Sunday board meeting with Claude + agents (weekly planning)
- [ ] Set up rsync + path-rewrite to bring Moby sessions to Micky (optional)

**Next:** Quit and reopen Claude Desktop to see renamed sessions in sidebar. Start fresh session for whatever the original task was that never got reached today.

---

## 2026-06-13 — Final Close Out

**Done:** Deleted sync script and LaunchAgent permanently. Fixed iCloud symlink issue. Renamed all 36 sessions with clean date-based names. Wrote ADHD Focus Protocol into CLAUDE.md with session contract, tangent detection, two work modes, 10-minute chunks, parking lot, and Sunday review rules.

**Parked:**
- [ ] Online session journal
- [ ] Sunday board meeting with Claude + agents
- [ ] Explore Claude Dispatch (beta)

**Next:** Restart Claude Desktop to see renamed sessions. Start fresh session with the new protocol — state the goal first.

---

## 2026-06-23 — Pipeline & Splits Overhaul

**Stable baseline:** `stable-baseline-8` = `a4180ce`

**Fixes shipped:**

- **Calendar wipe (critical)** — watcher polling wiped all bookings if Firebase GET failed. Script now `sys.exit(1)` on fetch error instead of writing empty slots.
- **Google OAuth auto-reauth** — `sheet_to_csv` now catches `RefreshError` inline, opens browser, saves token, retries. No separate reauth step needed.
- **PDF parser dropping 22/58 jobs** — page 2 of Multitrack PDF uses 6-column layout, parser used fixed index from page 1. Fix: `row[-1]` fallback (job numbers always rightmost).
- **Scheduled jobs not hiding from sidebar** — jobs placed on calendar stayed visible. All sub-tasks scheduled → parent hides.
- **Calendar cards** — now show Mfr + Model primary, `sessionNote` amber italic secondary, job # small tag.
- **Rates not persisting** — `hourlyRate` had no state in App.jsx; `weeklyTarget` was reading but never writing localStorage. Both fixed.
- **Changelog** — populated with all shipped features; fixed `entry.ts/msg` → `entry.date/note` field mismatch.
- **createSubtasks rebuilt (additive)** — old hard-coded paths replaced. Each card added independently by keyword: refret → Refret+LCP pair; Luthier keywords → Luthier card; Setup keywords → Setup card. Refret+Luthier+Setup = 4 cards. Fully extensible.

**Parked for next session:**
- [ ] Pomodoro — show full job card info (Mfr, Model, customer, bench, hours, desc, note) as reference panel inside timer
- [ ] Pomodoro alarm not sounding at end of session
