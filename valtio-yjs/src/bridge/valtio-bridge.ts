// Bridge/Router layer
//
// Responsibility:
// - Materialize real Valtio proxies for Yjs shared types (currently Y.Map).
// - Maintain stable identity via caches (Y type <-> Valtio proxy) inside a context.
// - Reflect local Valtio writes back to Yjs minimally (set/delete) inside
//   transactions tagged with VALTIO_YJS_ORIGIN.
// - Lazily create nested controllers when a Y value is another Y type.
import * as Y from 'yjs';
import { proxy, subscribe, ref } from 'valtio/vanilla';
// import removed: origin tagging handled by context scheduler

import type { YSharedContainer, YLeafType } from '../core/yjs-types';
import { SynchronizationContext } from '../core/context';
import { isYSharedContainer, isYMap, isYLeafType } from '../core/guards';
import { planMapOps } from '../planning/map-ops-planner';
import { planArrayOps } from '../planning/array-ops-planner';
import { validateDeepForSharedState } from '../core/converter';
import { setupLeafNodeAsComputed, setupLeafNodeAsComputedInArray } from './leaf-computed';
import { safeStringify } from '../utils/logging';
import { normalizeIndex } from '../utils/index-utils';
import {
  getContainerValue,
  setContainerValue,
  isRawSetMapOp,
  isRawSetArrayOp,
  type RawValtioOperation,
} from '../core/types';


// All caches are moved into SynchronizationContext

// Helper: Upgrade a child value (leaf or container) in the parent proxy
function upgradeChildIfNeeded(
  context: SynchronizationContext,
  container: Record<string, unknown> | unknown[],
  key: string | number,
  yValue: unknown,
  doc: Y.Doc,
): void {
  const current = getContainerValue(container, key);
  // Optimize: single WeakMap lookup instead of .has() + potential .get()
  const underlyingYType = current && typeof current === 'object' ? context.valtioProxyToYType.get(current as object) : undefined;
  const isAlreadyController = underlyingYType !== undefined;
  
  // Check leaf types first (before container check) since some leaf types extend containers
  // (e.g., Y.XmlHook extends Y.Map)
  if (isYLeafType(yValue)) {
    // Leaf node: use computed property approach for reactivity
    // Type assertion is safe here because isYLeafType guard confirmed the type
    const leafNode = yValue as YLeafType;
    // Setup reactivity based on container type
    if (Array.isArray(container)) {
      setupLeafNodeAsComputedInArray(context, container, key as number, leafNode);
    } else {
      setupLeafNodeAsComputed(context, container as Record<string | symbol, unknown>, key as string, leafNode);
    }
  } else if (!isAlreadyController && isYSharedContainer(yValue)) {
    // Upgrade plain object/array to container controller
    const newController = getOrCreateValtioProxy(context, yValue, doc);
    context.withReconcilingLock(() => {
      setContainerValue(container, key, newController);
    });
  }
}

// Helper: Filter out internal/nested operations from Valtio map operations
function filterMapOperations(ops: unknown[]): unknown[] {
  return ops.filter((op) => {
    const rawOp = op as RawValtioOperation;
    if (isRawSetMapOp(rawOp)) {
      const path = rawOp[1] as (string | number)[];
      // If path has more than 1 element, it's a nested property change
      // Only allow top-level changes (path.length === 1)
      if (path.length !== 1) {
        return false;
      }
      // Filter out internal valtio-yjs properties (version counter, leaf storage)
      const key = String(path[0]);
      if (key.startsWith('__valtio_yjs_')) {
        return false;
      }
    }
    return true; // Keep delete ops and other operations
  });
}

// Helper: Rollback array proxy to previous state on validation failure
function rollbackArrayChanges(
  context: SynchronizationContext,
  arrProxy: unknown[],
  ops: RawValtioOperation[],
): void {
  context.withReconcilingLock(() => {
    for (const op of ops) {
      if (isRawSetArrayOp(op)) {
        const idx = op[1][0];
        const index = normalizeIndex(idx);
        const prev = op[3];
        arrProxy[index] = prev;
      }
    }
  });
}

// Helper: Rollback map proxy to previous state on validation failure
function rollbackMapChanges(
  context: SynchronizationContext,
  objProxy: Record<string, unknown>,
  ops: RawValtioOperation[],
): void {
  context.withReconcilingLock(() => {
    for (const op of ops) {
      if (isRawSetMapOp(op)) {
        const key = op[1][0];
        const prev = op[3];
        if (prev === undefined) {
          // Key didn't exist before, delete it
          delete objProxy[key];
        } else {
          // Restore previous value
          objProxy[key] = prev;
        }
      }
    }
  });
}


// Subscribe to a Valtio array proxy and translate top-level index operations
// into minimal Y.Array operations.
// Valtio -> Yjs (array):
// - Only translate top-level index operations here. Nested edits are handled by
//   the nested controller's own subscription once a child has been upgraded to
//   a live controller proxy.
// - If a plain object/array is assigned, we eagerly upgrade it: create a Y type
//   and immediately replace the plain value in the Valtio proxy with a
//   controller under a reconciliation lock to avoid reflection loops.
function attachValtioArraySubscription(
  context: SynchronizationContext,
  yArray: Y.Array<unknown>,
  arrProxy: unknown[],
  _doc: Y.Doc,
): () => void {
  const unsubscribe = subscribe(arrProxy, (ops: unknown[]) => {
    if (context.isReconciling) return;
    context.log.debug('[controller][array] ops', safeStringify(ops));
    
    // Wrap planning + enqueue in try/catch to rollback local proxy on validation failure
    try {
      // Phase 1: Planning - categorize operations into explicit intents
      // Use Y.Array length as the start-of-batch baseline for deterministic planning
      const { sets, deletes, replaces } = planArrayOps(ops, yArray.length, context);
      context.log.debug('Controller plan (array):', {
        replaces: Array.from(replaces.keys()).sort((a, b) => a - b),
        deletes: Array.from(deletes.values()).sort((a, b) => a - b),
        sets: Array.from(sets.keys()).sort((a, b) => a - b),
        yLength: yArray.length,
      });
      
      // Phase 2: Scheduling - enqueue planned operations
      
      // Handle replaces first (splice replace operations: delete + set at same index)
      for (const [index, value] of replaces) {
        context.log.debug('[controller][array] enqueue.replace', { index });
        const normalized = value === undefined ? null : value;
        // Validate synchronously before enqueuing (deep)
        validateDeepForSharedState(normalized);
        context.enqueueArrayReplace(
          yArray,
          index,
          normalized, // Normalize undefined→null defensively
          (yValue: unknown) => upgradeChildIfNeeded(context, arrProxy, index, yValue, _doc),
        );
      }
      
      // Handle pure deletes
      for (const index of deletes) {
        context.log.debug('[controller][array] enqueue.delete', { index });
        context.enqueueArrayDelete(yArray, index);
      }
      
      // Handle pure sets (inserts/pushes/unshifts).
      for (const [index, value] of sets) {
        const normalized = value === undefined ? null : value;
        // Validate synchronously before enqueuing (deep validation to catch nested undefined)
        validateDeepForSharedState(normalized);
        context.log.debug('[controller][array] enqueue.set', {
          index,
          hasId: !!((normalized as { id?: unknown } | null)?.id),
          id: (normalized as { id?: unknown } | null)?.id,
        });
        context.enqueueArraySet(
          yArray,
          index,
          normalized, // Normalize undefined→null defensively
          (yValue: unknown) => upgradeChildIfNeeded(context, arrProxy, index, yValue, _doc),
        );
      }
    } catch (err) {
      // Rollback local proxy to previous values using ops metadata
      rollbackArrayChanges(context, arrProxy, ops as RawValtioOperation[]);
      throw err;
    }
  }, true);
  return unsubscribe;
}

// Subscribe to a Valtio object proxy and translate top-level key operations
// into minimal Y.Map operations. Nested edits are handled by nested controllers.
// Valtio -> Yjs (map):
// - Only handle direct children (path.length === 1). No nested routing here; once
//   a child is upgraded to a controller, its own subscription translates nested edits.
// - Eagerly upgrade assigned plain objects/arrays into Y types and replace the plain
//   values with controller proxies under a reconciliation lock to avoid loops.
function attachValtioMapSubscription(
  context: SynchronizationContext,
  yMap: Y.Map<unknown>,
  objProxy: Record<string, unknown>,
  doc: Y.Doc,
): () => void {
  const unsubscribe = subscribe(objProxy, (ops: unknown[]) => {
    if (context.isReconciling) return;
    
    // Filter out operations on internal properties
    // 1. Filter out nested Y.js internal property changes (path.length > 1)
    // 2. Filter out valtio-yjs internal properties (__valtio_yjs_*)
    const filteredOps = filterMapOperations(ops);
    
    if (filteredOps.length === 0) {
      // All ops were filtered out (all were nested Y.js internal changes)
      return;
    }
    
    context.log.debug('[controller][map] ops (filtered)', safeStringify(filteredOps));
    
    // Wrap planning + enqueue in try/catch to rollback local proxy on validation failure
    try {
      // Phase 1: Planning - categorize operations
      const { sets, deletes } = planMapOps(filteredOps);
      
      // Phase 2: Scheduling - enqueue planned operations
      for (const [key, value] of sets) {
        const normalized = value === undefined ? null : value;
        // Validate synchronously before enqueuing (deep validation to catch nested issues)
        validateDeepForSharedState(normalized);
        context.enqueueMapSet(
          yMap,
          key,
          normalized, // Normalize undefined→null defensively
          (yValue: unknown) => upgradeChildIfNeeded(context, objProxy, key, yValue, doc),
        );
      }
      
      for (const key of deletes) {
        context.enqueueMapDelete(yMap, key);
      }
    } catch (err) {
      // Rollback local proxy to previous values using ops metadata
      rollbackMapChanges(context, objProxy, filteredOps as RawValtioOperation[]);
      throw err;
    }
  }, true);
  return unsubscribe;
}

// Helper: Process Y.Map entries and categorize them
function processYMapEntries(
  context: SynchronizationContext,
  yMap: Y.Map<unknown>,
  doc: Y.Doc,
): {
  initialObj: Record<string, unknown>;
  leafNodesToSetup: Array<[string, YLeafType]>;
} {
  const initialObj: Record<string, unknown> = {};
  const leafNodesToSetup: Array<[string, YLeafType]> = [];
  
  for (const [key, value] of yMap.entries()) {
    // Check leaf types first (before container check) since some leaf types extend containers
    // (e.g., Y.XmlHook extends Y.Map)
    if (isYLeafType(value)) {
      // Leaf nodes: we'll setup computed properties AFTER creating the proxy
      leafNodesToSetup.push([key, value as YLeafType]);
    } else if (isYSharedContainer(value)) {
      // Containers: create controller proxy recursively
      initialObj[key] = getOrCreateValtioProxy(context, value, doc);
    } else {
      // Primitives: store as-is
      initialObj[key] = value;
    }
  }
  
  return { initialObj, leafNodesToSetup };
}

// Helper: Define computed property for a leaf node on a map proxy
function defineLeafPropertyOnMap(
  objProxy: Record<string, unknown>,
  key: string,
  leafNode: YLeafType,
  versionKey: string,
): void {
  // Store the ref'd leaf in a hidden string property
  const storageKey = `__valtio_yjs_leaf_${key}`;
  objProxy[storageKey] = ref(leafNode);
  
  // Define the computed property ON THE PROXY (after proxy creation)
  Object.defineProperty(objProxy, key, {
    get() {
      // Touch the version counter - this creates a Valtio dependency
      void (this as unknown as Record<string, unknown>)[versionKey];
      // Return the stored leaf node
      return (this as unknown as Record<string, unknown>)[storageKey];
    },
    enumerable: true,
    configurable: true,
  });
}

// Helper: Setup Y.js observer for leaf node in map
function setupLeafObserverForMap(
  context: SynchronizationContext,
  objProxy: Record<string, unknown>,
  key: string,
  leafNode: YLeafType,
  versionKey: string,
): void {
  const handler = () => {
    const currentVersion = objProxy[versionKey] as number;
    objProxy[versionKey] = currentVersion + 1;
  };
  
  leafNode.observe(handler);
  context.registerDisposable(() => {
    leafNode.unobserve(handler);
  });
  
  context.log.debug('[leaf-computed] setup complete', {
    key,
    type: leafNode.constructor.name,
  });
}

// Create (or reuse from cache) a Valtio proxy that mirrors a Y.Map.
// Nested Y types are recursively materialized via getOrCreateValtioProxy.
function getOrCreateValtioProxyForYMap(context: SynchronizationContext, yMap: Y.Map<unknown>, doc: Y.Doc): object {
  const existing = context.yTypeToValtioProxy.get(yMap);
  if (existing) return existing;

  const versionKey = '__valtio_yjs_version';
  const { initialObj, leafNodesToSetup } = processYMapEntries(context, yMap, doc);
  
  // Initialize version counter BEFORE creating proxy
  if (leafNodesToSetup.length > 0) {
    initialObj[versionKey] = 0;
  }
  
  // Create the proxy FIRST (with regular properties only)
  const objProxy = proxy(initialObj) as Record<string, unknown>;
  
  // NOW setup computed properties AFTER proxy creation
  for (const [key, leafNode] of leafNodesToSetup) {
    defineLeafPropertyOnMap(objProxy, key, leafNode, versionKey);
  }

  // Setup Y.js observers AFTER proxy creation
  for (const [key, leafNode] of leafNodesToSetup) {
    setupLeafObserverForMap(context, objProxy, key, leafNode, versionKey);
  }

  context.yTypeToValtioProxy.set(yMap, objProxy);
  context.valtioProxyToYType.set(objProxy, yMap);

  const unsubscribe = attachValtioMapSubscription(context, yMap, objProxy, doc);
  context.registerSubscription(yMap, unsubscribe);

  return objProxy;
}

// Helper: Process Y.Array items and convert them for the initial proxy
function processYArrayItems(
  context: SynchronizationContext,
  yArray: Y.Array<unknown>,
  doc: Y.Doc,
): unknown[] {
  return yArray.toArray().map((value) => {
    if (isYSharedContainer(value)) {
      // Containers: create controller proxy recursively
      return getOrCreateValtioProxy(context, value, doc);
    } else if (isYLeafType(value)) {
      // Leaf nodes: initialize with null, will be set after proxy creation
      return null;
    } else {
      // Primitives: store as-is
      return value;
    }
  });
}

// Helper: Setup leaf nodes in an array proxy after creation
function setupLeafNodesInArray(
  context: SynchronizationContext,
  yArray: Y.Array<unknown>,
  arrProxy: unknown[],
): void {
  yArray.toArray().forEach((value, index) => {
    if (isYLeafType(value)) {
      // Type assertion is safe here because isYLeafType guard confirmed the type
      const leafNode = value as YLeafType;
      // Use computed property approach for reactivity
      setupLeafNodeAsComputedInArray(context, arrProxy, index, leafNode);
    }
  });
}

function getOrCreateValtioProxyForYArray(context: SynchronizationContext, yArray: Y.Array<unknown>, doc: Y.Doc): unknown[] {
  const existing = context.yTypeToValtioProxy.get(yArray) as unknown[] | undefined;
  if (existing) return existing;
  
  const initialItems = processYArrayItems(context, yArray, doc);
  const arrProxy = proxy(initialItems);
  
  // Setup reactivity for leaf nodes AFTER proxy creation
  setupLeafNodesInArray(context, yArray, arrProxy);
  
  context.yTypeToValtioProxy.set(yArray, arrProxy);
  context.valtioProxyToYType.set(arrProxy, yArray);
  const unsubscribe = attachValtioArraySubscription(context, yArray, arrProxy, doc);
  context.registerSubscription(yArray, unsubscribe);
  return arrProxy;
}

export function getValtioProxyForYType(context: SynchronizationContext, yType: YSharedContainer): object | undefined {
  return context.yTypeToValtioProxy.get(yType);
}

export function getYTypeForValtioProxy(context: SynchronizationContext, obj: object): YSharedContainer | undefined {
  return context.valtioProxyToYType.get(obj);
}


/**
 * The main router. It takes any Yjs shared type and returns the
 * appropriate Valtio proxy controller for it, creating it if it doesn't exist.
 * 
 * Note: XML types (XmlFragment, XmlElement, XmlHook) are treated as leaf types,
 * so they're handled via the leaf type logic in the map/array proxy creators.
 */
export function getOrCreateValtioProxy(context: SynchronizationContext, yType: YSharedContainer, doc: Y.Doc): object {
  if (isYMap(yType)) {
    return getOrCreateValtioProxyForYMap(context, yType, doc);
  }
  // TypeScript exhaustiveness check: YSharedContainer = Y.Map | Y.Array
  return getOrCreateValtioProxyForYArray(context, yType, doc);
}



