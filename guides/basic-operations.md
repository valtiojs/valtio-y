# Basic Operations Guide

A practical guide to working with valtio-y state. This covers the most common operations you'll use in real applications.

---

## Table of Contents

1. [Object Operations](#object-operations)
2. [Array Operations](#array-operations)
3. [Nested Structures](#nested-structures)
4. [Working with Primitives](#working-with-primitives)
5. [Common Patterns](#common-patterns)

---

## Object Operations

```typescript
// Set properties
state.user = { name: "Alice", age: 30 };
state.count = 42;

// Update properties
state.user.name = "Bob";
state.user.age = 31;

// Nested objects
state.app = {
  ui: {
    sidebar: { collapsed: false, width: 240 },
  },
};
state.app.ui.sidebar.collapsed = true;

// Delete properties
delete state.user.temporaryFlag;
// Or use null to preserve key
state.user.avatar = null;

// Replace entire object
state.user.preferences = {
  theme: "light",
  notifications: true,
};

// Merge pattern
state.settings = { ...state.settings, newOption: true };
```

---

## Array Operations

```typescript
// Add items
state.todos.push({ text: "New task", done: false });
state.todos.push({ text: "Task 1" }, { text: "Task 2" }); // Multiple
state.todos.unshift({ text: "First task" }); // Add to beginning
state.todos.splice(2, 0, { text: "Inserted" }); // Insert at index

// Remove items
state.todos.pop(); // Remove from end
state.todos.shift(); // Remove from beginning
state.todos.splice(1, 1); // Remove at index 1
state.todos.splice(0); // Clears the array

// Update by index
state.todos[0] = { text: "Updated", done: true };
state.todos[0].text = "New text";
delete state.todos[2]; // Delete item (no sparse arrays)

// Move items
const [item] = state.todos.splice(2, 1);
state.todos.splice(0, 0, item);

// Not supported patterns
state.items.length = 0; // Don't manipulate length directly
state.items[10] = "value"; // Don't create sparse arrays
```

---

## Nested Structures

```typescript
// Nested objects in arrays
state.users = [
  {
    id: 1,
    name: "Alice",
    profile: {
      bio: "Developer",
      settings: { notifications: true },
    },
  },
];
state.users[0].profile.settings.notifications = false;

// Arrays of arrays
state.grid = [
  [1, 2, 3],
  [4, 5, 6],
];
state.grid[0][1] = 99;
```

**Lazy materialization:** Proxies are created on-demand when you access nested structures. This makes large datasets fast to initialize.

**Performance tip for loops:**

```typescript
// Repeated property lookups (avoid)
for (let i = 0; i < 100; i++) {
  state.data.items[i].nested.value = i;
}

// Cache the reference
const items = state.data.items;
for (let i = 0; i < 100; i++) {
  items[i].nested.value = i;
}
```

This reduces property traversal overhead. See [Performance Guide](./performance-guide.md) for details.

---

## Working with Primitives

### Supported Types

```typescript
// Strings
state.name = "Alice";
state.description = "";

// Numbers
state.count = 42;
state.price = 9.99;
state.total = 0;

// Booleans
state.isActive = true;
state.isDone = false;

// Null
state.optional = null;

// Undefined is not supported
state.value = undefined; // Don't do this

// Use null instead
state.value = null;
```

### Why undefined Doesn't Work

```typescript
// This will not sync
state.user.middleName = undefined;

// Use null or delete the property
state.user.middleName = null;
// or
delete state.user.middleName;
```

The Yjs CRDT protocol doesn't support `undefined` values, so valtio-y can't sync them. Use `null` for optional values or delete the property entirely.

---

## Common Patterns

### Basic Operations

```typescript
// Toggle booleans
state.isOpen = !state.isOpen;
state.todos[0].done = !state.todos[0].done;

// Increment/decrement
state.count++;
state.score += 10;

// Filter arrays
state.todos = state.todos.filter((todo) => !todo.done);

// Bulk updates (automatically batched)
function addTodo(text: string) {
  state.todos.push({ id: generateId(), text, done: false });
  state.lastModified = Date.now();
  state.totalCount++;
} // All three mutations run within one transaction
```

### Replacing vs Updating Objects

```typescript
// Avoid multiple individual updates
state.user.name = "Alice";
state.user.age = 30;
state.user.email = "alice@example.com";

// Replace the entire object
state.user = {
  name: "Alice",
  age: 30,
  email: "alice@example.com",
  role: "admin",
};

// Merge with the existing object
state.user = { ...state.user, name: "Alice", age: 30 };
```

### Safe Deep Access

```typescript
// Use optional chaining in reads
const snap = useSnapshot(state);
const userName = snap.user?.profile?.name ?? "Guest";

// Initialize the parent before assigning
if (!state.user) state.user = { profile: {} };
state.user.profile.bio = "Developer";
```

### Array Reordering

```typescript
// Standard splice (works for most apps)
function moveItem(from: number, to: number) {
  const [item] = state.tasks.splice(from, 1);
  state.tasks.splice(to, 0, item);
}
```

**For high-frequency concurrent reordering** (e.g., collaborative Kanban): Use fractional indexing libraries like `fractional-indexing` with string-based order fields. See [Performance Guide](./performance-guide.md) for details.

---

## Next Steps

**For more advanced patterns:**

- [Undo/Redo Guide](./undo-redo.md) - Time travel with Yjs UndoManager
- [Performance Guide](./performance-guide.md) - Batching and optimization
- [Core Concepts](./concepts.md) - Deep dive into CRDTs and the mental model

**See it in action:**

- [Simple Example](../examples/simple) - Basic patterns with objects, arrays, and primitives
- [Todos App](../examples/todos) - Advanced UI patterns with routing and RoomState
