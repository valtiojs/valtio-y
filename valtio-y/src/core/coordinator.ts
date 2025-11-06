import * as Y from "yjs";
import {
  SynchronizationState,
  type AnySharedType,
} from "./synchronization-state";
import { createLogger, type Logger, type LogLevel } from "./logger";
import {
  WriteScheduler,
  type ApplyFunctions,
} from "../scheduling/write-scheduler";
import { applyMapDeletes, applyMapSets } from "../scheduling/map-apply";
import { applyArrayOperations } from "../scheduling/array-apply";
import {
  reconcileValtioArray,
  reconcileValtioMap,
} from "../reconcile/reconciler";
import { getYDoc } from "./types";
import type { PostTransactionQueue } from "../scheduling/post-transaction-queue";

/**
 * Orchestrates all valtio-y components using dependency injection.
 *
 * This coordinator eliminates circular dependencies by:
 * 1. Owning all components (state, logger, scheduler)
 * 2. Wiring dependencies at construction via constructor injection
 * 3. Providing a clean public API that delegates to internal components
 *
 * Architecture:
 * - ValtioYjsCoordinator: Orchestration layer (this class)
 * - SynchronizationState: Pure data holder (no dependencies)
 * - Logger: Infrastructure for logging
 * - WriteScheduler: Batching and scheduling logic
 * - Apply functions: Business logic for applying operations
 *
 * All dependencies flow in ONE direction - no cycles possible.
 */
export class ValtioYjsCoordinator {
  // Exposed for components that need state/logging
  readonly state: SynchronizationState;
  readonly logger: Logger;

  // Internal components
  private readonly scheduler: WriteScheduler;

  constructor(doc: Y.Doc, logLevel?: LogLevel) {
    // Create pure components with no dependencies
    this.state = new SynchronizationState();
    this.logger = createLogger(logLevel ?? "off");

    // Wire up apply functions with proper dependencies via closures
    // This eliminates the need for setter injection
    const applyFunctions: ApplyFunctions = {
      applyMapDeletes: (deletes) => {
        // Current signature: applyMapDeletes(mapDeletes, log)
        applyMapDeletes(deletes, this.logger);
      },

      applyMapSets: (sets, queue, withLock) => {
        // Updated signature: applyMapSets(mapSets, postQueue, coordinator, withReconcilingLock)
        applyMapSets(sets, queue, this, withLock);
      },

      applyArrayOperations: (sets, deletes, replaces, queue, withLock) => {
        // Updated signature: applyArrayOperations(coordinator, arraySets, arrayDeletes, arrayReplaces, postQueue, withReconcilingLock)
        applyArrayOperations(this, sets, deletes, replaces, queue, withLock);
      },

      withReconcilingLock: (fn) => {
        this.withReconcilingLock(fn);
      },
    };

    // Create scheduler with all dependencies (constructor injection)
    // No setter injection needed - fully initialized immediately
    this.scheduler = new WriteScheduler(doc, this.logger, applyFunctions);
  }

  // ===== Coordination Methods =====

  /**
   * Execute a function while holding the reconciling lock.
   * This prevents Valtio changes from being reflected back to Yjs during reconciliation.
   *
   * IMPORTANT: This lock is recursion-safe. It saves and restores the previous lock state,
   * allowing nested reconciliation calls to work correctly. For example:
   * - Outer reconciliation sets isReconciling = true
   * - Nested reconciliation saves previous=true, sets isReconciling=true (no-op), executes, restores to true
   * - Outer reconciliation continues with isReconciling=true, then finally restores to original state
   *
   * This design is critical for nested structure reconciliation where a parent map/array
   * reconciliation may trigger child reconciliations.
   */
  withReconcilingLock(fn: () => void): void {
    const previous = this.state.isReconciling;
    this.state.isReconciling = true;
    try {
      fn();
    } finally {
      this.state.isReconciling = previous;
    }
  }

  // ===== Public API - Delegates to Scheduler =====

  enqueueMapSet(
    yMap: Y.Map<unknown>,
    key: string,
    value: unknown,
    postUpgrade?: (yValue: unknown) => void,
  ): void {
    this.scheduler.enqueueMapSet(yMap, key, value, postUpgrade);
  }

  enqueueMapDelete(yMap: Y.Map<unknown>, key: string): void {
    this.scheduler.enqueueMapDelete(yMap, key);
  }

  enqueueArraySet(
    yArray: Y.Array<unknown>,
    index: number,
    value: unknown,
    postUpgrade?: (yValue: unknown) => void,
  ): void {
    this.scheduler.enqueueArraySet(yArray, index, value, postUpgrade);
  }

  enqueueArrayReplace(
    yArray: Y.Array<unknown>,
    index: number,
    value: unknown,
    postUpgrade?: (yValue: unknown) => void,
  ): void {
    this.scheduler.enqueueArrayReplace(yArray, index, value, postUpgrade);
  }

  enqueueArrayDelete(yArray: Y.Array<unknown>, index: number): void {
    this.scheduler.enqueueArrayDelete(yArray, index);
  }

  // ===== State Management Delegation =====

  registerSubscription(yType: AnySharedType, unsubscribe: () => void): void {
    this.state.registerSubscription(yType, unsubscribe);
  }

  unregisterSubscription(yType: AnySharedType): void {
    this.state.unregisterSubscription(yType);
  }

  registerDisposable(dispose: () => void): void {
    this.state.registerDisposable(dispose);
  }

  disposeAll(): void {
    this.state.disposeAll();
  }

  // ===== Sync Pass Helpers =====

  setArraysWithDeltaDuringSync(arrays: Iterable<Y.Array<unknown>>): void {
    this.state.setArraysWithDeltaDuringSync(arrays);
  }

  clearArraysWithDeltaDuringSync(): void {
    this.state.clearArraysWithDeltaDuringSync();
  }

  shouldSkipArrayStructuralReconcile(arr: Y.Array<unknown>): boolean {
    return this.state.shouldSkipArrayStructuralReconcile(arr);
  }

  requestMapStructuralFinalize(
    yMap: Y.Map<unknown>,
    queue: PostTransactionQueue,
    withReconcilingLock: (fn: () => void) => void,
  ): void {
    const doc = getYDoc(yMap);
    if (!doc) return;
    this.logger.trace("[coordinator] schedule map finalize", {
      keys: Array.from(yMap.keys()),
    });
    queue.enqueue(() =>
      reconcileValtioMap(this, yMap, doc, withReconcilingLock),
    );
  }

  requestArrayStructuralFinalize(
    yArray: Y.Array<unknown>,
    queue: PostTransactionQueue,
    withReconcilingLock: (fn: () => void) => void,
  ): void {
    const doc = getYDoc(yArray);
    if (!doc) return;
    this.logger.trace("[coordinator] schedule array finalize", {
      length: yArray.length,
    });
    queue.enqueue(() =>
      reconcileValtioArray(this, yArray, doc, withReconcilingLock),
    );
  }
}
