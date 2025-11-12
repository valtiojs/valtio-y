---
"valtio-y": patch
---

Fix `trackedOrigins: undefined` handling in UndoManager. Previously, explicitly passing `trackedOrigins: undefined` was incorrectly replaced with the default Set. Now properly preserves `undefined` to track only changes without explicit origins, matching Yjs behavior.
