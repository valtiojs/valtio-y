# valtio-y ⚡

### Effortless Collaborative State

**Write normal JavaScript. Sync in real-time automatically.**

[![CI](https://img.shields.io/github/actions/workflow/status/valtiojs/valtio-y/ci.yml?branch=main)](https://github.com/valtiojs/valtio-y/actions?query=workflow%3ACI)
[![npm version](https://img.shields.io/npm/v/valtio-y)](https://www.npmjs.com/package/valtio-y)
[![bundle size](https://img.shields.io/bundlephobia/minzip/valtio-y)](https://bundlephobia.com/result?p=valtio-y)
[![npm downloads](https://img.shields.io/npm/dm/valtio-y)](https://www.npmjs.com/package/valtio-y)
[![TypeScript](https://img.shields.io/badge/TypeScript-Ready-blue)](https://www.typescriptlang.org/)

<br />
<p align="center">
  <a href="https://valtio-y-stickynotes.agcty.workers.dev/">
    <img src="https://i.imgur.com/a36KJ2a.gif" alt="Sticky Notes Demo (valtio-y)" width="100%" />
  </a>
</p>
<br />

**Build multiplayer apps as easily as writing local state.**

valtio-y synchronizes your [Valtio](https://github.com/pmndrs/valtio) state with [Yjs](https://github.com/yjs/yjs) automatically. It solves the difficult edge cases of state-CRDT syncing—like **array moves**, **item replacements**, and **list reordering**—while remaining significantly more performant than naive bindings.

[Examples](#examples) · [Guides](#guides)

---

## Why valtio-y?

Most CRDT bindings struggle with the "last 10%" of complexity: correctly handling **array moves** (reordering items without deleting/recreating them), **replacing objects** without breaking references, and maintaining **referential equality** for React renders.

valtio-y is a ground-up rewrite focused on **correctness** and **performance**:

- **Solves Hard Sync Problems**: Handles array moves, replacements, and reordering correctly.
- **High Performance**: Optimized for bulk operations and deep state trees; significantly faster than other proxy-based solutions.
- **Production Ready**: Handles the edge cases that usually cause sync divergence in other libraries.

You get automatic conflict resolution, offline support, and efficient re-renders, but with a level of robustness that stands up to complex real-world usage.

**valtio-y handles all of this for you.** Just mutate your state like normal:

```typescript
state.todos.push({ text: "Buy milk", done: false });
state.users[0].name = "Alice";
state.dashboard.widgets[2].position = { x: 100, y: 200 };

// Move item from index 0 to 2 (handled efficiently)
const [todo] = state.todos.splice(0, 1);
state.todos.splice(2, 0, todo);
```

It automatically syncs across all connected users with **zero configuration**. No special APIs, no operational transforms to understand, no conflict resolution code to write.

### Optimized for Performance

valtio-y batches all mutations in a single event loop tick into one Yjs transaction. This means **100 updates result in just 1 network message**.

It also handles large arrays and deep object trees efficiently, only updating the parts of the React component tree that actually changed.

### When to Use valtio-y

**Perfect for:** Real-time collaborative apps involving structured data like **Kanban boards**, **spreadsheets**, **design tools**, **game state**, and **forms**.

**Not for:** Collaborative **text editors** (Google Docs style). For rich text, use [Lexical](https://lexical.dev/), [TipTap](https://tiptap.dev/), or [ProseMirror](https://prosemirror.net/) with their native Yjs bindings.

### Examples

See the power of valtio-y in action:

1. **[Simple App](https://valtio-y-simple.agcty.workers.dev/)** - Objects, arrays, and primitives syncing in real-time.
2. **[Sticky Notes](https://valtio-y-stickynotes.agcty.workers.dev/)** - Production-ready collaborative board.
3. **[Whiteboard](https://valtio-y-whiteboard.agcty.workers.dev)** - Drawing, shapes, and multi-user cursors.
4. **[Todos App](https://valtio-y-todos.agcty.workers.dev)** - Collaborative list management.
5. **[Minecraft Clone](https://valtio-y-minecraft.agcty.workers.dev)** - Multiplayer game state with 3D graphics.

---

## Installation

```bash
# npm
npm install valtio-y valtio yjs

# pnpm
pnpm add valtio-y valtio yjs

# bun
bun add valtio-y valtio yjs
```

---

## Quick Start

Create a synchronized proxy and mutate it like any normal object. Changes automatically sync across clients.

```typescript
import * as Y from "yjs";
import { createYjsProxy } from "valtio-y";

type State = {
  text: string;
  count: number;
  user: { name: string; age: number };
  todos: Array<{ text: string; done: boolean }>;
};

// Create a Yjs document
const ydoc: Y.Doc = new Y.Doc();

// Create a synchronized proxy
// getRoot selects which Yjs structure to sync (all clients must use the same name)
const { proxy: state } = createYjsProxy<State>(ydoc, {
  getRoot: (doc) => doc.getMap("root"), // Most apps use one root Map
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

---

## Key Features

- **⚡ Zero API Overhead** - No special methods—just mutate objects like normal JavaScript
- **🎯 Fine-Grained Updates** - Valtio ensures only components with changed data re-render.
- **🌐 Offline-First** - Local changes automatically merge when reconnected
- **🛡️ Production-Ready** - Validation, rollback, comprehensive tests, and benchmarks
- **🔒 Type-Safe** - Full TypeScript support with complete type inference
- **🔌 Provider-Agnostic** - Works with any Yjs provider (WebSocket, WebRTC, IndexedDB)

---

## Using with React

Bind your components with Valtio's `useSnapshot` hook. Components re-render only when their data changes:

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

**For optimizing large lists** with thousands of items, see the [Performance Guide](./guides/performance-guide.md#optimizing-lists).

**Note for text inputs:** When using controlled text inputs (like `<input>` or `<textarea>`), add `{ sync: true }` to prevent cursor jumping:

```jsx
const snap = useSnapshot(state, { sync: true });
<input value={snap.text} onChange={(e) => (state.text = e.target.value)} />;
```

This forces synchronous updates instead of Valtio's default async batching. See [Valtio issue #270](https://github.com/pmndrs/valtio/issues/270) for details.

---

## Guides

Core documentation for understanding and using valtio-y effectively:

- **[Getting Started](./guides/getting-started.md)** - Essential patterns for collaboration, initialization, and React integration
- **[Basic Operations](./guides/basic-operations.md)** - Objects, arrays, and nested structures
- **[Core Concepts](./guides/concepts.md)** - Understand CRDTs and the valtio-y mental model
- **[Structuring Your App](./guides/structuring-your-app.md)** - How to organize state with `getRoot`
- **[Undo/Redo](./guides/undo-redo.md)** - Implement undo/redo with Yjs UndoManager
- **[Performance Guide](./guides/performance-guide.md)** - Batching, bulk operations, and optimization

---

## Common Patterns

### Setting Up Collaboration

Connect a Yjs provider to sync across clients:

```js
import { WebsocketProvider } from "y-websocket";

const provider = new WebsocketProvider("ws://localhost:1234", "room", ydoc);
// State syncs automatically
```

Works with [y-websocket](https://github.com/yjs/y-websocket), [y-partyserver](https://github.com/partykit/partykit/tree/main/packages/y-partyserver), [y-webrtc](https://github.com/yjs/y-webrtc), [y-indexeddb](https://github.com/yjs/y-indexeddb), and more.

**→ See [Getting Started Guide](./guides/getting-started.md) for initialization patterns and provider setup**

### Working with State

```js
// Arrays - all standard methods work
state.items.push(newItem);
state.items[0] = updatedItem;

// Objects - mutate naturally
state.user.name = "Alice";
state.settings = { theme: "dark" };

// Access anywhere (event handlers, timers, async functions)
state.count++;
```

**→ See [Basic Operations](./guides/basic-operations.md) for arrays, objects, and nested structures**

### Undo/Redo

```js
const {
  proxy: state,
  undo,
  redo,
} = createYjsProxy(ydoc, {
  getRoot: (doc) => doc.getMap("state"),
  undoManager: true, // Enable undo/redo
});

undo(); // Undo last change
redo(); // Redo
```

**→ See [Undo/Redo Guide](./guides/undo-redo.md) for full integration with React and advanced patterns**

---

## Performance

valtio-y is fast out of the box with automatic batching, bulk operations, and efficient proxy creation. Typical performance characteristics:

| Operation                   | Time     | Notes                      |
| --------------------------- | -------- | -------------------------- |
| Small updates (1-10 items)  | ~1-3ms   | Typical UI interactions    |
| Bulk operations (100 items) | ~3-8ms   | Automatically optimized    |
| Large arrays (1000 items)   | ~15-30ms | Bootstrap/import scenarios |
| Deep nesting (10+ levels)   | ~2-4ms   | Cached proxies stay fast   |

**→ See [Performance Guide](./guides/performance-guide.md) for benchmarking, optimization patterns, and React integration**

---

## Limitations

### Not Supported

- `undefined` values (use `null` or delete the key)
- Non-serializable types (functions, symbols, class instances)
- Direct length manipulation (use `array.splice()` instead of `array.length = N`)

### What Works

- Objects and arrays with full support for deep nesting
- Primitives: string, number, boolean, null
- All array methods: push, pop, splice, and more
- Undo/redo via Yjs UndoManager

### Research In Progress

**Important:** valtio-y is designed for **shared application state** (collaborative data structures like objects, arrays, and primitives), not for building text editors.

**If you're building a text editor:** Use the native Yjs integration for your editor:

- [Lexical](https://lexical.dev/) → Use `@lexical/yjs`
- [TipTap](https://tiptap.dev/) → Use their built-in Yjs extension
- [ProseMirror](https://prosemirror.net/) → Use `y-prosemirror`

These editors have specialized Yjs integrations optimized for their specific use cases.

**Collaborative text integration research:**

valtio-y currently focuses on collaborative data structures like maps, arrays, and primitives. Y.Text and Y.Xml\* nodes are **not** part of the supported surface area today because plain strings inside shared objects have covered the real-world use cases we've seen so far. We're still tinkering with richer text and XML nodes on the `research/ytext-integration` branch, so if you rely on those leaf types we'd love to hear what you're building.

**Current status:**

- Core types (Y.Map, Y.Array, primitives) are production-ready with clean, well-tested implementations
- Notes from the collaborative text/XML prototype remain in the `research/ytext-integration` branch for anyone curious about the trade-offs we explored

**Have a use case for collaborative text in shared state?** We'd love to learn more! Please [open an issue](https://github.com/valtiojs/valtio-y/issues) to discuss your requirements.

---

## Best Practices

**Do:**

- Use `bootstrap()` when initializing state with network sync providers
- Batch related updates in the same tick for better performance
- Use bulk array operations (`push(...items)`) instead of loops
- Cache references to deeply nested objects in tight loops
- Store text fields as plain strings

**Don't:**

- Use `undefined` values (use `null` or delete the property)
- Store functions or class instances (not serializable)
- Manipulate `array.length` directly (use `splice()` instead)

**→ See [Performance Guide](./guides/performance-guide.md) for advanced patterns like concurrent list reordering with fractional indexing**

---

**Feedback and contributions welcome!** If you find bugs or have suggestions, please [open an issue](https://github.com/valtiojs/valtio-y/issues).

For detailed technical documentation, see:

- [Architecture](./docs/architecture/architecture.md)
- [Limitations](./docs/architecture/limitations.md)
- [Data Flow](./docs/architecture/data-flow.md)
