# Multi-Room Architecture

A guide to managing multiple Y.Docs and rooms in valtio-y applications with routing and navigation.

---

## The Problem

When building real-time applications with routing (e.g., `/room/abc`, `/room/xyz`), you'll quickly hit a fundamental limitation: **one Y.Doc can only represent one collaborative session**.

### Why One Document Isn't Enough

```typescript
// This doesn't work for multi-room applications:
const doc = new Y.Doc();
const { proxy } = createYjsProxy(doc, {
  getRoot: (doc) => doc.getMap("root"),
});

// Problem: How do you switch to room XYZ?
// You can't reconnect to a different WebSocket endpoint.
// You can't clean up the old room's state.
// You're stuck with one document.
```

**The fundamental issue:** `createYjsProxy` creates a bridge between Yjs and Valtio, but it doesn't manage the document lifecycle, provider connections, or cleanup when switching rooms.

### What You Actually Need

Each collaborative session requires:

1. Its own Y.Doc instance
2. Its own Valtio proxy (via `createYjsProxy`)
3. Its own WebSocket provider connection
4. Proper cleanup when switching rooms

This is complex lifecycle management that requires a structured approach.

---

## The RoomState Pattern

The RoomState pattern is simple: **one Y.Doc and one Valtio proxy per room**. That's it.

How you organize this is up to you - inline in `useMemo`, a class, a custom hook, or whatever fits your app structure. The key is ensuring each room gets its own document and proxy instance.

### Example: Using a Class

One way to organize this is with a class that bundles everything together:

```typescript
import * as Y from "yjs";
import { createYjsProxy } from "valtio-y";
import type { AppState } from "./types";

export class RoomState {
  readonly doc: Y.Doc;
  readonly proxy: AppState;
  private readonly disposeBridge: () => void;
  readonly undo: () => void;
  readonly redo: () => void;
  readonly undoState: { canUndo: boolean; canRedo: boolean };

  constructor() {
    this.doc = new Y.Doc();

    const proxyWithUndo = createYjsProxy<AppState>(this.doc, {
      getRoot: (document: Y.Doc) => document.getMap("root"),
      undoManager: {
        captureTimeout: 100,
      },
    });

    this.proxy = proxyWithUndo.proxy;
    this.disposeBridge = proxyWithUndo.dispose;
    this.undo = proxyWithUndo.undo;
    this.redo = proxyWithUndo.redo;
    this.undoState = proxyWithUndo.undoState;
  }

  dispose(): void {
    this.disposeBridge();
    // Y.Doc will be garbage collected automatically
  }
}
```

### Example: Inline with useMemo

Or keep it simple and inline:

```typescript
const { proxy, dispose } = useMemo(() => {
  const doc = new Y.Doc();
  const { proxy, dispose } = createYjsProxy<AppState>(doc, {
    getRoot: (doc) => doc.getMap("root"),
  });
  return { proxy, dispose };
}, [roomId]);

useEffect(() => {
  return () => dispose();
}, [dispose]);
```

**Both accomplish the same goal:** new document and proxy per room, with proper cleanup. Choose whatever fits your codebase.

---

## The useRoomProvider Hook

The `useRoomProvider` hook manages the WebSocket connection lifecycle. It's based on y-partyserver's `useYProvider` but customized for our specific lifecycle requirements.

### Why a Custom Hook?

The y-partyserver `useYProvider` hook doesn't expose the granular control we need for managing connection timing and cleanup order. Our custom implementation gives us:

- Control over when the connection is established (`connect: false`)
- Proper cleanup ordering (disconnect before disposal)
- Stable memoization that works with our RoomState pattern

### Implementation

```typescript
import { useEffect, useMemo } from "react";
import YProvider from "y-partyserver/provider";
import type * as Y from "yjs";

type UseRoomProviderOptions = {
  host?: string | undefined;
  room: string;
  party?: string;
  doc: Y.Doc;
  prefix?: string;
  options?: ConstructorParameters<typeof YProvider>[3];
};

export function useRoomProvider({
  host,
  room,
  party,
  doc,
  prefix,
  options,
}: UseRoomProviderOptions) {
  const provider = useMemo(() => {
    const resolvedHost =
      host ??
      (typeof window !== "undefined"
        ? window.location.host
        : "dummy-domain.com");

    return new YProvider(resolvedHost, room, doc, {
      connect: false, // Don't auto-connect
      party,
      prefix,
      ...options,
    });
  }, [host, room, doc, party, prefix, options]);

  useEffect(() => {
    void provider.connect();

    return () => {
      provider.disconnect();
      if (typeof provider.destroy === "function") {
        provider.destroy();
      }
    };
  }, [provider]);

  return provider;
}
```

**Key points:**

- `connect: false` prevents auto-connection; we control when it happens
- `useMemo` dependencies: primitives are compared by value, objects (`doc`, `options`) need stability
- Cleanup order matters: provider disconnects before room disposal

---

## Putting It Together

Here's how RoomState and useRoomProvider work together in a React app:

```typescript
import { useEffect, useMemo } from "react";
import { RoomState } from "./yjs-setup";
import { useRoomProvider } from "./use-room-provider";

function App() {
  // Get current room ID from your router
  // Examples: useParams() from React Router, useSearchParams() from Next.js,
  // window.location.hash, or any routing solution
  const roomId = getRoomIdFromRouter(); // pseudocode - adapt to your routing

  // Create new RoomState when room changes
  const room = useMemo(() => new RoomState(), [roomId]);

  // Connect to the room's WebSocket
  const provider = useRoomProvider({
    host: import.meta.env.PROD ? window.location.host : undefined,
    room: roomId,
    party: "y-doc-server",
    doc: room.doc,
  });

  // Cleanup when switching rooms
  useEffect(() => {
    return () => room.dispose();
  }, [room]);

  // Pass proxy as prop (dependency injection)
  return <YourAppUI stateProxy={room.proxy} />;
}

function YourAppUI({ stateProxy }: { stateProxy: AppState }) {
  // Use the proxy in your components
  const snap = useSnapshot(stateProxy);
  // ... rest of your UI
}
```

**What happens when switching rooms:**

1. User navigates to a different room
2. `roomId` updates (from your router)
3. `useMemo` creates new `RoomState` instance
4. `useRoomProvider` disconnects from old room and connects to new one
5. Cleanup effect disposes the old room

**Key points:**

- Use dependency injection: pass `stateProxy` as a prop, don't import it globally
- This allows showing multiple rooms in parallel (e.g., split-screen view)
- Each room gets its own Y.Doc, proxy, and provider
- If you used one global `createYjsProxy`, all components would share the same state

For complete working examples, see `../examples/sticky-notes` and `../examples/todos` which both implement this pattern.

---

## Common Pitfalls

### Missing useMemo on RoomState

Always wrap RoomState instantiation in `useMemo`:

```typescript
// Wrong: Creates new room on every render
const room = new RoomState();

// Correct: Only creates when roomId changes
const room = useMemo(() => new RoomState(), [roomId]);
```

### Not Disposing Old Rooms

Always clean up when rooms change:

```typescript
useEffect(() => {
  return () => room.dispose();
}, [room]);
```

### React.StrictMode

StrictMode causes double-renders which break WebSocket connections. Don't wrap your app in StrictMode when using WebSocket providers:

```typescript
// Problematic
<StrictMode><App /></StrictMode>

// Better
<App />
```

### Unstable Hook Dependencies

Memoize object dependencies passed to useRoomProvider:

```typescript
// Wrong: New object every render
const provider = useRoomProvider({
  doc,
  room: roomId,
  options: { awareness: myAwareness },
});

// Correct: Memoize options
const options = useMemo(() => ({ awareness: myAwareness }), [myAwareness]);
const provider = useRoomProvider({ doc, room: roomId, options });
```

---

## Summary

**When to use this pattern:**

- Multi-room chat applications
- Document editors with multiple files
- Workspace-based collaboration tools
- Any app with room/channel navigation

**When you don't need it:**

- Single-room applications
- No navigation between documents
- Static collaborative sessions

**Reference implementations:**

See `../examples/sticky-notes` and `../examples/todos` for complete working implementations. The key files are:

- `../examples/sticky-notes/src/yjs-setup.ts` - RoomState class
- `../examples/sticky-notes/src/use-room-provider.ts` - useRoomProvider hook
- `../examples/sticky-notes/src/app.tsx` - Integration with React and routing

**Important note:** The examples provide a starting point, but you should adapt the pattern to your specific requirements. Consider your routing strategy (hash-based, React Router, Next.js), cleanup timing, and whether you need features like awareness, undo/redo, or custom provider options. The core principle remains the same: one Y.Doc per collaborative session with proper lifecycle management.
