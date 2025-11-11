# Getting Started with valtio-y

This guide covers the essential setup decisions you need to make when building collaborative apps with valtio-y. After completing the [Quick Start](../README.md#quick-start), use this guide to understand your architecture options and choose the right approach for your application.

---

## Table of Contents

1. [Collaboration Setup](#collaboration-setup)
2. [Initializing State](#initializing-state)
3. [Choosing Your Architecture](#choosing-your-architecture)
4. [React Integration](#react-integration)
5. [Next Steps](#next-steps)

---

## Collaboration Setup

To sync state across clients, you need **a server that coordinates the Yjs CRDT updates**. This is different from a traditional REST API—the server acts as a relay for CRDT operations, ensuring all clients converge to the same state.

### Server Options

**PartyServer** (recommended) and **Cloudflare Durable Objects** are excellent choices because they:

- Provide built-in Yjs support
- Scale automatically
- Simplify deployment (no separate WebSocket server)
- Handle connection management for you

**All our examples use [y-partyserver](https://github.com/partykit/partykit/tree/main/packages/y-partyserver)** because it's easy to set up and simple to use:

```typescript
// Client-side with y-partyserver
import YProvider from "y-partyserver/provider";

const provider = new YProvider(
  window.location.host, // PartyKit host
  "my-room", // Room name
  ydoc // Your Y.Doc instance
);
```

### Other Providers

valtio-y works with **any Yjs provider**:

- **[y-websocket](https://github.com/yjs/y-websocket)** - Standard WebSocket provider (requires separate server)
- **[y-webrtc](https://github.com/yjs/y-webrtc)** - Peer-to-peer sync without a server
- **[y-indexeddb](https://github.com/yjs/y-indexeddb)** - Local persistence only (offline-first)

The key is that valtio-y doesn't care about the network layer—it just syncs the Yjs document. Choose the provider that fits your infrastructure.

### Example Setup

```typescript
import * as Y from "yjs";
import { createYjsProxy } from "valtio-y";
import YProvider from "y-partyserver/provider";

// Create Yjs document
const ydoc = new Y.Doc();

// Connect to server
const provider = new YProvider(window.location.host, "room-name", ydoc);

// Create Valtio proxy
const { proxy: state } = createYjsProxy(ydoc, {
  getRoot: (doc) => doc.getMap("root"),
});

// State automatically syncs across all connected clients
```

---

## Initializing State

**Best practice: Initialize state on the server side.** This ensures consistent initial state across all clients and avoids race conditions.

### Server-Side Initialization (Recommended)

The server creates and populates the Y.Doc before clients connect:

```typescript
// Server (PartyKit example)
import * as Y from "yjs";

export class MyParty {
  doc: Y.Doc;

  constructor() {
    this.doc = new Y.Doc();
    const root = this.doc.getMap("root");

    // Initialize state if empty
    if (root.size === 0) {
      root.set("todos", new Y.Array());
      root.set("settings", new Y.Map());
    }
  }
}
```

Clients connect and immediately see the initialized state:

```typescript
// Client
const { proxy: state } = createYjsProxy(ydoc, {
  getRoot: (doc) => doc.getMap("root"),
});

// Wait for sync
provider.on("synced", () => {
  console.log(state.todos); // Already initialized by server
});
```

### Client-Side Initialization (When Necessary)

If server-side initialization isn't possible, use `bootstrap()` to safely initialize on the client:

```typescript
const { proxy: state, bootstrap } = createYjsProxy(ydoc, {
  getRoot: (doc) => doc.getMap("root"),
});

provider.once("synced", () => {
  bootstrap({
    todos: [],
    settings: { theme: "light" },
  });
  // Only writes if the document is empty
});
```

**Important:** Always wait for the `synced` event before calling `bootstrap()`. This ensures you don't overwrite data from other clients.

**We don't recommend client-side initialization unless server-side isn't an option.** It adds complexity and potential race conditions.

---

## Choosing Your Architecture

Depending on your application, you'll need different setups:

### Simple Applications: Single Room

**When to use:** Your entire app operates in one collaborative session (e.g., a shared whiteboard, single todo list, or simple multiplayer game).

```typescript
import * as Y from "yjs";
import { createYjsProxy } from "valtio-y";
import YProvider from "y-partyserver/provider";

const ydoc = new Y.Doc();
const provider = new YProvider(window.location.host, "my-room", ydoc);

const { proxy: state } = createYjsProxy(ydoc, {
  getRoot: (doc) => doc.getMap("root"),
});

// Use state throughout your app
```

**See:** [Simple Example](../examples/simple) for a complete implementation.

**This is all you need** for most single-room applications. One document, one proxy, one provider.

### Complex Applications: Multiple Rooms

**When to use:**

- Users navigate between different rooms (e.g., `/room/abc`, `/room/xyz`)
- Multiple windows/tabs need to show different data
- Each "workspace" or "document" is independent

**You need the RoomState pattern.** This pattern ensures each room gets its own Y.Doc, proxy, and provider with proper lifecycle management.

```typescript
import { useMemo, useEffect } from "react";
import { RoomState } from "./yjs-setup";
import { useRoomProvider } from "./use-room-provider";

function App() {
  const roomId = useParams().roomId; // From your router

  // New document + proxy per room
  const room = useMemo(() => new RoomState(), [roomId]);

  // Connect to this room's server
  const provider = useRoomProvider({
    host: window.location.host,
    room: roomId,
    doc: room.doc,
  });

  // Cleanup when switching rooms
  useEffect(() => {
    return () => room.dispose();
  }, [room]);

  return <YourAppUI state={room.proxy} />;
}
```

**Key concept:** One Y.Doc per collaborative session. When users switch rooms, you create a new document and dispose of the old one.

**See:** [Multi-Room Architecture Guide](./multi-room-architecture.md) for complete implementation details, lifecycle management, and working examples ([Sticky Notes](../examples/sticky-notes), [Todos](../examples/todos)).

### Decision Matrix

| Your App Has...                      | Use This Pattern      |
| ------------------------------------ | --------------------- |
| Single collaborative session         | Simple (one document) |
| No navigation between rooms          | Simple (one document) |
| Multiple rooms with routing          | RoomState pattern     |
| Multiple tabs showing different data | RoomState pattern     |
| Workspace/channel navigation         | RoomState pattern     |

**Default to the simple pattern** unless you know you need multiple rooms. You can always refactor later.

---

## React Integration

valtio-y integrates seamlessly with React through Valtio's `useSnapshot` hook.

### Basic Usage

```typescript
import { useSnapshot } from "valtio/react";

function TodoList() {
  const snap = useSnapshot(state);

  return (
    <ul>
      {snap.todos.map((todo, i) => (
        <li key={i}>
          <input
            type="checkbox"
            checked={todo.done}
            onChange={() => (state.todos[i].done = !todo.done)}
          />
          {todo.text}
        </li>
      ))}
    </ul>
  );
}
```

**Key principle:** Read from the snapshot (`snap`), mutate the proxy (`state`).

### Controlled Text Inputs

For `<input>` or `<textarea>` elements, use `{ sync: true }` to prevent cursor jumping:

```typescript
function TextInput() {
  const snap = useSnapshot(state, { sync: true });

  return (
    <input value={snap.text} onChange={(e) => (state.text = e.target.value)} />
  );
}
```

**Why?** Valtio batches updates asynchronously by default. For text inputs, this causes the cursor to jump. `{ sync: true }` forces synchronous updates. See [Valtio issue #270](https://github.com/pmndrs/valtio/issues/270).

**Only use `{ sync: true }` for controlled text inputs.** For everything else, the default async batching is more performant.

### Other Frameworks

valtio-y works with any framework that Valtio supports:

- **Vue** - `useSnapshot` from `valtio/vue`
- **Svelte** - `useSnapshot` from `valtio/svelte`
- **Solid** - Direct usage with `createMemo`
- **Vanilla JS** - `subscribe` from `valtio`

---

## Next Steps

### Start Building

1. **Choose your architecture** - Simple or RoomState pattern?
2. **Set up your server** - PartyKit, Cloudflare, or custom WebSocket?
3. **Initialize state** - Preferably server-side
4. **Build your UI** - Use `useSnapshot` in React

### Learn More

**Core Guides:**

- **[Basic Operations](./basic-operations.md)** - Arrays, objects, and mutations
- **[Multi-Room Architecture](./multi-room-architecture.md)** - Complete RoomState pattern guide
- **[Structuring Your App](./structuring-your-app.md)** - Using `getRoot` and organizing state

**Advanced Topics:**

- **[Undo/Redo](./undo-redo.md)** - Time travel with Yjs UndoManager
- **[Performance Guide](./performance-guide.md)** - Optimization patterns and benchmarks
- **[Core Concepts](./concepts.md)** - Understanding CRDTs and conflict resolution

### Examples

Check out the [live examples](../README.md#examples) to see these patterns in action:

- **[Simple Example](../examples/simple)** - Single room pattern
- **[Sticky Notes](../examples/sticky-notes)** - RoomState pattern with Cloudflare
- **[Todos](../examples/todos)** - RoomState pattern with routing
- **[Whiteboard](../examples/whiteboard)** - Collaborative drawing
- **[Minecraft Clone](../examples/minecraft)** - Real-time multiplayer game
