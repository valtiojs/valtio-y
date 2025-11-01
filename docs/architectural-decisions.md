# Architectural Decisions

## 1) afterTransaction vs observeDeep

- Problem: Reliably listen for remote changes, including those affecting parts of the document not yet materialized as Valtio proxies.
- Options:
  - observeDeep / observe: granular events but problematic for lazy materialization; listeners do not exist on unmaterialized nodes and require walking parents manually.
  - afterTransaction: global visibility; naïvely reconciling everything would be slow.
- Decision: Use `yRoot.observeDeep`.
- Rationale: Naturally scopes to the chosen root, preserves lazy materialization by walking to the nearest materialized ancestor, and avoids global reconciliation. A future switchable adapter can leverage `changedParentTypes` for very large docs.

## 2) Many Proxies (Controller Proxy Tree) vs Single Snapshot Proxy

- Problem: Shape Valtio state to enable granular reactivity and ergonomic mutations.
- Options:
  - Single proxy over `toJSON()` snapshot: simple to implement but loses identity and granular updates; requires diffing and causes update bounce.
  - Many proxies (live controller proxy tree): one Valtio proxy per `Y.Map`/`Y.Array` that issues direct Yjs ops.
- Decision: Many proxies (the Live Controller Proxy model).
- Rationale: Enables surgical UI updates with `useSnapshot` and preserves identity links between UI dependencies and specific collaborative objects.

## 3) Encapsulated Context vs Global Module State

- Problem: Where to store instance-scoped caches and disposers.
- Options: Module-level globals vs per-instance `SynchronizationContext`.
- Decision: Encapsulate in `SynchronizationContext`.
- Rationale: Prevents cross-instance interference, simplifies tests, and makes lifecycle management explicit (`disposeAll`).

## 4) Eager Upgrade on Local Writes vs Parent-Level Nested Routing

- Problem: Assigning a plain object/array to a controller proxy creates a period where the Valtio tree contains plain values while the Y tree expects live controller proxies. Subsequent nested edits would surface as deeper paths on the parent, tempting parent listeners to route and mutate grandchildren, violating encapsulation and not scaling with depth.
- Options:
  - Parent-level nested routing: detect `path.length > 1` in parent subscriptions and manually forward to child Y types.
  - Eager upgrade: on write, convert plain values to Y types and immediately replace them with controller proxies under a reconciliation lock.
- Decision: Eager upgrade on write.
- Rationale: Restores encapsulation (parents only handle direct children), scales recursively (children handle their own edits), and eliminates brittle, leaky abstractions.

## 5) Per-Controller vs Centralized Batching

- Problem: Interleaved `doc.transact` calls across controller proxies lead to re-entrancy, partial shapes, and hard-to-reason timing during object insertion.
- Options:
  - Per-controller-proxy batching: simpler but still allows competing transactions in the same tick.
  - Centralized batching: one scheduler per context flushes once per microtask.
- Decision: Centralized batching in `SynchronizationContext`.
- Rationale: Guarantees a single transaction per tick, deterministic ordering (map deletes → map sets → array deletes → array sets), coalesces duplicate writes, and runs all eager upgrades post-transaction under the reconciliation lock.

## 6) Why a Reconciliation Lock when Yjs already does CRDTs?

- Problem: Yjs reconciles concurrent edits in the Y document, but our bridge must mirror Y → Valtio and translate Valtio → Y. Without a guard, inbound structural writes to the Valtio proxy would be observed by controller proxies and reflected back into Y, causing loops and redundant transactions.
- Options:
  - Rely solely on Yjs origin checks: prevents the synchronizer from acting on our own Y transactions, but does not stop controller-proxy listeners from creating new Y transactions in response to reconciler writes.
  - Add a reconciliation lock at the Valtio layer: mark a critical section so controller-proxy subscriptions no-op while the reconciler (or post-transaction eager upgrades) mutate the proxy.
- Decision: Use a reconciliation lock (`withReconcilingLock`).
- Rationale: Separates responsibilities and keeps flows one-way during inbound updates. The origin guard stops Yjs-level echo; the lock stops Valtio-level reflection. Together they avoid feedback loops, reduce redundant writes/relay traffic, and ensure deterministic, cheap reconciliation.

## 7) Array Operations: Sets, Deletes, and Replaces

- Problem: Valtio array operations need to map cleanly to Yjs array operations while supporting all standard array methods including moves.
- Decision: Categorize operations into three types:
  1. **Replaces**: Delete + insert at same index (splice replacements like `arr.splice(i, 1, newVal)`)
  2. **Deletes**: Pure deletions (pop, shift, splice deletes)
  3. **Sets**: Pure insertions (push, unshift, splice inserts)
- Rationale: 
  - Enables all standard array operations including moves via splice
  - Prevents identity issues by detecting and merging replace patterns
  - Applies operations in deterministic order (replaces → deletes → sets)
  - Maintains correctness while supporting natural JavaScript array semantics
- Implementation: See `planning/array-ops-planner.ts` for classification logic and `scheduling/array-apply.ts` for execution
- Note: Array moves work correctly via standard splice operations (e.g., `arr.splice(from, 1); arr.splice(to, 0, item)`). For applications with high-frequency concurrent reordering where conflict resolution is critical, consider fractional indexing as an application-level optimization pattern.

## 8) Two-phase Y→Valtio reconciliation with delta-aware arrays

- Problem: Nested array updates could be applied twice when reconciling both ancestor structure and direct array deltas in the same tick; also, children might be missing controllers when deltas arrive.
- Decision:
  - Phase 1: Reconcile the nearest materialized ancestor boundary to ensure parent structure and to materialize any newly introduced child controllers.
  - Phase 2: Apply granular Y.Array deltas only to the direct event targets. If an array has a recorded delta, skip its coarse structural reconcile in Phase 1.
- Rationale: Prevents double-application, preserves identity, and ensures child controllers exist before deltas are applied.
- Consequences:
  - Better performance (coarse array splices avoided when delta is present).
  - Deterministic ordering and fewer observer churns.
  - Clear separation of concerns: structure first, then deltas.

## 9) Validation and Rollback on Assignment Errors

- Problem: When a user assigns invalid data (e.g., objects with `undefined`, functions, or non-plain objects) to a Valtio proxy, the assignment happens immediately in Valtio's state, but validation may fail later during the asynchronous Yjs flush. This creates an inconsistent state where the Valtio proxy contains invalid data that was never written to Yjs.
- Options:
  - **Shallow validation only**: Fast but allows nested invalid data to create inconsistency.
  - **Deep validation with no rollback**: Catches errors but leaves Valtio in inconsistent state.
  - **Deep validation with rollback**: Catches all errors and restores Valtio to previous valid state.
- Decision: Use deep validation with rollback for both maps and arrays.
- Implementation:
  - Validate synchronously using `validateDeepForSharedState` before enqueueing operations
  - Wrap validation and enqueue logic in try/catch blocks
  - On error, use Valtio operation metadata to rollback proxy to previous state
  - Re-throw error to allow user-level error handling
- Rationale:
  - **Consistency**: Valtio proxy and Yjs document always stay in sync
  - **Error clarity**: Errors are thrown synchronously where the assignment happens
  - **Predictability**: Both map and array subscriptions behave identically
  - **Recoverability**: User code can catch and handle validation errors
- Benefits:
  - Prevents partial state corruption on validation failures
  - Eliminates unhandled promise rejections from async validation
  - Provides clear error messages at the point of invalid assignment
  - Enables defensive programming patterns with try/catch
- Test Coverage: See `tests/map-validation-rollback.spec.ts` for comprehensive validation scenarios

## 10) No Implicit Type Conversions (Date, RegExp, etc.)

- Problem: JavaScript has several built-in types (Date, RegExp, URL, etc.) that could potentially be "magically" converted to strings or other primitive representations for storage in Yjs, but this creates ambiguity about what's actually stored and how it will be deserialized.
- Options:
  - **Implicit conversion**: Automatically convert Date → ISO string, RegExp → string representation, etc.
  - **Explicit conversion only**: Reject these types and require users to convert them explicitly.
- Decision: Reject non-plain objects including Date, RegExp, URL, and require explicit conversion.
- Rationale:
  - **Explicitness over magic**: Users should explicitly convert `date.toISOString()` or `regex.toString()` to make serialization obvious
  - **Predictability**: Clear contract about what types are allowed eliminates surprises
  - **No ambiguity**: Prevents confusion about whether a string is a date/regex or just a string
  - **Deserialization control**: Users handle both serialization and deserialization, maintaining full control
  - **Consistency**: All non-plain objects are rejected uniformly - no special cases
- Implementation:
  - `validateDeepForSharedState` rejects all non-plain objects except:
    - Primitives (string, number, boolean, null)
    - Plain objects (created with `{}` or `Object.create(null)`)
    - Plain arrays
    - Y.js collaborative types (Y.Map, Y.Array, Y.Text)
- Examples:
  ```typescript
  // ❌ Rejected - implicit conversion
  proxy.date = new Date();
  
  // ✅ Accepted - explicit conversion
  proxy.date = new Date().toISOString();
  
  // ❌ Rejected - implicit conversion
  proxy.pattern = /test/i;
  
  // ✅ Accepted - explicit conversion
  proxy.pattern = /test/i.toString(); // or .source
  ```
- Benefits:
  - Clear mental model: only primitives, plain objects/arrays, and Y.js types are allowed
  - No hidden conversions that could surprise users
  - Forces good practices: explicit serialization/deserialization
  - Easier to debug: what you assign is what gets stored (no transformations)
  - Better TypeScript support: no special cases to type
- Test Coverage: See `tests/integration/error-handling.spec.ts` for validation of type rejection
