<div align="center">

# valtio-y

### Collaborative State Management for React

**Write normal JavaScript, get real-time sync free**

[![CI](https://img.shields.io/github/actions/workflow/status/valtiojs/valtio-y/ci.yml?branch=main)](https://github.com/valtiojs/valtio-y/actions?query=workflow%3ACI)
[![npm version](https://img.shields.io/npm/v/valtio-y)](https://www.npmjs.com/package/valtio-y)
[![bundle size](https://img.shields.io/bundlephobia/minzip/valtio-y)](https://bundlephobia.com/result?p=valtio-y)
[![npm downloads](https://img.shields.io/npm/dm/valtio-y)](https://www.npmjs.com/package/valtio-y)
[![Discord](https://img.shields.io/discord/627656437971288081)](https://discord.gg/MrQdmzd)
[![TypeScript](https://img.shields.io/badge/TypeScript-Ready-blue)](https://www.typescriptlang.org/)

Two-way sync between [Valtio](https://github.com/pmndrs/valtio) proxies and [Yjs](https://github.com/yjs/yjs) CRDTs. Build collaborative apps for **structured data** (forms, dashboards, boards)—no special APIs, just mutate objects naturally.

[Examples](#-examples) · [Guides](#-guides) · [Discord](https://discord.gg/MrQdmzd)

</div>

---

## Why valtio-y?

Building collaborative apps for **structured data** (not text documents, not simple CRUD) is **hard**. You need:

- ❌ **Automatic conflict resolution** when users edit simultaneously
- ❌ **Offline support** that merges changes correctly when reconnected
- ❌ **Network protocols** (WebSocket, WebRTC, etc.)
- ❌ **State consistency** across clients
- ❌ **React re-renders** without performance issues

**valtio-y handles all of this for you.** Just mutate your state like normal:

```typescript
state.todos.push({ text: "Buy milk", done: false });
state.users[0].name = "Alice";
state.dashboard.widgets[2].position = { x: 100, y: 200 };
```

It automatically syncs across all connected users with **zero configuration**. No special APIs, no operational transforms to understand, no conflict resolution code to write.

### How It Compares

|                     | valtio-y      | Plain Yjs  | Other CRDT libs |
| ------------------- | ------------- | ---------- | --------------- |
| React Integration   | ✅ Native     | ⚠️ Manual  | ⚠️ Manual       |
| TypeScript Support  | ✅ Full       | ✅ Full    | ⚠️ Partial      |
| Learning Curve      | ✅ Low        | ⚠️ Medium  | ❌ High         |
| Nested Structures   | ✅ Natural    | ⚠️ Manual  | ⚠️ Manual       |
| Array Operations    | ✅ All native | ⚠️ Y.Array | ⚠️ Limited      |
| Fine-grained Render | ✅ Yes        | ❌ No      | ❌ No           |
| Offline-First       | ✅ Yes        | ✅ Yes     | ⚠️ Varies       |

Built from the ground up with a production-ready architecture, cleaner API (`createYjsProxy` vs manual binding), and battle-tested performance. Based on the original valtio-yjs but completely rewritten for reliability and developer experience.

### When to Use valtio-y

valtio-y excels in the **sweet spot between text editors and sync engines**: real-time collaborative editing of **structured data** (objects, arrays, nested state) where conflicts must resolve automatically.

**✅ Perfect for:**

- **Form builders** - Drag-and-drop interfaces, field configuration, visual editors
- **Kanban/project boards** - Task management, card reordering, status updates
- **Collaborative spreadsheets** - Data entry, cell updates (not heavy text editing)
- **Dashboard configurators** - Widget placement, settings, real-time layout adjustments
- **Design tool data** - Layer properties, element positions, configuration (not text content)
- **Multiplayer game state** - Player positions, inventory, world state (see our [Minecraft example](#-examples)!)
- **Data annotation tools** - Labeling, categorization, collaborative markup
- **Configuration panels** - Settings that multiple users can adjust simultaneously

**❌ Wrong tool for the job:**

- **Text/document editors** → Use [Lexical](https://lexical.dev/), [TipTap](https://tiptap.dev/), or [ProseMirror](https://prosemirror.net/) with native Yjs integrations. They handle text-specific reconciliation internally.
- **Apps like Linear/Notion** → Use sync engines (real-time updates without CRDT conflict resolution). Two users simultaneously editing the same Linear issue title or description doesn't need automatic merging—one user's change wins, and they can communicate to resolve it.
- **Simple CRUD apps** → Plain REST/GraphQL is simpler if you don't need real-time collaboration.

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

## Use in React

Bind your components with Valtio's `useSnapshot`. Components re-render only when their data changes.

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

function AddTodo() {
  return (
    <button onClick={() => state.todos.push({ text: "New task", done: false })}>
      Add Todo
    </button>
  );
}
```

---

## ✨ Key Features

<table>
<tr>
<td width="50%" style="padding: 20px; vertical-align: top;">

**✨ Zero API Overhead**

No special methods—just mutate objects like normal JavaScript

**🎯 Fine-Grained Updates**

React components re-render only when their specific data changes

**🔄 Offline-First**

Local changes automatically merge when reconnected

</td>
<td width="50%" style="padding: 20px; vertical-align: top;">

**⚡ Production-Ready**

Validation, rollback, comprehensive tests, and benchmarks

**🎨 Type-Safe**

Full TypeScript support with complete type inference

**🌐 Provider-Agnostic**

Works with any Yjs provider (WebSocket, WebRTC, IndexedDB)

</td>
</tr>
</table>

---

## 📚 Guides

Core documentation for understanding and using valtio-y effectively:

- **[Core Concepts](./guides/concepts.md)** - Understand CRDTs and the valtio-y mental model
- **[Basic Operations](./guides/basic-operations.md)** - Objects, arrays, and nested structures
- **[Undo/Redo](./guides/undo-redo.md)** - Implement undo/redo with Yjs UndoManager
- **[Performance Guide](./guides/performance-guide.md)** - Batching, bulk operations, and optimization

---

## Collaboration Setup

Connect multiple clients with any Yjs provider:

```js
import { WebsocketProvider } from "y-websocket";

const ydoc = new Y.Doc();
const provider = new WebsocketProvider("ws://localhost:1234", "my-room", ydoc);

const { proxy: state } = createYjsProxy(ydoc, {
  getRoot: (doc) => doc.getMap("state"),
});

// Now all clients in "my-room" share the same state!
state.message = "Hello from client 1";
```

**Supported providers:**

- [y-websocket](https://github.com/yjs/y-websocket) - WebSocket sync
- [y-partyserver](https://github.com/partykit/partykit/tree/main/packages/y-partyserver) - PartyKit/Cloudflare Durable Objects backend
- [y-webrtc](https://github.com/yjs/y-webrtc) - P2P WebRTC sync
- [y-indexeddb](https://github.com/yjs/y-indexeddb) - Offline persistence
- Any Yjs provider

---

## Recipes

### Initializing state with network sync

When using network providers, initialize state after the first sync to avoid overwriting remote data:

```js
import { WebsocketProvider } from "y-websocket";

const ydoc = new Y.Doc();
const provider = new WebsocketProvider("ws://localhost:1234", "room", ydoc);

const { proxy: state, bootstrap } = createYjsProxy(ydoc, {
  getRoot: (doc) => doc.getMap("state"),
});

// Wait for sync, then safely initialize if empty
provider.on("synced", () => {
  bootstrap({
    todos: [],
    settings: { theme: "light" },
  });
  // ✅ Only writes if document is empty
});
```

For local-first apps without network sync, direct assignment works fine:

```js
// Just assign directly
if (!state.todos) {
  state.todos = [];
}
```

### Array operations

All standard JavaScript array methods work:

```js
// Add/remove items
state.items.push(newItem);
state.items.pop();
state.items.unshift(firstItem);
state.items.shift();

// Modify by index
state.items[0] = updatedItem;
delete state.items[2]; // Removes element (no sparse arrays)

// Splice for complex operations (recommended for resizing)
state.items.splice(1, 2, replacement1, replacement2);
state.items.splice(0); // Clear array (instead of: arr.length = 0)
state.items.splice(5); // Truncate to 5 items (instead of: arr.length = 5)

// Moving items
const [item] = state.items.splice(2, 1); // Remove from index 2
state.items.splice(0, 0, item); // Insert at index 0
```

### Object operations

```js
// Set properties
state.user.name = "Alice";
state.settings = { theme: "dark", fontSize: 14 };

// Delete properties
delete state.user.temporaryFlag;

// Nested updates
state.data.deeply.nested.value = 42;

// Replace entire nested object
state.user.preferences = { ...newPreferences };
```

### Accessing state outside React

```js
// Read current state (non-reactive)
const currentCount = state.count;

// Mutate from anywhere
state.count++;

// In event handlers, timers, etc.
setTimeout(() => {
  state.message = "Updated from timer";
}, 1000);
```

### Undo/Redo

Use Yjs's UndoManager:

```js
import { UndoManager } from "yjs";

const ydoc = new Y.Doc();
const { proxy: state } = createYjsProxy(ydoc, {
  getRoot: (doc) => doc.getMap("state"),
});

const undoManager = new UndoManager(ydoc.getMap("state"));

// Perform some actions
state.count = 1;
state.count = 2;

// Undo/redo
undoManager.undo(); // state.count is now 1
undoManager.redo(); // state.count is now 2
```

---

## Performance

valtio-y is fast out of the box with automatic optimizations:

### Automatic Batching

Multiple mutations in the same tick are automatically batched:

```js
// These 100 operations become 1 network update
for (let i = 0; i < 100; i++) {
  state.count++;
}
// ✅ Single Yjs transaction, one sync event
```

### Bulk Operations

Large array operations are optimized automatically:

```js
// Optimized: spread syntax for bulk inserts
state.items.push(...Array(1000).fill({ data: "x" }));
state.items.unshift(...newItems);
```

### Lazy Materialization

Nested objects create proxies on-demand:

```js
state.users = Array(10000).fill({ name: "User", data: {...} });
// ✅ Fast initialization, proxies created when accessed
const user = state.users[0]; // Materializes this user only
```

**Performance characteristics:**

| Operation                   | Time     | Notes                      |
| --------------------------- | -------- | -------------------------- |
| Small updates (1-10 items)  | ~1-3ms   | Typical UI interactions    |
| Bulk operations (100 items) | ~3-8ms   | Automatically optimized    |
| Large arrays (1000 items)   | ~15-30ms | Bootstrap/import scenarios |
| Deep nesting (10+ levels)   | ~2-4ms   | Lazy materialization helps |

---

## Limitations

### Not Supported

- ❌ **`undefined` values** (use `null` or delete the key)
- ❌ **Non-serializable types** (functions, symbols, class instances)
- ❌ **Direct length manipulation** (use `array.splice()` instead of `array.length = N`)

### What Works

- ✅ **Objects & Arrays** - Full support with deep nesting
- ✅ **Primitives** - string, number, boolean, null
- ✅ **All array methods** - push, pop, splice, etc.
- ✅ **Undo/Redo** - via Yjs UndoManager

### Research In Progress

**Important:** valtio-y is designed for **shared application state** (collaborative data structures like objects, arrays, and primitives), not for building text editors.

**If you're building a text editor:** Use the native Yjs integration for your editor:

- [Lexical](https://lexical.dev/) → Use `@lexical/yjs`
- [TipTap](https://tiptap.dev/) → Use their built-in Yjs extension
- [ProseMirror](https://prosemirror.net/) → Use `y-prosemirror`

These editors have specialized Yjs integrations optimized for their specific use cases.

**Y.Text integration research:**

We are actively researching how to best integrate collaborative text editing (Y.Text) and XML types with Valtio's reactive system for non-editor use cases. valtio-y has a different application profile from text editors, and most use cases won't need Y.Text integration at all.

**Current status:**

- Core types (Y.Map, Y.Array, primitives) are production-ready with clean, well-tested implementations
- Leaf types (Y.Text, XML) integration is being researched in the `research/ytext-integration` branch
- For typical valtio-y use cases, plain strings work perfectly for text fields

**Have a use case for Y.Text in shared state?** We'd love to learn more! Please [open an issue](https://github.com/valtiojs/valtio-y/issues) to discuss your requirements.

---

## Best Practices

**Do:**

- ✅ Batch related updates in the same tick (automatically optimized into one transaction)
- ✅ Use bulk array operations (`push(...items)`) for better performance
- ✅ Initialize with `bootstrap()` when using network sync providers
- ✅ Use plain strings for all text fields
- ✅ Cache references to deeply nested objects in loops

**Don't:**

- ❌ Use `undefined` (use `null` or delete the property instead)
- ❌ Store functions or class instances (not serializable)
- ❌ Use `await` between mutations if you want them batched together
- ❌ Repeatedly access deep paths in loops (cache the reference first)

### Advanced: Concurrent List Reordering

For most apps, standard array operations work perfectly. For **high-frequency concurrent reordering** in collaborative lists (e.g., drag-and-drop task boards with multiple simultaneous users), consider fractional indexing:

```js
// Standard approach (works for most cases)
const [task] = tasks.splice(from, 1);
tasks.splice(to, 0, task);

// Fractional indexing with strings (recommended for advanced cases)
// Use libraries like fractional-indexing or lexicographic-fractional-indexing
import { generateKeyBetween } from "fractional-indexing";

type Task = { order: string, title: string };
tasks[i].order = generateKeyBetween(
  tasks[i - 1]?.order ?? null,
  tasks[i + 1]?.order ?? null
);
const sorted = [...tasks].sort((a, b) => a.order.localeCompare(b.order));

// Number-based approach (simpler but doesn't scale well)
// Avoid for production - floating-point precision limits reordering depth
type Task = { order: number, title: string };
tasks[i].order = (tasks[i - 1].order + tasks[i + 1].order) / 2;
```

**When to use fractional indexing:** Large lists (>100 items) with multiple users frequently reordering
**When NOT needed:** Single-user apps, small lists, or append-only scenarios
**Why strings over numbers:** String-based fractional indexing scales infinitely without precision issues, while number-based approaches run into floating-point limits after repeated reordering.

For more details, see the [architecture docs](./docs/architecture/)

---

## 🎮 Examples

Try these live collaborative demos showcasing valtio-y's sweet spot: **collaborative structured data** (task boards, game state, shared objects). Open each example in multiple browser tabs to see real-time sync in action!

### 🎓 Learning Path

**Start here** if you're new to valtio-y:

#### 1. [Simple Todos](https://stackblitz.com/github/valtiojs/valtio-y/tree/main/examples/05_todos_simple) 🌟 **Best for Learning**

Single-file example with detailed comments. Learn core concepts including CRUD operations, nested todos, reordering, and offline/online simulation.

**What you'll learn:** Basic setup, array operations, nested objects, state mutations

---

#### 2. [Object Sync](https://stackblitz.com/github/valtiojs/valtio-y/tree/main/examples/01_obj)

Minimal object synchronization with WebSocket provider. See how key-value pairs sync in real-time.

**What you'll learn:** WebSocket provider setup, basic object mutations

---

#### 3. [Array Sync](https://stackblitz.com/github/valtiojs/valtio-y/tree/main/examples/02_array)

Demonstrates array operations (push, pop, splice) with WebSocket sync.

**What you'll learn:** Array manipulation, list operations

---

### 🚀 Advanced Examples

#### 4. [Full-Featured Todo App](https://stackblitz.com/github/valtiojs/valtio-y/tree/main/examples/04_todos)

Production-ready todo app with drag-and-drop, bulk operations, filtering, and selection modes.

**What you'll learn:** Advanced UI patterns, @dnd-kit integration, bulk operations, complex state management

**Tech:** React, Tailwind CSS, dnd-kit, lucide-react

---

#### 5. [Minecraft Clone](https://stackblitz.com/github/valtiojs/valtio-y/tree/main/examples/03_minecraft) 🎮 **Most Impressive**

Real-time multiplayer 3D game with WebRTC peer-to-peer sync. Move around a voxel world with other players!

**What you'll learn:** High-frequency position updates, WebRTC P2P, multiplayer coordination, performance optimization

**Tech:** Three.js, WebRTC (y-webrtc)

---

All examples use `useSnapshot` from Valtio and work with any Yjs provider. Each example includes full source code you can explore and modify.

---

**Feedback and contributions welcome!** If you find bugs or have suggestions, please [open an issue](https://github.com/valtiojs/valtio-y/issues).

For detailed technical documentation, see:

- [Architecture](./docs/architecture/architecture.md)
- [Limitations](./docs/architecture/limitations.md)
- [Data Flow](./docs/architecture/data-flow.md)
