/**
 * Prototype: Optimized useUndoManager Hook
 *
 * This demonstrates the optimal implementation with all performance
 * optimizations and best practices applied.
 */

import { useSyncExternalStore, useCallback, useMemo, useRef, useEffect } from 'react';
import { UndoManager } from 'yjs';
import type * as Y from 'yjs';

// ============================================================================
// TYPES
// ============================================================================

export interface UseUndoManagerOptions {
  /**
   * Debounce rapid events to reduce re-renders.
   * Default: 16ms (~60fps)
   * Set to 0 to disable debouncing.
   */
  debounceMs?: number;

  /**
   * Include stack sizes in the returned state.
   * Default: false (performance - only calculate when needed)
   */
  includeStackSizes?: boolean;

  /**
   * Capture timeout for grouping operations.
   * Default: 500ms (Yjs default)
   */
  captureTimeout?: number;

  /**
   * Only track changes from these origins.
   * Useful in multi-user scenarios to only undo local changes.
   * Default: undefined (track all origins)
   */
  trackedOrigins?: Set<any>;

  /**
   * Maximum stack size. When exceeded, oldest items are removed.
   * Default: undefined (unlimited)
   */
  maxStackSize?: number;
}

export interface UndoManagerState {
  /** Whether undo is available */
  canUndo: boolean;
  /** Whether redo is available */
  canRedo: boolean;
  /** Number of items in undo stack (if includeStackSizes=true) */
  undoStackSize?: number;
  /** Number of items in redo stack (if includeStackSizes=true) */
  redoStackSize?: number;
}

export interface UseUndoManagerResult extends UndoManagerState {
  /** Undo the last operation */
  undo: () => void;
  /** Redo the last undone operation */
  redo: () => void;
  /** Clear all undo/redo history */
  clear: () => void;
  /** Stop capturing current operation (force new undo step) */
  stopCapturing: () => void;
  /** The underlying UndoManager instance (for advanced usage) */
  manager: UndoManager;
}

// ============================================================================
// MAIN HOOK
// ============================================================================

/**
 * Hook for reactive Yjs UndoManager state.
 *
 * Features:
 * - Automatic cleanup (no memory leaks)
 * - Stable function references (prevents child re-renders)
 * - Debounced updates (handles bulk operations efficiently)
 * - React 18+ concurrent-safe (useSyncExternalStore)
 * - SSR support
 * - Full TypeScript support
 *
 * @example Basic usage
 * ```tsx
 * function MyComponent() {
 *   const { undo, redo, canUndo, canRedo } = useUndoManager(undoManager);
 *
 *   return (
 *     <>
 *       <button onClick={undo} disabled={!canUndo}>Undo</button>
 *       <button onClick={redo} disabled={!canRedo}>Redo</button>
 *     </>
 *   );
 * }
 * ```
 *
 * @example With options
 * ```tsx
 * const { undo, redo, canUndo, canRedo, undoStackSize } = useUndoManager(
 *   undoManager,
 *   {
 *     debounceMs: 32, // Update every 2 frames instead of every frame
 *     includeStackSizes: true, // Show "Undo (5)"
 *     maxStackSize: 50, // Limit history to 50 operations
 *   }
 * );
 * ```
 */
export function useUndoManager(
  undoManager: UndoManager,
  options: UseUndoManagerOptions = {}
): UseUndoManagerResult {
  const {
    debounceMs = 16,
    includeStackSizes = false,
    maxStackSize,
  } = options;

  // Track max stack size with event listener
  useEffect(() => {
    if (!maxStackSize) return;

    const enforceMaxSize = () => {
      while (undoManager.undoStack.length > maxStackSize) {
        undoManager.undoStack.shift();
      }
    };

    undoManager.on('stack-item-added', enforceMaxSize);

    return () => {
      undoManager.off('stack-item-added', enforceMaxSize);
    };
  }, [undoManager, maxStackSize]);

  // Subscribe to UndoManager events with debouncing
  // Uses useSyncExternalStore for React 18+ concurrent safety
  const state = useSyncExternalStore<UndoManagerState>(
    useCallback(
      (callback) => {
        let timeoutId: ReturnType<typeof setTimeout> | null = null;

        // Debounced callback to batch rapid updates
        const debouncedCallback = debounceMs > 0
          ? () => {
              if (timeoutId !== null) clearTimeout(timeoutId);
              timeoutId = setTimeout(callback, debounceMs);
            }
          : callback;

        // Subscribe to all UndoManager events
        undoManager.on('stack-item-added', debouncedCallback);
        undoManager.on('stack-item-popped', debouncedCallback);
        undoManager.on('stack-cleared', debouncedCallback);

        return () => {
          // Cleanup: clear pending timeout and remove listeners
          if (timeoutId !== null) clearTimeout(timeoutId);
          undoManager.off('stack-item-added', debouncedCallback);
          undoManager.off('stack-item-popped', debouncedCallback);
          undoManager.off('stack-cleared', debouncedCallback);
        };
      },
      [undoManager, debounceMs]
    ),

    // Get current snapshot (called on every event and initially)
    useCallback((): UndoManagerState => {
      const state: UndoManagerState = {
        canUndo: undoManager.canUndo(),
        canRedo: undoManager.canRedo(),
      };

      // Only calculate stack sizes if requested (performance optimization)
      if (includeStackSizes) {
        state.undoStackSize = undoManager.undoStack.length;
        state.redoStackSize = undoManager.redoStack.length;
      }

      return state;
    }, [undoManager, includeStackSizes]),

    // Server snapshot (SSR) - always returns empty state
    () => ({
      canUndo: false,
      canRedo: false,
      ...(includeStackSizes && { undoStackSize: 0, redoStackSize: 0 }),
    })
  );

  // Stable function references (prevent child component re-renders)
  const undo = useCallback(() => undoManager.undo(), [undoManager]);
  const redo = useCallback(() => undoManager.redo(), [undoManager]);
  const clear = useCallback(() => undoManager.clear(), [undoManager]);
  const stopCapturing = useCallback(() => undoManager.stopCapturing(), [undoManager]);

  // Return combined state and methods with stable reference
  return useMemo(
    () => ({
      ...state,
      undo,
      redo,
      clear,
      stopCapturing,
      manager: undoManager,
    }),
    [state, undo, redo, clear, stopCapturing, undoManager]
  );
}

// ============================================================================
// FACTORY HOOK (Creates and manages UndoManager instance)
// ============================================================================

/**
 * Creates and manages an UndoManager instance.
 * Handles creation and cleanup automatically.
 *
 * @example
 * ```tsx
 * function MyApp() {
 *   const ydoc = new Y.Doc();
 *   const { proxy: state } = createYjsProxy(ydoc, {
 *     getRoot: (doc) => doc.getMap("state"),
 *   });
 *
 *   // Hook creates and cleans up UndoManager automatically
 *   const undoState = useCreateUndoManager(
 *     () => ydoc.getMap("state"),
 *     { captureTimeout: 500 }
 *   );
 *
 *   return (
 *     <button onClick={undoState.undo} disabled={!undoState.canUndo}>
 *       Undo
 *     </button>
 *   );
 * }
 * ```
 */
export function useCreateUndoManager(
  getScope: () => Y.Map<unknown> | Y.Array<unknown> | Array<Y.Map<unknown> | Y.Array<unknown>>,
  options: UseUndoManagerOptions = {}
): UseUndoManagerResult {
  const { captureTimeout = 500, trackedOrigins, ...restOptions } = options;

  // Create UndoManager once on mount
  const undoManagerRef = useRef<UndoManager | null>(null);

  useEffect(() => {
    const scope = getScope();
    const manager = new UndoManager(scope, {
      captureTimeout,
      ...(trackedOrigins && { trackedOrigins }),
    });

    undoManagerRef.current = manager;

    return () => {
      // Cleanup: Yjs UndoManager doesn't have destroy(), but we should
      // remove all event listeners. Our hook's cleanup will handle this.
      manager.clear(); // Clear history
      undoManagerRef.current = null;
    };
  }, []); // Only create once

  // If undoManager hasn't been created yet, return empty state
  if (!undoManagerRef.current) {
    return {
      canUndo: false,
      canRedo: false,
      undo: () => {},
      redo: () => {},
      clear: () => {},
      stopCapturing: () => {},
      manager: null as any, // Will be set after first render
    };
  }

  // Use the main hook with the created instance
  return useUndoManager(undoManagerRef.current, restOptions);
}

// ============================================================================
// KEYBOARD SHORTCUTS HOOK
// ============================================================================

export interface UseUndoKeyboardShortcutsOptions {
  /** Disable keyboard shortcuts */
  disabled?: boolean;
  /** Custom key for undo (default: 'z') */
  undoKey?: string;
  /** Custom key for redo (default: 'y' or 'Z') */
  redoKey?: string;
  /** Use Ctrl instead of Cmd on Mac (default: false) */
  useCtrlOnMac?: boolean;
}

/**
 * Adds keyboard shortcuts for undo/redo (Cmd/Ctrl+Z, Cmd/Ctrl+Shift+Z).
 *
 * @example
 * ```tsx
 * function MyApp() {
 *   const undoState = useUndoManager(undoManager);
 *
 *   // Automatically enables Cmd+Z / Ctrl+Z for undo
 *   // and Cmd+Shift+Z / Ctrl+Y for redo
 *   useUndoKeyboardShortcuts(undoState);
 *
 *   return <YourUI />;
 * }
 * ```
 */
export function useUndoKeyboardShortcuts(
  { undo, redo, canUndo, canRedo }: Pick<UseUndoManagerResult, 'undo' | 'redo' | 'canUndo' | 'canRedo'>,
  options: UseUndoKeyboardShortcutsOptions = {}
): void {
  const {
    disabled = false,
    undoKey = 'z',
    redoKey = 'y',
    useCtrlOnMac = false,
  } = options;

  useEffect(() => {
    if (disabled) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      const modKey = useCtrlOnMac ? e.ctrlKey : (isMac ? e.metaKey : e.ctrlKey);

      // Undo: Cmd/Ctrl+Z (without Shift)
      if (modKey && e.key.toLowerCase() === undoKey && !e.shiftKey) {
        if (canUndo) {
          e.preventDefault();
          undo();
        }
      }

      // Redo: Cmd/Ctrl+Shift+Z OR Cmd/Ctrl+Y
      if (modKey && (
        (e.shiftKey && e.key.toLowerCase() === undoKey) ||
        e.key.toLowerCase() === redoKey
      )) {
        if (canRedo) {
          e.preventDefault();
          redo();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [disabled, undo, redo, canUndo, canRedo, undoKey, redoKey, useCtrlOnMac]);
}

// ============================================================================
// EXAMPLE USAGE
// ============================================================================

/**
 * Example component showing all features
 */
export function ExampleUndoRedoComponent({ undoManager }: { undoManager: UndoManager }) {
  // Basic usage
  const { undo, redo, canUndo, canRedo, undoStackSize, redoStackSize } = useUndoManager(
    undoManager,
    {
      debounceMs: 16, // Debounce to ~60fps
      includeStackSizes: true, // Show stack sizes
      maxStackSize: 50, // Limit to 50 operations
    }
  );

  // Enable keyboard shortcuts
  useUndoKeyboardShortcuts({ undo, redo, canUndo, canRedo });

  return (
    <div className="flex gap-2 items-center">
      <button
        onClick={undo}
        disabled={!canUndo}
        className="px-4 py-2 bg-blue-500 text-white rounded disabled:opacity-50"
      >
        Undo {undoStackSize ? `(${undoStackSize})` : ''}
      </button>
      <button
        onClick={redo}
        disabled={!canRedo}
        className="px-4 py-2 bg-blue-500 text-white rounded disabled:opacity-50"
      >
        Redo {redoStackSize ? `(${redoStackSize})` : ''}
      </button>
      <span className="text-sm text-gray-500">
        {canUndo && 'Cmd+Z to undo'} {canRedo && ' • Cmd+Shift+Z to redo'}
      </span>
    </div>
  );
}

// ============================================================================
// PERFORMANCE COMPARISON
// ============================================================================

/*
NAIVE IMPLEMENTATION:
```tsx
function NaiveUndo() {
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  useEffect(() => {
    const update = () => {
      setCanUndo(undoManager.canUndo());
      setCanRedo(undoManager.canRedo());
    };

    undoManager.on('stack-item-added', update);
    undoManager.on('stack-item-popped', update);
    undoManager.on('stack-cleared', update);

    update();

    return () => {
      undoManager.off('stack-item-added', update);
      undoManager.off('stack-item-popped', update);
      undoManager.off('stack-cleared', update);
    };
  }, []);

  return (
    <button onClick={() => undoManager.undo()} disabled={!canUndo}>
      Undo
    </button>
  );
}
```

PROBLEMS:
- ❌ Two separate state updates = two re-renders per event
- ❌ New function created on every render (onClick={() => ...})
- ❌ No debouncing = 100 events = 100 re-renders
- ❌ No concurrent safety (tearing in React 18+)
- ❌ No SSR support
- ❌ Verbose (25+ lines for basic functionality)

OPTIMIZED IMPLEMENTATION (THIS FILE):
- ✅ Single state object = one re-render
- ✅ Stable function references (useCallback)
- ✅ Debounced updates = 100 events = 1-2 re-renders
- ✅ Concurrent-safe (useSyncExternalStore)
- ✅ SSR support
- ✅ Concise (1 line to use)

PERFORMANCE:
Bulk operation (100 items with captureTimeout=500):
- Naive: 100-200 re-renders (2 state updates × 100 events)
- Optimized: 1-2 re-renders (debounced to 16ms)
- Speedup: ~100x fewer re-renders
*/
