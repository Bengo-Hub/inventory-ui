'use client';

import { toast } from 'sonner';

// Compiles background bulk-job completion toasts (item-outlet-membership moves, bulk stock
// adjustments — see useStock.ts/org-shell.tsx's NotificationListener) so several jobs queued
// close together fire ONE combined toast once the LAST outstanding one finishes, instead of each
// one toasting the instant it individually completes. Each job still refreshes its data
// immediately and unconditionally on completion (see invalidateBulkStockQueries in useStock.ts)
// — only the toast is deferred/compiled, never the underlying query invalidation.
//
// Module-level singleton scoped to this browser tab's JS runtime: a job registered here is only
// ever reported back through THIS tab's own WebSocket connection, so there's no cross-tab/
// cross-session bleed — a second tab (or a job someone else started) simply never appears in
// `pending` and reportJobCompletion returns false for it, letting the caller fall back to an
// ordinary immediate toast.

export const BULK_JOB_LABELS: Record<string, string> = {
  item_relocation: 'Outlet update',
  bulk_stock_adjust: 'Bulk stock adjustment',
};

export function labelForJobType(jobType: string): string {
  return BULK_JOB_LABELS[jobType] ?? 'Bulk operation';
}

interface JobCompletionResult {
  status: 'completed' | 'failed';
  processed: number;
  failed: number;
}

interface CollectedResult extends JobCompletionResult {
  label: string;
}

// A tracked job that never gets a completion event (dropped socket) would otherwise wedge the
// whole compiled group forever — this force-flushes whatever's already collected after a bounded
// wait, and drops the straggler back to untracked (its late arrival, if it ever comes, falls
// back to an ordinary immediate toast instead of being silently lost).
const FLUSH_SAFETY_MS = 30_000;

const pending = new Map<string, { label: string; timeoutId: ReturnType<typeof setTimeout> }>();
let collected: CollectedResult[] = [];

/** Registers a just-queued bulk job so its eventual completion is compiled together with any
 *  other jobs still outstanding from this tab, instead of toasting on its own. Call right after
 *  the job is accepted (202), with a human label for the operation. */
export function registerPendingJob(jobId: string, label: string): void {
  const timeoutId = setTimeout(() => forceFlush(jobId), FLUSH_SAFETY_MS);
  pending.set(jobId, { label, timeoutId });
}

/** Reports one bulk job's completion. Returns true if it was tracked (registered from this tab)
 *  — the caller should skip its own toast in that case, since a compiled one fires here once
 *  every outstanding job in the batch has finished. Returns false for an untracked job (started
 *  elsewhere, or registered before a page reload) so the caller keeps its normal immediate-toast
 *  fallback. */
export function reportJobCompletion(jobId: string, result: JobCompletionResult): boolean {
  const job = pending.get(jobId);
  if (!job) return false;
  clearTimeout(job.timeoutId);
  pending.delete(jobId);
  collected.push({ label: job.label, ...result });
  if (pending.size === 0) flush();
  return true;
}

function forceFlush(staleJobId: string): void {
  pending.delete(staleJobId);
  if (pending.size === 0) flush();
}

function flush(): void {
  const results = collected;
  collected = [];
  if (results.length === 0) return;
  if (results.length === 1) {
    fireSingle(results[0]);
    return;
  }
  const totalProcessed = results.reduce((sum, r) => sum + r.processed, 0);
  const totalSkipped = results.reduce((sum, r) => sum + r.failed, 0);
  const failedOutright = results.filter((r) => r.status === 'failed').length;
  if (failedOutright > 0) {
    toast.warning(
      `${results.length} operations complete — ${totalProcessed} items updated, ${failedOutright} operation${failedOutright === 1 ? '' : 's'} failed`,
      { duration: 8000 },
    );
  } else if (totalSkipped > 0) {
    toast.warning(`${results.length} operations complete — ${totalProcessed} applied, ${totalSkipped} skipped`, { duration: 8000 });
  } else {
    toast.success(`${results.length} operations complete — ${totalProcessed} item${totalProcessed === 1 ? '' : 's'} updated`);
  }
}

function fireSingle(r: CollectedResult): void {
  if (r.status === 'failed') {
    toast.error(`${r.label} failed`, { duration: 8000 });
    return;
  }
  if (r.failed > 0) {
    toast.warning(`${r.label} complete — ${r.processed} applied, ${r.failed} skipped`, { duration: 8000 });
  } else {
    toast.success(`${r.label} complete — ${r.processed} item${r.processed === 1 ? '' : 's'} updated`);
  }
}
