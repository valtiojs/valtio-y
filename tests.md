## 📋 **Current Test Structure Analysis**

```
valtio-yjs/
├── src/
│   ├── **/*.test.ts           # 9 unit tests (co-located)
│   ├── core/converter.test.ts
│   ├── planning/*.test.ts
│   ├── scheduling/*.test.ts
│   └── reconcile/*.test.ts
│
└── tests/
    ├── e2e/                   # 1 file - true multi-client scenarios
    ├── integration/           # 6 files - full-stack single-client
    ├── investigation/         # 5 files - experimental/debugging
    └── helpers/               # Test utilities
```

## 🎯 **Test Type Definitions**

### **1. Unit Tests** (`src/**/*.test.ts`)

**What:** Test individual functions/classes in isolation
**When:** Testing pure logic without Y.js or Valtio runtime
**Mocking:** Heavy mocking of dependencies
**Speed:** ⚡ Very fast (<1ms per test)

**Examples:**

- `planArrayOps([...])` → returns correct plan
- `plainObjectToYType(date)` → converts to ISO string
- Type guards: `isYMap()`, `isYArray()`

### **2. Integration Tests** (`tests/integration/`)

**What:** Test full library behavior within a single process
**When:** Testing Y.js ↔ Valtio sync in one doc
**Mocking:** No mocking - real Y.js + Valtio
**Speed:** 🟡 Medium (10-50ms per test)

**Examples:**

- `proxy.x = 1` → Y.Map reflects change
- Remote Y change → proxy updates
- Bootstrap → creates proxies correctly

### **3. E2E Tests** (`tests/e2e/`)

**What:** Test realistic multi-client collaboration scenarios
**When:** Testing sync between 2+ separate Y.Docs
**Mocking:** No mocking - simulated network relay
**Speed:** 🔴 Slower (50-200ms per test)

**Examples:**

- Client A edits → Client B sees change
- Concurrent edits → CRDTs resolve correctly
- Network delay → eventual consistency

### **4. Investigation Tests** (`tests/investigation/`)

**What:** Experimental tests for debugging/research
**When:** Not part of CI - for development exploration
**Keep:** Only temporarily (convert to real tests or delete)

---

## 🗺️ **Gap Mapping: Where Each Test Belongs**

### **UNIT TESTS** (`src/**/*.test.ts`)

```typescript
src/synced-types.test.ts                  # NEW
├─ syncedText() creates Y.Text
├─ syncedText('initial') sets content
└─ Type checking

src/core/guards.test.ts                   # NEW
├─ isYMap(), isYArray(), isYText()
├─ isYSharedContainer()
└─ Edge cases (null, undefined, wrong types)

src/core/context.test.ts                  # NEW
├─ SynchronizationContext creation
├─ bindDoc(), disposeAll()
├─ setArraysWithDeltaDuringSync()
└─ Logger behavior (debug on/off)

src/scheduling/post-transaction-queue.test.ts  # NEW
├─ Queue operations
├─ Flush behavior
└─ Error handling

src/core/converter.test.ts                # EXPAND
├─ Y.Text conversion (ADD)
├─ Circular reference detection (ADD)
├─ Edge cases: very large numbers (ADD)
└─ Empty strings vs null (ADD)

src/planning/array-ops-planner.test.ts    # EXPAND
├─ Negative indices (ADD)
├─ Very large arrays (ADD)
└─ Edge case operations (ADD)

src/reconcile/reconciler.test.ts          # EXPAND
├─ Y.Text reconciliation (ADD)
└─ Deep nesting (10+ levels) (ADD)
```

### **INTEGRATION TESTS** (`tests/integration/`)

```typescript
tests/integration/ytext-operations.spec.ts         # NEW
├─ Insert text into Y.Text
├─ Delete text from Y.Text
├─ Format text (if supported)
├─ Sync Y.Text changes to proxy
└─ Bootstrap with syncedText()

tests/integration/array-operations.spec.ts         # EXPAND (merge with array-operations-detailed)
├─ pop(), shift(), reverse(), sort() (ADD)
├─ fill(), copyWithin() (ADD)
├─ Negative indices (ADD)
└─ Very large arrays (1000+ items) (ADD)

tests/integration/special-values.spec.ts           # NEW
├─ Circular reference throws
├─ Symbol handling
├─ BigInt handling
├─ NaN/Infinity handling
├─ Empty strings vs null vs undefined
└─ MAX_SAFE_INTEGER boundaries

tests/integration/error-handling.spec.ts           # NEW
├─ Invalid Y.js operations
├─ Malformed data
├─ Transaction failures
└─ Recovery scenarios

tests/integration/deep-nesting.spec.ts             # NEW
├─ 10-20 level deep structures
├─ Wide structures (1000+ keys)
├─ Mixed deep+wide
└─ Performance benchmarks for deep access

tests/integration/disposal-lifecycle.spec.ts       # NEW
├─ Memory leak detection
├─ Listener cleanup verification
├─ Dispose idempotency (expand)
├─ Multiple dispose() calls
└─ Dispose → re-create same proxy

tests/integration/transaction-origins.spec.ts      # NEW
├─ Custom origin handling
├─ Origin filtering
├─ Multiple origin types
└─ Nested transactions

tests/integration/undo-redo.spec.ts                # NEW
├─ Y.UndoManager integration
├─ Undo/redo with proxies
├─ Undo/redo synchronization
└─ Scope management
```

### **E2E TESTS** (`tests/e2e/`)

```typescript
tests/e2e/e2e.ytext-collaboration.spec.ts          # NEW
├─ Two clients editing same Y.Text
├─ Concurrent text inserts
├─ Text delete conflicts
└─ Format preservation

tests/e2e/e2e.concurrent-edits.spec.ts             # NEW
├─ Same key edited simultaneously
├─ Array conflicts (insert at same position)
├─ Rapid-fire operations
└─ Out-of-order operation arrival

tests/e2e/e2e.network-scenarios.spec.ts            # NEW
├─ Delayed sync (setTimeout)
├─ Partial updates
├─ Reconnection after disconnect
└─ Large payload sync

tests/e2e/e2e.three-clients.spec.ts                # NEW
├─ 3+ client scenarios
├─ Hub-and-spoke topology
└─ Mesh network topology

tests/e2e/e2e.collaboration.spec.ts                # EXPAND
├─ Y.Text collaboration (ADD)
├─ True conflict scenarios (ADD)
└─ Performance under load (ADD)
```

---

## 📐 **Scalable Test Organization Strategy**

### **1. File Naming Convention**

```typescript
// Unit tests (co-located)
src/core/guards.ts       → guards.test.ts

// Integration tests (by feature)
tests/integration/
├─ [feature]-[aspect].spec.ts
├─ ytext-operations.spec.ts
├─ array-operations.spec.ts
└─ error-handling.spec.ts

// E2E tests (by scenario)
tests/e2e/
├─ e2e.[scenario].spec.ts
├─ e2e.ytext-collaboration.spec.ts
└─ e2e.concurrent-edits.spec.ts

// Investigation (temporary)
tests/investigation/
└─ [whatever].spec.ts (delete after use)
```

### **2. Test Suite Organization**

```typescript
// Group by behavior, not implementation
describe('YText Operations', () => {
  describe('Single Client', () => {
    describe('Insert', () => { ... });
    describe('Delete', () => { ... });
    describe('Format', () => { ... });
  });

  describe('Remote Changes', () => { ... });
  describe('Bootstrap', () => { ... });
});
```

### **3. Shared Test Utilities** (expand `tests/helpers/`)

```typescript
// tests/helpers/test-helpers.ts
export { waitMicrotask, createDocWithProxy } // existing

// ADD:
export function createYTextProxy() { ... }
export function createThreeClientSetup() { ... }
export function expectMemoryLeak(fn) { ... }
export function simulateNetworkDelay(ms) { ... }
export function createLargeDataset(size) { ... }
```

### **4. Test Markers/Tags**

```typescript
// Use vitest's test.each or custom tags
describe('YText', () => {
  it.unit('creates Y.Text', () => { ... });
  it.integration('syncs text edits', () => { ... });
  it.e2e('collaborates between clients', () => { ... });
  it.slow('handles 10k items', () => { ... }); // timeout: 30s
});
```

### **5. CI Pipeline Structure**

```yaml
# .github/workflows/ci.yml
jobs:
  unit:
    run: vitest run src/**/*.test.ts
    # Fast, runs on every PR

  integration:
    run: vitest run tests/integration
    # Medium, runs on every PR

  e2e:
    run: vitest run tests/e2e
    # Slower, runs on PR + main

  investigation:
    run: vitest run tests/investigation
    # Optional, manual trigger only
```

---

## 🎯 **Priority Implementation Plan**

### **Phase 1: Critical Gaps** (Week 1)

```
✅ Unit: src/synced-types.test.ts
✅ Integration: tests/integration/ytext-operations.spec.ts
✅ Unit: src/core/guards.test.ts
```

### **Phase 2: Core Stability** (Week 2)

```
✅ Integration: tests/integration/error-handling.spec.ts
✅ Integration: tests/integration/disposal-lifecycle.spec.ts
✅ Unit: src/core/context.test.ts
```

### **Phase 3: Advanced Features** (Week 3)

```
✅ Integration: tests/integration/undo-redo.spec.ts
✅ E2E: tests/e2e/e2e.ytext-collaboration.spec.ts
✅ E2E: tests/e2e/e2e.concurrent-edits.spec.ts
```

### **Phase 4: Polish & Performance** (Week 4)

```
✅ Integration: tests/integration/deep-nesting.spec.ts
✅ E2E: tests/e2e/e2e.network-scenarios.spec.ts
✅ Integration: Expand all array operation tests
```

---

## 📊 **Success Metrics**

```typescript
// Track coverage and distribution
Total Tests: ~300-400
├─ Unit:        40% (120-160 tests) - <1ms each
├─ Integration: 45% (135-180 tests) - 10-50ms each
└─ E2E:         15% (45-60 tests)   - 50-200ms each

Total Test Time: <30 seconds
Coverage Target: >85% line coverage
```

---

**What do you think of this structure?** Should we start with Phase 1 (Y.Text tests) or would you prefer to tackle a different area first?
