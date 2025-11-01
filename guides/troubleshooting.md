# Troubleshooting Guide

Having issues with valtio-y? This guide covers common problems and their solutions. Use your browser's search (Ctrl+F / Cmd+F) to find error messages.

---

## Table of Contents

1. [Setup & Installation Issues](#setup--installation-issues)
2. [Sync & Connection Issues](#sync--connection-issues)
3. [React Integration Issues](#react-integration-issues)
4. [State Mutation Issues](#state-mutation-issues)
5. [Provider-Specific Issues](#provider-specific-issues)
6. [Performance Issues](#performance-issues)
7. [Type Safety Issues](#type-safety-issues)
8. [Debugging Techniques](#debugging-techniques)

---

## Setup & Installation Issues

### Problem: Module not found error

**Symptoms:**

```
Error: Cannot find module 'valtio-y'
Module not found: Can't resolve 'valtio'
Module not found: Can't resolve 'yjs'
```

**Cause:**
Missing peer dependencies or incorrect installation.

**Solution:**

```bash
# Install all required packages
npm install valtio-y valtio yjs

# Or with pnpm
pnpm add valtio-y valtio yjs

# Or with bun
bun add valtio-y valtio yjs
```

Check your `package.json` includes:

```json
{
  "dependencies": {
    "valtio": ">=2.1.8",
    "valtio-y": "^1.0.0",
    "yjs": ">=13.6.27"
  }
}
```

**Additional notes:**

- valtio-y requires **both** `valtio` and `yjs` as peer dependencies
- Minimum versions: Valtio 2.1.8+, Yjs 13.6.27+

---

### Problem: Type errors with TypeScript

**Symptoms:**

```typescript
Property 'proxy' does not exist on type 'unknown'
Type 'YDoc' is not assignable to parameter of type 'Doc'
```

**Cause:**
Missing TypeScript types or incorrect imports.

**Solution:**

```typescript
// ✅ Correct imports
import * as Y from "yjs";
import { createYjsProxy } from "valtio-y";
import { useSnapshot } from "valtio";

// Define your state type
type AppState = {
  todos: Array<{ text: string; done: boolean }>;
};

// Create typed proxy
const { proxy } = createYjsProxy<AppState>(doc, {
  getRoot: (doc) => doc.getMap("state"),
});
```

**Additional notes:**

- Always import Yjs as `* as Y from "yjs"` for proper typing
- Use generic types with `createYjsProxy<YourType>()` for type inference
- Ensure `@types/node` is installed if building for Node.js

---

### Problem: Build errors with bundlers

**Symptoms:**

```
Can't resolve 'lib0/encoding'
Failed to parse source map
export 'default' (imported as 'Y') was not found in 'yjs'
```

**Cause:**
Bundler configuration issues with ESM/CommonJS or Yjs internals.

**Solution for Vite:**

```javascript
// vite.config.js
export default {
  optimizeDeps: {
    include: ["yjs", "valtio", "valtio-y"],
  },
};
```

**Solution for Webpack:**

```javascript
// webpack.config.js
module.exports = {
  resolve: {
    alias: {
      yjs: path.resolve(__dirname, "node_modules/yjs"),
    },
    fallback: {
      crypto: false,
      fs: false,
    },
  },
};
```

**Solution for Next.js:**

```javascript
// next.config.js
module.exports = {
  transpilePackages: ["yjs", "valtio-y"],
  webpack: (config) => {
    config.resolve.fallback = { fs: false };
    return config;
  },
};
```

**Additional notes:**

- Yjs uses ESM, ensure your bundler supports it
- Source maps for Yjs are often incomplete - this is normal
- For SSR apps, Yjs providers (WebSocket, WebRTC) should only run on client

---

## Sync & Connection Issues

### Problem: Changes not syncing between clients

**Symptoms:**

- Updates in one client don't appear in another
- State diverges between clients
- Only initial state syncs

**Cause:**
Usually a provider setup issue or same-origin transactions.

**Solution:**

**Check 1: Provider is properly connected**

```typescript
import { WebsocketProvider } from "y-websocket";

const provider = new WebsocketProvider(
  "ws://localhost:1234",
  "room-name",
  ydoc
);

// Listen to connection status
provider.on("status", (event: { status: string }) => {
  console.log("Connection status:", event.status); // 'connected' | 'disconnected'
});

// Check if synced
provider.on("synced", (synced: boolean) => {
  console.log("Initial sync complete:", synced);
});
```

**Check 2: Create proxy BEFORE provider connects**

```typescript
// ✅ Correct order
const ydoc = new Y.Doc();
const { proxy } = createYjsProxy(ydoc, {
  getRoot: (doc) => doc.getMap("state"),
});

// Provider connects AFTER proxy is created
const provider = new WebsocketProvider("ws://localhost:1234", "room", ydoc);
```

**Check 3: Use unique room names**

```typescript
// ❌ Bad - all users in same default room
const provider = new WebsocketProvider("ws://localhost:1234", "default", ydoc);

// ✅ Good - each document has unique room
const roomId = "project-123";
const provider = new WebsocketProvider("ws://localhost:1234", roomId, ydoc);
```

**Additional notes:**

- Ensure your WebSocket server is running and accessible
- Check browser console for WebSocket connection errors
- Use same room name across clients to sync
- Provider must stay alive - don't dispose it prematurely

---

### Problem: WebSocket connection errors

**Symptoms:**

```
WebSocket connection to 'ws://localhost:1234' failed
Connection closed before receiving a handshake response
net::ERR_CONNECTION_REFUSED
```

**Cause:**
WebSocket server not running or incorrect URL.

**Solution:**

**Start WebSocket server:**

```bash
# Using y-websocket server
npx y-websocket-server

# Or using custom port
npx y-websocket-server --port 1234
```

**Check connection URL:**

```typescript
// ❌ Common mistakes
new WebsocketProvider("http://localhost:1234", "room", ydoc); // Wrong protocol
new WebsocketProvider("localhost:1234", "room", ydoc); // Missing protocol
new WebsocketProvider("ws://localhost", "room", ydoc); // Missing port

// ✅ Correct
new WebsocketProvider("ws://localhost:1234", "room", ydoc);
```

**For production with HTTPS:**

```typescript
// Use wss:// for secure WebSocket
const wsUrl =
  window.location.protocol === "https:"
    ? "wss://your-server.com"
    : "ws://localhost:1234";

const provider = new WebsocketProvider(wsUrl, "room", ydoc);
```

**Additional notes:**

- HTTP sites use `ws://`, HTTPS sites must use `wss://`
- Check firewall settings allow WebSocket connections
- For development, ensure WebSocket server started before client

---

### Problem: CORS errors with WebSocket

**Symptoms:**

```
Cross-Origin Request Blocked
Access to WebSocket blocked by CORS policy
```

**Cause:**
Server doesn't allow connections from your origin.

**Solution:**

**For y-websocket server:**

```javascript
// server.js
import { WebSocketServer } from "ws";
import * as Y from "yjs";

const wss = new WebSocketServer({
  port: 1234,
  // Allow all origins (development only!)
  perMessageDeflate: false,
  clientTracking: true,
});

// For production, specify allowed origins
const wss = new WebSocketServer({
  port: 1234,
  verifyClient: (info) => {
    const origin = info.origin;
    return origin === "https://your-app.com";
  },
});
```

**Additional notes:**

- WebSocket CORS is different from HTTP CORS
- For local development, ensure server and client use same hostname (both `localhost` or both `127.0.0.1`)
- Consider using PartyKit or similar services that handle CORS automatically

---

### Problem: Initial state not loading

**Symptoms:**

- State appears empty on first load
- Remote state gets overwritten by local state
- Race condition on initial sync

**Cause:**
Initializing state before provider syncs.

**Solution:**

```typescript
import { WebsocketProvider } from "y-websocket";

const ydoc = new Y.Doc();
const provider = new WebsocketProvider("ws://localhost:1234", "room", ydoc);

const { proxy, bootstrap } = createYjsProxy(ydoc, {
  getRoot: (doc) => doc.getMap("state"),
});

// ❌ Bad - overwrites remote state
if (!proxy.todos) {
  proxy.todos = [];
}

// ✅ Good - wait for sync, then bootstrap if empty
provider.on("synced", () => {
  bootstrap({
    todos: [],
    settings: { theme: "light" },
  });
  // bootstrap() only writes if document is empty
});
```

**Additional notes:**

- `bootstrap()` is idempotent - safe to call on already-initialized docs
- For offline-first apps without network sync, direct assignment is fine
- Always wait for `synced` event before bootstrapping with network providers

---

### Problem: Race conditions on startup

**Symptoms:**

- Intermittent sync failures
- Sometimes state loads, sometimes doesn't
- Different behavior on refresh

**Cause:**
Asynchronous provider connection and state initialization.

**Solution:**

```typescript
// ✅ Proper initialization flow
const ydoc = new Y.Doc();
const provider = new WebsocketProvider("ws://localhost:1234", "room", ydoc);

const { proxy, bootstrap } = createYjsProxy(ydoc, {
  getRoot: (doc) => doc.getMap("state"),
});

// Track connection state
let isReady = false;

provider.on("synced", () => {
  if (!isReady) {
    isReady = true;

    // Initialize only after sync
    bootstrap({
      todos: [],
      users: [],
    });

    // Now safe to render app
    renderApp();
  }
});

// Show loading state until ready
function renderApp() {
  if (!isReady) {
    return <div>Connecting...</div>;
  }
  return <App state={proxy} />;
}
```

**Additional notes:**

- Consider using a loading state in React while waiting for sync
- Handle reconnection scenarios gracefully
- See [offline-sync guide](./offline-sync.md) for robust patterns

---

## React Integration Issues

### Problem: Components not re-rendering

**Symptoms:**

- State changes don't trigger UI updates
- Components show stale data
- Manual refresh needed to see changes

**Cause:**
Not using `useSnapshot()` or accessing nested properties incorrectly.

**Solution:**

```typescript
import { useSnapshot } from "valtio";

// ❌ Bad - accessing proxy directly
function TodoList() {
  return (
    <ul>
      {proxy.todos.map(
        (
          todo // Won't re-render!
        ) => (
          <li key={todo.id}>{todo.text}</li>
        )
      )}
    </ul>
  );
}

// ✅ Good - use snapshot for reads
function TodoList() {
  const snap = useSnapshot(proxy);

  return (
    <ul>
      {snap.todos.map((todo, index) => (
        // Use snap for reading, proxy for writing
        <li key={todo.id}>
          <span>{todo.text}</span>
          <button onClick={() => (proxy.todos[index].done = true)}>
            Complete
          </button>
        </li>
      ))}
    </ul>
  );
}
```

**Important pattern:**

```typescript
// ✅ Access snapshot for the data, proxy for mutations
function TodoItem({ todo, proxy, index }) {
  const snap = useSnapshot(todo); // Snapshot for reading

  return (
    <div>
      <span>{snap.text}</span> {/* Read from snapshot */}
      <button onClick={() => (proxy[index].done = true)}>
        {" "}
        {/* Write to proxy */}
        Complete
      </button>
    </div>
  );
}
```

**Additional notes:**

- Always use `useSnapshot()` for reading reactive state
- Use the original `proxy` for mutations (writes)
- Snapshots are immutable - never mutate snapshot values

---

### Problem: Too many re-renders

**Symptoms:**

```
Error: Too many re-renders. React limits the number of renders to prevent an infinite loop.
Maximum update depth exceeded
```

**Cause:**
Creating new snapshots or mutating state during render.

**Solution:**

```typescript
// ❌ Bad - creates new snapshot on every render
function TodoList() {
  const snap = useSnapshot(proxy.todos); // Don't snapshot array directly

  // ...
}

// ✅ Good - snapshot root, access property
function TodoList() {
  const snap = useSnapshot(proxy);
  const todos = snap.todos; // Access property from snapshot

  // ...
}

// ❌ Bad - mutating during render
function TodoItem({ todo }) {
  const snap = useSnapshot(todo);

  // Don't do this during render!
  if (snap.needsUpdate) {
    todo.updated = true; // Causes infinite loop
  }

  return <div>{snap.text}</div>;
}

// ✅ Good - mutations in event handlers or effects
function TodoItem({ todo }) {
  const snap = useSnapshot(todo);

  useEffect(() => {
    if (snap.needsUpdate) {
      todo.updated = true;
    }
  }, [snap.needsUpdate]);

  return <div>{snap.text}</div>;
}
```

**Additional notes:**

- Only mutate in event handlers, effects, or callbacks
- Never mutate during render phase
- Snapshot the root object, not deeply nested properties

---

### Problem: Stale state in event handlers

**Symptoms:**

- Event handlers see old values
- Closures capture outdated state
- Buttons/inputs don't work correctly

**Cause:**
Closure capturing snapshot instead of proxy.

**Solution:**

```typescript
// ❌ Bad - captures stale snapshot
function TodoItem({ todo }) {
  const snap = useSnapshot(todo);

  const handleClick = () => {
    console.log(snap.done); // Stale value!
    snap.done = !snap.done; // ❌ Can't mutate snapshot
  };

  return <button onClick={handleClick}>{snap.text}</button>;
}

// ✅ Good - always read from proxy for latest value
function TodoItem({ todo }) {
  const snap = useSnapshot(todo);

  const handleClick = () => {
    console.log(todo.done); // ✅ Latest value
    todo.done = !todo.done; // ✅ Mutate proxy
  };

  return <button onClick={handleClick}>{snap.text}</button>;
}

// ✅ Also good - read current snapshot value for display
function TodoItem({ todo }) {
  const snap = useSnapshot(todo);

  const handleToggle = () => {
    // Read from proxy (current), write to proxy
    todo.done = !todo.done;
  };

  return (
    <label>
      <input type="checkbox" checked={snap.done} onChange={handleToggle} />
      {snap.text}
    </label>
  );
}
```

**Additional notes:**

- Use snapshot for reactive reads in render
- Use proxy for mutations in event handlers
- Never mutate snapshot values (they're immutable)

---

### Problem: Key warnings with lists

**Symptoms:**

```
Warning: Each child in a list should have a unique "key" prop
Warning: Encountered two children with the same key
```

**Cause:**
Using array index as key or non-unique IDs.

**Solution:**

```typescript
// ❌ Bad - using index as key
function TodoList() {
  const snap = useSnapshot(proxy);

  return (
    <ul>
      {snap.todos.map((todo, i) => (
        <li key={i}>{todo.text}</li> // Bad: index changes on reorder
      ))}
    </ul>
  );
}

// ✅ Good - stable unique IDs
type Todo = {
  id: string; // Unique stable ID
  text: string;
  done: boolean;
};

function TodoList() {
  const snap = useSnapshot(proxy);

  return (
    <ul>
      {snap.todos.map((todo) => (
        <li key={todo.id}>{todo.text}</li> // Stable across reorders
      ))}
    </ul>
  );
}

// Generate unique IDs
function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

function addTodo(text: string) {
  proxy.todos.push({
    id: generateId(),
    text,
    done: false,
  });
}
```

**Additional notes:**

- Always use stable, unique IDs for list items
- IDs should not change when items are reordered
- For collaborative apps, include client ID in generated IDs to avoid collisions

---

## State Mutation Issues

### Problem: undefined values causing errors

**Symptoms:**

```
Error: [valtio-y] undefined is not allowed in objects for shared state
Cannot read property of undefined
```

**Cause:**
valtio-y doesn't support `undefined` values (use `null` instead).

**Solution:**

```typescript
// ❌ Bad - undefined not allowed
proxy.user = {
  name: "Alice",
  email: undefined, // Error!
};

// ✅ Good - use null for absent values
proxy.user = {
  name: "Alice",
  email: null,
};

// ✅ Also good - omit optional properties
proxy.user = {
  name: "Alice",
  // email not set
};

// ❌ Bad - assigning undefined
proxy.count = undefined; // Converts to null automatically

// ✅ Good - delete property or use null
delete proxy.count;
// or
proxy.count = null;
```

**Why undefined isn't supported:**

- JSON doesn't distinguish between `undefined` and omitted keys
- Yjs serialization uses JSON-like format
- CRDTs need deterministic serialization

**Additional notes:**

- Top-level `undefined` assignments convert to `null` automatically
- Nested `undefined` in objects throws validation error
- Use `delete` to remove properties entirely

---

### Problem: Direct array length manipulation

**Symptoms:**

```
// Array length changes don't sync correctly
// Sparse arrays created unintentionally
// Unexpected behavior with array.length = N
```

**Cause:**
Direct `length` manipulation not supported (by design).

**Solution:**

```typescript
// ❌ Not supported - direct length manipulation
proxy.items.length = 0; // Clear array - DON'T DO THIS
proxy.items.length = 5; // Extend array - DON'T DO THIS
proxy.items.length = 2; // Truncate array - DON'T DO THIS

// ✅ Use splice instead
proxy.items.splice(0); // Clear array
proxy.items.splice(2); // Truncate to 2 items
proxy.items.splice(5, 0, ...Array(5 - proxy.items.length).fill(null)); // Extend

// ✅ Better alternatives
// Clear array
proxy.items = [];

// Remove items
proxy.items.splice(index, deleteCount);

// Truncate
while (proxy.items.length > targetLength) {
  proxy.items.pop();
}
```

**Why this limitation exists:**

- Y.Array doesn't support sparse arrays
- Direct length changes during concurrent edits create ambiguous scenarios
- CRDT semantics require explicit operations
- See [limitations.md](../docs/architecture/limitations.md) for details

**Additional notes:**

- Use standard array methods: `push`, `pop`, `splice`, `shift`, `unshift`
- Direct index assignment works: `arr[0] = value`
- Delete operator works: `delete arr[2]` (converts to splice internally)

---

### Problem: Functions or class instances in state

**Symptoms:**

```
Error: Unable to convert function
Error: Unable to convert non-plain object of type "CustomClass"
Error: Unable to convert non-plain object of type "Map"
```

**Cause:**
Only serializable data allowed (primitives, plain objects, arrays).

**Solution:**

```typescript
// ❌ Bad - functions not allowed
proxy.todos = [
  {
    text: "Task",
    onClick: () => console.log("clicked"), // Error!
  },
];

// ✅ Good - keep logic separate from state
const handlers = {
  onTodoClick: (id: string) => console.log("clicked", id),
};

proxy.todos = [
  {
    id: "1",
    text: "Task",
    // No function stored
  },
];

// ❌ Bad - class instances not allowed
class User {
  constructor(public name: string) {}
  greet() {
    return `Hello ${this.name}`;
  }
}
proxy.user = new User("Alice"); // Error!

// ✅ Good - plain objects only
proxy.user = {
  name: "Alice",
  // Methods live outside state
};

function greet(user: { name: string }) {
  return `Hello ${user.name}`;
}

// ❌ Bad - built-in objects not allowed
proxy.users = new Map([["1", { name: "Alice" }]]); // Error!
proxy.tags = new Set(["todo", "urgent"]); // Error!
proxy.created = new Date(); // Error!

// ✅ Good - convert to serializable formats
proxy.users = { "1": { name: "Alice" } }; // Plain object
proxy.tags = ["todo", "urgent"]; // Array
proxy.created = new Date().toISOString(); // String
```

**Allowed types:**

- ✅ Primitives: `string`, `number`, `boolean`, `null`
- ✅ Plain objects: `{ key: value }`
- ✅ Arrays: `[item1, item2]`
- ✅ Nested combinations of above

**Not allowed:**

- ❌ `undefined` (use `null`)
- ❌ Functions
- ❌ Symbols
- ❌ BigInt
- ❌ `Infinity`, `-Infinity`, `NaN`
- ❌ Class instances
- ❌ Map, Set, WeakMap, WeakSet
- ❌ Date, RegExp (convert to strings first)

**Additional notes:**

- Store only data in state, not behavior
- Convert special types explicitly (Date → ISO string, RegExp → string)
- Keep methods and event handlers outside shared state

---

### Problem: Sparse arrays

**Symptoms:**

```
// Array with "holes" doesn't sync correctly
// Unexpected null values appear
```

**Cause:**
Sparse arrays not supported by Y.Array.

**Solution:**

```typescript
// ❌ Bad - creates sparse array
const arr = ["a", "b", "c"];
arr.length = 5; // Creates holes
console.log(arr); // ["a", "b", "c", empty × 2]

// ✅ Good - explicit null values
const arr = ["a", "b", "c", null, null];

// ❌ Bad - delete creates hole
delete proxy.items[1]; // Creates hole

// ✅ Good - splice removes item
proxy.items.splice(1, 1); // Properly removes item
```

**Additional notes:**

- JavaScript sparse arrays are a quirk that don't map to CRDTs
- JSON serializes sparse arrays as null-filled anyway
- Use explicit `null` values if you need "empty" slots

---

### Problem: Deep nesting performance

**Symptoms:**

- Slow updates with deeply nested objects (10+ levels)
- UI lag when editing nested properties

**Cause:**
Each level creates a proxy; deep nesting adds overhead.

**Solution:**

```typescript
// ❌ Avoid excessive nesting
proxy.data.level1.level2.level3.level4.level5.value = "deep";

// ✅ Flatten structure where possible
proxy.data = {
  level1_level2_level3: {
    value: "flattened",
  },
};

// ✅ Cache references in loops
// Bad
for (let i = 0; i < 1000; i++) {
  proxy.users[i].profile.settings.theme = "dark"; // Nested access 1000x
}

// Good
for (let i = 0; i < 1000; i++) {
  const settings = proxy.users[i].profile.settings;
  settings.theme = "dark"; // Cache reference
}
```

**Additional notes:**

- valtio-y handles reasonable nesting (5-7 levels) well
- Beyond 10 levels, consider restructuring your data model
- Use refs to cache deeply nested objects in loops

---

## Provider-Specific Issues

### Problem: y-websocket connection problems

**Symptoms:**

```
WebSocket connection failed
Reconnecting constantly
Messages not syncing
```

**Common solutions:**

**Check server is running:**

```bash
# Start y-websocket server
npx y-websocket-server --port 1234
```

**Check client configuration:**

```typescript
import { WebsocketProvider } from "y-websocket";

const provider = new WebsocketProvider(
  "ws://localhost:1234", // Correct URL format
  "my-room", // Room name
  ydoc, // Y.Doc instance
  {
    connect: true, // Auto-connect (default: true)
    params: {}, // Optional query params
  }
);

// Monitor connection
provider.on("status", ({ status }: { status: string }) => {
  console.log("Status:", status); // 'connecting' | 'connected' | 'disconnected'
});

provider.on("connection-error", (error: Error) => {
  console.error("Connection failed:", error);
});
```

**Production deployment:**

```typescript
// Use environment variable for WebSocket URL
const wsUrl = import.meta.env.VITE_WS_URL || "ws://localhost:1234";
const provider = new WebsocketProvider(wsUrl, roomId, ydoc);
```

**Additional notes:**

- Ensure WebSocket server supports Yjs protocol
- Check firewall/network allows WebSocket connections
- For production, use `wss://` (secure WebSocket) with HTTPS sites

---

### Problem: WebRTC peer discovery issues

**Symptoms:**

- Peers not finding each other
- Slow initial connection
- Connection works sometimes, not others

**Solution:**

```typescript
import { WebrtcProvider } from "y-webrtc";

const provider = new WebrtcProvider("my-room", ydoc, {
  signaling: [
    "wss://signaling.yjs.dev", // Use reliable signaling servers
    "wss://y-webrtc-signaling-eu.herokuapp.com",
  ],
  password: null, // Optional room password
  awareness: awarenessProtocol, // Optional awareness
  maxConns: 20, // Max peer connections (default: 20)
  filterBcConns: true, // Filter broadcast connections (default: true)
});

// Monitor peer connections
provider.on(
  "peers",
  ({
    webrtcPeers,
    bcPeers,
  }: {
    webrtcPeers: Array<any>;
    bcPeers: Array<any>;
  }) => {
    console.log("WebRTC peers:", webrtcPeers.length);
    console.log("Broadcast peers:", bcPeers.length);
  }
);
```

**Additional notes:**

- WebRTC requires working signaling server for peer discovery
- Works peer-to-peer after initial discovery (no central server needed)
- Best for smaller groups (<20 peers)
- May be blocked by corporate firewalls/VPNs

---

### Problem: IndexedDB quota errors

**Symptoms:**

```
QuotaExceededError
Failed to execute 'transaction' on 'IDBDatabase'
```

**Cause:**
Browser storage limit exceeded.

**Solution:**

```typescript
import { IndexeddbPersistence } from "y-indexeddb";

const persistence = new IndexeddbPersistence("my-doc", ydoc);

// Monitor errors
persistence.on("error", (error: Error) => {
  console.error("IndexedDB error:", error);

  if (error.name === "QuotaExceededError") {
    // Handle quota exceeded
    alert("Local storage full! Clear old data?");
  }
});

// Clear old data
await persistence.clearData();

// Or destroy completely
persistence.destroy();
```

**Check available storage:**

```typescript
if (navigator.storage && navigator.storage.estimate) {
  const estimate = await navigator.storage.estimate();
  console.log("Usage:", estimate.usage);
  console.log("Quota:", estimate.quota);
  console.log("Usage %:", (estimate.usage! / estimate.quota!) * 100);
}
```

**Additional notes:**

- IndexedDB limits vary by browser (usually 50-100MB+)
- Consider clearing old documents periodically
- Use compression for large documents

---

### Problem: PartyKit deployment issues

**See dedicated guide:**

- [PartyKit Setup Guide](./partykit-setup.md)

**Quick troubleshooting:**

```typescript
// Ensure y-partyserver is installed
import { createYjsProvider } from "y-partyserver";

// Check URL format
const provider = createYjsProvider(
  "wss://my-app.username.partykit.dev", // Your PartyKit URL
  "room-name",
  ydoc
);

// Monitor connection
provider.on("status", ({ status }: { status: string }) => {
  console.log("PartyKit status:", status);
});
```

---

## Performance Issues

### Problem: Slow initial load with large state

**Symptoms:**

- App freezes on first load
- Takes several seconds to initialize
- Browser becomes unresponsive

**Cause:**
Loading large Yjs document and creating many proxies.

**Solution:**

**Lazy loading:**

```typescript
// ❌ Load everything at once
proxy.users = allUsers; // 10,000 users

// ✅ Paginate or virtualize
proxy.usersPage1 = users.slice(0, 100);

// Load more on demand
function loadNextPage() {
  const nextPage = users.slice(proxy.users.length, proxy.users.length + 100);
  proxy.users.push(...nextPage);
}
```

**Use bulk operations:**

```typescript
// ❌ Slow - many individual operations
for (const item of items) {
  proxy.list.push(item); // Triggers sync for each item
}

// ✅ Fast - single bulk operation
proxy.list.push(...items); // Optimized bulk insert
```

**Consider document size:**

```typescript
// Monitor document size
const stateVector = Y.encodeStateVector(ydoc);
const docSize = Y.encodeStateAsUpdate(ydoc).byteLength;

console.log("Document size:", docSize, "bytes");

if (docSize > 1_000_000) {
  // > 1MB
  console.warn("Document is large, consider splitting");
}
```

**Additional notes:**

- valtio-y uses lazy materialization (proxies created on access)
- For large datasets, consider pagination or virtual scrolling
- Documents > 5MB may cause performance issues
- See [Performance Guide](./performance-guide.md) for optimization strategies

---

### Problem: Lag during mutations

**Symptoms:**

- UI freezes when updating state
- Typing feels sluggish
- Operations take multiple seconds

**Cause:**
Inefficient update patterns or unoptimized operations.

**Solution:**

**Batch related updates:**

```typescript
// ❌ Multiple separate updates (causes multiple syncs)
proxy.user.name = "Alice";
await delay(10);
proxy.user.age = 30;
await delay(10);
proxy.user.email = "alice@example.com";

// ✅ Batch in same tick (single transaction)
proxy.user.name = "Alice";
proxy.user.age = 30;
proxy.user.email = "alice@example.com";
// All changes batched into single Yjs transaction
```

**Use efficient array operations:**

```typescript
// ❌ Slow - individual updates
for (let i = 0; i < 1000; i++) {
  proxy.items[i].processed = true;
}

// ✅ Faster - bulk operations
const updates = items.map((item) => ({ ...item, processed: true }));
proxy.items = updates;
```

**Avoid unnecessary nested access:**

```typescript
// ❌ Slow - repeated nested access
for (const todo of proxy.todos) {
  if (todo.user.profile.settings.theme === "dark") {
    // ...
  }
}

// ✅ Fast - cache reference
for (const todo of proxy.todos) {
  const settings = todo.user.profile.settings;
  if (settings.theme === "dark") {
    // ...
  }
}
```

**Additional notes:**

- Multiple mutations in same tick are automatically batched
- Don't use `await` between related mutations
- See [Performance Guide](./performance-guide.md) for benchmarks

---

### Problem: Memory leaks with subscriptions

**Symptoms:**

- Memory usage grows over time
- App becomes slower after being open
- DevTools show increasing object count

**Cause:**
Not cleaning up providers or subscriptions.

**Solution:**

```typescript
// ✅ Clean up providers
useEffect(() => {
  const provider = new WebsocketProvider("ws://localhost:1234", "room", ydoc);

  // Cleanup on unmount
  return () => {
    provider.destroy();
  };
}, []);

// ✅ Clean up valtio-y proxy
useEffect(() => {
  const { proxy, dispose } = createYjsProxy(ydoc, {
    getRoot: (doc) => doc.getMap("state"),
  });

  // Cleanup on unmount
  return () => {
    dispose();
  };
}, []);

// ✅ Clean up manual observers
useEffect(() => {
  const observer = (events: Y.YEvent<any>[]) => {
    console.log("Changes:", events);
  };

  ydoc.on("update", observer);

  return () => {
    ydoc.off("update", observer);
  };
}, []);
```

**Additional notes:**

- Always call `dispose()` when done with proxy
- Clean up providers with `provider.destroy()`
- Remove Yjs observers with `doc.off()`

---

### Problem: Too many network messages

**Symptoms:**

- High network traffic
- Bandwidth issues
- Slow sync in poor network conditions

**Cause:**
Sending many small updates instead of batching.

**Solution:**

```typescript
// ❌ Separate updates (multiple network messages)
for (let i = 0; i < 100; i++) {
  proxy.items.push({ id: i, value: "item" });
  await delay(10); // Don't await between updates!
}

// ✅ Batched update (single network message)
const newItems = Array.from({ length: 100 }, (_, i) => ({
  id: i,
  value: "item",
}));
proxy.items.push(...newItems); // Single transaction

// ✅ Use Y.Doc transaction for explicit batching
ydoc.transact(() => {
  proxy.items = [];
  proxy.users = [];
  proxy.settings = { theme: "dark" };
  // All batched into one update
});
```

**Monitor network traffic:**

```typescript
let updateCount = 0;
let bytesTransmitted = 0;

ydoc.on("update", (update: Uint8Array) => {
  updateCount++;
  bytesTransmitted += update.byteLength;

  console.log("Updates:", updateCount, "Bytes:", bytesTransmitted);
});
```

**Additional notes:**

- valtio-y automatically batches updates in same microtask
- Avoid `await` between mutations you want batched
- For high-frequency updates, consider debouncing

---

## Type Safety Issues

### Problem: Type inference not working

**Symptoms:**

```typescript
// proxy has type 'any'
// Property access not type-checked
```

**Cause:**
Missing generic type parameter.

**Solution:**

```typescript
// ❌ No type inference
const { proxy } = createYjsProxy(ydoc, {
  getRoot: (doc) => doc.getMap("state"),
});
// proxy is type 'any'

// ✅ Provide type explicitly
type AppState = {
  todos: Array<{ id: string; text: string; done: boolean }>;
  user: { name: string; email: string } | null;
};

const { proxy } = createYjsProxy<AppState>(ydoc, {
  getRoot: (doc) => doc.getMap("state"),
});
// proxy is fully typed
```

**Additional notes:**

- Always provide type parameter to `createYjsProxy<YourType>()`
- Use strict TypeScript mode for better type checking
- Define clear interfaces for your state

---

### Problem: any types appearing

**Symptoms:**

```typescript
// Elements implicitly have 'any' type
// Parameter 'X' implicitly has an 'any' type
```

**Cause:**
Incomplete type definitions.

**Solution:**

```typescript
// ❌ Incomplete types
const { proxy } = createYjsProxy<{ todos: any[] }>(ydoc, {
  getRoot: (doc) => doc.getMap("state"),
});

// ✅ Complete type definitions
type Todo = {
  id: string;
  text: string;
  done: boolean;
  createdAt: string;
};

type AppState = {
  todos: Todo[];
  filter: "all" | "active" | "completed";
};

const { proxy } = createYjsProxy<AppState>(ydoc, {
  getRoot: (doc) => doc.getMap("state"),
});
```

**Enable strict TypeScript:**

```json
// tsconfig.json
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true
  }
}
```

**Additional notes:**

- Use `strict: true` in tsconfig.json
- Define explicit types for all state shapes
- Avoid `any` types in your definitions

---

### Problem: Readonly errors with snapshots

**Symptoms:**

```typescript
// Cannot assign to 'X' because it is a read-only property
// Attempted to assign to readonly property
```

**Cause:**
Trying to mutate snapshot instead of proxy.

**Solution:**

```typescript
function TodoItem({ todo }: { todo: Todo }) {
  const snap = useSnapshot(todo);

  // ❌ Can't mutate snapshot
  const handleClick = () => {
    snap.done = true; // Error: readonly property
  };

  // ✅ Mutate original proxy
  const handleClick = () => {
    todo.done = true; // Correct
  };

  return (
    <div>
      {snap.text} {/* Read from snapshot */}
      <button onClick={handleClick}>Complete</button>
    </div>
  );
}
```

**Additional notes:**

- Snapshots are immutable by design
- Always mutate the original proxy, not the snapshot
- Use snapshot for reactive reads, proxy for writes

---

## Debugging Techniques

### Logging Yjs updates

**Track all document changes:**

```typescript
// Log all updates
ydoc.on("update", (update: Uint8Array, origin: any) => {
  console.log("Update:", {
    size: update.byteLength,
    origin: origin,
    timestamp: new Date().toISOString(),
  });
});

// Log deep changes (with details)
ydoc.on("updateV2", (update: Uint8Array, origin: any) => {
  console.log("Detailed update:", {
    update,
    origin,
    decodedUpdate: Y.decodeUpdate(update),
  });
});

// Observe specific shared type
const yMap = ydoc.getMap("state");
yMap.observeDeep((events: Y.YEvent<any>[]) => {
  console.log(
    "Map changes:",
    events.map((e) => ({
      path: e.path,
      changes: e.changes,
    }))
  );
});
```

---

### Inspecting proxy state

**View current proxy state:**

```typescript
// Get current state as plain object
const currentState = proxy.toJSON?.() || proxy;
console.log("Current state:", JSON.stringify(currentState, null, 2));

// Or use snapshot
const snap = snapshot(proxy);
console.log("Snapshot:", snap);

// Check if value is a proxy
import { isProxy } from "valtio";
console.log("Is proxy?", isProxy(proxy.todos)); // true
```

---

### Tracing mutations

**Track who made changes:**

```typescript
// Add origin info to your mutations
const MY_ORIGIN = Symbol("my-client");

// When mutating, mutations are automatically tracked
proxy.todos.push({ text: "New task", done: false });

// Track in Y.js
ydoc.on("update", (update: Uint8Array, origin: any) => {
  if (origin === MY_ORIGIN) {
    console.log("My change");
  } else {
    console.log("Remote change");
  }
});

// For explicit transactions
ydoc.transact(() => {
  proxy.count++;
}, MY_ORIGIN);
```

---

### Monitoring network traffic

**Track sync messages:**

```typescript
import { WebsocketProvider } from "y-websocket";

const provider = new WebsocketProvider("ws://localhost:1234", "room", ydoc);

// Log connection events
provider.on("status", ({ status }: { status: string }) => {
  console.log("Status changed:", status);
});

provider.on("sync", (synced: boolean) => {
  console.log("Sync state:", synced);
});

provider.on("connection-close", () => {
  console.log("Connection closed");
});

provider.on("connection-error", (error: Error) => {
  console.error("Connection error:", error);
});

// Track bandwidth
let bytesSent = 0;
let bytesReceived = 0;

ydoc.on("update", (update: Uint8Array, origin: any) => {
  if (origin !== provider) {
    bytesSent += update.byteLength;
  }
});

provider.on("sync", () => {
  console.log("Bandwidth - Sent:", bytesSent, "Received:", bytesReceived);
});
```

---

### Using browser DevTools effectively

**React DevTools:**

```typescript
// Install React DevTools extension
// Components tab shows valtio state

// Add display names for debugging
const TodoList = () => {
  const snap = useSnapshot(proxy);
  // ...
};
TodoList.displayName = "TodoList";
```

**Chrome/Firefox DevTools:**

```typescript
// Expose proxy globally for debugging (development only!)
if (import.meta.env.DEV) {
  (window as any).__DEBUG_PROXY__ = proxy;
}

// Then in console:
// __DEBUG_PROXY__.todos
// __DEBUG_PROXY__.users
```

**Network tab:**

- Filter by "WS" to see WebSocket traffic
- Check WebSocket frames for Yjs protocol messages
- Monitor connection state and reconnections

**Performance tab:**

- Record while making state changes
- Look for "Long Tasks" that block UI
- Check if mutations cause excessive re-renders

**Memory profiler:**

- Take heap snapshots before/after operations
- Look for detached DOM trees
- Check for growing object counts (indicates leaks)

---

## Still Having Issues?

If you've tried the above solutions and still experiencing problems:

1. **Check your versions:**

   ```bash
   npm list valtio valtio-y yjs
   ```

   Ensure they meet minimum requirements (Valtio 2.1.8+, Yjs 13.6.27+)

2. **Review documentation:**

   - [Architecture](../docs/architecture/architecture.md)
   - [Limitations](../docs/architecture/limitations.md)
   - [Data Flow](../docs/architecture/data-flow.md)

3. **Search existing issues:**

   - [GitHub Issues](https://github.com/valtiojs/valtio-y/issues)
   - [Valtio Discord](https://discord.gg/MrQdmzd)

4. **Create a minimal reproduction:**

   - Use [StackBlitz template](https://stackblitz.com/github/valtiojs/valtio-y/tree/main/examples/01_obj)
   - Isolate the problem in smallest possible example
   - Share your reproduction when asking for help

5. **Open an issue:**
   - Include error messages and stack traces
   - Describe expected vs actual behavior
   - Share your environment (OS, browser, Node version)
   - Link to reproduction if possible

---

## Related Guides

- [Getting Started](./getting-started.md) - Setup and basic usage
- [Core Concepts](./concepts.md) - Understanding CRDTs and valtio-y
- [Performance Guide](./performance-guide.md) - Optimization strategies
- [Debugging Guide](./debugging.md) - Advanced debugging techniques
- [Validation & Errors](./validation-errors.md) - Error handling patterns
