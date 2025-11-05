# Investigation Report: Array Batching Bug Fix and New Failures

## Executive Summary

**Original Issue**: Stress test "should handle rapid array mutations (1000 cycles)" was failing with exactly 502 items instead of expected 1000.

**Status**: ✅ **FIXED** - The test now passes consistently.

**Side Effects**: ⚠️ 2 new test failures introduced by the fix:
1. "should handle deeply nested object with 100 levels" - TypeError reading undefined property
2. "should remain stable after 500 array splice cycles" - Array has 9 items instead of 10

---

## Part 1: Original Problem & Fix

### The Bug

**Test**: `tests/integration/stress.spec.ts` - "should handle rapid array mutations (1000 cycles)"

**Pattern**:
```typescript
for (let i = 0; i < 1000; i++) {
  proxy.push(i);      // Add item at index i
  proxy.push(i + 1);  // Add item at index i+1
  proxy.pop();        // Remove last item
}
// Expected: [0, 1, 2, 3, ..., 999] (length 1000)
// Actual:   [0, 5, 1, 2, ...]      (length 502)
```

**Symptom**: Array always ended with exactly 502 items, with incorrect values like `[0, 5, 1, 2, ...]`

### Root Cause Analysis

The issue was in how Valtio operations are batched before being flushed to Y.js:

1. **Valtio Batching**: Valtio synchronously batches all operations from a single execution context before delivering them in one callback
   - In the test, all 3000 operations (1000 cycles × 3 ops) are batched together
   - They arrive at the bridge as one big batch BEFORE any Y.js flush occurs

2. **Stale Length Problem**: During planning, the code was checking `yArray.length` to classify operations:
   - `yArray.length === 0` throughout the entire batching phase (Y.js hasn't been updated yet)
   - Operations at indices 1, 2, 3, etc. were being treated as "out of bounds" when they should be "in bounds"

3. **Wrong Approach - Effective Length**: Initial fix attempt used "effective length" (accounting for pending operations):
   - This caused operations to be classified as "replaces" based on virtual state
   - But at flush time, Y.Array was still empty, so "replaces" failed because there was nothing to replace
   - Resulted in incorrect insertion behavior

### The Solution

Three coordinated changes in `src/scheduling/write-scheduler.ts` and `src/bridge/valtio-bridge.ts`:

#### Change 1: Use Actual Y.Array Length for Planning
**File**: `src/bridge/valtio-bridge.ts` (line 58-66)

**Before**:
```typescript
const effectiveLength = coordinator.getEffectiveArrayLength(yArray);
const { sets, deletes, replaces } = planArrayOps(ops, effectiveLength, coordinator);
```

**After**:
```typescript
const yLength = yArray.length;
const { sets, deletes, replaces } = planArrayOps(ops, yLength, coordinator);
```

**Rationale**: Operations must be classified based on what actually exists in Y.Array at flush time, not based on pending operations that haven't been applied yet.

#### Change 2: Add Cancellation Logic in enqueueArrayDelete
**File**: `src/scheduling/write-scheduler.ts` (line 167-187)

**Added**:
```typescript
enqueueArrayDelete(yArray: Y.Array<unknown>, index: number): void {
  let perArr = this.pendingArrayDeletes.get(yArray);
  if (!perArr) {
    perArr = new Set();
    this.pendingArrayDeletes.set(yArray, perArr);
  }
  perArr.add(index);

  // NEW: Delete overrides any pending set or replace at the same index
  // This ensures push+pop patterns cancel out correctly
  const setMap = this.pendingArraySets.get(yArray);
  if (setMap) {
    setMap.delete(index);
  }
  const replaceMap = this.pendingArrayReplaces.get(yArray);
  if (replaceMap) {
    replaceMap.delete(index);
  }

  this.scheduleFlush();
}
```

**Rationale**: When a delete operation is enqueued at an index, any pending set/replace at that same index should be cancelled (not merged into a replace). This is critical for push+pop patterns where the net effect should be cancellation, not a replace operation.

#### Change 3: Remove Flush-Time Merge Logic
**File**: `src/scheduling/write-scheduler.ts` (line 251-253)

**Removed**: ~60 lines of delete+set merge logic that was converting `delete[i] + set[i]` pairs into `replace[i]` operations

**Replaced with**: Comment explaining the change
```typescript
// Note: Delete+set merge logic removed. Operations now cancel at enqueue time
// in enqueueArrayDelete(), which provides better temporal semantics for
// patterns like push+pop that should cancel out rather than merge into replaces.
```

**Rationale**: The merge logic was designed for splice operations (where delete+set at same index = replace), but it incorrectly treated push+pop patterns the same way. By cancelling at enqueue time based on temporal order, we get correct semantics:
- `set[5]` followed by `delete[5]` → cancellation (net: nothing)
- Not a `replace[5]` (which would leave a value in the array)

### Why This Works

The fix aligns three critical aspects:
1. **Planning**: Uses actual Y.Array state to classify operations correctly
2. **Enqueuing**: Temporal cancellation prevents conflicting operations from both existing
3. **Application**: No merge logic to incorrectly combine operations

For the push+pop pattern:
```typescript
proxy.push(i);     // enqueueArraySet(i, value)
proxy.push(i+1);   // enqueueArraySet(i+1, value)
proxy.pop();       // enqueueArrayDelete(i+1) → cancels the set[i+1]
```

Net result: Only `set[i]` remains, which is correct!

---

## Part 2: Newly Introduced Failures

### Failure 1: Deeply Nested Object (100 levels)

**Test**: `tests/integration/stress.spec.ts:70-109` - "should handle deeply nested object with 100 levels"

**Error**:
```
TypeError: Cannot read properties of undefined (reading 'level1')
at tests/integration/stress.spec.ts:93:61
```

**Test Code** (lines 87-94):
```typescript
proxy.nested = current;  // Assign deeply nested structure
await waitMicrotask();

// Navigate to deepest level
let navCurrent: unknown = proxy.nested;
for (let i = 0; i < 100; i++) {
  navCurrent = (navCurrent as Record<string, unknown>)[`level${i}`];  // ← FAILS HERE
}
```

**What's Happening**: After assigning a 100-level deep nested object, the first navigation step (`level0`) returns `undefined`.

**Hypothesis**: The cancellation logic in `enqueueArrayDelete` might be too aggressive and is now cancelling operations that shouldn't be cancelled. This could affect:
- Map operations (if similar pattern exists)
- Nested object materialization during upgrades
- Post-upgrade callbacks that create proxy wrappers

**Key Questions**:
1. Is the nested structure being properly converted to Y.Map during assignment?
2. Are post-upgrade callbacks being executed to wrap nested Y.Maps in proxies?
3. Could the delete cancellation logic be affecting map operations?

**Investigation Steps**:
1. Add logging to `enqueueMapSet` and `enqueueMapDelete` to see if similar cancellation is needed
2. Check if nested object assignment triggers any delete operations
3. Verify post-upgrade callbacks are running for nested structures
4. Test with smaller nesting depth (e.g., 3 levels) to isolate the issue

**Relevant Code Locations**:
- `src/bridge/valtio-bridge.ts:119-185` - Map subscription handling
- `src/bridge/controller-helpers.ts:createUpgradeChildCallback` - Post-upgrade callback creation
- `src/core/converter.ts:plainObjectToYType` - Plain object to Y.Map conversion

---

### Failure 2: Array Splice Cycles (500 iterations)

**Test**: `tests/integration/stress.spec.ts:459-487` - "should remain stable after 500 array splice cycles"

**Error**:
```
AssertionError: expected [ { id: +0 }, { id: 1 }, …(7) ] to have a length of 10 but got 9
at tests/integration/stress.spec.ts:480:20
```

**Test Code** (lines 465-480):
```typescript
// Start with 10 items
proxy.push(...Array.from({ length: 10 }, (_, i) => ({ id: i })));
await waitMicrotask();

// Perform 500 splice cycles
for (let i = 0; i < 500; i++) {
  // Remove middle item and add new one
  proxy.splice(5, 1);        // Remove at index 5
  proxy.splice(5, 0, { id: 1000 + i });  // Insert at index 5
}
await waitMicrotask();

// Should still have 10 items
expect(proxy).toHaveLength(10);  // ← FAILS: got 9 instead of 10
```

**What's Happening**: After 500 cycles of removing and inserting at the same index, the array ends up with 9 items instead of 10.

**Pattern**: Each cycle does:
1. `splice(5, 1)` - Remove 1 item at index 5
2. `splice(5, 0, item)` - Insert 1 item at index 5

Net effect per cycle should be: Replace item at index 5 (length unchanged)

**Hypothesis**: The cancellation logic is now cancelling splice operations that shouldn't cancel:
- First splice: `delete[5]` is enqueued
- Second splice: `set[5]` is enqueued
- **Bug**: The `delete[5]` cancels the `set[5]`, leaving only the delete!
- Over 500 iterations, this would cause a cumulative length reduction

**Key Issue**: The cancellation logic assumes temporal order equals semantic intent:
```typescript
// In enqueueArrayDelete:
setMap.delete(index);  // Cancels ANY set at this index, regardless of order
```

But for splice operations, the order matters:
- Cycle 1: `delete[5]` then `set[5]` → should NOT cancel (it's a replace)
- This is different from: `set[5]` then `delete[5]` → SHOULD cancel (push+pop pattern)

**Investigation Steps**:
1. Add operation ordering/sequencing to track which operation came first
2. Distinguish between:
   - "Cancel previous operation" (delete cancels earlier set - correct)
   - "Cancel ANY operation" (delete cancels later set - incorrect)
3. Consider adding timestamps or sequence numbers to pending operations
4. Test with a single splice cycle to verify behavior

**Relevant Code Locations**:
- `src/bridge/valtio-bridge.ts:45-110` - Array subscription, where splice operations are planned
- `src/planning/array-ops-planner.ts` - How splice operations are classified
- `src/scheduling/write-scheduler.ts:167-187` - enqueueArrayDelete with cancellation logic

---

## Part 3: Recommended Fix Approach

### Problem: Cancellation Should Respect Temporal Order

The current cancellation logic in `enqueueArrayDelete` is **stateless** - it cancels any operation at the index without knowing if it came before or after:

```typescript
// CURRENT (WRONG):
enqueueArrayDelete(yArray, index) {
  // ...
  setMap.delete(index);  // Cancels set regardless of when it was enqueued
  replaceMap.delete(index);  // Cancels replace regardless of when it was enqueued
}
```

### Solution: Track Operation Sequence

We need to know if the deleted operation came BEFORE or AFTER the delete:

**Option A: Add sequence numbers to operations**
```typescript
interface PendingArrayEntry {
  value: unknown;
  after?: (yValue: unknown) => void;
  sequence: number;  // NEW: Operation ordering
}

private operationSequence = 0;  // NEW: Global counter

enqueueArrayDelete(yArray: Y.Array<unknown>, index: number): void {
  const deleteSequence = this.operationSequence++;

  // Only cancel operations that came BEFORE this delete
  const setMap = this.pendingArraySets.get(yArray);
  if (setMap) {
    const setEntry = setMap.get(index);
    if (setEntry && setEntry.sequence < deleteSequence) {
      setMap.delete(index);  // Cancel: set came before delete (push+pop)
    }
  }
  // Similar for replaces
}
```

**Option B: Separate "pending" from "superseded" operations**
```typescript
// Track which operations supersede which
private supersededOperations = new Map<Y.Array<unknown>, Set<number>>();

enqueueArraySet(yArray, index, value) {
  // Mark any delete at this index as superseded
  const deletes = this.pendingArrayDeletes.get(yArray);
  if (deletes?.has(index)) {
    this.markSuperseded(yArray, 'delete', index);
  }
  // Add the set normally
}

enqueueArrayDelete(yArray, index) {
  // Mark any set at this index as superseded ONLY if it wasn't already marked
  const sets = this.pendingArraySets.get(yArray);
  if (sets?.has(index) && !this.isSuperseded(yArray, 'set', index)) {
    this.markSuperseded(yArray, 'set', index);
  }
  // Add the delete normally
}
```

**Option C: Use the existing flush-time merge logic but fix it**

Instead of removing the merge logic entirely, fix it to handle temporal order:
```typescript
// At flush time, check temporal order:
for (const [yArray, deleteIndices] of arrayDeletes) {
  const setMap = arraySets.get(yArray);

  for (const deleteIndex of deleteIndices) {
    if (setMap?.has(deleteIndex)) {
      const deleteSeq = getSequence(yArray, 'delete', deleteIndex);
      const setSeq = getSequence(yArray, 'set', deleteIndex);

      if (setSeq < deleteSeq) {
        // Set came before delete → Cancel both (push+pop pattern)
        setMap.delete(deleteIndex);
        deleteIndices.delete(deleteIndex);
      } else {
        // Delete came before set → Merge to replace (splice pattern)
        replaceMap.set(deleteIndex, setMap.get(deleteIndex)!);
        setMap.delete(deleteIndex);
        deleteIndices.delete(deleteIndex);
      }
    }
  }
}
```

### Recommended Approach: **Option C** (Fix the merge logic)

**Reasoning**:
1. Minimal changes to the codebase
2. All the infrastructure for merge logic already exists
3. Just needs temporal ordering information
4. Most intuitive: "If set came first, cancel; if delete came first, merge"

**Implementation**:
1. Add sequence number to `PendingArrayEntry` interface
2. Add global sequence counter to WriteScheduler
3. Increment counter on every enqueue operation
4. Restore the merge logic in `flush()` but add sequence checking
5. Remove the enqueue-time cancellation logic from `enqueueArrayDelete`

---

## Part 4: Testing Strategy

### Verify the Fix

1. **Create minimal reproduction tests**:
```typescript
// Test 1: Push+Pop should cancel
it("push+pop should cancel", async () => {
  proxy.push(1);
  proxy.pop();
  await waitMicrotask();
  expect(proxy).toHaveLength(0);
});

// Test 2: Splice should replace
it("splice should replace, not cancel", async () => {
  proxy.push(1, 2, 3);
  await waitMicrotask();

  proxy.splice(1, 1);      // Delete at 1
  proxy.splice(1, 0, 99);  // Insert at 1
  await waitMicrotask();

  expect(proxy).toEqual([1, 99, 3]);  // Not [1, 3]
});
```

2. **Run the full stress test suite**: Ensure all 18 tests pass

3. **Test edge cases**:
   - Multiple deletes at same index
   - Multiple sets at same index
   - Mixed set/delete/replace at same index
   - Operations across different indices

### Regression Prevention

Add tests specifically for the patterns we fixed:
- Rapid push+pop cycles (already exists, now passes)
- Rapid splice cycles (exists, currently failing)
- Nested object assignment (exists, currently failing)

---

## Part 5: Files Modified

### Changes Made in This Fix

1. **src/scheduling/write-scheduler.ts**
   - Added cancellation logic in `enqueueArrayDelete` (lines 175-184)
   - Removed flush-time merge logic (lines 251-253, was ~60 lines)
   - Kept `getEffectiveArrayLength` method (unused now, but might be needed for Option C)

2. **src/bridge/valtio-bridge.ts**
   - Changed from effective length to actual length for planning (line 58-66)
   - Removed debug logging

3. **src/scheduling/array-apply.ts**
   - Removed debug logging

4. **src/planning/array-ops-planner.ts**
   - Removed debug logging

5. **tests/debug-stress.spec.ts**
   - DELETED (was temporary debug test)

### Files to Review for Fix

1. **src/scheduling/write-scheduler.ts**
   - Need to restore merge logic with sequence checking
   - Need to remove enqueue-time cancellation
   - Need to add sequence tracking

2. **src/scheduling/batch-types.ts**
   - Need to add sequence number to `PendingArrayEntry`

---

## Part 6: Open Questions

1. **Why did the effective length approach fail?**
   - It classified operations as "replaces" when they should be "sets"
   - At flush time, Y.Array was empty, so "replaces" became out-of-bounds inserts
   - This is the core issue that needs to be understood to prevent similar bugs

2. **Is there a performance impact?**
   - The fix adds per-operation sequence tracking
   - Merge logic runs at flush time (once per microtask) vs enqueue time (per operation)
   - Should profile to ensure no regression

3. **Are there other operation types affected?**
   - Map operations might have similar issues
   - Replace operations might need sequence tracking too

4. **Should we add explicit "splice" operation type?**
   - Currently splice is decomposed into delete+set
   - Having an explicit "splice" operation would make intent clearer
   - But might complicate the codebase

---

## Part 7: Next Steps for Investigation

### Immediate Actions

1. **Reproduce the failures locally**:
   ```bash
   bun vitest --run tests/integration/stress.spec.ts --reporter=verbose
   ```

2. **Add detailed logging to both failing tests**:
   - Log each operation as it's enqueued
   - Log the state of pending operations before/after each enqueue
   - Log the final state after flush

3. **Verify temporal order hypothesis**:
   - Add sequence numbers to operations
   - Log the sequence in which operations are enqueued
   - Check if splice operations are being cancelled out of order

### Implementation Steps

1. **Phase 1: Add sequence tracking**
   - Modify `PendingArrayEntry` to include sequence number
   - Add global sequence counter to WriteScheduler
   - Update all enqueue methods to assign sequences

2. **Phase 2: Restore and fix merge logic**
   - Restore the deleted merge logic
   - Add sequence checking to determine cancel vs merge
   - Remove enqueue-time cancellation from `enqueueArrayDelete`

3. **Phase 3: Test thoroughly**
   - Run all stress tests
   - Add specific tests for push+pop and splice patterns
   - Verify no performance regression

4. **Phase 4: Clean up**
   - Remove debug logging
   - Update comments to explain temporal ordering
   - Document the decision in an ADR if needed

---

## Appendix: Key Code Snippets

### Current enqueueArrayDelete (WITH CANCELLATION)
```typescript
// src/scheduling/write-scheduler.ts:167-187
enqueueArrayDelete(yArray: Y.Array<unknown>, index: number): void {
  let perArr = this.pendingArrayDeletes.get(yArray);
  if (!perArr) {
    perArr = new Set();
    this.pendingArrayDeletes.set(yArray, perArr);
  }
  perArr.add(index);

  // Delete overrides any pending set or replace at the same index
  // This ensures push+pop patterns cancel out correctly
  const setMap = this.pendingArraySets.get(yArray);
  if (setMap) {
    setMap.delete(index);  // ← THIS IS THE PROBLEM
  }
  const replaceMap = this.pendingArrayReplaces.get(yArray);
  if (replaceMap) {
    replaceMap.delete(index);  // ← THIS IS THE PROBLEM
  }

  this.scheduleFlush();
}
```

### Original enqueueArrayDelete (NO CANCELLATION)
```typescript
// Before our changes
enqueueArrayDelete(yArray: Y.Array<unknown>, index: number): void {
  let perArr = this.pendingArrayDeletes.get(yArray);
  if (!perArr) {
    perArr = new Set();
    this.pendingArrayDeletes.set(yArray, perArr);
  }
  perArr.add(index);
  this.scheduleFlush();
  // No cancellation logic - relied on flush-time merge instead
}
```

### The Deleted Merge Logic (FROM GIT HISTORY)
```typescript
// This was around line 277-340 in write-scheduler.ts before our changes
// It merged delete+set into replace at flush time
for (const [yArray, deleteIndices] of arrayDeletes) {
  const setMap = arraySets.get(yArray);

  if (setMap) {
    for (const deleteIndex of Array.from(deleteIndices)) {
      if (setMap.has(deleteIndex)) {
        // Move operations from delete+set to replace
        const setValue = setMap.get(deleteIndex)!;
        replaceMap.set(deleteIndex, setValue);
        setMap.delete(deleteIndex);
        deleteIndices.delete(deleteIndex);
      }
    }
  }
}
// This logic needs to be restored WITH sequence checking
```

---

## Conclusion

The original bug is fixed, but the fix introduced 2 new failures by being too aggressive with operation cancellation. The recommended solution is to restore the merge logic but add temporal ordering (sequence numbers) to distinguish between:
- Push+pop pattern: `set[i]` then `delete[i]` → CANCEL both
- Splice pattern: `delete[i]` then `set[i]` → MERGE to `replace[i]`

The key insight is that **temporal order determines semantic intent**, and we need to track this in the pending operations.
