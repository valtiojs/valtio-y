import * as Y from "yjs";
import { proxy as valtioProxy } from "valtio";
import { VALTIO_Y_ORIGIN } from "../core/constants";

/**
 * Configuration options for the UndoManager.
 */
export interface UndoManagerOptions {
  /**
   * Time window to group operations into a single undo step (default: 500ms).
   * Operations within this window are merged together.
   *
   * @default 500
   *
   * Use 0 when each change should be undoable individually (common for app
   * state); increase it (for example 500-1000ms) to coalesce rapid edits such
   * as typing or drawing.
   *
   * @example
   * ```typescript
   * captureTimeout: 1000  // Group operations within 1 second
   * ```
   */
  captureTimeout?: number;

  /**
   * Which transaction origins to track for undo/redo.
   *
   * @default new Set([VALTIO_Y_ORIGIN]) - Only track local valtio-y changes
   *
   * In collaborative apps, you typically want to undo only YOUR changes, not remote users' changes.
   * The default setting achieves this by only tracking changes with the VALTIO_Y_ORIGIN.
   *
   * Set to `undefined` to track only changes without an explicit origin (Yjs default behavior).
   * Note: This will NOT track changes with VALTIO_Y_ORIGIN or any other explicit origin.
   * There is no built-in way to track ALL origins - you must explicitly list them in a Set.
   *
   * @example Track only local valtio-y changes (default)
   * ```typescript
   * trackedOrigins: new Set([VALTIO_Y_ORIGIN])
   * ```
   *
   * @example Track only changes without explicit origin
   * ```typescript
   * trackedOrigins: undefined
   * ```
   *
   * @example Track multiple specific origins
   * ```typescript
   * trackedOrigins: new Set([VALTIO_Y_ORIGIN, 'custom-origin', 'another-origin'])
   * ```
   */
  trackedOrigins?: Set<unknown>;

  /**
   * Optional filter function to exclude certain items from undo/redo.
   * Return `false` to exclude an item from the undo stack.
   *
   * @example
   * ```typescript
   * deleteFilter: (item) => {
   *   // Don't track temporary data
   *   return item.content.type !== 'TemporaryData';
   * }
   * ```
   */
  deleteFilter?: (item: Y.Item) => boolean;
}

/**
 * Reactive state for undo/redo functionality.
 * Use with Valtio's useSnapshot() to get reactive updates.
 */
export interface UndoRedoState {
  /** Whether undo is available */
  canUndo: boolean;
  /** Whether redo is available */
  canRedo: boolean;
}

/**
 * Result of setting up an UndoManager with reactive state.
 */
export interface UndoManagerSetup {
  /** The Y.UndoManager instance */
  manager: Y.UndoManager;
  /** Reactive Valtio proxy for undo/redo availability */
  undoState: UndoRedoState;
  /** Function to manually update the undo state (useful after clearHistory) */
  updateState: () => void;
  /** Cleanup function to remove event listeners */
  cleanup: () => void;
}

/**
 * Sets up a Y.UndoManager with reactive state tracking.
 *
 * Handles three input types:
 * - `true`: Creates manager with defaults
 * - `UndoManagerOptions`: Creates manager with custom config
 * - `Y.UndoManager`: Uses provided instance
 *
 * @param yRoot - The Y.Map or Y.Array to track
 * @param undoConfig - Configuration for the UndoManager
 * @returns Setup object with manager, reactive state, and cleanup function
 */
export function setupUndoManager(
  yRoot: Y.Map<unknown> | Y.Array<unknown>,
  undoConfig: boolean | UndoManagerOptions | Y.UndoManager,
): UndoManagerSetup {
  let manager: Y.UndoManager;

  if (undoConfig instanceof Y.UndoManager) {
    // Advanced: User provided instance
    manager = undoConfig;
  } else if (typeof undoConfig === "boolean") {
    // Standard: Create with defaults (undoConfig is true since false wouldn't make sense here)
    const config = {
      captureTimeout: 500,
      trackedOrigins: new Set([VALTIO_Y_ORIGIN]),
    };
    manager = new Y.UndoManager(yRoot, config);
  } else {
    // Standard: Create with custom options (undoConfig is UndoManagerOptions)
    const config = {
      captureTimeout: undoConfig.captureTimeout ?? 500,
      trackedOrigins:
        "trackedOrigins" in undoConfig
          ? undoConfig.trackedOrigins
          : new Set([VALTIO_Y_ORIGIN]),
      deleteFilter: undoConfig.deleteFilter,
    };
    manager = new Y.UndoManager(yRoot, config);
  }

  // Create reactive Valtio proxy for undo state
  const undoState = valtioProxy<UndoRedoState>({
    canUndo: false,
    canRedo: false,
  });

  const updateUndoState = () => {
    undoState.canUndo = manager.canUndo();
    undoState.canRedo = manager.canRedo();
  };

  // Subscribe to UndoManager events
  manager.on("stack-item-added", updateUndoState);
  manager.on("stack-item-popped", updateUndoState);
  manager.on("stack-cleared", updateUndoState);

  // Set initial state
  updateUndoState();

  // Cleanup function to remove event listeners
  const cleanup = () => {
    manager.off("stack-item-added", updateUndoState);
    manager.off("stack-item-popped", updateUndoState);
    manager.off("stack-cleared", updateUndoState);
  };

  return {
    manager,
    undoState,
    updateState: updateUndoState,
    cleanup,
  };
}
