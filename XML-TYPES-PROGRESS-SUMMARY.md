# XML Types Debugging Progress Summary

## Issues Identified & Fixed

### 1. **Valtio Reactivity for Y.XmlHook** ✅ FIXED

- **Problem**: Y.XmlHook (extends Y.Map) is treated as a leaf type but wasn't triggering Valtio updates
- **Solution**: Implemented null/value pattern in `leaf-reactivity.ts` to force Valtio to detect changes
- **Status**: Working - Y.XmlHook reactivity test passes

### 2. **Map Reconciliation After Writes** ✅ FIXED

- **Problem**: After writing leaf types to Y.Map, the Valtio proxy wasn't reconciled to point to the actual Y type in the map
- **Solution**: Added post-transaction reconciliation in `map-apply.ts` line 41-50
- **Impact**: Critical for ensuring proxies return the correct Y type instances

### 3. **Leaf Node Reconciliation Using Direct BaseObject Access** ✅ FIXED

- **Problem**: Valtio's SET trap transforms values through `proxy-compare`'s `getUntracked()`, preventing correct leaf node storage
- **Solution**: Modified `reconciler.ts` to bypass Valtio's SET trap by directly accessing the base object via `unstable_getInternalStates()`
- **Result**: `proxyA.fragment === fragmentInMap` now returns `true`

### 4. **Filter Nested Property Operations** ✅ FIXED

- **Problem**: Valtio was tracking internal Y.js property changes on leaf types (e.g., `fragment._length`)
- **Solution**: Added filtering in `valtio-bridge.ts` to only allow top-level property changes (path.length === 1)
- **Impact**: Prevents interference with Y.js internal state management

## Remaining Issues

### Y.XmlFragment/XmlElement Deletions Don't Sync ❌ CRITICAL BUG

**Symptom**: Calling `proxyA.fragment.delete(1, 1)` doesn't generate Y.js transactions

**What We Know**:

1. The fragment is correctly integrated (`fragment.doc !== null`, `fragment.parent !== null`)
2. The proxy returns the correct fragment instance (`fragmentInMap === proxyA.fragment` ✓)
3. Raw Y.js tests show `.delete()` DOES generate transactions normally
4. In the e2e test, **NO transaction is generated** (`docA updates: 0`)

**Root Cause** (Suspected):
The fragment gets deep-proxied by Valtio BEFORE reconciliation adds it to refSet:

- **Before write**: `fragment in refSet? false`
- **After write (before microtask)**: `fragment in refSet? false`
- **After reconciliation**: `fragment in refSet? true`

By the time the fragment is added to refSet, Valtio has already wrapped it in a proxy. Even though we filter nested operations now, the deep-proxy wrapper may be interfering with Y.js's ability to generate transactions.

**Potential Solutions** (Not Yet Implemented):

1. **Pre-emptive ref()**: Intercept writes at a higher level and add Y types to refSet BEFORE Valtio's SET trap processes them
2. **Custom GET trap**: Override the GET trap to automatically unwrap leaf types
3. **Valtio configuration**: Use `unstable_replaceInternalFunction` to customize canProxy check for Y types
4. **Write-time ref()**: Somehow mark values as ref'd during the initial write, not just during reconciliation

## Test Status

### Passing (18/22):

- Y.XmlFragment creation and basic operations
- Y.XmlElement attributes, children, nested structures
- Y.XmlHook map-like behavior and reactivity ✅ (newly fixed)
- XML types in arrays (XmlElement, XmlFragment)
- Mixed XML structures

### Failing (3/22):

- Y.XmlFragment deletions (line 54-104)
- Y.XmlElement child removals (line 210-233)
- Y.XmlHook in arrays becoming plain objects (line 484-504)

## Files Modified

### Core Changes:

- `valtio-yjs/src/bridge/leaf-reactivity.ts` - Null/value reactivity pattern
- `valtio-yjs/src/reconcile/reconciler.ts` - Direct base object access, always-replace strategy
- `valtio-yjs/src/scheduling/map-apply.ts` - Post-transaction reconciliation
- `valtio-yjs/src/bridge/valtio-bridge.ts` - Nested operation filtering

### Test Files:

- `valtio-yjs/tests/e2e/e2e.xml-types.spec.ts` - Comprehensive XML type tests with debug logging
- `valtio-yjs/tests/investigation/debug-xml-reconcile.spec.ts` - Reconciliation debugging
- `valtio-yjs/tests/investigation/debug-yjs-xml-transaction.spec.ts` - Y.js transaction verification

## Key Insights

1. **Valtio's ref() timing is critical**: Values must be in refSet BEFORE the SET trap processes them
2. **Reconciliation must bypass Valtio traps**: Direct base object access is necessary for leaf types
3. **Deep proxying breaks Y.js**: Even with filtering, wrapped Y types don't behave correctly
4. **Y.js transactions are sensitive**: Something about the proxy wrapper prevents transaction generation

## Next Steps

The fundamental issue is that Valtio creates deep proxies before we can prevent it. We need a way to:

1. Detect Y.js types earlier in the write pipeline
2. Add them to refSet proactively
3. Or intercept Valtio's canProxy check to exclude Y types globally

This may require coordination with Valtio's internal mechanisms or a different architectural approach for handling leaf types.
