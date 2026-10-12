// The one-tap action chips on a job card (DG, GTS, WP). Pure, so the rules can
// be tested without the board.
//
// A job has one action at most, so tapping a chip REPLACES whatever action is
// there — including the sheet-only ones (INC, CI, RS, RS-C, FB). Tapping the
// chip that is already lit clears the action to blank.
//
// WP also clears Backlog in the same write: a job is never Backlog and Waiting
// Parts at once.

export const CARD_ACTIONS = Object.freeze(['DG', 'GTS', 'WP']);

// Returns { changes, replaced, cleared }, or null for an action that has no chip.
//   changes  — the jobs_state fields to write (app-shape names)
//   replaced — the different action this tap overwrote, or null
//   cleared  — true when the tap turned the lit chip off
export function cardActionChange(job, action) {
  if (!CARD_ACTIONS.includes(action)) return null;
  const current = job?.action ?? '';
  if (current === action) {
    return { changes: { action: null }, replaced: null, cleared: true };
  }
  const changes = { action };
  if (action === 'WP') changes.backlog = false;
  return { changes, replaced: current || null, cleared: false };
}

// The toast shown when a chip overwrote a different action, so a sheet-only
// mark like INC never disappears silently. Null when nothing was replaced.
export function replacedToast(replaced, action, jobNumber) {
  return replaced ? `${replaced} replaced by ${action} on #${jobNumber}` : null;
}
