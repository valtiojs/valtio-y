# Simple Todos Example

A simplified collaborative todo list demonstrating the core features of valtio-yjs in a single, easy-to-understand file.

## What You'll Learn

This example showcases:

- ✅ **CRUD Operations**: Create, edit, delete, and mark todos as complete
- 📝 **Direct Mutations**: Simply mutate the proxy like a regular JavaScript object
- 🔄 **Real-time Sync**: Changes automatically sync between clients via Yjs
- 🪆 **Nested Structures**: One level of subtasks to demonstrate nested data
- ↕️ **Reordering**: Move todos up/down with simple buttons
- 🔴 **Offline/Online Support**: Simulate network disconnections and watch changes sync when reconnected
- ⚛️ **React Integration**: Use `useSnapshot()` to read reactive state

## Key Features

### Single File Architecture

Everything is in `src/app.tsx` for easy learning:
- Type definitions
- Yjs document setup
- Network simulation
- React components
- All application logic

### Simple Operations

```tsx
// Add a todo
stateProxy.todos.push({
  id: generateId(),
  text: 'New todo',
  completed: false,
});

// Edit a todo
todo.text = 'Updated text';

// Toggle completion
todo.completed = !todo.completed;

// Delete a todo
todos.splice(index, 1);

// Add a subtask
todo.children.push(newSubtask);

// Reorder todos
const [item] = todos.splice(index, 1);
todos.splice(newIndex, 0, item);
```

### Automatic Synchronization

The example sets up two clients that sync in real-time. Try:
1. Add a todo in Client 1 → See it appear in Client 2
2. Edit simultaneously in both → Watch conflict-free merging
3. Reorder or delete → Changes propagate instantly
4. Toggle a client offline → Make changes → Bring it back online and watch them sync
5. Edit the same todo in both clients while one is offline → See CRDT conflict resolution when reconnected

## Running the Example

```bash
# Install dependencies (from the workspace root)
pnpm install

# Start the dev server
cd examples/05_todos_simple
pnpm dev
```

## Comparison with Complex Example

This simplified version differs from `04_todos`:
- **Single file** instead of multiple components
- **Buttons for reordering** instead of drag-and-drop
- **One level of nesting** instead of unlimited depth
- **Offline/online toggle** to demonstrate sync behavior
- **No advanced features** like selection mode or bulk operations
- **Focused on learning** the core valtio-yjs concepts

For more advanced features (drag-and-drop, deep nesting, bulk operations), see the `04_todos` example.

## Next Steps

After understanding this example, you can:
1. Add more complex nested structures
2. Implement drag-and-drop with `@dnd-kit`
3. Add persistence with IndexedDB
4. Connect to a real network provider (`y-websocket`, `y-webrtc`)
5. Add features like filtering, sorting, or search

## Key Concepts

### valtio-yjs Proxy

The proxy bridges Valtio's reactive state with Yjs CRDTs:

```tsx
const { proxy } = createYjsProxy<AppState>(doc, {
  getRoot: (doc) => doc.getMap('sharedState'),
});
```

### Reading State

Use `useSnapshot()` to get reactive values:

```tsx
const snap = useSnapshot(stateProxy);
// snap is read-only and triggers re-renders when changed
```

### Writing State

Mutate the proxy directly:

```tsx
// This works and syncs automatically!
stateProxy.todos.push(newTodo);
todo.text = 'Updated';
todo.completed = true;
```

### Yjs Synchronization

Updates are automatically converted to Yjs operations and synced:

```tsx
doc1.on('update', (update) => {
  // Apply to other clients
  Y.applyUpdate(doc2, update);
});
```

In a real app, replace the manual relay with a network provider like `y-websocket`.

