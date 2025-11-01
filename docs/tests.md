# Test Plan (Architecture-Aligned)

This document outlines the tests we should implement for the current architecture.
Focus: CRUD-only arrays (no moves), centralized batching, reconciliation, and converter usage strictly at boundaries.

## 0) Test Harness Utilities

- Setup two `Y.Doc`s with relay and `RELAY_ORIGIN`-style origin tagging.
- Root is `Y.Map("sharedState")`; only `doc1` is bootstrapped, `doc2` syncs from relay.
- `createYjsProxy` used per doc; expose `dispose` to simulate disconnects.
- Helper: `assertNoGapsNoNulls(list)`; `assertDeepEqualAcrossClients()`; `waitMicrotask()`.

## 1) Array: Push (set with no deletes)

- Push single item on client A → client B reflects item with full content (no {}).
- Push multiple items in one tick (batched) → order preserved; no holes; no {}.
- Push nested object item (e.g., `meta: { author: "x" }`) → nested materialized on both clients after microtask.
- Timing: immediate `JSON.stringify(proxy.list)` may show {}; after `waitMicrotask()` values are populated; `yRoot.toJSON()` shows full content immediately.

## 2) Array: True Replace (set with no deletes)

- Replace index 0 with new plain object on client A → client B sees replacement content.
- Replace with nested object → nested fields present on both after microtask.
- Invariant: index count unchanged; no cloning side-effects; identity change reflected in proxy (new object identity at that index).

## 3) Array: Delete (one or more) — sets ignored when deletes exist

- Start with 2 items. Push 1 (now 3). Delete first → both clients show last two items, no nulls, no {}.
- Start with 4 items. Delete middle index → array compacts; state matches splice semantics; no {}.
- Multi-delete in a single tick (e.g., delete indices 1 and 2) → array compacts once; remote matches local; no nulls.
- Mixed batch (push + delete in same tick): if deletes present, all sets ignored; result equals splice of original array only by deletes.
- Invariant: Yjs update integrates without errors; delta-based reconciler produces final length = expected; no `_YMap._integrate` errors.

## 4) No Moves Policy

- Perform `splice(0, 1)` that causes Valtio to emit sets for shifted indices. Verify library ignores sets; only deletes applied.
- Ensure final order matches Yjs natural compaction; no delete-then-insert of existing Y types; no cloning performed.
- Confirm logs: controller ignores sets when deletes exist; context applies deletes only.

## 5) Index Behavior (No Gap Fill)

- Set beyond length in a single tick (without deletes) is treated as append (index clamped to end), no explicit null padding.
- Confirm no explicit `null` placeholders introduced by the library.

## 6) Map CRUD (root and nested)

- Root map set/delete primitive keys → reflected across clients.
- Nested map inside array item: set/delete a nested key → reflected on both clients after microtask; no parent routing leaks.
- Invariant: parent array controller does not route nested ops; nested controller handles its own edits.

## 7) Converters at Boundaries Only

- Bootstrap: `plainObjectToYType` converts initial plain structure correctly.
- Push/Replace: converter used to produce a Y value once; inserted directly; no round-trip cloning.
- Undefined handling: `undefined` becomes `null` in Y; verify across clients.

## 8) Reconciliation and Locks

- observeDeep → nearest materialized ancestor reconcile: changes deep inside an unmaterialized subtree reconcile the ancestor and materialize needed proxies.
- Reconciliation lock prevents reflection: local reconciler changes to proxies do not trigger Valtio→Yjs writes.
- Invariant: exactly one transaction per microtask flush; order map deletes → map sets → array deletes → array sets.

## 9) Identity and Caches

- Same Y type returns the same Valtio proxy identity over time.
- Delete an item then push a new item: new Valtio proxy identity created for the new Y type at that position.
- dispose: all subscriptions cleared; no further updates delivered.

## 10) Regression Scenarios

- Reproduce historic crash path (delete after pushes) → no crash; remote integrates; no {} in final state.
- Large batch (e.g., 100 pushes then multiple deletes) → correctness holds; performance acceptable; no gaps.

## 11) Optional/Stretch

- Concurrent edits: push on A while delete on B in same tick → eventual consistency; final array equals Yjs CRDT resolution; no library-induced moves.
- Future types (Y.Text): outline expected controller behavior (not implemented) to keep policy consistent.

## Assertions Summary

- No implicit moves; sets ignored when deletes exist.
- No gaps/null padding introduced by library.
- Post-insert reconcile materializes proxies (no lasting {}).
- Converters used at boundaries only; no runtime deep clones.
- Transaction and reconciliation order deterministic.
- Remote equals local (after microtask) for all tests.
