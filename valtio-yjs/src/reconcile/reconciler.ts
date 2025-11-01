import * as Y from 'yjs';
import { getOrCreateValtioProxy, getValtioProxyForYType } from '../bridge/valtio-bridge';
import { SynchronizationContext } from '../core/context';

import { isYSharedContainer, isYArray, isYMap, isYLeafType } from '../core/guards';
import { yTypeToJSON } from '../core/types';
import { setupLeafNodeAsComputed, setupLeafNodeAsComputedInArray, getUnderlyingLeaf } from '../bridge/leaf-computed';
import type { YLeafType } from 'src/core/yjs-types';

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
 */
export function reconcileValtioMap(context: SynchronizationContext, yMap: Y.Map<unknown>, doc: Y.Doc): void {
  const valtioProxy = getValtioProxyForYType(context, yMap) as Record<string, unknown> | undefined;
  if (!valtioProxy) {
    // This map hasn't been materialized yet, so there's nothing to reconcile.
    context.log.debug('reconcileValtioMap skipped (no proxy)');
    return;
  }

  context.withReconcilingLock(() => {
    context.log.debug('reconcileValtioMap start', {
      yKeys: Array.from(yMap.keys()),
      valtioKeys: Object.keys(valtioProxy),
      yJson: yTypeToJSON(yMap),
    });
    const yKeys = new Set(Array.from(yMap.keys()).map((k) => String(k)));
    // EXCLUDE internal valtio-yjs properties from reconciliation
    // These properties (like __valtio_yjs_version, __valtio_yjs_leaf_*) are used for reactivity
    // and should NOT be synced with Y.Map or deleted during reconciliation
    const valtioKeys = new Set(Object.keys(valtioProxy).filter(key => !key.startsWith('__valtio_yjs_')));
    const allKeys = new Set<string>([...yKeys, ...valtioKeys]);

    for (const key of allKeys) {
      const inY = yKeys.has(key);
      const inValtio = valtioKeys.has(key);

      if (inY && !inValtio) {
        const yValue = yMap.get(key);
        // Check leaf types first (before container check) since some leaf types extend containers
        // (e.g., Y.XmlHook extends Y.Map)
        if (isYLeafType(yValue)) {
          context.log.debug('[ADD] set leaf node (computed)', key);
          setupLeafNodeAsComputed(context, valtioProxy, key, yValue);
        } else if (isYSharedContainer(yValue)) {
          context.log.debug('[ADD] create controller', key);
          valtioProxy[key] = getOrCreateValtioProxy(context, yValue, doc);
          if (isYMap(yValue)) {
            context.log.debug('[RECONCILE-CHILD] map', key);
            reconcileValtioMap(context, yValue as Y.Map<unknown>, doc);
          } else if (isYArray(yValue)) {
            context.log.debug('[RECONCILE-CHILD] array', key);
            reconcileValtioArray(context, yValue as Y.Array<unknown>, doc);
          }
        } else {
          context.log.debug('[ADD] set primitive', key);
          valtioProxy[key] = yValue;
        }
        continue;
      }

      if (!inY && inValtio) {
        context.log.debug('[DELETE] remove key', key);
        delete valtioProxy[key];
        continue;
      }

      if (inY && inValtio) {
        const yValue = yMap.get(key);
        const current = valtioProxy[key];
        // Check leaf types first (before container check) since some leaf types extend containers
        // (e.g., Y.XmlHook extends Y.Map)
        if (isYLeafType(yValue)) {
          context.log.debug('[RECONCILE] leaf node detected', key, {
            currentType: current?.constructor?.name,
            yValueType: yValue?.constructor?.name,
            same: current === yValue,
          });
          
          // Get the underlying Y.js leaf node from the computed property
          const underlyingCurrent = getUnderlyingLeaf(valtioProxy, key);
          
          context.log.debug('[RECONCILE] underlying current', {
            key,
            underlyingCurrent,
            yValue,
            same: underlyingCurrent === yValue,
          });
          
          // Only replace if the underlying Y.js instance has changed
          if (underlyingCurrent !== yValue) {
            context.log.debug('[RECONCILE] setting up leaf node', key);
            // Setup new computed property with reactivity
            setupLeafNodeAsComputed(context, valtioProxy, key, yValue);
          } else {
            // Same Y.js instance - computed property is already correct
            context.log.debug('[RECONCILE] leaf node unchanged, skipping setup', key);
          }
        } else if (isYSharedContainer(yValue)) {
          const desired = getOrCreateValtioProxy(context, yValue, doc);
          if (current !== desired) {
            context.log.debug('[REPLACE] replace controller', key);
            valtioProxy[key] = desired;
          }
          if (isYMap(yValue)) {
            context.log.debug('[RECONCILE-CHILD] map', key);
            reconcileValtioMap(context, yValue as Y.Map<unknown>, doc);
          } else if (isYArray(yValue)) {
            context.log.debug('[RECONCILE-CHILD] array', key);
            reconcileValtioArray(context, yValue as Y.Array<unknown>, doc);
          }
        } else {
          if (current !== yValue) {
            context.log.debug('[UPDATE] primitive', key);
            valtioProxy[key] = yValue;
          }
        }
      }
    }
    context.log.debug('reconcileValtioMap end', {
      valtioKeys: Object.keys(valtioProxy),
    });
  });
}

// TODO: Implement granular delta-based reconciliation for arrays.
// For now, perform a coarse structural sync using splice.
export function reconcileValtioArray(context: SynchronizationContext, yArray: Y.Array<unknown>, doc: Y.Doc): void {
  const valtioProxy = getValtioProxyForYType(context, yArray) as unknown[] | undefined;
  if (!valtioProxy) return;

  context.withReconcilingLock(() => {
    // Skip structural reconcile if this array has a delta in the current sync pass
    if (context.shouldSkipArrayStructuralReconcile(yArray)) {
      context.log.debug('reconcileValtioArray skipped due to pending delta', {
        yLength: yArray.length,
        valtioLength: valtioProxy.length,
      });
      return;
    }
    context.log.debug('reconcileValtioArray start', {
      yLength: yArray.length,
      valtioLength: valtioProxy.length,
      yJson: yTypeToJSON(yArray),
    });
    const newContent = yArray.toArray().map((item) => {
      // Check leaf types FIRST, before containers
      // This is critical because Y.XmlHook extends Y.Map, so it would match
      // isYSharedContainer before isYLeafType, causing it to be incorrectly
      // wrapped in a controller proxy instead of being treated as a leaf.
      if (isYLeafType(item)) {
        // For array items, we'll set up computed properties after the splice
        return null;
      } else if (isYSharedContainer(item)) {
        return getOrCreateValtioProxy(context, item, doc);
      } else {
        return item;
      }
    });
    context.log.debug('reconcile array splice', newContent.length);
    valtioProxy.splice(0, valtioProxy.length, ...newContent);
    
    // Setup computed properties for leaf nodes after splice
    yArray.toArray().forEach((item, index) => {
      if (isYLeafType(item)) {
        // Type assertion is safe here because isYLeafType guard confirmed the type
        const leafNode = item as YLeafType;
        setupLeafNodeAsComputedInArray(context, valtioProxy, index, leafNode);
      }
    });
    context.log.debug('reconcileValtioArray end', {
      valtioLength: valtioProxy.length,
    });

    // Eagerly ensure nested children of shared containers are also materialized
    for (let i = 0; i < newContent.length; i++) {
      const item = yArray.get(i) as unknown;
      if (item && isYSharedContainer(item)) {
        if (isYMap(item)) {
          reconcileValtioMap(context, item as Y.Map<unknown>, doc);
        } else if (isYArray(item)) {
          reconcileValtioArray(context, item as Y.Array<unknown>, doc);
        }
      }
    }
  });
}

/**
 * Applies a granular Yjs delta to the Valtio array proxy, avoiding full re-splices.
 * The delta format follows Yjs ArrayEvent.changes.delta: an array of ops
 * where each op is one of { retain: number } | { delete: number } | { insert: any[] }.
 */
export function reconcileValtioArrayWithDelta(
  context: SynchronizationContext,
  yArray: Y.Array<unknown>,
  doc: Y.Doc,
  delta: Array<{ retain?: number; delete?: number; insert?: unknown[] }>,
): void {
  const valtioProxy = getValtioProxyForYType(context, yArray) as unknown[] | undefined;
  if (!valtioProxy) return;

  context.withReconcilingLock(() => {
    context.log.debug('reconcileValtioArrayWithDelta start', {
      delta,
      valtioLength: valtioProxy.length,
    });

    let position = 0;
    let step = 0;
    for (const d of delta) {
      context.log.debug('delta.step', { step: step++, d, position });
      if (d.retain && d.retain > 0) {
        position += d.retain;
        continue;
      }
      if (d.delete && d.delete > 0) {
        const deleteCount = d.delete;
        if (deleteCount > 0) {
          valtioProxy.splice(position, deleteCount);
        }
        continue;
      }
      if (d.insert && d.insert.length > 0) {
        const converted = d.insert.map((item) => {
          // Check leaf types FIRST (see comment in reconcileValtioArray above)
          if (isYLeafType(item)) {
            // For array items, we'll set up computed properties after the insert
            return null;
          } else if (isYSharedContainer(item)) {
            return getOrCreateValtioProxy(context, item, doc);
          } else {
            return item;
          }
        });
        // Idempotency guard: if the exact converted items already exist at this position
        // (e.g., due to a prior structural reconcile in the same sync pass), skip inserting.
        const existingSlice = valtioProxy.slice(position, position + converted.length);
        const alreadyPresent = converted.length > 0 && converted.every((v, i) => existingSlice[i] === v);
        if (alreadyPresent) {
          context.log.debug('delta.insert (skipped: already present)', { at: position, count: converted.length });
          position += converted.length;
          continue;
        }
        context.log.debug('delta.insert', { at: position, count: converted.length });
        valtioProxy.splice(position, 0, ...converted);
        
        // Setup computed properties for inserted leaf nodes
        d.insert.forEach((item, offset) => {
          if (isYLeafType(item)) {
            // Type assertion is safe here because isYLeafType guard confirmed the type
            const leafNode = item as YLeafType;
            setupLeafNodeAsComputedInArray(context, valtioProxy, position + offset, leafNode);
          }
        });
        
        position += converted.length;
        continue;
      }
      // Unknown or empty op: skip
    }

    context.log.debug('reconcileValtioArrayWithDelta end', {
      valtioLength: valtioProxy.length,
    });
  });
}


