# valtio-y

[![npm version](https://img.shields.io/npm/v/valtio-y)](https://www.npmjs.com/package/valtio-y)
[![bundle size](https://img.shields.io/bundlephobia/minzip/valtio-y)](https://bundlephobia.com/result?p=valtio-y)

Two-way sync between [Valtio](https://github.com/pmndrs/valtio) proxies and [Yjs](https://github.com/yjs/yjs) CRDTs. Build collaborative apps with automatic conflict resolution and offline support—just mutate objects naturally.

```typescript
state.todos.push({ text: "Buy milk", done: false });
state.users[0].name = "Alice";
// Automatically syncs across all connected users
```

## Installation

```bash
# npm
npm install valtio-y valtio yjs

# pnpm
pnpm add valtio-y valtio yjs

# bun
bun add valtio-y valtio yjs
```

## Quick Start

Create a synchronized proxy and mutate it like any normal object. Changes automatically sync across clients.

```js
import * as Y from "yjs";
import { createYjsProxy } from "valtio-y";

// Create a Yjs document
const ydoc = new Y.Doc();

// Create a synchronized proxy
const { proxy: state } = createYjsProxy(ydoc, {
  getRoot: (doc) => doc.getMap("mymap"),
});

// Mutate state like a normal object
state.text = "hello";
state.count = 0;

// Nested objects work too
state.user = { name: "Alice", age: 30 };
state.user.age = 31;

// Arrays work naturally
state.todos = [{ text: "Learn valtio-y", done: false }];
state.todos.push({ text: "Build something cool", done: false });
state.todos[0].done = true;
```

That's it! State is now synchronized via Yjs. Add a provider to sync across clients.

## Examples

Live collaborative demos - open in multiple tabs to see real-time sync:

1. **[Simple App](https://valtio-y-simple.agcty.workers.dev/)** - Complete example demonstrating objects, arrays, strings, and numbers with real-time sync. Simple example for beginners.

2. **[Sticky Notes](https://valtio-y-stickynotes.agcty.workers.dev/)** - Cloudflare Durable Object demo showing collaborative sticky notes in production.

3. **[Whiteboard](https://valtio-y-whiteboard.agcty.workers.dev)** - Collaborative whiteboard demo with drawing and shapes.

4. **[Todos App](https://valtio-y-todos.agcty.workers.dev)** - Live collaborative todo app demo.

5. **[Minecraft Clone](https://stackblitz.com/github/valtiojs/valtio-y/tree/main/examples/03_minecraft)** - Real-time multiplayer 3D game with WebRTC P2P sync (Three.js, y-webrtc).

## Collaboration Setup

Connect any Yjs provider to sync across clients:

```js
import { WebsocketProvider } from "y-websocket";

const provider = new WebsocketProvider(
  "ws://localhost:1234",
  "room-name",
  ydoc
);
// That's it—state syncs automatically
```

Works with any provider: [y-websocket](https://github.com/yjs/y-websocket), [y-partyserver](https://github.com/partykit/partykit/tree/main/packages/y-partyserver) (great for Cloudflare), [y-webrtc](https://github.com/yjs/y-webrtc), [y-indexeddb](https://github.com/yjs/y-indexeddb), etc.

## Common Operations

### Initializing State

When using network providers, initialize after first sync:

```js
const { proxy: state, bootstrap } = createYjsProxy(ydoc, {
  getRoot: (doc) => doc.getMap("state"),
});

provider.once("synced", () => {
  bootstrap({
    todos: [],
    settings: { theme: "light" },
  });
  // Only writes if the document is empty
});
```

### Arrays

```js
state.items.push(newItem);
state.items[0] = updatedItem;
state.items.splice(1, 2, replacement1, replacement2);
const [item] = state.items.splice(2, 1);
state.items.splice(0, 0, item); // Move item
```

### Objects

```js
state.user.name = "Alice";
delete state.user.temporaryFlag;
state.data.deeply.nested.value = 42;
```

### Undo/Redo

```js
const {
  proxy: state,
  undo,
  redo,
} = createYjsProxy(ydoc, {
  getRoot: (doc) => doc.getMap("state"),
  undoManager: true, // Enable with defaults
});

state.count = 1;
undo(); // state.count -> undefined
redo(); // state.count -> 1
```

See [guides/undo-redo.md](../guides/undo-redo.md) for full documentation.

## Using with React

Use Valtio's `useSnapshot` hook to bind state to components. Components re-render only when their data changes:

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

valtio-y works with any framework that Valtio supports: React, Vue, Svelte, Solid, and vanilla JavaScript.

## Features

- **Zero API overhead** - Just mutate objects like normal JavaScript
- **Fine-grained updates** - Components re-render only when their data changes
- **Offline-first** - Changes merge automatically when reconnected
- **TypeScript** - Full type safety and inference
- **Production-ready** - Comprehensive tests and benchmarks
- **Framework-agnostic** - Works with React, Vue, Svelte, Solid, and vanilla JS

## Limitations

- Don't use `undefined` (use `null` or delete the property)
- Don't store functions or class instances (not serializable)
- Use `array.splice()` instead of `array.length = N`

For text editors, use native Yjs integrations: [Lexical](https://lexical.dev/), [TipTap](https://tiptap.dev/), or [ProseMirror](https://prosemirror.net/).

## API Reference

### `createYjsProxy(doc, options)`

```typescript
const { proxy, bootstrap } = createYjsProxy(ydoc, {
  getRoot: (doc: Y.Doc) => Y.Map<any>,
});
```

Returns:

- `proxy` - Valtio proxy for state mutations
- `bootstrap(data)` - Initialize state (no-op if doc not empty)

## Resources

- [GitHub Repository](https://github.com/valtiojs/valtio-y)
- [Documentation](https://github.com/valtiojs/valtio-y/tree/main/docs)
- [Issues](https://github.com/valtiojs/valtio-y/issues)
- [Discord](https://discord.gg/MrQdmzd)
