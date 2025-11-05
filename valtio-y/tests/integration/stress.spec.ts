/**
 * Stress Tests for valtio-y
 *
 * These tests verify that valtio-y maintains correctness and performance
 * under heavy load conditions:
 *
 * Coverage areas:
 * 1. Large Documents - 10,000+ items
 * 2. High-Frequency Operations - Rapid mutations without performance degradation
 * 3. Concurrent Updates - Multiple clients making simultaneous changes
 * 4. Memory Stability - No leaks under sustained load
 * 5. Performance Benchmarks - Critical operations complete within acceptable time
 */

import { describe, expect, it } from "vitest";
import * as Y from "yjs";
import { createYjsProxy } from "../../src/index";

const waitMicrotask = () => Promise.resolve();

describe("Stress Tests", () => {
  describe("Large Document Handling", () => {
    it("should handle 10,000 item array", async () => {
      const doc = new Y.Doc();
      const { proxy } = createYjsProxy<Array<{ id: number; value: string }>>(
        doc,
        {
          getRoot: (d) => d.getArray("root"),
        },
      );
      const yRoot = doc.getArray<unknown>("root");

      // Create 10,000 items
      const items = Array.from({ length: 10000 }, (_, i) => ({
        id: i,
        value: `item-${i}`,
      }));

      // Push in batches to avoid stack overflow
      const batchSize = 1000;
      for (let i = 0; i < items.length; i += batchSize) {
        proxy.push(...items.slice(i, i + batchSize));
      }
      await waitMicrotask();

      // Verify length
      expect(proxy).toHaveLength(10000);
      expect(yRoot).toHaveLength(10000);

      // Verify first, middle, and last items
      expect(proxy[0]!.id).toBe(0);
      expect(proxy[0]!.value).toBe("item-0");
      expect(proxy[5000]!.id).toBe(5000);
      expect(proxy[5000]!.value).toBe("item-5000");
      expect(proxy[9999]!.id).toBe(9999);
      expect(proxy[9999]!.value).toBe("item-9999");

      // Verify mutations still work
      proxy[5000]!.value = "updated";
      await waitMicrotask();
      expect((yRoot.get(5000) as Y.Map<unknown>).get("value")).toBe("updated");

      // Verify array operations still work
      proxy.push({ id: 10000, value: "item-10000" });
      await waitMicrotask();
      expect(proxy).toHaveLength(10001);
      expect(yRoot).toHaveLength(10001);
    });

    it("should handle deeply nested object with 100 levels", async () => {
      const doc = new Y.Doc();
      const { proxy } = createYjsProxy<Record<string, unknown>>(doc, {
        getRoot: (d) => d.getMap("root"),
      });

      // Create deeply nested structure
      const root: Record<string, unknown> = {};
      let current: Record<string, unknown> = root;
      for (let i = 0; i < 100; i++) {
        const next: Record<string, unknown> = {};
        current[`level${i}`] = next;
        current = next;
      }
      current.value = "deep-value"; // current is now the deepest level

      proxy.nested = root; // Assign the root, not the deepest level
      await waitMicrotask();

      // Navigate to deepest level
      let navCurrent: unknown = proxy.nested;
      for (let i = 0; i < 100; i++) {
        navCurrent = (navCurrent as Record<string, unknown>)[`level${i}`];
      }

      // Verify deepest value
      expect((navCurrent as Record<string, unknown>).value).toBe("deep-value");

      // Verify mutation works at deepest level
      (navCurrent as Record<string, unknown>).value = "updated-deep";
      await waitMicrotask();

      // Re-navigate to verify
      let verifyNav: unknown = proxy.nested;
      for (let i = 0; i < 100; i++) {
        verifyNav = (verifyNav as Record<string, unknown>)[`level${i}`];
      }
      expect((verifyNav as Record<string, unknown>).value).toBe("updated-deep");
    });

    it("should handle large nested map with 1,000 keys", async () => {
      const doc = new Y.Doc();
      const { proxy } = createYjsProxy<
        Record<string, { id: number; data: string }>
      >(doc, {
        getRoot: (d) => d.getMap("root"),
      });

      // Create 1,000 keys
      for (let i = 0; i < 1000; i++) {
        proxy[`key${i}`] = { id: i, data: `value-${i}` };
      }
      await waitMicrotask();

      // Verify all keys exist
      expect(Object.keys(proxy)).toHaveLength(1000);

      // Verify random samples
      expect(proxy.key0!.id).toBe(0);
      expect(proxy.key500!.id).toBe(500);
      expect(proxy.key999!.id).toBe(999);

      // Verify mutations work
      proxy.key500!.data = "updated";
      await waitMicrotask();
      expect(proxy.key500!.data).toBe("updated");

      // Verify deletions work
      delete proxy.key500;
      await waitMicrotask();
      expect(proxy.key500).toBeUndefined();
      expect(Object.keys(proxy)).toHaveLength(999);
    });
  });

  describe("Performance Benchmarks", () => {
    it("1000 item push should complete in < 200ms", async () => {
      const doc = new Y.Doc();
      const { proxy } = createYjsProxy<Array<{ id: number }>>(doc, {
        getRoot: (d) => d.getArray("root"),
      });

      const items = Array.from({ length: 1000 }, (_, i) => ({ id: i }));

      const start = performance.now();
      proxy.push(...items);
      await waitMicrotask();
      const elapsed = performance.now() - start;

      expect(proxy).toHaveLength(1000);
      expect(elapsed).toBeLessThan(200);
    });

    it("1000 nested mutations should complete in < 500ms", async () => {
      const doc = new Y.Doc();
      const { proxy } = createYjsProxy<Array<{ value: number }>>(doc, {
        getRoot: (d) => d.getArray("root"),
      });

      // Create initial array
      const items = Array.from({ length: 1000 }, (_, i) => ({ value: i }));
      proxy.push(...items);
      await waitMicrotask();

      // Mutate all items
      const start = performance.now();
      for (let i = 0; i < 1000; i++) {
        proxy[i]!.value = i * 2;
      }
      await waitMicrotask();
      const elapsed = performance.now() - start;

      expect(proxy[500]!.value).toBe(1000);
      expect(elapsed).toBeLessThan(500);
    });

    it("1000 splice operations should complete in < 1000ms", async () => {
      const doc = new Y.Doc();
      const { proxy } = createYjsProxy<Array<{ id: number }>>(doc, {
        getRoot: (d) => d.getArray("root"),
      });

      // Create initial array with 2000 items
      const items = Array.from({ length: 2000 }, (_, i) => ({ id: i }));
      proxy.push(...items);
      await waitMicrotask();

      // Perform 1000 splice operations
      const start = performance.now();
      for (let i = 0; i < 1000; i++) {
        // Remove one, add one (replace)
        proxy.splice(i, 1, { id: i + 10000 });
      }
      await waitMicrotask();
      const elapsed = performance.now() - start;

      expect(proxy).toHaveLength(2000);
      expect(proxy[0]!.id).toBe(10000); // First item replaced
      expect(proxy[500]!.id).toBe(10500); // Middle item replaced
      expect(elapsed).toBeLessThan(1000);
    });

    it("100 item bootstrap should complete in < 50ms", async () => {
      const doc = new Y.Doc();
      const { bootstrap } = createYjsProxy<{
        items: Array<{ id: number; nested: { value: string } }>;
      }>(doc, {
        getRoot: (d) => d.getMap("root"),
      });

      const data = {
        items: Array.from({ length: 100 }, (_, i) => ({
          id: i,
          nested: { value: `value-${i}` },
        })),
      };

      const start = performance.now();
      bootstrap(data);
      await waitMicrotask();
      const elapsed = performance.now() - start;

      expect(elapsed).toBeLessThan(50);
    });
  });

  describe("High-Frequency Operations", () => {
    it("should handle 10,000 rapid mutations without errors", async () => {
      const doc = new Y.Doc();
      const { proxy } = createYjsProxy<{ counter: number; updates: number }>(
        doc,
        {
          getRoot: (d) => d.getMap("root"),
        },
      );

      proxy.counter = 0;
      proxy.updates = 0;
      await waitMicrotask();

      // Perform 10,000 rapid mutations
      for (let i = 0; i < 10000; i++) {
        proxy.counter = i;
        if (i % 100 === 0) {
          proxy.updates++;
        }
      }
      await waitMicrotask();

      expect(proxy.counter).toBe(9999);
      expect(proxy.updates).toBe(100);
    });

    it("should handle rapid array mutations (1000 cycles)", async () => {
      const doc = new Y.Doc();
      const { proxy } = createYjsProxy<Array<number>>(doc, {
        getRoot: (d) => d.getArray("root"),
      });

      // Rapid push/pop cycles
      for (let i = 0; i < 1000; i++) {
        proxy.push(i);
        proxy.push(i + 1);
        proxy.pop();
      }
      await waitMicrotask();

      expect(proxy).toHaveLength(1000);
      expect(proxy.every((val, idx) => val === idx)).toBe(true);
    });

    it("should handle rapid nested object creation/deletion", async () => {
      const doc = new Y.Doc();
      const { proxy } = createYjsProxy<Record<string, { id: number }>>(doc, {
        getRoot: (d) => d.getMap("root"),
      });

      // Rapid create/delete cycles
      for (let i = 0; i < 500; i++) {
        proxy[`temp${i}`] = { id: i };
        if (i > 0) {
          delete proxy[`temp${i - 1}`];
        }
      }
      await waitMicrotask();

      // Should only have the last item
      expect(Object.keys(proxy)).toHaveLength(1);
      expect(proxy.temp499!.id).toBe(499);
    });
  });

  describe("Concurrent Updates Stress", () => {
    it("should handle concurrent updates from 5 clients", async () => {
      // Create 5 connected documents
      const docs = Array.from({ length: 5 }, () => new Y.Doc());
      const proxies = docs.map((doc) =>
        createYjsProxy<Array<{ clientId: number; value: number }>>(doc, {
          getRoot: (d) => d.getArray("root"),
        }),
      );

      // Set up full mesh network
      docs.forEach((docA, idxA) => {
        docA.on("update", (update: Uint8Array) => {
          docs.forEach((docB, idxB) => {
            if (idxA !== idxB) {
              Y.applyUpdate(docB, update);
            }
          });
        });
      });

      // Each client adds 100 items
      for (let clientId = 0; clientId < 5; clientId++) {
        for (let i = 0; i < 100; i++) {
          proxies[clientId]!.proxy.push({ clientId, value: i });
        }
      }
      await waitMicrotask();

      // All clients should have 500 items (5 clients × 100 items)
      for (const { proxy } of proxies) {
        expect(proxy).toHaveLength(500);
      }

      // Verify each client's contributions are present
      for (let clientId = 0; clientId < 5; clientId++) {
        const clientItems = proxies[0]!.proxy.filter(
          (item) => item.clientId === clientId,
        );
        expect(clientItems).toHaveLength(100);
      }
    });

    it("should handle simultaneous nested mutations from 3 clients", async () => {
      const docs = Array.from({ length: 3 }, () => new Y.Doc());
      const proxies = docs.map((doc) =>
        createYjsProxy<{ shared: { counters: number[] } }>(doc, {
          getRoot: (d) => d.getMap("root"),
        }),
      );

      // Set up network
      docs.forEach((docA, idxA) => {
        docA.on("update", (update: Uint8Array) => {
          docs.forEach((docB, idxB) => {
            if (idxA !== idxB) {
              Y.applyUpdate(docB, update);
            }
          });
        });
      });

      // Initialize shared state
      proxies[0]!.proxy.shared = { counters: [0, 0, 0] };
      await waitMicrotask();

      // Each client increments their counter 100 times
      for (let clientId = 0; clientId < 3; clientId++) {
        for (let i = 0; i < 100; i++) {
          proxies[clientId]!.proxy.shared.counters[clientId]!++;
        }
      }
      await waitMicrotask();

      // Each counter should be incremented 100 times across all clients
      for (const { proxy } of proxies) {
        expect(proxy.shared.counters[0]).toBe(100);
        expect(proxy.shared.counters[1]).toBe(100);
        expect(proxy.shared.counters[2]).toBe(100);
      }
    });

    it("should handle rapid conflicting array operations from 2 clients", async () => {
      const docA = new Y.Doc();
      const docB = new Y.Doc();

      const { proxy: proxyA } = createYjsProxy<Array<{ source: string }>>(
        docA,
        {
          getRoot: (d) => d.getArray("root"),
        },
      );
      const { proxy: proxyB } = createYjsProxy<Array<{ source: string }>>(
        docB,
        {
          getRoot: (d) => d.getArray("root"),
        },
      );

      // Set up bidirectional sync
      docA.on("update", (update: Uint8Array) => Y.applyUpdate(docB, update));
      docB.on("update", (update: Uint8Array) => Y.applyUpdate(docA, update));

      // Both clients rapidly add items
      for (let i = 0; i < 100; i++) {
        proxyA.push({ source: "A" });
        proxyB.push({ source: "B" });
      }
      await waitMicrotask();

      // Both should converge to same state
      expect(proxyA).toHaveLength(200);
      expect(proxyB).toHaveLength(200);
      expect(proxyA.map((x) => x.source).sort()).toEqual(
        proxyB.map((x) => x.source).sort(),
      );

      // Verify both sources present
      const sourceACounts = proxyA.filter((x) => x.source === "A").length;
      const sourceBCounts = proxyA.filter((x) => x.source === "B").length;
      expect(sourceACounts).toBe(100);
      expect(sourceBCounts).toBe(100);
    });
  });

  describe("Memory Stability Under Load", () => {
    it("should remain stable after 1000 create/delete cycles", async () => {
      const doc = new Y.Doc();
      const { proxy } = createYjsProxy<
        Record<string, { iteration: number; data: string }>
      >(doc, {
        getRoot: (d) => d.getMap("root"),
      });

      // Perform 1000 cycles
      for (let i = 0; i < 1000; i++) {
        proxy[`temp${i}`] = {
          iteration: i,
          data: `data-${i}`,
        };
        if (i > 0) {
          delete proxy[`temp${i - 1}`];
        }
      }
      await waitMicrotask();

      // Should only have last item
      expect(Object.keys(proxy)).toHaveLength(1);
      expect(proxy.temp999!.iteration).toBe(999);

      // Verify system still works
      proxy.final = { iteration: 9999, data: "final" };
      await waitMicrotask();
      expect(proxy.final!.iteration).toBe(9999);
    });

    it("should remain stable after 500 array splice cycles", async () => {
      const doc = new Y.Doc();
      const { proxy } = createYjsProxy<Array<{ id: number }>>(doc, {
        getRoot: (d) => d.getArray("root"),
      });

      // Start with 10 items
      proxy.push(...Array.from({ length: 10 }, (_, i) => ({ id: i })));
      await waitMicrotask();

      // Perform 500 splice cycles
      for (let i = 0; i < 500; i++) {
        // Remove middle item and add new one
        proxy.splice(5, 1);
        proxy.splice(5, 0, { id: 1000 + i });
      }
      await waitMicrotask();

      // Should still have 10 items
      expect(proxy).toHaveLength(10);
      expect(proxy[5]!.id).toBe(1499); // Last inserted

      // Verify operations still work
      proxy.push({ id: 9999 });
      await waitMicrotask();
      expect(proxy).toHaveLength(11);
    });

    it("should handle sustained high-frequency updates (10k operations)", async () => {
      const doc = new Y.Doc();
      const { proxy } = createYjsProxy<{
        counters: Record<string, number>;
        metadata: { totalOps: number };
      }>(doc, {
        getRoot: (d) => d.getMap("root"),
      });

      proxy.counters = {};
      proxy.metadata = { totalOps: 0 };
      await waitMicrotask();

      // Perform 10k operations across different counters
      for (let i = 0; i < 10000; i++) {
        const counterKey = `counter${i % 100}`;
        if (!proxy.counters[counterKey]) {
          proxy.counters[counterKey] = 0;
        }
        proxy.counters[counterKey]++;
        proxy.metadata.totalOps++;
      }
      await waitMicrotask();

      // Verify state
      expect(proxy.metadata.totalOps).toBe(10000);
      expect(Object.keys(proxy.counters)).toHaveLength(100);

      // Each counter should be incremented 100 times
      expect(proxy.counters.counter0).toBe(100);
      expect(proxy.counters.counter50).toBe(100);
      expect(proxy.counters.counter99).toBe(100);

      // Verify system still responsive
      proxy.counters.final = 9999;
      await waitMicrotask();
      expect(proxy.counters.final).toBe(9999);
    });
  });

  describe("Complex Workload Scenarios", () => {
    it("should handle mixed operations on large dataset", async () => {
      const doc = new Y.Doc();
      const { proxy } = createYjsProxy<{
        users: Array<{
          id: number;
          name: string;
          posts: Array<{ text: string }>;
        }>;
        stats: { userCount: number; postCount: number };
      }>(doc, {
        getRoot: (d) => d.getMap("root"),
      });

      proxy.users = [];
      proxy.stats = { userCount: 0, postCount: 0 };
      await waitMicrotask();

      // Add 100 users with posts
      for (let i = 0; i < 100; i++) {
        const user = {
          id: i,
          name: `User ${i}`,
          posts: Array.from({ length: 10 }, (_, j) => ({
            text: `Post ${j} from user ${i}`,
          })),
        };
        proxy.users.push(user);
        proxy.stats.userCount++;
        proxy.stats.postCount += 10;
      }
      await waitMicrotask();

      expect(proxy.users).toHaveLength(100);
      expect(proxy.stats.userCount).toBe(100);
      expect(proxy.stats.postCount).toBe(1000);

      // Modify posts for all users
      for (let i = 0; i < 100; i++) {
        proxy.users[i]!.posts[0]!.text = `Updated post from user ${i}`;
      }
      await waitMicrotask();

      // Verify updates
      expect(proxy.users[50]!.posts[0]!.text).toBe("Updated post from user 50");

      // Delete half the users
      proxy.users.splice(0, 50);
      proxy.stats.userCount = 50;
      proxy.stats.postCount = 500;
      await waitMicrotask();

      expect(proxy.users).toHaveLength(50);
      expect(proxy.stats.userCount).toBe(50);
    });

    it("should handle nested array operations at scale", async () => {
      const doc = new Y.Doc();
      const { proxy } = createYjsProxy<Array<Array<{ value: number }>>>(doc, {
        getRoot: (d) => d.getArray("root"),
      });

      // Create 50 nested arrays with 20 items each
      for (let i = 0; i < 50; i++) {
        const innerArray = Array.from({ length: 20 }, (_, j) => ({
          value: i * 100 + j,
        }));
        proxy.push(innerArray);
      }
      await waitMicrotask();

      expect(proxy).toHaveLength(50);
      expect(proxy[0]).toHaveLength(20);

      // Modify items in nested arrays
      for (let i = 0; i < 50; i++) {
        proxy[i]![10]!.value = 9999;
      }
      await waitMicrotask();

      // Verify modifications
      expect(proxy[25]![10]!.value).toBe(9999);

      // Add items to nested arrays
      for (let i = 0; i < 50; i++) {
        proxy[i]!.push({ value: 10000 + i });
      }
      await waitMicrotask();

      expect(proxy[0]).toHaveLength(21);
      expect(proxy[49]![20]!.value).toBe(10049);
    });
  });
});
