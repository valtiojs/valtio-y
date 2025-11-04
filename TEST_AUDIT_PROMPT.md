# Test Audit Prompt: Finding Tests That Check Wrong Instances

## Background: The Problem We Found

We discovered 6 fundamentally flawed tests in `controller-creation-timing.spec.ts` that appeared to pass but were actually testing the wrong instances. Here's what was wrong:

### The Pattern of the Flaw

```typescript
// FLAWED PATTERN - DO NOT COPY
it("map controller: Y.Map must exist before controller proxy is created", async () => {
  const doc = new Y.Doc();
  const yRoot = doc.getMap<unknown>("root");

  // ❌ Creating a separate coordinator instance for inspection
  const coordinator = new ValtioYjsCoordinator(doc, "debug");

  // ... some Y.js setup ...

  // ❌ Creating the proxy system, which creates ITS OWN coordinator internally
  const { proxy } = createYjsProxy<Record<string, unknown>>(doc, {
    getRoot: (d) => d.getMap("root"),
  });

  // ❌ Checking state on the coordinator we created, NOT the one createYjsProxy created
  const proxyBeforeSet = getValtioProxyForYType(coordinator, yNested);
  expect(proxyBeforeSet).toBeUndefined();
});
```

### Why This Is Fundamentally Broken

1. **Testing Wrong Instance**: `createYjsProxy()` creates its own `ValtioYjsCoordinator` internally (see `/Users/alex/code/valtio-yjs/valtio-y/src/create-yjs-proxy.ts:48`)
2. **False Confidence**: The tests pass, but they're checking state that the system under test never touches
3. **No Actual Verification**: The test could pass even if the real system is completely broken

### The Key Insight

When a function/factory **encapsulates instantiation** (creates its own instances internally), you cannot meaningfully test those internal instances from outside. You can only test the **observable behavior** of the public API.

## Your Task: Audit Tests for This Pattern

Please analyze the test files in this codebase for similar issues. Look for:

### 🚩 Red Flags to Identify

1. **Creating instances that factory functions also create internally**
   - Test creates: `new ValtioYjsCoordinator(...)`
   - Then calls a function that also creates: `createYjsProxy()` (which creates its own coordinator)
   - Then checks state on the manually-created instance

2. **Testing internal state that's not exposed by the public API**
   - Importing internal classes/functions not meant for external use
   - Checking state on instances that exist parallel to (not part of) the system under test

3. **Tests that would pass even if the real implementation is broken**
   - If you can make the test pass by only modifying the test code (not implementation), it's likely flawed
   - If the test doesn't actually exercise the code path it claims to test

### ✅ What Makes a Valid Test

**Good patterns:**
- Test the **observable behavior** through the public API
- Create the system through its normal entry points (factories, constructors)
- Make assertions on the same instances the system uses

**Example of a proper test:**
```typescript
it("proxy syncs correctly with Yjs", async () => {
  const doc = new Y.Doc();

  // ✅ Create system through public API
  const { proxy } = createYjsProxy<Record<string, unknown>>(doc, {
    getRoot: (d) => d.getMap("root"),
  });

  // ✅ Test observable behavior
  proxy.nested = { key: "value" };
  await waitMicrotask();

  // ✅ Verify effects on the same doc instance
  const yRoot = doc.getMap("root");
  const yNested = yRoot.get("nested") as Y.Map<unknown>;
  expect(yNested.get("key")).toBe("value");
});
```

### 📋 Audit Checklist

For each test file, check:

1. **Does the test create instances of internal classes?**
   - `ValtioYjsCoordinator`, `WriteScheduler`, `SynchronizationState`, etc.

2. **Does the test then call a factory/wrapper that also creates these classes?**
   - `createYjsProxy()` creates `ValtioYjsCoordinator`
   - Look for other factories that might create internal instances

3. **Does the test inspect state on the manually-created instances?**
   - Using internal APIs like `getValtioProxyForYType(coordinator, ...)`
   - Checking `coordinator.state.*` directly

4. **Could the test pass with the implementation completely broken?**
   - Mock mental model: if the real coordinator is broken, but the test-created one works, test passes = flawed

### 🎯 Specific Functions to Watch

In this codebase, watch for tests that:
- Create `ValtioYjsCoordinator` manually, then call `createYjsProxy()`
- Create `WriteScheduler` manually, then test through coordinator methods
- Import internal bridge/coordinator functions and test them in isolation without integration

### 📝 Report Format

For each potentially flawed test, report:
1. **File and test name**
2. **Why it appears flawed** (which pattern it matches)
3. **What it's actually testing** (wrong instance? parallel instance?)
4. **Suggested fix** (remove test? convert to integration test? change approach?)

### ⚠️ Edge Cases: When Internal Testing Is Valid

Some exceptions where testing internal components directly is OK:
- **Unit tests for pure functions** (no state, no instances)
- **Unit tests for classes with explicit test constructors** (designed for testing)
- **Tests that don't mix internal instances with factory-created instances**

## Example Output Format

```markdown
### Potentially Flawed Tests Found

#### 1. `tests/integration/some-test.spec.ts` - "should validate coordinator state"
- **Pattern**: Creates separate coordinator, then uses createYjsProxy()
- **Why flawed**: Checks coordinator.state.yTypeToValtioProxy on wrong instance
- **Severity**: High - test passes but doesn't verify actual system
- **Suggestion**: Remove test or convert to integration test that checks observable behavior only

#### 2. `tests/unit/scheduler.spec.ts` - "should batch operations"
- **Pattern**: Creates WriteScheduler directly
- **Why potentially OK**: Doesn't mix with factory-created instances; isolated unit test
- **Severity**: Low - needs review but may be intentional unit test
- **Suggestion**: Verify this is intentional unit testing, not accidental parallel instance testing
```

---

## Start Here

Please audit the following test directories:
- `valtio-y/tests/basic/`
- `valtio-y/tests/integration/`
- `valtio-y/tests/e2e/`

Focus on integration tests first, as they're most likely to have this pattern.
