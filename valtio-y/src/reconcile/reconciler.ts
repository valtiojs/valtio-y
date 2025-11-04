import * as Y from "yjs";
import {
  getOrCreateValtioProxy,
  getValtioProxyForYType,
} from "../bridge/valtio-bridge";
import type { ValtioYjsCoordinator } from "../core/coordinator";
import { isYSharedContainer, isYArray, isYMap } from "../core/guards";
import { yTypeToJSON } from "../core/types";

function cleanupNestedValue(
  coordinator: ValtioYjsCoordinator,
  value: unknown,
): void {
  if (!value || typeof value !== "object") {
    return;
  }
  const yType = coordinator.state.valtioProxyToYType.get(value as object);
  if (!yType) {
    return;
  }
  coordinator.unregisterSubscription(yType);
  coordinator.state.yTypeToValtioProxy.delete(yType);
  coordinator.state.valtioProxyToYType.delete(value as object);
}

/**
 * Finds object-type items that were removed from an array, handling duplicates correctly.
 * Uses multiset difference: counts occurrences in new array, then finds old items not retained.
 *
 * Purpose: Identifies Valtio proxy objects that need cleanup (unsubscription and cache removal)
 * when arrays are reconciled during Yjs → Valtio sync.
 *
 * Example: old=[A, A, B], new=[A, C] → returns [A, B] (one A and B were removed)
 *
 * @internal - Exported for testing purposes only
 */
export function findRemovedControllers(
  oldItems: unknown[],
  newItems: unknown[],
): object[] {
  // Early exit: no objects to cleanup
  if (oldItems.length === 0) return [];

  // Count how many times each object appears in the new array
  const retainedCounts = new Map<object, number>();
  for (const item of newItems) {
    if (item && typeof item === "object") {
      const obj = item as object;
      retainedCounts.set(obj, (retainedCounts.get(obj) ?? 0) + 1);
    }
  }

  // Find objects from old array that aren't sufficiently retained in new array
  const removed: object[] = [];
  for (const item of oldItems) {
    if (!item || typeof item !== "object") continue;

    const obj = item as object;
    const count = retainedCounts.get(obj) ?? 0;

    if (count > 0) {
      // This instance is retained, decrement count
      retainedCounts.set(obj, count - 1);
    } else {
      // No more retained instances, this one was removed
      removed.push(obj);
    }
  }

  return removed;
}

// Reconciler layer
//
// Responsibility:
// - Apply Yjs -> Valtio updates in a structural way, ensuring the Valtio
//   proxies exist (materialized) and match the Y tree shape.
// - No deepEqual. Only add missing keys, remove extra keys, and create
//   nested controllers for Y types as needed.
// - Uses runWithoutValtioReflection to avoid reflecting these changes back
//   to Yjs.
/**
 * Reconciles the structure of a Valtio proxy to match its underlying Y.Map.
 * It creates/deletes properties on the proxy to ensure the "scaffolding" is correct.
 *
 * @param coordinator - Coordinator instance containing state and logger
 * @param yMap - The Y.Map to reconcile
 * @param doc - The Y.Doc containing the map
 * @param withReconcilingLock - Function to execute code while holding the reconciling lock
 */
export function reconcileValtioMap(
  coordinator: ValtioYjsCoordinator,
  yMap: Y.Map<unknown>,
  doc: Y.Doc,
  withReconcilingLock: (fn: () => void) => void = (fn) => fn(),
): void {
  const valtioProxy = getValtioProxyForYType(coordinator, yMap) as
    | Record<string, unknown>
    | undefined;
  if (!valtioProxy) {
    // This map hasn't been materialized yet, so there's nothing to reconcile.
    coordinator.logger.debug("reconcileValtioMap skipped (no proxy)");
    return;
  }

  withReconcilingLock(() => {
    coordinator.logger.debug("reconcileValtioMap start", {
      yKeys: Array.from(yMap.keys()),
      valtioKeys: Object.keys(valtioProxy),
      yJson: yTypeToJSON(yMap),
    });
    const yKeys = new Set(Array.from(yMap.keys()).map((k) => String(k)));
    const valtioKeys = new Set(Object.keys(valtioProxy));
    const allKeys = new Set<string>([...yKeys, ...valtioKeys]);

    for (const key of allKeys) {
      const inY = yKeys.has(key);
      const inValtio = valtioKeys.has(key);

      if (inY && !inValtio) {
        const yValue = yMap.get(key);
        if (isYSharedContainer(yValue)) {
          coordinator.logger.debug("[ADD] create controller", key);
          valtioProxy[key] = getOrCreateValtioProxy(coordinator, yValue, doc);
          if (isYMap(yValue)) {
            coordinator.logger.debug("[RECONCILE-CHILD] map", key);
            reconcileValtioMap(
              coordinator,
              yValue as Y.Map<unknown>,
              doc,
              withReconcilingLock,
            );
          } else if (isYArray(yValue)) {
            coordinator.logger.debug("[RECONCILE-CHILD] array", key);
            reconcileValtioArray(
              coordinator,
              yValue as Y.Array<unknown>,
              doc,
              withReconcilingLock,
            );
          }
        } else {
          coordinator.logger.debug("[ADD] set primitive", key);
          valtioProxy[key] = yValue;
        }
        continue;
      }

      if (!inY && inValtio) {
        coordinator.logger.debug("[DELETE] remove key", key);
        cleanupNestedValue(coordinator, valtioProxy[key]);
        delete valtioProxy[key];
        continue;
      }

      if (inY && inValtio) {
        const yValue = yMap.get(key);
        const current = valtioProxy[key];
        if (isYSharedContainer(yValue)) {
          const desired = getOrCreateValtioProxy(coordinator, yValue, doc);
          if (current !== desired) {
            coordinator.logger.debug("[REPLACE] replace controller", key);
            cleanupNestedValue(coordinator, current);
            valtioProxy[key] = desired;
          }
          if (isYMap(yValue)) {
            coordinator.logger.debug("[RECONCILE-CHILD] map", key);
            reconcileValtioMap(
              coordinator,
              yValue as Y.Map<unknown>,
              doc,
              withReconcilingLock,
            );
          } else if (isYArray(yValue)) {
            coordinator.logger.debug("[RECONCILE-CHILD] array", key);
            reconcileValtioArray(
              coordinator,
              yValue as Y.Array<unknown>,
              doc,
              withReconcilingLock,
            );
          }
        } else {
          cleanupNestedValue(coordinator, current);
          if (current !== yValue) {
            coordinator.logger.debug("[UPDATE] primitive", key);
            valtioProxy[key] = yValue;
          }
        }
      }
    }
    coordinator.logger.debug("reconcileValtioMap end", {
      valtioKeys: Object.keys(valtioProxy),
    });
  });
}

// TODO: Implement granular delta-based reconciliation for arrays.
// For now, perform a coarse structural sync using splice.
export function reconcileValtioArray(
  coordinator: ValtioYjsCoordinator,
  yArray: Y.Array<unknown>,
  doc: Y.Doc,
  withReconcilingLock: (fn: () => void) => void = (fn) => fn(),
): void {
  const valtioProxy = getValtioProxyForYType(coordinator, yArray) as
    | unknown[]
    | undefined;
  if (!valtioProxy) return;

  withReconcilingLock(() => {
    // Skip structural reconcile if this array has a delta in the current sync pass
    if (coordinator.state.shouldSkipArrayStructuralReconcile(yArray)) {
      coordinator.logger.debug(
        "reconcileValtioArray skipped due to pending delta",
        {
          yLength: yArray.length,
          valtioLength: valtioProxy.length,
        },
      );
      return;
    }
    coordinator.logger.debug("reconcileValtioArray start", {
      yLength: yArray.length,
      valtioLength: valtioProxy.length,
      yJson: yTypeToJSON(yArray),
    });
    const newContent = yArray.toArray().map((item) => {
      if (isYSharedContainer(item)) {
        return getOrCreateValtioProxy(coordinator, item, doc);
      } else {
        return item;
      }
    });
    // Find controllers that need cleanup (present in old array but not in new)
    // Uses reference counting to handle duplicates correctly (same object appearing multiple times)
    const removedControllers = findRemovedControllers(
      valtioProxy.slice(),
      newContent,
    );

    coordinator.logger.debug("reconcile array splice", newContent.length);
    valtioProxy.splice(0, valtioProxy.length, ...newContent);

    // Cleanup removed controllers (unsubscribe and remove from caches)
    for (const removed of removedControllers) {
      cleanupNestedValue(coordinator, removed);
    }

    // Recursively reconcile nested containers to ensure deep materialization
    for (const item of newContent) {
      if (item && isYSharedContainer(item)) {
        if (isYMap(item)) {
          reconcileValtioMap(
            coordinator,
            item as Y.Map<unknown>,
            doc,
            withReconcilingLock,
          );
        } else if (isYArray(item)) {
          reconcileValtioArray(
            coordinator,
            item as Y.Array<unknown>,
            doc,
            withReconcilingLock,
          );
        }
      }
    }

    coordinator.logger.debug("reconcileValtioArray end", {
      valtioLength: valtioProxy.length,
    });
  });
}

/**
 * Applies a granular Yjs delta to the Valtio array proxy, avoiding full re-splices.
 * The delta format follows Yjs ArrayEvent.changes.delta: an array of ops
 * where each op is one of { retain: number } | { delete: number } | { insert: unknown[] }.
 */
export function reconcileValtioArrayWithDelta(
  coordinator: ValtioYjsCoordinator,
  yArray: Y.Array<unknown>,
  doc: Y.Doc,
  delta: Array<{ retain?: number; delete?: number; insert?: unknown[] }>,
  withReconcilingLock: (fn: () => void) => void = (fn) => fn(),
): void {
  const valtioProxy = getValtioProxyForYType(coordinator, yArray) as
    | unknown[]
    | undefined;
  if (!valtioProxy) return;

  withReconcilingLock(() => {
    coordinator.logger.debug("reconcileValtioArrayWithDelta start", {
      delta,
      valtioLength: valtioProxy.length,
    });

    let position = 0;
    let step = 0;
    for (const d of delta) {
      coordinator.logger.debug("delta.step", { step: step++, d, position });
      if (d.retain && d.retain > 0) {
        position += d.retain;
        continue;
      }
      if (d.delete && d.delete > 0) {
        const deleteCount = d.delete;
        if (deleteCount > 0) {
          const removedItems = valtioProxy.slice(
            position,
            position + deleteCount,
          );
          valtioProxy.splice(position, deleteCount);
          for (const item of removedItems) {
            cleanupNestedValue(coordinator, item);
          }
        }
        continue;
      }
      if (d.insert && d.insert.length > 0) {
        const converted = d.insert.map((item) => {
          if (isYSharedContainer(item)) {
            return getOrCreateValtioProxy(coordinator, item, doc);
          } else {
            return item;
          }
        });
        // Idempotency guard: if the exact converted items already exist at this position
        // (e.g., due to a prior structural reconcile in the same sync pass), skip inserting.
        const existingSlice = valtioProxy.slice(
          position,
          position + converted.length,
        );
        const alreadyPresent =
          converted.length > 0 &&
          converted.every((v, i) => existingSlice[i] === v);
        if (alreadyPresent) {
          coordinator.logger.debug("delta.insert (skipped: already present)", {
            at: position,
            count: converted.length,
          });
          position += converted.length;
          continue;
        }
        coordinator.logger.debug("delta.insert", {
          at: position,
          count: converted.length,
        });
        valtioProxy.splice(position, 0, ...converted);

        position += converted.length;
        continue;
      }
      // Unknown or empty op: skip
    }

    coordinator.logger.debug("reconcileValtioArrayWithDelta end", {
      valtioLength: valtioProxy.length,
    });
  });
}
