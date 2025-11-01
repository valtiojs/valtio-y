import * as Y from "yjs";
import type { PendingMapEntry } from "./batch-types";
import type { ValtioYjsCoordinator } from "../core/coordinator";
import { plainObjectToYType } from "../core/converter";
import type { PostTransactionQueue } from "./post-transaction-queue";
import { reconcileValtioMap } from "../reconcile/reconciler";
import { getYDoc } from "../core/types";
import type { Logger } from "../core/logger";

// Apply pending map deletes (keys) first for determinism
export function applyMapDeletes(
  mapDeletes: Map<Y.Map<unknown>, Set<string>>,
  log: Logger,
): void {
  for (const [yMap, keys] of mapDeletes) {
    log.debug("Applying Map Deletes:", {
      targetId: (
        yMap as unknown as { _item?: { id?: { toString?: () => string } } }
      )._item?.id?.toString?.(),
      keys: Array.from(keys),
    });
    for (const key of keys) {
      if (yMap.has(key)) yMap.delete(key);
    }
  }
}

// Apply pending map sets
export function applyMapSets(
  mapSets: Map<Y.Map<unknown>, Map<string, PendingMapEntry>>,
  postQueue: PostTransactionQueue,
  coordinator: ValtioYjsCoordinator,
  withReconcilingLock: (fn: () => void) => void,
): void {
  for (const [yMap, keyToEntry] of mapSets) {
    coordinator.logger.debug("Applying Map Sets:", {
      targetId: (
        yMap as unknown as { _item?: { id?: { toString?: () => string } } }
      )._item?.id?.toString?.(),
      keys: Array.from(keyToEntry.keys()),
    });
    const keys = Array.from(keyToEntry.keys());
    for (const key of keys) {
      const entry = keyToEntry.get(key)!;
      // Convert the plain value to Y type during apply phase
      const yValue = plainObjectToYType(
        entry.value,
        coordinator.state,
        coordinator.logger,
      );
      coordinator.logger.debug("[mapApply] map.set", { key });
      yMap.set(key, yValue);
      if (entry.after) {
        postQueue.enqueue(() => entry.after!(yValue));
      }
    }

    // Ensure the Valtio proxy is reconciled after setting values in the Y.Map.
    // If research builds reintroduce Y.js leaf instances (Y.Text, Y.Xml*),
    // this keeps the proxy aligned with the concrete Y type rather than a stale reference.
    const mapDocNow = getYDoc(yMap);
    if (mapDocNow) {
      coordinator.logger.debug("scheduling finalize reconcile for map", {
        keys: Array.from(keyToEntry.keys()),
      });
      postQueue.enqueue(() =>
        reconcileValtioMap(coordinator, yMap, mapDocNow, withReconcilingLock),
      );
    }
  }
}
