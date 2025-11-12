# Undo/Redo with valtio-y

Add undo/redo functionality to your collaborative app using Yjs's built-in `UndoManager`. This guide shows you how to integrate it with valtio-y in React applications.

## Quick Start (Recommended)

The simplest way to add undo/redo is to enable it directly in `createYjsProxy`:

```typescript
import * as Y from "yjs";
import { createYjsProxy } from "valtio-y";
import { useSnapshot } from "valtio";

type State = {
  count: number;
};

// Create your Yjs document and proxy with undo/redo enabled
const ydoc = new Y.Doc();
const {
  proxy: state,
  undo,
  redo,
  undoState,
} = createYjsProxy<State>(ydoc, {
  getRoot: (doc) => doc.getMap("state"),
  undoManager: true, // ✨ Enable undo/redo
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
      <button onClick={undo} disabled={!canUndo}>
        Undo
      </button>
      <button onClick={redo} disabled={!canRedo}>
        Redo
      </button>
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
  undo, // Perform undo
  redo, // Perform redo
  undoState, // Reactive state { canUndo, canRedo }
  stopCapturing, // Force new undo step
  clearHistory, // Clear all history
  manager, // Raw Y.UndoManager instance
} = createYjsProxy(ydoc, {
  getRoot: (doc) => doc.getMap("state"),
  undoManager: true,
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
    captureTimeout: 1000, // Group operations within 1 second
    trackedOrigins: new Set([VALTIO_Y_ORIGIN]), // Only local changes
  },
});
```

### Track Changes Without Explicit Origin

By default, only local valtio-y changes (with `VALTIO_Y_ORIGIN`) are tracked. To track changes without an explicit origin:

```typescript
const { proxy, undo, redo } = createYjsProxy(ydoc, {
  getRoot: (doc) => doc.getMap("state"),
  undoManager: {
    trackedOrigins: undefined, // Track only changes without explicit origin
  },
});
```

**Note:** This does NOT track all changes. Yjs has no built-in way to track all origins. To track multiple specific origins, use a Set:

```typescript
undoManager: {
  trackedOrigins: new Set([VALTIO_Y_ORIGIN, 'custom-origin', 'another-origin'])
}
```

### Advanced: Custom UndoManager

For advanced features like `deleteFilter`, create your own instance:

```typescript
import * as Y from "yjs";
import { VALTIO_Y_ORIGIN } from "valtio-y";

const customUndoManager = new Y.UndoManager(ydoc.getMap("state"), {
  trackedOrigins: new Set([VALTIO_Y_ORIGIN]),
  deleteFilter: (item) => {
    // Exclude temporary data from undo
    return item.content.type !== "TemporaryData";
  },
});

const { proxy, undo, redo } = createYjsProxy(ydoc, {
  getRoot: (doc) => doc.getMap("state"),
  undoManager: customUndoManager, // ⚠️ Scope must match getRoot!
});
```

**Warning:** When passing a custom instance, ensure the scope matches `getRoot`.

## React Integration

### Basic Example

```tsx
import * as Y from "yjs";
import { createYjsProxy } from "valtio-y";
import { useSnapshot } from "valtio";

type State = {
  todos: Array<{ text: string; done: boolean }>;
};

const ydoc = new Y.Doc();
const {
  proxy: state,
  undo,
  redo,
  undoState,
} = createYjsProxy<State>(ydoc, {
  getRoot: (doc) => doc.getMap("state"),
  undoManager: true,
});

function TodoApp() {
  const snap = useSnapshot(state);
  const { canUndo, canRedo } = useSnapshot(undoState);

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
  undoManager: true,
});

// Separate undo for chat
const { proxy: chat, undo: undoChat } = createYjsProxy(ydoc, {
  getRoot: (doc) => doc.getArray("chat"),
  undoManager: true,
});

// Canvas changes don't affect chat undo history and vice versa
canvas.push({ type: "rect", x: 0, y: 0 });
undoCanvas(); // Only affects canvas

chat.push({ user: "Alice", message: "Hello" });
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
    captureTimeout: 1000, // Group operations within 1 second
  },
});
```

### Track Only Local Changes (Multi-User)

The default behavior already tracks only local changes:

```typescript
import { VALTIO_Y_ORIGIN } from "valtio-y";

const { proxy, undo } = createYjsProxy(ydoc, {
  getRoot: (doc) => doc.getMap("state"),
  undoManager: true, // Default: trackedOrigins = new Set([VALTIO_Y_ORIGIN])
});

// When User A undoes, only User A's changes are undone
// User B's changes are preserved
```

### Save Cursor Position with Undo

Use the raw `manager` for advanced features:

```typescript
const { manager } = createYjsProxy(ydoc, {
  getRoot: (doc) => doc.getMap("state"),
  undoManager: true,
});

// Save cursor location when adding to undo stack
manager.on("stack-item-added", (event) => {
  event.stackItem.meta.set("cursor", getCursorPosition());
});

// Restore cursor when popping from stack
manager.on("stack-item-popped", (event) => {
  const cursor = event.stackItem.meta.get("cursor");
  if (cursor) {
    restoreCursorPosition(cursor);
  }
});
```

## Manual Setup (Without createYjsProxy Option)

> ℹ️ Internally, `createYjsProxy` does almost exactly what the following manual setup demonstrates: it creates a `Y.UndoManager`, wraps it with a small Valtio proxy for the reactive `undoState`, and wires up cleanup. The bare Yjs manager exposes `canUndo()` / `canRedo()` as plain methods—there’s no built-in reactive state—so we lean on Valtio to make those values update-friendly. You can always opt out by leaving `undoManager` undefined, then build a fully custom undo flow yourself—passing your own manager back into `createYjsProxy` is supported when you need something more specialized.

If you prefer manual control, you can create an `UndoManager` separately:

```typescript
import * as Y from "yjs";
import { createYjsProxy, VALTIO_Y_ORIGIN } from "valtio-y";

const ydoc = new Y.Doc();
const { proxy: state } = createYjsProxy<State>(ydoc, {
  getRoot: (doc) => doc.getMap("state"),
  // No undoManager option
});

// Create UndoManager manually
const undoManager = new Y.UndoManager(ydoc.getMap("state"), {
  trackedOrigins: new Set([VALTIO_Y_ORIGIN]),
  captureTimeout: 500,
});

// Manual state management
import { proxy as valtioProxy } from "valtio";

const undoState = valtioProxy({ canUndo: false, canRedo: false });

const updateUndoState = () => {
  undoState.canUndo = undoManager.canUndo();
  undoState.canRedo = undoManager.canRedo();
};

undoManager.on("stack-item-added", updateUndoState);
undoManager.on("stack-item-popped", updateUndoState);
undoManager.on("stack-cleared", updateUndoState);

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

## Further Reading

- [Yjs UndoManager Documentation](https://docs.yjs.dev/api/undo-manager)
- [valtio-y README](../README.md) - Core concepts and examples
- [Structuring Your App](./structuring-your-app.md) - Using multiple roots for separate undo histories
