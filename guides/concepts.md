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

## What Are CRDTs?

A **CRDT** (Conflict-Free Replicated Data Type) is a data structure with a mathematical guarantee: **all replicas converge to the same state**, even when users make conflicting changes offline.

Think of it like Git for your app state:

```text
User A offline: ["Buy milk", "Walk dog"] + adds "Read book"
User B offline: ["Buy milk", "Walk dog"] + adds "Call mom"

After both sync: ["Buy milk", "Walk dog", "Read book", "Call mom"]
                 ↑ Both changes preserved, deterministic order
```

**Key properties:**

- No coordination needed - Users edit independently, changes merge automatically
- Works offline - Every user has a complete local copy
- Deterministic - Same operations always produce the same result

**[Yjs](https://github.com/yjs/yjs)** is a production CRDT library that provides Y.Map (objects), Y.Array (arrays), and efficient delta-based sync. valtio-y wraps Yjs with Valtio proxies, giving you reactive state with CRDT conflict resolution

---

## The valtio-y Mental Model

Think of valtio-y as a **live controller** for your CRDT state:

```text
Your Code (mutations)
      ↓
Valtio Proxy (controller) ←→ Yjs Doc (CRDT) ←→ Provider (network)
```

### Key Insight: The Proxy is a Controller, Not a Snapshot

The Valtio proxy isn't a copy of your data—it's a **stateful controller** that directly operates on Yjs types:

```typescript
// When you mutate the proxy...
state.count = 42; // → Schedules: yMap.set("count", 42)

// When remote changes arrive...
// Remote: yMap.set("count", 100)
state.count === 100; // ✓ Proxy reconciles automatically
```

### Read vs Write: Snapshots vs Proxies

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

**Why this matters:** Snapshots track which properties you access → only components that read `todos[0].text` re-render when it changes. Components reading `todos[1]` don't re-render.

### Local-First Behavior

```typescript
// Mutation is instant (no network wait)
state.todos.push({ text: "New task" }); // ← UI updates immediately

// Sync happens in background (milliseconds to seconds)
// Works offline - changes queue up, sync when reconnected
```

**Mental model:** Your local state is the source of truth. Sync is opportunistic, not required.

---

## How It Works: Intelligence Under the Hood

valtio-y doesn't just naively forward mutations to Yjs—it's **intelligent** about optimization and conflict resolution.

### Automatic Batching

All mutations in the same microtask become **one transaction**:

```typescript
// These 100 mutations become ONE network update
for (let i = 0; i < 100; i++) {
  state.count++;
}
// ↑ Batched automatically into single Yjs transaction
```

**Benefits:** Reduces network traffic (100 mutations → 1 message), improves performance, ensures atomic updates.

### Operation Merging & Optimization

The scheduler doesn't just batch—it **optimizes** operations:

```typescript
// You write multiple conflicting operations:
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
- **Orders deterministically** - Deletes, then sets, then replaces

### Complex Scenarios Handled

**Array moves:**

```typescript
// Move item from index 2 to 0
const [item] = state.todos.splice(2, 1); // Remove
state.todos.splice(0, 0, item); // Insert
// ↑ Scheduler intelligently handles the two operations
```

**Nested replacements:**

```typescript
// Replace entire nested structure
state.users[0] = { name: "Alice", profile: { bio: "Developer" } };
// Scheduler converts plain object to Y.Map, replaces at index 0,
// purges pending operations on old structure, upgrades to live proxy
```

### Conflict Resolution

#### Primitives: Last-Write-Wins

```typescript
// Alice: state.count = 5  (timestamp: 100)
// Bob:   state.count = 10 (timestamp: 101)
// After sync: state.count === 10 (Bob's write wins, deterministic)
```

#### Objects: Structural Merge

```typescript
// Alice: state.user.name = "Alice"
// Bob:   state.user.age = 30
// After sync: { name: "Alice", age: 30 } (both changes preserved)
```

#### Arrays: CRDT Merge

```typescript
// Initial: state.todos = ["Buy milk", "Walk dog"]
// Alice: state.todos.unshift({ text: "A's task" })
// Bob:   state.todos.unshift({ text: "B's task" })
// After sync: [{ text: "B's task" }, { text: "A's task" }, "Buy milk", "Walk dog"]
// ↑ Both items preserved, deterministic order
```

### The Two Lifecycles

**Local mutation → Network:**

```text
state.count++ → Proxy intercepts → Scheduler batches → Yjs transaction → Provider broadcasts
```

**Remote update → UI:**

```text
Network update → Yjs merges → Synchronizer detects → Reconciler updates proxy → Valtio notifies → Components re-render
```

**This intelligence is what makes valtio-y performant.** You write imperative code, and the scheduler translates it into optimal CRDT operations

---

## Building Blocks

### Y.Doc + Root Type

The **Y.Doc** is your CRDT container. All clients must use the same root structure name to sync:

```typescript
const ydoc = new Y.Doc();

const { proxy: state } = createYjsProxy(ydoc, {
  getRoot: (doc) => doc.getMap("root"), // ← All clients must use same name
});
```

**Common patterns:**

- **One root map** (recommended): `doc.getMap("root")` - structure everything inside
- **Direct array root**: `doc.getArray("todos")` - when entire app state is a list

See [Structuring Your App](./structuring-your-app.md) for details.

### Valtio Proxy (Controller)

The proxy is your **live controller** for the Yjs structure:

```typescript
state.users = [{ name: "Alice" }]; // Enqueues operation (batched)
await tick(); // Operations flush: plain JS → Y types → Valtio proxies
const user = state.users[0]; // ← Access existing proxy
user.name = "Bob"; // Enqueues nested operation
```

**Key behaviors:**

- **Stable references** - Same Y type always maps to same proxy (cached in WeakMap)
- **Batched conversion** - Plain objects become proxies during transaction flush
- **Automatic updates** - Reconciler ensures structure matches Yjs after remote changes

### Providers (Network Adapters)

Providers sync your Y.Doc across clients:

```typescript
import { WebsocketProvider } from "y-websocket";

const provider = new WebsocketProvider(
  "ws://localhost:1234", // Server URL
  "my-room", // Room name
  ydoc
);
```

**Common providers:**

- **y-websocket** - Client-server sync
- **y-webrtc** - Peer-to-peer sync
- **y-indexeddb** - Offline persistence
- **y-partyserver** - Serverless real-time (PartyKit/Cloudflare)

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
