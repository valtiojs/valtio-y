# Offline Sync with valtio-y

Offline-first applications work seamlessly with valtio-y because Yjs CRDTs are designed for it. Changes made offline automatically merge when reconnected—no special code required.

## How It Works

### Yjs is Offline-First by Design

When you make changes offline:

1. **Changes queue locally** - Yjs stores them in memory/disk
2. **CRDT guarantees** - Each change has a logical timestamp (no wall clock)
3. **Causality tracking** - Updates know what they depend on
4. **Commutative merging** - Updates can be applied in any order
5. **Auto-reconnect** - Providers sync automatically when back online

**The key insight:** Yjs doesn't need a server to resolve conflicts. It uses deterministic CRDT algorithms to guarantee all clients converge to the same state.

### Connection States

```typescript
import { WebsocketProvider } from "y-websocket";

const ydoc = new Y.Doc();
const provider = new WebsocketProvider("wss://your-server.com", "room", ydoc);

// Connection events
provider.on("status", ({ status }) => {
  console.log(status); // "connected" | "disconnected"
});

provider.on("sync", (isSynced: boolean) => {
  console.log("Initial sync complete:", isSynced);
});
```

---

## Connection Status in React

Track online/offline state to show UI indicators:

```tsx
import { useState, useEffect } from "react";
import { WebsocketProvider } from "y-websocket";

function useConnectionStatus(provider: WebsocketProvider) {
  const [status, setStatus] = useState<"connected" | "disconnected">(
    "disconnected"
  );

  useEffect(() => {
    const handleStatus = ({ status }: { status: string }) => {
      setStatus(status as "connected" | "disconnected");
    };

    provider.on("status", handleStatus);

    return () => {
      provider.off("status", handleStatus);
    };
  }, [provider]);

  return status;
}

// Usage in component
function App() {
  const status = useConnectionStatus(provider);

  return (
    <div>
      <StatusBadge status={status} />
      {/* Your app UI */}
    </div>
  );
}

function StatusBadge({ status }: { status: "connected" | "disconnected" }) {
  if (status === "connected") {
    return <span className="badge green">🟢 Online</span>;
  }
  return <span className="badge orange">🔴 Offline</span>;
}
```

---

## Offline Persistence with y-indexeddb

Use `y-indexeddb` to persist state locally. Changes survive page refreshes and sync when online.

### Installation

```bash
npm install y-indexeddb
```

### Setup

```typescript
import * as Y from "yjs";
import { WebsocketProvider } from "y-websocket";
import { IndexeddbPersistence } from "y-indexeddb";
import { createYjsProxy } from "valtio-y";

const ydoc = new Y.Doc();

// Local persistence (works offline)
const indexeddbProvider = new IndexeddbPersistence("my-app-room", ydoc);

// Network sync (when online)
const wsProvider = new WebsocketProvider(
  "wss://your-server.com",
  "my-app-room",
  ydoc
);

const { proxy: state, bootstrap } = createYjsProxy(ydoc, {
  getRoot: (doc) => doc.getMap("state"),
});

// Wait for local data to load, then sync
indexeddbProvider.whenSynced.then(() => {
  console.log("Local data loaded from IndexedDB");

  // Initialize if empty
  bootstrap({
    todos: [],
    settings: { theme: "light" },
  });
});
```

### How It Works

1. **On first load:** IndexedDB is empty, so your bootstrap data is used
2. **User makes changes:** Both IndexedDB and network providers receive updates
3. **User goes offline:** Changes only go to IndexedDB
4. **User closes app:** IndexedDB persists the state
5. **User reopens app offline:** IndexedDB loads the local state
6. **User goes online:** WebSocket provider syncs local changes to server

**Important:** Use the same room name for both providers so they sync to the same document.

---

## Conflict Resolution

Yjs handles conflicts automatically using CRDTs. You don't write conflict resolution code.

### Example: Concurrent Array Edits

**Scenario:** Both clients offline, editing the same array

**Client 1 (offline):**

```typescript
state.todos.push({ text: "Buy milk", done: false });
state.todos.push({ text: "Walk dog", done: false });
```

**Client 2 (offline):**

```typescript
state.todos.push({ text: "Read book", done: false });
state.todos[0].done = true; // Marks existing todo as done
```

**When they reconnect:**

- Both inserts succeed (arrays merge by position + logical timestamps)
- The property update applies to the correct item
- **Final state on both clients:** All three new todos appear, first todo marked done

**The magic:** Yjs tracks causality and uses deterministic tie-breaking (client ID) to ensure both clients converge to the same order.

### Example: Concurrent Property Updates

**Scenario:** Both clients edit the same property

**Client 1 (offline):**

```typescript
state.user.name = "Alice";
```

**Client 2 (offline):**

```typescript
state.user.name = "Bob";
```

**When they reconnect:**

- Yjs compares logical timestamps
- Last writer wins (by timestamp, ties broken by client ID)
- **Final state:** Either "Alice" or "Bob" consistently across all clients

**Note:** For cases where you need custom conflict resolution, consider using nested objects with version fields or last-modified timestamps. See [Validation & Errors](./validation-errors.md).

---

## UI Patterns

### 1. Sync Status Indicator

Show connection state in your header:

```tsx
function SyncIndicator({ provider }: { provider: WebsocketProvider }) {
  const status = useConnectionStatus(provider);
  const [pendingChanges, setPendingChanges] = useState(false);

  useEffect(() => {
    const handleUpdate = () => {
      if (status === "disconnected") {
        setPendingChanges(true);
      }
    };

    const handleSync = () => {
      setPendingChanges(false);
    };

    provider.doc.on("update", handleUpdate);
    provider.on("sync", handleSync);

    return () => {
      provider.doc.off("update", handleUpdate);
      provider.off("sync", handleSync);
    };
  }, [provider, status]);

  if (status === "connected" && !pendingChanges) {
    return <span className="text-green-600">✓ Synced</span>;
  }

  if (status === "disconnected" && pendingChanges) {
    return <span className="text-orange-600">⟳ Pending sync...</span>;
  }

  if (status === "disconnected") {
    return <span className="text-gray-600">○ Offline</span>;
  }

  return <span className="text-blue-600">⟳ Syncing...</span>;
}
```

### 2. Optimistic UI

Changes apply instantly locally—no spinners needed:

```tsx
function TodoItem({ todo }: { todo: TodoType }) {
  const snap = useSnapshot(todo);

  const handleToggle = () => {
    // This applies instantly (optimistic)
    todo.done = !todo.done;

    // If offline, it queues for later sync
    // If online, it syncs in milliseconds
    // Either way, UI updates immediately!
  };

  return (
    <div>
      <input type="checkbox" checked={snap.done} onChange={handleToggle} />
      <span>{snap.text}</span>
    </div>
  );
}
```

**No loading states needed** because changes are always local-first.

### 3. "Saved Locally" Message

Show feedback when offline:

```tsx
function SavedIndicator({ status }: { status: "connected" | "disconnected" }) {
  const [showSaved, setShowSaved] = useState(false);

  useEffect(() => {
    if (status === "disconnected") {
      setShowSaved(true);
      const timer = setTimeout(() => setShowSaved(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [status]);

  if (!showSaved) return null;

  return (
    <div className="toast">
      <span>💾 Saved locally. Will sync when online.</span>
    </div>
  );
}
```

### 4. Pending Changes Badge

Show how many changes are queued:

```tsx
function PendingChangesBadge({ provider }: { provider: WebsocketProvider }) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    const handleUpdate = () => {
      // Count unsent updates (rough approximation)
      const state = provider.doc.store.pendingStructs;
      setCount(state ? state.clients.size : 0);
    };

    provider.doc.on("update", handleUpdate);

    return () => {
      provider.doc.off("update", handleUpdate);
    };
  }, [provider]);

  if (count === 0) return null;

  return (
    <span className="badge">
      {count} change{count > 1 ? "s" : ""} pending
    </span>
  );
}
```

---

## Testing Offline Mode

### In Development

#### Method 1: Browser DevTools

1. Open DevTools (F12)
2. Go to **Network** tab
3. Check **Offline** checkbox
4. Make changes in your app
5. Uncheck **Offline** to reconnect

#### Method 2: Simulate Network Disconnect

```typescript
// Disconnect manually
provider.disconnect();

// Make some changes...
state.todos.push({ text: "Added while offline", done: false });

// Reconnect
provider.connect();
```

#### Method 3: Test Two Clients Offline

See [Simple Todos example](../examples/05_todos_simple/) for a complete implementation:

```typescript
// Track online status per client
let client1Online = true;
let client2Online = true;

// Queue updates when offline
const client1Queue: Uint8Array[] = [];
const client2Queue: Uint8Array[] = [];

doc1.on("update", (update) => {
  if (client1Online) {
    // Send immediately
    doc2.transact(() => Y.applyUpdate(doc2, update));
  } else {
    // Queue for later
    client1Queue.push(update);
  }
});

// Flush queue when back online
function goOnline() {
  client1Online = true;
  client1Queue.forEach((update) => {
    doc2.transact(() => Y.applyUpdate(doc2, update));
  });
  client1Queue.length = 0;
}
```

### Production Monitoring

Track sync health in production:

```typescript
provider.on("connection-error", (error: Error) => {
  console.error("Connection failed:", error);
  // Send to your error tracking service
});

provider.on("connection-close", (event: CloseEvent) => {
  console.warn("Connection closed:", event.code, event.reason);
  // Log reconnection attempts
});

provider.on("sync", (isSynced: boolean) => {
  console.log("Sync state changed:", isSynced);
  // Track time to sync in analytics
});
```

---

## Common Patterns

### Pattern 1: Background Sync

Let users close the tab—sync continues next session:

```typescript
import { IndexeddbPersistence } from "y-indexeddb";

// Enable persistence
const persistence = new IndexeddbPersistence("my-app", ydoc);

// Now changes survive browser restarts
// They'll sync next time the user is online
```

### Pattern 2: Retry Logic

Providers handle reconnection automatically, but you can customize:

```typescript
const provider = new WebsocketProvider("wss://server.com", "room", ydoc, {
  connect: true,
  // WebSocket will auto-reconnect with exponential backoff
});

// Force reconnect if needed
if (provider.wsconnected === false) {
  provider.connect();
}
```

### Pattern 3: Manual Sync Trigger

Give users a "sync now" button:

```tsx
function SyncButton({ provider }: { provider: WebsocketProvider }) {
  const [syncing, setSyncing] = useState(false);

  const handleSync = () => {
    setSyncing(true);

    // Reconnect if disconnected
    if (!provider.wsconnected) {
      provider.connect();
    }

    // Wait for sync
    provider.once("sync", () => {
      setSyncing(false);
    });
  };

  return (
    <button onClick={handleSync} disabled={syncing}>
      {syncing ? "Syncing..." : "Sync Now"}
    </button>
  );
}
```

---

## Best Practices

### Do

- ✅ **Use IndexedDB persistence** for true offline-first apps
- ✅ **Show connection status** so users know what's happening
- ✅ **Trust optimistic UI** - changes apply instantly, sync happens behind the scenes
- ✅ **Test offline scenarios** during development
- ✅ **Handle connection errors gracefully** with user-friendly messages

### Don't

- ❌ **Don't show loading spinners** for mutations—they're always instant locally
- ❌ **Don't block UI** waiting for sync—let users keep working
- ❌ **Don't write custom conflict resolution** unless absolutely necessary (Yjs handles it)
- ❌ **Don't assume order** for concurrent edits—use timestamps if order matters
- ❌ **Don't panic** when offline—Yjs queues everything safely

---

## Learn More

- **[Getting Started](./getting-started.md)** - Basic valtio-y setup
- **[Core Concepts](./concepts.md)** - How CRDTs work
- **[Troubleshooting](./troubleshooting.md)** - Common sync issues
- **[y-indexeddb docs](https://github.com/yjs/y-indexeddb)** - Official IndexedDB provider docs

---

**Want to see it in action?** Check out the [Simple Todos example](../examples/05_todos_simple/) which demonstrates offline/online toggling with two clients syncing independently.
