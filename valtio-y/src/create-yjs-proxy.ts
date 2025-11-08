import * as Y from "yjs";
import { getOrCreateValtioProxy } from "./bridge/valtio-bridge";
import { setupSyncListener } from "./synchronizer";
import {
  plainObjectToYType,
  validateDeepForSharedState,
} from "./core/converter";
import { VALTIO_Y_ORIGIN } from "./core/constants";
import { ValtioYjsCoordinator } from "./core/coordinator";
import { isYArray, isYMap } from "./core/guards";
import {
  reconcileValtioArray,
  reconcileValtioMap,
} from "./reconcile/reconciler";
import type { LogLevel } from "./core/logger";
import {
  setupUndoManager,
  type UndoManagerOptions,
  type UndoRedoState,
} from "./undo/setup-undo-manager";

// Re-export for convenience
export type { UndoManagerOptions, UndoRedoState };

/**
 * Options for creating a Y.js-backed Valtio proxy.
 */
export interface CreateYjsProxyOptions<_T> {
  /**
   * Selects which Yjs structure to synchronize with the Valtio proxy.
   *
   * ⚠️ **IMPORTANT:** All clients syncing the same data MUST use the same root name.
   * Think of this like a database table name - everyone needs to agree on it.
   *
   * 💡 **RECOMMENDED PATTERN:** Most apps should use one root Map for all state:
   *
   * @example
   * ```typescript
   * // ✅ Recommended: One root Map containing all app state
   * const { proxy: state } = createYjsProxy(doc, {
   *   getRoot: (doc) => doc.getMap("root")
   * });
   *
   * // Structure everything inside
   * state.todos = [];
   * state.users = [];
   * state.settings = {};
   * ```
   *
   * @example
   * ```typescript
   * // ✅ Alternative: Direct array root (when your entire app state is a list)
   * const { proxy: todos } = createYjsProxy(doc, {
   *   getRoot: (doc) => doc.getArray("todos")
   * });
   *
   * todos.push({ id: 1, text: "Buy milk" });
   * ```
   *
   * @example
   * ```typescript
   * // ⚠️ Advanced: Multiple roots (for specialized use cases)
   * const { proxy: gameState } = createYjsProxy(doc, {
   *   getRoot: (doc) => doc.getMap("gameState")
   * });
   * const { proxy: chat } = createYjsProxy(doc, {
   *   getRoot: (doc) => doc.getArray("chat")
   * });
   *
   * // Use when you need separate undo managers or selective sync
   * ```
   *
   * **How Yjs sync works:**
   * - The Y.Doc is a container with multiple named structures
   * - WebSocket/WebRTC providers sync the ENTIRE Y.Doc
   * - `getRoot` tells valtio-y which structure to wrap in a Valtio proxy
   * - Different clients can access different structures from the same synced doc
   *
   * **Server/Client relationship:**
   * - If server creates `doc.getMap("root")`, clients must use the same name
   * - The name is part of the sync contract, like a shared schema
   *
   * @see https://github.com/valtiojs/valtio-y/blob/main/guides/structuring-your-app.md
   */
  getRoot: (doc: Y.Doc) => Y.Map<unknown> | Y.Array<unknown>;

  /**
   * Enable undo/redo functionality.
   *
   * The UndoManager tracks changes to the same scope as `getRoot`.
   * By default, only local valtio-y changes are tracked (not remote users).
   *
   * @default undefined (disabled)
   *
   * @example Enable with defaults
   * ```typescript
   * undoManager: true
   * // Tracks: Only local valtio-y changes
   * // Scope: Whatever getRoot returns
   * // Timeout: 500ms
   * ```
   *
   * @example Configure options
   * ```typescript
   * undoManager: {
   *   captureTimeout: 1000,  // Group operations within 1 second
   *   trackedOrigins: new Set([VALTIO_Y_ORIGIN])  // Only local changes
   * }
   * ```
   *
   * @example Track all changes (including remote)
   * ```typescript
   * undoManager: {
   *   trackedOrigins: undefined  // Track ALL origins
   * }
   * ```
   *
   * @example Advanced: Provide your own UndoManager instance
   * ```typescript
   * const undoManager = new Y.UndoManager(ydoc.getMap("root"), {
   *   deleteFilter: (item) => item.content.type !== 'temp'
   * });
   *
   * createYjsProxy(ydoc, {
   *   getRoot: (doc) => doc.getMap("root"),  // ⚠️ Must match UndoManager scope!
   *   undoManager: undoManager
   * });
   * ```
   *
   * ⚠️ **WARNING:** When passing an UndoManager instance, YOU are responsible for ensuring
   * the scope matches `getRoot`. We cannot validate this at runtime.
   */
  undoManager?: boolean | UndoManagerOptions | Y.UndoManager;

  logLevel?: LogLevel;
}

/**
 * Return type for createYjsProxy function.
 * Contains the proxy, a dispose function, and a bootstrap function.
 */
export interface YjsProxy<T> {
  proxy: T;
  dispose: () => void;
  bootstrap: (data?: T) => void;
}

/**
 * Extended return type when UndoManager is enabled.
 * Includes undo/redo functionality in addition to the base proxy.
 */
export interface YjsProxyWithUndo<T> extends YjsProxy<T> {
  /** Perform undo operation if available */
  undo: () => void;
  /** Perform redo operation if available */
  redo: () => void;
  /** Reactive Valtio proxy with canUndo/canRedo state. Use with useSnapshot(). */
  undoState: UndoRedoState;
  /** Stop capturing current operation (force new undo step) */
  stopCapturing: () => void;
  /** Clear all undo/redo history */
  clearHistory: () => void;
  /** The underlying Yjs UndoManager instance for advanced usage */
  manager: Y.UndoManager;
}

// Overload: with undoManager
export function createYjsProxy<T extends object>(
  doc: Y.Doc,
  options: CreateYjsProxyOptions<T> & {
    undoManager: boolean | UndoManagerOptions | Y.UndoManager;
  },
): YjsProxyWithUndo<T>;

// Overload: without undoManager
export function createYjsProxy<T extends object>(
  doc: Y.Doc,
  options: CreateYjsProxyOptions<T>,
): YjsProxy<T>;

// Implementation
export function createYjsProxy<T extends object>(
  doc: Y.Doc,
  options: CreateYjsProxyOptions<T>,
): YjsProxy<T> | YjsProxyWithUndo<T> {
  const { getRoot } = options;
  const yRoot = getRoot(doc);

  // 1. Create the coordinator (fully initialized via constructor injection)
  const coordinator = new ValtioYjsCoordinator(doc, options.logLevel);
  const stateProxy = getOrCreateValtioProxy(coordinator, yRoot, doc);

  // 2. Provide developer-driven bootstrap for initial data.
  const bootstrap = (data?: T) => {
    // If no data provided, this is a no-op (initial reconciliation happens automatically)
    if (!data) {
      return;
    }
    // Pre-convert and validate BEFORE transaction to fail fast
    // This ensures deterministic behavior: either all converts or none
    if (isYMap(yRoot)) {
      const record = data as unknown as Record<string, unknown>;
      const convertedEntries: Array<[string, unknown]> = [];
      for (const key of Object.keys(record)) {
        const value = record[key];
        // Validate before conversion (throws on undefined, functions, etc.)
        validateDeepForSharedState(value);
        const converted = plainObjectToYType(
          value,
          coordinator.state,
          coordinator.logger,
        );
        convertedEntries.push([key, converted]);
      }
      // Atomic check-and-set inside transaction to prevent TOCTOU race
      // This prevents bootstrap from overwriting remote data that arrives between check and write
      doc.transact(() => {
        if (yRoot.size > 0) {
          coordinator.logger.warn(
            "bootstrap called on a non-empty document. Aborting to prevent data loss.",
          );
          return;
        }
        for (const [key, converted] of convertedEntries) {
          yRoot.set(key, converted);
        }
      }, VALTIO_Y_ORIGIN);
    } else if (isYArray(yRoot)) {
      const items = (data as unknown as unknown[]).map((v) => {
        validateDeepForSharedState(v);
        return plainObjectToYType(v, coordinator.state, coordinator.logger);
      });
      // Atomic check-and-set inside transaction to prevent TOCTOU race
      doc.transact(() => {
        if (yRoot.length > 0) {
          coordinator.logger.warn(
            "bootstrap called on a non-empty document. Aborting to prevent data loss.",
          );
          return;
        }
        if (items.length > 0) yRoot.insert(0, items);
      }, VALTIO_Y_ORIGIN);
    }

    // Our listener ignores our origin to avoid loops, so we must explicitly
    // reconcile locally to materialize the proxy after bootstrap.
    if (isYMap(yRoot)) {
      reconcileValtioMap(coordinator, yRoot, doc, (fn) =>
        coordinator.withReconcilingLock(fn),
      );
    } else if (isYArray(yRoot)) {
      reconcileValtioArray(coordinator, yRoot, doc, (fn) =>
        coordinator.withReconcilingLock(fn),
      );
    }
  };

  // 3. Set up the reconciler-backed listener for remote changes.
  const disposeSync = setupSyncListener(coordinator, doc, yRoot);

  // 3.5. If the document already has data, do an initial reconciliation
  // This handles the case where data exists before the proxy is created
  if (
    (isYMap(yRoot) && yRoot.size > 0) ||
    (isYArray(yRoot) && yRoot.length > 0)
  ) {
    if (isYMap(yRoot)) {
      reconcileValtioMap(coordinator, yRoot, doc, (fn) =>
        coordinator.withReconcilingLock(fn),
      );
    } else if (isYArray(yRoot)) {
      reconcileValtioArray(coordinator, yRoot, doc, (fn) =>
        coordinator.withReconcilingLock(fn),
      );
    }
  }

  // 4. Set up UndoManager if requested
  if (options.undoManager) {
    const { manager, undoState, updateState, cleanup } = setupUndoManager(
      yRoot,
      options.undoManager,
    );

    // Warn if custom UndoManager instance is provided (scope validation)
    if (options.undoManager instanceof Y.UndoManager) {
      coordinator.logger.warn(
        "UndoManager: Using custom instance. Ensure the UndoManager's scope matches the Y.Map/Y.Array " +
          "returned by getRoot. Mismatched scopes will cause undo/redo to not work correctly. " +
          "The scope is the first argument passed to new Y.UndoManager(scope, options).",
      );
    }

    // Dispose function that cleans up both sync and undo manager
    const disposeWithUndo = () => {
      disposeSync();
      coordinator.disposeAll();
      cleanup();
    };

    // Return with undo/redo functionality
    return {
      proxy: stateProxy as T,
      dispose: disposeWithUndo,
      bootstrap,
      undo: () => {
        if (manager.canUndo()) {
          manager.undo();
        }
      },
      redo: () => {
        if (manager.canRedo()) {
          manager.redo();
        }
      },
      undoState,
      stopCapturing: () => manager.stopCapturing(),
      clearHistory: () => {
        manager.clear();
        updateState();
      },
      manager,
    };
  }

  // 5. Return the proxy, dispose, and bootstrap function (without undo).
  const dispose = () => {
    disposeSync();
    coordinator.disposeAll();
  };

  return { proxy: stateProxy as T, dispose, bootstrap };
}
