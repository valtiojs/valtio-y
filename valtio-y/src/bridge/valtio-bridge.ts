// Bridge/Router layer
//
// Responsibility:
// - Materialize real Valtio proxies for Yjs shared types (currently Y.Map).
// - Maintain stable identity via caches (Y type <-> Valtio proxy) inside a context.
// - Reflect local Valtio writes back to Yjs minimally (set/delete) inside
//   transactions tagged with VALTIO_Y_ORIGIN.
// - Lazily create nested controllers when a Y value is another Y type.
import * as Y from "yjs";
import * as valtioVanilla from "valtio/vanilla";

const { proxy, subscribe } = valtioVanilla;

// Enable ops in subscribe callback - required for valtio-y to receive change operations
// This is a global opt-in as of valtio v2.x (see https://github.com/pmndrs/valtio/pull/1189)
// We check for existence to maintain backwards compatibility with older valtio versions
if (
  "unstable_enableOp" in valtioVanilla &&
  typeof valtioVanilla.unstable_enableOp === "function"
) {
  valtioVanilla.unstable_enableOp(true);
}

import type { YSharedContainer } from "../core/yjs-types";
import type { ValtioYjsCoordinator } from "../core/coordinator";
import { isYSharedContainer, isYMap } from "../core/guards";
import { planMapOps } from "../planning/map-ops-planner";
import { planArrayOps } from "../planning/array-ops-planner";
import { validateDeepForSharedState } from "../core/converter";
import { safeStringify } from "../utils/logging";
import type { RawValtioOperation } from "../core/types";
import {
  createUpgradeChildCallback,
  filterMapOperations,
  rollbackArrayChanges,
  rollbackMapChanges,
} from "./controller-helpers";

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
  coordinator: ValtioYjsCoordinator,
  yArray: Y.Array<unknown>,
  arrProxy: unknown[],
  _doc: Y.Doc,
): () => void {
  const unsubscribe = subscribe(
    arrProxy,
    (ops: unknown[]) => {
      if (coordinator.state.isReconciling) return;

      coordinator.logger.debug("[controller][array] ops", safeStringify(ops));

      // Wrap planning + enqueue in try/catch to rollback local proxy on validation failure
      try {
        // Phase 1: Planning - categorize operations into explicit intents
        // Use actual Y.Array length (NOT effective length) because we need to
        // classify operations based on what will actually exist in the Y.Array
        // at flush time, not based on pending operations that haven't been applied yet.
        const yLength = yArray.length;

        const { sets, deletes, replaces } = planArrayOps(
          ops,
          yLength,
          coordinator,
        );

        coordinator.logger.debug("Controller plan (array):", {
          replaces: Array.from(replaces.keys()).sort((a, b) => a - b),
          deletes: Array.from(deletes.values()).sort((a, b) => a - b),
          sets: Array.from(sets.keys()).sort((a, b) => a - b),
          yLength,
          proxyLength: arrProxy.length,
        });

        // Phase 2: Scheduling - enqueue planned operations

        // Handle replaces first (splice replace operations: delete + set at same index)
        for (const [index, value] of replaces) {
          coordinator.logger.debug("[controller][array] enqueue.replace", {
            index,
          });
          const normalized = value === undefined ? null : value;
          // Validate synchronously before enqueuing (deep)
          validateDeepForSharedState(normalized);
          coordinator.enqueueArrayReplace(
            yArray,
            index,
            normalized, // Normalize undefined→null defensively
            createUpgradeChildCallback(
              coordinator,
              arrProxy,
              index,
              _doc,
              getOrCreateValtioProxy,
            ),
          );
        }

        // Handle pure deletes
        for (const index of deletes) {
          coordinator.logger.debug("[controller][array] enqueue.delete", {
            index,
          });
          coordinator.enqueueArrayDelete(yArray, index);
        }

        // Handle pure sets (inserts/pushes/unshifts).
        for (const [index, value] of sets) {
          const normalized = value === undefined ? null : value;
          // Validate synchronously before enqueuing (deep validation to catch nested undefined)
          validateDeepForSharedState(normalized);
          coordinator.logger.debug("[controller][array] enqueue.set", {
            index,
            hasId: !!(normalized as { id?: unknown } | null)?.id,
            id: (normalized as { id?: unknown } | null)?.id,
          });
          coordinator.enqueueArraySet(
            yArray,
            index,
            normalized, // Normalize undefined→null defensively
            createUpgradeChildCallback(
              coordinator,
              arrProxy,
              index,
              _doc,
              getOrCreateValtioProxy,
            ),
          );
        }
      } catch (err) {
        // Rollback local proxy by resyncing from Y.Array source
        rollbackArrayChanges(
          coordinator,
          yArray,
          arrProxy,
          _doc,
          getOrCreateValtioProxy,
        );
        throw err;
      }
    },
    true,
  );
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
  coordinator: ValtioYjsCoordinator,
  yMap: Y.Map<unknown>,
  objProxy: Record<string, unknown>,
  doc: Y.Doc,
): () => void {
  const unsubscribe = subscribe(
    objProxy,
    (ops: unknown[]) => {
      if (coordinator.state.isReconciling) return;

      // Filter out operations on internal properties
      // 1. Filter out nested Y.js internal property changes (path.length > 1)
      // 2. Filter out valtio-y internal properties (__valtio_yjs_*)
      const filteredOps = filterMapOperations(ops);

      if (filteredOps.length === 0) {
        // All ops were filtered out (all were nested Y.js internal changes)
        return;
      }

      coordinator.logger.debug(
        "[controller][map] ops (filtered)",
        safeStringify(filteredOps),
      );

      // Wrap planning + enqueue in try/catch to rollback local proxy on validation failure
      try {
        // Phase 1: Planning - categorize operations
        const { sets, deletes } = planMapOps(filteredOps);

        // Phase 2: Scheduling - enqueue planned operations
        for (const [key, value] of sets) {
          const normalized = value === undefined ? null : value;
          // Validate synchronously before enqueuing (deep validation to catch nested issues)
          validateDeepForSharedState(normalized);
          coordinator.enqueueMapSet(
            yMap,
            key,
            normalized, // Normalize undefined→null defensively
            createUpgradeChildCallback(
              coordinator,
              objProxy,
              key,
              doc,
              getOrCreateValtioProxy,
            ),
          );
        }

        for (const key of deletes) {
          coordinator.enqueueMapDelete(yMap, key);
        }
      } catch (err) {
        // Rollback local proxy to previous values using ops metadata
        rollbackMapChanges(
          coordinator,
          objProxy,
          filteredOps as RawValtioOperation[],
        );
        throw err;
      }
    },
    true,
  );
  return unsubscribe;
}

// Helper: Process Y.Map entries and convert them for the initial proxy
function processYMapEntries(
  coordinator: ValtioYjsCoordinator,
  yMap: Y.Map<unknown>,
  doc: Y.Doc,
): Record<string, unknown> {
  const initialObj: Record<string, unknown> = {};

  for (const [key, value] of yMap.entries()) {
    if (isYSharedContainer(value)) {
      // Containers: create controller proxy recursively
      initialObj[key] = getOrCreateValtioProxy(coordinator, value, doc);
    } else {
      // Primitives: store as-is
      initialObj[key] = value;
    }
  }

  return initialObj;
}

// Create (or reuse from cache) a Valtio proxy that mirrors a Y.Map.
// Nested Y types are recursively materialized via getOrCreateValtioProxy.
function getOrCreateValtioProxyForYMap(
  coordinator: ValtioYjsCoordinator,
  yMap: Y.Map<unknown>,
  doc: Y.Doc,
): object {
  const existing = coordinator.state.yTypeToValtioProxy.get(yMap);
  if (existing) return existing;

  const initialObj = processYMapEntries(coordinator, yMap, doc);

  // Create the proxy with regular properties
  const objProxy = proxy(initialObj) as Record<string, unknown>;

  coordinator.state.yTypeToValtioProxy.set(yMap, objProxy);
  coordinator.state.valtioProxyToYType.set(objProxy, yMap);

  const unsubscribe = attachValtioMapSubscription(
    coordinator,
    yMap,
    objProxy,
    doc,
  );
  coordinator.registerSubscription(yMap, unsubscribe);

  return objProxy;
}

// Helper: Process Y.Array items and convert them for the initial proxy
function processYArrayItems(
  coordinator: ValtioYjsCoordinator,
  yArray: Y.Array<unknown>,
  doc: Y.Doc,
): unknown[] {
  return yArray.toArray().map((value) => {
    if (isYSharedContainer(value)) {
      // Containers: create controller proxy recursively
      return getOrCreateValtioProxy(coordinator, value, doc);
    } else {
      // Primitives: store as-is
      return value;
    }
  });
}

function getOrCreateValtioProxyForYArray(
  coordinator: ValtioYjsCoordinator,
  yArray: Y.Array<unknown>,
  doc: Y.Doc,
): unknown[] {
  const existing = coordinator.state.yTypeToValtioProxy.get(yArray) as
    | unknown[]
    | undefined;
  if (existing) return existing;

  const initialItems = processYArrayItems(coordinator, yArray, doc);
  const arrProxy = proxy(initialItems);

  coordinator.state.yTypeToValtioProxy.set(yArray, arrProxy);
  coordinator.state.valtioProxyToYType.set(arrProxy, yArray);
  const unsubscribe = attachValtioArraySubscription(
    coordinator,
    yArray,
    arrProxy,
    doc,
  );
  coordinator.registerSubscription(yArray, unsubscribe);
  return arrProxy;
}

export function getValtioProxyForYType(
  coordinator: ValtioYjsCoordinator,
  yType: YSharedContainer,
): object | undefined {
  return coordinator.state.yTypeToValtioProxy.get(yType);
}

export function getYTypeForValtioProxy(
  coordinator: ValtioYjsCoordinator,
  obj: object,
): YSharedContainer | undefined {
  return coordinator.state.valtioProxyToYType.get(obj);
}

/**
 * The main router. It takes any Yjs shared type and returns the
 * appropriate Valtio proxy controller for it, creating it if it doesn't exist.
 */
export function getOrCreateValtioProxy(
  coordinator: ValtioYjsCoordinator,
  yType: YSharedContainer,
  doc: Y.Doc,
): object {
  if (isYMap(yType)) {
    return getOrCreateValtioProxyForYMap(coordinator, yType, doc);
  }
  // TypeScript exhaustiveness check: YSharedContainer = Y.Map | Y.Array
  return getOrCreateValtioProxyForYArray(coordinator, yType, doc);
}
