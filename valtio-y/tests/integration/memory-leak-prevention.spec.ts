/**
 * Memory Leak Prevention Tests
 *
 * These tests verify that valtio-y properly cleans up resources when controllers
 * are deleted, replaced, or removed from arrays to prevent memory leaks.
 *
 * Coverage areas:
 * 1. Subscription Cleanup - Valtio subscriptions are unregistered when controllers deleted
 * 2. Cache Cleanup - Both yTypeToValtioProxy and valtioProxyToYType caches are cleared
 * 3. Long-Running Scenarios - Repeated operations don't accumulate memory
 *
 * Context: Controllers (Valtio proxies) subscribe to Yjs changes and vice versa.
 * When a controller is deleted/replaced, we must:
 * - Unsubscribe the Valtio subscription
 * - Remove from yTypeToValtioProxy cache
 * - Remove from valtioProxyToYType cache
 */

import { describe, expect, it } from "vitest";
import * as Y from "yjs";
import { createYjsProxy } from "../../src/index";

const waitMicrotask = () => Promise.resolve();

// Type definitions for test scenarios
interface NestedState {
  nested?: { value: number };
}

interface DataState {
  data?: { version: number };
}

interface DeepNestedState {
  parent?: {
    child?: {
      grandchild?: {
        value: number;
      };
      [key: string]: unknown;
    };
    [key: string]: unknown;
  };
}

interface TempFinalState {
  temp?: { iteration: number };
  final?: { value: number };
}

interface ComplexNestedState {
  parent?: {
    child?: {
      grandchild?: {
        value: number;
      };
    };
  };
}

interface MixedDataState {
  data?: {
    users?: Array<{ id: number; name: string }>;
    settings?: { theme?: string; [key: string]: string | number | undefined };
  };
}

describe("Memory Leak Prevention", () => {
  describe("Subscription Cleanup", () => {
    it("deleted map controller: no longer receives updates from Yjs", async () => {
      const doc = new Y.Doc();
      const yRoot = doc.getMap<unknown>("root");

      const { proxy } = createYjsProxy<NestedState>(doc, {
        getRoot: (d) => d.getMap("root"),
      });

      // Create nested object
      proxy.nested = { value: 1 };
      await waitMicrotask();

      const nestedProxy = proxy.nested!;
      const yNested = yRoot.get("nested") as Y.Map<unknown>;

      // Verify initial state
      expect(nestedProxy.value).toBe(1);

      // Delete the nested controller
      delete proxy.nested;
      await waitMicrotask();

      // Mutate the Y.Map directly (simulating remote change)
      yNested.set("value", 2);
      await waitMicrotask();

      // The deleted controller should not update
      // (if subscription wasn't cleaned up, it might still update)
      expect(nestedProxy.value).toBe(1); // Frozen at deletion time
      expect(proxy.nested).toBeUndefined();
    });

    it("deleted array item: no longer receives updates from Yjs", async () => {
      const doc = new Y.Doc();
      const yRoot = doc.getArray<unknown>("root");

      const { proxy } = createYjsProxy<Array<{ id: number; value: number }>>(
        doc,
        {
          getRoot: (d) => d.getArray("root"),
        },
      );

      // Create array with object
      proxy.push({ id: 1, value: 10 });
      await waitMicrotask();

      const itemProxy = proxy[0]!;
      const yItem = yRoot.get(0) as Y.Map<unknown>;

      // Verify initial state
      expect(itemProxy.value).toBe(10);

      // Remove the item from array
      proxy.splice(0, 1);
      await waitMicrotask();

      // Mutate the Y.Map directly
      yItem.set("value", 20);
      await waitMicrotask();

      // The removed controller should not update
      expect(itemProxy.value).toBe(10); // Frozen at removal time
      expect(proxy).toHaveLength(0);
    });

    it("replaced controller: old controller no longer receives updates", async () => {
      const doc = new Y.Doc();
      const yRoot = doc.getMap<unknown>("root");

      const { proxy } = createYjsProxy<DataState>(doc, {
        getRoot: (d) => d.getMap("root"),
      });

      // Create initial nested object
      proxy.data = { version: 1 };
      await waitMicrotask();

      const oldProxy = proxy.data!;
      const oldYMap = yRoot.get("data") as Y.Map<unknown>;

      // Replace with new object
      proxy.data = { version: 2 };
      await waitMicrotask();

      const newProxy = proxy.data!;
      const newYMap = yRoot.get("data") as Y.Map<unknown>;

      expect(newYMap).not.toBe(oldYMap);
      expect(newProxy).not.toBe(oldProxy);

      // Mutate the old Y.Map
      oldYMap.set("version", 999);
      await waitMicrotask();

      // Old controller should not update
      expect(oldProxy.version).toBe(1); // Frozen
      expect(newProxy.version).toBe(2); // Unchanged
    });

    it("bidirectional cleanup: both Valtio→Yjs and Yjs→Valtio subscriptions removed", async () => {
      const doc = new Y.Doc();
      const yRoot = doc.getMap<unknown>("root");

      const { proxy } = createYjsProxy<NestedState>(doc, {
        getRoot: (d) => d.getMap("root"),
      });

      // Create nested object
      proxy.nested = { value: 1 };
      await waitMicrotask();

      const nestedProxy = proxy.nested!;
      const yNested = yRoot.get("nested") as Y.Map<unknown>;

      // Test bidirectional sync works
      nestedProxy.value = 2;
      await waitMicrotask();
      expect(yNested.get("value")).toBe(2);

      yNested.set("value", 3);
      await waitMicrotask();
      expect(nestedProxy.value).toBe(3);

      // Delete the controller
      delete proxy.nested;
      await waitMicrotask();

      // Verify the nested proxy was deleted from the parent
      expect(proxy.nested).toBeUndefined();

      // After deletion, verify that subscriptions are cleaned up by:
      // 1. Creating a new nested object
      // 2. Verifying the old proxy is disconnected and frozen at deletion state

      const oldProxyValueBeforeDelete = nestedProxy.value; // Should be 3

      // Create a new nested object with the same key
      proxy.nested = { value: 100 };
      await waitMicrotask();

      // Old proxy should remain at the value it had when deleted (frozen)
      expect(nestedProxy.value).toBe(oldProxyValueBeforeDelete); // Frozen at 3

      // New proxy should work independently
      const newNestedProxy = proxy.nested!;
      expect(newNestedProxy.value).toBe(100);

      // Mutating new proxy shouldn't affect old proxy
      newNestedProxy.value = 200;
      await waitMicrotask();
      expect(nestedProxy.value).toBe(oldProxyValueBeforeDelete); // Still frozen at 3
      expect(newNestedProxy.value).toBe(200); // New proxy updated
    });

    it("array splice: removed items have subscriptions cleaned up", async () => {
      const doc = new Y.Doc();
      const yRoot = doc.getArray<unknown>("root");

      const { proxy } = createYjsProxy<Array<{ id: number }>>(doc, {
        getRoot: (d) => d.getArray("root"),
      });

      // Create array with multiple objects
      proxy.push({ id: 1 }, { id: 2 }, { id: 3 });
      await waitMicrotask();

      const item1 = proxy[0]!;
      const item2 = proxy[1]!;

      const yItem1 = yRoot.get(0) as Y.Map<unknown>;
      const yItem2 = yRoot.get(1) as Y.Map<unknown>;

      // Remove middle item via splice
      proxy.splice(1, 1);
      await waitMicrotask();

      // Verify array state (item3 now at index 1)
      expect(proxy).toHaveLength(2);
      expect(proxy[0]!.id).toBe(1);
      expect(proxy[1]!.id).toBe(3);

      // Test that removed item's subscription is cleaned up
      yItem2.set("id", 999);
      await waitMicrotask();
      expect(item2.id).toBe(2); // Frozen

      // Test that retained items still work
      yItem1.set("id", 111);
      await waitMicrotask();
      expect(item1.id).toBe(111); // Updated
      expect(proxy[0]!.id).toBe(111); // Reflects in array
    });

    it("nested structure deletion: all child subscriptions cleaned up", async () => {
      const doc = new Y.Doc();
      const yRoot = doc.getMap<unknown>("root");

      const { proxy } = createYjsProxy<DeepNestedState>(doc, {
        getRoot: (d) => d.getMap("root"),
      });

      // Create deeply nested structure
      proxy.parent = {
        child: {
          grandchild: {
            value: 1,
          },
        },
      };
      await waitMicrotask();

      const parentProxy = proxy.parent!;
      const childProxy = parentProxy.child!;
      const grandchildProxy = childProxy.grandchild!;

      const yParent = yRoot.get("parent") as Y.Map<unknown>;
      const yChild = yParent.get("child") as Y.Map<unknown>;
      const yGrandchild = yChild.get("grandchild") as Y.Map<unknown>;

      // Delete parent - should clean up all nested subscriptions
      delete proxy.parent;
      await waitMicrotask();

      // Test grandchild subscription cleaned up
      yGrandchild.set("value", 999);
      await waitMicrotask();
      expect(grandchildProxy.value).toBe(1); // Frozen

      // Test child subscription cleaned up
      yChild.set("newKey", "newValue");
      await waitMicrotask();
      expect(childProxy.newKey).toBeUndefined(); // Not updated

      // Test parent subscription cleaned up
      yParent.set("newKey", "newValue");
      await waitMicrotask();
      expect(parentProxy.newKey).toBeUndefined(); // Not updated
    });
  });

  describe("Cache Cleanup", () => {
    it("deleted controller: creating new object uses fresh cache", async () => {
      const doc = new Y.Doc();

      const { proxy } = createYjsProxy<NestedState>(doc, {
        getRoot: (d) => d.getMap("root"),
      });

      // Create nested object
      proxy.nested = { value: 1 };
      await waitMicrotask();

      const firstProxy = proxy.nested!;

      // Delete the controller
      delete proxy.nested;
      await waitMicrotask();

      // Create a new nested object with same key
      proxy.nested = { value: 2 };
      await waitMicrotask();

      const secondProxy = proxy.nested!;

      // Should be a different proxy instance (cache was cleaned up)
      expect(secondProxy).not.toBe(firstProxy);
      expect(secondProxy.value).toBe(2);
      expect(firstProxy.value).toBe(1); // Old proxy frozen

      // Verify new proxy is live
      secondProxy.value = 3;
      await waitMicrotask();

      const yRoot = doc.getMap<unknown>("root");
      const yNested = yRoot.get("nested") as Y.Map<unknown>;
      expect(yNested.get("value")).toBe(3);

      // Old proxy should not sync
      expect(firstProxy.value).toBe(1);
    });

    it("replaced controller: old proxy no longer connected", async () => {
      const doc = new Y.Doc();
      const yRoot = doc.getMap<unknown>("root");

      const { proxy } = createYjsProxy<DataState>(doc, {
        getRoot: (d) => d.getMap("root"),
      });

      // Create initial object
      proxy.data = { version: 1 };
      await waitMicrotask();

      const oldProxy = proxy.data!;
      const oldYMap = yRoot.get("data") as Y.Map<unknown>;

      // Replace with new object
      proxy.data = { version: 2 };
      await waitMicrotask();

      const newProxy = proxy.data!;
      const newYMap = yRoot.get("data") as Y.Map<unknown>;

      // Verify they're different instances
      expect(newProxy).not.toBe(oldProxy);
      expect(newYMap).not.toBe(oldYMap);

      // Old proxy should not respond to old Y.Map changes (cache cleaned)
      oldYMap.set("version", 999);
      await waitMicrotask();
      expect(oldProxy.version).toBe(1); // Frozen

      // New proxy should work normally
      newProxy.version = 3;
      await waitMicrotask();
      expect(newYMap.get("version")).toBe(3);
    });

    it("nested structure deletion: recreating creates fresh nested proxies", async () => {
      const doc = new Y.Doc();

      const { proxy } = createYjsProxy<ComplexNestedState>(doc, {
        getRoot: (d) => d.getMap("root"),
      });

      // Create nested structure
      proxy.parent = {
        child: {
          grandchild: {
            value: 1,
          },
        },
      };
      await waitMicrotask();

      const firstParent = proxy.parent!;
      const firstChild = firstParent.child!;

      // Delete parent - should clean up all nested caches
      delete proxy.parent;
      await waitMicrotask();

      // Create new parent structure
      proxy.parent = {
        child: {
          grandchild: {
            value: 2,
          },
        },
      };
      await waitMicrotask();

      // Accessing should create new proxies
      const secondParent = proxy.parent!;
      const secondChild = secondParent.child!;

      // Verify new instances (cache was cleaned)
      expect(secondParent).not.toBe(firstParent);
      expect(secondChild).not.toBe(firstChild);

      // New proxies should be live
      const grandchild = secondChild.grandchild!;
      expect(grandchild.value).toBe(2);

      grandchild.value = 3;
      await waitMicrotask();

      const yRoot = doc.getMap<unknown>("root");
      const yParent = yRoot.get("parent") as Y.Map<unknown>;
      const yChild = yParent.get("child") as Y.Map<unknown>;
      const yGrandchild = yChild.get("grandchild") as Y.Map<unknown>;
      expect(yGrandchild.get("value")).toBe(3);
    });

    it("array splice: splicing and pushing creates fresh proxies", async () => {
      const doc = new Y.Doc();

      const { proxy } = createYjsProxy<Array<{ id: number }>>(doc, {
        getRoot: (d) => d.getArray("root"),
      });

      // Create array with objects
      proxy.push({ id: 1 }, { id: 2 }, { id: 3 });
      await waitMicrotask();

      const firstItem2 = proxy[1]!;

      // Remove item via splice
      proxy.splice(1, 1);
      await waitMicrotask();

      // Array now has [1, 3]
      expect(proxy).toHaveLength(2);

      // Push a new item with id 2
      proxy.push({ id: 2 });
      await waitMicrotask();

      // Accessing the new item should create a new proxy
      const newItem2 = proxy[2]!;

      // Verify it's a different proxy instance
      expect(newItem2).not.toBe(firstItem2);
      expect(newItem2.id).toBe(2);

      // Verify it's live
      newItem2.id = 22;
      await waitMicrotask();

      const yRoot = doc.getArray<unknown>("root");
      const yNewItem = yRoot.get(2) as Y.Map<unknown>;
      expect(yNewItem.get("id")).toBe(22);

      // Old proxy should be frozen
      expect(firstItem2.id).toBe(2);
    });

    it("delete-then-create cycle: cache properly reset", async () => {
      const doc = new Y.Doc();

      const { proxy } = createYjsProxy<TempFinalState>(doc, {
        getRoot: (d) => d.getMap("root"),
      });

      // Perform multiple delete-create cycles
      for (let i = 0; i < 10; i++) {
        proxy.temp = { iteration: i };
        await waitMicrotask();

        const tempProxy = proxy.temp!;
        expect(tempProxy.iteration).toBe(i);

        delete proxy.temp;
        await waitMicrotask();
      }

      // Final create should work correctly
      proxy.final = { value: 999 };
      await waitMicrotask();

      const finalProxy = proxy.final!;
      expect(finalProxy.value).toBe(999);

      // Verify it's live
      finalProxy.value = 1000;
      await waitMicrotask();

      const yRoot = doc.getMap<unknown>("root");
      const yFinal = yRoot.get("final") as Y.Map<unknown>;
      expect(yFinal.get("value")).toBe(1000);
    });
  });

  describe("Long-Running Scenarios", () => {
    it("repeated add/delete cycles: no subscription accumulation", async () => {
      const doc = new Y.Doc();
      const { proxy } = createYjsProxy<TempFinalState>(doc, {
        getRoot: (d) => d.getMap("root"),
      });

      // Perform many add/delete cycles
      for (let i = 0; i < 100; i++) {
        proxy.temp = { iteration: i };
        await waitMicrotask();

        delete proxy.temp;
        await waitMicrotask();
      }

      // If subscriptions accumulated, behavior would degrade
      // Test that final operations still work correctly
      proxy.final = { value: 999 };
      await waitMicrotask();

      const finalProxy = proxy.final!;
      expect(finalProxy.value).toBe(999);

      // Verify subscription still works
      finalProxy.value = 1000;
      await waitMicrotask();

      const yRoot = doc.getMap<unknown>("root");
      const yFinal = yRoot.get("final") as Y.Map<unknown>;
      expect(yFinal.get("value")).toBe(1000);
    });

    it("array push/pop loop: no memory accumulation", async () => {
      const doc = new Y.Doc();
      const { proxy } = createYjsProxy<Array<{ id: number }>>(doc, {
        getRoot: (d) => d.getArray("root"),
      });

      // Perform many push/pop cycles
      for (let i = 0; i < 100; i++) {
        proxy.push({ id: i });
        await waitMicrotask();

        proxy.pop();
        await waitMicrotask();
      }

      // Verify final state is clean
      expect(proxy).toHaveLength(0);

      // Test that operations still work
      proxy.push({ id: 999 });
      await waitMicrotask();

      expect(proxy).toHaveLength(1);
      expect(proxy[0]!.id).toBe(999);

      // Verify subscription works
      proxy[0]!.id = 1000;
      await waitMicrotask();

      const yRoot = doc.getArray<unknown>("root");
      const yItem = yRoot.get(0) as Y.Map<unknown>;
      expect(yItem.get("id")).toBe(1000);
    });

    it("array shift/unshift loop: no memory accumulation", async () => {
      const doc = new Y.Doc();
      const { proxy } = createYjsProxy<Array<{ id: number }>>(doc, {
        getRoot: (d) => d.getArray("root"),
      });

      // Perform many unshift/shift cycles
      for (let i = 0; i < 100; i++) {
        proxy.unshift({ id: i });
        await waitMicrotask();

        proxy.shift();
        await waitMicrotask();
      }

      // Verify final state is clean
      expect(proxy).toHaveLength(0);

      // Test that operations still work
      proxy.unshift({ id: 999 });
      await waitMicrotask();

      expect(proxy).toHaveLength(1);
      expect(proxy[0]!.id).toBe(999);
    });

    it("nested object creation/deletion loop: no memory accumulation", async () => {
      const doc = new Y.Doc();

      interface NestedLoopState {
        temp?: {
          nested: {
            deep: {
              value: number;
            };
          };
        };
        final?: {
          nested: {
            deep: {
              value: number;
            };
          };
        };
      }

      const { proxy } = createYjsProxy<NestedLoopState>(doc, {
        getRoot: (d) => d.getMap("root"),
      });

      // Perform many create/delete cycles with nested objects
      for (let i = 0; i < 50; i++) {
        proxy.temp = {
          nested: {
            deep: {
              value: i,
            },
          },
        };
        await waitMicrotask();

        delete proxy.temp;
        await waitMicrotask();
      }

      // Verify final state is clean
      expect(proxy.temp).toBeUndefined();

      // Test that operations still work with nested structures
      proxy.final = {
        nested: {
          deep: {
            value: 999,
          },
        },
      };
      await waitMicrotask();

      const finalProxy = proxy.final!;
      const nestedProxy = finalProxy.nested;
      const deepProxy = nestedProxy.deep;

      expect(deepProxy.value).toBe(999);

      // Verify subscription works
      deepProxy.value = 1000;
      await waitMicrotask();

      const yRoot = doc.getMap<unknown>("root");
      const yFinal = yRoot.get("final") as Y.Map<unknown>;
      const yNested = yFinal.get("nested") as Y.Map<unknown>;
      const yDeep = yNested.get("deep") as Y.Map<unknown>;
      expect(yDeep.get("value")).toBe(1000);
    });

    it("array splice in loop: no memory accumulation", async () => {
      const doc = new Y.Doc();
      const { proxy } = createYjsProxy<Array<{ id: number }>>(doc, {
        getRoot: (d) => d.getArray("root"),
      });

      // Add some initial items
      proxy.push({ id: 1 }, { id: 2 }, { id: 3 });
      await waitMicrotask();

      // Perform many splice operations
      for (let i = 0; i < 50; i++) {
        // Remove middle item
        proxy.splice(1, 1);
        await waitMicrotask();

        // Add new item
        proxy.splice(1, 0, { id: 100 + i });
        await waitMicrotask();
      }

      // Verify array still has correct length
      expect(proxy).toHaveLength(3);

      // Verify operations still work
      proxy[1]!.id = 999;
      await waitMicrotask();

      const yRoot = doc.getArray<unknown>("root");
      const yItem = yRoot.get(1) as Y.Map<unknown>;
      expect(yItem.get("id")).toBe(999);
    });

    it("mixed operations over time: system remains stable", async () => {
      const doc = new Y.Doc();
      const { proxy } = createYjsProxy<MixedDataState>(doc, {
        getRoot: (d) => d.getMap("root"),
      });

      // Create nested structure with arrays and objects
      proxy.data = {
        users: [{ id: 1, name: "Alice" }],
        settings: { theme: "dark" },
      };
      await waitMicrotask();

      const dataProxy = proxy.data!;
      const usersProxy = dataProxy.users!;
      const settingsProxy = dataProxy.settings!;

      // Perform many mixed operations
      for (let i = 0; i < 30; i++) {
        // Array operations
        usersProxy.push({ id: i + 2, name: `User${i}` });
        await waitMicrotask();

        usersProxy.shift();
        await waitMicrotask();

        // Object operations
        settingsProxy[`key${i}`] = `value${i}`;
        await waitMicrotask();

        delete settingsProxy[`key${i}`];
        await waitMicrotask();

        // Replace operations
        if (i % 10 === 0) {
          dataProxy.settings = { theme: `theme${i}` };
          await waitMicrotask();
        }
      }

      // Verify system still works correctly
      usersProxy.push({ id: 999, name: "Final User" });
      await waitMicrotask();

      expect(usersProxy[usersProxy.length - 1]!.name).toBe("Final User");

      // Verify subscription works
      usersProxy[usersProxy.length - 1]!.name = "Modified User";
      await waitMicrotask();

      const yRoot = doc.getMap<unknown>("root");
      const yData = yRoot.get("data") as Y.Map<unknown>;
      const yUsers = yData.get("users") as Y.Array<unknown>;
      const yLastUser = yUsers.get(yUsers.length - 1) as Y.Map<unknown>;
      expect(yLastUser.get("name")).toBe("Modified User");
    });
  });
});
