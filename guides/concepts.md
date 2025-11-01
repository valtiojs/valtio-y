# Core Concepts

Understanding the fundamental concepts behind valtio-y will help you build better collaborative applications and reason about how your state synchronizes across users.

---

## Table of Contents

1. [What Are CRDTs?](#what-are-crdts)
2. [How valtio-y Works](#how-valtio-y-works)
3. [The valtio-y Mental Model](#the-valtio-y-mental-model)
4. [Key Concepts](#key-concepts)
5. [When to Use valtio-y](#when-to-use-valtio-y)
6. [Architectural Overview](#architectural-overview)

---

## What Are CRDTs?

### The Problem

Imagine two users editing a shared todo list at the same time:

```
Initial state: ["Buy milk", "Walk dog"]

User A adds: "Read book" → ["Buy milk", "Walk dog", "Read book"]
User B adds: "Call mom"  → ["Buy milk", "Walk dog", "Call mom"]
```

**What should the final state be?** Traditional approaches require:

- A central server to decide the order
- Locks to prevent simultaneous edits
- Complex conflict resolution logic
- Network round-trips for every change

This breaks down in real-world scenarios:

- What if users are offline?
- What if the network is slow?
- What if the server goes down?
- How do you handle merge conflicts?

### The Solution: CRDTs

**CRDT** stands for **Conflict-free Replicated Data Type**. It's a special data structure that:

1. **Works offline** - Every user has a complete local copy
2. **Merges automatically** - Changes from different users combine deterministically
3. **Converges** - All users eventually see the same state
4. **No coordination needed** - No central server deciding conflicts

Think of it like Git for your application state. Just as Git can merge code changes from multiple developers, CRDTs can merge state changes from multiple users.

### How CRDTs Solve the Problem

CRDTs use mathematical properties to ensure that merging operations always produces the same result, regardless of order:

```
User A: ["Buy milk", "Walk dog"] + "Read book"
User B: ["Buy milk", "Walk dog"] + "Call mom"

After sync: ["Buy milk", "Walk dog", "Read book", "Call mom"]
```

Both users end up with the same state, even though they made changes simultaneously. No conflicts, no lost data.

### Real-World Example

**Google Docs** is built on CRDTs. That's how multiple people can edit the same document simultaneously without conflicts. valtio-y brings this same technology to your React applications.

---

## How valtio-y Works

valtio-y bridges two powerful libraries:

- **[Valtio](https://github.com/pmndrs/valtio)** - Reactive state management for React
- **[Yjs](https://github.com/yjs/yjs)** - CRDT implementation for collaborative editing

### The Bridge

```
Your React Components
        ↓
    Valtio Proxy (state.todos)
        ↓
    valtio-y Bridge
        ↓
    Yjs CRDT (Y.Array)
        ↓
    Provider (WebSocket/WebRTC)
        ↓
    Network → Other Users
```

When you mutate state, valtio-y:

1. **Intercepts** your change via Valtio's proxy
2. **Translates** it to a Yjs CRDT operation
3. **Batches** multiple changes into one transaction
4. **Syncs** the change through your provider to other users
5. **Updates** React components that depend on that state

When another user makes a change:

1. **Receives** the update from the network
2. **Merges** it with the local CRDT state (conflict-free!)
3. **Reconciles** the Valtio proxy to match
4. **Triggers** React re-renders for affected components

### Bidirectional Sync

The magic of valtio-y is **bidirectional sync**:

```
Local Mutation → Valtio Proxy → Yjs CRDT → Network
                      ↑             ↓
Network → Yjs CRDT → Reconcile → Valtio Proxy → React
```

You never think about the sync layer. Just mutate state naturally:

```typescript
// This automatically syncs to all users
state.todos.push({ text: "Buy milk", done: false });

// This too
state.todos[0].done = true;

// Even nested objects
state.user.preferences.theme = "dark";
```

### What Happens When You Mutate State

Let's trace a single mutation through the system:

```typescript
state.count = 42;
```

**Step-by-step:**

1. **Proxy intercepts** - Valtio detects the property assignment
2. **Operation enqueued** - valtio-y queues `set('count', 42)` for the next microtask
3. **Batching window** - Any other changes in the same tick are collected
4. **Transaction** - On next microtask, all changes flush in one Yjs transaction
5. **Local state updated** - Yjs updates its internal CRDT state
6. **Provider syncs** - The update is sent over the network
7. **React notified** - Components using `useSnapshot(state)` re-render

All of this happens in milliseconds. From your perspective, it's instant.

### How React Components Update

valtio-y uses Valtio's fine-grained reactivity. Components only re-render when the specific properties they access actually change:

```typescript
function TodoList() {
  const snap = useSnapshot(state);

  // This component re-renders when state.todos array changes
  // (items added/removed) or when properties of items change
  return snap.todos.map((todo, index) => (
    <TodoItem
      key={todo.id}
      todo={todo} // Pass snapshot data for reading
      stateProxy={state} // Pass proxy for mutations
      index={index} // Pass index for mutations
    />
  ));
}

interface TodoItemProps {
  todo: { id: string; text: string; done: boolean }; // From snapshot
  stateProxy: typeof state; // Mutable proxy
  index: number;
}

function TodoItem({ todo, stateProxy, index }: TodoItemProps) {
  // Component re-renders when properties it accesses change

  function toggleDone() {
    // Mutate the proxy, not the snapshot
    stateProxy.todos[index].done = !stateProxy.todos[index].done;
  }

  return (
    <input
      checked={todo.done} // ✅ Read from snapshot
      onChange={toggleDone} // ✅ Write to proxy
    />
  );
}
```

**Key principle:** Read from snapshots, write to proxies.

- **Snapshots** (from `useSnapshot`) are immutable and track property access for fine-grained re-renders
- **Proxies** (the original `state` object) are mutable and trigger Yjs sync when changed
- Valtio tracks exactly which properties each component uses and only re-renders when those specific properties change

Unlike typical React state management where changes trigger re-renders of all subscribers, Valtio's proxy-based tracking ensures minimal re-renders.

---

## The valtio-y Mental Model

### Think of It Like: "Local-First Database with Automatic Sync"

The best mental model for valtio-y is a **local database that automatically syncs**:

- Your state is stored locally (fast reads, instant writes)
- Changes are persisted to a CRDT (automatic conflict resolution)
- Syncing happens in the background (no network round-trips)
- Other users' changes merge automatically (no conflicts to resolve)

This is called **local-first software** - your app works offline and syncs when online.

### Your State Is the Source of Truth

Unlike traditional apps where the server is the source of truth, with valtio-y:

- **Your local state** is authoritative
- You don't wait for server confirmation
- The UI updates instantly
- Conflicts resolve themselves deterministically

```typescript
// This happens IMMEDIATELY - no waiting for server
state.todos.push({ text: "New task", done: false });

// UI updates instantly
// Sync happens in background
// Other users see it soon after
```

### Mutations Are Automatically Persisted and Synced

Every mutation you make:

1. **Persists locally** (via CRDT)
2. **Syncs automatically** (via provider)
3. **Merges correctly** (via CRDT math)

You never write sync code. You never handle conflicts. You just mutate state.

### Conflicts Resolve Themselves Deterministically

When two users edit simultaneously, CRDTs ensure a **deterministic outcome**:

```typescript
// User A (offline)
state.count = 10;

// User B (offline)
state.count = 20;

// After sync: count is either 10 or 20 (deterministic)
// Last-write-wins for primitive values
```

For collections (arrays, objects), CRDTs are smarter:

```typescript
// User A adds item at index 0
state.todos.splice(0, 0, { text: "A's task" });

// User B adds item at index 0
state.todos.splice(0, 0, { text: "B's task" });

// After sync: Both items exist!
// ["B's task", "A's task", ...originalItems]
// Order is deterministic based on CRDT algorithm
```

This is the power of CRDTs: **changes merge, they don't conflict**.

---

## Key Concepts

### Proxies

A **proxy** in Valtio is a special JavaScript object that intercepts operations:

```typescript
const state = proxy({ count: 0 });

// When you access or modify properties, the proxy knows about it
state.count++; // Proxy intercepts this assignment
```

valtio-y creates proxies that:

- **Mirror** the structure of your Yjs CRDT
- **Intercept** mutations and translate them to CRDT operations
- **Materialize lazily** - nested objects become proxies on access
- **Update automatically** when remote changes arrive

Think of the proxy as a **live controller** for your CRDT state.

### Snapshots

A **snapshot** is an immutable view of your state for React:

```typescript
function Component() {
  const snap = useSnapshot(state);
  // 'snap' is immutable - you can't mutate it
  // But it tracks which properties you accessed

  return <div>{snap.count}</div>; // Tracks access to 'count'
}

// Mutate the original state, not the snapshot
state.count++; // ✅ Correct

// Never mutate the snapshot
snap.count++; // ❌ Won't work (it's immutable)
```

Snapshots enable fine-grained reactivity. React knows exactly which components need to re-render based on which properties they accessed in their snapshot.

### Providers

A **provider** is your network connection:

```typescript
import { WebsocketProvider } from "y-websocket";

const provider = new WebsocketProvider("ws://localhost:1234", "my-room", ydoc);
```

Providers:

- **Connect** your local CRDT to remote CRDTs
- **Send** your changes to other users
- **Receive** other users' changes
- **Handle** network disconnects/reconnects

Common providers:

- **WebSocket** - Traditional client-server (y-websocket)
- **WebRTC** - Peer-to-peer (y-webrtc)
- **IndexedDB** - Offline persistence (y-indexeddb)
- **PartyKit** - Serverless real-time (y-partyserver)

You can use multiple providers simultaneously (e.g., WebSocket for sync + IndexedDB for persistence).

### Batching

**Batching** combines multiple mutations into one transaction:

```typescript
// These 100 mutations become ONE network update
for (let i = 0; i < 100; i++) {
  state.count++;
}
```

valtio-y automatically batches all mutations in the same microtask. This is crucial for performance:

- **Reduces** network traffic
- **Minimizes** CRDT overhead
- **Optimizes** React re-renders
- **Improves** responsiveness

You don't need to think about batching - it just works.

### Lazy Materialization

**Lazy materialization** means nested objects become proxies only when you access them:

```typescript
state.users = [{ name: "Alice" }, { name: "Bob" }];
// At this point, users[0] is NOT yet a proxy

const firstUser = state.users[0];
// NOW users[0] is materialized as a proxy

firstUser.name = "Alice Updated";
// Mutations work because it's now a live proxy
```

This is a performance optimization. Creating thousands of proxies upfront would be slow. Instead, valtio-y creates them on-demand.

**Why this matters:**

- **Fast initialization** - Large data structures load quickly
- **Low memory** - Only accessed objects become proxies
- **Automatic** - You don't need to do anything special

---

## When to Use valtio-y

### Perfect Use Cases

valtio-y excels at applications with **shared mutable state**:

#### 1. Collaborative Tools

- **Todo lists** - Multiple users managing tasks
- **Dashboards** - Real-time analytics
- **Project management** - Shared boards and timelines
- **Design tools** - Collaborative canvas editing
- **Forms** - Multi-user form filling

**Why?** CRDTs handle concurrent edits to shared data structures naturally.

#### 2. Multiplayer Games

- **Turn-based games** - Chess, card games
- **Real-time coordination** - Multiplayer puzzle games
- **Shared worlds** - Minecraft-style building games

**Why?** Low-latency local state + automatic sync = smooth multiplayer experience.

#### 3. Offline-First Apps

- **Mobile apps** - Work offline, sync when online
- **PWAs** - Progressive web apps with offline support
- **Desktop apps** - Sync across devices

**Why?** CRDTs merge offline changes automatically when reconnected.

#### 4. Multi-Device Sync

- **Note-taking** - Sync across phone, tablet, desktop
- **Settings** - User preferences across devices
- **Bookmarks** - Shared collections

**Why?** Each device has a local copy, syncing happens seamlessly.

### Not Ideal Use Cases

Some applications are better served by other approaches:

#### 1. Text Editors

**Use native Yjs integrations instead:**

- [Lexical](https://lexical.dev/) with `@lexical/yjs`
- [TipTap](https://tiptap.dev/) with Yjs extension
- [ProseMirror](https://prosemirror.net/) with `y-prosemirror`

**Why?** Text editing requires specialized CRDTs (Y.Text) with cursor tracking, formatting, and undo/redo. These editors have battle-tested integrations.

valtio-y is for **shared application state** (objects, arrays, primitives), not building text editors.

#### 2. Server-Authoritative Apps

**Use traditional client-server architecture:**

- **Banking** - Server must validate all transactions
- **E-commerce** - Inventory must be centrally managed
- **Authentication** - Server controls access

**Why?** These apps require a single source of truth. CRDTs distribute authority.

#### 3. Simple CRUD Apps

**Use REST/GraphQL:**

- **Blogs** - Simple create/read/update/delete
- **News sites** - Content consumption
- **Static dashboards** - Read-only data

**Why?** If you don't need real-time collaboration, simpler approaches work fine.

### Comparison with Other Approaches

| Approach                  | Real-time | Offline | Conflicts | Complexity |
| ------------------------- | --------- | ------- | --------- | ---------- |
| **valtio-y**              | ✅ Yes    | ✅ Yes  | ✅ Auto   | Low        |
| **REST API**              | ❌ No     | ❌ No   | ❌ Manual | Low        |
| **WebSockets**            | ✅ Yes    | ❌ No   | ❌ Manual | Medium     |
| **GraphQL Subscriptions** | ✅ Yes    | ❌ No   | ❌ Manual | Medium     |
| **Operational Transform** | ✅ Yes    | ⚠️ Hard | ⚠️ Hard   | High       |
| **Plain Yjs**             | ✅ Yes    | ✅ Yes  | ✅ Auto   | Medium     |

**When to choose valtio-y:**

- You need real-time collaboration
- You want offline support
- You're using React and Valtio
- You want minimal API surface
- You prefer local-first architecture

---

## Architectural Overview

### The Big Picture

```
┌─────────────────────────────────────────────────────────────┐
│                     Your React Components                    │
│                    (UI Layer - View Logic)                   │
└───────────────────────────┬─────────────────────────────────┘
                            │
                    useSnapshot(state)
                            │
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                      Valtio Proxy                            │
│              (Reactive State - Fine-grained)                 │
│                                                              │
│  state.todos[0].done = true  ← Your mutations               │
└───────────────────────────┬─────────────────────────────────┘
                            │
                    valtio-y Bridge
                    (Bidirectional Sync)
                            │
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                       Yjs CRDT Layer                         │
│              (Conflict-free Data Structures)                 │
│                                                              │
│  Y.Array, Y.Map ← CRDT operations                           │
└───────────────────────────┬─────────────────────────────────┘
                            │
                      Provider Layer
                (Network Abstraction)
                            │
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                    Network Transport                         │
│         (WebSocket / WebRTC / IndexedDB / etc.)             │
└───────────────────────────┬─────────────────────────────────┘
                            │
                    Other Users / Devices
                            │
                            ↓
┌─────────────────────────────────────────────────────────────┐
│              Remote Clients (Same Architecture)              │
└─────────────────────────────────────────────────────────────┘
```

### How Changes Flow

#### Local Change (You → Network)

```
1. User clicks button
        ↓
2. Event handler mutates state
   state.todos.push({ text: "Buy milk" })
        ↓
3. Valtio proxy intercepts
        ↓
4. valtio-y translates to CRDT operation
   yArray.push([{ text: "Buy milk" }])
        ↓
5. Batched into transaction (next microtask)
        ↓
6. Yjs updates internal CRDT state
        ↓
7. Provider sends update to network
        ↓
8. Other users receive update
```

#### Remote Change (Network → You)

```
1. Provider receives update from network
        ↓
2. Yjs applies update to CRDT
   (merges with local state)
        ↓
3. Yjs fires observeDeep event
        ↓
4. valtio-y reconciles Valtio proxy
   (updates proxy to match CRDT)
        ↓
5. Valtio notifies subscribers
        ↓
6. React components re-render
   (only components using changed data)
```

### Where Conflict Resolution Happens

**Conflict resolution occurs in the Yjs layer**, not in valtio-y or Valtio:

```
User A (offline)          User B (offline)
     │                         │
     │  state.count = 10       │  state.count = 20
     │         ↓                │         ↓
     │  Y.Map.set('count',10)  │  Y.Map.set('count',20)
     │                          │
     └──────────┬───────────────┘
                │
         Network sync
                │
                ↓
        ┌───────────────┐
        │  Yjs merges   │
        │  changes      │
        │  (CRDT math)  │
        └───────┬───────┘
                │
                ↓
        Deterministic result
        (e.g., count = 20)
                │
     ┌──────────┴──────────┐
     │                     │
User A sees 20        User B sees 20
```

**Key insight:** You never write conflict resolution code. Yjs handles it mathematically based on CRDT properties.

### The Controller Proxy Model

valtio-y uses a "live controller" architecture:

```
Traditional approach:
  Valtio State → Serialize → Send to Yjs → Sync

valtio-y approach:
  Valtio Proxy = Controller for Yjs Type
         │
         │ Direct commands
         ↓
      Yjs CRDT → Sync
```

Each Valtio proxy is a **live controller** that directly manipulates its corresponding Yjs type:

- **Y.Map** is controlled by an object proxy
- **Y.Array** is controlled by an array proxy
- **Nested structures** create nested controllers

This eliminates the "impedance mismatch" between Valtio's reactive model and Yjs's operational model.

### Performance Optimizations

valtio-y includes several automatic optimizations:

#### 1. Batching

All mutations in the same microtask are batched into one transaction:

```typescript
// These become ONE transaction
state.todos.push({ text: "Task 1" });
state.todos.push({ text: "Task 2" });
state.todos.push({ text: "Task 3" });
```

#### 2. Lazy Materialization

Proxies are created on-demand when you access properties:

```typescript
state.users = Array(10000).fill({ name: "User" });
// Fast: Only the array is proxied initially

const user = state.users[0];
// Now users[0] becomes a proxy
```

#### 3. Granular Updates

Only arrays with recorded deltas are updated granularly. Maps and new arrays are reconciled structurally for correctness.

---

## Next Steps

Now that you understand the core concepts, you're ready to:

1. **[Basic Operations](./basic-operations.md)** - Learn common patterns for objects, arrays, and nested structures
2. **[Performance Guide](./performance-guide.md)** - Optimize your collaborative apps
3. **[Read the Architecture Docs](../docs/architecture/architecture.md)** - Deep dive into implementation details
4. **[Try the Examples](../examples/)** - See real-world usage patterns
5. **[Join Discord](https://discord.gg/MrQdmzd)** - Get help and share your projects

**Questions or feedback?** [Open an issue](https://github.com/valtiojs/valtio-y/issues) or join the discussion!

---

**Key takeaway:** valtio-y makes collaborative state management feel like local state management. You write normal JavaScript, and the library handles all the complexity of sync, conflicts, and reactivity.
