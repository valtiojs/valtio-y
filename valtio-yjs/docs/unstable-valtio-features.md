# Unstable Valtio Features Usage

## Overview

This library relies on certain unstable Valtio APIs to achieve deep integration between Y.js CRDT types and Valtio's reactivity system. These features are marked as "unstable" in Valtio's API, meaning they may change in future versions without following semantic versioning guarantees.

## Why We Use Unstable Features

Y.js collaborative types have complex internal CRDT state that must not be proxied by Valtio. Attempting to proxy Y.js types breaks their ability to:
- Generate transactions correctly
- Maintain proper instance identity
- Preserve internal CRDT structures
- Communicate changes across the network

To solve this, we need to customize Valtio's behavior at a fundamental level.

## Unstable APIs Used

### 1. `unstable_replaceInternalFunction('canProxy', ...)`

**Location**: `src/core/valtio-yjs-integration.ts`

**Purpose**: Prevent Valtio from deep-proxying Y.js AbstractType instances globally.

```typescript
unstable_replaceInternalFunction('canProxy', (defaultCanProxy) => {
  return (x: unknown): boolean => {
    if (x instanceof Y.AbstractType) {
      return false; // Never proxy Y.js types
    }
    return defaultCanProxy(x);
  };
});
```

**Why it's needed**: Without this, Valtio wraps Y.js types in proxies, intercepting their internal property accesses and breaking transaction generation.

**Risk**: If Valtio changes how `canProxy` works or removes this API, we'll need to find an alternative approach.

### 2. `unstable_getInternalStates()`

**Location**: `src/reconcile/reconciler.ts`

**Purpose**: Access Valtio's internal state to:
- Get the base object underlying a proxy (bypassing the proxy trap)
- Access the `refSet` to mark values that shouldn't be proxied
- Directly modify the base object to ensure correct instance identity

```typescript
const { proxyStateMap, refSet } = unstable_getInternalStates();
const proxyState = proxyStateMap.get(valtioProxy as object);
const baseObject = proxyState[0];
refSet.add(yValue);
baseObject[key] = yValue;
```

**Why it's needed**: 
- Valtio's SET trap can transform values through `proxy-compare`'s `getUntracked()`
- We need to ensure Y.js leaf types are stored with exact instance identity
- Direct base object modification guarantees the proxy returns the correct instance

**Risk**: If Valtio changes its internal state structure or removes this API, reconciliation will break.

## Migration Path

### Short Term
We accept the risk of using unstable APIs because:
1. Valtio's core team is responsive and stability-focused
2. These APIs have existed for years without major changes
3. The functionality is critical and has no alternative
4. We have comprehensive tests that will catch breaking changes

### Long Term Solutions to Investigate

#### Option 1: Proposal to Valtio Core
Work with the Valtio team to:
- Stabilize `canProxy` customization (it's a legitimate extension point)
- Add a stable API for "ref-like" values that shouldn't be proxied globally
- Potentially add first-class support for external reactive types

#### Option 2: Alternative Architecture
- Use Valtio's `ref()` more extensively, though it has timing issues (values must be in refSet before SET trap runs)
- Implement a custom proxy layer that sits between user code and Valtio
- Fork Valtio with our modifications (last resort)

#### Option 3: Different State Management
- Switch to a different reactivity system (Zustand, Jotai, etc.)
- However, Valtio's mutable API is the best match for Y.js's mutable CRDT model

## Testing Strategy

Our test suite (especially `e2e.xml-types.spec.ts`) provides comprehensive coverage:
- 22 tests covering all XML type scenarios
- Tests will immediately fail if Valtio changes break our integration
- We monitor Valtio releases and test against pre-release versions

## Monitoring Valtio Changes

We should:
1. Watch the Valtio repository for changes to unstable APIs
2. Test against Valtio beta/rc versions before they're released
3. Participate in Valtio discussions about stabilizing these APIs
4. Document any breaking changes and migration paths in our CHANGELOG

## For Future Maintainers

If unstable APIs break:

### Symptom: `canProxy` no longer works
- **Check**: Does Valtio still export `unstable_replaceInternalFunction`?
- **Look for**: Alternative global configuration options
- **Fallback**: Try using `ref()` on all Y.js types at write time (complex, timing-sensitive)

### Symptom: `getInternalStates` no longer works
- **Check**: Does Valtio expose internal state differently?
- **Look for**: Alternative ways to access base objects or modify refSet
- **Fallback**: Use Valtio's standard `ref()` API, though it has limitations

### Symptom: Instance identity issues
- **Debug**: Check if `proxyA.fragment === fragmentInMap` returns true
- **Check**: Look for Valtio changes in how proxies store ref'd values
- **Test**: Run `tests/investigation/debug-xml-reconcile.spec.ts` to diagnose

## Related Documentation

- [Architecture Overview](./architecture.md) - How valtio-yjs works
- [Type System Analysis](../TYPE-SYSTEM-ANALYSIS.md) - Deep dive into type handling
- [XML Types Success Summary](../XML-TYPES-SUCCESS-SUMMARY.md) - Implementation details

## References

- [Valtio unstable APIs discussion](https://github.com/pmndrs/valtio/discussions)
- [Y.js documentation on AbstractType](https://docs.yjs.dev/api/shared-types)
- [proxy-compare source](https://github.com/dai-shi/proxy-compare)

## Conclusion

Using unstable APIs is a pragmatic decision that enables critical functionality. The risk is manageable given:
- Comprehensive test coverage
- Active monitoring of upstream changes
- Clear documentation of dependencies
- Multiple fallback options

This approach has proven successful in other collaborative editing libraries and represents the current state of the art for integrating CRDTs with reactive JavaScript frameworks.

