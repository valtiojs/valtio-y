# Getting Started with valtio-y

A complete guide to building your first collaborative application with valtio-y, from installation to deployment.

## Table of Contents

1. [Installation](#installation)
2. [Server Setup](#server-setup)
3. [Client Setup](#client-setup)
4. [Understanding Bootstrap](#understanding-bootstrap)
5. [Building Your First Component](#building-your-first-component)
6. [Testing Multi-Client Sync](#testing-multi-client-sync)
7. [Next Steps](#next-steps)

---

## Installation

Install valtio-y and its peer dependencies:

```bash
npm install valtio-y valtio yjs y-websocket
```

**What each package does:**
- `valtio-y` - Two-way sync between Valtio and Yjs
- `valtio` - Reactive state management
- `yjs` - CRDT library for collaboration
- `y-websocket` - WebSocket provider for network sync

---

## Server Setup

You need a WebSocket server to sync state between clients. We'll use `y-websocket`'s built-in server.

### Option 1: Quick Server (Development)

Create `server.js`:

```javascript
import { WebSocketServer } from "ws";
import * as Y from "yjs";
import { setupWSConnection } from "y-websocket/bin/utils";

const wss = new WebSocketServer({ port: 1234 });

wss.on("connection", (conn, req) => {
  setupWSConnection(conn, req);
});

console.log("WebSocket server running on ws://localhost:1234");
```

Run it:

```bash
node server.js
```

### Option 2: Production Server

For production, use a managed service:

**[PartyKit](https://partykit.io)** (Recommended):
```typescript
import * as Y from "yjs";
import { onConnect } from "y-partykit";

export default {
  onConnect(ws, room) {
    return onConnect(ws, room, { persist: true });
  },
};
```

Deploy: `npx partykit deploy`

**Other options:**
- [Hocuspocus](https://tiptap.dev/hocuspocus) - Full-featured collaboration backend
- [y-websocket server](https://github.com/yjs/y-websocket) - Self-hosted
- [y-webrtc](https://github.com/yjs/y-webrtc) - Peer-to-peer (no server)

---

## Client Setup

### Step 1: Define Your State Type

Create `src/types.ts`:

```typescript
export type AppState = {
  todos: Array<{
    id: string;
    text: string;
    done: boolean;
  }>;
  filter: "all" | "active" | "completed";
};
```

### Step 2: Create the Store

Create `src/store.ts`:

```typescript
import * as Y from "yjs";
import { WebsocketProvider } from "y-websocket";
import { createYjsProxy } from "valtio-y";
import type { AppState } from "./types";

// 1. Create Yjs document
export const ydoc = new Y.Doc();

// 2. Connect to server
export const provider = new WebsocketProvider(
  "ws://localhost:1234", // Your server URL
  "my-room-name",        // Room name (all clients in same room sync together)
  ydoc
);

// 3. Create synchronized proxy
export const { proxy: state, bootstrap } = createYjsProxy<AppState>(ydoc, {
  getRoot: (doc) => doc.getMap("root"),
});

// 4. Initialize state after first sync
provider.on("synced", () => {
  bootstrap({
    todos: [],
    filter: "all",
  });
});

// 5. Handle connection states (optional but recommended)
provider.on("status", ({ status }) => {
  console.log("Connection status:", status); // "connected" | "disconnected"
});
```

**Key points:**
- **Room name**: All clients using the same room name sync together
- **getRoot name**: All clients must use the same Yjs structure name (`"root"`)
- **bootstrap**: Only writes if the document is empty (see next section)

### Step 3: Use in React

Create `src/App.tsx`:

```typescript
import { useSnapshot } from "valtio/react";
import { state } from "./store";

function App() {
  const snap = useSnapshot(state);

  const addTodo = () => {
    state.todos.push({
      id: crypto.randomUUID(),
      text: "New todo",
      done: false,
    });
  };

  return (
    <div>
      <h1>Collaborative Todos</h1>
      <button onClick={addTodo}>Add Todo</button>

      <ul>
        {snap.todos.map((todo, i) => (
          <li key={todo.id}>
            <input
              type="checkbox"
              checked={todo.done}
              onChange={() => (state.todos[i].done = !todo.done)}
            />
            <input
              value={todo.text}
              onChange={(e) => (state.todos[i].text = e.target.value)}
            />
          </li>
        ))}
      </ul>
    </div>
  );
}

export default App;
```

**Important patterns:**
- **Read from snapshot** (`snap.todos`) - Triggers re-renders when data changes
- **Write to proxy** (`state.todos[i].done = ...`) - Mutates and syncs automatically

---

## Understanding Bootstrap

The `bootstrap()` function safely initializes state when using network providers.

### Why Bootstrap Exists

```typescript
// ❌ WRONG: Direct assignment with network sync
const { proxy: state } = createYjsProxy(ydoc, {
  getRoot: (doc) => doc.getMap("root"),
});

state.todos = []; // Overwrites remote data!
```

**Problem**: If the server already has data, you just deleted it.

### The Right Way

```typescript
// ✅ CORRECT: Wait for sync, then conditionally initialize
provider.on("synced", () => {
  bootstrap({ todos: [], filter: "all" });
  // Only writes if document is empty
});
```

**How bootstrap works:**
1. Checks if the root Yjs structure is empty
2. If empty → writes your initial data
3. If not empty → does nothing (preserves server data)

### When to Use Bootstrap vs Direct Assignment

**Use `bootstrap()` when:**
- ✅ Using network providers (WebSocket, WebRTC, PartyKit)
- ✅ Syncing with a server
- ✅ Multiple clients connecting to same room

**Use direct assignment when:**
- ✅ Local-only app (no network sync)
- ✅ After checking if data exists:
  ```typescript
  if (!state.todos) {
    state.todos = [];
  }
  ```

### Bootstrap Options

```typescript
// Basic usage
bootstrap({ todos: [] });

// With nested structures
bootstrap({
  todos: [{ id: "1", text: "Welcome!", done: false }],
  settings: { theme: "dark" },
  users: [],
});

// Check before manual init
if (Object.keys(snap).length === 0) {
  state.todos = [];
}
```

---

## Building Your First Component

Let's build a complete todo app with proper patterns.

### Todo Item Component

```typescript
import { useSnapshot } from "valtio/react";
import { state } from "./store";

function TodoItem({ index }: { index: number }) {
  const snap = useSnapshot(state);
  const todo = snap.todos[index];

  return (
    <li>
      <input
        type="checkbox"
        checked={todo.done}
        onChange={() => {
          state.todos[index].done = !todo.done;
        }}
      />
      <input
        value={todo.text}
        onChange={(e) => {
          state.todos[index].text = e.target.value;
        }}
      />
      <button
        onClick={() => {
          state.todos.splice(index, 1);
        }}
      >
        Delete
      </button>
    </li>
  );
}
```

**Benefits:**
- Each todo is independently subscribed
- Changing one todo doesn't re-render others
- Fine-grained reactivity = better performance

### Connection Status Indicator

```typescript
import { useState, useEffect } from "react";
import { provider } from "./store";

function ConnectionStatus() {
  const [status, setStatus] = useState<string>("connecting");

  useEffect(() => {
    const handler = ({ status }: { status: string }) => {
      setStatus(status);
    };

    provider.on("status", handler);
    return () => provider.off("status", handler);
  }, []);

  return (
    <div style={{ color: status === "connected" ? "green" : "red" }}>
      {status === "connected" ? "🟢 Online" : "🔴 Offline"}
    </div>
  );
}
```

---

## Testing Multi-Client Sync

### Local Testing

1. **Start your server** (if using y-websocket):
   ```bash
   node server.js
   ```

2. **Start your client** (Vite/Create React App):
   ```bash
   npm run dev
   ```

3. **Open multiple tabs**: Navigate to `http://localhost:5173` in 2+ browser tabs

4. **Test sync**:
   - Add a todo in Tab 1 → See it appear in Tab 2
   - Edit in both tabs → Changes merge automatically
   - Close Tab 1, edit Tab 2 → Reopen Tab 1, see updates

### Testing Offline Behavior

```typescript
// Simulate going offline
provider.disconnect();

// Make changes while offline
state.todos.push({ id: "x", text: "Offline todo", done: false });

// Reconnect
provider.connect();
// Changes sync automatically when reconnected
```

### Debugging Sync Issues

Add logging to your store:

```typescript
ydoc.on("update", (update, origin) => {
  console.log("Document updated:", { updateSize: update.length, origin });
});

provider.on("sync", (isSynced) => {
  console.log("Sync status:", isSynced);
});
```

---

## Next Steps

Now that you have a working collaborative app:

### Learn Core Patterns
- **[Basic Operations](./basic-operations.md)** - Arrays, objects, nested structures
- **[Core Concepts](./concepts.md)** - Understanding CRDTs and the mental model
- **[Structuring Your App](./structuring-your-app.md)** - Organize state with getRoot

### Add Features
- **[Undo/Redo](./undo-redo.md)** - Time travel with Yjs UndoManager
- **Persistence**: Add `y-indexeddb` for offline storage
- **Authentication**: Use provider auth options

### Optimize
- **[Performance Guide](./performance-guide.md)** - Batching, bulk operations
- Fine-grained subscriptions for large lists
- Fractional indexing for concurrent reordering

### Explore Examples
- **[Simple Todos](../examples/05_todos_simple)** - Single-file annotated example
- **[Full Todo App](../examples/04_todos)** - Production patterns with drag-and-drop
- **[Minecraft Clone](../examples/03_minecraft)** - Real-time multiplayer 3D game

---

## Common Issues

**Changes not syncing?**
- Check all clients use same server URL and room name
- Verify `getRoot` uses same Yjs structure name (`"root"`)
- Check server is running

**TypeScript errors?**
- Ensure state type matches your bootstrap data
- Use explicit types: `createYjsProxy<AppState>(...)`

**Components not re-rendering?**
- Read from `snap` (not `state`) in components
- Mutate `state` (not `snap`) for changes

**bootstrap() not working?**
- Call it inside `provider.on("synced", ...)` callback
- Check if document already has data (bootstrap is a no-op)

---

**Questions or stuck?** Check the [troubleshooting guide](./troubleshooting.md) or [open an issue](https://github.com/valtiojs/valtio-y/issues).
