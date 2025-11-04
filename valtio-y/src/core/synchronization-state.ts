import * as Y from "yjs";
import type { YSharedContainer } from "./yjs-types";

/**
 * Type alias for any Y.js shared type that valtio-y can synchronize.
 */
export type AnySharedType = YSharedContainer;

/**
 * Pure state holder for valtio-y synchronization.
 *
 * This class contains ONLY data structures and state management logic.
 * It has ZERO dependencies on business logic modules (no circular dependencies).
 *
 * Architectural principle: Separate data from coordination.
 * - This class: Pure state (what data exists)
 * - ValtioYjsCoordinator: Orchestration (how components interact)
 * - Apply functions: Business logic (what operations to perform)
 */
export class SynchronizationState {
  // Bidirectional caches: Y type <-> Valtio proxy
  readonly yTypeToValtioProxy = new WeakMap<AnySharedType, object>();
  readonly valtioProxyToYType = new WeakMap<object, AnySharedType>();

  // Track unsubscribe function for Valtio subscriptions per Y type
  readonly yTypeToUnsubscribe = new WeakMap<AnySharedType, () => void>();

  // Track all unsubscribe functions for a full dispose
  private readonly allUnsubscribers = new Set<() => void>();

  // Global flag used to prevent reflecting Valtio changes back into Yjs
  // during reconciliation (when Yjs -> Valtio sync is happening)
  isReconciling = false;

  // During a sync pass, arrays that have a recorded delta should not be
  // structurally reconciled to avoid double-applying (structure + delta).
  private arraysWithDeltaDuringSync: WeakSet<Y.Array<unknown>> | null = null;

  /**
   * Register a subscription cleanup function for a Y type.
   * If a subscription already exists for this type, it will be cleaned up first.
   */
  registerSubscription(yType: AnySharedType, unsubscribe: () => void): void {
    const existing = this.yTypeToUnsubscribe.get(yType);
    if (existing) existing();
    this.yTypeToUnsubscribe.set(yType, unsubscribe);
    this.allUnsubscribers.add(unsubscribe);
  }

  /**
   * Unregister and cleanup a subscription for a Y type.
   * Safe to call even if no subscription exists.
   */
  unregisterSubscription(yType: AnySharedType): void {
    const unsubscribe = this.yTypeToUnsubscribe.get(yType);
    if (!unsubscribe) return;
    this.yTypeToUnsubscribe.delete(yType);
    this.allUnsubscribers.delete(unsubscribe);
    try {
      unsubscribe();
    } catch {
      // ignore errors during best-effort cleanup
    }
  }

  /**
   * Register a generic disposable callback (e.g., for leaf node observers).
   * Used for cleanup tasks that don't map directly to Y types.
   */
  registerDisposable(dispose: () => void): void {
    this.allUnsubscribers.add(dispose);
  }

  /**
   * Dispose all registered subscriptions and cleanup callbacks.
   * Errors during cleanup are silently ignored to ensure all cleanups attempt to run.
   */
  disposeAll(): void {
    for (const unsub of this.allUnsubscribers) {
      try {
        unsub();
      } catch {
        // ignore - best effort cleanup
      }
    }
    this.allUnsubscribers.clear();
  }

  /**
   * Mark a set of arrays as having delta events during the current sync pass.
   * These arrays should skip structural reconciliation to avoid double-applying changes.
   */
  setArraysWithDeltaDuringSync(arrays: Iterable<Y.Array<unknown>>): void {
    const ws = new WeakSet<Y.Array<unknown>>();
    for (const a of arrays) ws.add(a);
    this.arraysWithDeltaDuringSync = ws;
  }

  /**
   * Clear the delta tracking for arrays (called after sync pass completes).
   */
  clearArraysWithDeltaDuringSync(): void {
    this.arraysWithDeltaDuringSync = null;
  }

  /**
   * Check if an array should skip structural reconciliation during this sync pass.
   * Returns true if the array had delta events and should not be structurally reconciled.
   */
  shouldSkipArrayStructuralReconcile(arr: Y.Array<unknown>): boolean {
    return (
      this.arraysWithDeltaDuringSync !== null &&
      this.arraysWithDeltaDuringSync.has(arr)
    );
  }
}
