// Which bench a job's card shows (scope lock, .claude/pending-brief.md): once
// a split job's earlier-bench parts are ticked, the card moves on to the next
// main bench rather than sitting on the job's original bench throughout.
//
// Pure and read-only: worked out every time a card draws, never saved. The
// job's own `bench` field is never touched.

// Fixed order, deliberately NOT the parts' array order (brief rule).
export const MAIN_BENCH_ORDER = ['Luthier', 'Fretwork', 'Setup'];

// Sub-benches count as the main bench that work belongs to. Same mapping as
// PRIMARY_OF in BenchWeekPage.jsx (kept local so a util does not import a
// component file).
const PRIMARY_OF = { Wiring: 'Setup', Finishing: 'Luthier' };

// A job's parts — auto-splits list their ids in `subtasks`, manual splits are
// rows pointing back with `parentId`. Child parts have no parts of their own.
export function partsOfJob(job, jobs = []) {
  if (!job || job.parentId) return [];
  if (job.hasSubtasks && Array.isArray(job.subtasks)) {
    return jobs.filter(j => job.subtasks.includes(j.id));
  }
  if (job.isSplit) return jobs.filter(j => j.parentId === job.id);
  return [];
}

// The bench to show for `job` given its parts. Falls back to the job's own
// bench when there are no parts, every part is ticked, or the job is
// Electronics. Never returns empty unless the job's own bench already is.
export function nextBenchOf(job, parts = []) {
  if (!job) return '';
  if (job.parentId || job.bench === 'Electronics') return job.bench;
  for (const bench of MAIN_BENCH_ORDER) {
    const open = parts.some(p => !p.pieceDone && (PRIMARY_OF[p.bench] || p.bench) === bench);
    if (open) return bench;
  }
  return job.bench;
}

// Convenience: look the parts up from jobs[] and pick the bench.
export function displayBenchOf(job, jobs) {
  return nextBenchOf(job, partsOfJob(job, jobs));
}
