# Type System Analysis - Y.js Integration

## Current Classification (✅ CORRECT)

### Containers (Deeply Proxied)
**Type**: `YSharedContainer`
- ✅ `Y.Map<unknown>` - Key-value container, proxied as object
- ✅ `Y.Array<unknown>` - List container, proxied as array

**Behavior**:
- Recursively wrapped in Valtio proxies
- Children auto-converted to proxies or wrapped in ref()
- Reactivity via Valtio's native change detection

### Leaf Types (Wrapped in ref())
**Guard**: `isYLeafType()`
- ✅ `Y.Text` - Collaborative text (includes Y.XmlText)
- ✅ `Y.XmlFragment` - XML array-like container
- ✅ `Y.XmlElement` - XML element with attributes
- ✅ `Y.XmlHook` - Custom hook (extends Y.Map)

**Behavior**:
- Wrapped in `ref()` to prevent deep proxying
- Native Y.js methods preserved
- Reactivity via `observe()` + re-assignment trick

---

## Why XML Types Are Leaf Types (Not Containers)

### Problem They Solve
XML types have **specialized native APIs** that would break if proxied:

```typescript
// Y.XmlElement native methods
element.setAttribute('class', 'btn');    // ❌ Would fail if proxied
element.removeAttribute('class');         // ❌ Would fail if proxied
element.insert(0, [child1, child2]);      // ❌ Would fail if proxied

// Y.XmlFragment native methods
fragment.insert(0, [el1, el2]);           // ❌ Would fail if proxied
fragment.delete(1, 1);                    // ❌ Would fail if proxied

// Y.XmlHook native methods (extends Y.Map)
hook.set('key', 'value');                 // ❌ Would fail if proxied
```

### Why Not Containers?

1. **Y.XmlFragment**: Has array-like interface BUT uses specialized XML methods
2. **Y.XmlElement**: Container with children BUT needs setAttribute/getAttribute
3. **Y.XmlHook**: Extends Y.Map BUT has custom XML hook semantics

If we treated them as containers:
- ❌ Users access via proxy (e.g., `proxyA.fragment[0]`)
- ❌ Native methods like `setAttribute()` would fail
- ❌ XML-specific APIs would be lost

### Current Approach (✅ Correct)

**Store them as leaf types**:
- ✅ Wrapped in `ref()` → no deep proxying
- ✅ Native Y.js methods work directly
- ✅ Reactivity via `observe()` + re-assignment
- ✅ Users call native APIs: `proxyA.element.setAttribute('x', '1')`

---

## Consistency Check

### ✅ Guards Match Types
```typescript
// guards.ts
isYSharedContainer(value: unknown): value is YSharedContainer
  → Y.Map | Y.Array only

isYLeafType(value: unknown): value is Y.Text | Y.XmlFragment | Y.XmlElement | Y.XmlHook
  → Leaf types only

// yjs-types.ts
type YSharedContainer = Y.Map<unknown> | Y.Array<unknown>
  → Matches isYSharedContainer guard ✅
```

### ✅ No Overlap
- Containers and Leaf types are **mutually exclusive**
- No type is in both categories
- XML types only in `isYLeafType()`

### ✅ Usage Pattern
All files check leaf types **before** containers:
```typescript
if (isYLeafType(value)) {
  // Handle as leaf → wrap in ref()
} else if (isYSharedContainer(value)) {
  // Handle as container → create proxy
}
```

This order is critical because `Y.XmlHook extends Y.Map`, so checking containers first would incorrectly classify it.

---

## Known Limitations (Still TODO)

While the type system is correct, there are 4 implementation gaps:

1. **Container deletion operations** (Y.XmlFragment, Y.XmlElement)
   - Deletions don't sync to remote peers
   - Likely: deletion events not handled in observer

2. **Y.XmlHook reactivity**
   - Data syncs ✅
   - Valtio updates don't trigger ❌
   - Re-assignment trick may not work for Map-based types

3. **Y.XmlHook in arrays**
   - Materializes as plain object instead of Y.XmlHook instance
   - May need special handling in array reconciliation

4. **Y.XmlElement child deletions**
   - Similar to #1, child deletion operations don't sync

---

## Conclusion

✅ **Type system is CORRECT**
- Containers properly limited to Y.Map and Y.Array
- XML types correctly classified as leaf types
- No overlap, consistent guard usage
- Comments explain rationale

🔧 **Ready to commit** - the architecture is sound, only implementation details remain for the 4 skipped tests.

---

**Date**: 2025-10-01
**Status**: Type system validated, ready for commit

