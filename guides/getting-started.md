# Getting Started with valtio-y

Welcome! In this guide, you'll build your first collaborative React app with valtio-y in just 5-10 minutes. By the end, you'll have a working message board that syncs in real-time across multiple browser tabs.

## What You'll Build

A simple collaborative message board where:

- Users can post messages with their name
- All messages sync instantly across all connected clients
- It works offline and auto-syncs when reconnected
- No backend code required (we'll use a free demo server)

**The magic:** You'll write normal JavaScript (`state.messages.push(...)`) and it just works. No special APIs to learn.

## Prerequisites

Before you start, make sure you have:

- **Node.js 18+** installed ([download here](https://nodejs.org/))
- **Basic React knowledge** - understanding of components, hooks, and state
- **5-10 minutes** of your time

No prior knowledge of CRDTs, Yjs, or Valtio required!

## Step 1: Project Setup

Let's create a new React project with TypeScript:

```bash
npm create vite@latest my-collab-app -- --template react-ts
cd my-collab-app
```

Now install valtio-y and its dependencies:

```bash
npm install valtio-y valtio yjs y-websocket
```

**What we just installed:**

- `valtio-y` - The library that makes everything work together
- `valtio` - Reactive state management for React
- `yjs` - The CRDT engine that handles conflict-free sync
- `y-websocket` - WebSocket provider for real-time sync

Start the dev server (we'll use it later):

```bash
npm run dev
```

Keep this running in the background. Let's write some code!

## Step 2: Create Your Yjs Document

Replace the contents of `src/App.tsx` with this basic setup:

```tsx
import * as Y from "yjs";
import { createYjsProxy } from "valtio-y";

// 1. Create a Yjs document (think of it as your collaborative database)
const ydoc = new Y.Doc();

// 2. Create a synchronized proxy from the Yjs document
const { proxy: state } = createYjsProxy(ydoc, {
  getRoot: (doc) => doc.getMap("myState"),
});

// 3. You can now mutate state like a normal object!
// Changes automatically convert to Yjs operations
state.message = "Hello from valtio-y!";

function App() {
  return (
    <div>
      <h1>My First Collaborative App</h1>
      <p>State value: {state.message}</p>
    </div>
  );
}

export default App;
```

**What's happening here:**

- `Y.Doc()` creates a Yjs document - your collaborative data container
- `createYjsProxy()` wraps it in a Valtio proxy - making it reactive and easy to use
- `doc.getMap('myState')` is the root of your state tree (like a top-level object)
- You can now mutate `state` like any normal JavaScript object

**Try it:** Save the file and check your browser at `http://localhost:5173`. You should see "State value: Hello from valtio-y!"

## Step 3: Add React Integration

Now let's make our component reactive with Valtio's `useSnapshot` hook:

```tsx
import * as Y from "yjs";
import { createYjsProxy } from "valtio-y";
import { useSnapshot } from "valtio"; // Add this import
import { useState } from "react";

const ydoc = new Y.Doc();

// Define a type for better TypeScript support
type AppState = {
  messages: Array<{ name: string; text: string }>;
};

const { proxy: state } = createYjsProxy<AppState>(ydoc, {
  getRoot: (doc) => doc.getMap("myState"),
});

// Initialize with an empty array
if (!state.messages) {
  state.messages = [];
}

function App() {
  // useSnapshot makes this component re-render when state changes
  const snap = useSnapshot(state);
  const [name, setName] = useState("");
  const [message, setMessage] = useState("");

  const handleSend = () => {
    if (name.trim() && message.trim()) {
      // Just push to the array like normal JavaScript!
      state.messages.push({
        name: name.trim(),
        text: message.trim(),
      });
      setMessage(""); // Clear input after sending
    }
  };

  return (
    <div
      style={{
        maxWidth: "600px",
        margin: "50px auto",
        fontFamily: "sans-serif",
      }}
    >
      <h1>Collaborative Message Board</h1>

      {/* Input Form */}
      <div
        style={{
          marginBottom: "20px",
          padding: "20px",
          border: "1px solid #ddd",
          borderRadius: "8px",
        }}
      >
        <div style={{ marginBottom: "10px" }}>
          <input
            type="text"
            placeholder="Your name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            style={{ padding: "8px", width: "100%", boxSizing: "border-box" }}
          />
        </div>
        <div style={{ marginBottom: "10px" }}>
          <input
            type="text"
            placeholder="Your message"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSend()}
            style={{ padding: "8px", width: "100%", boxSizing: "border-box" }}
          />
        </div>
        <button
          onClick={handleSend}
          disabled={!name.trim() || !message.trim()}
          style={{
            padding: "10px 20px",
            backgroundColor: "#007bff",
            color: "white",
            border: "none",
            borderRadius: "4px",
            cursor: "pointer",
          }}
        >
          Send Message
        </button>
      </div>

      {/* Message List */}
      <div>
        <h2>Messages ({snap.messages?.length || 0})</h2>
        {snap.messages && snap.messages.length > 0 ? (
          <div>
            {snap.messages.map((msg, i) => (
              <div
                key={i}
                style={{
                  padding: "12px",
                  marginBottom: "8px",
                  backgroundColor: "#f8f9fa",
                  borderRadius: "4px",
                }}
              >
                <strong>{msg.name}:</strong> {msg.text}
              </div>
            ))}
          </div>
        ) : (
          <p style={{ color: "#666" }}>
            No messages yet. Be the first to post!
          </p>
        )}
      </div>
    </div>
  );
}

export default App;
```

**Key concepts:**

1. **Reading state:** Use `useSnapshot(state)` to get a reactive snapshot

   - Components automatically re-render when their data changes
   - Only re-renders if the specific data you're reading changes (fine-grained reactivity)

2. **Writing state:** Mutate the `state` proxy directly (not the snapshot!)

   - `state.messages.push(...)` - Add items
   - `state.messages[0].text = "new"` - Update items
   - All standard JavaScript operations work

3. **The snapshot vs proxy rule:**
   - **Read** from `snap` (snapshot) in your JSX
   - **Write** to `state` (proxy) in your handlers

**Try it:** Enter your name and a message, then click Send. You should see your message appear below! Add a few more messages to test it out.

**Celebration time!** You now have a working app with reactive state. But it's not collaborative yet...

## Step 4: Add Network Sync

This is where the magic happens. Add just **5 lines of code** to enable real-time sync across all connected clients:

```tsx
import * as Y from "yjs";
import { WebsocketProvider } from "y-websocket"; // Add this import
import { createYjsProxy } from "valtio-y";
import { useSnapshot } from "valtio";
import { useState } from "react";

const ydoc = new Y.Doc();

// Add WebSocket provider - connects to a free demo server
const provider = new WebsocketProvider(
  "wss://demos.yjs.dev", // Free Yjs demo server
  "my-message-board-room", // Room name (change this to make it unique!)
  ydoc
);

type AppState = {
  messages: Array<{ name: string; text: string }>;
};

const { proxy: state, bootstrap } = createYjsProxy<AppState>(ydoc, {
  getRoot: (doc) => doc.getMap("myState"),
});

// Wait for initial sync before initializing
// This prevents overwriting existing remote data
provider.on("sync", () => {
  bootstrap({
    messages: [],
  });
  // bootstrap is a no-op if the document already has data
});

// ... rest of your App component stays the same ...
```

**What changed:**

- Added `WebsocketProvider` to connect to a WebSocket server
- Used the free `demos.yjs.dev` server (perfect for testing!)
- Changed initialization to use `bootstrap()` which only writes if the document is empty
- Added a `'sync'` event listener to initialize after the first network sync

**Important:** Change `'my-message-board-room'` to something unique (like `'johns-app-123'`) so you don't accidentally join someone else's room on the demo server!

## Step 5: Test Real-Time Sync

Now for the exciting part - testing real-time collaboration!

### Test in Multiple Browser Tabs

1. **Open your app** at `http://localhost:5173`
2. **Duplicate the tab** (Cmd+L then Cmd+C, open new tab, Cmd+V, Enter)
3. **Position tabs side-by-side** so you can see both
4. **Post a message in one tab**
5. **Watch it instantly appear in the other tab!**

**You just built real-time sync!** No backend code, no database, just a few lines of JavaScript.

### Test Offline Support

valtio-y automatically handles offline scenarios:

1. **Disconnect from network** (in DevTools: Network tab > Offline checkbox)
2. **Add some messages** - they'll queue locally
3. **Reconnect to network**
4. **Watch your messages sync** automatically!

### Test on Multiple Devices

Want to test across devices?

1. **Find your local IP:** Run `ipconfig getifaddr en0` (Mac) or `ipconfig` (Windows)
2. **Share the link:** `http://YOUR_IP:5173` (e.g., `http://192.168.1.100:5173`)
3. **Open on your phone or another computer**
4. **Post messages from different devices** and watch them sync!

**Note:** Both devices need to be on the same network for this to work.

## Understanding What You Built

Let's break down the architecture:

```
┌─────────────────────────────────────────────────────────┐
│                     Your React App                      │
├─────────────────────────────────────────────────────────┤
│  Components (JSX)                                       │
│    ↓ useSnapshot(state)     (read)                     │
│  Valtio Snapshot (reactive, immutable)                  │
│    ↑ onChange               ↓ mutations                │
│  Valtio Proxy (state)       (write)                     │
│    ↕ bidirectional sync                                 │
│  valtio-y (the bridge)                                  │
│    ↕ converts JS ↔ Yjs                                  │
│  Yjs CRDT (Y.Doc)                                       │
│    ↕ encodes/decodes                                    │
│  WebSocket Provider                                     │
│    ↕ network                                            │
│  WebSocket Server (demos.yjs.dev)                       │
│    ↕ relays updates                                     │
│  Other Clients                                          │
└─────────────────────────────────────────────────────────┘
```

**The flow:**

1. You mutate `state.messages.push(...)` in your React component
2. Valtio detects the change and notifies subscribers
3. valtio-y converts the mutation to a Yjs operation
4. Yjs encodes it and sends it via the WebSocket provider
5. The server relays it to all other connected clients
6. Other clients apply the update and their React components re-render

All of this happens in milliseconds, completely automatically!

## Common Issues & Solutions

### "Messages aren't syncing between tabs"

- **Check the room name:** Make sure all tabs are using the same room name
- **Check the server:** The free demo server `wss://demos.yjs.dev` should work, but might be slow
- **Check browser console:** Look for WebSocket connection errors

### "Page shows old messages when I refresh"

This is expected! The Yjs demo server doesn't persist data forever. For production, you'll want to:

- Use a proper Yjs server (see [deployment guides](./yjs-websocket-server.md))
- Add persistence with `y-indexeddb` for offline-first apps

### "TypeError: Cannot read properties of undefined"

Make sure you're initializing state before using it:

```tsx
// Do this after provider sync
provider.on("sync", () => {
  bootstrap({
    messages: [],
  });
});
```

### "Components not re-rendering"

Remember the golden rule:

- **Read** from `snap` (the snapshot from `useSnapshot`)
- **Write** to `state` (the proxy)

```tsx
// ✅ Correct
const snap = useSnapshot(state);
return <div>{snap.messages.length}</div>;

// ❌ Wrong - reading from proxy won't trigger re-renders
return <div>{state.messages.length}</div>;
```

## Next Steps

Congratulations! You've built your first collaborative app with valtio-y. Here's what to explore next:

### Learn More Patterns

- **[Basic Operations Guide](./basic-operations.md)** - Objects, arrays, nested structures, and all the operations you can do
- **[Core Concepts](./concepts.md)** - Understand CRDTs, conflict resolution, and the valtio-y mental model
- **[Undo/Redo](./undo-redo.md)** - Add undo/redo functionality with Yjs UndoManager

### Explore Examples

Check out the [examples directory](../examples/) for complete working apps:

- **[Simple Todos](../examples/05_todos_simple/)** - Single-file todo app with detailed comments (best for learning!)
- **[Object Sync](../examples/01_obj/)** - Minimal key-value sync example
- **[Full Todo App](../examples/04_todos/)** - Production-ready with drag-and-drop and filtering
- **[Minecraft Clone](../examples/03_minecraft/)** - Real-time multiplayer 3D game with WebRTC

### Deploy to Production

When you're ready to deploy, check out these guides:

- **[PartyKit Setup](./partykit-setup.md)** - Serverless real-time backend (easiest option!)
- **[Cloudflare Durable Objects](./cloudflare-durable-objects.md)** - Deploy on Cloudflare's edge
- **[Custom WebSocket Server](./yjs-websocket-server.md)** - Self-hosted Node.js server
- **[WebRTC P2P](./webrtc-p2p.md)** - Serverless peer-to-peer (no backend needed!)

### Advanced Topics

- **[Performance Guide](./performance-guide.md)** - Batching, bulk operations, and optimization
- **[Validation & Errors](./validation-errors.md)** - Add custom validation and error handling
- **[Debugging](./debugging.md)** - DevTools, logging, and troubleshooting

## Going Further: Add More Features

Now that you have the basics, try adding these features to practice:

### 1. Delete Messages

Add a delete button to each message:

```tsx
<button onClick={() => state.messages.splice(i, 1)}>Delete</button>
```

### 2. Edit Messages

Let users edit their messages:

```tsx
const [editing, setEditing] = useState<number | null>(null);

// In your message render:
{
  editing === i ? (
    <input
      value={state.messages[i].text}
      onChange={(e) => (state.messages[i].text = e.target.value)}
      onBlur={() => setEditing(null)}
    />
  ) : (
    <span onClick={() => setEditing(i)}>{msg.text}</span>
  );
}
```

### 3. Add Timestamps

Modify your message type:

```tsx
type Message = {
  name: string;
  text: string;
  timestamp: number;
};

// When adding:
state.messages.push({
  name: name.trim(),
  text: message.trim(),
  timestamp: Date.now(),
});

// When displaying:
<small>{new Date(msg.timestamp).toLocaleTimeString()}</small>;
```

### 4. Online User Count

Use Yjs awareness to show who's online:

```tsx
import { useEffect, useState } from "react";

function App() {
  const [userCount, setUserCount] = useState(0);

  useEffect(() => {
    const updateCount = () => {
      setUserCount(provider.awareness.getStates().size);
    };

    provider.awareness.on("change", updateCount);
    updateCount();

    return () => provider.awareness.off("change", updateCount);
  }, []);

  return <div>Users online: {userCount}</div>;
}
```

## Key Takeaways

You've learned the core workflow of valtio-y:

1. **Create a Yjs document:** `const ydoc = new Y.Doc()`
2. **Add a provider:** `new WebsocketProvider(...)`
3. **Create a proxy:** `createYjsProxy(ydoc, { getRoot: ... })`
4. **Read with snapshots:** `const snap = useSnapshot(state)`
5. **Write by mutation:** `state.messages.push(...)`

That's it! No special APIs, no complicated setup. Just write normal JavaScript and valtio-y handles the rest.

## Need Help?

- **Questions?** Ask in the [Valtio Discord](https://discord.gg/MrQdmzd)
- **Found a bug?** [Open an issue](https://github.com/valtiojs/valtio-y/issues)
- **Want to contribute?** [Check the repo](https://github.com/valtiojs/valtio-y)

Happy building! We can't wait to see what you create with valtio-y.

---

**What's next?** Check out the [Core Concepts guide](./concepts.md) to understand how CRDTs work under the hood, or jump straight into the [examples](../examples/) to see real-world apps.
