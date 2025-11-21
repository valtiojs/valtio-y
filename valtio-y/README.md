# valtio-y

[![npm version](https://img.shields.io/npm/v/valtio-y)](https://www.npmjs.com/package/valtio-y)
[![bundle size](https://img.shields.io/bundlephobia/minzip/valtio-y)](https://bundlephobia.com/result?p=valtio-y)

Two-way sync between [Valtio](https://github.com/pmndrs/valtio) proxies and [Yjs](https://github.com/yjs/yjs) CRDTs. Build collaborative apps with automatic conflict resolution and offline support—just mutate objects naturally.

### Effortless Collaborative State

**Write normal JavaScript. Sync in real-time automatically.**

```typescript
state.todos.push({ text: "Buy milk", done: false });
state.users[0].name = "Alice";
state.dashboard.widgets[2].position = { x: 100, y: 200 };

// Move item from index 0 to 2 (handled efficiently)
const [todo] = state.todos.splice(0, 1);
state.todos.splice(2, 0, todo);
```

<br />
<p align="center">
  <a href="https://valtio-y-stickynotes.agcty.workers.dev/">
    <img src="https://i.imgur.com/a36KJ2a.gif" alt="Sticky Notes Demo (valtio-y)" width="100%" />
  </a>
</p>
<br />

## Live Examples

**Open any demo in multiple browser tabs and watch them sync in real-time:**

🎮 **[Minecraft Clone](https://valtio-y-minecraft.agcty.workers.dev)** - Simple showcase inspired by Minecraft. Lets multiple users place and remove blocks in real time using Three.js and valtio-y.

🎨 **[Whiteboard](https://valtio-y-whiteboard.agcty.workers.dev)** - Collaborative drawing with shapes, colors, and real-time cursors. Google Docs for drawing.

📝 **[Sticky Notes](https://valtio-y-stickynotes.agcty.workers.dev/)** - Production-ready app running on Cloudflare Workers (this is real infrastructure, not a demo server).

✅ **[Todos App](https://valtio-y-todos.agcty.workers.dev)** - Classic collaborative todo list. Real-time updates, no refresh needed.

🧪 **[Simple Demo](https://valtio-y-simple.agcty.workers.dev/)** – Best for understanding the basic sync patterns (objects, arrays, primitives); other demos above are more production-focused.

## Quick Start

Create a synchronized proxy and mutate it like any normal object. Changes automatically sync across clients.

```js
import * as Y from "yjs";
import { createYjsProxy } from "valtio-y";

// Create a Yjs document
const ydoc = new Y.Doc();

// Create a synchronized proxy
const { proxy: state } = createYjsProxy(ydoc, {
  getRoot: (doc) => doc.getMap("root"),
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

## Installation

```bash
# npm
npm install valtio-y valtio yjs

# pnpm
pnpm add valtio-y valtio yjs

# bun
bun add valtio-y valtio yjs
```

## React Integration

Use Valtio's `useSnapshot` hook to automatically re-render components when data changes:

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

valtio-y works with any framework that Valtio supports: React, Vue, Svelte, Solid, and vanilla JavaScript.

**For optimizing large lists** with thousands of items, see the [Performance Guide](../guides/performance-guide.md#optimizing-lists).

**Note for text inputs:** When using controlled text inputs (like `<input>` or `<textarea>`), add `{ sync: true }` to prevent cursor jumping:

```jsx
const snap = useSnapshot(state, { sync: true });
<input value={snap.text} onChange={(e) => (state.text = e.target.value)} />;
```

This forces synchronous updates instead of Valtio's default async batching. See [Valtio issue #270](https://github.com/pmndrs/valtio/issues/270) for details.

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

See [API documentation](src/undo/setup-undo-manager.ts) for configuration options.

## Features

- **Zero API overhead** - Just mutate objects like normal JavaScript
- **Fine-grained updates** - Components re-render only when their data changes
- **Offline-first** - Changes merge automatically when reconnected
- **TypeScript** - Full type safety and inference
- **Production-ready** - Comprehensive tests and benchmarks
- **Framework-agnostic** - Works with React, Vue, Svelte, Solid, and vanilla JS

## Why valtio-y?

Stop writing sync logic. Just mutate objects.

- **Valtio** gives you reactive state with zero boilerplate
- **Yjs** gives you conflict-free sync and offline support
- **valtio-y** connects them - you get both, write neither

No reducers, no actions, no manual sync code. Just: `state.count++`

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
