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

### Setting Properties

```typescript
// Simple assignment
state.user = { name: "Alice", age: 30 };
state.count = 42;
state.message = "Hello";

// Update existing properties
state.user.name = "Bob";
state.user.age = 31;

// Add new properties dynamically
state.settings = { theme: "dark" };
state.settings.fontSize = 14;
state.settings.autoSave = true;
```

### Nested Objects

```typescript
// Deep nesting works naturally
state.app = {
  ui: {
    sidebar: {
      collapsed: false,
      width: 240,
    },
  },
};

// Update nested values
state.app.ui.sidebar.collapsed = true;
state.app.ui.sidebar.width = 200;
```

### Deleting Properties

```typescript
// Use delete operator
delete state.user.temporaryFlag;
delete state.settings.deprecated;

// Or set to null if you need to preserve the key
state.user.avatar = null;
```

### Replacing Entire Objects

```typescript
// Replace entire nested object
state.user.preferences = {
  theme: "light",
  notifications: true,
  language: "en",
};

// Merge pattern using spread
state.settings = {
  ...state.settings,
  newOption: true,
};
```

---

## Array Operations

### Adding Items

```typescript
// Add to end
state.todos.push({ text: "New task", done: false });

// Add multiple items
state.todos.push(
  { text: "Task 1", done: false },
  { text: "Task 2", done: false }
);

// Add to beginning
state.todos.unshift({ text: "First task", done: false });

// Insert at specific index using splice
state.todos.splice(2, 0, { text: "Inserted", done: false });
```

### Removing Items

```typescript
// Remove from end
state.todos.pop();

// Remove from beginning
state.todos.shift();

// Remove at specific index
state.todos.splice(1, 1); // Remove 1 item at index 1

// Remove multiple items
state.todos.splice(2, 3); // Remove 3 items starting at index 2

// ✅ Clear array (recommended)
state.todos.splice(0);

// ❌ Don't use direct length manipulation
state.todos.length = 0; // Doesn't work with valtio-y
```

### Updating by Index

```typescript
// Update entire item
state.todos[0] = { text: "Updated", done: true };

// Update properties of item
state.todos[0].text = "New text";
state.todos[0].done = !state.todos[0].done;

// Delete item (creates no sparse arrays - items shift up)
delete state.todos[2];
```

### Moving Items

```typescript
// Move item from index 2 to index 0
const [item] = state.todos.splice(2, 1); // Remove from index 2
state.todos.splice(0, 0, item); // Insert at index 0

// Move item down (from index 1 to index 2)
const [movedItem] = state.todos.splice(1, 1);
state.todos.splice(2, 0, movedItem);
```

### What Doesn't Work

```typescript
// ❌ Direct length manipulation
state.items.length = 5; // Doesn't sync properly

// ✅ Use splice instead
state.items.splice(5); // Truncate to 5 items
state.items.splice(0); // Clear array

// ❌ Sparse arrays
state.items[10] = "value"; // When array length is 3

// ✅ Use push or splice
state.items.push("value");
```

---

## Nested Structures

### Deep Nesting Patterns

```typescript
// Nested objects in arrays
state.users = [
  {
    id: 1,
    name: "Alice",
    profile: {
      bio: "Developer",
      settings: {
        notifications: true,
      },
    },
  },
];

// Access and modify deeply nested values
state.users[0].profile.settings.notifications = false;

// Arrays of arrays
state.grid = [
  [1, 2, 3],
  [4, 5, 6],
];
state.grid[0][1] = 99;
```

### Lazy Proxy Materialization

Proxies are created on-demand when you access nested structures:

```typescript
// Large dataset initialization
state.users = Array(10000).fill({ name: "User", data: {...} });
// ✅ Fast - proxies not created yet

// First access materializes the proxy
const user = state.users[0];
// ✅ Only this user's proxy is created

// Access in loop
for (let i = 0; i < 100; i++) {
  // ⚠️ Less efficient - repeated property lookups
  state.data.items[i].nested.value = i;
}

// ✅ Better - cache the reference to reduce lookups
const items = state.data.items;
for (let i = 0; i < 100; i++) {
  items[i].nested.value = i;
}
```

**Note:** Proxies are automatically cached in WeakMaps after creation. Caching references reduces the number of property lookups (`state.data.items` → `items`), not proxy creation overhead.

### Performance Tips for Deep Structures

```typescript
// ⚠️ Less efficient: repeated property traversal
for (const item of items) {
  state.app.data.list.items[item.id].value = item.newValue;
}

// ✅ Better: cache the parent reference
const listItems = state.app.data.list.items;
for (const item of items) {
  listItems[item.id].value = item.newValue;
}
```

**Why this helps:** Reduces property traversal from 4 lookups (`state.app.data.list.items`) per iteration to just 1 lookup (`listItems`). The benefit comes from fewer property accesses, not from avoiding proxy creation (proxies are cached internally).

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

// ❌ Undefined is NOT supported
state.value = undefined; // Don't do this

// ✅ Use null instead
state.value = null;
```

### Why undefined Doesn't Work

```typescript
// ❌ This won't sync
state.user.middleName = undefined;

// ✅ Use null or delete the property
state.user.middleName = null;
// or
delete state.user.middleName;
```

The Yjs CRDT protocol doesn't support `undefined` values, so valtio-y can't sync them. Use `null` for optional values or delete the property entirely.

---

## Common Patterns

### Toggling Booleans

```typescript
// Simple toggle
state.isOpen = !state.isOpen;

// Toggle item property
state.todos[0].done = !state.todos[0].done;

// Toggle in event handler
<button onClick={() => (state.sidebar.collapsed = !state.sidebar.collapsed)}>
  Toggle
</button>;
```

### Incrementing Counters

```typescript
// Increment
state.count++;

// Decrement
state.count--;

// Add specific amount
state.score += 10;

// Multiple updates in same tick are batched
for (let i = 0; i < 100; i++) {
  state.count++;
}
// ✅ Becomes a single Yjs transaction
```

### Filtering Arrays

```typescript
// Remove completed todos
state.todos = state.todos.filter((todo) => !todo.done);

// Remove item by id
state.users = state.users.filter((user) => user.id !== deleteId);

// Remove null/undefined items
state.items = state.items.filter((item) => item != null);
```

### Mapping Over Data

```typescript
// Transform all items
state.todos = state.todos.map((todo) => ({
  ...todo,
  text: todo.text.trim(),
}));

// Update specific property across all items
state.todos = state.todos.map((todo) => ({
  ...todo,
  archived: true,
}));
```

### Bulk Updates

```typescript
// Multiple related changes (automatically batched)
function addTodo(text: string) {
  const todo = { id: generateId(), text, done: false };
  state.todos.push(todo);
  state.lastModified = Date.now();
  state.totalCount++;
  // ✅ All three mutations become one Yjs transaction
}

// Bulk array operations (more efficient than loops)
const newItems = Array(1000).fill({ data: "x" });
state.items.push(...newItems);
// ✅ Single optimized operation
```

### Conditional Updates

```typescript
// Initialize if not exists
if (!state.todos) {
  state.todos = [];
}

// Update only if condition met
if (state.count > 0) {
  state.count--;
}

// Conditional object assignment
if (!state.user) {
  state.user = { name: "Guest", role: "viewer" };
}
```

### Replacing vs Updating

```typescript
// ❌ Updating many properties individually
state.user.name = "Alice";
state.user.age = 30;
state.user.email = "alice@example.com";
state.user.role = "admin";
// Creates 4 separate mutations (though batched into 1 transaction)

// ✅ Better: replace the entire object
state.user = {
  name: "Alice",
  age: 30,
  email: "alice@example.com",
  role: "admin",
};
// Single mutation

// ✅ Merge pattern preserving existing fields
state.user = {
  ...state.user,
  name: "Alice",
  age: 30,
};
```

### Safe Deep Access

```typescript
// ✅ Optional chaining in reads (from snapshot)
const snap = useSnapshot(state);
const userName = snap.user?.profile?.name ?? "Guest";

// ✅ Initialize parent before assigning nested value
if (!state.user) {
  state.user = { profile: {} };
}
state.user.profile.bio = "Developer";

// ❌ Don't assign to undefined parent
state.user.profile.bio = "Developer"; // Error if user.profile doesn't exist
```

### Array Reordering Strategies

For most apps, standard splice is perfect:

```typescript
// Standard approach (works for most cases)
function moveItem(from: number, to: number) {
  const [item] = state.tasks.splice(from, 1);
  state.tasks.splice(to, 0, item);
}
```

For high-frequency concurrent reordering with multiple users (e.g., collaborative Kanban boards):

```typescript
// Fractional indexing (advanced use case)
// Use libraries like 'fractional-indexing' for string-based ordering
import { generateKeyBetween } from "fractional-indexing";

type Task = {
  id: string;
  title: string;
  order: string; // String-based fractional index (scales infinitely)
};

function moveTask(taskIndex: number, newPosition: number) {
  const prevOrder = state.tasks[newPosition - 1]?.order ?? null;
  const nextOrder = state.tasks[newPosition + 1]?.order ?? null;

  state.tasks[taskIndex].order = generateKeyBetween(prevOrder, nextOrder);
}

// Render sorted
const sortedTasks = [...state.tasks].sort((a, b) =>
  a.order.localeCompare(b.order)
);
```

**When to use fractional indexing:**

- Lists with >100 items AND multiple users frequently reordering
- Use **string-based** fractional indexing (scales infinitely)
- Number-based approaches hit floating-point precision limits
- Otherwise, standard splice works great

### Clearing vs Resetting

```typescript
// Clear array (keep reference)
state.todos.splice(0);

// Reset to new array (breaks existing references)
state.todos = [];

// Clear specific items
state.todos = state.todos.filter((todo) => !todo.done);

// Reset entire state branch
state.app = {
  todos: [],
  settings: { theme: "light" },
};
```

---

## Next Steps

**For more advanced patterns:**

- [Undo/Redo Guide](./undo-redo.md) - Time travel with Yjs UndoManager
- [Performance Guide](./performance-guide.md) - Batching and optimization
- [Core Concepts](./concepts.md) - Deep dive into CRDTs and the mental model

**See it in action:**

- [Simple Todos Example](../examples/05_todos_simple) - Basic patterns with comments
- [Full Todo App](../examples/04_todos) - Advanced UI patterns
