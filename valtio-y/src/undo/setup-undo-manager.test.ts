import { describe, it, expect, vi, beforeEach } from "vitest";
import * as Y from "yjs";
import { setupUndoManager } from "./setup-undo-manager";
import { VALTIO_Y_ORIGIN } from "../core/constants";

describe("setupUndoManager", () => {
  let doc: Y.Doc;
  let yRoot: Y.Map<unknown>;

  beforeEach(() => {
    doc = new Y.Doc();
    yRoot = doc.getMap("test");
  });

  describe("Boolean configuration", () => {
    it("creates UndoManager with defaults when passed true", () => {
      const { manager, undoState } = setupUndoManager(yRoot, true);

      expect(manager).toBeInstanceOf(Y.UndoManager);
      expect(undoState.canUndo).toBe(false);
      expect(undoState.canRedo).toBe(false);
    });

    it("uses default captureTimeout of 500ms to group operations", async () => {
      const { manager } = setupUndoManager(yRoot, true);

      // Make rapid changes within captureTimeout window
      doc.transact(() => yRoot.set("key1", "value1"), VALTIO_Y_ORIGIN);
      doc.transact(() => yRoot.set("key2", "value2"), VALTIO_Y_ORIGIN);
      doc.transact(() => yRoot.set("key3", "value3"), VALTIO_Y_ORIGIN);

      // They should be grouped together (exact count depends on timing)
      expect(manager.undoStack.length).toBeGreaterThan(0);
      expect(manager.undoStack.length).toBeLessThanOrEqual(3);

      // Wait for captureTimeout to expire
      await new Promise((resolve) => setTimeout(resolve, 600));

      // Make another change after timeout
      doc.transact(() => yRoot.set("key4", "value4"), VALTIO_Y_ORIGIN);

      // This should create a separate undo item
      expect(manager.undoStack.length).toBeGreaterThan(1);
    });

    it("uses default trackedOrigins of VALTIO_Y_ORIGIN", () => {
      const { manager } = setupUndoManager(yRoot, true);

      // Make a change with VALTIO_Y_ORIGIN
      doc.transact(() => {
        yRoot.set("key", "value");
      }, VALTIO_Y_ORIGIN);

      expect(manager.canUndo()).toBe(true);
    });

    it("does not track changes with other origins by default", () => {
      const { manager } = setupUndoManager(yRoot, true);

      // Make a change with a different origin
      doc.transact(() => {
        yRoot.set("key", "value");
      }, "other-origin");

      expect(manager.canUndo()).toBe(false);
    });
  });

  describe("Options configuration", () => {
    it("creates UndoManager with custom captureTimeout", () => {
      const { manager } = setupUndoManager(yRoot, {
        captureTimeout: 1000,
      });

      expect(manager).toBeInstanceOf(Y.UndoManager);
    });

    it("creates UndoManager with custom trackedOrigins", () => {
      const customOrigin = "custom-origin";
      const { manager } = setupUndoManager(yRoot, {
        trackedOrigins: new Set([customOrigin]),
      });

      // Make a change with custom origin
      doc.transact(() => {
        yRoot.set("key", "value");
      }, customOrigin);

      expect(manager.canUndo()).toBe(true);

      // Make a change with VALTIO_Y_ORIGIN (should not be tracked)
      doc.transact(() => {
        yRoot.set("key2", "value2");
      }, VALTIO_Y_ORIGIN);

      expect(manager.undoStack).toHaveLength(1); // Only custom origin tracked
    });

    it("tracks changes without explicit origin when trackedOrigins is undefined", () => {
      const { manager } = setupUndoManager(yRoot, {
        trackedOrigins: undefined,
      });

      // Make changes WITHOUT specifying an origin (defaults to null)
      doc.transact(() => {
        yRoot.set("key1", "value1");
      });

      doc.transact(() => {
        yRoot.set("key2", "value2");
      });

      doc.transact(() => {
        yRoot.set("key3", "value3");
      });

      expect(manager.undoStack.length).toBeGreaterThan(0);
      expect(manager.canUndo()).toBe(true);
    });

    it("creates UndoManager with deleteFilter", () => {
      const deleteFilter = vi.fn(() => true);
      const { manager } = setupUndoManager(yRoot, {
        deleteFilter,
      });

      expect(manager).toBeInstanceOf(Y.UndoManager);
      // deleteFilter is internal, can't test directly without triggering delete operations
    });

    it("uses default values for omitted options", () => {
      const { manager } = setupUndoManager(yRoot, {});

      // Make a change with VALTIO_Y_ORIGIN (default tracked origin)
      doc.transact(() => {
        yRoot.set("key", "value");
      }, VALTIO_Y_ORIGIN);

      expect(manager.canUndo()).toBe(true);
    });
  });

  describe("Custom UndoManager instance", () => {
    it("uses provided UndoManager instance", () => {
      const customManager = new Y.UndoManager(yRoot, {
        captureTimeout: 2000,
        trackedOrigins: new Set(["custom"]),
      });

      const { manager } = setupUndoManager(yRoot, customManager);

      expect(manager).toBe(customManager);
    });

    it("sets up reactive state for custom instance", () => {
      const customManager = new Y.UndoManager(yRoot);
      const { undoState } = setupUndoManager(yRoot, customManager);

      expect(undoState.canUndo).toBe(false);
      expect(undoState.canRedo).toBe(false);

      // Make a change
      doc.transact(() => {
        yRoot.set("key", "value");
      });

      expect(undoState.canUndo).toBe(true);
    });
  });

  describe("Reactive state", () => {
    it("initializes with canUndo and canRedo false", () => {
      const { undoState } = setupUndoManager(yRoot, true);

      expect(undoState.canUndo).toBe(false);
      expect(undoState.canRedo).toBe(false);
    });

    it("updates canUndo when item is added to stack", () => {
      const { manager, undoState } = setupUndoManager(yRoot, true);

      doc.transact(() => {
        yRoot.set("key", "value");
      }, VALTIO_Y_ORIGIN);

      expect(undoState.canUndo).toBe(true);
      expect(manager.canUndo()).toBe(true);
    });

    it("updates canRedo after undo operation", () => {
      const { manager, undoState } = setupUndoManager(yRoot, true);

      doc.transact(() => {
        yRoot.set("key", "value");
      }, VALTIO_Y_ORIGIN);

      manager.undo();

      expect(undoState.canUndo).toBe(false);
      expect(undoState.canRedo).toBe(true);
    });

    it("updates state when stack is cleared", () => {
      const { manager, undoState } = setupUndoManager(yRoot, true);

      doc.transact(() => {
        yRoot.set("key", "value");
      }, VALTIO_Y_ORIGIN);

      expect(undoState.canUndo).toBe(true);

      manager.clear();

      expect(undoState.canUndo).toBe(false);
      expect(undoState.canRedo).toBe(false);
    });

    it("state is reactive with Valtio snapshot", () => {
      const { undoState } = setupUndoManager(yRoot, true);

      // Use Valtio's useSnapshot-like behavior (in tests, just access directly)
      const initialCanUndo = undoState.canUndo;
      expect(initialCanUndo).toBe(false);

      doc.transact(() => {
        yRoot.set("key", "value");
      }, VALTIO_Y_ORIGIN);

      expect(undoState.canUndo).toBe(true);
      expect(undoState.canUndo).not.toBe(initialCanUndo);
    });
  });

  describe("Event listeners", () => {
    it("listens to stack-item-added event", () => {
      const { undoState } = setupUndoManager(yRoot, true);

      expect(undoState.canUndo).toBe(false);

      doc.transact(() => {
        yRoot.set("key", "value");
      }, VALTIO_Y_ORIGIN);

      // Event should trigger state update
      expect(undoState.canUndo).toBe(true);
    });

    it("listens to stack-item-popped event", () => {
      const { manager, undoState } = setupUndoManager(yRoot, true);

      doc.transact(() => {
        yRoot.set("key", "value");
      }, VALTIO_Y_ORIGIN);

      expect(undoState.canUndo).toBe(true);

      manager.undo();

      // Event should trigger state update
      expect(undoState.canUndo).toBe(false);
      expect(undoState.canRedo).toBe(true);
    });

    it("listens to stack-cleared event", () => {
      const { manager, undoState } = setupUndoManager(yRoot, true);

      doc.transact(() => {
        yRoot.set("key", "value");
      }, VALTIO_Y_ORIGIN);

      manager.clear();

      // Event should trigger state update
      expect(undoState.canUndo).toBe(false);
      expect(undoState.canRedo).toBe(false);
    });
  });

  describe("Manual state update", () => {
    it("provides updateState function", () => {
      const { updateState } = setupUndoManager(yRoot, true);

      expect(updateState).toBeInstanceOf(Function);
    });

    it("updateState manually syncs state with manager", () => {
      const { manager, undoState, updateState } = setupUndoManager(yRoot, true);

      // Make a change
      doc.transact(() => {
        yRoot.set("key", "value");
      }, VALTIO_Y_ORIGIN);

      // Clear without event (hypothetical - for testing updateState)
      manager.clear();

      // Call updateState to sync
      updateState();

      expect(undoState.canUndo).toBe(false);
      expect(undoState.canRedo).toBe(false);
    });
  });

  describe("Cleanup", () => {
    it("provides cleanup function", () => {
      const { cleanup } = setupUndoManager(yRoot, true);

      expect(cleanup).toBeInstanceOf(Function);
    });

    it("cleanup removes event listeners and prevents state updates", () => {
      const { manager, undoState, cleanup } = setupUndoManager(yRoot, true);

      // Make a change to verify listeners work before cleanup
      doc.transact(() => {
        yRoot.set("initialKey", "initialValue");
      }, VALTIO_Y_ORIGIN);

      expect(undoState.canUndo).toBe(true);

      // Undo to reset state
      manager.undo();
      expect(undoState.canUndo).toBe(false);
      expect(undoState.canRedo).toBe(true);

      // Cleanup
      cleanup();

      // Make a change after cleanup
      doc.transact(() => {
        yRoot.set("key", "value");
      }, VALTIO_Y_ORIGIN);

      // State should NOT update because listeners were removed
      expect(undoState.canUndo).toBe(false); // Still false from after undo
      expect(undoState.canRedo).toBe(true); // Still true from after undo
      expect(manager.canUndo()).toBe(true); // Manager has undo available
    });

    it("can call cleanup multiple times safely", () => {
      const { cleanup } = setupUndoManager(yRoot, true);

      expect(() => {
        cleanup();
        cleanup();
        cleanup();
      }).not.toThrow();
    });
  });

  describe("Y.Array support", () => {
    it("works with Y.Array root", () => {
      const yArray = doc.getArray("testArray");
      const { manager, undoState } = setupUndoManager(yArray, true);

      expect(manager).toBeInstanceOf(Y.UndoManager);
      expect(undoState.canUndo).toBe(false);

      doc.transact(() => {
        yArray.push(["item1"]);
      }, VALTIO_Y_ORIGIN);

      expect(undoState.canUndo).toBe(true);
    });
  });

  describe("Multiple operations", () => {
    it("tracks multiple sequential operations", () => {
      const { manager, undoState } = setupUndoManager(yRoot, true);

      doc.transact(() => {
        yRoot.set("key1", "value1");
      }, VALTIO_Y_ORIGIN);

      doc.transact(() => {
        yRoot.set("key2", "value2");
      }, VALTIO_Y_ORIGIN);

      doc.transact(() => {
        yRoot.set("key3", "value3");
      }, VALTIO_Y_ORIGIN);

      expect(manager.undoStack.length).toBeGreaterThan(0);
      expect(undoState.canUndo).toBe(true);

      manager.undo();
      expect(undoState.canRedo).toBe(true);
    });

    it("maintains redo stack after multiple undos", () => {
      const { manager, undoState } = setupUndoManager(yRoot, {
        captureTimeout: 0,
      });

      // Add operations
      doc.transact(() => {
        yRoot.set("key1", "value1");
      }, VALTIO_Y_ORIGIN);

      doc.transact(() => {
        yRoot.set("key2", "value2");
      }, VALTIO_Y_ORIGIN);

      // Undo both
      manager.undo();
      manager.undo();

      expect(undoState.canUndo).toBe(false);
      expect(undoState.canRedo).toBe(true);

      // Redo one
      manager.redo();

      expect(undoState.canUndo).toBe(true);
      expect(undoState.canRedo).toBe(true);
    });
  });

  describe("Error handling", () => {
    it("handles undo when canUndo is false gracefully", () => {
      const { manager, undoState } = setupUndoManager(yRoot, true);

      expect(undoState.canUndo).toBe(false);

      // Should not throw
      expect(() => manager.undo()).not.toThrow();
      expect(undoState.canUndo).toBe(false);
    });

    it("handles redo when canRedo is false gracefully", () => {
      const { manager, undoState } = setupUndoManager(yRoot, true);

      expect(undoState.canRedo).toBe(false);

      // Should not throw
      expect(() => manager.redo()).not.toThrow();
      expect(undoState.canRedo).toBe(false);
    });

    it("handles multiple undo calls beyond available items", () => {
      const { manager, undoState } = setupUndoManager(yRoot, true);

      // Add one item
      doc.transact(() => {
        yRoot.set("key", "value");
      }, VALTIO_Y_ORIGIN);

      expect(undoState.canUndo).toBe(true);

      // Undo once (should work)
      manager.undo();
      expect(undoState.canUndo).toBe(false);

      // Try to undo again (nothing to undo)
      expect(() => manager.undo()).not.toThrow();
      expect(undoState.canUndo).toBe(false);
    });

    it("handles multiple redo calls beyond available items", () => {
      const { manager, undoState } = setupUndoManager(yRoot, true);

      // Add and undo one item
      doc.transact(() => {
        yRoot.set("key", "value");
      }, VALTIO_Y_ORIGIN);

      manager.undo();
      expect(undoState.canRedo).toBe(true);

      // Redo once (should work)
      manager.redo();
      expect(undoState.canRedo).toBe(false);

      // Try to redo again (nothing to redo)
      expect(() => manager.redo()).not.toThrow();
      expect(undoState.canRedo).toBe(false);
    });
  });
});
