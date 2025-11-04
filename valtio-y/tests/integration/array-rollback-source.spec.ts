/**
 * Array Rollback from Y.Array Source Tests
 *
 * These tests verify that when array validation fails, the rollback mechanism
 * uses Y.Array as the source of truth to restore the Valtio array state.
 *
 * Coverage areas:
 * 1. Rollback Uses Y.Array as Source - Array contents match Y.Array.toArray() after rollback
 * 2. Complex Operation Sequences - Rollback handles multiple operations correctly
 * 3. Validation Failure Scenarios - Various validation failures trigger proper rollback
 *
 * Context: When validation fails during Valtio→Yjs sync, we rollback the Valtio
 * array by calling yArray.toArray() and reconstructing controllers from Y types.
 * This ensures the Valtio array exactly matches the Y.Array state.
 *
 * Implementation: valtio-bridge.ts:122-132 triggers rollback on validation error
 * controller-helpers.ts:71-87 implements rollbackArrayChanges using yArray.toArray()
 */

import { describe, expect, it } from "vitest";
import * as Y from "yjs";
import { createYjsProxy } from "../../src/index";

const waitMicrotask = () => Promise.resolve();

describe("Array Rollback from Y.Array Source", () => {
  describe("Rollback Uses Y.Array as Source of Truth", () => {
    it("validation failure: array contents match Y.Array.toArray() exactly", async () => {
      const doc = new Y.Doc();
      const yRoot = doc.getArray<unknown>("root");

      const { proxy } = createYjsProxy<Array<{ id: number; value: number }>>(
        doc,
        {
          getRoot: (d) => d.getArray("root"),
        },
      );

      // Set up initial state
      proxy.push({ id: 1, value: 10 }, { id: 2, value: 20 });
      await waitMicrotask();

      // Verify initial state
      expect(proxy).toHaveLength(2);
      expect(yRoot).toHaveLength(2);

      // Attempt invalid operation (push object with undefined property)
      try {
        // @ts-expect-error - intentionally passing undefined to trigger validation
        proxy.push({ id: 3, value: undefined });
        await waitMicrotask();
      } catch {
        // Expected to throw validation error
      }

      // After rollback, array should match Y.Array exactly (no new item added)
      expect(proxy).toHaveLength(2);
      expect(proxy[0]!.id).toBe(1);
      expect(proxy[0]!.value).toBe(10);
      expect(proxy[1]!.id).toBe(2);
      expect(proxy[1]!.value).toBe(20);

      // Verify Y.Array unchanged
      expect(yRoot).toHaveLength(2);
      expect((yRoot.get(0) as Y.Map<unknown>).get("value")).toBe(10);
    });

    it("rollback doesn't use stale Valtio state", async () => {
      const doc = new Y.Doc();
      const yRoot = doc.getArray<unknown>("root");

      const { proxy } = createYjsProxy<Array<{ value: number }>>(doc, {
        getRoot: (d) => d.getArray("root"),
      });

      // Set up initial state
      proxy.push({ value: 1 });
      await waitMicrotask();

      // Modify via Yjs directly (simulating remote change)
      const yItem = yRoot.get(0) as Y.Map<unknown>;
      yItem.set("value", 100);
      await waitMicrotask();

      // Valtio should have updated
      expect(proxy[0]!.value).toBe(100);

      // Now attempt invalid operation
      try {
        // @ts-expect-error - intentionally passing undefined
        proxy.push({ value: undefined });
        await waitMicrotask();
      } catch {
        // Expected
      }

      // Rollback should preserve Y.Array state (100)
      expect(proxy).toHaveLength(1);
      expect(proxy[0]!.value).toBe(100);
      expect(yItem.get("value")).toBe(100);
    });

    it("rollback recreates controller proxies from Y types", async () => {
      const doc = new Y.Doc();
      const yRoot = doc.getArray<unknown>("root");

      const { proxy } = createYjsProxy<Array<{ nested: { value: number } }>>(
        doc,
        {
          getRoot: (d) => d.getArray("root"),
        },
      );

      // Create nested structure
      proxy.push({ nested: { value: 1 } });
      await waitMicrotask();

      // Trigger validation error
      try {
        // @ts-expect-error - intentionally passing undefined
        proxy.push({ nested: { value: undefined } });
        await waitMicrotask();
      } catch {
        // Expected
      }

      // After rollback, controllers should be from Y types
      const rolledBackItem = proxy[0]!;
      const rolledBackNested = rolledBackItem.nested;

      // Values should be correct (from Y.Array)
      expect(rolledBackNested.value).toBe(1);

      // Controllers should still be live (not plain objects)
      rolledBackNested.value = 2;
      await waitMicrotask();

      const yItem = yRoot.get(0) as Y.Map<unknown>;
      const yNested = yItem.get("nested") as Y.Map<unknown>;
      expect(yNested.get("value")).toBe(2);
    });

    it("rollback with mixed primitives and objects", async () => {
      const doc = new Y.Doc();

      const { proxy } = createYjsProxy<Array<number | { id: number }>>(doc, {
        getRoot: (d) => d.getArray("root"),
      });

      // Create mixed array
      proxy.push(1, { id: 2 }, 3, { id: 4 });
      await waitMicrotask();

      expect(proxy).toHaveLength(4);

      // Trigger validation error
      try {
        // @ts-expect-error - intentionally passing undefined
        proxy.push({ id: undefined });
        await waitMicrotask();
      } catch {
        // Expected
      }

      // After rollback, array should match Y.Array (no new item)
      expect(proxy).toHaveLength(4);
      expect(proxy[0]).toBe(1);
      expect((proxy[1] as { id: number }).id).toBe(2);
      expect(proxy[2]).toBe(3);
      expect((proxy[3] as { id: number }).id).toBe(4);
    });
  });

  describe("Complex Operation Sequences", () => {
    it("validation failure during batch operations", async () => {
      const doc = new Y.Doc();
      const yRoot = doc.getArray<unknown>("root");

      const { proxy } = createYjsProxy<Array<{ id: number }>>(doc, {
        getRoot: (d) => d.getArray("root"),
      });

      // Set up initial state
      proxy.push({ id: 1 }, { id: 2 }, { id: 3 });
      await waitMicrotask();

      // Verify initial state
      expect(proxy).toHaveLength(3);

      // Attempt to push invalid item
      try {
        // @ts-expect-error - intentionally passing undefined
        proxy.push({ id: undefined });
        await waitMicrotask();
      } catch {
        // Expected
      }

      // Rollback should preserve original state
      expect(proxy).toHaveLength(3);
      expect(proxy[0]!.id).toBe(1);
      expect(proxy[1]!.id).toBe(2);
      expect(proxy[2]!.id).toBe(3);

      // Verify Y.Array matches
      expect(yRoot).toHaveLength(3);
    });

    it("rollback with nested objects in arrays", async () => {
      const doc = new Y.Doc();

      const { proxy } = createYjsProxy<
        Array<{ user: { name: string; age: number } }>
      >(doc, {
        getRoot: (d) => d.getArray("root"),
      });

      // Create array with nested objects
      proxy.push(
        { user: { name: "Alice", age: 30 } },
        { user: { name: "Bob", age: 25 } },
      );
      await waitMicrotask();

      // Trigger validation error
      try {
        // @ts-expect-error - intentionally passing undefined
        proxy.push({ user: { name: "Charlie", age: undefined } });
        await waitMicrotask();
      } catch {
        // Expected
      }

      // After rollback, nested objects should be intact
      expect(proxy).toHaveLength(2);
      expect(proxy[0]!.user.name).toBe("Alice");
      expect(proxy[0]!.user.age).toBe(30);
      expect(proxy[1]!.user.name).toBe("Bob");
      expect(proxy[1]!.user.age).toBe(25);

      // Verify controllers are live
      proxy[0]!.user.age = 31;
      await waitMicrotask();

      const yRoot = doc.getArray<unknown>("root");
      const yItem = yRoot.get(0) as Y.Map<unknown>;
      const yUser = yItem.get("user") as Y.Map<unknown>;
      expect(yUser.get("age")).toBe(31);
    });

    it("rollback after concurrent modifications", async () => {
      const doc1 = new Y.Doc();
      const doc2 = new Y.Doc();

      const { proxy: proxy1 } = createYjsProxy<Array<{ id: number }>>(doc1, {
        getRoot: (d) => d.getArray("root"),
      });

      const { proxy: proxy2 } = createYjsProxy<Array<{ id: number }>>(doc2, {
        getRoot: (d) => d.getArray("root"),
      });

      // Set up initial state in doc1
      proxy1.push({ id: 1 }, { id: 2 });
      await waitMicrotask();

      // Sync to doc2
      const update = Y.encodeStateAsUpdate(doc1);
      Y.applyUpdate(doc2, update);
      await waitMicrotask();

      // Verify doc2 has the data
      expect(proxy2).toHaveLength(2);

      // Make remote change in doc2
      proxy2.push({ id: 3 });
      await waitMicrotask();

      // Sync back to doc1
      const update2 = Y.encodeStateAsUpdate(doc2);
      Y.applyUpdate(doc1, update2);
      await waitMicrotask();

      // doc1 should have all 3 items
      expect(proxy1).toHaveLength(3);

      // Now trigger validation error in doc1
      try {
        // @ts-expect-error - intentionally passing undefined
        proxy1.push({ id: undefined });
        await waitMicrotask();
      } catch {
        // Expected
      }

      // Rollback should preserve the correct merged state
      expect(proxy1).toHaveLength(3);
      expect(proxy1[0]!.id).toBe(1);
      expect(proxy1[1]!.id).toBe(2);
      expect(proxy1[2]!.id).toBe(3);
    });
  });

  describe("Validation Failure Scenarios", () => {
    it("undefined value validation triggers rollback", async () => {
      const doc = new Y.Doc();

      const { proxy } = createYjsProxy<Array<{ id: number }>>(doc, {
        getRoot: (d) => d.getArray("root"),
      });

      proxy.push({ id: 1 });
      await waitMicrotask();

      // Push object with undefined - should trigger validation error
      expect(() => {
        // @ts-expect-error - intentionally passing undefined
        proxy.push({ id: undefined });
      }).toThrow();

      // Array should be unchanged after rollback
      expect(proxy).toHaveLength(1);
      expect(proxy[0]!.id).toBe(1);
    });

    it("deeply nested undefined validation triggers rollback", async () => {
      const doc = new Y.Doc();

      const { proxy } = createYjsProxy<
        Array<{ level1: { level2: { level3: { value: number } } } }>
      >(doc, {
        getRoot: (d) => d.getArray("root"),
      });

      // Create deeply nested structure
      proxy.push({
        level1: {
          level2: {
            level3: {
              value: 42,
            },
          },
        },
      });
      await waitMicrotask();

      // Trigger validation error at deep level
      expect(() => {
        proxy.push({
          level1: {
            level2: {
              level3: {
                // @ts-expect-error - intentionally passing undefined
                value: undefined,
              },
            },
          },
        });
      }).toThrow();

      // Array should remain unchanged
      expect(proxy).toHaveLength(1);
      expect(proxy[0]!.level1.level2.level3.value).toBe(42);
    });

    it("post-rollback array is live and writable", async () => {
      const doc = new Y.Doc();

      const { proxy } = createYjsProxy<Array<{ value: number }>>(doc, {
        getRoot: (d) => d.getArray("root"),
      });

      // Set up initial state
      proxy.push({ value: 1 });
      await waitMicrotask();

      // Trigger rollback
      try {
        // @ts-expect-error - intentionally passing undefined
        proxy.push({ value: undefined });
        await waitMicrotask();
      } catch {
        // Expected
      }

      // Verify rollback worked
      expect(proxy).toHaveLength(1);
      expect(proxy[0]!.value).toBe(1);

      // Array should still be live and writable
      proxy.push({ value: 2 });
      await waitMicrotask();

      expect(proxy).toHaveLength(2);
      expect(proxy[1]!.value).toBe(2);

      // Verify Y.Array synced
      const yRoot = doc.getArray<unknown>("root");
      expect(yRoot).toHaveLength(2);
      expect((yRoot.get(1) as Y.Map<unknown>).get("value")).toBe(2);

      // Existing items should still be writable
      proxy[0]!.value = 10;
      await waitMicrotask();
      expect((yRoot.get(0) as Y.Map<unknown>).get("value")).toBe(10);
    });

    it("multiple rollbacks in succession", async () => {
      const doc = new Y.Doc();

      const { proxy } = createYjsProxy<Array<{ id: number }>>(doc, {
        getRoot: (d) => d.getArray("root"),
      });

      proxy.push({ id: 1 }, { id: 2 });
      await waitMicrotask();

      // First rollback
      try {
        // @ts-expect-error
        proxy.push({ id: undefined });
        await waitMicrotask();
      } catch {
        // Expected
      }

      expect(proxy).toHaveLength(2);
      expect(proxy[0]!.id).toBe(1);

      // Second rollback
      try {
        // @ts-expect-error
        proxy.push({ id: undefined });
        await waitMicrotask();
      } catch {
        // Expected
      }

      expect(proxy).toHaveLength(2);
      expect(proxy[1]!.id).toBe(2);

      // Array should still be functional
      proxy.push({ id: 3 });
      await waitMicrotask();

      expect(proxy).toHaveLength(3);
      const yRoot = doc.getArray<unknown>("root");
      expect((yRoot.get(2) as Y.Map<unknown>).get("id")).toBe(3);
    });

    it("rollback with empty array", async () => {
      const doc = new Y.Doc();

      const { proxy } = createYjsProxy<Array<{ id: number }>>(doc, {
        getRoot: (d) => d.getArray("root"),
      });

      // Start with empty array
      expect(proxy).toHaveLength(0);

      // Try to push invalid item
      try {
        // @ts-expect-error
        proxy.push({ id: undefined });
        await waitMicrotask();
      } catch {
        // Expected
      }

      // Array should remain empty
      expect(proxy).toHaveLength(0);

      // Array should still be functional
      proxy.push({ id: 1 });
      await waitMicrotask();

      expect(proxy).toHaveLength(1);
      expect(proxy[0]!.id).toBe(1);
    });

    it("rollback with function value (unsupported) triggers error and rollback", async () => {
      const doc = new Y.Doc();

      const { proxy } = createYjsProxy<Array<{ callback?: () => void }>>(doc, {
        getRoot: (d) => d.getArray("root"),
      });

      // Try to push function (not supported in Y.js)
      expect(() => {
        proxy.push({ callback: () => console.log("test") });
      }).toThrow();

      // Array should remain empty
      expect(proxy).toHaveLength(0);
    });
  });
});
