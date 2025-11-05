# Core Concepts

valtio-y gives you local-first state that auto-syncs across users via Yjs CRDTs. You write normal JavaScript mutations, and the library handles all the complexity of sync, conflicts, and reactivity.

---

## What Problem Does This Solve?

**The challenge:** Building collaborative apps for structured data (forms, dashboards, boards) where multiple users edit simultaneously.

Traditional approaches require:

- Central server to coordinate every change (slow, breaks offline)
- Complex conflict resolution code (error-prone)
- Locks or turn-taking (poor UX)
- Network round-trips for every mutation (laggy)

**valtio-y's solution:** Write normal JavaScript. Get automatic sync and conflict resolution free.

```typescript
// This just works, even with 10 users editing simultaneously
state.todos.push({ text: "Buy milk", done: false });
state.todos[0].done = true;
state.user.name = "Alice";
```

No special APIs. No conflict handlers. No server coordination. Just mutate objects like you always have.

---

## What Are CRDTs and Yjs?

### CRDTs: Conflict-Free Replicated Data Types

A **CRDT** is a special data structure with a mathematical guarantee: **all replicas converge to the same state**, even when users make conflicting changes offline.

Think of it like Git for your app state:

```text
User A offline: ["Buy milk", "Walk dog"] + adds "Read book"
User B offline: ["Buy milk", "Walk dog"] + adds "Call mom"

After both sync: ["Buy milk", "Walk dog", "Read book", "Call mom"]
                 ↑ Both changes preserved, deterministic order
```

**Key properties:**

- **No coordination needed** - Users edit independently, changes merge automatically
- **Works offline** - Every user has a complete local copy
- **Deterministic** - Same operations always produce the same result
- **No data loss** - Concurrent changes are preserved, not overwritten

**Real-world example:** Google Docs uses CRDTs. That's how multiple people can type simultaneously without conflicts. valtio-y brings this to any framework Valtio supports.

### Yjs: A Production CRDT Library

**[Yjs](https://github.com/yjs/yjs)** is a mature CRDT implementation that provides:

- **Y.Map** - Like a JavaScript object/map
- **Y.Array** - Like a JavaScript array
- **Efficient sync** - Only sends deltas, not full state
- **Undo/redo** - Built-in time travel
- **Provider ecosystem** - WebSocket, WebRTC, IndexedDB, etc.

valtio-y wraps Yjs types with Valtio proxies, giving you the best of both worlds:

- Yjs handles sync and conflict resolution
- Valtio provides reactive state and fine-grained updates
- You write normal JavaScript

---

## The valtio-y Mental Model

Think of valtio-y as a **live controller** for your CRDT state:

```text
Your Code (mutations)
      ↓
Valtio Proxy (controller)
      ↓
valtio-y Bridge (scheduler + reconciler)
      ↓
Yjs Doc (CRDT)
      ↓
Provider (network)
```

### Key Insight: The Proxy is a Controller, Not a Snapshot

The Valtio proxy isn't a copy of your data—it's a **stateful controller** that directly operates on Yjs types:

```typescript
// When you mutate the proxy...
state.count = 42;

// ...it schedules a Yjs operation:
yMap.set("count", 42);

// When remote changes arrive...
// Remote: yMap.set("count", 100)

// ...the proxy reconciles automatically:
state.count === 100; // ✓ Updated
```

### Read vs Write: Snapshots vs Proxies

- **Read:** Use `useSnapshot(state)` in components for fine-grained reactivity
- **Write:** Mutate `state` directly (the proxy controller)

```typescript
function TodoItem() {
  const snap = useSnapshot(state); // Immutable snapshot for reading

  return (
    <div onClick={() => (state.todos[0].done = true)}>
      {/*             ^^^^^ Write to proxy */}
      {snap.todos[0].text}
      {/* ^^^^^ Read from snapshot */}
    </div>
  );
}
```

**Why this matters:**

- Snapshots track which properties you access → fine-grained re-renders
- Only components that read `todos[0].text` re-render when it changes
- Components that read `todos[1]` don't re-render (Valtio magic!)

### Local-First Behavior

```typescript
// Mutation is instant (no network wait)
state.todos.push({ text: "New task" }); // ← UI updates immediately

// Sync happens in background
// Other users see it soon after (milliseconds to seconds)

// Works offline
state.count++; // ← Still works!
// Changes queue up, sync when reconnected
```

**Mental model:** Your local state is the source of truth. Sync is opportunistic, not required.

---

## How Sync Works

### Example: Two Users Editing Simultaneously

Let's walk through what happens when Alice and Bob both edit a todo list:

#### Initial State (Both Users)

```typescript
state.todos = [
  { text: "Buy milk", done: false },
  { text: "Walk dog", done: false },
];
```

#### Alice (Offline): Marks first todo as done

```typescript
state.todos[0].done = true;
```

**What happens locally:**

1. Proxy intercepts mutation
2. Schedules Yjs operation: `yArray.get(0).set("done", true)`
3. UI updates instantly (no network wait)
4. Change queued for sync

#### Bob (Offline): Adds a new todo

```typescript
state.todos.push({ text: "Read book", done: false });
```

**What happens locally:**

1. Proxy intercepts mutation
2. Schedules Yjs operation: `yArray.insert(2, [newTodo])`
3. UI updates instantly
4. Change queued for sync

#### Both Come Online: Automatic Merge

```typescript
// Alice's state after sync:
state.todos = [
  { text: "Buy milk", done: true }, // ← Her change
  { text: "Walk dog", done: false },
  { text: "Read book", done: false }, // ← Bob's change merged in
];

// Bob's state after sync (identical):
state.todos = [
  { text: "Buy milk", done: true }, // ← Alice's change merged in
  { text: "Walk dog", done: false },
  { text: "Read book", done: false }, // ← His change
];
```

**No conflicts. No data loss. Deterministic convergence.**

### Lifecycle: Local Change → Remote Sync

```typescript
state.count++; // You mutate the proxy
```

**What happens under the hood:**

1. **Interception** - Proxy trap catches the mutation
2. **Scheduling** - Operation queued in write scheduler
3. **Batching** - All mutations in same microtask batched together
4. **Transaction** - Scheduler flushes: `doc.transact(() => yMap.set("count", 1))`
5. **Provider** - Sends update to network
6. **Remote peers** - Receive and merge (deterministic, conflict-free)

```text
You write:     state.count++
               ↓
Proxy:         Intercepts mutation
               ↓
Scheduler:     Batches operations (same microtask = one transaction)
               ↓
Yjs:           doc.transact(() => yMap.set("count", 1))
               ↓
Provider:      Broadcasts to network
               ↓
Other users:   Merge automatically
```

### Lifecycle: Remote Update → UI

```typescript
// Remote user: state.count = 100
```

**What happens on your machine:**

1. **Provider** - Receives update from network
2. **Yjs merge** - Deterministically merges into local CRDT
3. **Event** - Yjs fires deep observer event
4. **Reconciler** - valtio-y reconciles proxy structure to match Yjs
5. **Valtio** - Notifies subscribed components
6. **Framework** - Re-renders only affected components (fine-grained)

```text
Network:       Update arrives
               ↓
Yjs:           Merges into CRDT (conflict-free)
               ↓
Synchronizer:  Detects change via observeDeep
               ↓
Reconciler:    Updates proxy: state.count = 100
               ↓
Valtio:        Notifies subscribers
               ↓
React:         Re-renders components that read count
```

**Key machinery:**

- **Synchronizer** (`synchronizer.ts`) - Listens to Yjs events
- **Reconciler** (`reconcile/reconciler.ts`) - Ensures proxy matches Yjs structure
- **Write Scheduler** (`scheduling/write-scheduler.ts`) - Batches local mutations

---

## Building Blocks

### 1. Y.Doc + Root Type

The **Y.Doc** is your CRDT container. It holds multiple named structures.

```typescript
const ydoc = new Y.Doc();

// Choose which structure becomes your Valtio proxy
const { proxy: state } = createYjsProxy(ydoc, {
  getRoot: (doc) => doc.getMap("root"), // ← All clients must use same name
});
```

**Think of it like a database:**

- Y.Doc = database
- `doc.getMap("root")` = table name
- All clients must use the same "table name" to sync

**Common patterns:**

- **One root map** (recommended): `doc.getMap("root")` - structure everything inside
- **Direct array root**: `doc.getArray("todos")` - when entire app state is a list
- **Multiple roots** (advanced): Separate structures for specialized use cases

See [Structuring Your App](./structuring-your-app.md) for details.

### 2. Valtio Proxy (Controller)

The proxy is your **live controller** for the Yjs structure:

```typescript
state.users = [{ name: "Alice" }]; // Enqueues operation
const user = state.users[0]; // Materializes proxy for users[0]
user.name = "Bob"; // Enqueues nested operation
```

**Key behaviors:**

- **Lazy materialization** - Nested objects become proxies only when accessed (performance)
- **Identity preservation** - Same Yjs object always maps to same proxy reference
- **Automatic updates** - Reconciler ensures structure matches Yjs after remote changes

```typescript
// Large data loads fast (proxies created on-demand)
state.users = Array(10000).fill({ name: "User", data: {...} });

// Only accessed items become proxies
const user = state.users[0]; // ← NOW this becomes a proxy
user.name = "Alice";         // ← Mutations work
```

### 3. Providers (Network Adapters)

Providers sync your Y.Doc across clients:

```typescript
import { WebsocketProvider } from "y-websocket";

const provider = new WebsocketProvider(
  "ws://localhost:1234", // Server URL
  "my-room", // Room name (clients in same room sync)
  ydoc // Your Y.Doc
);
```

**Common providers:**

- **y-websocket** - Client-server sync (most common)
- **y-webrtc** - Peer-to-peer sync (no server needed)
- **y-indexeddb** - Offline persistence (browser storage)
- **y-partyserver** - Serverless real-time (PartyKit/Cloudflare)

### 4. Smart Operation Scheduling

This is where valtio-y's architecture really shines compared to simple proxy wrappers. The **write scheduler** is intelligent about how it translates your mutations into Yjs operations.

#### Automatic Batching

All mutations in the same microtask become **one transaction**:

```typescript
// These 100 mutations become ONE network update
for (let i = 0; i < 100; i++) {
  state.count++;
}
// ↑ Batched automatically into single transaction
```

**Why this matters:**

- **Reduces network traffic** - 100 mutations → 1 sync message
- **Improves performance** - Fewer Yjs operations, fewer re-renders
- **Atomic updates** - All changes apply together (no partial states)

#### Intelligent Operation Merging

The scheduler doesn't just batch—it **optimizes** operations:

```typescript
// You write:
state.todos[0] = { text: "Old" };
delete state.todos[0];
state.todos[0] = { text: "New" };

// Scheduler merges into: Replace at index 0 with "New"
// Not: Set, Delete, Set (wasteful)
```

**What the scheduler does:**

- **Deduplicates** - Multiple writes to same key/index merge into one
- **Cancels redundant ops** - Delete + Set at same index → Replace
- **Purges stale ops** - If parent is deleted, child operations are cancelled
- **Orders deterministically** - Deletes, then sets, then replaces (consistent across clients)

#### Handles Complex Scenarios

**Array moves:**

```typescript
// Move item from index 2 to 0
const [item] = state.todos.splice(2, 1); // Remove
state.todos.splice(0, 0, item); // Insert

// Scheduler intelligently handles the two operations
// Ensures item reference is preserved
```

**Nested replacements:**

```typescript
// Replace entire nested structure
state.users[0] = { name: "Alice", profile: { bio: "Developer" } };

// Scheduler:
// 1. Converts plain object to Y.Map
// 2. Replaces at index 0
// 3. Purges any pending operations on old nested structure
// 4. After transaction: upgrades plain object to live proxy
```

**Concurrent edits to same location:**

```typescript
// Same microtask:
state.todos[0].done = true;
state.todos[0].text = "Updated";
delete state.todos[0];
state.todos[0] = { text: "New", done: false };

// Scheduler intelligently merges:
// Final operation: Replace index 0 with new object
// Intermediate operations cancelled (no wasted work)
```

**This intelligence is what makes valtio-y production-ready.** You write imperative code, and the scheduler translates it into optimal CRDT operations.

---

## Conflict Behavior & Guarantees

### What Happens on Conflict?

#### Primitives: Last-Write-Wins

```typescript
// Alice: state.count = 5  (timestamp: 100)
// Bob:   state.count = 10 (timestamp: 101)

// After sync (both users):
state.count === 10; // ✓ Bob's write wins (later timestamp)
```

**Deterministic:** Same timestamps → same result on all clients.

#### Objects: Structural Merge

```typescript
// Alice: state.user.name = "Alice"
// Bob:   state.user.age = 30

// After sync (both users):
state.user === { name: "Alice", age: 30 };
// ↑ Both changes preserved (different keys)
```

**No data loss:** Changes to different properties merge cleanly.

#### Arrays: CRDT Merge

```typescript
// Initial: state.todos = ["Buy milk", "Walk dog"]

// Alice: state.todos.unshift({ text: "A's task" })
// Bob:   state.todos.unshift({ text: "B's task" })

// After sync (both users):
state.todos = [
  { text: "B's task" }, // ← Both items preserved
  { text: "A's task" }, // ← Deterministic order
  { text: "Buy milk" },
  { text: "Walk dog" },
];
```

**Concurrent inserts:** Both preserved with stable ordering.

### Guarantees

✅ **Convergence** - All clients eventually see the same state (strong eventual consistency)

✅ **Determinism** - Same operations in any order produce the same result

✅ **Identity preservation** - Same Yjs object always maps to same proxy reference

✅ **No data loss** - Remote changes never overwrite local changes (CRDT merge)

✅ **Batching** - All mutations in same microtask become one transaction

**Tested in:** `integration/yjs-to-valtio.spec.ts`, `integration/valtio-to-yjs.spec.ts`, `integration/array-operations-detailed.spec.ts`

---

## When valtio-y Fits

valtio-y excels when you need **automatic conflict resolution** for **structured data**:

- **Form builders** - Drag-and-drop interfaces, field configuration
- **Kanban/project boards** - Task management, card reordering
- **Dashboard configurators** - Widget placement, real-time layout adjustments
- **Multiplayer game state** - Player positions, inventory, world state
- **Data annotation tools** - Labeling, categorization, collaborative markup
- **Configuration panels** - Settings that multiple users adjust simultaneously

**Rule of thumb:** If conflicts must resolve automatically without user intervention, valtio-y is a good fit.

---

**Key takeaway:** valtio-y makes collaborative state management feel like local state management. You write normal JavaScript, and the library handles all the complexity of sync, conflicts, and reactivity.
