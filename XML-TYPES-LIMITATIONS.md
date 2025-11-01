# Y.Xml Types - Known Limitations

**Status**: 18/22 tests passing ✅ | 4 tests skipped ⚠️

---

## Overview

Y.Xml types (XmlFragment, XmlElement, XmlHook) are partially supported in valtio-yjs. Most common operations work correctly, but there are 4 known limitations that need to be addressed.

---

## 1. Container Deletion Operations Don't Sync (2 tests)

### Y.XmlFragment Deletions

**Test**: `syncs deletions from Y.XmlFragment`

**Problem**:
```typescript
const fragment = new Y.XmlFragment();
fragment.insert(0, [el1, el2, el3]); // Works ✅
fragment.delete(1, 1);                // Deletion doesn't sync to remote peer ❌
```

**Expected**: Remote peer sees 2 elements (el1, el3)  
**Actual**: Remote peer still sees 3 elements (el1, el2, el3)

**Location**: Deletion operations on Y.XmlFragment containers

---

### Y.XmlElement Child Deletions

**Test**: `syncs child removals from Y.XmlElement`

**Problem**:
```typescript
const element = new Y.XmlElement("div");
element.insert(0, [child1, child2]); // Works ✅
element.delete(0, 1);                 // Deletion doesn't sync to remote peer ❌
```

**Expected**: Remote peer sees 1 child (child2)  
**Actual**: Remote peer still sees 2 children (child1, child2)

**Location**: Child deletion operations on Y.XmlElement containers

**Note**: Attribute deletions via `removeAttribute()` work correctly ✅

---

## 2. Y.XmlHook Reactivity Not Triggering

**Test**: `triggers Valtio updates when Y.XmlHook content changes`

**Problem**:
```typescript
const hook = new Y.XmlHook("test");
proxyA.hook = hook;

let renderCount = 0;
subscribe(proxyB, () => renderCount++);

proxyA.hook.set("key", "value"); // Change happens
await waitMicrotask();

// Expected: renderCount > 0
// Actual: renderCount === 0 (Valtio's subscribe didn't fire)
```

**Expected**: Valtio's `subscribe()` callback fires when Y.XmlHook content changes  
**Actual**: No reactivity triggered, though the data syncs correctly

**Location**: Y.XmlHook leaf reactivity mechanism in `src/bridge/leaf-reactivity.ts`

**Note**: 
- Data DOES sync correctly between peers ✅
- Only the automatic reactivity notification is missing
- Regular sync tests pass (see: `syncs Y.XmlHook property changes`)

---

## 3. Y.XmlHook in Arrays Materializes as Plain Object

**Test**: `can store Y.XmlHook in Y.Array`

**Problem**:
```typescript
const hook = new Y.XmlHook("hook1");
hook.set("name", "first");

proxyA.push(hook); // Insert into array
await waitMicrotask();

// Expected: proxyB[0] instanceof Y.XmlHook === true
// Actual: proxyB[0] === { name: 'first' } (plain object)
```

**Expected**: Y.XmlHook instance preserved in arrays  
**Actual**: Y.XmlHook gets materialized as plain JavaScript object `{ name: 'first' }`

**Impact**: 
- Lost access to Y.XmlHook methods (`.get()`, `.set()`, etc.)
- Type information lost

**Location**: Array reconciliation logic doesn't properly handle Y.XmlHook as leaf type

**Note**:
- Y.XmlElement in arrays works correctly ✅
- Y.XmlFragment in arrays works correctly ✅
- Only Y.XmlHook has this issue

---

## What Works (18 passing tests)

### ✅ Y.XmlFragment
- Creating and syncing as containers
- Inserting elements
- Empty fragments

### ✅ Y.XmlElement
- Creating with attributes
- Syncing attribute changes
- **Attribute deletions** (via `removeAttribute()`)
- Inserting children
- Y.XmlText children with live editing
- Empty elements
- Deep nesting (5+ levels tested)

### ✅ Y.XmlHook
- Creating as map-like containers
- Property changes sync correctly
- Property deletions sync correctly

### ✅ Mixed Structures
- Nested XML elements
- XML types mixed with regular objects
- Y.XmlElement in arrays
- Y.XmlFragment in arrays

---

## Root Cause Analysis

### Container Deletions Issue
- Likely: Deletion events from Y.XmlFragment/Y.XmlElement not being observed or reconciled
- Insertions work, so the event observation is partially set up
- May need to add specific handlers for XML container deletion events

### Y.XmlHook Reactivity Issue
- Y.XmlHook extends Y.Map but is treated as a leaf type
- Leaf reactivity setup may not work the same way for Y.Map-based types
- The `observe()` handler may not be triggering Valtio's change detection correctly

### Y.XmlHook in Arrays Issue
- Array reconciliation code checks for leaf types, but Y.XmlHook may be getting materialized before the check
- May need special handling in `reconcileValtioArrayWithDelta` or `reconcileValtioArray`
- The wrapping with `ref()` may not be happening for Y.XmlHook in array contexts

---

## Test Locations

All tests are in: `valtio-yjs/tests/e2e/e2e.xml-types.spec.ts`

**Skipped tests** (search for `it.skip`):
- Line ~54: `syncs deletions from Y.XmlFragment`
- Line ~210: `syncs child removals from Y.XmlElement`
- Line ~323: `triggers Valtio updates when Y.XmlHook content changes`
- Line ~484: `can store Y.XmlHook in Y.Array`

---

## Priority for Next Implementation

1. **High**: Container deletion operations (affects both XmlFragment and XmlElement)
2. **Medium**: Y.XmlHook in arrays (less common use case)
3. **Low**: Y.XmlHook reactivity (nice-to-have, data sync already works)

---

**Last Updated**: Implementation completed with 18/22 tests passing

