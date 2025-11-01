// Map operations planner
// 
// Responsibility:
// - Analyze Valtio subscription ops and categorize map operations
// - Separate planning (what to do) from scheduling (when to do it)

import { isRawSetMapOp, isRawDeleteMapOp } from '../core/types';

export interface MapOpsPlans {
  sets: Map<string, unknown>;
  deletes: Set<string>;
}

/**
 * Analyzes Valtio subscription ops and categorizes map operations.
 * Only processes top-level map operations (path length === 1).
 * 
 * @param ops - Array of Valtio subscription operations
 * @returns Object containing categorized sets and deletes
 */
export function planMapOps(ops: unknown[]): MapOpsPlans {
  const sets = new Map<string, unknown>();
  const deletes = new Set<string>();

  for (const op of ops) {
    if (isRawSetMapOp(op)) {
      const key = op[1][0];
      const newValue = op[2]; // The new value being set
      sets.set(key, newValue);
      // If we're setting a key, remove it from deletes (set overrides delete)
      deletes.delete(key);
    } else if (isRawDeleteMapOp(op)) {
      const key = op[1][0];
      deletes.add(key);
      // If we're deleting a key, remove it from sets (delete overrides set)
      sets.delete(key);
    }
    // Ignore all other operations (nested operations, array operations, etc.)
  }

  return { sets, deletes };
}