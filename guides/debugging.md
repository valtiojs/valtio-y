# Debugging Guide

A practical guide to debugging valtio-y applications.

## Quick Reference

```typescript
// Inspect current state
console.log(snapshot(state));

// Watch for changes
subscribe(state, () => {
  console.log("State changed:", snapshot(state));
});

// Monitor Yjs updates
doc.on("update", (update) => {
  console.log("Yjs update size:", update.length);
});

// Debug sync status
controller.on("synced", () => console.log("Synced"));
controller.on("status", ({ status }) => console.log("Status:", status));
```

## 1. Inspecting State

### View Current State

Use Valtio's `snapshot()` to get a plain object:

```typescript
import { snapshot } from "valtio";

// Get immutable snapshot
const current = snapshot(state);
console.log("Current state:", current);

// Deep inspection
console.log("User:", snapshot(state.user));
console.log("Items:", snapshot(state.items));
```

**Why snapshot?** Proxies don't display well in console. Snapshots show actual values.

### Compare Before/After

```typescript
subscribe(state, () => {
  const before = snapshot(state);

  // Make changes...

  const after = snapshot(state);
  console.log("Changed from:", before, "to:", after);
});
```

### Check Proxy vs Snapshot

```typescript
console.log("Is proxy?", isProxy(state)); // true
console.log("Is proxy?", isProxy(snapshot(state))); // false
```

## 2. Tracing Mutations

### Subscribe to All Changes

```typescript
import { subscribe } from "valtio";

const unsubscribe = subscribe(state, () => {
  console.log("State mutated:", snapshot(state));
});

// Later: unsubscribe();
```

### Track Specific Properties

```typescript
subscribe(
  state,
  () => {
    console.log("Count changed:", state.count);
  },
  [["count"]]
); // Only trigger when state.count changes
```

### Log Mutation Stack Traces

```typescript
subscribe(state, () => {
  console.trace("State changed at:");
  console.log("New value:", snapshot(state));
});
```

This shows **where** in your code the mutation happened.

## 3. Yjs Updates

### Monitor Document Changes

```typescript
// Basic update logging
doc.on("update", (update, origin, doc) => {
  console.log("Update:", {
    size: update.length,
    origin,
    stateVector: Y.encodeStateVector(doc).length,
  });
});
```

### Deep Observe Yjs Types

```typescript
// Observe specific Yjs types
const yMap = doc.getMap("state");

yMap.observe((event) => {
  console.log("YMap changed:", {
    changes: event.changes.keys,
    target: event.target,
  });

  event.changes.keys.forEach((change, key) => {
    console.log(`Key "${key}":`, change.action, change.oldValue);
  });
});
```

### Track Sync Status

```typescript
controller.on("status", ({ status }) => {
  console.log("Sync status:", status); // 'connecting' | 'connected' | 'disconnected'
});

controller.on("synced", () => {
  console.log("Fully synced with remote");
});
```

## 4. Network Traffic

### Monitor Provider Messages

For WebSocket providers:

```typescript
provider.on("status", ({ status }) => {
  console.log("Provider status:", status);
});

// Message logging (implementation-specific)
const originalSend = ws.send.bind(ws);
ws.send = (data) => {
  console.log("Sending:", data.length, "bytes");
  originalSend(data);
};
```

### Track Awareness Updates

```typescript
provider.awareness.on("change", ({ added, updated, removed }) => {
  console.log("Awareness changed:", {
    added: Array.from(added),
    updated: Array.from(updated),
    removed: Array.from(removed),
  });
});
```

### Measure Sync Performance

```typescript
let updateCount = 0;
let totalBytes = 0;

doc.on("update", (update) => {
  updateCount++;
  totalBytes += update.length;
  console.log(`Updates: ${updateCount}, Total: ${totalBytes} bytes`);
});
```

## 5. React DevTools

### Install Valtio DevTools

```typescript
import { devtools } from "valtio/utils";

// Enable in development
if (process.env.NODE_ENV === "development") {
  devtools(state, { name: "App State", enabled: true });
}
```

Now use **Redux DevTools** to:

- Time-travel through state changes
- See mutation history
- Export/import state snapshots

### Component Re-render Tracking

Use React DevTools Profiler:

1. Open React DevTools
2. Go to "Profiler" tab
3. Start recording
4. Trigger state changes
5. See which components re-rendered

**Tip**: Components using `useSnapshot(state)` only re-render when **accessed** properties change.

## 6. Common Debugging Patterns

### Why Isn't State Updating?

**Check 1**: Are you mutating the proxy directly?

```typescript
// Wrong - mutating snapshot
const snap = snapshot(state);
snap.count++; // No effect!

// Right - mutate proxy
state.count++;
```

**Check 2**: Is the controller bound?

```typescript
// Required for sync
bind(state, controller);
```

**Check 3**: Are you in a transaction?

```typescript
// Changes batch until transaction ends
doc.transact(() => {
  state.count++;
  state.name = "Alice";
}); // Now both changes apply
```

### Why Isn't Component Re-rendering?

**Check 1**: Using `useSnapshot()`?

```typescript
// Wrong - no reactivity
function Component() {
  const value = state.count; // Won't re-render
}

// Right - reactive
function Component() {
  const snap = useSnapshot(state);
  const value = snap.count; // Re-renders when count changes
}
```

**Check 2**: Accessing the property?

```typescript
// Only re-renders when accessed properties change
function Component() {
  const snap = useSnapshot(state);
  return <div>{snap.count}</div>; // Only re-renders when count changes
  // NOT when state.name changes
}
```

### Why Isn't Sync Working?

**Check 1**: Provider connected?

```typescript
console.log("Connected?", provider.ws?.readyState === WebSocket.OPEN);
```

**Check 2**: Same document?

```typescript
// All peers must use same room/doc name
const doc = new Y.Doc(); // Should share same doc
```

**Check 3**: Controller started?

```typescript
controller.start(); // Required to begin sync
```

### Conflict Detection

```typescript
doc.on("update", (update, origin) => {
  if (origin !== controller) {
    console.warn("Remote update detected:", update.length, "bytes");
    console.log("Current state:", snapshot(state));
  }
});
```

## 7. Development Tools

### Recommended Browser Extensions

- **React DevTools** - Component inspection
- **Redux DevTools** - Works with `devtools()` from valtio/utils
- **WebSocket Monitor** - Network traffic inspection

### Logging Utilities

**Structured logging**:

```typescript
function logState(label: string) {
  console.group(label);
  console.log("State:", snapshot(state));
  console.log("Doc state vector:", Y.encodeStateVector(doc));
  console.log("Controller status:", controller.status);
  console.groupEnd();
}

// Usage
logState("After user login");
```

**Performance monitoring**:

```typescript
const measureSync = () => {
  const start = performance.now();

  return () => {
    const duration = performance.now() - start;
    console.log(`Sync took ${duration.toFixed(2)}ms`);
  };
};

const done = measureSync();
// ... sync operations ...
done();
```

### Debug Mode

Create a debug wrapper:

```typescript
export function createDebugController(controller: Controller, name: string) {
  const log = (event: string, data?: any) => {
    console.log(`[${name}] ${event}`, data || "");
  };

  controller.on("status", ({ status }) => log("status", status));
  controller.on("synced", () => log("synced"));
  doc.on("update", (update) => log("update", `${update.length} bytes`));

  return controller;
}
```

## Testing & Debugging

When writing tests:

```typescript
import { describe, it, expect, beforeEach } from "vitest";

describe("State sync", () => {
  let state1, state2;

  beforeEach(() => {
    // Fresh state for each test
    state1 = proxy({ count: 0 });
    state2 = proxy({ count: 0 });
  });

  it("syncs changes", async () => {
    // Setup controllers...

    state1.count = 5;
    await waitForSync();

    // Debug failed tests
    if (state2.count !== 5) {
      console.log("State1:", snapshot(state1));
      console.log("State2:", snapshot(state2));
      console.log("Doc1 state:", Y.encodeStateVector(doc1));
      console.log("Doc2 state:", Y.encodeStateVector(doc2));
    }

    expect(state2.count).toBe(5);
  });
});
```

## Resources

- **Valtio Docs**: https://valtio.pmnd.rs/docs/introduction/getting-started
- **Yjs Docs**: https://docs.yjs.dev/
- **React DevTools**: https://react.dev/learn/react-developer-tools
- **Redux DevTools**: https://github.com/reduxjs/redux-devtools

## Summary

**Quick debugging checklist:**

1. Use `snapshot(state)` to inspect current values
2. Use `subscribe()` to trace mutations
3. Monitor Yjs with `doc.on('update', ...)`
4. Enable `devtools()` in development
5. Check provider connection status
6. Verify `useSnapshot()` in React components
7. Use `console.trace()` to find mutation sources

Most issues come from:

- Mutating snapshots instead of proxies
- Forgetting `useSnapshot()` in React
- Provider not connected
- Not calling `controller.start()`
