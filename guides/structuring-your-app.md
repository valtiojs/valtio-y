# Structuring Your App

A guide to organizing your valtio-y application state for optimal developer experience and maintainability.

---

## Table of Contents

1. [Understanding `getRoot`](#understanding-getroot)
2. [The Two Main Patterns](#the-two-main-patterns)
3. [When to Use Each Pattern](#when-to-use-each-pattern)
4. [How Yjs Sync Works](#how-yjs-sync-works)
5. [Server and Client Setup](#server-and-client-setup)
6. [Common Pitfalls](#common-pitfalls)
7. [Migration and Versioning](#migration-and-versioning)

---

## Understanding `getRoot`

The `getRoot` function is your way of telling valtio-y: **"Which Yjs structure should become my Valtio proxy?"**

```typescript
const { proxy: state } = createYjsProxy(doc, {
  getRoot: (doc) => doc.getMap("root")
});
```

Think of it like selecting a table from a database - all clients need to use the same "table name" to sync the same data.

### What `getRoot` Does

1. **Selects a Yjs structure** - Returns either a `Y.Map` or `Y.Array` from the document
2. **Creates the structure if it doesn't exist** - Yjs's `getMap()` and `getArray()` are lazy initializers
3. **Acts as a sync contract** - All clients using this name will sync together

### Key Insight

**The `getRoot` name is part of your application's schema.** Just like database tables, all parts of your system need to agree on the names.

---

## The Two Main Patterns

### Pattern 1: One Root Map (Recommended)

Use a single root `Y.Map` to contain all your application state:

```typescript
const { proxy: state, bootstrap } = createYjsProxy(doc, {
  getRoot: (doc) => doc.getMap("root")
});

// Bootstrap entire app structure at once
bootstrap({
  todos: [
    { id: 1, title: "Learn valtio-y", completed: false }
  ],
  users: [
    { id: 1, name: "Alice", avatar: "..." }
  ],
  settings: {
    theme: "dark",
    language: "en"
  }
});

// Natural property access
state.todos.push({ id: 2, title: "Build something" });
state.settings.theme = "light";
state.users[0].name = "Alice Smith";
```

**Think of it like a Redux store** - one root object with everything nested inside.

#### Advantages

- ✅ Simple mental model - everything in one place
- ✅ One `bootstrap()` call for entire app
- ✅ Natural property access (`state.todos`, `state.users`)
- ✅ Easy to reason about - mirrors typical app state structure
- ✅ Shared undo/redo manager for entire state

#### When to Use

- **Most applications** - This should be your default choice
- Building a typical CRUD app
- Todo lists, dashboards, form builders
- Games with unified state
- Apps where everything should undo together

### Pattern 2: Multiple Roots (Advanced)

Create separate proxies for different parts of your application:

```typescript
// Separate roots for different concerns
const { proxy: todos } = createYjsProxy(doc, {
  getRoot: (doc) => doc.getArray("todos")
});

const { proxy: users } = createYjsProxy(doc, {
  getRoot: (doc) => doc.getMap("users")
});

const { proxy: chat } = createYjsProxy(doc, {
  getRoot: (doc) => doc.getArray("chat")
});

// Each proxy is independent
todos.push({ id: 1, text: "Buy milk" });
users.set("alice", { name: "Alice" });
chat.push({ user: "alice", message: "Hello!" });
```

#### Advantages

- ✅ Separate undo managers per root
- ✅ Selective sync (could sync some roots but not others)
- ✅ Different access control per section
- ✅ Lazy load different sections independently

#### When to Use

- **Separate undo histories** - Canvas changes vs chat messages
- **Different access patterns** - Public data vs user preferences
- **Performance optimization** - Very large documents with lazy loading
- **Multi-document apps** - Each document is independent

---

## When to Use Each Pattern

### Use Pattern 1 (One Root Map) When:

✅ **Building a standard application**
```typescript
const { proxy: state } = createYjsProxy(doc, {
  getRoot: (doc) => doc.getMap("root")
});

state.todos = [];
state.users = [];
// Everything in one cohesive structure
```

✅ **You want simple DX**
- Intuitive: `state.todos.push(...)`
- One bootstrap call
- Matches Redux/Zustand patterns

✅ **Unified undo/redo**
```typescript
const undoManager = new UndoManager(doc.getMap("root"));
// Undoes changes across entire app state
```

### Use Pattern 2 (Multiple Roots) When:

⚠️ **Need independent undo managers**
```typescript
const { proxy: canvas } = createYjsProxy(doc, {
  getRoot: (doc) => doc.getMap("canvas")
});
const { proxy: chat } = createYjsProxy(doc, {
  getRoot: (doc) => doc.getArray("chat")
});

// Separate undo managers
const canvasUndo = new UndoManager(doc.getMap("canvas"));
const chatUndo = new UndoManager(doc.getArray("chat"));

// Undo canvas changes without affecting chat
canvasUndo.undo();
```

⚠️ **Different sections have different lifecycles**
```typescript
// Game state syncs constantly
const { proxy: gameState } = createYjsProxy(doc, {
  getRoot: (doc) => doc.getMap("gameState")
});

// Chat history persists even when game resets
const { proxy: chat } = createYjsProxy(doc, {
  getRoot: (doc) => doc.getArray("chat")
});
```

⚠️ **Very large documents (>10MB)**
```typescript
// Load different sections on demand
const { proxy: metadata } = createYjsProxy(doc, {
  getRoot: (doc) => doc.getMap("metadata")
});
// Don't load full data until needed
```

---

## How Yjs Sync Works

Understanding how sync works helps clarify why root names matter:

### The Y.Doc is a Container

```
Y.Doc
├── "root" (Y.Map) ─┐
├── "todos" (Y.Array) ┼─ All these sync together
├── "users" (Y.Map) ─┤    in the same "room"
└── "chat" (Y.Array) ┘
```

### Providers Sync the Entire Document

```typescript
// SERVER (could be just this!)
const serverDoc = new Y.Doc();
// Provider handles syncing the entire doc

// CLIENT
const clientDoc = new Y.Doc();
const provider = new WebsocketProvider('ws://server', 'room', clientDoc);

// Choose which structures to wrap in proxies
const { proxy: state } = createYjsProxy(clientDoc, {
  getRoot: (doc) => doc.getMap("root")
});
```

**Key points:**

1. **WebSocket/WebRTC providers sync the ENTIRE Y.Doc**
2. **`getRoot` is client-side only** - tells valtio-y which structure to wrap
3. **Different clients can access different structures** from the same doc
4. **All structures in the doc sync automatically**

### Example: Different Clients, Same Doc

```typescript
// CLIENT A - Only cares about todos
const { proxy: todos } = createYjsProxy(docA, {
  getRoot: (doc) => doc.getArray("todos")
});

// CLIENT B - Only cares about users
const { proxy: users } = createYjsProxy(docB, {
  getRoot: (doc) => doc.getMap("users")
});

// Both structures still sync!
// CLIENT A could manually access docA.getMap("users") if needed
```

---

## Server and Client Setup

### Simple Server Setup

The server doesn't need valtio-y - just the Y.Doc:

```typescript
// SERVER (Node.js)
import * as Y from 'yjs';

const serverDoc = new Y.Doc();

// Optional: Pre-populate data
const root = serverDoc.getMap("root");
root.set("todos", new Y.Array());
root.get("todos").push([
  { id: 1, title: "Welcome!", completed: false }
]);

// Provider handles syncing (y-websocket, y-partyserver, etc.)
```

### Client Setup - Match Server Structure

```typescript
// CLIENT
import { WebsocketProvider } from 'y-websocket';
import { createYjsProxy } from 'valtio-y';

const clientDoc = new Y.Doc();
const provider = new WebsocketProvider('ws://localhost:1234', 'room', clientDoc);

const { proxy: state, bootstrap } = createYjsProxy(clientDoc, {
  getRoot: (doc) => doc.getMap("root") // ⚠️ Must match server!
});

// Wait for sync before initializing
provider.on('synced', () => {
  // Bootstrap is a no-op if data exists
  bootstrap({
    todos: [],
    users: [],
    settings: {}
  });

  console.log(state.todos); // Shows server data if it exists
});
```

### Example: Todo App Structure

#### Recommended Structure

```typescript
// SHARED: Both server and client use this
const ROOT_NAME = "root"; // Single source of truth for root name

// SERVER
const serverDoc = new Y.Doc();
const root = serverDoc.getMap(ROOT_NAME);

// Structure your data
root.set("todos", new Y.Array());
root.set("filter", "all");
root.set("user", new Y.Map());

// CLIENT
const { proxy: state } = createYjsProxy(clientDoc, {
  getRoot: (doc) => doc.getMap(ROOT_NAME)
});

provider.on('synced', () => {
  bootstrap({
    todos: [],
    filter: "all",
    user: null
  });

  // Use naturally
  state.todos.push({ id: 1, text: "Learn valtio-y" });
  state.filter = "completed";
});
```

---

## Common Pitfalls

### ❌ Pitfall 1: Mismatched Root Names

```typescript
// SERVER
serverDoc.getMap("state");

// CLIENT
getRoot: (doc) => doc.getMap("root") // ❌ Wrong! Won't sync!
```

**Solution:** Use constants or shared schema definitions:

```typescript
// shared/schema.ts
export const APP_ROOT = "state";

// Use everywhere
getRoot: (doc) => doc.getMap(APP_ROOT)
```

### ❌ Pitfall 2: Type Mismatch

```typescript
// SERVER
serverDoc.getArray("todos");

// CLIENT
getRoot: (doc) => doc.getMap("todos") // ❌ Type mismatch!
```

**Solution:** Ensure Map/Array types match across server and client.

### ❌ Pitfall 3: Multiple Roots Without Reason

```typescript
// ❌ Unnecessary complexity
const { proxy: todos } = createYjsProxy(doc, {
  getRoot: (doc) => doc.getArray("todos")
});
const { proxy: filter } = createYjsProxy(doc, {
  getRoot: (doc) => doc.getMap("filter")
});

// ✅ Simpler - one root
const { proxy: state } = createYjsProxy(doc, {
  getRoot: (doc) => doc.getMap("root")
});
state.todos = [];
state.filter = "all";
```

Only use multiple roots when you have specific reasons (separate undo, selective sync, etc.).

### ❌ Pitfall 4: Forgetting to Wait for Sync

```typescript
const { proxy: state, bootstrap } = createYjsProxy(doc, {
  getRoot: (doc) => doc.getMap("root")
});

// ❌ Don't bootstrap immediately!
bootstrap({ todos: [] }); // Might overwrite server data

// ✅ Wait for sync
provider.on('synced', () => {
  bootstrap({ todos: [] }); // Safe - only writes if empty
});
```

---

## Migration and Versioning

### Schema Versioning

Use versioned root names for migrations:

```typescript
// v1 schema
const { proxy: stateV1 } = createYjsProxy(doc, {
  getRoot: (doc) => doc.getMap("state.v1")
});

// v2 schema (after migration)
const { proxy: stateV2 } = createYjsProxy(doc, {
  getRoot: (doc) => doc.getMap("state.v2")
});

// Migration logic
provider.on('synced', () => {
  const oldState = doc.getMap("state.v1");
  if (oldState.size > 0) {
    // Migrate data from v1 to v2
    const newState = doc.getMap("state.v2");
    // ... migration logic
  }
});
```

### Namespace Strategy

For large applications, consider namespacing:

```typescript
// By feature
getRoot: (doc) => doc.getMap("feature:canvas")
getRoot: (doc) => doc.getMap("feature:chat")

// By environment
getRoot: (doc) => doc.getMap("prod:state")
getRoot: (doc) => doc.getMap("dev:state")

// By version
getRoot: (doc) => doc.getMap("app:v2:state")
```

---

## Summary

### Quick Decision Tree

```
Need real-time collaboration?
├─ Yes → Use valtio-y
│   │
│   └─ Is your app state mostly one cohesive structure?
│      ├─ Yes → Pattern 1: One root Map
│      │   const { proxy: state } = createYjsProxy(doc, {
│      │     getRoot: (doc) => doc.getMap("root")
│      │   });
│      │
│      └─ No → Do you need separate undo/selective sync?
│         ├─ Yes → Pattern 2: Multiple roots
│         │   const { proxy: canvas } = createYjsProxy(doc, {
│         │     getRoot: (doc) => doc.getMap("canvas")
│         │   });
│         │
│         └─ No → Probably still want Pattern 1
│
└─ No → Consider simpler solutions (REST, GraphQL)
```

### Best Practices

1. ✅ **Start with one root Map** - It's simpler and works for 95% of apps
2. ✅ **Use constants for root names** - Prevents typos and mismatches
3. ✅ **Match server and client structure** - Same names and types
4. ✅ **Wait for sync before bootstrap** - Prevents data loss
5. ✅ **Document your schema** - Make root structure clear to team

### When in Doubt

**Default to Pattern 1 (one root Map)** unless you have a specific reason for multiple roots.

---

## Next Steps

- **[Basic Operations](./basic-operations.md)** - Learn CRUD patterns
- **[Core Concepts](./concepts.md)** - Understand CRDTs and sync
- **[Performance Guide](./performance-guide.md)** - Optimize large-scale apps
- **[Examples](../examples/)** - See real-world implementations

**Questions?** [Open an issue](https://github.com/valtiojs/valtio-y/issues) or [join Discord](https://discord.gg/MrQdmzd)
