import * as Y from "yjs";
import type { PendingMapEntry, PendingArrayEntry } from "./batch-types";
import type { Logger } from "../core/logger";
import { VALTIO_Y_ORIGIN } from "../core/constants";
import { PostTransactionQueue } from "./post-transaction-queue";
import { ValtioYTransactionError } from "../core/errors";

/**
 * Apply functions that WriteScheduler delegates to.
 * Injected at construction via dependency injection - no setter injection needed.
 */
export interface ApplyFunctions {
  applyMapDeletes: (mapDeletes: Map<Y.Map<unknown>, Set<string>>) => void;
  applyMapSets: (
    mapSets: Map<Y.Map<unknown>, Map<string, PendingMapEntry>>,
    postQueue: PostTransactionQueue,
    withReconcilingLock: (fn: () => void) => void,
  ) => void;
  applyArrayOperations: (
    arraySets: Map<Y.Array<unknown>, Map<number, PendingArrayEntry>>,
    arrayDeletes: Map<Y.Array<unknown>, Map<number, number>>,
    arrayReplaces: Map<Y.Array<unknown>, Map<number, PendingArrayEntry>>,
    postQueue: PostTransactionQueue,
    withReconcilingLock: (fn: () => void) => void,
  ) => void;
  withReconcilingLock: (fn: () => void) => void;
}

/**
 * Recursively collects all Y.Map and Y.Array shared types in a subtree.
 * Used for purging stale operations when a parent is deleted/replaced.
 */
function collectYSubtree(root: unknown): {
  maps: Set<Y.Map<unknown>>;
  arrays: Set<Y.Array<unknown>>;
} {
  const maps = new Set<Y.Map<unknown>>();
  const arrays = new Set<Y.Array<unknown>>();

  const recurse = (node: unknown): void => {
    if (node instanceof Y.Map) {
      maps.add(node);
      for (const [, v] of node.entries()) recurse(v);
    } else if (node instanceof Y.Array) {
      arrays.add(node);
      for (const v of node.toArray()) recurse(v);
    }
  };

  recurse(root);
  return { maps, arrays };
}

export class WriteScheduler {
  private readonly doc: Y.Doc;
  private readonly log: Logger;
  private readonly applyFunctions: ApplyFunctions;

  // Write scheduler state
  private flushScheduled = false;
  private operationSequence = 0; // Global sequence counter for temporal ordering

  // Pending ops, deduped per target and key/index
  private pendingMapSets = new Map<
    Y.Map<unknown>,
    Map<string, PendingMapEntry>
  >();
  private pendingMapDeletes = new Map<Y.Map<unknown>, Set<string>>();
  private pendingArraySets = new Map<
    Y.Array<unknown>,
    Map<number, PendingArrayEntry>
  >();
  private pendingArrayDeletes = new Map<
    Y.Array<unknown>,
    Map<number, number>
  >();
  private pendingArrayReplaces = new Map<
    Y.Array<unknown>,
    Map<number, PendingArrayEntry>
  >();

  /**
   * Constructor injection - all dependencies provided upfront.
   * No incomplete initialization possible - WriteScheduler is ready to use immediately.
   *
   * @param doc - Y.Doc instance for transactions
   * @param log - Logger instance for debug and trace output
   * @param applyFunctions - Callbacks for applying batched operations
   */
  constructor(doc: Y.Doc, log: Logger, applyFunctions: ApplyFunctions) {
    this.doc = doc;
    this.log = log;
    this.applyFunctions = applyFunctions;
  }

  // Enqueue operations
  enqueueMapSet(
    yMap: Y.Map<unknown>,
    key: string,
    value: unknown,
    postUpgrade?: (yValue: unknown) => void,
  ): void {
    let perMap = this.pendingMapSets.get(yMap);
    if (!perMap) {
      perMap = new Map();
      this.pendingMapSets.set(yMap, perMap);
    }
    perMap.set(key, { value, after: postUpgrade });
    // ensure delete is overridden by set
    const delSet = this.pendingMapDeletes.get(yMap);
    if (delSet) delSet.delete(key);
    this.scheduleFlush();
  }

  enqueueMapDelete(yMap: Y.Map<unknown>, key: string): void {
    let perMap = this.pendingMapDeletes.get(yMap);
    if (!perMap) {
      perMap = new Set();
      this.pendingMapDeletes.set(yMap, perMap);
    }
    perMap.add(key);
    // delete overrides any pending set
    const setMap = this.pendingMapSets.get(yMap);
    if (setMap) setMap.delete(key);
    this.scheduleFlush();
  }

  enqueueArraySet(
    yArray: Y.Array<unknown>,
    index: number,
    value: unknown,
    postUpgrade?: (yValue: unknown) => void,
  ): void {
    let perArr = this.pendingArraySets.get(yArray);
    if (!perArr) {
      perArr = new Map();
      this.pendingArraySets.set(yArray, perArr);
    }
    const seq = this.operationSequence++;
    perArr.set(index, { value, after: postUpgrade, sequence: seq });

    this.scheduleFlush();
  }

  enqueueArrayReplace(
    yArray: Y.Array<unknown>,
    index: number,
    value: unknown,
    postUpgrade?: (yValue: unknown) => void,
  ): void {
    let perArr = this.pendingArrayReplaces.get(yArray);
    if (!perArr) {
      perArr = new Map();
      this.pendingArrayReplaces.set(yArray, perArr);
    }
    perArr.set(index, {
      value,
      after: postUpgrade,
      sequence: this.operationSequence++,
    });

    this.scheduleFlush();
  }

  enqueueArrayDelete(yArray: Y.Array<unknown>, index: number): void {
    let perArr = this.pendingArrayDeletes.get(yArray);
    if (!perArr) {
      perArr = new Map();
      this.pendingArrayDeletes.set(yArray, perArr);
    }
    const seq = this.operationSequence++;
    perArr.set(index, seq);

    // Note: Cancellation logic removed. Merge/cancel decisions now happen at flush time
    // based on temporal ordering (sequence numbers). This provides correct semantics for:
    // - Push+pop: set[i] @T1, delete[i] @T2 → cancel both
    // - Splice: delete[i] @T1, set[i] @T2 → merge to replace[i]

    this.scheduleFlush();
  }

  // Moves are not handled at the library level. Use app-level fractional indexing instead.

  /**
   * Merge array operations based on temporal ordering.
   * This implements the correct semantics for:
   * - Push+pop: set[i] @T1, delete[i] @T2 → cancel both
   * - Splice: delete[i] @T1, set[i] @T2 → merge to replace[i]
   * - Delete+Replace: delete[i] @T1, replace[i] @T2 → keep replace (delete is redundant)
   */
  private mergeArrayOperations(
    arraySets: Map<Y.Array<unknown>, Map<number, PendingArrayEntry>>,
    arrayDeletes: Map<Y.Array<unknown>, Map<number, number>>,
    arrayReplaces: Map<Y.Array<unknown>, Map<number, PendingArrayEntry>>,
  ): void {
    for (const [yArray, deleteMap] of arrayDeletes) {
      // Handle DELETE + SET at same index
      const setMap = arraySets.get(yArray);
      if (setMap) {
        for (const [index, deleteSeq] of Array.from(deleteMap.entries())) {
          const setEntry = setMap.get(index);
          if (setEntry) {
            if (setEntry.sequence < deleteSeq) {
              // Set came before delete: push+pop pattern → cancel both
              this.log.debug("[merge] cancelling push+pop pattern", {
                index,
                setSeq: setEntry.sequence,
                deleteSeq,
              });
              setMap.delete(index);
              deleteMap.delete(index);
            } else {
              // Delete came before set: splice pattern → merge to replace
              this.log.debug("[merge] merging splice pattern to replace", {
                index,
                deleteSeq,
                setSeq: setEntry.sequence,
              });
              const replaceMap = arrayReplaces.get(yArray);
              if (!replaceMap) {
                const newReplaceMap = new Map<number, PendingArrayEntry>();
                newReplaceMap.set(index, setEntry);
                arrayReplaces.set(yArray, newReplaceMap);
              } else {
                replaceMap.set(index, setEntry);
              }
              setMap.delete(index);
              deleteMap.delete(index);
            }
          }
        }
      }

      // Handle DELETE + REPLACE at same index
      // When we have delete[i] @T1 and replace[i] @T2, the replace already includes
      // the delete semantics, so we just remove the redundant delete
      const replaceMap = arrayReplaces.get(yArray);
      if (replaceMap) {
        for (const [index, deleteSeq] of Array.from(deleteMap.entries())) {
          const replaceEntry = replaceMap.get(index);
          if (replaceEntry) {
            // Delete + Replace at same index → keep replace, remove delete
            // The replace operation already does delete+insert
            this.log.debug(
              "[merge] removing redundant delete (replace exists)",
              { index, deleteSeq, replaceSeq: replaceEntry.sequence },
            );
            deleteMap.delete(index);
          }
        }
      }

      // Clean up empty maps
      if (setMap && setMap.size === 0) {
        arraySets.delete(yArray);
      }
      if (deleteMap.size === 0) {
        arrayDeletes.delete(yArray);
      }
    }

    // Handle SET + REPLACE conflicts at same index
    // The later operation wins based on temporal ordering
    for (const [yArray, setMap] of arraySets) {
      const replaceMap = arrayReplaces.get(yArray);
      if (replaceMap) {
        for (const [index, setEntry] of Array.from(setMap.entries())) {
          const replaceEntry = replaceMap.get(index);
          if (replaceEntry) {
            if (setEntry.sequence < replaceEntry.sequence) {
              // Set came before replace: replace wins
              this.log.debug("[merge] replace overrides earlier set", {
                index,
                setSeq: setEntry.sequence,
                replaceSeq: replaceEntry.sequence,
              });
              setMap.delete(index);
            } else {
              // Replace came before set: set wins
              this.log.debug("[merge] set overrides earlier replace", {
                index,
                replaceSeq: replaceEntry.sequence,
                setSeq: setEntry.sequence,
              });
              replaceMap.delete(index);
            }
          }
        }
      }

      // Clean up empty maps
      if (setMap.size === 0) {
        arraySets.delete(yArray);
      }
    }

    // Clean up empty replace maps
    for (const [yArray, replaceMap] of arrayReplaces) {
      if (replaceMap.size === 0) {
        arrayReplaces.delete(yArray);
      }
    }
  }

  private scheduleFlush(): void {
    if (this.flushScheduled) return;
    this.flushScheduled = true;
    this.log.debug("[scheduler] scheduleFlush");
    queueMicrotask(() => this.flush());
  }

  private flush(): void {
    this.flushScheduled = false;
    const doc = this.doc;
    this.log.debug("[scheduler] flush start");
    // Snapshot pending and clear before running to avoid re-entrancy issues
    const mapSets = this.pendingMapSets;
    const mapDeletes = this.pendingMapDeletes;
    const arraySets = this.pendingArraySets;
    const arrayDeletes = this.pendingArrayDeletes;
    const arrayReplaces = this.pendingArrayReplaces;
    this.pendingMapSets = new Map();
    this.pendingMapDeletes = new Map();
    this.pendingArraySets = new Map();
    this.pendingArrayDeletes = new Map();
    this.pendingArrayReplaces = new Map();

    // Merge operations based on temporal ordering
    this.mergeArrayOperations(arraySets, arrayDeletes, arrayReplaces);

    // Demote out-of-bounds replaces to sets
    // This handles the case where operations like push+pop create "replaces" via delete+set merging,
    // but the Y.Array is shorter than the replace indices would require
    for (const [yArray, replaceMap] of arrayReplaces) {
      for (const [index, entry] of Array.from(replaceMap.entries())) {
        if (index >= yArray.length) {
          // Out of bounds - demote to set
          this.log.debug("[demotion] out-of-bounds replace demoted to set", {
            index,
            yArrayLength: yArray.length,
          });
          let setMap = arraySets.get(yArray);
          if (!setMap) {
            setMap = new Map();
            arraySets.set(yArray, setMap);
          }
          setMap.set(index, entry);
          replaceMap.delete(index);
        }
      }
      // Clean up empty replace map
      if (replaceMap.size === 0) {
        arrayReplaces.delete(yArray);
      }
    }

    // Purge stale operations targeting children of items that will be replaced in this flush
    // This ensures we don't try to mutate a subtree after its parent is deleted/replaced in the same transaction
    if (arrayReplaces.size > 0) {
      const purged = { maps: 0, arrays: 0 };
      for (const [yArray, replaceMap] of arrayReplaces) {
        for (const index of replaceMap.keys()) {
          if (index >= 0 && index < yArray.length) {
            const oldItem = yArray.get(index) as unknown;
            const { maps, arrays } = collectYSubtree(oldItem);

            // Purge map operations targeting this subtree
            for (const yMap of maps) {
              if (this.pendingMapSets.delete(yMap)) purged.maps++;
              if (this.pendingMapDeletes.delete(yMap)) purged.maps++;
              // Also remove from the snapshotted maps that will be applied this flush
              if (mapSets.delete(yMap)) purged.maps++;
              if (mapDeletes.delete(yMap)) purged.maps++;
            }
            // Purge array operations targeting this subtree
            for (const arr of arrays) {
              if (this.pendingArraySets.delete(arr)) purged.arrays++;
              if (this.pendingArrayDeletes.delete(arr)) purged.arrays++;
              if (this.pendingArrayReplaces.delete(arr)) purged.arrays++;
              if (arraySets.delete(arr)) purged.arrays++;
              if (arrayDeletes.delete(arr)) purged.arrays++;
              if (arrayReplaces.delete(arr)) purged.arrays++;
            }
          }
        }
      }
      if (purged.maps > 0 || purged.arrays > 0) {
        this.log.debug(
          "[scheduler] Purged pending ops for replaced subtrees",
          purged,
        );
      }
    }

    // Remove any sets that target indices also present in replaces for the same array
    for (const [yArray, replaceMap] of arrayReplaces) {
      const setMap = arraySets.get(yArray);
      if (!setMap) continue;
      for (const idx of replaceMap.keys()) {
        if (setMap.has(idx)) {
          setMap.delete(idx);
          this.log.debug(
            "[scheduler] removing redundant set (replace exists)",
            { index: idx },
          );
        }
      }
      if (setMap.size === 0) {
        arraySets.delete(yArray);
      }
    }

    // Note: Avoid post-merge demotion of replaces to sets here.
    // Planner already applies nuanced demotion using previous-value context.
    // Doing it here can duplicate shifted items.

    // Purge stale operations targeting children of items that will be deleted in this flush
    if (arrayDeletes.size > 0) {
      const purged = { maps: 0, arrays: 0 };
      for (const [yArray, deleteMap] of arrayDeletes) {
        for (const index of deleteMap.keys()) {
          if (index >= 0 && index < yArray.length) {
            const oldItem = yArray.get(index) as unknown;
            const { maps, arrays } = collectYSubtree(oldItem);
            for (const yMap of maps) {
              if (this.pendingMapSets.delete(yMap)) purged.maps++;
              if (this.pendingMapDeletes.delete(yMap)) purged.maps++;
              if (mapSets.delete(yMap)) purged.maps++;
              if (mapDeletes.delete(yMap)) purged.maps++;
            }
            for (const arr of arrays) {
              if (this.pendingArraySets.delete(arr)) purged.arrays++;
              if (this.pendingArrayDeletes.delete(arr)) purged.arrays++;
              if (this.pendingArrayReplaces.delete(arr)) purged.arrays++;
              if (arraySets.delete(arr)) purged.arrays++;
              if (arrayDeletes.delete(arr)) purged.arrays++;
              if (arrayReplaces.delete(arr)) purged.arrays++;
            }
          }
        }
      }
      if (purged.maps > 0 || purged.arrays > 0) {
        this.log.debug(
          "[scheduler] Purged pending ops for deleted subtrees",
          purged,
        );
      }
    }

    if (
      mapSets.size === 0 &&
      mapDeletes.size === 0 &&
      arraySets.size === 0 &&
      arrayDeletes.size === 0 &&
      arrayReplaces.size === 0
    ) {
      return;
    }

    // Trace mode: log planned intents for debugging
    this.log.trace("[scheduler] planned intents for this flush", {
      mapSets:
        mapSets.size > 0
          ? Array.from(mapSets.entries()).map(([yMap, keyMap]) => ({
              target: yMap.constructor.name,
              operations: Array.from(keyMap.keys()),
            }))
          : [],
      mapDeletes:
        mapDeletes.size > 0
          ? Array.from(mapDeletes.entries()).map(([yMap, keySet]) => ({
              target: yMap.constructor.name,
              operations: Array.from(keySet),
            }))
          : [],
      arraySets:
        arraySets.size > 0
          ? Array.from(arraySets.entries()).map(([yArray, indexMap]) => ({
              target: yArray.constructor.name,
              operations: Array.from(indexMap.keys()),
            }))
          : [],
      arrayDeletes:
        arrayDeletes.size > 0
          ? Array.from(arrayDeletes.entries()).map(([yArray, indexMap]) => ({
              target: yArray.constructor.name,
              operations: Array.from(indexMap.keys()),
            }))
          : [],
      arrayReplaces:
        arrayReplaces.size > 0
          ? Array.from(arrayReplaces.entries()).map(([yArray, indexMap]) => ({
              target: yArray.constructor.name,
              operations: Array.from(indexMap.keys()),
            }))
          : [],
    });

    // Sibling purge heuristic removed in favor of precise descendant-only purging

    // DEBUG-TRACE: dump the exact batch about to be applied
    const mapDeletesLog = Array.from(mapDeletes.entries()).map(
      ([yMap, keySet]) => ({
        targetId: (
          yMap as unknown as { _item?: { id?: { toString?: () => string } } }
        )?._item?.id?.toString?.(),
        keys: Array.from(keySet),
      }),
    );
    const mapSetsLog = Array.from(mapSets.entries()).map(([yMap, keyMap]) => ({
      targetId: (
        yMap as unknown as { _item?: { id?: { toString?: () => string } } }
      )?._item?.id?.toString?.(),
      keys: Array.from(keyMap.keys()),
    }));
    const arrayDeletesLog = Array.from(arrayDeletes.entries()).map(
      ([yArr, idxMap]) => ({
        targetId: (
          yArr as unknown as { _item?: { id?: { toString?: () => string } } }
        )?._item?.id?.toString?.(),
        indices: Array.from(idxMap.keys()).sort((a, b) => a - b),
      }),
    );
    const arraySetsLog = Array.from(arraySets.entries()).map(
      ([yArr, idxMap]) => ({
        targetId: (
          yArr as unknown as { _item?: { id?: { toString?: () => string } } }
        )?._item?.id?.toString?.(),
        indices: Array.from(idxMap.keys()).sort((a, b) => a - b),
      }),
    );
    const arrayReplacesLog = Array.from(arrayReplaces.entries()).map(
      ([yArr, idxMap]) => ({
        targetId: (
          yArr as unknown as { _item?: { id?: { toString?: () => string } } }
        )?._item?.id?.toString?.(),
        indices: Array.from(idxMap.keys()).sort((a, b) => a - b),
      }),
    );
    this.log.trace("[scheduler] flushing transaction", {
      mapDeletes: mapDeletesLog,
      mapSets: mapSetsLog,
      arrayDeletes: arrayDeletesLog,
      arraySets: arraySetsLog,
      arrayReplaces: arrayReplacesLog,
    });

    // Create post-transaction queue for callbacks
    const postQueue = new PostTransactionQueue(this.log);

    doc.transact(() => {
      // Apply operations with error context for debugging
      try {
        this.applyFunctions.applyMapDeletes(mapDeletes);
      } catch (err) {
        this.log.error("[scheduler] Error applying map deletes", {
          error: err,
          mapCount: mapDeletes.size,
        });
        throw new ValtioYTransactionError(
          "Failed to apply map delete operations",
          "map-deletes",
          err,
        );
      }

      try {
        this.applyFunctions.applyMapSets(
          mapSets,
          postQueue,
          this.applyFunctions.withReconcilingLock,
        );
      } catch (err) {
        this.log.error("[scheduler] Error applying map sets", {
          error: err,
          mapCount: mapSets.size,
        });
        throw new ValtioYTransactionError(
          "Failed to apply map set operations",
          "map-sets",
          err,
        );
      }

      try {
        this.applyFunctions.applyArrayOperations(
          arraySets,
          arrayDeletes,
          arrayReplaces,
          postQueue,
          this.applyFunctions.withReconcilingLock,
        );
      } catch (err) {
        this.log.error("[scheduler] Error applying array operations", {
          error: err,
          setSets: arraySets.size,
          deletes: arrayDeletes.size,
          replaces: arrayReplaces.size,
        });
        throw new ValtioYTransactionError(
          "Failed to apply array operations",
          "array-operations",
          err,
        );
      }
    }, VALTIO_Y_ORIGIN);

    // Flush post-transaction callbacks with reconciling lock
    postQueue.flush(this.applyFunctions.withReconcilingLock);
  }
}
