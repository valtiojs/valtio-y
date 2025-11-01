# Using valtio-y with WebSocket Servers

This guide shows how to connect valtio-y to WebSocket servers for real-time collaboration. WebSockets provide reliable, bidirectional communication ideal for syncing state across multiple clients.

## Client Setup

The `y-websocket` package provides a WebSocket provider that integrates seamlessly with valtio-y. Here's how to use it:

```tsx
import * as Y from "yjs";
import { WebsocketProvider } from "y-websocket";
import { createYjsProxy } from "valtio-y";
import { useSnapshot } from "valtio";

// 1. Create a Yjs document
const ydoc = new Y.Doc();

// 2. Connect to a WebSocket server
const provider = new WebsocketProvider(
  "ws://localhost:1234", // WebSocket server URL
  "my-room-name", // Room/channel name (clients in the same room sync together)
  ydoc // Your Yjs document
);

// 3. Create a synchronized proxy
const { proxy: state, bootstrap } = createYjsProxy(ydoc, {
  getRoot: (doc) => doc.getMap("myState"),
});

// 4. Initialize state after network sync
provider.on("sync", () => {
  bootstrap({
    messages: [],
    users: {},
  });
  // bootstrap is a no-op if the document already has data
});

// 5. Use in React components
function App() {
  const snap = useSnapshot(state);

  const addMessage = (text: string) => {
    state.messages.push({ text, timestamp: Date.now() });
  };

  return (
    <div>
      <h1>Messages ({snap.messages.length})</h1>
      {snap.messages.map((msg, i) => (
        <div key={i}>{msg.text}</div>
      ))}
    </div>
  );
}
```

### Key Points

- **Room names** determine which clients sync together. All clients connecting to the same room share state.
- **Wait for sync** before initializing with `bootstrap()`. This prevents overwriting remote state when a new client connects.
- **Use `ws://` for local dev** and `wss://` (secure WebSocket) for production.

## WebSocket Provider Options

The `WebsocketProvider` constructor accepts options as the fourth parameter:

```tsx
const provider = new WebsocketProvider("ws://localhost:1234", "my-room", ydoc, {
  // WebSocket connection options
  connect: true, // Connect immediately (default: true)
  awareness: new awarenessProtocol.Awareness(ydoc), // Custom awareness instance
  params: {}, // URL parameters sent to server
  protocols: [], // WebSocket subprotocols

  // Reconnection behavior
  maxBackoffTime: 2500, // Maximum reconnection delay (ms)

  // Callbacks
  WebSocketPolyfill: WebSocket, // Custom WebSocket implementation
  resyncInterval: -1, // Auto-resync interval (default: -1 = disabled)
});
```

**Common use cases:**

```tsx
// Disable auto-connect (connect manually later)
const provider = new WebsocketProvider(url, room, ydoc, { connect: false });
provider.connect(); // Connect when ready

// Add authentication parameters
const provider = new WebsocketProvider(url, room, ydoc, {
  params: { token: "your-auth-token" },
});

// Custom reconnection timing
const provider = new WebsocketProvider(url, room, ydoc, {
  maxBackoffTime: 5000, // Wait up to 5s between reconnection attempts
});
```

## Provider Events

Listen to provider events to handle connection state:

```tsx
// Connection established
provider.on(
  "status",
  (event: { status: "connecting" | "connected" | "disconnected" }) => {
    console.log("Connection status:", event.status);
  }
);

// Initial sync complete (document loaded from server)
provider.on("sync", (isSynced: boolean) => {
  if (isSynced) {
    console.log("Initial sync complete");
    bootstrap({
      /* default state */
    });
  }
});

// Connection lost/restored
provider.on("connection-close", (event: CloseEvent) => {
  console.log("Connection closed:", event.code, event.reason);
});

provider.on("connection-error", (event: Event) => {
  console.error("Connection error:", event);
});
```

**Show connection status in UI:**

```tsx
function ConnectionStatus() {
  const [status, setStatus] = useState<string>("connecting");

  useEffect(() => {
    const handleStatus = (event: { status: string }) => {
      setStatus(event.status);
    };

    provider.on("status", handleStatus);
    return () => provider.off("status", handleStatus);
  }, []);

  return (
    <div className={`status status-${status}`}>
      {status === "connected" && "🟢 Connected"}
      {status === "connecting" && "🟡 Connecting..."}
      {status === "disconnected" && "🔴 Disconnected"}
    </div>
  );
}
```

## Development: Using Demo Servers

For development and testing, you can use the free Yjs demo server:

```tsx
const provider = new WebsocketProvider(
  "wss://demos.yjs.dev", // Free demo server (use wss:// not ws://)
  "my-unique-room-name", // Choose a unique room name!
  ydoc
);
```

**Important:**

- The demo server is **public** - anyone can join your room if they know the name
- It's **not persistent** - state may be lost when all clients disconnect
- It's **rate-limited** - not suitable for production or load testing
- Use a **unique room name** to avoid accidentally joining someone else's session

**Best for:**

- Quick prototyping
- Testing across devices (phone + laptop)
- Sharing demos with colleagues

## Production: Running Your Own Server

For production, you'll want to run your own WebSocket server. The `y-websocket` package includes a ready-to-use server.

### Quick Start (Development)

Install the server package:

```bash
npm install -D y-websocket
```

Create `server.js`:

```js
const { WebSocketServer } = require("y-websocket/bin/utils");

const server = new WebSocketServer({ port: 1234 });

console.log("Yjs WebSocket server running on ws://localhost:1234");
```

Run it:

```bash
node server.js
```

Now connect your client to `ws://localhost:1234`.

### Production Setup

For production deployments with persistence, authentication, and scaling, see the official y-websocket documentation:

**📚 [y-websocket Server Documentation](https://github.com/yjs/y-websocket#y-websocket-server)**

The y-websocket repository includes:

- Complete server setup guides
- Persistence options (LevelDB, PostgreSQL, etc.)
- Authentication examples
- Docker deployment configs
- Scaling strategies

### Alternative Deployment Options

Instead of running your own WebSocket server, consider these managed alternatives:

**[PartyKit](../guides/partykit-setup.md)** - Serverless real-time backend (recommended for most projects)

- No server management required
- Automatic scaling
- Built-in persistence
- WebSocket + HTTP in one platform

**[Cloudflare Durable Objects](../guides/cloudflare-durable-objects.md)** - Edge computing with strong consistency

- Deploy on Cloudflare's global network
- Transactional storage
- Great for low-latency requirements

**[WebRTC P2P](../guides/webrtc-p2p.md)** - Serverless peer-to-peer sync

- No backend required
- Direct client-to-client communication
- Good for small groups (2-10 clients)

## Cleanup

When your component unmounts or you're done with the connection, clean up the provider:

```tsx
useEffect(() => {
  return () => {
    provider.disconnect();
    provider.destroy();
  };
}, []);
```

## Common Patterns

### Handling Authentication

Pass authentication tokens via URL parameters:

```tsx
const token = await getAuthToken();
const provider = new WebsocketProvider(
  "wss://your-server.com",
  "my-room",
  ydoc,
  {
    params: { token },
  }
);
```

**Server-side (example):**

```js
const { setupWSConnection } = require("y-websocket/bin/utils");

wss.on("connection", (conn, req) => {
  const url = new URL(req.url, "http://localhost");
  const token = url.searchParams.get("token");

  if (!isValidToken(token)) {
    conn.close(1008, "Unauthorized");
    return;
  }

  setupWSConnection(conn, req);
});
```

### Multiple Documents

You can use multiple Yjs documents with separate providers:

```tsx
// Document for main app state
const appDoc = new Y.Doc();
const appProvider = new WebsocketProvider("wss://...", "app-state", appDoc);
const { proxy: appState } = createYjsProxy(appDoc, {
  getRoot: (doc) => doc.getMap("app"),
});

// Separate document for user presence
const presenceDoc = new Y.Doc();
const presenceProvider = new WebsocketProvider(
  "wss://...",
  "presence",
  presenceDoc
);
const { proxy: presence } = createYjsProxy(presenceDoc, {
  getRoot: (doc) => doc.getMap("presence"),
});
```

### Offline-First with IndexedDB

Combine WebSocket sync with local persistence for offline support:

```tsx
import { IndexeddbPersistence } from "y-indexeddb";

const ydoc = new Y.Doc();

// Local persistence (works offline)
const indexeddb = new IndexeddbPersistence("my-app-db", ydoc);

// Network sync (works when online)
const wsProvider = new WebsocketProvider("wss://...", "room", ydoc);

// State is saved locally AND synced to server
const { proxy: state } = createYjsProxy(ydoc, {
  getRoot: (doc) => doc.getMap("state"),
});
```

Now your app works offline and automatically syncs when reconnected!

## Troubleshooting

### "WebSocket connection failed"

- Check the server URL (correct protocol: `ws://` or `wss://`)
- Verify the server is running: `curl -i -N -H "Connection: Upgrade" -H "Upgrade: websocket" http://localhost:1234`
- Check firewall/network settings
- For `wss://`, ensure valid SSL certificate

### "State not syncing between clients"

- Verify all clients use the **same room name**
- Check connection status with `provider.on("status", ...)`
- Ensure you're mutating the `state` proxy, not the snapshot
- Check browser console for errors

### "Conflict: state resets on load"

Don't initialize state directly - use `bootstrap()` after sync:

```tsx
// ❌ Wrong - overwrites remote state
const { proxy: state } = createYjsProxy(ydoc, { ... });
state.messages = [];

// ✅ Correct - only initializes if empty
provider.on("sync", () => {
  bootstrap({ messages: [] });
});
```

### "High memory usage / slow performance"

- Limit document history if not needed for undo/redo
- Use garbage collection: `ydoc.gc = true`
- Consider pagination for large lists
- Split large documents into multiple smaller ones

## Next Steps

- **[Getting Started Guide](./getting-started.md)** - Build your first collaborative app
- **[PartyKit Setup](./partykit-setup.md)** - Easiest serverless deployment option
- **[WebRTC P2P](./webrtc-p2p.md)** - Serverless peer-to-peer alternative
- **[Core Concepts](./concepts.md)** - Understand CRDTs and conflict resolution
- **[y-websocket Docs](https://github.com/yjs/y-websocket)** - Official y-websocket documentation

---

**Questions?** Join the [Valtio Discord](https://discord.gg/MrQdmzd) or [open an issue](https://github.com/valtiojs/valtio-y/issues).
