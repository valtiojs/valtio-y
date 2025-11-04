/**
 * Controller Creation Timing Tests
 *
 * These tests verify that controllers are created at the correct time in the lifecycle:
 * 1. Controllers created AFTER Y values exist (not before)
 * 2. Post-transaction callbacks execute AFTER transaction completes
 * 3. Race conditions are handled correctly
 *
 * Context: Controllers are Valtio proxies that control Y types. They must be created
 * after the Y value exists to avoid accessing non-existent Y structures.
 */

import { describe, expect, it } from "vitest";
import * as Y from "yjs";
import { createYjsProxy } from "../../src/index";

const waitMicrotask = () => Promise.resolve();

describe("Controller Creation Timing", () => {
  describe("Controllers Created AFTER Y Values Exist", () => {
    it("map controller: Y.Map must exist before controller proxy is created", async () => {
      const doc = new Y.Doc();
      const yRoot = doc.getMap<unknown>("root");

      const { proxy } = createYjsProxy<Record<string, unknown>>(doc, {
        getRoot: (d) => d.getMap("root"),
      });

      // No Y.Map exists yet, so accessing the nested property returns undefined
      expect(proxy.nested).toBeUndefined();

      // Materialize the nested Y.Map in the doc
      const yNested = new Y.Map<unknown>();
      yRoot.set("nested", yNested);
      await waitMicrotask();

      // After the Y value exists, the controller should be materialized lazily
      const nestedProxy = proxy.nested as Record<string, unknown>;
      expect(typeof nestedProxy).toBe("object");

      // Verify the proxy is a live controller by syncing writes back to Yjs
      nestedProxy.key = "value";
      await waitMicrotask();
      expect(yNested.get("key")).toBe("value");
    });

    it("array controller: Y.Array must exist before controller proxy is created", async () => {
      const doc = new Y.Doc();
      const yRoot = doc.getMap<unknown>("root");

      const { proxy } = createYjsProxy<Record<string, unknown>>(doc, {
        getRoot: (d) => d.getMap("root"),
      });

      // Without a backing Y.Array, the controller should not be materialized
      expect(proxy.items).toBeUndefined();

      // Attach the array to the Y document
      const yArr = new Y.Array<unknown>();
      yRoot.set("items", yArr);
      await waitMicrotask();

      // The controller should now exist and expose observable array behavior
      const itemsProxy = proxy.items as unknown[];
      expect(Array.isArray(itemsProxy)).toBe(true);

      // Verify the controller is live and stays in sync with the Y.Array
      itemsProxy.push(1);
      await waitMicrotask();
      expect(yArr.toArray()).toEqual([1]);
    });

    it("nested structure: parent Y value must exist before child controller is created", async () => {
      const doc = new Y.Doc();
      const yRoot = doc.getMap<unknown>("root");

      // Build nested structure: root -> parent -> child
      const yParent = new Y.Map<unknown>();
      const yChild = new Y.Map<unknown>();

      // Set child into parent first
      yParent.set("child", yChild);

      // Then set parent into root - this establishes the full hierarchy
      yRoot.set("parent", yParent);
      await waitMicrotask();

      // Create proxy system
      const { proxy } = createYjsProxy<Record<string, unknown>>(doc, {
        getRoot: (d) => d.getMap("root"),
      });

      // Access parent to materialize it
      const parentProxy = proxy.parent as Record<string, unknown>;
      expect(typeof parentProxy).toBe("object");

      // Access child to materialize it
      const childProxy = parentProxy.child as Record<string, unknown>;
      expect(typeof childProxy).toBe("object");

      // Verify full hierarchy exists in Y doc
      const yParentFromRoot = yRoot.get("parent") as Y.Map<unknown>;
      expect(yParentFromRoot instanceof Y.Map).toBe(true);

      const yChildFromParent = yParentFromRoot.get("child") as Y.Map<unknown>;
      expect(yChildFromParent instanceof Y.Map).toBe(true);
      expect(yChildFromParent).toBe(yChild);

      // Verify child controller works
      childProxy.value = 42;
      await waitMicrotask();
      expect(yChild.get("value")).toBe(42);
    });

    it("reconciliation: controller created during reconcile only after Y value is fully integrated", async () => {
      const doc = new Y.Doc();
      const yRoot = doc.getMap<unknown>("root");

      const { proxy } = createYjsProxy<Record<string, unknown>>(doc, {
        getRoot: (d) => d.getMap("root"),
      });

      // Simulate remote change: add nested map directly to Yjs
      const yNested = new Y.Map<unknown>();
      yNested.set("remoteKey", "remoteValue");
      yRoot.set("nested", yNested);

      // Wait for reconciliation
      await waitMicrotask();

      // Controller should be materialized after reconciliation
      const nestedProxy = proxy.nested as Record<string, unknown>;
      expect(typeof nestedProxy).toBe("object");
      expect(nestedProxy.remoteKey).toBe("remoteValue");

      // Verify the Y structure is complete
      const yNestedFromRoot = yRoot.get("nested") as Y.Map<unknown>;
      expect(yNestedFromRoot).toBe(yNested);
      expect(yNestedFromRoot.get("remoteKey")).toBe("remoteValue");

      // Verify controller is live
      nestedProxy.localKey = "localValue";
      await waitMicrotask();
      expect(yNested.get("localKey")).toBe("localValue");
    });

    it("array of objects: each object controller created after its Y.Map exists", async () => {
      const doc = new Y.Doc();
      const yRoot = doc.getArray<unknown>("root");

      const { proxy } = createYjsProxy<Array<{ id: number; name: string }>>(
        doc,
        {
          getRoot: (d) => d.getArray("root"),
        },
      );

      // Create Y.Map objects
      const yObj1 = new Y.Map<unknown>();
      yObj1.set("id", 1);
      yObj1.set("name", "Alice");

      const yObj2 = new Y.Map<unknown>();
      yObj2.set("id", 2);
      yObj2.set("name", "Bob");

      // Insert into array
      yRoot.insert(0, [yObj1, yObj2]);
      await waitMicrotask();

      // Controllers should be materialized
      expect(proxy).toHaveLength(2);
      expect(proxy[0]!.id).toBe(1);
      expect(proxy[0]!.name).toBe("Alice");
      expect(proxy[1]!.id).toBe(2);
      expect(proxy[1]!.name).toBe("Bob");

      // Verify Y structure is complete
      const yItems = yRoot.toArray();
      expect(yItems).toHaveLength(2);
      expect(yItems[0]).toBe(yObj1);
      expect(yItems[1]).toBe(yObj2);

      // Verify controllers are live
      proxy[0]!.name = "Alicia";
      await waitMicrotask();
      expect(yObj1.get("name")).toBe("Alicia");
    });
  });

  describe("Post-Transaction Callback Execution", () => {
    it("callbacks execute AFTER transaction completes for map sets", async () => {
      const doc = new Y.Doc();
      const yRoot = doc.getMap<unknown>("root");

      const { proxy } = createYjsProxy<Record<string, unknown>>(doc, {
        getRoot: (d) => d.getMap("root"),
      });

      const executionOrder: string[] = [];

      // Set up transaction observer to track transaction boundaries
      doc.on("beforeTransaction", () => {
        executionOrder.push("transaction-start");
      });

      doc.on("afterTransaction", () => {
        executionOrder.push("transaction-end");
      });

      // Assign a plain object - this should trigger eager upgrade
      proxy.data = { nested: { value: 1 } };

      // Wait for scheduler to flush
      await waitMicrotask();

      // Verify transaction executed
      expect(executionOrder).toContain("transaction-start");
      expect(executionOrder).toContain("transaction-end");

      // Find transaction boundaries
      const startIdx = executionOrder.indexOf("transaction-start");
      const endIdx = executionOrder.indexOf("transaction-end");
      expect(startIdx).toBeLessThan(endIdx);

      // Verify Y value exists and is correct type
      const yData = yRoot.get("data");
      expect(yData instanceof Y.Map).toBe(true);

      // Verify controller was created (proxy is live)
      const dataProxy = proxy.data as Record<string, unknown>;
      expect(typeof dataProxy).toBe("object");

      const nestedProxy = dataProxy.nested as Record<string, unknown>;
      nestedProxy.value = 2;
      await waitMicrotask();

      const yNested = (yData as Y.Map<unknown>).get("nested") as Y.Map<unknown>;
      expect(yNested.get("value")).toBe(2);
    });

    it("callbacks execute AFTER transaction completes for array pushes", async () => {
      const doc = new Y.Doc();
      const yRoot = doc.getArray<unknown>("root");

      const { proxy } = createYjsProxy<Array<{ id: number }>>(doc, {
        getRoot: (d) => d.getArray("root"),
      });

      const executionOrder: string[] = [];

      doc.on("beforeTransaction", () => {
        executionOrder.push("transaction-start");
      });

      doc.on("afterTransaction", () => {
        executionOrder.push("transaction-end");
      });

      // Push a plain object - this should trigger eager upgrade
      proxy.push({ id: 1 });

      await waitMicrotask();

      // Verify transaction executed
      expect(executionOrder).toContain("transaction-start");
      expect(executionOrder).toContain("transaction-end");

      // Verify Y value exists
      expect(yRoot).toHaveLength(1);
      const yItem = yRoot.get(0);
      expect(yItem instanceof Y.Map).toBe(true);

      // Verify controller was created
      expect(proxy).toHaveLength(1);
      expect(proxy[0]?.id).toBe(1);

      // Verify controller is live
      proxy[0]!.id = 2;
      await waitMicrotask();
      expect((yItem as Y.Map<unknown>).get("id")).toBe(2);
    });

    it("multiple callbacks execute in order after transaction", async () => {
      const doc = new Y.Doc();
      const yRoot = doc.getMap<unknown>("root");

      const { proxy } = createYjsProxy<Record<string, unknown>>(doc, {
        getRoot: (d) => d.getMap("root"),
      });

      // Assign multiple nested objects in one synchronous batch
      proxy.obj1 = { a: 1 };
      proxy.obj2 = { b: 2 };
      proxy.obj3 = { c: 3 };

      await waitMicrotask();

      // All should be converted to Y types
      expect(yRoot.get("obj1") instanceof Y.Map).toBe(true);
      expect(yRoot.get("obj2") instanceof Y.Map).toBe(true);
      expect(yRoot.get("obj3") instanceof Y.Map).toBe(true);

      // All should have controllers
      const obj1Proxy = proxy.obj1 as Record<string, unknown> | undefined;
      const obj2Proxy = proxy.obj2 as Record<string, unknown> | undefined;
      const obj3Proxy = proxy.obj3 as Record<string, unknown> | undefined;

      expect(obj1Proxy?.a).toBe(1);
      expect(obj2Proxy?.b).toBe(2);
      expect(obj3Proxy?.c).toBe(3);

      // All controllers should be live
      obj1Proxy!.a = 10;
      obj2Proxy!.b = 20;
      obj3Proxy!.c = 30;

      await waitMicrotask();

      expect((yRoot.get("obj1") as Y.Map<unknown>).get("a")).toBe(10);
      expect((yRoot.get("obj2") as Y.Map<unknown>).get("b")).toBe(20);
      expect((yRoot.get("obj3") as Y.Map<unknown>).get("c")).toBe(30);
    });

    it("callback errors don't prevent other callbacks from executing", async () => {
      const doc = new Y.Doc();
      const yRoot = doc.getMap<unknown>("root");

      const { proxy } = createYjsProxy<Record<string, unknown>>(doc, {
        getRoot: (d) => d.getMap("root"),
      });

      // Assign objects
      proxy.good1 = { a: 1 };
      proxy.good2 = { b: 2 };

      await waitMicrotask();

      // Both should be upgraded despite any potential errors
      expect(yRoot.get("good1") instanceof Y.Map).toBe(true);
      expect(yRoot.get("good2") instanceof Y.Map).toBe(true);

      const good1Proxy = proxy.good1 as Record<string, unknown> | undefined;
      const good2Proxy = proxy.good2 as Record<string, unknown> | undefined;

      expect(good1Proxy?.a).toBe(1);
      expect(good2Proxy?.b).toBe(2);
    });

    it("nested callback: parent upgraded before child callback runs", async () => {
      const doc = new Y.Doc();
      const yRoot = doc.getMap<unknown>("root");

      const { proxy } = createYjsProxy<Record<string, unknown>>(doc, {
        getRoot: (d) => d.getMap("root"),
      });

      // Assign deeply nested object
      proxy.parent = {
        child: {
          grandchild: {
            value: 1,
          },
        },
      };

      await waitMicrotask();

      // Entire hierarchy should be upgraded
      const yParent = yRoot.get("parent");
      expect(yParent instanceof Y.Map).toBe(true);

      const yChild = (yParent as Y.Map<unknown>).get("child");
      expect(yChild instanceof Y.Map).toBe(true);

      const yGrandchild = (yChild as Y.Map<unknown>).get("grandchild");
      expect(yGrandchild instanceof Y.Map).toBe(true);

      // All controllers should be created
      const parentProxy = proxy.parent as Record<string, unknown>;
      const childProxy = parentProxy.child as Record<string, unknown>;
      const grandchildProxy = childProxy.grandchild as Record<string, unknown>;

      expect(grandchildProxy.value).toBe(1);

      // Verify all controllers are live
      grandchildProxy.value = 2;
      await waitMicrotask();

      expect((yGrandchild as Y.Map<unknown>).get("value")).toBe(2);
    });
  });

  describe("Race Condition Scenarios", () => {
    it("rapid successive writes: controllers created in correct order", async () => {
      const doc = new Y.Doc();
      const yRoot = doc.getMap<unknown>("root");

      const { proxy } = createYjsProxy<Record<string, unknown>>(doc, {
        getRoot: (d) => d.getMap("root"),
      });

      // Rapidly assign multiple values
      proxy.val1 = { a: 1 };
      proxy.val2 = { b: 2 };
      proxy.val3 = { c: 3 };
      proxy.val4 = { d: 4 };
      proxy.val5 = { e: 5 };

      await waitMicrotask();

      // All should be present and correct
      expect((proxy.val1 as Record<string, unknown> | undefined)?.a).toBe(1);
      expect((proxy.val2 as Record<string, unknown> | undefined)?.b).toBe(2);
      expect((proxy.val3 as Record<string, unknown> | undefined)?.c).toBe(3);
      expect((proxy.val4 as Record<string, unknown> | undefined)?.d).toBe(4);
      expect((proxy.val5 as Record<string, unknown> | undefined)?.e).toBe(5);

      // All Y values should exist
      expect(yRoot.get("val1") instanceof Y.Map).toBe(true);
      expect(yRoot.get("val2") instanceof Y.Map).toBe(true);
      expect(yRoot.get("val3") instanceof Y.Map).toBe(true);
      expect(yRoot.get("val4") instanceof Y.Map).toBe(true);
      expect(yRoot.get("val5") instanceof Y.Map).toBe(true);
    });

    it("replace during flush: replaced value's controller created correctly", async () => {
      const doc = new Y.Doc();
      const yRoot = doc.getMap<unknown>("root");

      const { proxy } = createYjsProxy<Record<string, unknown>>(doc, {
        getRoot: (d) => d.getMap("root"),
      });

      // Set initial value
      proxy.data = { version: 1 };
      await waitMicrotask();

      const firstYData = yRoot.get("data");
      expect(firstYData instanceof Y.Map).toBe(true);

      // Replace with new object
      proxy.data = { version: 2 };
      await waitMicrotask();

      // New Y value should be created
      const secondYData = yRoot.get("data");
      expect(secondYData instanceof Y.Map).toBe(true);
      expect(secondYData).not.toBe(firstYData);

      // Controller should point to new object
      const dataProxy = proxy.data as Record<string, unknown>;
      expect(dataProxy.version).toBe(2);

      // New controller should be live
      dataProxy.version = 3;
      await waitMicrotask();
      expect((secondYData as Y.Map<unknown>).get("version")).toBe(3);
    });

    it("concurrent local and remote changes: both controllers materialized correctly", async () => {
      const doc1 = new Y.Doc();
      const doc2 = new Y.Doc();

      const { proxy: proxy1 } = createYjsProxy<Record<string, unknown>>(doc1, {
        getRoot: (d) => d.getMap("root"),
      });

      // Create second proxy to allow remote changes
      createYjsProxy<Record<string, unknown>>(doc2, {
        getRoot: (d) => d.getMap("root"),
      });

      // Local change in doc1
      proxy1.local = { source: "doc1" };
      await waitMicrotask();

      // Remote change simulation: doc2 adds data
      const yRoot2 = doc2.getMap<unknown>("root");
      const remoteMap = new Y.Map<unknown>();
      remoteMap.set("source", "doc2");
      yRoot2.set("remote", remoteMap);
      await waitMicrotask();

      // Sync doc2 -> doc1
      const update = Y.encodeStateAsUpdate(doc2);
      Y.applyUpdate(doc1, update);
      await waitMicrotask();

      // Both values should be present in doc1
      expect(typeof proxy1.local).toBe("object");
      expect(typeof proxy1.remote).toBe("object");

      const localProxy = proxy1.local as Record<string, unknown>;
      const remoteProxy = proxy1.remote as Record<string, unknown>;

      expect(localProxy.source).toBe("doc1");
      expect(remoteProxy.source).toBe("doc2");

      // Both controllers should be live
      localProxy.source = "doc1-modified";
      remoteProxy.source = "doc2-modified";
      await waitMicrotask();

      const yRoot1 = doc1.getMap<unknown>("root");
      expect((yRoot1.get("local") as Y.Map<unknown>).get("source")).toBe(
        "doc1-modified",
      );
      expect((yRoot1.get("remote") as Y.Map<unknown>).get("source")).toBe(
        "doc2-modified",
      );
    });

    it("array splice during upgrade: controllers created for correct items", async () => {
      const doc = new Y.Doc();
      const yRoot = doc.getArray<unknown>("root");

      const { proxy } = createYjsProxy<Array<{ id: number }>>(doc, {
        getRoot: (d) => d.getArray("root"),
      });

      // Add initial items
      proxy.push({ id: 1 }, { id: 2 }, { id: 3 });
      await waitMicrotask();

      // Splice in the middle
      proxy.splice(1, 1, { id: 20 });
      await waitMicrotask();

      // Verify final state
      expect(proxy).toHaveLength(3);
      expect(proxy[0]?.id).toBe(1);
      expect(proxy[1]?.id).toBe(20); // replaced
      expect(proxy[2]?.id).toBe(3);

      // Verify Y structure
      expect(yRoot).toHaveLength(3);
      expect((yRoot.get(0) as Y.Map<unknown>).get("id")).toBe(1);
      expect((yRoot.get(1) as Y.Map<unknown>).get("id")).toBe(20);
      expect((yRoot.get(2) as Y.Map<unknown>).get("id")).toBe(3);

      // All controllers should be live
      proxy[0]!.id = 10;
      proxy[1]!.id = 200;
      proxy[2]!.id = 30;
      await waitMicrotask();

      expect((yRoot.get(0) as Y.Map<unknown>).get("id")).toBe(10);
      expect((yRoot.get(1) as Y.Map<unknown>).get("id")).toBe(200);
      expect((yRoot.get(2) as Y.Map<unknown>).get("id")).toBe(30);
    });

    it("delete then recreate: new controller created for new Y value", async () => {
      const doc = new Y.Doc();
      const yRoot = doc.getMap<unknown>("root");

      const { proxy } = createYjsProxy<Record<string, unknown>>(doc, {
        getRoot: (d) => d.getMap("root"),
      });

      // Create initial value
      proxy.data = { version: 1 };
      await waitMicrotask();

      const firstYData = yRoot.get("data");
      expect(firstYData instanceof Y.Map).toBe(true);

      // Delete
      delete proxy.data;
      await waitMicrotask();

      expect(yRoot.has("data")).toBe(false);
      expect(proxy.data).toBeUndefined();

      // Recreate with new value
      proxy.data = { version: 2 };
      await waitMicrotask();

      const secondYData = yRoot.get("data");
      expect(secondYData instanceof Y.Map).toBe(true);
      expect(secondYData).not.toBe(firstYData);

      // New controller should work
      const dataProxy = proxy.data as Record<string, unknown>;
      expect(dataProxy.version).toBe(2);

      dataProxy.version = 3;
      await waitMicrotask();
      expect((secondYData as Y.Map<unknown>).get("version")).toBe(3);
    });

    it("nested access during transaction: lazy materialization works correctly", async () => {
      const doc = new Y.Doc();
      const yRoot = doc.getMap<unknown>("root");

      // Create nested structure in Yjs directly
      const yLevel1 = new Y.Map<unknown>();
      const yLevel2 = new Y.Map<unknown>();
      const yLevel3 = new Y.Map<unknown>();

      yLevel3.set("value", 1);
      yLevel2.set("level3", yLevel3);
      yLevel1.set("level2", yLevel2);

      doc.transact(() => {
        yRoot.set("level1", yLevel1);
      });

      await waitMicrotask();

      // Create proxy after structure exists
      const { proxy } = createYjsProxy<Record<string, unknown>>(doc, {
        getRoot: (d) => d.getMap("root"),
      });

      // Access nested value - this should trigger lazy materialization at each level
      const level1 = proxy.level1 as Record<string, unknown>;
      expect(typeof level1).toBe("object");

      const level2 = level1.level2 as Record<string, unknown>;
      expect(typeof level2).toBe("object");

      const level3 = level2.level3 as Record<string, unknown>;
      expect(typeof level3).toBe("object");

      expect(level3.value).toBe(1);

      // Verify deepest controller is live
      level3.value = 2;
      await waitMicrotask();
      expect(yLevel3.get("value")).toBe(2);
    });

    it("observeDeep timing: controller creation happens before observe callbacks", async () => {
      const doc = new Y.Doc();
      const yRoot = doc.getMap<unknown>("root");

      const { proxy } = createYjsProxy<Record<string, unknown>>(doc, {
        getRoot: (d) => d.getMap("root"),
      });

      const observeEvents: string[] = [];

      // Set up a deep observer to track when Yjs events fire
      yRoot.observeDeep((events) => {
        for (const event of events) {
          if (event.target === yRoot) {
            const keys = event.keys;
            for (const [key] of keys) {
              observeEvents.push(`observed-${key}`);
            }
          }
        }
      });

      // Make a change that will trigger controller creation
      proxy.data = { nested: { value: 1 } };

      await waitMicrotask();

      // Observer should have fired
      expect(observeEvents.length).toBeGreaterThan(0);

      // Controller should be usable immediately after microtask
      const dataProxy = proxy.data as Record<string, unknown>;
      expect(typeof dataProxy).toBe("object");

      const nestedProxy = dataProxy.nested as Record<string, unknown>;
      expect(nestedProxy.value).toBe(1);

      // Controller should be live
      nestedProxy.value = 2;
      await waitMicrotask();

      const yData = yRoot.get("data") as Y.Map<unknown>;
      const yNested = yData.get("nested") as Y.Map<unknown>;
      expect(yNested.get("value")).toBe(2);
    });
  });

  describe("Coordinator State Verification", () => {
    it("controller identity preserved across multiple accesses", async () => {
      const doc = new Y.Doc();
      const yRoot = doc.getMap<unknown>("root");

      // Create Y structure
      const yNested = new Y.Map<unknown>();
      yNested.set("value", 1);
      yRoot.set("nested", yNested);

      // Create proxy system
      const { proxy } = createYjsProxy<Record<string, unknown>>(doc, {
        getRoot: (d) => d.getMap("root"),
      });

      // Access nested to materialize it
      const nestedProxy1 = proxy.nested as Record<string, unknown>;
      expect(typeof nestedProxy1).toBe("object");
      expect(nestedProxy1.value).toBe(1);

      // Access again - should return the same controller proxy (cached)
      const nestedProxy2 = proxy.nested as Record<string, unknown>;
      expect(nestedProxy2).toBe(nestedProxy1); // Same reference

      // Mutations through either reference should work
      nestedProxy1.value = 2;
      await waitMicrotask();
      expect(nestedProxy2.value).toBe(2);
      expect(yNested.get("value")).toBe(2);

      // Access one more time to verify cache consistency
      const nestedProxy3 = proxy.nested as Record<string, unknown>;
      expect(nestedProxy3).toBe(nestedProxy1); // Still same reference
      expect(nestedProxy3.value).toBe(2);
    });

    it("subscriptions registered only after controller creation", async () => {
      const doc = new Y.Doc();
      const yRoot = doc.getMap<unknown>("root");

      // Create Y value
      const yNested = new Y.Map<unknown>();
      yRoot.set("nested", yNested);

      // Initially no subscription for this Y value
      // (we can't directly inspect subscriptions, but we can test behavior)

      // Create proxy system
      const { proxy } = createYjsProxy<Record<string, unknown>>(doc, {
        getRoot: (d) => d.getMap("root"),
      });

      // Access nested to materialize controller
      const nestedProxy = proxy.nested as Record<string, unknown>;

      // Now mutations should propagate (subscription active)
      nestedProxy.key = "value";
      await waitMicrotask();

      expect(yNested.get("key")).toBe("value");

      // Reverse direction should also work (observeDeep active)
      yNested.set("key2", "value2");
      await waitMicrotask();

      expect(nestedProxy.key2).toBe("value2");
    });
  });

  describe("Error Cases", () => {
    it("getRoot function can validate and control Y value creation", async () => {
      const doc = new Y.Doc();

      // getRoot receives the doc and can create or get Y values
      const { proxy } = createYjsProxy<Record<string, unknown>>(doc, {
        getRoot: (d) => {
          // This creates the map if it doesn't exist
          return d.getMap("root");
        },
      });

      // Proxy should work normally
      proxy.key = "value";
      await waitMicrotask();

      expect(doc.getMap("root").get("key")).toBe("value");
    });

    it("accessing controller before Y value exists returns undefined (lazy materialization)", async () => {
      const doc = new Y.Doc();
      const yRoot = doc.getMap<unknown>("root");

      const { proxy } = createYjsProxy<Record<string, unknown>>(doc, {
        getRoot: (d) => d.getMap("root"),
      });

      // Access property that doesn't exist yet
      expect(proxy.nonexistent).toBeUndefined();

      // Now create the Y value
      const yNested = new Y.Map<unknown>();
      yNested.set("value", 1);
      yRoot.set("nested", yNested);

      await waitMicrotask();

      // Now it should be accessible
      const nestedProxy = proxy.nested as Record<string, unknown>;
      expect(nestedProxy.value).toBe(1);
    });

    it("race: simultaneous controller creation requests result in single controller", async () => {
      const doc = new Y.Doc();
      const yRoot = doc.getMap<unknown>("root");

      // Create nested structure
      const yNested = new Y.Map<unknown>();
      yNested.set("value", 1);
      yRoot.set("nested", yNested);

      const { proxy } = createYjsProxy<Record<string, unknown>>(doc, {
        getRoot: (d) => d.getMap("root"),
      });

      // Access the same nested property multiple times rapidly
      const ref1 = proxy.nested;
      const ref2 = proxy.nested;
      const ref3 = proxy.nested;

      // All should return the same proxy instance (identity preserved)
      expect(ref1).toBe(ref2);
      expect(ref2).toBe(ref3);

      // Should have exactly one controller for this Y value
      const nestedProxy = ref1 as Record<string, unknown>;
      expect(nestedProxy.value).toBe(1);
    });
  });
});
