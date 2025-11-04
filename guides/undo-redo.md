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

Create a hook to use undo/redo in your React components:

```typescript
import { useEffect, useState } from "react";
import { useSnapshot } from "valtio/react";
import type { UndoManager } from "yjs";

function useUndoRedo(undoManager: UndoManager) {
  const [canUndo, setCanUndo] = useState(undoManager.canUndo());
  const [canRedo, setCanRedo] = useState(undoManager.canRedo());

  useEffect(() => {
    const updateState = () => {
      setCanUndo(undoManager.canUndo());
      setCanRedo(undoManager.canRedo());
    };

    // Update state when undo/redo stacks change
    undoManager.on("stack-item-added", updateState);
    undoManager.on("stack-item-popped", updateState);
    undoManager.on("stack-cleared", updateState);

    return () => {
      undoManager.off("stack-item-added", updateState);
      undoManager.off("stack-item-popped", updateState);
      undoManager.off("stack-cleared", updateState);
    };
  }, [undoManager]);

  return {
    undo: () => undoManager.undo(),
    redo: () => undoManager.redo(),
    clear: () => undoManager.clear(),
    canUndo,
    canRedo,
  };
}
```

### Usage in Components

```tsx
function TodoApp() {
  const snap = useSnapshot(state);
  const { undo, redo, canUndo, canRedo } = useUndoRedo(undoManager);

  return (
    <div>
      <div>
        <button onClick={undo} disabled={!canUndo}>
          Undo
        </button>
        <button onClick={redo} disabled={!canRedo}>
          Redo
        </button>
      </div>

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

      <button
        onClick={() => state.todos.push({ text: "New task", done: false })}
      >
        Add Todo
      </button>
    </div>
  );
}
```

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
useEffect(() => {
  const handleKeyDown = (e: KeyboardEvent) => {
    // Ctrl+Z or Cmd+Z for undo
    if ((e.ctrlKey || e.metaKey) && e.key === "z" && !e.shiftKey) {
      e.preventDefault();
      undoManager.undo();
    }

    // Ctrl+Shift+Z or Cmd+Shift+Z for redo
    if ((e.ctrlKey || e.metaKey) && e.key === "z" && e.shiftKey) {
      e.preventDefault();
      undoManager.redo();
    }

    // Ctrl+Y or Cmd+Y for redo (Windows style)
    if ((e.ctrlKey || e.metaKey) && e.key === "y") {
      e.preventDefault();
      undoManager.redo();
    }
  };

  window.addEventListener("keydown", handleKeyDown);
  return () => window.removeEventListener("keydown", handleKeyDown);
}, []);
```

### Stack Size Limit

```typescript
// Keep only the last 50 undo steps
const undoManager = new UndoManager(ydoc.getMap("state"), {
  trackedOrigins: new Set([null]), // Track all origins
  captureTimeout: 500,
});

// Manually limit stack size
undoManager.on("stack-item-added", () => {
  const maxSize = 50;
  while (undoManager.undoStack.length > maxSize) {
    undoManager.undoStack.shift();
  }
});
```

### Exclude Specific Changes

```typescript
import { VALTIO_YJS_ORIGIN } from "valtio-y";

// Only track changes from specific origins
const undoManager = new UndoManager(ydoc.getMap("state"), {
  trackedOrigins: new Set([VALTIO_YJS_ORIGIN]),
});

// Or exclude remote changes (track only local changes)
const localOnlyUndoManager = new UndoManager(ydoc.getMap("state"), {
  trackedOrigins: new Set([VALTIO_YJS_ORIGIN]),
});
```

### Multi-User Undo

Each client can have its own `UndoManager` that only tracks their local changes:

```typescript
// Track only this client's changes (not remote users)
const undoManager = new UndoManager(ydoc.getMap("state"), {
  trackedOrigins: new Set([VALTIO_YJS_ORIGIN]),
});

// Now undo/redo only affects this user's changes
// Remote users' changes remain untouched
```

## Limitations

### What Can Be Undone

- ✅ Object property changes (`state.name = "Alice"`)
- ✅ Array operations (`state.todos.push(...)`)
- ✅ Nested updates (`state.user.profile.bio = "..."`)
- ✅ Deletions (`delete state.property`)

### What Cannot Be Undone

- ❌ **Changes outside UndoManager's tracked types** - Only the Yjs types you pass to `UndoManager` are tracked
- ❌ **Direct Yjs operations** - Changes made directly via Yjs APIs (without going through the proxy) may not track correctly
- ❌ **Changes before UndoManager creation** - Only changes after creating the `UndoManager` are tracked

### Edge Cases

**1. Bootstrap operations:**

```typescript
// Bootstrap is NOT tracked by default
const { proxy: state, bootstrap } = createYjsProxy(ydoc, {
  getRoot: (doc) => doc.getMap("state"),
});

const undoManager = new UndoManager(ydoc.getMap("state"));

bootstrap({ count: 0 }); // Not in undo history
state.count = 1; // This IS tracked
undoManager.undo(); // Goes back to 0 (bootstrap state)
```

**2. Concurrent edits:**

When multiple users edit simultaneously, undo only affects the tracked origins (usually your local changes). Remote users' changes are preserved.

**3. Deep nested changes:**

All nested changes are tracked as long as they go through the proxy:

```typescript
state.user.profile.settings.theme = "dark"; // ✅ Tracked
undoManager.undo(); // Reverts the theme change
```

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
