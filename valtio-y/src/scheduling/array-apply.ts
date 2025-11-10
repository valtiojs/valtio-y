import * as Y from "yjs";
import type { PendingArrayEntry } from "./batch-types";
import type { ValtioYjsCoordinator } from "../core/coordinator";
import { plainObjectToYType } from "../core/converter";
import type { PostTransactionQueue } from "./post-transaction-queue";
import { getYItemId, yTypeToJSON, hasProperty } from "../core/types";
import type { Logger } from "../core/logger";

/**
 * Execute array operations with cleaner multi-stage approach based on explicit intents.
 * This handles:
 * 1. Replaces (splice replace operations: delete + insert at same index)
 * 2. Pure deletes (pop, shift, splice deletions)
 * 3. Pure sets (push, unshift, splice insertions)
 *
 * @param coordinator - Coordinator instance containing state and logger
 * @param withReconcilingLock - Function to execute code while holding the reconciling lock
 */
export function applyArrayOperations(
  coordinator: ValtioYjsCoordinator,
  arraySets: Map<Y.Array<unknown>, Map<number, PendingArrayEntry>>,
  arrayDeletes: Map<Y.Array<unknown>, Map<number, number>>,
  arrayReplaces: Map<Y.Array<unknown>, Map<number, PendingArrayEntry>>,
  postQueue: PostTransactionQueue,
  withReconcilingLock: (fn: () => void) => void,
): void {
  const allArrays = new Set<Y.Array<unknown>>();
  for (const a of arraySets.keys()) allArrays.add(a);
  for (const a of arrayDeletes.keys()) allArrays.add(a);
  for (const a of arrayReplaces.keys()) allArrays.add(a);

  for (const yArray of allArrays) {
    const lengthAtStart = yArray.length;
    const setsForArray =
      arraySets.get(yArray) ?? new Map<number, PendingArrayEntry>();
    const deletesForArray =
      arrayDeletes.get(yArray) ?? new Map<number, number>();
    const replacesForArray =
      arrayReplaces.get(yArray) ?? new Map<number, PendingArrayEntry>();

    // DEBUG-TRACE: per-array batch snapshot
    coordinator.logger.trace("[arrayApply] batch", {
      targetId: getYItemId(yArray),
      replaces: Array.from(replacesForArray.keys()).sort((a, b) => a - b),
      deletes: Array.from(deletesForArray.keys()).sort((a, b) => a - b),
      sets: Array.from(setsForArray.keys()).sort((a, b) => a - b),
      lengthAtStart: yArray.length,
    });

    // 1) Handle Replaces first (canonical delete-then-insert at same index)
    handleReplaces(coordinator, yArray, replacesForArray, postQueue);
    coordinator.logger.trace("[arrayApply] after replaces", {
      len: yArray.length,
      json: toJSONSafe(yArray),
    });

    // 2) Handle Pure Deletes next (descending order to avoid index shifts)
    handleDeletes(coordinator.logger, yArray, deletesForArray);
    coordinator.logger.trace("[arrayApply] after deletes", {
      len: yArray.length,
      json: toJSONSafe(yArray),
    });

    // 3) Finally, handle Pure Inserts (sets)
    if (setsForArray.size > 0) {
      handleSets(
        coordinator,
        yArray,
        setsForArray,
        deletesForArray,
        lengthAtStart,
        postQueue,
      );
      coordinator.logger.trace("[arrayApply] after sets", {
        len: yArray.length,
        json: toJSONSafe(yArray),
      });
    }

    // Ensure the controller array proxy structure is fully reconciled after mixed operations
    // to materialize any deep children created during inserts/replaces.
    coordinator.requestArrayStructuralFinalize(
      yArray,
      postQueue,
      withReconcilingLock,
    );
  }
}

/**
 * Handle replace operations: delete + insert at same index (splice replace)
 */
function handleReplaces(
  coordinator: ValtioYjsCoordinator,
  yArray: Y.Array<unknown>,
  replaces: Map<number, PendingArrayEntry>,
  postQueue: PostTransactionQueue,
): void {
  if (replaces.size === 0) return;

  coordinator.logger.debug("[arrayApply] handling replaces", {
    count: replaces.size,
  });

  // Sort indices in descending order to avoid index shifting during deletions
  const sortedIndices = Array.from(replaces.keys()).sort((a, b) => b - a);

  for (const index of sortedIndices) {
    const entry = replaces.get(index)!;
    const yValue = plainObjectToYType(
      entry.value,
      coordinator.state,
      coordinator.logger,
    );

    coordinator.logger.debug("[arrayApply] replace", { index });

    // Canonical replace: delete then insert, with defensive clamping for safety under rapid mixed ops
    const inBounds = index >= 0 && index < yArray.length;
    if (inBounds) {
      yArray.delete(index, 1);
      const insertIndex = Math.min(Math.max(index, 0), yArray.length);
      yArray.insert(insertIndex, [yValue]);
    } else {
      const safeIndex = Math.max(0, Math.min(index, yArray.length));
      yArray.insert(safeIndex, [yValue]);
    }

    // Handle post-integration callbacks
    if (entry.after) {
      postQueue.enqueue(() => entry.after!(yValue));
    }

    // Note: Nested type reconciliation is handled by the final array reconciliation
    // which recursively reconciles all children (see end of applyArrayOperations)
  }
}

/**
 * Handle pure delete operations
 */
function handleDeletes(
  logger: Logger,
  yArray: Y.Array<unknown>,
  deletes: Map<number, number>,
): void {
  if (deletes.size === 0) return;

  logger.debug("[arrayApply] handling deletes", { count: deletes.size });

  // Sort indices in descending order to avoid index shifting issues
  const sortedDeletes = Array.from(deletes.keys()).sort((a, b) => b - a);

  for (const index of sortedDeletes) {
    logger.debug("[arrayApply] delete", { index, length: yArray.length });
    if (index >= 0 && index < yArray.length) {
      yArray.delete(index, 1);
    }
  }
}

/**
 * Handle pure set operations (inserts/pushes/unshifts)
 * Includes optimization for contiguous head/tail inserts
 */
function handleSets(
  coordinator: ValtioYjsCoordinator,
  yArray: Y.Array<unknown>,
  sets: Map<number, PendingArrayEntry>,
  deletes: Map<number, number>,
  lengthAtStart: number,
  postQueue: PostTransactionQueue,
): void {
  if (sets.size === 0) return;

  coordinator.logger.debug("[arrayApply] handling sets", { count: sets.size });

  // Try bulk optimization ONLY for pure inserts (no deletes in batch)
  // This is safe because:
  // 1. No deletes means no index shifting complexity
  // 2. tryOptimizedInserts checks for contiguous indices
  // 3. Only optimizes head (unshift) or tail (push) patterns
  if (
    deletes.size === 0 &&
    tryOptimizedInserts(coordinator, yArray, sets, postQueue)
  ) {
    coordinator.logger.debug("[arrayApply] bulk optimization applied", {
      count: sets.size,
      pattern: Array.from(sets.keys())[0] === 0 ? "head-insert" : "tail-insert",
    });
    return; // Successfully optimized
  }

  // Deterministic tail-cursor strategy for mixed batches
  // Rule: For each set at index i, if i >= lengthAtStart or i >= firstDeleteIndex,
  // treat as an append using a per-batch tail cursor that starts after replaces+deletes.
  // Otherwise, insert at clamped index.
  const sortedSetIndices = Array.from(sets.keys()).sort((a, b) => a - b);
  const firstDeleteIndex =
    deletes.size > 0
      ? Math.min(...Array.from(deletes.keys()))
      : Number.POSITIVE_INFINITY;
  // Initialize tail cursor to current array length (after replaces and deletes)
  // This cursor tracks where to append out-of-bounds items and increments as items are appended.
  // Rationale: Items that were originally out-of-bounds (index >= lengthAtStart) or affected
  // by deletes (index >= firstDeleteIndex) should append sequentially to maintain order.
  let tailCursor = yArray.length;

  for (const index of sortedSetIndices) {
    const entry = sets.get(index)!;
    const yValue = plainObjectToYType(
      entry.value,
      coordinator.state,
      coordinator.logger,
    );
    coordinator.logger.debug("apply.set.prepare", {
      index,
      hasId: hasProperty(entry.value, "id"),
      id: hasProperty(entry.value, "id") ? entry.value.id : undefined,
    });

    // Determine if this item should append to tail or insert in-place:
    // - index >= lengthAtStart: Item was originally out-of-bounds before this batch
    // - index >= firstDeleteIndex: Item is at/after first deletion (indices shifted)
    // - index >= yArray.length: Item is currently out-of-bounds (after previous inserts in this loop)
    // Note: yArray.length is evaluated BEFORE this iteration's insert, so each iteration
    // sees the updated length from previous iterations. This ensures correct sequential appends.
    const shouldAppend =
      index >= lengthAtStart ||
      index >= firstDeleteIndex ||
      index >= yArray.length;
    // For in-place inserts, clamp to valid range using CURRENT yArray.length
    // (which may have changed from previous inserts in this loop).
    // For appends, use the tail cursor which increments for each appended item.
    const targetIndex = shouldAppend
      ? tailCursor
      : Math.min(Math.max(index, 0), yArray.length);

    coordinator.logger.debug("[arrayApply] insert (tail-cursor strategy)", {
      requestedIndex: index,
      targetIndex,
      tailCursor,
      len: yArray.length,
      lengthAtStart,
      firstDeleteIndex: isFinite(firstDeleteIndex) ? firstDeleteIndex : null,
    });

    yArray.insert(targetIndex, [yValue]);
    const yValueId =
      typeof yValue === "object" &&
      yValue !== null &&
      "get" in yValue &&
      typeof yValue.get === "function"
        ? (yValue.get as (key: string) => unknown)("id")
        : undefined;
    coordinator.logger.debug("apply.set.inserted", {
      targetIndex,
      hasYId: yValueId !== undefined,
      id: yValueId,
    });
    if (shouldAppend) tailCursor++;

    if (entry.after) {
      postQueue.enqueue(() => entry.after!(yValue));
    }

    // Note: Nested type reconciliation is handled by the final array reconciliation
  }

  // Note: Final array reconciliation (at end of applyArrayOperations) handles
  // both out-of-bounds cleanup and nested type reconciliation
}

/**
 * Try to optimize contiguous head/tail inserts into single operations.
 *
 * This optimization batches multiple individual Y.Array inserts into a single
 * bulk insert operation, significantly improving performance for:
 * - Bulk push operations (tail inserts): proxy.push(...items)
 * - Bulk unshift operations (head inserts): proxy.unshift(...items)
 *
 * Only applies when:
 * - No deletes are present (deletes.size === 0)
 * - Indices are contiguous (no gaps)
 * - Pattern matches head (0..m-1) or tail (len..len+k-1)
 *
 * @returns true if optimization was applied, false if fallback is needed
 */
function tryOptimizedInserts(
  coordinator: ValtioYjsCoordinator,
  yArray: Y.Array<unknown>,
  sets: Map<number, PendingArrayEntry>,
  postQueue: PostTransactionQueue,
): boolean {
  const sortedSetIndices = Array.from(sets.keys()).sort((a, b) => a - b);
  const firstSetIndex = sortedSetIndices[0]!;
  const lastSetIndex = sortedSetIndices[sortedSetIndices.length - 1]!;
  const yLenAtStart = yArray.length;

  // Check if indices are contiguous
  const isContiguous =
    lastSetIndex - firstSetIndex + 1 === sortedSetIndices.length;

  if (!isContiguous) return false;

  // Head insert optimization: sets cover [0 .. m-1] → perform a single unshift insert
  // We rely on planner to only include truly new head items in `sets` for this case.
  if (firstSetIndex === 0) {
    const m = sortedSetIndices.length;
    if (m > 0) {
      const items: unknown[] = [];
      const entries: PendingArrayEntry[] = [];
      for (let i = 0; i < m; i++) {
        const entry = sets.get(i)!;
        entries.push(entry);
        items.push(
          plainObjectToYType(
            entry.value,
            coordinator.state,
            coordinator.logger,
          ),
        );
      }

      coordinator.logger.debug("[arrayApply] unshift.coalesce", {
        insertCount: items.length,
      });
      yArray.insert(0, items);

      // Handle post-integration callbacks
      items.forEach((it, i) => {
        const after = entries[i]?.after;
        if (after) postQueue.enqueue(() => after(it));
      });
      // Note: Nested type reconciliation is handled by final array reconciliation

      return true; // Successfully optimized
    }
  }

  // Tail insert optimization: sets cover [yLen .. yLen + k - 1] → push
  if (firstSetIndex === yLenAtStart) {
    const k = sortedSetIndices.length;
    if (k > 0) {
      const items: unknown[] = [];
      const entries: PendingArrayEntry[] = [];
      for (let i = 0; i < k; i++) {
        const idx = yLenAtStart + i;
        const entry = sets.get(idx)!;
        entries.push(entry);
        items.push(
          plainObjectToYType(
            entry.value,
            coordinator.state,
            coordinator.logger,
          ),
        );
      }

      coordinator.logger.debug("[arrayApply] push.coalesce", {
        insertCount: items.length,
      });
      yArray.insert(yArray.length, items);

      // Handle post-integration callbacks
      items.forEach((it, i) => {
        const after = entries[i]?.after;
        if (after) postQueue.enqueue(() => after(it));
      });
      // Note: Nested type reconciliation is handled by final array reconciliation

      return true; // Successfully optimized
    }
  }

  return false; // No optimization applied
}

// Helper to safely convert Y.Array to JSON for logging
function toJSONSafe(yArray: Y.Array<unknown>): unknown {
  return yTypeToJSON(yArray);
}
