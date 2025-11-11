# Getting Started with valtio-y

This guide covers the essential patterns you'll need to start building collaborative apps with valtio-y. After completing the [Quick Start](../README.md#quick-start), use this guide to understand how to set up collaboration, initialize state properly, and integrate with React.

---

## Table of Contents

1. [Setting Up Collaboration](#setting-up-collaboration)
2. [Initializing State](#initializing-state)
3. [Using State in Your App](#using-state-in-your-app)
4. [React Integration](#react-integration)
5. [Next Steps](#next-steps)

---

## Setting Up Collaboration

To sync state across clients, connect a Yjs provider to your document. Providers handle the network layer so you don't have to.

### Basic Setup

```js
import { WebsocketProvider } from "y-websocket";

const provider = new WebsocketProvider(
  "ws://localhost:1234",
  "room-name",
  ydoc
);
// That's it—state syncs automatically
```

### Available Providers

valtio-y works with any Yjs provider:

- **[y-websocket](https://github.com/yjs/y-websocket)** - WebSocket-based sync (most common)
- **[y-partyserver](https://github.com/partykit/partykit/tree/main/packages/y-partyserver)** - Great for Cloudflare deployments
- **[y-webrtc](https://github.com/yjs/y-webrtc)** - Peer-to-peer sync without a server
- **[y-indexeddb](https://github.com/yjs/y-indexeddb)** - Local persistence in the browser

### Multiple Providers

You can use multiple providers simultaneously:

```js
import { WebsocketProvider } from "y-websocket";
import { IndexeddbPersistence } from "y-indexeddb";

// Sync over network
const wsProvider = new WebsocketProvider("ws://localhost:1234", "room", ydoc);

// Also persist locally
const indexeddbProvider = new IndexeddbPersistence("room", ydoc);
```

This gives you both real-time sync and offline support.

---

## Initializing State

How you initialize state depends on whether you're using network sync.

### With Network Sync (Recommended)

When using network providers, **wait for the first sync** before initializing. This prevents overwriting remote data:

```js
import { WebsocketProvider } from "y-websocket";

const ydoc = new Y.Doc();
const provider = new WebsocketProvider("ws://localhost:1234", "room", ydoc);

const { proxy: state, bootstrap } = createYjsProxy(ydoc, {
  getRoot: (doc) => doc.getMap("state"),
});

// Wait for sync, then safely initialize if empty
provider.once("synced", () => {
  bootstrap({
    todos: [],
    settings: { theme: "light" },
  });
  // Only writes if the document is empty
});
```

**Key points:**
- `bootstrap()` only writes if the document is empty
- This prevents overwriting data from other clients
- Safe to call on every client—first one to connect will initialize

### Without Network Sync (Local-First)

For local-first apps or when you're not syncing over a network, direct assignment works fine:

```js
const { proxy: state } = createYjsProxy(ydoc, {
  getRoot: (doc) => doc.getMap("state"),
});

// Just assign directly
if (!state.todos) {
  state.todos = [];
}

if (!state.settings) {
  state.settings = { theme: "light" };
}
```

### Checking if State is Empty

You can check if the document is empty before initializing:

```js
const ymap = ydoc.getMap("state");

if (ymap.size === 0) {
  // Document is empty, safe to initialize
  state.todos = [];
  state.settings = { theme: "light" };
}
```

---

## Using State in Your App

Once you've created your proxy, you can use it anywhere in your application.

### Reading State

State is a normal JavaScript object—read it like any other:

```js
// Read current state (non-reactive)
const currentCount = state.count;
const firstTodo = state.todos[0];
const userName = state.user.name;
```

**Note:** Direct reads are **non-reactive**. Use `useSnapshot` in React components for reactive updates.

### Mutating State

Mutate state anywhere in your app:

```js
// Direct mutation
state.count++;

// Nested updates
state.user.name = "Alice";

// In event handlers
button.addEventListener("click", () => {
  state.count++;
});

// In timers
setTimeout(() => {
  state.message = "Updated from timer";
}, 1000);

// In async functions
async function loadData() {
  const data = await fetch("/api/data");
  state.data = data; // Syncs automatically
}
```

Changes propagate to all connected clients automatically.

### Batching Updates

Multiple mutations in the same tick are automatically batched into a single transaction:

```js
// All three updates batched together
state.todos.push({ text: "Task 1", done: false });
state.todos.push({ text: "Task 2", done: false });
state.lastModified = Date.now();
// Results in one network update
```

See the [Performance Guide](./performance-guide.md) for more on batching.

---

## React Integration

valtio-y integrates seamlessly with React through Valtio's `useSnapshot` hook.

### Basic Usage

```jsx
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
            onChange={() => (state.todos[i].done = !state.todos[i].done)}
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

When using controlled text inputs (like `<input>` or `<textarea>`), add `{ sync: true }` to prevent cursor jumping:

```jsx
function TextInput() {
  const snap = useSnapshot(state, { sync: true }); // ⚠️ Important!

  return (
    <input
      value={snap.text}
      onChange={(e) => (state.text = e.target.value)}
    />
  );
}
```

This forces synchronous updates instead of Valtio's default async batching. See [Valtio issue #270](https://github.com/pmndrs/valtio/issues/270) for details.

### Why `{ sync: true }` for Text Inputs?

Without `{ sync: true }`, Valtio batches updates asynchronously. This causes the cursor to jump to the end of the input on every keystroke because React re-renders with a slight delay.

**Only use `{ sync: true }` for controlled text inputs.** For other components, the default async batching is more performant.

### Fine-Grained Reactivity

Components only re-render when their accessed properties change:

```jsx
function TodoStats() {
  const snap = useSnapshot(state);
  
  // Only re-renders when todos array changes
  return <div>Total: {snap.todos.length}</div>;
}

function UserProfile() {
  const snap = useSnapshot(state);
  
  // Only re-renders when user.name changes
  return <div>User: {snap.user.name}</div>;
}
```

This is handled automatically by Valtio's proxy tracking.

### Other Frameworks

valtio-y works with any framework that Valtio supports:

- **React** - `useSnapshot` from `valtio/react`
- **Vue** - `useSnapshot` from `valtio/vue`
- **Svelte** - `useSnapshot` from `valtio/svelte`
- **Solid** - Direct usage with `createMemo`
- **Vanilla JS** - `subscribe` from `valtio`

---

## Next Steps

Now that you understand the basics, explore these guides for deeper patterns:

### Core Guides

- **[Basic Operations](./basic-operations.md)** - Arrays, objects, and nested structures
- **[Core Concepts](./concepts.md)** - Understanding CRDTs and the mental model
- **[Structuring Your App](./structuring-your-app.md)** - How to organize state with `getRoot`

### Advanced Topics

- **[Undo/Redo](./undo-redo.md)** - Time travel with Yjs UndoManager
- **[Performance Guide](./performance-guide.md)** - Optimization patterns and benchmarks
- **[Error Handling](./error-handling.md)** - Validation and rollback patterns

### Examples

Check out the [live examples](../README.md#examples) to see real-world usage patterns:

- **Simple App** - Basic collaborative state
- **Todos** - Full-featured todo app
- **Sticky Notes** - Cloudflare Durable Objects
- **Whiteboard** - Collaborative drawing
- **Minecraft Clone** - Real-time multiplayer game

