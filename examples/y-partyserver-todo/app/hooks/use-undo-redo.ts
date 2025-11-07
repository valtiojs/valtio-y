import { useSnapshot } from "valtio";
import {
  undo as performUndo,
  redo as performRedo,
  uiState,
} from "../yjs-setup";

/**
 * Custom hook for reactive undo/redo state
 *
 * Uses Valtio's useSnapshot to reactively track undo/redo availability.
 * The state updates automatically when the Yjs UndoManager stack changes.
 *
 * @returns Object with undo/redo functions and reactive state
 *
 * @example
 * ```tsx
 * const { undo, redo, canUndo, canRedo } = useUndoRedo();
 *
 * <button onClick={undo} disabled={!canUndo}>
 *   Undo
 * </button>
 * ```
 */
export function useUndoRedo() {
  // Use Valtio's useSnapshot for reactive state - no manual subscriptions needed!
  const snap = useSnapshot(uiState);

  return {
    undo: performUndo,
    redo: performRedo,
    canUndo: snap.canUndo,
    canRedo: snap.canRedo,
  };
}
