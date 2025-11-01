# Data Flow

## 1) Local Change (UI -> Yjs -> Network)

Scenario: `userProxy.profile.email = '...'` in the UI.

1. Accessing `profile` returns the `profile` controller proxy (a Valtio proxy for a `Y.Map`). This proxy is the object you use; it performs the controller behavior under the hood.
2. The Valtio subscription on the object proxy receives a top-level `set` operation for `email`.
3. The operation is enqueued into the context's write scheduler.
4. On the next microtask, the scheduler flushes all pending operations in a single `doc.transact(..., VALTIO_YJS_ORIGIN)`.
5. Inside the transaction, `yProfileMap.set('email', '...')` is called (or convert complex values using converter utilities if needed).
6. The transaction ends.
7. `yRoot.observeDeep` callback fires, but the handler ignores it because `transaction.origin === VALTIO_YJS_ORIGIN`.
8. `doc.on('update')` may fire via the provider and propagate to peers.

Note: When assigning a plain object/array into a controller proxy, the system eagerly upgrades it to a Y type and replaces the plain value with a live controller proxy under a reconciliation lock. This keeps nested edits encapsulated within the child controller proxy and avoids parent-level routing.

## 2) Remote Change (Network -> Yjs -> UI)

Scenario: A peer inserts a new item into a shared list (a `Y.Array`).

1. The provider applies the update: `Y.applyUpdate(doc, update)`.
2. `yRoot.observeDeep` callback fires with events and a transaction object.
3. The synchronizer checks `transaction.origin !== VALTIO_YJS_ORIGIN` (to ignore our own changes) and processes the events.
4. For each event, it walks up to find the nearest materialized ancestor (boundary).
5. Two-phase reconciliation:
   - Phase 1: Reconcile boundaries to ensure structure and materialize controller proxies for new Y types.
   - Phase 2: Apply granular array deltas (if available) for efficient updates.
6. For arrays, the reconciler either applies the delta or performs a full structural reconcile (building new content with controller proxies).
7. The Valtio proxy is updated under a reconciliation lock (to prevent reflection back to Yjs).
8. Valtio detects the changes; components using `useSnapshot` of that proxy re-render.

 
