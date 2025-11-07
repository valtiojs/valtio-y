# Undo/Redo with valtio-y

Add undo/redo functionality to your collaborative app using Yjs's built-in `UndoManager`. This guide shows you how to integrate it with valtio-y in React applications.

## Quick Start (Recommended)

The simplest way to add undo/redo is to enable it directly in `createYjsProxy`:

```typescript
import { createYjsProxy } from "valtio-y";
import { useSnapshot } from "valtio";

type State = {
  count: number;
};

// Create your Yjs document and proxy with undo/redo enabled
const ydoc = new Y.Doc();
const { proxy: state, undo, redo, undoState } = createYjsProxy<State>(ydoc, {
  getRoot: (doc) => doc.getMap("state"),
  undoManager: true,  // ✨ Enable undo/redo
});

// Make some changes
state.count = 1;
state.count = 2;
state.count = 3;

// Undo/redo
undo(); // state.count -> 2
redo(); // state.count -> 3

// In React components
function MyComponent() {
  const { canUndo, canRedo } = useSnapshot(undoState);

  return (
    <>
      <button onClick={undo} disabled={!canUndo}>Undo</button>
      <button onClick={redo} disabled={!canRedo}>Redo</button>
    </>
  );
}
```

That's it! The `undoManager` option automatically:
- Creates and configures a Yjs `UndoManager`
- Tracks only local valtio-y changes (not remote users)
- Provides reactive `undoState` for UI
- Cleans up on dispose

## Basic Usage

### Core Functions

When `undoManager` is enabled, `createYjsProxy` returns additional functions:

```typescript
const {
  proxy: state,
  undo,           // Perform undo
  redo,           // Perform redo
  undoState,      // Reactive state { canUndo, canRedo }
  stopCapturing,  // Force new undo step
  clearHistory,   // Clear all history
  manager         // Raw Y.UndoManager instance
} = createYjsProxy(ydoc, {
  getRoot: (doc) => doc.getMap("state"),
  undoManager: true
});

// Undo the last change
undo();

// Redo the last undone change
redo();

// Clear all undo/redo history
clearHistory();

// Force next operation into new undo step
stopCapturing();

// Access raw UndoManager for advanced usage
console.log(manager.undoStack.length);
```

### Reactive State

The `undoState` is a Valtio proxy that updates automatically:

```tsx
import { useSnapshot } from "valtio";

function UndoRedoButtons() {
  const { canUndo, canRedo } = useSnapshot(undoState);

  return (
    <div>
      <button onClick={undo} disabled={!canUndo}>
        Undo {canUndo && `(${manager.undoStack.length})`}
      </button>
      <button onClick={redo} disabled={!canRedo}>
        Redo {canRedo && `(${manager.redoStack.length})`}
      </button>
    </div>
  );
}
```

## Configuration

### Custom Options

Configure how operations are grouped and tracked:

```typescript
const { proxy, undo, redo } = createYjsProxy(ydoc, {
  getRoot: (doc) => doc.getMap("state"),
  undoManager: {
    captureTimeout: 1000,  // Group operations within 1 second
    trackedOrigins: new Set([VALTIO_Y_ORIGIN])  // Only local changes
  }
});
```

### Track All Changes (Including Remote)

By default, only local changes are tracked. To undo everything:

```typescript
const { proxy, undo, redo } = createYjsProxy(ydoc, {
  getRoot: (doc) => doc.getMap("state"),
  undoManager: {
    trackedOrigins: undefined  // Track ALL changes (including remote users)
  }
});
```

### Advanced: Custom UndoManager

For advanced features like `deleteFilter`, create your own instance:

```typescript
import { UndoManager } from "yjs";
import { VALTIO_Y_ORIGIN } from "valtio-y";

const customUndoManager = new UndoManager(ydoc.getMap("state"), {
  trackedOrigins: new Set([VALTIO_Y_ORIGIN]),
  deleteFilter: (item) => {
    // Exclude temporary data from undo
    return item.content.type !== 'TemporaryData';
  }
});

const { proxy, undo, redo } = createYjsProxy(ydoc, {
  getRoot: (doc) => doc.getMap("state"),
  undoManager: customUndoManager  // ⚠️ Scope must match getRoot!
});
```

**Warning:** When passing a custom instance, ensure the scope matches `getRoot`.

## React Integration

### Basic Example

```tsx
import { createYjsProxy } from "valtio-y";
import { useSnapshot } from "valtio";

type State = {
  todos: Array<{ text: string; done: boolean }>;
};

const ydoc = new Y.Doc();
const { proxy: state, undo, redo, undoState } = createYjsProxy<State>(ydoc, {
  getRoot: (doc) => doc.getMap("state"),
  undoManager: true
});

function TodoApp() {
  const snap = useSnapshot(state);
  const { canUndo, canRedo } = useSnapshot(undoState);

  return (
    <div>
      <div>
        <button onClick={undo} disabled={!canUndo}>Undo</button>
        <button onClick={redo} disabled={!canRedo}>Redo</button>
      </div>

      {snap.todos?.map((todo, i) => (
        <div key={i}>
          <input
            type="checkbox"
            checked={todo.done}
            onChange={() => (state.todos[i].done = !state.todos[i].done)}
          />
          {todo.text}
        </div>
      ))}
    </div>
  );
}
```

### Keyboard Shortcuts

Add Cmd/Ctrl+Z shortcuts:

```tsx
import { useEffect } from "react";

function useUndoKeyboardShortcuts() {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      const modKey = isMac ? e.metaKey : e.ctrlKey;

      // Undo: Cmd/Ctrl+Z (without Shift)
      if (modKey && e.key.toLowerCase() === 'z' && !e.shiftKey) {
        const { canUndo } = undoState;
        if (canUndo) {
          e.preventDefault();
          undo();
        }
      }

      // Redo: Cmd/Ctrl+Shift+Z or Cmd/Ctrl+Y
      if (modKey && ((e.shiftKey && e.key.toLowerCase() === 'z') || e.key.toLowerCase() === 'y')) {
        const { canRedo } = undoState;
        if (canRedo) {
          e.preventDefault();
          redo();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);
}

function App() {
  useUndoKeyboardShortcuts();

  return <YourUI />;
}
```

## Scoping Undo/Redo

Track only specific parts of your state by creating multiple proxies with separate undo managers:

```typescript
type State = {
  canvas: Array<Shape>;
  chat: Array<Message>;
};

// Separate undo for canvas
const { proxy: canvas, undo: undoCanvas } = createYjsProxy(ydoc, {
  getRoot: (doc) => doc.getArray("canvas"),
  undoManager: true
});

// Separate undo for chat
const { proxy: chat, undo: undoChat } = createYjsProxy(ydoc, {
  getRoot: (doc) => doc.getArray("chat"),
  undoManager: true
});

// Canvas changes don't affect chat undo history and vice versa
canvas.push({ type: 'rect', x: 0, y: 0 });
undoCanvas(); // Only affects canvas

chat.push({ user: 'Alice', message: 'Hello' });
undoChat(); // Only affects chat
```

This pattern is useful when different parts of your app should have independent undo histories (e.g., canvas edits vs chat messages).

## Grouping Operations

By default, operations within 500ms are merged into a single undo step:

```typescript
// These three operations become ONE undo step (within 500ms)
state.todos.push({ text: "Task 1", done: false });
state.todos.push({ text: "Task 2", done: false });
state.todos.push({ text: "Task 3", done: false });

undo(); // Removes all three tasks
```

### Force New Undo Step

Use `stopCapturing()` to ensure the next operation starts a new undo step:

```typescript
state.todos.push({ text: "Task 1", done: false });
stopCapturing(); // Next operation won't be merged
state.todos.push({ text: "Task 2", done: false });

undo(); // Only removes "Task 2"
undo(); // Now removes "Task 1"
```

### Custom Timeout

Configure how long operations are grouped:

```typescript
const { proxy, undo, redo } = createYjsProxy(ydoc, {
  getRoot: (doc) => doc.getMap("state"),
  undoManager: {
    captureTimeout: 1000  // Group operations within 1 second
  }
});
```

## Common Patterns

### Limit Stack Size

```typescript
import { useEffect } from "react";

function useLimitUndoStack(maxSize = 50) {
  useEffect(() => {
    const handleStackAdded = () => {
      while (manager.undoStack.length > maxSize) {
        manager.undoStack.shift();
      }
    };

    manager.on('stack-item-added', handleStackAdded);
    return () => manager.off('stack-item-added', handleStackAdded);
  }, [maxSize]);
}
```

### Track Only Local Changes (Multi-User)

The default behavior already tracks only local changes:

```typescript
import { VALTIO_Y_ORIGIN } from "valtio-y";

const { proxy, undo } = createYjsProxy(ydoc, {
  getRoot: (doc) => doc.getMap("state"),
  undoManager: true  // Default: trackedOrigins = new Set([VALTIO_Y_ORIGIN])
});

// When User A undoes, only User A's changes are undone
// User B's changes are preserved
```

### Save Cursor Position with Undo

Use the raw `manager` for advanced features:

```typescript
const { manager } = createYjsProxy(ydoc, {
  getRoot: (doc) => doc.getMap("state"),
  undoManager: true
});

// Save cursor location when adding to undo stack
manager.on('stack-item-added', (event) => {
  event.stackItem.meta.set('cursor', getCursorPosition());
});

// Restore cursor when popping from stack
manager.on('stack-item-popped', (event) => {
  const cursor = event.stackItem.meta.get('cursor');
  if (cursor) {
    restoreCursorPosition(cursor);
  }
});
```

## Manual Setup (Without createYjsProxy Option)

If you prefer manual control, you can create an `UndoManager` separately:

```typescript
import { UndoManager } from "yjs";
import { VALTIO_Y_ORIGIN } from "valtio-y";

const ydoc = new Y.Doc();
const { proxy: state } = createYjsProxy<State>(ydoc, {
  getRoot: (doc) => doc.getMap("state")
  // No undoManager option
});

// Create UndoManager manually
const undoManager = new UndoManager(ydoc.getMap("state"), {
  trackedOrigins: new Set([VALTIO_Y_ORIGIN]),
  captureTimeout: 500
});

// Manual state management
import { proxy as valtioProxy } from "valtio";

const undoState = valtioProxy({ canUndo: false, canRedo: false });

const updateUndoState = () => {
  undoState.canUndo = undoManager.canUndo();
  undoState.canRedo = undoManager.canRedo();
};

undoManager.on('stack-item-added', updateUndoState);
undoManager.on('stack-item-popped', updateUndoState);
undoManager.on('stack-cleared', updateUndoState);

updateUndoState(); // Initial state

// In React
function MyComponent() {
  const { canUndo, canRedo } = useSnapshot(undoState);

  return (
    <>
      <button onClick={() => undoManager.undo()} disabled={!canUndo}>
        Undo
      </button>
      <button onClick={() => undoManager.redo()} disabled={!canRedo}>
        Redo
      </button>
    </>
  );
}
```

**Recommendation:** Use the `undoManager` option in `createYjsProxy` for simpler setup and automatic cleanup.

## Limitations

**What works:**

- Object properties, arrays, nested updates, deletions
- All standard array operations (push, pop, splice, etc.)
- Deep nesting

**What doesn't:**

- Changes outside tracked Yjs types
- Direct Yjs operations (bypass the proxy)
- Changes before the UndoManager is created
- Bootstrap operations (not tracked by default)

**Multi-user:** Undo only affects tracked origins (usually your local changes). Remote changes are preserved.

## Further Reading

- [Yjs UndoManager Documentation](https://docs.yjs.dev/api/undo-manager)
- [valtio-y README](../README.md) - Core concepts and examples
- [Structuring Your App](./structuring-your-app.md) - Using multiple roots for separate undo histories

## Summary

- **Quick start:** Add `undoManager: true` to `createYjsProxy` options
- **Reactive UI:** Use `useSnapshot(undoState)` for button states
- **Scoping:** Create multiple proxies with separate undo managers
- **Grouping:** Operations within `captureTimeout` are merged (default 500ms)
- **Multi-user:** Only local changes are tracked by default
- **Advanced:** Access raw `manager` for custom features
