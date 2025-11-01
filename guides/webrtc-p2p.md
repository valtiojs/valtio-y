# WebRTC Peer-to-Peer Sync

Use valtio-y with WebRTC to create peer-to-peer collaborative apps without a central sync server—perfect for demos, prototypes, and local-first applications.

## When to Use WebRTC

WebRTC is ideal for:

- **Demos and prototypes** - Get up and running quickly without deploying a server
- **Local-first apps** - Build offline-first apps that sync directly between devices
- **Privacy-focused apps** - Keep user data off central servers
- **Small team collaboration** - Perfect for <10 simultaneous users
- **Local network apps** - LAN-based collaboration tools

**Trade-offs:** WebRTC uses public signaling servers for peer discovery (which reveals IP addresses) and may struggle with complex NAT configurations. For production apps with many users or strict privacy requirements, consider using WebSocket providers instead.

## Installation

Install the y-webrtc provider alongside valtio-y:

```bash
npm install valtio-y valtio yjs y-webrtc
```

## Basic Setup

Here's how to use valtio-y with WebRTC:

```typescript
import * as Y from "yjs";
import { WebrtcProvider } from "y-webrtc";
import { createYjsProxy } from "valtio-y";

// 1. Create a Yjs document
const ydoc = new Y.Doc();

// 2. Connect to WebRTC with a unique room name
const provider = new WebrtcProvider("my-app-room-name", ydoc, {
  signaling: [
    "wss://signaling.yjs.dev",
    "wss://y-webrtc-signaling-eu.herokuapp.com",
  ],
});

// 3. Create the Valtio proxy
type AppState = {
  messages: string[];
  users: { id: string; name: string }[];
};

const { proxy: state, bootstrap } = createYjsProxy<AppState>(ydoc, {
  getRoot: (doc) => doc.getMap("shared"),
});

// 4. Initialize state after peers sync
provider.on("synced", () => {
  bootstrap({
    messages: [],
    users: [],
  });
});

// 5. Use the state normally
state.messages.push("Hello from WebRTC!");
```

**Important:** The room name (`"my-app-room-name"`) determines which peers connect. Use unique room names for different app instances.

## Connection Lifecycle

WebRTC connections go through several stages:

```typescript
provider.on("synced", () => {
  console.log("Connected and synced with peers");
  // Safe to initialize state here
});

provider.on("peers", ({ added, removed, webrtcPeers }) => {
  console.log(`Connected to ${webrtcPeers.length} peers`);
  console.log("New peers:", added);
  console.log("Left peers:", removed);
});

// Cleanup on unmount
provider.destroy();
ydoc.destroy();
```

## Custom Signaling Servers

By default, y-webrtc uses public signaling servers. For development or private networks, you can run your own:

```typescript
const provider = new WebrtcProvider("my-room", ydoc, {
  signaling: ["ws://localhost:4444"], // Your local signaling server
});
```

**Note:** The signaling server only helps peers find each other—it doesn't see your data. Once connected, data flows directly between peers.

To run a local signaling server:

```bash
npx y-webrtc-signaling
```

See the [y-webrtc repository](https://github.com/yjs/y-webrtc) for server setup details.

## Complete Example

Here's a minimal React component using WebRTC sync:

```tsx
import { useEffect } from "react";
import { useSnapshot } from "valtio";
import * as Y from "yjs";
import { WebrtcProvider } from "y-webrtc";
import { createYjsProxy } from "valtio-y";

type TodoState = {
  todos: { id: string; text: string; done: boolean }[];
};

const ydoc = new Y.Doc();
const provider = new WebrtcProvider("todos-demo", ydoc);

const { proxy: state, bootstrap } = createYjsProxy<TodoState>(ydoc, {
  getRoot: (doc) => doc.getMap("todos"),
});

provider.on("synced", () => {
  bootstrap({ todos: [] });
});

export default function TodoApp() {
  const snap = useSnapshot(state);

  useEffect(() => {
    // Cleanup on unmount
    return () => {
      provider.destroy();
      ydoc.destroy();
    };
  }, []);

  const addTodo = (text: string) => {
    state.todos.push({
      id: crypto.randomUUID(),
      text,
      done: false,
    });
  };

  return (
    <div>
      <h1>Collaborative Todos (P2P)</h1>
      <button onClick={() => addTodo("New task")}>Add Todo</button>
      <ul>
        {snap.todos.map((todo) => (
          <li key={todo.id}>
            <input
              type="checkbox"
              checked={todo.done}
              onChange={(e) => {
                const t = state.todos.find((t) => t.id === todo.id);
                if (t) t.done = e.target.checked;
              }}
            />
            {todo.text}
          </li>
        ))}
      </ul>
    </div>
  );
}
```

## Real-World Example

Check out the [Minecraft example](/examples/03_minecraft) to see WebRTC in action. It uses valtio-y + y-webrtc to sync game state across multiple players in real-time—no server required.

Key parts of the implementation:

```typescript
// examples/03_minecraft/src/cube.tsx

const ydoc = new Y.Doc();

const provider = new WebrtcProvider("minecraft-valtio-y-demo-3", ydoc, {
  signaling: ["ws://localhost:4444"],
});

const { proxy: state, bootstrap } = createYjsProxy<{
  cubes?: [number, number, number][];
}>(ydoc, {
  getRoot: (doc) => doc.getMap("map"),
});

provider.on("synced", () => {
  bootstrap({ cubes: [] });
});

// Add cubes - syncs automatically to all peers
const addCube = (x: number, y: number, z: number) => {
  const arr = state.cubes;
  if (!arr) {
    state.cubes = [[x, y, z]];
    return;
  }
  arr[arr.length] = [x, y, z];
};
```

## Debugging Connections

If peers aren't connecting, check:

1. **Same room name** - All clients must use identical room names
2. **Signaling server reachable** - Check browser console for WebSocket errors
3. **NAT/firewall issues** - Some networks block WebRTC connections
4. **HTTPS requirement** - WebRTC requires HTTPS in production (localhost is exempt)

Enable debug logs:

```typescript
provider.on("peers", ({ webrtcPeers }) => {
  console.log(`Connected peers: ${webrtcPeers.length}`);
});

provider.on("synced", () => {
  console.log("Fully synced with network");
});
```

## Limitations

WebRTC has some constraints to be aware of:

- **Peer discovery requires signaling servers** - You need at least one public signaling server (or run your own)
- **NAT traversal challenges** - Some corporate networks block WebRTC
- **Not ideal for large groups** - Performance degrades with >10 simultaneous peers
- **No offline persistence** - Use IndexedDB provider for offline support
- **IP address exposure** - Signaling servers can see peer IP addresses

## Next Steps

- **Learn more about y-webrtc**: [GitHub Repository](https://github.com/yjs/y-webrtc)
- **Run a signaling server**: See the [y-webrtc-signaling](https://github.com/yjs/y-webrtc-signaling) repository
- **Try WebSocket sync**: See the [Getting Started Guide](/guides/getting-started.md) for server-based sync
- **Explore the Minecraft example**: [examples/03_minecraft](/examples/03_minecraft)
- **Learn about offline support**: Combine y-webrtc with [y-indexeddb](https://github.com/yjs/y-indexeddb) for persistence

## Summary

WebRTC enables peer-to-peer sync without a central server:

1. Install `y-webrtc` alongside `valtio-y`
2. Create a WebRTC provider with a unique room name
3. Use `createYjsProxy` as normal
4. Bootstrap state after the `synced` event fires
5. State changes sync automatically between peers

Perfect for prototypes, demos, and local-first apps—but consider WebSocket providers for production apps with many users.
