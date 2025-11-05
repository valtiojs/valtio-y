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

**The Problem:** When two users edit shared data simultaneously, traditional approaches require a central server, locks, complex conflict resolution, and network round-trips. This breaks down offline, with slow networks, or during server outages.

**The Solution:** **CRDT** (Conflict-free Replicated Data Type) is a special data structure that:

- Works offline - every user has a complete local copy
- Merges automatically - changes combine deterministically
- Converges - all users eventually see the same state
- No coordination needed - no central server deciding conflicts

Think of it like Git for your app state. CRDTs use mathematical properties to ensure merging always produces the same result, regardless of order:

```text
User A: ["Buy milk", "Walk dog"] + "Read book"
User B: ["Buy milk", "Walk dog"] + "Call mom"
After sync: ["Buy milk", "Walk dog", "Read book", "Call mom"]
```

Both users end up with the same state, even when making changes simultaneously. **Google Docs** uses CRDTs - that's how multiple people can edit simultaneously without conflicts. valtio-y brings this to React.

---

## How valtio-y Works

valtio-y bridges **[Valtio](https://github.com/pmndrs/valtio)** (reactive React state) and **[Yjs](https://github.com/yjs/yjs)** (CRDT collaboration):

```text
React Components → Valtio Proxy → valtio-y Bridge → Yjs CRDT → Network
```

**When you mutate state:**

1. Valtio proxy intercepts your change
2. valtio-y translates it to a CRDT operation
3. Changes are batched (same tick = one transaction)
4. Syncs through provider to other users
5. React components re-render (fine-grained - only affected components)

**When remote changes arrive:**

1. Network update received
2. Yjs merges with local CRDT (conflict-free)
3. valtio-y reconciles Valtio proxy
4. React re-renders affected components

**You just write:**

```typescript
state.todos.push({ text: "Buy milk" }); // Syncs automatically
state.todos[0].done = true; // Syncs automatically
```

**Key principle:** Read from snapshots (`useSnapshot`), write to proxies (`state`). Valtio tracks which properties each component accesses and only re-renders when those specific properties change.

---

## The valtio-y Mental Model

**Think:** Local-first database with automatic sync

- State is stored locally (instant reads/writes)
- Changes persist to a CRDT (automatic conflict resolution)
- Syncing happens in background (no network round-trips)
- Works offline, syncs when online

**Your local state is the source of truth:**

```typescript
state.todos.push({ text: "New task" }); // Instant UI update
// Sync happens in background
// Other users see it soon after
```

**Conflicts resolve deterministically:**

- Primitives: Last-write-wins (predictable)
- Collections: CRDTs merge changes intelligently

```typescript
// Both users add to index 0 simultaneously
// After sync: Both items exist, order is deterministic
// ["B's task", "A's task", ...original]
```

**You never write sync code or handle conflicts** - CRDTs merge changes mathematically.

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
state.count++; // Correct approach

// Never mutate the snapshot
snap.count++; // This fails because snapshots are immutable
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

**Perfect for:**

- **Collaborative tools** - Todo lists, dashboards, project management, design tools
- **Multiplayer games** - Turn-based games, shared worlds (see Minecraft example)
- **Offline-first apps** - Mobile apps, PWAs that sync when online
- **Multi-device sync** - Note-taking, settings, bookmarks across devices

**Not ideal for:**

- **Text editors** - Use native Yjs integrations ([Lexical](https://lexical.dev/), [TipTap](https://tiptap.dev/), [ProseMirror](https://prosemirror.net/)) with specialized text CRDTs
- **Server-authoritative apps** - Banking, e-commerce, auth (require single source of truth)
- **Simple CRUD** - Blogs, news sites (REST/GraphQL is simpler)

**Choose valtio-y when you need:** Real-time collaboration + offline support + React/Valtio + minimal API + local-first architecture

---

## Architectural Overview

**High-level flow:**

```text
React Components
      ↓ (useSnapshot)
  Valtio Proxy (state.todos)
      ↓ (valtio-y bridge)
  Yjs CRDT (Y.Array)
      ↓ (provider)
  Network → Other Users
```

**Local changes:** You mutate state → Valtio proxy intercepts → valtio-y translates to CRDT → Batched in transaction → Syncs to network

**Remote changes:** Network update arrives → Yjs merges (conflict-free) → valtio-y reconciles proxy → React re-renders affected components

**Key insight:** Conflicts resolve automatically in the Yjs CRDT layer using mathematical properties. You never write conflict resolution code.

**For deep dive:** See [Architecture Docs](../docs/architecture/architecture.md)

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
