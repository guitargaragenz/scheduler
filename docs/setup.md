# Machines and session setup

- **Micky** — iMac, primary dev machine, holds the `.env` with the Firebase and Google keys. Start
  all local builds and dev-server testing here. Claude desktop app, Code tab, scheduler project
  selected. The terminal (`cd` in, run `claude`) is the same thing, only needed for setup commands
  the app can't show — `/permissions`, `/config`, `/hooks`.
- **iPhone** — `claude.ai/code`, new session, pick `guitargaragenz/scheduler`. No local dev server.
- **Moby** — MacBook, **not set up** as of 2026-08-08: never cloned, so no session runs there.
  Setup is clone → `npm install` → symlink `~/.claude/CLAUDE.md` to `personal-instructions.md` →
  AirDrop `.env` from Micky. **AirDrop only — never paste keys into a chat, the transcript keeps
  them.**

CLAUDE.md loads automatically everywhere. Sessions don't sync across devices; context lives in
CLAUDE.md, not in session history.
