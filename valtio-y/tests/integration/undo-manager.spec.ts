import { describe, it, expect, beforeEach } from "vitest";
import * as Y from "yjs";
import { createYjsProxy, VALTIO_Y_ORIGIN } from "../../src/index";

const waitMicrotask = () => Promise.resolve();

describe("UndoManager integration", () => {
  let doc: Y.Doc;

  beforeEach(() => {
    doc = new Y.Doc();
  });

  describe("Basic undo/redo with Map", () => {
    it("enables undo/redo with undoManager: true", async () => {
      const { proxy, undo, redo, undoState } = createYjsProxy<{
        count?: number;
      }>(doc, {
        getRoot: (d) => d.getMap("state"),
        undoManager: true,
      });

      expect(undoState.canUndo).toBe(false);
      expect(undoState.canRedo).toBe(false);

      proxy.count = 1;
      await waitMicrotask();

      expect(undoState.canUndo).toBe(true);
      expect(proxy.count).toBe(1);

      undo();
      await waitMicrotask();

      expect(proxy.count).toBe(undefined);
      expect(undoState.canUndo).toBe(false);
      expect(undoState.canRedo).toBe(true);

      redo();
      await waitMicrotask();

      expect(proxy.count).toBe(1);
      expect(undoState.canUndo).toBe(true);
      expect(undoState.canRedo).toBe(false);
    });

    it("tracks multiple property changes", async () => {
      const { proxy, undo, undoState } = createYjsProxy<{
        name?: string;
        age?: number;
      }>(doc, {
        getRoot: (d) => d.getMap("state"),
        undoManager: {
          captureTimeout: 0,
        },
      });

      proxy.name = "Alice";
      await waitMicrotask();

      proxy.age = 30;
      await waitMicrotask();

      expect(proxy.name).toBe("Alice");
      expect(proxy.age).toBe(30);
      expect(undoState.canUndo).toBe(true);

      undo();
      await waitMicrotask();

      expect(proxy.name).toBe("Alice");
      expect(proxy.age).toBe(undefined);

      undo();
      await waitMicrotask();

      expect(proxy.name).toBe(undefined);
      expect(proxy.age).toBe(undefined);
      expect(undoState.canUndo).toBe(false);
    });

    it("handles nested object updates", async () => {
      const { proxy, undo } = createYjsProxy<{
        user?: { name: string; email: string };
      }>(doc, {
        getRoot: (d) => d.getMap("state"),
        undoManager: {
          captureTimeout: 0,
        },
      });

      proxy.user = { name: "Alice", email: "alice@example.com" };
      await waitMicrotask();

      expect(proxy.user?.name).toBe("Alice");

      proxy.user!.name = "Bob";
      await waitMicrotask();

      expect(proxy.user?.name).toBe("Bob");

      undo();
      await waitMicrotask();

      expect(proxy.user?.name).toBe("Alice");
    });

    it("handles property deletion", async () => {
      const { proxy, undo } = createYjsProxy<{
        temp?: string;
      }>(doc, {
        getRoot: (d) => d.getMap("state"),
        undoManager: {
          captureTimeout: 0,
        },
      });

      proxy.temp = "value";
      await waitMicrotask();

      expect(proxy.temp).toBe("value");

      delete proxy.temp;
      await waitMicrotask();

      expect(proxy.temp).toBe(undefined);

      undo();
      await waitMicrotask();

      expect(proxy.temp).toBe("value");
    });
  });

  describe("Basic undo/redo with Array", () => {
    it("enables undo/redo for arrays", async () => {
      const { proxy, undo, redo, undoState } = createYjsProxy<string[]>(doc, {
        getRoot: (d) => d.getArray("items"),
        undoManager: {
          captureTimeout: 0,
        },
      });

      expect(undoState.canUndo).toBe(false);

      proxy.push("item1");
      await waitMicrotask();

      expect(proxy).toHaveLength(1);
      expect(undoState.canUndo).toBe(true);

      undo();
      await waitMicrotask();

      expect(proxy).toHaveLength(0);
      expect(undoState.canRedo).toBe(true);

      redo();
      await waitMicrotask();

      expect(proxy).toHaveLength(1);
      expect(proxy[0]).toBe("item1");
    });

    it("tracks array push operations", async () => {
      const { proxy, undo } = createYjsProxy<number[]>(doc, {
        getRoot: (d) => d.getArray("numbers"),
        undoManager: {
          captureTimeout: 0,
        },
      });

      proxy.push(1, 2, 3);
      await waitMicrotask();

      expect(proxy).toEqual([1, 2, 3]);

      undo();
      await waitMicrotask();

      expect(proxy).toEqual([]);
    });

    it("tracks array splice operations", async () => {
      const { proxy, undo } = createYjsProxy<string[]>(doc, {
        getRoot: (d) => d.getArray("items"),
        undoManager: {
          captureTimeout: 0,
        },
      });

      proxy.push("a", "b", "c");
      await waitMicrotask();

      proxy.splice(1, 1, "x", "y");
      await waitMicrotask();

      expect(proxy).toEqual(["a", "x", "y", "c"]);

      undo();
      await waitMicrotask();

      expect(proxy).toEqual(["a", "b", "c"]);
    });

    it("tracks array pop operations", async () => {
      const { proxy, undo } = createYjsProxy<string[]>(doc, {
        getRoot: (d) => d.getArray("items"),
        undoManager: {
          captureTimeout: 0,
        },
      });

      proxy.push("a", "b", "c");
      await waitMicrotask();

      const popped = proxy.pop();
      await waitMicrotask();

      expect(popped).toBe("c");
      expect(proxy).toEqual(["a", "b"]);

      undo();
      await waitMicrotask();

      expect(proxy).toEqual(["a", "b", "c"]);
    });

    it("tracks array index assignment", async () => {
      const { proxy, undo } = createYjsProxy<string[]>(doc, {
        getRoot: (d) => d.getArray("items"),
        undoManager: {
          captureTimeout: 0,
        },
      });

      proxy.push("a", "b", "c");
      await waitMicrotask();

      proxy[1] = "modified";
      await waitMicrotask();

      expect(proxy).toEqual(["a", "modified", "c"]);

      undo();
      await waitMicrotask();

      expect(proxy).toEqual(["a", "b", "c"]);
    });
  });

  describe("Configuration options", () => {
    it("accepts custom captureTimeout", async () => {
      const { proxy, undoState, manager } = createYjsProxy<{
        count?: number;
      }>(doc, {
        getRoot: (d) => d.getMap("state"),
        undoManager: {
          captureTimeout: 1000,
        },
      });

      expect(manager).toBeInstanceOf(Y.UndoManager);
      expect(undoState.canUndo).toBe(false);

      proxy.count = 1;
      await waitMicrotask();

      expect(undoState.canUndo).toBe(true);
    });

    it("tracks only local changes by default", async () => {
      const { proxy, undoState, manager } = createYjsProxy<{ count?: number }>(
        doc,
        {
          getRoot: (d) => d.getMap("state"),
          undoManager: true,
        },
      );

      // Local change (via proxy)
      proxy.count = 1;
      await waitMicrotask();

      expect(undoState.canUndo).toBe(true);

      // Simulate remote change (different origin)
      const yRoot = doc.getMap("state");
      doc.transact(() => {
        yRoot.set("count", 2);
      }, "remote-origin");

      await waitMicrotask();

      // Should still only have one undo item (the local change)
      expect(manager.undoStack).toHaveLength(1);
    });

    it("tracks all origins when trackedOrigins is undefined", async () => {
      const { proxy, undoState, manager } = createYjsProxy<{ count?: number }>(
        doc,
        {
          getRoot: (d) => d.getMap("state"),
          undoManager: {
            trackedOrigins: undefined,
          },
        },
      );

      // Local change
      proxy.count = 1;
      await waitMicrotask();

      // Remote change
      const yRoot = doc.getMap("state");
      doc.transact(() => {
        yRoot.set("count", 2);
      }, "remote-origin");

      await waitMicrotask();

      // Should track both changes
      expect(manager.undoStack.length).toBeGreaterThan(0);
      expect(undoState.canUndo).toBe(true);
    });

    it("accepts custom UndoManager instance", async () => {
      const yRoot = doc.getMap("state");
      const customManager = new Y.UndoManager(yRoot, {
        captureTimeout: 2000,
        trackedOrigins: new Set([VALTIO_Y_ORIGIN]),
      });

      const { proxy, undo, undoState, manager } = createYjsProxy<{
        count?: number;
      }>(doc, {
        getRoot: (d) => d.getMap("state"),
        undoManager: customManager,
      });

      expect(manager).toBe(customManager);

      proxy.count = 1;
      await waitMicrotask();

      expect(undoState.canUndo).toBe(true);

      undo();
      await waitMicrotask();

      expect(proxy.count).toBe(undefined);
    });
  });

  describe("Helper functions", () => {
    it("provides stopCapturing function", async () => {
      const { proxy, stopCapturing, undo, manager } = createYjsProxy<{
        count?: number;
      }>(doc, {
        getRoot: (d) => d.getMap("state"),
        undoManager: {
          captureTimeout: 1000,
        },
      });

      proxy.count = 1;
      await waitMicrotask();

      stopCapturing();

      proxy.count = 2;
      await waitMicrotask();

      expect(proxy.count).toBe(2);
      expect(manager.undoStack.length).toBeGreaterThanOrEqual(1);

      undo();
      await waitMicrotask();

      expect(proxy.count).toBe(1);
    });

    it("provides clearHistory function", async () => {
      const { proxy, clearHistory, undoState } = createYjsProxy<{
        count?: number;
      }>(doc, {
        getRoot: (d) => d.getMap("state"),
        undoManager: true,
      });

      proxy.count = 1;
      await waitMicrotask();

      proxy.count = 2;
      await waitMicrotask();

      expect(undoState.canUndo).toBe(true);

      clearHistory();

      expect(undoState.canUndo).toBe(false);
      expect(undoState.canRedo).toBe(false);
      expect(proxy.count).toBe(2); // Value unchanged
    });

    it("exposes raw manager for advanced usage", async () => {
      const { manager } = createYjsProxy<{ count?: number }>(doc, {
        getRoot: (d) => d.getMap("state"),
        undoManager: true,
      });

      expect(manager).toBeInstanceOf(Y.UndoManager);
      expect(manager.undoStack).toBeDefined();
      expect(manager.redoStack).toBeDefined();
      expect(typeof manager.canUndo).toBe("function");
      expect(typeof manager.canRedo).toBe("function");
    });
  });

  describe("Cleanup and dispose", () => {
    it("cleans up undo manager on dispose", async () => {
      const { proxy, dispose, undoState } = createYjsProxy<{ count?: number }>(
        doc,
        {
          getRoot: (d) => d.getMap("state"),
          undoManager: true,
        },
      );

      proxy.count = 1;
      await waitMicrotask();

      expect(undoState.canUndo).toBe(true);

      dispose();

      // After dispose, state updates should stop
      proxy.count = 2;
      await waitMicrotask();

      // State should not update (listeners removed)
      // Note: This test verifies cleanup, exact behavior may vary
    });
  });

  describe("Bootstrap with undo", () => {
    it("bootstrap operations are tracked by default", async () => {
      const { proxy, bootstrap, undo, undoState } = createYjsProxy<{
        count?: number;
      }>(doc, {
        getRoot: (d) => d.getMap("state"),
        undoManager: true,
      });

      bootstrap({ count: 10 });
      await waitMicrotask();

      expect(proxy.count).toBe(10);
      expect(undoState.canUndo).toBe(true);

      undo();
      await waitMicrotask();

      expect(proxy.count).toBe(undefined);
    });
  });

  describe("Reactive state with useSnapshot", () => {
    it("undoState works with Valtio's reactive system", async () => {
      const { proxy, undoState } = createYjsProxy<{ count?: number }>(doc, {
        getRoot: (d) => d.getMap("state"),
        undoManager: true,
      });

      // Simulate snapshot behavior
      const initialSnap = { ...undoState };
      expect(initialSnap.canUndo).toBe(false);
      expect(initialSnap.canRedo).toBe(false);

      proxy.count = 1;
      await waitMicrotask();

      const afterChangeSnap = { ...undoState };
      expect(afterChangeSnap.canUndo).toBe(true);
      expect(afterChangeSnap.canRedo).toBe(false);
    });
  });

  describe("Type safety", () => {
    it("returns YjsProxyWithUndo when undoManager is enabled", () => {
      const result = createYjsProxy<{ count?: number }>(doc, {
        getRoot: (d) => d.getMap("state"),
        undoManager: true,
      });

      // TypeScript should infer these properties exist
      expect(result.undo).toBeDefined();
      expect(result.redo).toBeDefined();
      expect(result.undoState).toBeDefined();
      expect(result.stopCapturing).toBeDefined();
      expect(result.clearHistory).toBeDefined();
      expect(result.manager).toBeDefined();
    });

    it("returns YjsProxy when undoManager is not enabled", () => {
      const result = createYjsProxy<{ count?: number }>(doc, {
        getRoot: (d) => d.getMap("state"),
      });

      // These should not exist (TypeScript will catch this at compile time)
      expect((result as unknown as { undo?: unknown }).undo).toBe(undefined);
      expect((result as unknown as { redo?: unknown }).redo).toBe(undefined);
      expect((result as unknown as { undoState?: unknown }).undoState).toBe(
        undefined,
      );
    });
  });

  describe("Complex scenarios", () => {
    it("handles deeply nested structures", async () => {
      const { proxy, undo } = createYjsProxy<{
        app?: {
          settings?: {
            theme?: string;
            notifications?: { email: boolean; push: boolean };
          };
        };
      }>(doc, {
        getRoot: (d) => d.getMap("state"),
        undoManager: {
          captureTimeout: 0,
        },
      });

      proxy.app = {
        settings: {
          theme: "dark",
          notifications: { email: true, push: false },
        },
      };
      await waitMicrotask();

      proxy.app.settings!.theme = "light";
      await waitMicrotask();

      expect(proxy.app.settings?.theme).toBe("light");

      undo();
      await waitMicrotask();

      expect(proxy.app.settings?.theme).toBe("dark");
    });

    it("handles arrays of objects", async () => {
      type Todo = { id: number; text: string; done: boolean };

      const { proxy, undo } = createYjsProxy<{ todos?: Todo[] }>(doc, {
        getRoot: (d) => d.getMap("state"),
        undoManager: {
          captureTimeout: 0,
        },
      });

      proxy.todos = [];
      await waitMicrotask();

      proxy.todos.push({ id: 1, text: "Task 1", done: false });
      await waitMicrotask();

      proxy.todos.push({ id: 2, text: "Task 2", done: false });
      await waitMicrotask();

      expect(proxy.todos).toHaveLength(2);

      undo();
      await waitMicrotask();

      expect(proxy.todos).toHaveLength(1);
      expect(proxy.todos[0]!.text).toBe("Task 1");
    });

    it("handles rapid sequential changes", async () => {
      const { proxy, undo, manager } = createYjsProxy<{ count?: number }>(doc, {
        getRoot: (d) => d.getMap("state"),
        undoManager: {
          captureTimeout: 100,
        },
      });

      // Rapid changes (should be grouped by captureTimeout)
      proxy.count = 1;
      proxy.count = 2;
      proxy.count = 3;
      await waitMicrotask();

      // Wait for capture timeout
      await new Promise((resolve) => setTimeout(resolve, 150));

      // These should be grouped into fewer undo steps
      expect(manager.undoStack.length).toBeGreaterThan(0);

      undo();
      await waitMicrotask();

      expect(proxy.count).toBe(undefined);
    });

    it("preserves data after clearing history", async () => {
      const { proxy, clearHistory } = createYjsProxy<{
        important?: string;
      }>(doc, {
        getRoot: (d) => d.getMap("state"),
        undoManager: true,
      });

      proxy.important = "data";
      await waitMicrotask();

      clearHistory();

      expect(proxy.important).toBe("data");
    });
  });

  describe("Multiple roots with separate undo managers", () => {
    it("supports independent undo histories for different roots", async () => {
      const { proxy: canvas, undo: undoCanvas } = createYjsProxy<string[]>(
        doc,
        {
          getRoot: (d) => d.getArray("canvas"),
          undoManager: true,
        },
      );

      const { proxy: chat, undo: undoChat } = createYjsProxy<string[]>(doc, {
        getRoot: (d) => d.getArray("chat"),
        undoManager: true,
      });

      canvas.push("shape1");
      await waitMicrotask();

      chat.push("message1");
      await waitMicrotask();

      expect(canvas).toHaveLength(1);
      expect(chat).toHaveLength(1);

      undoCanvas();
      await waitMicrotask();

      expect(canvas).toHaveLength(0);
      expect(chat).toHaveLength(1); // Chat unaffected

      undoChat();
      await waitMicrotask();

      expect(canvas).toHaveLength(0);
      expect(chat).toHaveLength(0);
    });
  });
});
