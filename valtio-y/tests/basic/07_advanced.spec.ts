/* eslint @typescript-eslint/no-explicit-any: "off" */

import { describe, expect, it } from "vitest";
import * as Y from "yjs";
import { createYjsProxy } from "../../src/index";
import { syncedText } from "../../src/synced-types";
import type { LooseRecord } from "../helpers/test-helpers";

const waitMicrotask = () => Promise.resolve();

describe("Advanced Capabilities", () => {
  describe("1. Identity Preservation (React-Friendly)", () => {
    it("nested objects maintain identity across remote updates", async () => {
      // This is crucial for React - components can keep references without re-mounting
      const doc1 = new Y.Doc();
      const doc2 = new Y.Doc();

      doc1.on("update", (update: Uint8Array) => Y.applyUpdate(doc2, update));
      doc2.on("update", (update: Uint8Array) => Y.applyUpdate(doc1, update));

      const { proxy: p1, bootstrap } = createYjsProxy<{
        user: { name: string; profile: { bio: string } };
      }>(doc1, {
        getRoot: (d) => d.getMap("root"),
      });
      const { proxy: p2 } = createYjsProxy<{
        user: { name: string; profile: { bio: string } };
      }>(doc2, {
        getRoot: (d) => d.getMap("root"),
      });

      bootstrap({ user: { name: "Alice", profile: { bio: "Developer" } } });
      await waitMicrotask();

      // Capture identity
      const userRef = p2.user;
      const profileRef = p2.user.profile;

      // Remote update to deep nested value
      p1.user.profile.bio = "Senior Developer";
      await waitMicrotask();

      // ✨ Identity preserved! React components won't re-mount
      expect(p2.user).toBe(userRef);
      expect(p2.user.profile).toBe(profileRef);
      expect(p2.user.profile.bio).toBe("Senior Developer");
    });
  });

  describe("2. Lazy Materialization + Deep Reconciliation", () => {
    it("syncs deep changes even when intermediate objects are not accessed", async () => {
      // The new architecture can reconcile deep changes without materializing every level
      const doc1 = new Y.Doc();
      const doc2 = new Y.Doc();

      doc1.on("update", (update: Uint8Array) => Y.applyUpdate(doc2, update));

      const { proxy: p1, bootstrap } = createYjsProxy<{ data: LooseRecord }>(
        doc1,
        {
          getRoot: (d) => d.getMap("root"),
        },
      );
      const { proxy: p2 } = createYjsProxy<{ data: LooseRecord }>(doc2, {
        getRoot: (d) => d.getMap("root"),
      });

      // Initialize deep structure
      bootstrap({ data: { level1: { level2: { level3: { value: 1 } } } } });
      await waitMicrotask();

      // Access ONLY the top level on p2 (don't drill down)
      const topLevel = p2.data as LooseRecord;

      // Change deep nested value on p1
      ((p1.data as LooseRecord).level1 as LooseRecord).level2 = {
        level3: { value: 999 },
      };
      await waitMicrotask();

      // ✨ p2 automatically has the deep change, even though we never accessed intermediate levels
      expect(
        ((topLevel.level1 as LooseRecord).level2 as LooseRecord).level3,
      ).toEqual({ value: 999 });
    });
  });

  describe("3. Complex Nested Deletion with Children", () => {
    it("handles deletion of complex nested structures correctly", async () => {
      const doc1 = new Y.Doc();
      const doc2 = new Y.Doc();

      doc1.on("update", (update: Uint8Array) => Y.applyUpdate(doc2, update));
      doc2.on("update", (update: Uint8Array) => Y.applyUpdate(doc1, update));

      type Item = {
        id: number;
        title: string;
        metadata: { tags: string[]; stats: { views: number } };
      };
      const { proxy: p1, bootstrap } = createYjsProxy<{ items: Item[] }>(doc1, {
        getRoot: (d) => d.getMap("root"),
      });
      const { proxy: p2 } = createYjsProxy<{ items: Item[] }>(doc2, {
        getRoot: (d) => d.getMap("root"),
      });

      // Create complex nested structure
      bootstrap({
        items: [
          {
            id: 1,
            title: "First",
            metadata: {
              tags: ["a", "b"],
              stats: { views: 10 },
            },
          },
          {
            id: 2,
            title: "Second",
            metadata: {
              tags: ["c", "d"],
              stats: { views: 20 },
            },
          },
        ],
      });
      await waitMicrotask();

      // Delete first item on p1
      p1.items.splice(0, 1);
      await waitMicrotask();

      // ✨ Complex nested structure correctly synced
      expect(p2.items).toHaveLength(1);
      expect(p2.items[0]?.id).toBe(2);
      expect(p2.items[0]?.title).toBe("Second");
      expect(p2.items[0]?.metadata.tags).toEqual(["c", "d"]);
      expect(p2.items[0]?.metadata.stats.views).toBe(20);
    });
  });

  describe("4. Concurrent Editing Without Conflicts", () => {
    it("handles simultaneous edits from multiple users", async () => {
      const doc1 = new Y.Doc();
      const doc2 = new Y.Doc();
      const doc3 = new Y.Doc();

      // Three-way sync
      doc1.on("update", (u) => {
        Y.applyUpdate(doc2, u);
        Y.applyUpdate(doc3, u);
      });
      doc2.on("update", (u) => {
        Y.applyUpdate(doc1, u);
        Y.applyUpdate(doc3, u);
      });
      doc3.on("update", (u) => {
        Y.applyUpdate(doc1, u);
        Y.applyUpdate(doc2, u);
      });

      const { proxy: p1, bootstrap } = createYjsProxy<{
        tasks: Array<{ user: string; text: string }>;
      }>(doc1, {
        getRoot: (d) => d.getMap("root"),
      });
      const { proxy: p2 } = createYjsProxy<{
        tasks: Array<{ user: string; text: string }>;
      }>(doc2, {
        getRoot: (d) => d.getMap("root"),
      });
      const { proxy: p3 } = createYjsProxy<{
        tasks: Array<{ user: string; text: string }>;
      }>(doc3, {
        getRoot: (d) => d.getMap("root"),
      });

      bootstrap({ tasks: [] });
      await waitMicrotask();

      // Three users add tasks simultaneously
      p1.tasks.push({ user: "Alice", text: "Task from Alice" });
      p2.tasks.push({ user: "Bob", text: "Task from Bob" });
      p3.tasks.push({ user: "Charlie", text: "Task from Charlie" });
      await waitMicrotask();

      // ✨ All tasks appear on all clients, no conflicts!
      expect(p1.tasks).toHaveLength(3);
      expect(p2.tasks).toHaveLength(3);
      expect(p3.tasks).toHaveLength(3);

      // All clients see the same data (CRDT guarantees convergence)
      const allUsers = p1.tasks.map((t) => t.user).sort();
      expect(allUsers).toEqual(["Alice", "Bob", "Charlie"]);
    });
  });

  describe("5. Reusing Child References (Advanced Pattern)", () => {
    it("can replace parent object while reusing child proxy references", async () => {
      const doc1 = new Y.Doc();
      const doc2 = new Y.Doc();

      doc1.on("update", (u) => Y.applyUpdate(doc2, u));
      doc2.on("update", (u) => Y.applyUpdate(doc1, u));

      const { proxy: p1, bootstrap } = createYjsProxy<
        Array<{
          id: number;
          text: string;
          children: Array<{ id: number; text: string }>;
        }>
      >(doc1, {
        getRoot: (d) => d.getArray("root"),
      });
      const { proxy: p2 } = createYjsProxy<
        Array<{
          id: number;
          text: string;
          children: Array<{ id: number; text: string }>;
        }>
      >(doc2, {
        getRoot: (d) => d.getArray("root"),
      });

      // Initialize with nested structure
      bootstrap([
        {
          id: 1,
          text: "Item 1",
          children: [
            { id: 101, text: "Child A" },
            { id: 102, text: "Child B" },
          ],
        },
      ]);
      await waitMicrotask();

      // Capture reference to existing children
      const existingChildren = p1[0]?.children;

      // Replace parent item while reusing children reference
      if (p1[0]) {
        p1[0] = {
          id: 1,
          text: "Updated Item 1",
          children: existingChildren ?? [],
        };
      }
      await waitMicrotask();

      // ✨ Parent updated, children preserved and synced
      expect(p2[0]?.text).toBe("Updated Item 1");
      expect(p2[0]?.children).toHaveLength(2);
      expect(p2[0]?.children[0]?.text).toBe("Child A");
      expect(p2[0]?.children[1]?.text).toBe("Child B");
    });
  });

  describe("6. Collaborative Text Editing (Y.Text Integration)", () => {
    it("Y.Text works seamlessly with Valtio reactivity", async () => {
      const doc1 = new Y.Doc();
      const doc2 = new Y.Doc();

      doc1.on("update", (u) => Y.applyUpdate(doc2, u));
      doc2.on("update", (u) => Y.applyUpdate(doc1, u));

      const { proxy: p1 } = createYjsProxy<{ document: Y.Text }>(doc1, {
        getRoot: (d) => d.getMap("root"),
      });
      const { proxy: p2 } = createYjsProxy<{ document: Y.Text }>(doc2, {
        getRoot: (d) => d.getMap("root"),
      });

      // Create collaborative text
      p1.document = syncedText("Hello World");
      await waitMicrotask();

      // User 1 edits
      p1.document.insert(11, "!");
      await waitMicrotask();

      // User 2 sees the change
      expect(p2.document.toString()).toBe("Hello World!");

      // User 2 edits
      p2.document.insert(0, "👋 ");
      await waitMicrotask();

      // ✨ Both users see the merged result
      expect(p1.document.toString()).toBe("👋 Hello World!");
      expect(p2.document.toString()).toBe("👋 Hello World!");
    });
  });

  describe("7. Automatic Transaction Batching", () => {
    it("multiple mutations in same tick become single transaction", async () => {
      const doc = new Y.Doc();
      const { proxy: p } = createYjsProxy<Record<string, number>>(doc, {
        getRoot: (d) => d.getMap("root"),
      });

      let updateCount = 0;
      doc.on("update", () => updateCount++);

      // Make 100 changes in the same tick
      for (let i = 0; i < 100; i++) {
        p[`key${i}`] = i;
      }
      await waitMicrotask();

      // ✨ All 100 changes batched into a single transaction!
      expect(updateCount).toBe(1);
      expect(Object.keys(p)).toHaveLength(100);
    });
  });
});
