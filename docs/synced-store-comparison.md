# SyncedStore Comparison

## High-Level Architectural Similarities

- Both adopt the Live Controller Proxy philosophy: proxies directly control Yjs types; no snapshot layer.
- Both offer idiomatic mutations (e.g., `proxy.foo = 'bar'`, `array.push(x)`) that translate to Yjs ops.
- Both avoid update bounce by eliminating snapshot diffing and reflecting operations directly.

## Key Technical Differences: Reactivity Layer

- SyncedStore:

  - Property-level reactivity via atoms; pluggable adapters (MobX/Vue).
  - Achieved by patching Yjs prototypes and using `Y.Event` from `.observe()`/`.observeDeep()` to trigger specific atoms (e.g., `keysChanged`).

- valtio-yjs:
  - Object-level reactivity native to Valtio; one proxy per Y container.
  - Achieved by a controller-proxy tree and targeted structural reconciliation of Valtio proxies triggered by `yRoot.observeDeep` events.
  - Walks to the nearest materialized ancestor boundary and reconciles it; optionally uses array deltas for efficient splices.
  

## Conclusion

- valtio-yjs is an idiomatic adaptation of the same solid architectural principles, tailored to Valtio's proxy-based model. Where SyncedStore targets property-level atoms with `Y.Event`, valtio-yjs targets object-level proxies with deep events for precise, minimal updates.
