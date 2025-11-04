/* eslint @typescript-eslint/no-explicit-any: "off" */

import { describe, it, expect } from "vitest";
import * as Y from "yjs";
import { ValtioYjsCoordinator } from "../core/coordinator";
import { getOrCreateValtioProxy } from "../bridge/valtio-bridge";
import { reconcileValtioArrayWithDelta } from "./reconciler";

describe("Reconciler: delta insert materializes fields immediately", () => {
  it("delta.insert of Y.Map makes fields available on proxy right away", () => {
    const doc = new Y.Doc();
    const coordinator = new ValtioYjsCoordinator(doc, "debug");
    const yArr = new Y.Array<unknown>();
    const proxy = getOrCreateValtioProxy(coordinator, yArr, doc) as unknown[];

    // Prepare inserted map and integrate it under the same doc first
    const inserted = new Y.Map<unknown>();
    inserted.set("id", 1);
    inserted.set("text", "Replaced Alpha");
    const ch = new Y.Array<unknown>();
    ch.insert(0, [
      { id: 1001, text: "Alpha - Child A" },
      { id: 1002, text: "Alpha - Child B" },
    ]);
    inserted.set("children", ch);
    const root = doc.getMap("pool");
    root.set("tmp", inserted);

    const delta = [{ insert: [inserted] }, { delete: 0 }];

    reconcileValtioArrayWithDelta(coordinator, yArr, doc, delta, (fn) =>
      coordinator.withReconcilingLock(fn),
    );
    expect(Array.isArray(proxy)).toBe(true);
    expect(proxy).toHaveLength(1);
    expect((proxy[0] as Record<string, unknown>).text).toBe("Replaced Alpha");
    expect(Array.isArray((proxy[0] as Record<string, unknown>).children)).toBe(
      true,
    );
    expect(
      (
        (proxy[0] as Record<string, unknown>).children as Array<
          Record<string, unknown>
        >
      )[0]?.text,
    ).toBe("Alpha - Child A");
  });
});
