// Synchronizer layer
//
// Responsibility:
// - Listen to Yjs deep events and trigger reconciliation.
// - Ignore transactions with our origin (VALTIO_YJS_ORIGIN) to prevent loops.
// - For each deep event, walk up to the nearest materialized ancestor and
//   reconcile that container to support lazy materialization.
import * as Y from 'yjs';
import { VALTIO_YJS_ORIGIN } from './core/constants';
import { reconcileValtioMap, reconcileValtioArray, reconcileValtioArrayWithDelta } from './reconcile/reconciler';
import type { YSharedContainer, YArrayDelta } from './core/yjs-types';
import { SynchronizationContext } from './core/context';
import { getValtioProxyForYType } from './bridge/valtio-bridge';
import { isYArrayEvent } from './core/yjs-events';
import { isYArray, isYMap, isYSharedContainer } from './core/guards';
// Synchronization strategy
//
// We use `observeDeep` on the chosen root container to detect any changes below.
// For each event, we determine the nearest materialized ancestor (boundary)
// and reconcile only that ancestor. This ensures correctness and performance.

/**
 * Sets up a one-way listener from Yjs to Valtio.
 * On remote changes, it notifies the correct controller proxy to trigger UI updates.
 * @returns A dispose function to clean up the listener.
 */
export function setupSyncListener(
  context: SynchronizationContext,
  doc: Y.Doc,
  yRoot: Y.Map<unknown> | Y.Array<unknown>,
): () => void {
  const handleDeep = (events: Y.YEvent<Y.AbstractType<unknown>>[], transaction: Y.Transaction) => {
    if (transaction.origin === VALTIO_YJS_ORIGIN) {
      return;
    }
    context.log.debug('[sync] deep', {
      events: events.map((e) => ({
        target: e.target.constructor.name,
        path: (e.path ?? []).slice(),
        isArray: isYArray(e.target),
        isMap: isYMap(e.target),
      })),
    });
    // Two-phase strategy:
    // 1) Reconcile materialized ancestor boundaries to ensure structure and
    //    materialize any newly introduced child controllers.
    // 2) Apply granular array deltas to the actual array targets after their
    //    parents are materialized in phase 1.
    const boundaries = new Set<YSharedContainer>();
    const arrayTargetToDelta = new Map<Y.Array<unknown>, YArrayDelta>();
    for (const event of events) {
      const targetContainer = isYSharedContainer(event.target) ? (event.target as YSharedContainer) : null;
      let boundary: YSharedContainer | null = targetContainer;
      while (boundary && !getValtioProxyForYType(context, boundary)) {
        const parent = boundary.parent as Y.AbstractType<unknown> | Y.Doc | null;
        boundary = parent && isYSharedContainer(parent) ? (parent as YSharedContainer) : null;
      }
      if (!boundary) {
        boundary = yRoot;
      }
      // Phase 1 target: boundary
      boundaries.add(boundary);
      // Record array delta by direct target (phase 2)
      if (isYArrayEvent(event)) {
        if (event.changes.delta && event.changes.delta.length > 0) {
          arrayTargetToDelta.set(event.target as unknown as Y.Array<unknown>, event.changes.delta);
        }
      }
    }
    // Phase 1: boundaries first (parents before children)
    const arraysWithDelta = new Set(arrayTargetToDelta.keys());
    // Inform context to skip structural reconcile for arrays that have deltas in this sync pass
    context.setArraysWithDeltaDuringSync(arraysWithDelta);
    try {
      for (const container of boundaries) {
        if (isYMap(container)) {
          reconcileValtioMap(context, container, doc);
        } else if (isYArray(container)) {
          // Structural reconcile will internally check context.shouldSkipArrayStructuralReconcile
          reconcileValtioArray(context, container, doc);
          // Ensure that direct array targets with deltas still get a boundary reconcile after deltas too
          // by scheduling a post-task via the context (apply layer already posts reconciles; this is extra safety).
        }
        // Note: XML types (XmlFragment, XmlElement, XmlHook) are treated as leaf types,
        // not containers, so they don't need reconciliation here
      }
      // Phase 2: apply granular array deltas to direct targets
      for (const [arr, delta] of arrayTargetToDelta) {
        if (delta && delta.length > 0) {
          reconcileValtioArrayWithDelta(context, arr, doc, delta);
        }
      }
    } finally {
      // Clear skip set for next sync pass (guaranteed cleanup even on error)
      context.clearArraysWithDeltaDuringSync();
    }
  };

  yRoot.observeDeep(handleDeep);

  return () => {
    yRoot.unobserveDeep(handleDeep);
  };
}



