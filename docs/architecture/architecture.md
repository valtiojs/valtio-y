# Architecture

valtio-y creates a synchronization bridge between your Valtio state and a Yjs document. The bridge is implemented by a tree of controller proxies that operate on Yjs types and keep your Valtio proxies in sync.

## Core Philosophy: The "Live Controller" Model

- The Valtio proxy is not a snapshot. It is a live, stateful controller for a Yjs shared type.
- The proxy tree mirrors the Yjs structure and issues Yjs commands directly on mutation.
- This removes the impedance mismatch between Yjs's operational model and snapshot-based reactivity.

## Terminology

- Proxy (the what): The object you use in app code (returned by `createYjsProxy`).
- Controller proxy (the how): The Valtio proxy that directly controls a Yjs shared type by translating local edits to Y ops and reflecting remote updates. There is no separate Controller class; “controller proxy” refers to this proxy and is sometimes shortened to “controller” in this doc.
- Bridge (the why): The overall system that connects Valtio and Yjs so they stay synchronized.

## System Layers

```text
Public API (bridge)  Controller Proxy Layer (how)   Synchronization Layer        Type Conversion
(createYjsProxy)  -> (valtio-bridge.ts)         ->  (synchronizer.ts)        ->  (converter utils)
                      |                             |
                      v                             v
                 Valtio proxies  <--------------  Yjs observeDeep(yRoot)
                              ^
                              |
                     Context Write Scheduler (one transaction per microtask)
```

- Public API Layer (the bridge entrypoint): `createYjsProxy(doc, { getRoot })` creates the root controller proxy (the Valtio proxy for the chosen Y root), instantiates a coordinator to orchestrate all components, sets up sync, and returns `{ proxy, dispose, bootstrap }`.
- Controller Layer: A tree of Valtio proxies mirrors `Y.Map`/`Y.Array`. Local mutations enqueue direct-child ops into the coordinator's Write Scheduler; the scheduler flushes them in one `doc.transact(…, VALTIO_Y_ORIGIN)` per microtask.
- Synchronization Layer: A root-scoped deep observer (`yRoot.observeDeep`) handles inbound updates. It ignores library-origin transactions and reconciles the nearest materialized ancestor for each event.
- Type Conversion Layer: Pure utilities convert plain JS data to Yjs types and vice versa.

## Key Components and Their Roles

- `ValtioYjsCoordinator` (`valtio-y/src/core/coordinator.ts`):
  - Orchestrates all valtio-y components using dependency injection, eliminating circular dependencies.
  - Owns and wires together: `SynchronizationState` (pure data holder), `Logger` (infrastructure), `WriteScheduler` (batching/scheduling), and apply functions (business logic).
  - All dependencies flow in one direction - no cycles possible.
  - Provides a clean public API that delegates to internal components.

- `SynchronizationState` (`valtio-y/src/core/synchronization-state.ts`):
  - Pure data holder with no dependencies, encapsulates all per-instance state.
  - Manages caches (`yTypeToValtioProxy`, `valtioProxyToYType`), subscription disposers, and a reconciliation lock (`isReconciling`).
  - Prevents global state leakage; supports multiple independent instances.

- `WriteScheduler` (within coordinator):
  - Coalesces direct-child ops from all controller proxies, flushes once per microtask.
  - Applies deterministic map/array writes in a single transaction, then performs eager upgrades under the lock.

- `getOrCreateValtioProxy` (router) (`valtio-y/src/bridge/valtio-bridge.ts`):
  - Accepts supported Yjs shared types and returns the appropriate Valtio proxy that acts as its controller. Creates the proxy if it doesn't exist in the coordinator's state cache.
  - Main internal factory for creating the bridge's controller proxies.

- Valtio Proxies (created by `valtio-bridge.ts`):
  - Materialize Valtio proxies for `Y.Map`/`Y.Array` and maintain identity via coordinator's state caches.
  - Responsibilities:
    1) Intercept local edits and enqueue only direct-child ops into the coordinator's Write Scheduler (no deep routing).
    2) Lazily materialize nested controller proxies via `getOrCreateValtioProxy` when accessing properties that are Yjs shared types.
    3) Eagerly upgrade assigned plain objects/arrays: on write, convert to Y types and, after the scheduler's transaction, replace the plain value with a live controller proxy under the reconciliation lock.

- Synchronizer (`setupSyncListener`) (`valtio-y/src/synchronizer.ts`):
  - Listens via `yRoot.observeDeep`.
  - Skips transactions with our origin to avoid feedback loops.
  - Two-phase reconciliation on inbound changes:
    1) Walk `.parent` to find the nearest materialized ancestor (boundary) and reconcile it to ensure structure and controller materialization.
    2) Apply granular array deltas to direct array targets after parents are materialized. Arrays with recorded deltas are skipped in phase 1 to avoid double-application.

- Reconciler (`reconcileValtioMap`, `reconcileValtioArray`) (`valtio-y/src/reconcile/reconciler.ts`):
  - Ensures the Valtio proxy structure matches the Yjs structure, creating missing keys/items and controller proxies for nested Y types, deleting extras, and updating primitive values.
  - Works with the coordinator to access state caches and logging.
  - Solves lazy materialization for remote changes: newly created Y objects become visible in Valtio proxies on demand.

## Public API Overview

- `createYjsProxy(doc, { getRoot })`:
  - Returns `{ proxy, dispose, bootstrap }`.
  - `bootstrap(data)` initializes an empty Y document from plain data using converter utilities, then locally reconciles to materialize proxies.
  - Why separate `bootstrap`: supports asynchronous data loading and explicit control over when initial content is written to the Y document (e.g., wait for remote data or user input before initializing).
  - `dispose()` removes listeners and disposes subscriptions held in the coordinator's `SynchronizationState`.
