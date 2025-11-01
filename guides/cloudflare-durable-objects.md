# Cloudflare Durable Objects with valtio-y

Deploy valtio-y on Cloudflare's edge using Durable Objects via PartyKit. This guide covers the client-side integration—server deployment is handled through PartyKit's platform.

## What This Covers

Setting up valtio-y clients to sync with Cloudflare Durable Objects using PartyKit's infrastructure. PartyKit is built on Cloudflare Durable Objects, providing a serverless real-time backend at the edge.

## Prerequisites

- Cloudflare account with Workers/Durable Objects access
- Basic understanding of valtio-y (see [Getting Started](./getting-started.md) first)

## Why Cloudflare Durable Objects?

**Benefits:**

- **Global edge deployment** - Low latency worldwide
- **Auto-scaling** - Handles any number of concurrent users
- **Built-in persistence** - State automatically saved to Cloudflare's durable storage
- **Zero ops** - No servers to manage
- **Cost-effective** - Pay only for what you use

**Trade-offs:**

- Tied to Cloudflare's platform
- Cold starts (though typically <100ms)
- More complex than simple WebSocket servers for development

## Overview

PartyKit provides the Yjs server infrastructure on Cloudflare Durable Objects. Your valtio-y client connects using the `y-partyserver` provider:

```
┌─────────────┐          ┌──────────────┐          ┌─────────────┐
│   Client A  │◄────────►│   PartyKit   │◄────────►│   Client B  │
│  (valtio-y) │ WebSocket│ (Durable Obj)│ WebSocket│  (valtio-y) │
└─────────────┘          └──────────────┘          └─────────────┘
                                │
                                ▼
                         Cloudflare Edge
                         (Persistent State)
```

## Installation

Install valtio-y and the PartyKit provider:

```bash
npm install valtio-y valtio yjs y-partyserver
```

## Client Setup

### Basic Configuration

```tsx
import * as Y from "yjs";
import { createYjsProxy } from "valtio-y";
import YPartyProvider from "y-partyserver/provider";

// Create Yjs document
const ydoc = new Y.Doc();

// Connect to your PartyKit server (deployed on Cloudflare Durable Objects)
const provider = new YPartyProvider(
  "your-party.your-username.partykit.dev", // Your PartyKit host
  "my-room", // Room name
  ydoc,
  {
    // Optional configuration
  }
);

// Create synchronized proxy
const { proxy: state, bootstrap } = createYjsProxy(ydoc, {
  getRoot: (doc) => doc.getMap("state"),
});

// Wait for initial sync before initializing
provider.on("synced", () => {
  bootstrap({
    todos: [],
    users: {},
  });
});
```

### React Integration

```tsx
import { useSnapshot } from "valtio/react";

function TodoApp() {
  const snap = useSnapshot(state);

  return (
    <div>
      <h1>Collaborative Todos</h1>
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
        onClick={() => state.todos.push({ text: "New todo", done: false })}
      >
        Add Todo
      </button>
    </div>
  );
}
```

### Connection Status

Track connection state for better UX:

```tsx
import { useState, useEffect } from "react";

function useConnectionStatus(provider: YPartyProvider) {
  const [status, setStatus] = useState<
    "connecting" | "connected" | "disconnected"
  >("connecting");

  useEffect(() => {
    const handleStatus = ({ status }: { status: string }) => {
      setStatus(status as typeof status);
    };

    provider.on("status", handleStatus);
    return () => provider.off("status", handleStatus);
  }, [provider]);

  return status;
}

function App() {
  const status = useConnectionStatus(provider);

  return (
    <div>
      <div className={`status ${status}`}>
        {status === "connected" ? "🟢" : status === "connecting" ? "🟡" : "🔴"}
        {status}
      </div>
      {/* Your app content */}
    </div>
  );
}
```

### Multiple Rooms

Support multiple isolated collaboration spaces:

```tsx
import { useMemo } from "react";

function useCollaborativeState(roomId: string) {
  const { ydoc, provider, state } = useMemo(() => {
    const ydoc = new Y.Doc();
    const provider = new YPartyProvider(
      "your-party.your-username.partykit.dev",
      roomId,
      ydoc
    );

    const { proxy: state, bootstrap } = createYjsProxy(ydoc, {
      getRoot: (doc) => doc.getMap("state"),
    });

    provider.on("synced", () => {
      bootstrap({ messages: [] });
    });

    return { ydoc, provider, state };
  }, [roomId]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      provider.destroy();
      ydoc.destroy();
    };
  }, [ydoc, provider]);

  return state;
}

// Usage
function ChatRoom({ roomId }: { roomId: string }) {
  const state = useCollaborativeState(roomId);
  const snap = useSnapshot(state);

  return (
    <div>
      <h2>Room: {roomId}</h2>
      {/* Chat UI */}
    </div>
  );
}
```

## Server Deployment

PartyKit handles the server-side Durable Objects deployment. You'll need to:

1. **Create a PartyKit server** - Follow [PartyKit's deployment guide](https://docs.partykit.io/guides/deploying-your-partykit-server/)
2. **Deploy to Cloudflare** - PartyKit CLI handles the Durable Objects setup
3. **Get your host URL** - Use it in your client configuration

The `y-partyserver` package provides the Yjs server implementation:

```ts
// server/index.ts (PartyKit server)
import { YServer } from "y-partyserver";

export default class MyYjsServer extends YServer {}
```

For detailed deployment instructions, see:

- [PartyKit Deployment Guide](https://docs.partykit.io/guides/deploying-your-partykit-server/)
- [PartyKit Yjs Integration](https://docs.partykit.io/examples/yjs/)

## Advanced Configuration

### Custom Provider Options

```tsx
const provider = new YPartyProvider(
  "your-party.your-username.partykit.dev",
  "room-name",
  ydoc,
  {
    // Connection options
    connect: true, // Auto-connect on creation (default: true)

    // Awareness (for presence/cursors)
    awareness: new awarenessProtocol.Awareness(ydoc),

    // Authentication (if your PartyKit server requires it)
    params: {
      token: "your-auth-token",
    },
  }
);
```

### User Presence

Track connected users with Yjs Awareness:

```tsx
import * as awarenessProtocol from "y-protocols/awareness";

const awareness = new awarenessProtocol.Awareness(ydoc);

// Set local user info
awareness.setLocalStateField("user", {
  name: "Alice",
  color: "#ff0000",
});

// Track all connected users
awareness.on("change", () => {
  const users = Array.from(awareness.getStates().values());
  console.log("Connected users:", users);
});

// Pass to provider
const provider = new YPartyProvider(
  "your-party.your-username.partykit.dev",
  "room",
  ydoc,
  { awareness }
);
```

### Offline Persistence

Combine with IndexedDB for offline support:

```tsx
import { IndexeddbPersistence } from "y-indexeddb";

// Add local persistence
const indexeddbProvider = new IndexeddbPersistence("room-name", ydoc);

// PartyKit syncs when online
const partyProvider = new YPartyProvider(
  "your-party.your-username.partykit.dev",
  "room-name",
  ydoc
);

// Changes persist locally and sync when connection is available
```

## Best Practices

### 1. Initialize After Sync

Always wait for the initial sync before setting default values:

```tsx
// ✅ Good - waits for remote state
provider.on("synced", () => {
  bootstrap({ todos: [] });
});

// ❌ Bad - might overwrite remote data
state.todos = [];
```

### 2. Handle Reconnection

PartyKit providers automatically reconnect, but you may want to show UI feedback:

```tsx
provider.on("connection-close", () => {
  console.log("Connection lost, reconnecting...");
});

provider.on("connection-error", (error) => {
  console.error("Connection error:", error);
});

provider.on("synced", () => {
  console.log("Synced with server");
});
```

### 3. Cleanup Resources

Destroy providers and documents when done:

```tsx
useEffect(() => {
  return () => {
    provider.destroy();
    ydoc.destroy();
  };
}, []);
```

### 4. Use Environment Variables

Keep your PartyKit host configurable:

```tsx
const PARTYKIT_HOST =
  import.meta.env.VITE_PARTYKIT_HOST || "your-party.your-username.partykit.dev";

const provider = new YPartyProvider(PARTYKIT_HOST, roomId, ydoc);
```

## Troubleshooting

**Connection fails:**

- Verify your PartyKit server is deployed
- Check the host URL is correct
- Ensure Cloudflare Workers are enabled in your account

**State not syncing:**

- Check browser console for connection errors
- Verify `bootstrap()` is called inside `synced` event
- Ensure you're mutating `state`, not `snap`

**High latency:**

- Check your Cloudflare region selection
- Consider using multiple PartyKit instances in different regions
- Monitor Durable Objects cold starts

## Next Steps

- [PartyKit Documentation](https://docs.partykit.io/) - Full PartyKit platform guide
- [Cloudflare Durable Objects Docs](https://developers.cloudflare.com/durable-objects/) - Deep dive into Durable Objects
- [y-partyserver GitHub](https://github.com/partykit/partykit/tree/main/packages/y-partyserver) - Provider source code
- [PartyKit Examples](https://docs.partykit.io/examples/) - More real-world examples

## Related Guides

- [Getting Started](./getting-started.md) - valtio-y basics
- [PartyKit Setup](./partykit-setup.md) - Detailed PartyKit guide
- [WebSocket Server](./yjs-websocket-server.md) - Self-hosted alternative
- [Offline Sync](./offline-sync.md) - Handling disconnections
