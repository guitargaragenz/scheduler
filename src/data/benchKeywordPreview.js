import { inferBench } from './jobs.js';

// Which jobs a proposed keyword list would move, worked out WITHOUT writing
// anything. This is the whole point of the file: the preview Trevor is shown
// and the change that is later applied must be the same calculation, or the
// dialog is lying to him.
//
// The filter matches what App.jsx's apply step has always done, and for the
// same reasons: split children carry a bench chosen by the user or by the
// split logic, and changing a split parent's bench would drift its auto-split
// child IDs and orphan their scheduled slots.
export function isReinferable(job) {
  return !job.parentId && !job.isSplit && !job.hasSubtasks;
}

// Returns [{ id, job, from, to }] — one entry per job that would change bench,
// in board order. `job` is the job number as shown to Trevor.
export function previewBenchChanges(jobs = [], keywords = {}) {
  const moves = [];
  for (const j of jobs) {
    if (!isReinferable(j)) continue;
    const bench = inferBench(
      j.desc, j.status, j.action, j.model, j.mfr, keywords,
      j.backlog === true, j.vb === true
    );
    if (bench !== j.bench) {
      moves.push({ id: j.id, job: j.job ?? j.id, from: j.bench, to: bench });
    }
  }
  return moves;
}
