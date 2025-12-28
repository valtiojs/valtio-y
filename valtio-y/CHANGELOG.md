# valtio-y

## 1.1.3

### Patch Changes

- ef84c31: Add compatibility for upcoming valtio version that makes `ops` in subscribe callbacks opt-in. This change calls `unstable_enableOp(true)` when available while maintaining backwards compatibility with older valtio versions.

  See: https://github.com/pmndrs/valtio/pull/1189

## 1.1.2

### Patch Changes

- a06ba03: Switch to ESM-only build, removing CommonJS support. Add proper entry points for bundlephobia compatibility and follow modern package.json export map guidelines. 👀

## 1.1.1

### Patch Changes

- bbcc527: Fix `trackedOrigins: undefined` handling in UndoManager. Previously, explicitly passing `trackedOrigins: undefined` was incorrectly replaced with the default Set. Now properly preserves `undefined` to track only changes without explicit origins, matching Yjs behavior.

## 1.1.0

### Minor Changes

- a24858c: Initial public release of valtio-y - collaborative state management for real-time applications. Two-way sync between Valtio proxies and Yjs CRDTs with zero API overhead. Write normal JavaScript, get real-time collaboration free. 👋
