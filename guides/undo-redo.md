# Undo/Redo with valtio-y

Add undo/redo functionality to your collaborative app using Yjs's built-in `UndoManager`. This guide shows you how to integrate it with valtio-y in React applications.

## Basic Setup

The `UndoManager` tracks changes to Yjs types and lets you undo/redo them:

```typescript
import * as Y from "yjs";
import { UndoManager } from "yjs";
import { createYjsProxy } from "valtio-y";

type State = {
  count: number;
};

// Create your Yjs document and proxy
const ydoc = new Y.Doc();
const { proxy: state } = createYjsProxy<State>(ydoc, {
  getRoot: (doc) => doc.getMap("state"),
});

// Create an UndoManager for the root Map
const undoManager = new UndoManager(ydoc.getMap("state"));

// Make some changes
state.count = 1;
state.count = 2;
state.count = 3;

// Undo/redo
undoManager.undo(); // state.count -> 2
undoManager.redo(); // state.count -> 3
```

**Important:** Pass the **Yjs type** (like `Y.Map` or `Y.Array`) to `UndoManager`, not the Valtio proxy.

## Basic Usage

### Core Methods

```typescript
// Undo the last change
undoManager.undo();

// Redo the last undone change
undoManager.redo();

// Clear all undo/redo history
undoManager.clear();

// Check if undo/redo is available
const canUndo = undoManager.canUndo(); // boolean
const canRedo = undoManager.canRedo(); // boolean

// Get stack sizes
const undoSize = undoManager.undoStack.length;
const redoSize = undoManager.redoStack.length;
```

### Change Events

Listen for undo/redo operations:

```typescript
undoManager.on("stack-item-added", (event) => {
  console.log("Change added to undo stack:", event);
});

undoManager.on("stack-item-popped", (event) => {
  console.log("Change undone/redone:", event);
});

undoManager.on("stack-cleared", () => {
  console.log("Undo/redo history cleared");
});
```

## React Integration

In React, you can call undo/redo directly from event handlers:

```tsx
function TodoApp() {
  const snap = useSnapshot(state);

  return (
    <div>
      <button onClick={() => undoManager.undo()}>Undo</button>
      <button onClick={() => undoManager.redo()}>Redo</button>

      {/* Your app UI */}
    </div>
  );
}
```

**For reactive button states** (`canUndo`/`canRedo`), subscribe to UndoManager events in `useEffect` and update local state when the stacks change. See [Yjs UndoManager docs](https://docs.yjs.dev/api/undo-manager) for event details.

## Scoping Undo/Redo

Track only specific parts of your state by passing specific Yjs types:

```typescript
type State = {
  todos: Array<{ text: string; done: boolean }>;
  settings: { theme: string };
};

const ydoc = new Y.Doc();
const { proxy: state } = createYjsProxy<State>(ydoc, {
  getRoot: (doc) => doc.getMap("state"),
});

// Initialize nested structure
state.todos = [];
state.settings = { theme: "light" };

// Get the underlying Yjs types for scoping
const rootMap = ydoc.getMap("state");
const todosArray = rootMap.get("todos") as Y.Array<unknown>;

// Track only todos (not settings)
const todosUndoManager = new UndoManager(todosArray);

// Changes to todos are tracked
state.todos.push({ text: "Buy milk", done: false });
todosUndoManager.undo(); // Works!

// Changes to settings are NOT tracked
state.settings.theme = "dark";
todosUndoManager.undo(); // Does nothing - settings unchanged
```

**Multiple scopes:**

```typescript
// Track multiple types together
const undoManager = new UndoManager([todosArray, settingsMap]);
```

## Grouping Operations

Group multiple mutations into a single undo step using `stopCapturing()`:

```typescript
// Add three todos as separate undo steps
state.todos.push({ text: "Task 1", done: false });
state.todos.push({ text: "Task 2", done: false });
state.todos.push({ text: "Task 3", done: false });

undoManager.undo(); // Only removes "Task 3"

// ---

// Add three todos as ONE undo step
state.todos.push({ text: "Task 1", done: false });
undoManager.stopCapturing(); // Start new capture group
state.todos.push({ text: "Task 2", done: false });
state.todos.push({ text: "Task 3", done: false });

undoManager.undo(); // Removes all three tasks!
```

**Auto-grouping with timer:**

```typescript
// Changes within 500ms are grouped together
const undoManager = new UndoManager(ydoc.getMap("state"), {
  captureTimeout: 500, // milliseconds
});

// These mutations happen within 500ms -> grouped
state.count = 1;
setTimeout(() => (state.count = 2), 100);
setTimeout(() => (state.count = 3), 200);

// After 600ms, this starts a new group
setTimeout(() => (state.count = 4), 600);
```

## Common Patterns

### Keyboard Shortcuts

```typescript
window.addEventListener("keydown", (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key === "z" && !e.shiftKey) {
    e.preventDefault();
    undoManager.undo();
  }
  if ((e.ctrlKey || e.metaKey) && (e.key === "Z" || e.key === "y")) {
    e.preventDefault();
    undoManager.redo();
  }
});
```

### Track Only Local Changes (Multi-User)

```typescript
import { VALTIO_Y_ORIGIN } from "valtio-y";

// Track only this client's changes (ignore remote users)
const undoManager = new UndoManager(ydoc.getMap("state"), {
  trackedOrigins: new Set([VALTIO_Y_ORIGIN]),
});
```

### Limit Stack Size

```typescript
undoManager.on("stack-item-added", () => {
  while (undoManager.undoStack.length > 50) {
    undoManager.undoStack.shift();
  }
});
```

## Limitations

**What works:**

- Object properties, arrays, nested updates, deletions

**What doesn't:**

- Changes outside tracked Yjs types
- Direct Yjs operations (bypass the proxy)
- Changes before the UndoManager is created
- Bootstrap operations (not tracked by default)

**Multi-user:** Undo only affects tracked origins (usually your local changes). Remote changes are preserved.

## Further Reading

- [Yjs UndoManager Documentation](https://docs.yjs.dev/api/undo-manager)
- [valtio-y README](../README.md) - See the "Undo/Redo" section for a quick reference
- [Concepts Guide](./concepts.md) - Understanding CRDTs and the valtio-y mental model

## Summary

- Use `UndoManager` from Yjs to add undo/redo to valtio-y
- Pass the Yjs type (not the proxy) to `UndoManager`
- Create a React hook for easy integration
- Scope to specific parts of state by passing specific Yjs types
- Group operations with `stopCapturing()` or `captureTimeout`
- Use `trackedOrigins` to exclude remote changes in multi-user apps
- Each client can have its own undo/redo history
