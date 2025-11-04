import { describe, expect, it } from "vitest";
import * as Y from "yjs";
import { createYjsProxy } from "../index";
import {
  reconcileValtioMap,
  reconcileValtioArray,
  reconcileValtioArrayWithDelta,
  findRemovedControllers,
} from "./reconciler";
import { ValtioYjsCoordinator } from "../core/coordinator";

describe("Reconciler: map/array/delta", () => {
  it("map reconciliation: add, delete, update primitives", async () => {
    const doc = new Y.Doc();
    const yMap = doc.getMap("root");
    const { proxy } = createYjsProxy<Record<string, unknown>>(doc, {
      getRoot: (d) => d.getMap("root"),
    });

    // Manually mutate Y.Map without going through proxy
    yMap.set("a", 1);
    yMap.set("b", 2);

    // Force reconcile
    const coordinator = new ValtioYjsCoordinator(doc, "debug");
    // Ensure reconciler can find the existing proxy instance
    // We reuse the controller created by createYjsProxy by linking caches
    coordinator.state.yTypeToValtioProxy.set(yMap, proxy);
    coordinator.state.valtioProxyToYType.set(proxy, yMap);

    reconcileValtioMap(coordinator, yMap, doc, (fn) =>
      coordinator.withReconcilingLock(fn),
    );
    expect(proxy.a).toBe(1);
    expect(proxy.b).toBe(2);

    // Delete a key in Y and reconcile
    yMap.delete("a");
    reconcileValtioMap(coordinator, yMap, doc, (fn) =>
      coordinator.withReconcilingLock(fn),
    );
    expect("a" in proxy).toBe(false);

    // Update a primitive value in Y and reconcile
    yMap.set("b", 3);
    reconcileValtioMap(coordinator, yMap, doc, (fn) =>
      coordinator.withReconcilingLock(fn),
    );
    expect(proxy.b).toBe(3);
  });

  it("array reconciliation: pushes in Y reflect in proxy after reconcile", async () => {
    const doc = new Y.Doc();
    const yArr = doc.getArray<unknown>("arr");
    const { proxy } = createYjsProxy<number[]>(doc, {
      getRoot: (d) => d.getArray("arr"),
    });

    const coordinator = new ValtioYjsCoordinator(doc, "debug");
    coordinator.state.yTypeToValtioProxy.set(yArr, proxy);
    coordinator.state.valtioProxyToYType.set(proxy, yArr);

    yArr.push([10]);
    reconcileValtioArray(coordinator, yArr, doc, (fn) =>
      coordinator.withReconcilingLock(fn),
    );
    expect(proxy).toHaveLength(1);
    expect(proxy[0]).toBe(10);
  });

  it("delta reconciliation: splice via delta applies to proxy", async () => {
    const doc = new Y.Doc();
    const yArr = doc.getArray<unknown>("arr");
    yArr.insert(0, [1, 2, 3, 4]);
    const { proxy } = createYjsProxy<number[]>(doc, {
      getRoot: (d) => d.getArray("arr"),
    });

    const coordinator = new ValtioYjsCoordinator(doc, "debug");
    coordinator.state.yTypeToValtioProxy.set(yArr, proxy);
    coordinator.state.valtioProxyToYType.set(proxy, yArr);

    // Simulate delta: retain 1, delete 2, insert [9, 8] => [1, 9, 8, 4]
    const delta = [{ retain: 1 }, { delete: 2 }, { insert: [9, 8] }];
    reconcileValtioArrayWithDelta(coordinator, yArr, doc, delta, (fn) =>
      coordinator.withReconcilingLock(fn),
    );
    expect(proxy).toEqual([1, 9, 8, 4]);
  });

  it("reconciliation correctly materializes empty nested containers", async () => {
    const doc = new Y.Doc();
    const yRoot = doc.getMap("root");
    const { proxy } = createYjsProxy<Record<string, unknown>>(doc, {
      getRoot: (d) => d.getMap("root"),
    });

    const coordinator = new ValtioYjsCoordinator(doc, "debug");
    coordinator.state.yTypeToValtioProxy.set(yRoot, proxy);
    coordinator.state.valtioProxyToYType.set(proxy, yRoot);

    const emptyMap = new Y.Map<unknown>();
    const emptyArray = new Y.Array<unknown>();
    yRoot.set("emptyContainer", emptyMap);
    yRoot.set("emptyList", emptyArray);

    reconcileValtioMap(coordinator, yRoot, doc, (fn) =>
      coordinator.withReconcilingLock(fn),
    );

    expect(typeof proxy.emptyContainer).toBe("object");
    expect(Array.isArray(proxy.emptyList)).toBe(true);

    // Verify nested containers are live proxies that can accept mutations
    const emptyContainerProxy = proxy.emptyContainer as Record<string, unknown>;
    (emptyContainerProxy as Record<string, unknown>)["foo"] = 1;
    await Promise.resolve();
    expect((yRoot.get("emptyContainer") as Y.Map<unknown>).get("foo")).toBe(1);
  });

  it("deep materialization across multiple levels in one reconcile pass", async () => {
    const doc = new Y.Doc();
    const yRoot = doc.getMap("root");
    const { proxy } = createYjsProxy<Record<string, unknown>>(doc, {
      getRoot: (d) => d.getMap("root"),
    });

    const level2 = new Y.Map<unknown>();
    const level3 = new Y.Array<unknown>();
    level2.set("child", level3);
    yRoot.set("parent", level2);

    const coordinator = new ValtioYjsCoordinator(doc, "debug");
    coordinator.state.yTypeToValtioProxy.set(yRoot, proxy);
    coordinator.state.valtioProxyToYType.set(proxy, yRoot);

    reconcileValtioMap(coordinator, yRoot, doc, (fn) =>
      coordinator.withReconcilingLock(fn),
    );

    const parentProxy = (proxy as Record<string, unknown>)["parent"] as Record<
      string,
      unknown
    >;
    expect(typeof parentProxy).toBe("object");
    const childProxy = parentProxy["child"] as unknown[];
    expect(Array.isArray(childProxy)).toBe(true);

    // Now mutate nested proxy and ensure Y updates
    childProxy.push(1);
    await Promise.resolve();
    expect(
      (yRoot.get("parent") as Y.Map<unknown>).get("child") instanceof Y.Array,
    ).toBe(true);
    expect(
      (
        (yRoot.get("parent") as Y.Map<unknown>).get("child") as Y.Array<unknown>
      ).toJSON(),
    ).toEqual([1]);
  });

  it("array delta with multiple retains/inserts/deletes reconciles correctly", async () => {
    const doc = new Y.Doc();
    const yArr = doc.getArray<unknown>("arr");
    yArr.insert(0, [1, 2, 3, 4]);
    const { proxy } = createYjsProxy<number[]>(doc, {
      getRoot: (d) => d.getArray("arr"),
    });

    const coordinator = new ValtioYjsCoordinator(doc, "debug");
    coordinator.state.yTypeToValtioProxy.set(yArr, proxy);
    coordinator.state.valtioProxyToYType.set(proxy, yArr);

    // [{ retain: 1 }, { insert: [9] }, { retain: 2 }, { delete: 1 }] => [1, 9, 2, 3]
    const delta = [
      { retain: 1 },
      { insert: [9] },
      { retain: 2 },
      { delete: 1 },
    ];
    reconcileValtioArrayWithDelta(coordinator, yArr, doc, delta, (fn) =>
      coordinator.withReconcilingLock(fn),
    );
    expect(proxy).toEqual([1, 9, 2, 3]);
  });
});

describe("findRemovedControllers", () => {
  it("returns empty array when oldItems is empty", () => {
    const result = findRemovedControllers([], [{ a: 1 }]);
    expect(result).toEqual([]);
  });

  it("returns empty array when no objects in oldItems", () => {
    const result = findRemovedControllers([1, 2, "foo", null], [3, 4]);
    expect(result).toEqual([]);
  });

  it("identifies single removed object", () => {
    const objA = { id: "A" };
    const objB = { id: "B" };
    const result = findRemovedControllers([objA, objB], [objA]);
    expect(result).toEqual([objB]);
  });

  it("handles duplicates correctly - same object appears multiple times", () => {
    const objA = { id: "A" };
    const objB = { id: "B" };
    // old: [A, A, B], new: [A, C] -> one A and B were removed
    const result = findRemovedControllers([objA, objA, objB], [objA]);
    expect(result).toEqual([objA, objB]);
  });

  it("handles multiple duplicates with partial retention", () => {
    const objA = { id: "A" };
    const objB = { id: "B" };
    // old: [A, A, A, B], new: [A, A] -> one A and B removed
    const result = findRemovedControllers(
      [objA, objA, objA, objB],
      [objA, objA],
    );
    expect(result).toEqual([objA, objB]);
  });

  it("returns all objects when newItems is empty", () => {
    const objA = { id: "A" };
    const objB = { id: "B" };
    const result = findRemovedControllers([objA, objB], []);
    expect(result).toEqual([objA, objB]);
  });

  it("returns empty array when all objects are retained", () => {
    const objA = { id: "A" };
    const objB = { id: "B" };
    const result = findRemovedControllers([objA, objB], [objA, objB]);
    expect(result).toEqual([]);
  });

  it("filters out primitives and only tracks objects", () => {
    const objA = { id: "A" };
    const objB = { id: "B" };
    // Primitives don't need cleanup, only objects
    const result = findRemovedControllers(
      [1, "foo", objA, null, objB, undefined],
      [objA, 2, "bar"],
    );
    expect(result).toEqual([objB]);
  });

  it("handles null and undefined in arrays gracefully", () => {
    const objA = { id: "A" };
    const result = findRemovedControllers(
      [null, objA, undefined],
      [null, undefined],
    );
    expect(result).toEqual([objA]);
  });

  it("preserves order of removed objects", () => {
    const objA = { id: "A" };
    const objB = { id: "B" };
    const objC = { id: "C" };
    const result = findRemovedControllers([objA, objB, objC], [objB]);
    expect(result).toEqual([objA, objC]);
  });

  it("handles mixed scenario with duplicates, primitives, and removals", () => {
    const objA = { id: "A" };
    const objB = { id: "B" };
    const objC = { id: "C" };
    // old: [1, A, A, "foo", B, null, C, 2]
    // new: [A, 3, B, B, "bar"]
    // removed: one A, C (B appears twice in new, so both B instances retained)
    const result = findRemovedControllers(
      [1, objA, objA, "foo", objB, null, objC, 2],
      [objA, 3, objB, objB, "bar"],
    );
    expect(result).toEqual([objA, objC]);
  });

  it("example from docstring: old=[A, A, B], new=[A, C] → returns [A, B]", () => {
    const objA = { id: "A" };
    const objB = { id: "B" };
    const objC = { id: "C" };
    const result = findRemovedControllers([objA, objA, objB], [objA, objC]);
    expect(result).toEqual([objA, objB]);
  });
});
