import type * as Y from "yjs";
import type { ValtioYjsCoordinator } from "../core/coordinator";
import { isYSharedContainer } from "../core/guards";
import type { YSharedContainer } from "../core/yjs-types";
import {
  getContainerValue,
  setContainerValue,
  isRawSetMapOp,
  type RawValtioOperation,
} from "../core/types";

export type CreateControllerFn = (
  coordinator: ValtioYjsCoordinator,
  yValue: YSharedContainer,
  doc: Y.Doc,
) => unknown;

/**
 * Returns a callback that upgrades a child value to a controller when the
 * scheduler applies the mutation and hands us the final Yjs value.
 */
export function createUpgradeChildCallback(
  coordinator: ValtioYjsCoordinator,
  container: Record<string, unknown> | unknown[],
  key: string | number,
  doc: Y.Doc,
  createController: CreateControllerFn,
): (yValue: unknown) => void {
  return (yValue: unknown) => {
    if (!isYSharedContainer(yValue)) return;

    const current = getContainerValue(container, key);
    const underlyingYType =
      current && typeof current === "object"
        ? coordinator.state.valtioProxyToYType.get(current as object)
        : undefined;
    if (underlyingYType) return;

    const newController = createController(
      coordinator,
      yValue as YSharedContainer,
      doc,
    );
    coordinator.withReconcilingLock(() => {
      setContainerValue(container, key, newController);
    });
  };
}

/**
 * Filter out nested operations from Valtio map operations, returning only top-level changes.
 */
export function filterMapOperations(ops: unknown[]): unknown[] {
  return ops.filter((op) => {
    const rawOp = op as RawValtioOperation;
    if (isRawSetMapOp(rawOp)) {
      const path = rawOp[1] as (string | number)[];
      if (path.length !== 1) {
        return false;
      }
    }
    return true;
  });
}

/**
 * Roll back array proxy changes by resyncing from the Y.Array source.
 * This is more robust than using operation metadata, as it ensures the proxy
 * exactly matches the Y.Array state after a failed validation.
 */
export function rollbackArrayChanges(
  coordinator: ValtioYjsCoordinator,
  yArray: Y.Array<unknown>,
  arrProxy: unknown[],
  doc: Y.Doc,
  getOrCreateProxy: CreateControllerFn,
): void {
  coordinator.withReconcilingLock(() => {
    const snapshot = yArray.toArray().map((item) => {
      if (isYSharedContainer(item)) {
        return getOrCreateProxy(coordinator, item, doc);
      }
      return item;
    });
    arrProxy.splice(0, arrProxy.length, ...snapshot);
  });
}

/**
 * Roll back map proxy changes using the provided operations metadata.
 */
export function rollbackMapChanges(
  coordinator: ValtioYjsCoordinator,
  objProxy: Record<string, unknown>,
  ops: RawValtioOperation[],
): void {
  coordinator.withReconcilingLock(() => {
    for (const op of ops) {
      if (isRawSetMapOp(op)) {
        const key = op[1][0];
        const prev = op[3];
        if (prev === undefined) {
          delete objProxy[key];
        } else {
          objProxy[key] = prev;
        }
      }
    }
  });
}
