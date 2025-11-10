import * as Y from "yjs";
import { WebsocketProvider } from "y-websocket";
import { createYjsProxy, VALTIO_Y_ORIGIN } from "valtio-y";
import { useSnapshot } from "valtio";
import { useState } from "react";

const ydoc = new Y.Doc();
const provider = new WebsocketProvider(
  "ws://localhost:1234",
  "valtio-y-demo",
  ydoc,
);

// Create custom UndoManager instance with custom configuration
const messagesMap = ydoc.getMap("messages.v1");
const customUndoManager = new Y.UndoManager(messagesMap, {
  captureTimeout: 1000, // Group operations within 1 second
  trackedOrigins: new Set([VALTIO_Y_ORIGIN]), // Only track valtio-y changes
  deleteFilter: (_item) => {
    // Optional: filter out certain operations from undo stack
    // Return false to exclude an item from undo/redo
    return true; // Track everything
  },
});

const {
  proxy: mesgMap,
  bootstrap,
  undo,
  redo,
  undoState,
  manager, // Access to the underlying Y.UndoManager
} = createYjsProxy<Record<string, string>>(ydoc, {
  getRoot: (doc: Y.Doc) => doc.getMap("messages.v1"),
  undoManager: customUndoManager, // Pass the custom instance
});
// Initialize once after network sync; bootstrap is a no-op if remote state exists
provider.on("sync", () => {
  try {
    bootstrap({});
  } catch {}
});

const UndoRedoControls = () => {
  const snap = useSnapshot(undoState);
  return (
    <div style={{ marginBottom: "1rem" }}>
      <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
        <button onClick={undo} disabled={!snap.canUndo}>
          ↶ Undo
        </button>
        <button onClick={redo} disabled={!snap.canRedo}>
          ↷ Redo
        </button>
        <button
          onClick={() => {
            manager.clear();
            console.log("Undo/redo history cleared");
          }}
          disabled={!snap.canUndo && !snap.canRedo}
        >
          Clear History
        </button>
        <span style={{ marginLeft: "1rem", color: "#666" }}>
          {snap.canUndo ? "Can undo" : "Nothing to undo"} |{" "}
          {snap.canRedo ? "Can redo" : "Nothing to redo"}
        </span>
      </div>
      <div style={{ marginTop: "0.5rem", fontSize: "0.9em", color: "#666" }}>
        Using custom UndoManager with 1s capture timeout
      </div>
    </div>
  );
};

const MyMessage = () => {
  const [name, setName] = useState("");
  const [message, setMessage] = useState("");
  const send = () => {
    if (name && message) {
      mesgMap[name] = message;
    }
  };
  return (
    <div>
      <div>
        Name: <input value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <div>
        Message:{" "}
        <input value={message} onChange={(e) => setMessage(e.target.value)} />
      </div>
      <button disabled={!name || !message} onClick={send}>
        Send
      </button>
    </div>
  );
};

const Messages = () => {
  const snap = useSnapshot(mesgMap);
  return (
    <div>
      {Object.keys(snap)
        .reverse()
        .map((key) => (
          <p key={key}>
            {key}: {snap[key]}
          </p>
        ))}
    </div>
  );
};

const App = () => (
  <div>
    <h1>Valtio-Y Example: Messages with Undo/Redo</h1>
    <UndoRedoControls />
    <h2>My Message</h2>
    <MyMessage />
    <h2>Messages</h2>
    <Messages />
  </div>
);

export default App;
