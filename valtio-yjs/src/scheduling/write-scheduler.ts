import * as Y from 'yjs';
import type { PendingMapEntry, PendingArrayEntry } from './batch-types';
import type { Logger } from '../core/context';
import { VALTIO_YJS_ORIGIN } from '../core/constants';
import { PostTransactionQueue } from './post-transaction-queue';

/**
 * Recursively collects all Y.Map and Y.Array shared types in a subtree.
 * Used for purging stale operations when a parent is deleted/replaced.
 */
function collectYSubtree(root: unknown): { maps: Set<Y.Map<unknown>>; arrays: Set<Y.Array<unknown>> } {
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
  private readonly log: Logger;
  private readonly traceMode: boolean;
  
  // Write scheduler state
  private boundDoc: Y.Doc | null = null;
  private flushScheduled = false;
  
  // Pending ops, deduped per target and key/index
  private pendingMapSets = new Map<Y.Map<unknown>, Map<string, PendingMapEntry>>();
  private pendingMapDeletes = new Map<Y.Map<unknown>, Set<string>>();
  private pendingArraySets = new Map<Y.Array<unknown>, Map<number, PendingArrayEntry>>();
  private pendingArrayDeletes = new Map<Y.Array<unknown>, Set<number>>();
  private pendingArrayReplaces = new Map<Y.Array<unknown>, Map<number, PendingArrayEntry>>();

  // Callback functions for applying operations
  private applyMapDeletesFn: ((mapDeletes: Map<Y.Map<unknown>, Set<string>>) => void) | null = null;
  private applyMapSetsFn: ((mapSets: Map<Y.Map<unknown>, Map<string, PendingMapEntry>>, postQueue: PostTransactionQueue) => void) | null = null;
  private applyArrayOperationsFn: ((arraySets: Map<Y.Array<unknown>, Map<number, PendingArrayEntry>>, arrayDeletes: Map<Y.Array<unknown>, Set<number>>, arrayReplaces: Map<Y.Array<unknown>, Map<number, PendingArrayEntry>>, postQueue: PostTransactionQueue) => void) | null = null;
  private withReconcilingLockFn: ((fn: () => void) => void) | null = null;

  constructor(log: Logger, traceMode: boolean = false) {
    this.log = log;
    this.traceMode = traceMode;
  }

  bindDoc(doc: Y.Doc): void {
    this.boundDoc = doc;
  }

  // Set callback functions for applying operations
  setApplyFunctions(
    applyMapDeletes: (mapDeletes: Map<Y.Map<unknown>, Set<string>>) => void,
    applyMapSets: (mapSets: Map<Y.Map<unknown>, Map<string, PendingMapEntry>>, postQueue: PostTransactionQueue) => void,
    applyArrayOperations: (arraySets: Map<Y.Array<unknown>, Map<number, PendingArrayEntry>>, arrayDeletes: Map<Y.Array<unknown>, Set<number>>, arrayReplaces: Map<Y.Array<unknown>, Map<number, PendingArrayEntry>>, postQueue: PostTransactionQueue) => void,
    withReconcilingLock: (fn: () => void) => void,
  ): void {
    this.applyMapDeletesFn = applyMapDeletes;
    this.applyMapSetsFn = applyMapSets;
    this.applyArrayOperationsFn = applyArrayOperations;
    this.withReconcilingLockFn = withReconcilingLock;
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
    perArr.set(index, { value, after: postUpgrade });
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
    perArr.set(index, { value, after: postUpgrade });
    this.scheduleFlush();
  }

  enqueueArrayDelete(yArray: Y.Array<unknown>, index: number): void {
    let perArr = this.pendingArrayDeletes.get(yArray);
    if (!perArr) {
      perArr = new Set();
      this.pendingArrayDeletes.set(yArray, perArr);
    }
    perArr.add(index);
    this.scheduleFlush();
  }

  // Moves are not handled at the library level. Use app-level fractional indexing instead.

  private scheduleFlush(): void {
    if (this.flushScheduled) return;
    this.flushScheduled = true;
    this.log.debug('[scheduler] scheduleFlush');
    queueMicrotask(() => this.flush());
  }

  private flush(): void {
    this.flushScheduled = false;
    if (!this.boundDoc) return;
    const doc = this.boundDoc;
    this.log.debug('[scheduler] flush start');
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
    
    // Debug: log what we have before merging
    if (arraySets.size > 0 || arrayDeletes.size > 0 || arrayReplaces.size > 0) {
      this.log.debug('[scheduler] before merge:', {
        arraySets: Array.from(arraySets.entries()).map(([, m]) => Array.from(m.keys())),
        arrayDeletes: Array.from(arrayDeletes.entries()).map(([, s]) => Array.from(s)),
        arrayReplaces: Array.from(arrayReplaces.entries()).map(([, m]) => Array.from(m.keys())),
      });
    }
    
    // Merge array delete+set operations for the same index into replace operations
    // This handles the case where multiple Valtio operations in the same batch
    // generate conflicting operations for the same index
    for (const [yArray, deleteIndices] of arrayDeletes) {
      const setMap = arraySets.get(yArray);
      const replaceMap = arrayReplaces.get(yArray);
      
      // Merge any delete+set at same index into replace
      // Previous implementation was conservative (only if exactly one delete and one set),
      // but testing shows we can safely merge any matching pairs at same indices
      if (setMap) {
        for (const deleteIndex of Array.from(deleteIndices)) {
          if (setMap.has(deleteIndex)) {
            // Get or create the replace map for this array
            let replaceMapToUpdate = arrayReplaces.get(yArray);
            if (!replaceMapToUpdate) {
              replaceMapToUpdate = new Map();
              arrayReplaces.set(yArray, replaceMapToUpdate);
            }
            
            // Move the operations from delete+set to replace
            const setValue = setMap.get(deleteIndex)!;
            replaceMapToUpdate.set(deleteIndex, setValue);
            setMap.delete(deleteIndex);
            deleteIndices.delete(deleteIndex);
            
            this.log.debug('[scheduler] merging delete+set into replace', { index: deleteIndex });
          }
        }
        
        // Clean up empty set map
        if (setMap.size === 0) {
          arraySets.delete(yArray);
        }
      }
      
      // Check for delete+replace combinations - the replace wins, remove the delete
      if (replaceMap) {
        for (const deleteIndex of Array.from(deleteIndices)) {
          if (replaceMap.has(deleteIndex)) {
            deleteIndices.delete(deleteIndex);
            this.log.debug('[scheduler] removing redundant delete (replace exists)', { index: deleteIndex });
          }
        }
      }
      
      // Clean up empty delete set
      if (deleteIndices.size === 0) {
        arrayDeletes.delete(yArray);
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
        this.log.debug('[scheduler] Purged pending ops for replaced subtrees', purged);
      }
    }

    // Remove any sets that target indices also present in replaces for the same array
    for (const [yArray, replaceMap] of arrayReplaces) {
      const setMap = arraySets.get(yArray);
      if (!setMap) continue;
      for (const idx of replaceMap.keys()) {
        if (setMap.has(idx)) {
          setMap.delete(idx);
          this.log.debug('[scheduler] removing redundant set (replace exists)', { index: idx });
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
      for (const [yArray, deleteSet] of arrayDeletes) {
        for (const index of deleteSet) {
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
        this.log.debug('[scheduler] Purged pending ops for deleted subtrees', purged);
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
    if (this.traceMode) {
      this.log.debug('[scheduler] trace: planned intents for this flush', {
        mapSets: mapSets.size > 0 ? Array.from(mapSets.entries()).map(([yMap, keyMap]) => ({
          target: yMap.constructor.name,
          operations: Array.from(keyMap.keys())
        })) : [],
        mapDeletes: mapDeletes.size > 0 ? Array.from(mapDeletes.entries()).map(([yMap, keySet]) => ({
          target: yMap.constructor.name,
          operations: Array.from(keySet)
        })) : [],
        arraySets: arraySets.size > 0 ? Array.from(arraySets.entries()).map(([yArray, indexMap]) => ({
          target: yArray.constructor.name,
          operations: Array.from(indexMap.keys())
        })) : [],
        arrayDeletes: arrayDeletes.size > 0 ? Array.from(arrayDeletes.entries()).map(([yArray, indexSet]) => ({
          target: yArray.constructor.name,
          operations: Array.from(indexSet)
        })) : [],
        arrayReplaces: arrayReplaces.size > 0 ? Array.from(arrayReplaces.entries()).map(([yArray, indexMap]) => ({
          target: yArray.constructor.name,
          operations: Array.from(indexMap.keys())
        })) : []
      });
    }

    // Sibling purge heuristic removed in favor of precise descendant-only purging

    // DEBUG-TRACE: dump the exact batch about to be applied
    if (this.traceMode) {
      const mapDeletesLog = Array.from(mapDeletes.entries()).map(([yMap, keySet]) => ({
        targetId: (yMap as unknown as { _item?: { id?: { toString?: () => string } } })?._item?.id?.toString?.(),
        keys: Array.from(keySet),
      }));
      const mapSetsLog = Array.from(mapSets.entries()).map(([yMap, keyMap]) => ({
        targetId: (yMap as unknown as { _item?: { id?: { toString?: () => string } } })?._item?.id?.toString?.(),
        keys: Array.from(keyMap.keys()),
      }));
      const arrayDeletesLog = Array.from(arrayDeletes.entries()).map(([yArr, idxSet]) => ({
        targetId: (yArr as unknown as { _item?: { id?: { toString?: () => string } } })?._item?.id?.toString?.(),
        indices: Array.from(idxSet).sort((a, b) => a - b),
      }));
      const arraySetsLog = Array.from(arraySets.entries()).map(([yArr, idxMap]) => ({
        targetId: (yArr as unknown as { _item?: { id?: { toString?: () => string } } })?._item?.id?.toString?.(),
        indices: Array.from(idxMap.keys()).sort((a, b) => a - b),
      }));
      const arrayReplacesLog = Array.from(arrayReplaces.entries()).map(([yArr, idxMap]) => ({
        targetId: (yArr as unknown as { _item?: { id?: { toString?: () => string } } })?._item?.id?.toString?.(),
        indices: Array.from(idxMap.keys()).sort((a, b) => a - b),
      }));
      this.log.debug('Flushing transaction with operations:', {
        mapDeletes: mapDeletesLog,
        mapSets: mapSetsLog,
        arrayDeletes: arrayDeletesLog,
        arraySets: arraySetsLog,
        arrayReplaces: arrayReplacesLog,
      });
    }

    // Create post-transaction queue for callbacks
    const postQueue = new PostTransactionQueue(this.log);

    doc.transact(() => {
      if (this.applyMapDeletesFn) {
        this.applyMapDeletesFn(mapDeletes);
      }
      if (this.applyMapSetsFn) {
        this.applyMapSetsFn(mapSets, postQueue);
      }
      if (this.applyArrayOperationsFn) {
        this.applyArrayOperationsFn(arraySets, arrayDeletes, arrayReplaces, postQueue);
      }
    }, VALTIO_YJS_ORIGIN);

    // Flush post-transaction callbacks with reconciling lock
    if (this.withReconcilingLockFn) {
      postQueue.flush(this.withReconcilingLockFn);
    } else {
      postQueue.flush((fn) => fn());
    }
  }
}
