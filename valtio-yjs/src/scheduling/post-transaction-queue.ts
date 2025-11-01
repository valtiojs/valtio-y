import type { Logger } from '../core/context';

/**
 * A queue for callbacks that need to execute after a Yjs transaction completes.
 * 
 * These callbacks typically:
 * - Upgrade plain values to controller proxies
 * - Reconcile nested shared types
 * - Perform structural reconciliation
 * 
 * The queue ensures proper error handling and isolation - if one callback fails,
 * subsequent callbacks still execute.
 */
export class PostTransactionQueue {
  private tasks: Array<() => void> = [];
  private readonly log: Logger;

  constructor(log: Logger) {
    this.log = log;
  }

  /**
   * Add a callback to the queue.
   */
  enqueue(fn: () => void): void {
    this.tasks.push(fn);
  }

  /**
   * Execute all queued callbacks within the provided lock function.
   * 
   * @param withLock - Function that wraps each callback with reconciliation lock
   * 
   * Each callback is executed independently - errors are logged but don't prevent
   * subsequent callbacks from running. This ensures that upgrade errors don't
   * break data operations.
   */
  flush(withLock: (fn: () => void) => void): void {
    const tasks = this.tasks;
    this.tasks = []; // Clear for next batch

    if (tasks.length === 0) return;

    this.log.debug(`[PostTransactionQueue] Flushing ${tasks.length} post-transaction callbacks`);

    for (const task of tasks) {
      try {
        withLock(task);
      } catch (err) {
        // Log but don't rethrow - we want to continue processing remaining tasks
        // This is intentional: upgrade errors shouldn't break data operations
        this.log.debug('[PostTransactionQueue] Task failed (continuing with remaining tasks):', err);
      }
    }
  }

  /**
   * Get the number of pending tasks (useful for debugging).
   */
  get size(): number {
    return this.tasks.length;
  }

  /**
   * Clear all pending tasks without executing them (useful for cleanup/reset).
   */
  clear(): void {
    this.tasks = [];
  }
}
