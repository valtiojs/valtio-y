# Getting Started with valtio-y

A complete guide to setting up collaborative state management with valtio-y.

## Table of Contents

1. [Installation](#installation)
2. [Server Setup](#server-setup)
3. [Client Setup](#client-setup)
4. [Understanding Bootstrap](#understanding-bootstrap)
5. [Building Your First Component](#building-your-first-component)
6. [Next Steps](#next-steps)

---

## Installation

Install valtio-y and its peer dependencies:

```bash
npm install valtio-y valtio yjs
```

You'll also need a **provider** for network sync. We recommend:

```bash
npm install y-partyserver  # Recommended for production
```

**Other provider options:**
- `y-websocket` - Self-hosted WebSocket server
- `y-webrtc` - Peer-to-peer sync (no server)
- `y-indexeddb` - Local persistence only

---

## Server Setup

valtio-y requires a **Yjs provider server** to sync state between clients. The server handles CRDT synchronization—you don't need to understand the internals.

### Recommended: PartyKit (y-partyserver)

PartyKit provides serverless real-time infrastructure with automatic scaling and persistence. Deploy once, forget about it.

**Learn more:**
- [PartyKit Documentation](https://partykit.io)
- [y-partyserver Package](https://github.com/partykit/partykit/tree/main/packages/y-partyserver)

### Alternative: y-websocket Server

For self-hosted setups, `y-websocket` provides a Node.js WebSocket server. See the [y-websocket docs](https://github.com/yjs/y-websocket) for setup instructions.

### Development

For local development, use the provider's development mode or run a local server. Most providers support `ws://localhost:1234` for quick prototyping.

---

## Client Setup

### Step 1: Define Your State Type

Create explicit TypeScript types for your application state:

```typescript
// src/types.ts
export type Todo = {
  id: string;
  text: string;
  done: boolean;
};

export type AppState = {
  todos: Todo[];
  filter: "all" | "active" | "completed";
};
```

**Why explicit types?**
- Full TypeScript inference throughout your app
- Autocomplete for nested properties
- Type safety prevents bugs

### Step 2: Create the Store

Set up your Yjs document, provider, and valtio-y proxy:

```typescript
// src/store.ts
import * as Y from "yjs";
import { PartyKitProvider } from "y-partykit/provider";
import { createYjsProxy } from "valtio-y";
import type { AppState } from "./types";

// 1. Create Yjs document
export const ydoc = new Y.Doc();

// 2. Connect to your server
export const provider = new PartyKitProvider(
  "your-partykit-host.partykit.dev",
  "my-room",
  ydoc
);

// 3. Create synchronized proxy with explicit type
export const { proxy: state, bootstrap } = createYjsProxy<AppState>(ydoc, {
  getRoot: (doc) => doc.getMap("root"),
});

// 4. Initialize after first sync
provider.on("synced", () => {
  bootstrap({
    todos: [],
    filter: "all",
  });
});
```

**Key concepts:**
- **Room name** (`"my-room"`): All clients in the same room sync together
- **Root name** (`"root"`): All clients must use the same Yjs structure name
- **Explicit type** (`<AppState>`): Provides full type safety

### Step 3: Using Different Providers

**With y-websocket:**
```typescript
import { WebsocketProvider } from "y-websocket";

export const provider = new WebsocketProvider(
  "ws://localhost:1234",
  "my-room",
  ydoc
);
```

**With y-webrtc (P2P):**
```typescript
import { WebrtcProvider } from "y-webrtc";

export const provider = new WebrtcProvider("my-room", ydoc);
// No server needed - peers connect directly
```

**Local-only (no sync):**
```typescript
// Just use the proxy without a provider
const { proxy: state } = createYjsProxy<AppState>(ydoc, {
  getRoot: (doc) => doc.getMap("root"),
});

// Initialize directly (no bootstrap needed)
state.todos = [];
state.filter = "all";
```

---

## Understanding Initial Sync and Bootstrap

The critical challenge: **ensuring all clients start in sync**. valtio-y handles synchronization automatically after initial sync, but you must get that first sync right.

### The Problem: Initial Sync

```typescript
// ❌ WRONG: Race condition with server sync
const { proxy: state } = createYjsProxy<AppState>(ydoc, {
  getRoot: (doc) => doc.getMap("root"),
});

state.todos = []; // Might overwrite server data OR get overwritten!
```

**What goes wrong:**
- You set `state.todos = []` immediately
- Server has existing data and syncs it shortly after
- Result: Your initialization gets overwritten, OR you overwrite server data
- Clients end up out of sync from the start

### The Best Solution: Server-Side Initial State

**Recommended approach:** Set initial state on the server, clients auto-sync:

```typescript
// Server (if you have control)
const rootMap = ydoc.getMap("root");
if (rootMap.size === 0) {
  rootMap.set("todos", new Y.Array());
  rootMap.set("filter", "all");
}

// Client - just connect, no initialization needed!
const { proxy: state } = createYjsProxy<AppState>(ydoc, {
  getRoot: (doc) => doc.getMap("root"),
});
// State automatically syncs from server ✓
```

**Why this is best:**
- Single source of truth (the server)
- No race conditions
- All clients guaranteed to start with same state
- No client-side initialization logic needed

### When You Can't Control the Server: bootstrap()

When server-side initialization isn't possible, use `bootstrap()` to safely initialize from the client:

```typescript
// YOU wait for sync, then call bootstrap
provider.on("synced", () => {
  bootstrap({
    todos: [],
    filter: "all",
  });
});
```

**What bootstrap does:**
1. Checks if the root structure is empty
2. If empty → writes your initial data
3. If not empty → does nothing (preserves existing data)

**Important:** `bootstrap()` doesn't wait for you—YOU must wait for the "synced" event before calling it. This ensures you've received any existing server state first.

### When to Use What

**Server-side initialization (best):**
- ✅ You control the server
- ✅ Want guaranteed consistency
- ✅ Single source of truth

**Client-side with bootstrap():**
- ✅ Can't modify server (using third-party provider)
- ✅ Serverless setup (PartyKit, etc.)
- ✅ Need to initialize from client

**Direct assignment (rare):**
- ✅ Local-only app (no network sync)
- ✅ Testing/development
- ✅ You want to forcefully overwrite everything

### Bootstrap Examples

```typescript
// Wait for sync, then bootstrap
provider.on("synced", () => {
  bootstrap({
    todos: [],
    filter: "all",
  });
});

// With default data
provider.on("synced", () => {
  bootstrap({
    todos: [{ id: "1", text: "Welcome!", done: false }],
    filter: "all",
  });
});

// Manual check (equivalent to bootstrap)
provider.on("synced", () => {
  if (Object.keys(state).length === 0) {
    state.todos = [];
    state.filter = "all";
  }
});
```

### The Key Insight

valtio-y handles **all synchronization automatically** after the initial sync. The only thing you need to carefully consider is how clients get their initial state. Use server-side initialization when possible, or `bootstrap()` inside the "synced" event when not. After that, just mutate `state` naturally—valtio-y does the rest.

---

## Building Your First Component

Here's a complete React component demonstrating core patterns:

```typescript
// src/App.tsx
import { useSnapshot } from "valtio/react";
import { state } from "./store";

function App() {
  // Read from snapshot (reactive)
  const snap = useSnapshot(state);

  // Helper functions mutate the proxy
  const addTodo = () => {
    state.todos.push({
      id: crypto.randomUUID(),
      text: "New todo",
      done: false,
    });
  };

  const toggleTodo = (index: number) => {
    state.todos[index].done = !state.todos[index].done;
  };

  const deleteTodo = (index: number) => {
    state.todos.splice(index, 1);
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
              onChange={() => toggleTodo(i)}
            />
            <span>{todo.text}</span>
            <button onClick={() => deleteTodo(i)}>Delete</button>
          </li>
        ))}
      </ul>

      <p>{snap.todos.length} total todos</p>
    </div>
  );
}

export default App;
```

### Key Patterns

**1. Read from snapshot, write to proxy:**
```typescript
const snap = useSnapshot(state);  // Read (reactive)
state.todos.push({ ... });        // Write (mutate)
```

**2. Component re-renders only when accessed data changes:**
```typescript
const snap = useSnapshot(state);
const count = snap.todos.length;  // Only re-renders when length changes
```

**3. Mutations automatically sync:**
```typescript
state.todos[0].done = true;  // Syncs to all clients instantly
```

### Testing Multi-Client Sync

**Local testing:**
1. Start your development server: `npm run dev`
2. Open multiple browser tabs: `http://localhost:5173`
3. Make changes in one tab → see them appear in others
4. Try editing the same todo in both tabs → changes merge automatically

**Check the console** for sync events:
```typescript
provider.on("sync", (isSynced: boolean) => {
  console.log("Synced:", isSynced);
});

ydoc.on("update", () => {
  console.log("Document updated");
});
```

---

## Next Steps

Now that you have a working collaborative app, explore these resources:

### Learn Core Patterns
- **[Core Concepts](./concepts.md)** - Understand CRDTs and the valtio-y mental model
- **[Basic Operations](./basic-operations.md)** - Arrays, objects, nested structures
- **[Structuring Your App](./structuring-your-app.md)** - Organize state with getRoot

### Add Features
- **[Undo/Redo](./undo-redo.md)** - Time travel with Yjs UndoManager
- **Persistence** - Add `y-indexeddb` for offline storage
- **Authentication** - Use provider auth options

### Optimize
- **[Performance Guide](./performance-guide.md)** - Batching, bulk operations
- Fine-grained subscriptions for large lists
- Fractional indexing for concurrent reordering

### Explore Examples
- **[Simple Todos](../examples/05_todos_simple)** - Single-file annotated example
- **[Full Todo App](../examples/04_todos)** - Production patterns with drag-and-drop
- **[Minecraft Clone](../examples/03_minecraft)** - Real-time multiplayer 3D game

---

## Troubleshooting

**Changes not syncing?**
- Verify all clients use the same server URL and room name
- Check `getRoot` uses the same structure name (e.g., `"root"`)
- Ensure your server is running

**TypeScript errors?**
- Use explicit types: `createYjsProxy<AppState>(...)`
- Ensure bootstrap data matches your type definition

**Components not re-rendering?**
- Read from `snap` (not `state`) in render
- Mutate `state` (not `snap`) for changes

**bootstrap() seems ignored?**
- It's a no-op if data already exists (this is correct)
- Call it inside `provider.on("synced", ...)` callback
- Check if the document already has data from another client

---

**Questions?** Check the [troubleshooting guide](./troubleshooting.md) or [open an issue](https://github.com/valtiojs/valtio-y/issues).
