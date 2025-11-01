# XML Deletion Bug - Deep Investigation

## Summary

XML container deletions don't sync because of **instance tracking issues** when leaf types with pre-populated content are assigned to Valtio proxies before bootstrap.

## Root Cause Chain

### 1. Bootstrap Aborts on Non-Empty Documents
```typescript
// When user does:
const fragment = new Y.XmlFragment();
fragment.insert(0, [el1, el2, el3]);  // Insert BEFORE adding to doc
proxyA.fragment = fragment;            // Triggers Y.Map set
bootstrapA({});                         // ❌ ABORTS because mapA.size > 0
```

**Result**: No reconciliation runs, wrong instance stays in proxy.

### 2. Async Upgrade Callback Runs Too Late
```typescript
// In map-apply.ts (BEFORE fix):
yMap.set(key, yValue);
postQueue.enqueue(() => entry.after!(yValue));  // ❌ Runs AFTER transaction
```

**Problem**: By the time callback runs, proxy already has wrong instance.

**Attempted Fix**: Call callback synchronously
```typescript
// In map-apply.ts (AFTER fix):
yMap.set(key, yValue);
const valueInMap = yMap.get(key);
entry.after!(valueInMap);  // ✅ Call immediately
```

### 3. **BLOCKING ISSUE**: Valtio Not Storing Value During Reconciling Lock

Debug output shows:
```
[upgradeChildIfNeeded] Set container['fragment'] to wrappedLeaf
[upgradeChildIfNeeded] verify: false  ❌
```

After `container[key] = wrappedLeaf` inside `withReconcilingLock`, reading `container[key]` returns a DIFFERENT instance!

**Hypothesis**: Either:
1. Reconciling lock is preventing the storage operation
2. Valtio's proxy trap is transforming the value
3. There's a timing issue with how we're verifying

## Test Results

### Passing Test Pattern
```typescript
const fragment = new Y.XmlFragment();  // Empty
proxyA.fragment = fragment;             // Assign empty
bootstrapA({});                         // Runs reconciliation ✅
proxyA.fragment.insert(0, [element]);  // Insert AFTER
```

**Works**: Instance gets fixed during reconciliation.

### Failing Test Pattern
```typescript
const fragment = new Y.XmlFragment();
fragment.insert(0, [el1, el2, el3]);   // Insert BEFORE
proxyA.fragment = fragment;              // Assign with content
bootstrapA({});                          // ❌ Aborts, no reconciliation
proxyA.fragment.delete(1, 1);           // Deletes from wrong instance!
```

**Fails**: 
- `proxyA.fragment !== mapA.get('fragment')` (wrong instance)
- `mapB.get('fragment').length === 3` (deletion doesn't sync)

## Y.js Behavior Verified

✅ Y.js correctly:
- Preserves instance when setting standalone types: `mapA.get('frag') === frag`
- Syncs content even if inserted before adding to doc
- Syncs deletions between instances: `fragmentA.delete(1,1)` → `fragmentB.length === 2`

❌ Our integration incorrectly:
- Stores wrong instance in Valtio proxy
- Observes wrong instance for reactivity
- Deletions don't propagate because we're mutating standalone instance

## Files Modified (Partial Fix)

1. **`src/scheduling/map-apply.ts`**:
   - Get value from map after set: `const valueInMap = yMap.get(key)`
   - Call upgrade callback synchronously: `entry.after!(valueInMap)`

2. **`src/scheduling/array-apply.ts`**:
   - Same fix for arrays (4 locations)

3. **Debug logging added**:
   - `src/reconcile/reconciler.ts`: Log leaf node reconciliation
   - `src/bridge/valtio-bridge.ts`: Log upgradeChildIfNeeded calls

## Next Steps to Fix

### Option A: Fix Reconciling Lock Storage Issue
Investigate why `container[key] = value` inside `withReconcilingLock` doesn't persist the value.

**Check**:
1. Is `withReconcilingLock` blocking proxy traps?
2. Is there a race condition with the lock state?
3. Should we set the value OUTSIDE the lock?

### Option B: Bypass Bootstrap Abort
Allow bootstrap on non-empty docs if only leaf types exist, run reconciliation forcibly.

### Option C: Eager Instance Correction
During Valtio subscription (when user assigns value), immediately retrieve from Y.Map and replace:

```typescript
// In attachValtioMapSubscription, after enqueueMapSet:
context.enqueueMapSet(yMap, key, value, (yValue) => {
  upgradeChildIfNeeded(...);
});

// ADD: Immediate correction for leaf types
if (isYLeafType(value)) {
  // After flush, force-correct the instance
  scheduler.afterFlush(() => {
    const correctInstance = yMap.get(key);
    if (objProxy[key] !== correctInstance) {
      objProxy[key] = ref(correctInstance);
      setupLeafNodeReactivity(...);
    }
  });
}
```

### Option D: Rethink Leaf Type Architecture
Maybe XML containers SHOULD be treated as containers, not leaf types, and we need a different approach to preserve their native methods.

**Consideration**: Y.XmlFragment, Y.XmlElement have both:
- Container-like interfaces (insert/delete/get)
- Specialized XML methods (setAttribute, etc.)

Perhaps they need hybrid handling?

## Recommendation

**Immediate**: Focus on Option A - understand why the storage isn't working.

**Test**:
```typescript
// Minimal reproduction
const p = proxy({ item: null });
context.withReconcilingLock(() => {
  p.item = fragment;
  console.log(p.item === fragment);  // Should be true
});
```

If false, the reconciling lock implementation has a bug.

**Long-term**: Consider if XML types classification is correct. They may need special handling beyond simple leaf/container dichotomy.

---

**Status**: Investigation ongoing, 18/22 XML tests passing, 4 deletion-related tests still failing.
**Date**: 2025-10-01

