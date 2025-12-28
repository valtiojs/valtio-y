---
"valtio-y": patch
---

Add compatibility for upcoming valtio version that makes `ops` in subscribe callbacks opt-in. This change calls `unstable_enableOp(true)` when available while maintaining backwards compatibility with older valtio versions.

See: https://github.com/pmndrs/valtio/pull/1189
