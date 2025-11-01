# PartyKit Setup Guide

A focused guide for deploying valtio-y with PartyKit's Yjs server.

## Prerequisites

- [PartyKit account](https://www.partykit.io) and CLI installed
- Existing valtio-y project

## Server Setup

Install y-partyserver and create your PartyKit server:

```bash
npm install y-partyserver
```

**partykit.json:**

```json
{
  "name": "my-valtio-app",
  "main": "server.ts"
}
```

**server.ts:**

```ts
import { YServer } from "y-partyserver";

export default YServer;
```

For custom persistence, extend `YServer`:

```ts
import { YServer } from "y-partyserver";
import type * as Party from "partykit/server";

export default class MyServer extends YServer {
  constructor(readonly room: Party.Room) {
    super(room);
  }

  async onLoad() {
    // Load initial state from storage
    const stored = await this.room.storage.get("ydoc");
    if (stored) {
      return new Uint8Array(stored as ArrayBuffer);
    }
  }

  async onSave(update: Uint8Array) {
    // Persist updates to storage
    await this.room.storage.put("ydoc", update);
  }
}
```

Deploy with:

```bash
npx partykit deploy
```

## Client Integration

Install valtio-y and configure the provider:

```bash
npm install valtio-y valtio y-partyserver
```

**Basic setup:**

```ts
import * as Y from "yjs";
import { YProvider } from "y-partyserver/provider";
import { createYjsProxy } from "valtio-y";

// Create Yjs doc
const ydoc = new Y.Doc();

// Connect to PartyKit
const provider = new YProvider(
  "my-valtio-app.your-username.partykit.dev",
  "room-id",
  ydoc
);

// Create valtio proxy synced with Yjs
const state = createYjsProxy(ydoc.getMap("shared"), {
  name: "Alice",
  items: [],
});

// State is now synced across all clients
state.name = "Bob"; // Propagates to all clients
```

**Connection lifecycle:**

```ts
provider.on("status", (event: { status: string }) => {
  console.log(event.status); // "connecting" | "connected" | "disconnected"
});

provider.on("sync", (isSynced: boolean) => {
  if (isSynced) {
    console.log("Initial sync complete");
  }
});

// Cleanup
provider.destroy();
```

## React Integration

Use the `useYProvider` hook for automatic lifecycle management:

```tsx
import { useYProvider } from "y-partyserver/react";
import { createYjsProxy } from "valtio-y";
import { useSnapshot } from "valtio";
import * as Y from "yjs";

function App() {
  const ydoc = new Y.Doc();

  // Provider connects/disconnects automatically
  const provider = useYProvider({
    host: "my-valtio-app.your-username.partykit.dev",
    room: "room-id",
    doc: ydoc,
  });

  const state = createYjsProxy(ydoc.getMap("shared"), {
    count: 0,
  });

  const snap = useSnapshot(state);

  return (
    <div>
      <p>Count: {snap.count}</p>
      <button onClick={() => state.count++}>Increment</button>
      <p>Status: {provider.status}</p>
    </div>
  );
}
```

## Custom Messages

For application-level messaging over the same connection:

**Server:**

```ts
import { YServer } from "y-partyserver";
import type * as Party from "partykit/server";

export default class MyServer extends YServer {
  constructor(readonly room: Party.Room) {
    super(room);
  }

  onCustomMessage(message: string, connection: Party.Connection) {
    // Handle custom messages from clients
    console.log("Received:", message);

    // Broadcast to all clients
    this.room.broadcast(message, [connection.id]);
  }
}
```

**Client:**

```ts
// Send custom message
provider.sendMessage("Hello, server!");

// Receive custom messages
provider.on("custom-message", (message: string) => {
  console.log("Server says:", message);
});
```

## Development Workflow

**Local development:**

```bash
npx partykit dev
```

Your server runs at `http://localhost:1999` by default. Update the provider host:

```ts
const host = import.meta.env.DEV
  ? "localhost:1999"
  : "my-app.username.partykit.dev";

const provider = new YProvider(host, "room-id", ydoc);
```

**Deploy to production:**

```bash
npx partykit deploy
```

## Environment Variables

Store sensitive config in `.env`:

```bash
PARTYKIT_HOST=my-app.username.partykit.dev
```

Access in your app:

```ts
const provider = new YProvider(
  import.meta.env.VITE_PARTYKIT_HOST,
  "room-id",
  ydoc
);
```

## Next Steps

- [PartyKit Documentation](https://docs.partykit.io)
- [y-partyserver GitHub](https://github.com/threepointone/y-partyserver)
- [valtio-y README](/README.md) for core concepts
- [Architecture docs](/docs/architecture/) for deep dives

## Common Patterns

**Multiple rooms per user:**

```ts
const roomId = `user-${userId}-workspace-${workspaceId}`;
const provider = new YProvider(host, roomId, ydoc);
```

**Authentication:**

```ts
const provider = new YProvider(host, roomId, ydoc, {
  params: { token: authToken },
});
```

On the server, access via:

```ts
onConnect(connection: Party.Connection) {
  const token = new URL(connection.uri).searchParams.get("token");
  // Validate token
}
```

**Awareness (presence):**

```ts
provider.awareness.setLocalStateField("user", {
  name: "Alice",
  color: "#ff0000",
});

provider.awareness.on("change", () => {
  const states = provider.awareness.getStates();
  // Display online users
});
```
