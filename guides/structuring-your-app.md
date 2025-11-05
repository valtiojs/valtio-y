# Structuring Your App

A guide to organizing your valtio-y application state for optimal developer experience and maintainability.

---

## Table of Contents

1. [Understanding `getRoot`](#understanding-getroot)
2. [The Two Main Patterns](#the-two-main-patterns)
3. [Server and Client Setup](#server-and-client-setup)
4. [Common Pitfalls](#common-pitfalls)
5. [Quick Reference](#quick-reference)

---

## Understanding `getRoot`

The `getRoot` function tells valtio-y which Yjs structure should become your Valtio proxy:

```typescript
const { proxy: state } = createYjsProxy(doc, {
  getRoot: (doc) => doc.getMap("root"),
});
```

Think of it like selecting a table from a database - all clients need to use the same "table name" to sync the same data.

**Key points:**

- Returns either a `Y.Map` or `Y.Array` from the document
- Creates the structure if it doesn't exist (lazy initialization)
- Acts as a sync contract - all clients using this name will sync together
- **The name is part of your application's schema** - everyone must agree on it

---

## The Two Main Patterns

### Pattern 1: One Root Map (Recommended)

Use a single root `Y.Map` to contain all your application state:

```typescript
type AppState = {
  todos: Array<{ id: number; title: string; completed: boolean }>;
  users: Array<{ id: number; name: string; avatar: string }>;
  settings: { theme: string; language: string };
};

const { proxy: state, bootstrap } = createYjsProxy<AppState>(doc, {
  getRoot: (doc) => doc.getMap("root"),
});

// Bootstrap entire app structure at once
bootstrap({
  todos: [{ id: 1, title: "Learn valtio-y", completed: false }],
  users: [{ id: 1, name: "Alice", avatar: "..." }],
  settings: {
    theme: "dark",
    language: "en",
  },
});

// Natural property access
state.todos.push({ id: 2, title: "Build something" });
state.settings.theme = "light";
state.users[0].name = "Alice Smith";
```

**Think of it like a Redux store** - one root object with everything nested inside.

#### Advantages

- Simple mental model - everything in one place
- One `bootstrap()` call for the entire app
- Natural property access (`state.todos`, `state.users`)
- Easy to reason about - mirrors typical app state structure
- Shared undo/redo manager for the entire state

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
  getRoot: (doc) => doc.getArray("todos"),
});

const { proxy: users } = createYjsProxy(doc, {
  getRoot: (doc) => doc.getMap("users"),
});

const { proxy: chat } = createYjsProxy(doc, {
  getRoot: (doc) => doc.getArray("chat"),
});

// Each proxy is independent
todos.push({ id: 1, text: "Buy milk" });
users.set("alice", { name: "Alice" });
chat.push({ user: "alice", message: "Hello!" });
```

#### Advantages

- Separate undo managers per root
- Different access control per section (custom provider logic)
- Lazy load different sections independently
- Independent lifecycle management per root

#### When to Use

- **Separate undo histories** - Canvas changes vs chat messages
- **Different access patterns** - Public data vs user preferences
- **Performance optimization** - Very large documents with lazy loading
- **Multi-document apps** - Each document is independent

---

## Server and Client Setup

The server doesn't need valtio-y - just a Y.Doc. Clients use providers to sync and wrap structures in proxies.

```typescript
// SHARED SCHEMA (use constants to avoid typos)
export const ROOT_NAME = "root";

// SERVER
import * as Y from "yjs";

const serverDoc = new Y.Doc();
const root = serverDoc.getMap(ROOT_NAME);

// Optional: Pre-populate
root.set("todos", new Y.Array());
root.get("todos").push([{ id: 1, title: "Welcome!" }]);

// CLIENT
import { WebsocketProvider } from "y-websocket";
import { createYjsProxy } from "valtio-y";

const clientDoc = new Y.Doc();
const provider = new WebsocketProvider("ws://server", "room", clientDoc);

const { proxy: state, bootstrap } = createYjsProxy(clientDoc, {
  getRoot: (doc) => doc.getMap(ROOT_NAME), // Must match the server configuration
});

provider.on("synced", () => {
  bootstrap({ todos: [], filter: "all" }); // No-op if data exists
  console.log(state.todos); // Shows server data
});
```

**Key points:**

- Providers sync the **entire Y.Doc** automatically
- `getRoot` is client-side only - tells valtio-y which structure to wrap
- Always wait for `synced` event before bootstrapping
- Use shared constants for root names to prevent mismatches

---

## Common Pitfalls

### Pitfall 1: Mismatched Root Names

```typescript
// SERVER
serverDoc.getMap("state");

// CLIENT
getRoot: (doc) => doc.getMap("root"); // Incorrect: clients won't sync
```

**Solution:** Use constants or shared schema definitions:

```typescript
// shared/schema.ts
export const APP_ROOT = "state";

// Use everywhere
getRoot: (doc) => doc.getMap(APP_ROOT);
```

### Pitfall 2: Type Mismatch

```typescript
// SERVER
serverDoc.getArray("todos");

// CLIENT
getRoot: (doc) => doc.getMap("todos"); // Type mismatch between Map and Array
```

**Solution:** Ensure Map/Array types match across server and client.

### Pitfall 3: Multiple Roots Without a Clear Reason

```typescript
// Unnecessary complexity
const { proxy: todos } = createYjsProxy(doc, {
  getRoot: (doc) => doc.getArray("todos"),
});
const { proxy: filter } = createYjsProxy(doc, {
  getRoot: (doc) => doc.getMap("filter"),
});

// Simpler approach - one root
const { proxy: state } = createYjsProxy(doc, {
  getRoot: (doc) => doc.getMap("root"),
});
state.todos = [];
state.filter = "all";
```

Only use multiple roots when you have specific reasons (separate undo, selective sync, etc.).

### Pitfall 4: Forgetting to Wait for Sync

```typescript
const { proxy: state, bootstrap } = createYjsProxy(doc, {
  getRoot: (doc) => doc.getMap("root"),
});

// Do not bootstrap immediately
bootstrap({ todos: [] }); // Might overwrite server data

// Wait for provider to report sync
provider.on("synced", () => {
  bootstrap({ todos: [] }); // Safe - only writes if empty
});
```

---

## Quick Reference

**Default to Pattern 1 (one root Map)** - works for 95% of apps. Only use multiple roots when you need separate undo histories, different lifecycles, or lazy loading.

**Best practices:**

- Use shared constants for root names (prevents typos)
- Match server/client structure exactly (same names and Y.Map/Y.Array types)
- Always wait for `synced` event before calling `bootstrap()`
- Keep it simple - one root is easier to reason about

**Next steps:**

- [Basic Operations](./basic-operations.md) - CRUD patterns
- [Core Concepts](./concepts.md) - Understanding CRDTs
- [Performance Guide](./performance-guide.md) - Optimization strategies
- [Examples](../examples/) - Real-world implementations
