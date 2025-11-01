import * as Y from 'yjs';
import { WriteScheduler } from '../scheduling/write-scheduler';
import { applyMapDeletes, applyMapSets } from '../scheduling/map-apply';
import { applyArrayOperations } from '../scheduling/array-apply';
import { LOG_PREFIX } from './constants';
import type { YSharedContainer } from './yjs-types';

/**
 * Encapsulates all state for a single valtio-yjs instance.
 * Holds caches, subscription disposers, and a reconciliation flag.
 */
export type AnySharedType = YSharedContainer;

export interface Logger {
  debug: (...args: unknown[]) => void;
  warn: (...args: unknown[]) => void;
  error: (...args: unknown[]) => void;
}

export class SynchronizationContext {
  // Logger facility
  readonly log: Logger;
  private readonly debugEnabled: boolean;
  private readonly traceMode: boolean;

  // Caches: Y type <-> Valtio proxy
  readonly yTypeToValtioProxy = new WeakMap<AnySharedType, object>();
  readonly valtioProxyToYType = new WeakMap<object, AnySharedType>();

  // Track unsubscribe function for Valtio subscriptions per Y type
  readonly yTypeToUnsubscribe = new WeakMap<AnySharedType, () => void>();

  // Track all unsubscribe functions for a full dispose
  private readonly allUnsubscribers = new Set<() => void>();

  // Global flag used to prevent reflecting Valtio changes back into Yjs
  isReconciling = false;

  // Write scheduler instance
  private writeScheduler: WriteScheduler;

  // During a sync pass, arrays that have a recorded delta should not be
  // structurally reconciled to avoid double-applying (structure + delta).
  private arraysWithDeltaDuringSync: WeakSet<Y.Array<unknown>> | null = null;

  constructor(debug?: boolean, trace?: boolean) {
    this.debugEnabled = debug ?? false;
    this.traceMode = trace ?? false;
    const withPrefix = (...args: unknown[]): unknown[] =>
      args.length > 0 && typeof args[0] === 'string'
        ? [`${LOG_PREFIX} ${args[0] as string}`, ...(args.slice(1) as unknown[])]
        : [LOG_PREFIX, ...args];

    this.log = {
      debug: (...args: unknown[]) => {
        if (!this.debugEnabled) return;
        console.debug(...(withPrefix(...args) as unknown[]));
      },
      warn: (...args: unknown[]) => {
        console.warn(...(withPrefix(...args) as unknown[]));
      },
      error: (...args: unknown[]) => {
        console.error(...(withPrefix(...args) as unknown[]));
      },
    };

    // Initialize write scheduler with apply functions
    this.writeScheduler = new WriteScheduler(this.log, this.traceMode);
    this.writeScheduler.setApplyFunctions(
      (mapDeletes) => applyMapDeletes(mapDeletes, this.log),
      (mapSets, postQueue) => applyMapSets(mapSets, postQueue, this.log, this),
      (arraySets, arrayDeletes, arrayReplaces, postQueue) => applyArrayOperations(this, arraySets, arrayDeletes, arrayReplaces, postQueue),
      (fn) => this.withReconcilingLock(fn),
    );
  }

  withReconcilingLock(fn: () => void): void {
    const previous = this.isReconciling;
    this.isReconciling = true;
    try {
      fn();
    } finally {
      this.isReconciling = previous;
    }
  }

  registerSubscription(yType: AnySharedType, unsubscribe: () => void): void {
    const existing = this.yTypeToUnsubscribe.get(yType);
    if (existing) existing();
    this.yTypeToUnsubscribe.set(yType, unsubscribe);
    this.allUnsubscribers.add(unsubscribe);
  }

  /**
   * Register a generic disposable callback (e.g., for leaf node observers).
   * Used for cleanup tasks that don't map directly to Y types.
   */
  registerDisposable(dispose: () => void): void {
    this.allUnsubscribers.add(dispose);
  }

  disposeAll(): void {
    for (const unsub of this.allUnsubscribers) {
      try {
        unsub();
      } catch {
        // ignore
      }
    }
    this.allUnsubscribers.clear();
  }

  bindDoc(doc: Y.Doc): void {
    this.writeScheduler.bindDoc(doc);
  }

  // Sync pass helpers for skipping structural reconciliation on arrays with deltas
  setArraysWithDeltaDuringSync(arrays: Iterable<Y.Array<unknown>>): void {
    const ws = new WeakSet<Y.Array<unknown>>();
    for (const a of arrays) ws.add(a);
    this.arraysWithDeltaDuringSync = ws;
  }

  clearArraysWithDeltaDuringSync(): void {
    this.arraysWithDeltaDuringSync = null;
  }

  shouldSkipArrayStructuralReconcile(arr: Y.Array<unknown>): boolean {
    return this.arraysWithDeltaDuringSync !== null && this.arraysWithDeltaDuringSync.has(arr);
  }

  // Delegate enqueue operations to the write scheduler
  enqueueMapSet(
    yMap: Y.Map<unknown>,
    key: string,
    value: unknown,
    postUpgrade?: (yValue: unknown) => void,
  ): void {
    this.writeScheduler.enqueueMapSet(yMap, key, value, postUpgrade);
  }

  enqueueMapDelete(yMap: Y.Map<unknown>, key: string): void {
    this.writeScheduler.enqueueMapDelete(yMap, key);
  }

  enqueueArraySet(
    yArray: Y.Array<unknown>,
    index: number,
    value: unknown,
    postUpgrade?: (yValue: unknown) => void,
  ): void {
    this.writeScheduler.enqueueArraySet(yArray, index, value, postUpgrade);
  }

  enqueueArrayReplace(
    yArray: Y.Array<unknown>,
    index: number,
    value: unknown,
    postUpgrade?: (yValue: unknown) => void,
  ): void {
    this.writeScheduler.enqueueArrayReplace(yArray, index, value, postUpgrade);
  }

  enqueueArrayDelete(yArray: Y.Array<unknown>, index: number): void {
    this.writeScheduler.enqueueArrayDelete(yArray, index);
  }
}
