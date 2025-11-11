/**
 * Simple valtio-y Example - Single File Demo
 *
 * This example demonstrates the core features of valtio-y in one file:
 *
 * 1. **Simple API**: Just mutate the proxy like regular JavaScript
 * 2. **Real-time Sync**: Every keystroke syncs instantly via PartyServer
 * 3. **Type Support**: Full TypeScript support for objects, arrays, strings, numbers
 * 4. **React Integration**: Use useSnapshot({ sync: true }) for realtime updates
 *
 * Open this in multiple browsers to see changes sync in real-time!
 */

import { useEffect, useState } from "react";
import * as Y from "yjs";
import YProvider from "y-partyserver/provider";
import { createYjsProxy } from "valtio-y";
import { useSnapshot } from "valtio";

// Define our shared state structure
type AppState = {
  user: {
    name: string;
    age: number;
  };
  message: string;
  counter: number;
  items: string[];
};

// Create Y.Doc and valtio-y proxy (single global instance)
const ydoc = new Y.Doc();
const { proxy, bootstrap } = createYjsProxy<AppState>(ydoc, {
  getRoot: (doc: Y.Doc) => doc.getMap("root"),
});

// Connect to PartyServer
const roomId = window.location.hash.slice(1) || "default";
const resolvedHost = import.meta.env.PROD
  ? window.location.host
  : window.location.host;

const provider = new YProvider(resolvedHost, roomId, ydoc, {
  connect: true,
  party: "y-doc-server",
});

// Initialize default state after sync (no-op if remote data exists)
provider.once("synced", () => {
  bootstrap({
    user: { name: "sfsdfd", age: 0 },
    message: "sss",
    counter: 2,
    items: [],
  });
});

const App = () => {
  const [syncStatus, setSyncStatus] = useState<
    "connecting" | "connected" | "syncing" | "disconnected"
  >("connecting");

  // Track sync status
  useEffect(() => {
    type ProviderWithConnectionState = typeof provider & {
      wsconnected: boolean;
      wsconnecting: boolean;
    };

    const updateStatus = () => {
      const providerWithState =
        provider as unknown as ProviderWithConnectionState;

      if (providerWithState.wsconnected) {
        setSyncStatus(provider.synced ? "connected" : "syncing");
      } else if (providerWithState.wsconnecting) {
        setSyncStatus("connecting");
      } else {
        setSyncStatus("disconnected");
      }
    };

    provider.on("status", updateStatus);
    provider.on("sync", updateStatus);
    provider.on("connection-error", () => setSyncStatus("disconnected"));
    provider.on("connection-close", () => setSyncStatus("disconnected"));

    updateStatus();

    return () => {
      provider.off("status", updateStatus);
      provider.off("connection-error", () => {});
      provider.off("connection-close", () => {});
    };
  }, []);

  // Use snapshot with sync: true for realtime updates (every keystroke)
  const snap = useSnapshot(proxy, { sync: true });

  const getStatusColor = () => {
    switch (syncStatus) {
      case "connected":
        return "#22c55e";
      case "syncing":
        return "#eab308";
      case "connecting":
        return "#3b82f6";
      default:
        return "#ef4444";
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#1f2937",
        color: "white",
        padding: "2rem",
      }}
    >
      <div style={{ maxWidth: "800px", margin: "0 auto" }}>
        {/* Header */}
        <div style={{ marginBottom: "3rem" }}>
          <h1
            style={{
              fontSize: "2.5rem",
              fontWeight: "bold",
              marginBottom: "0.5rem",
            }}
          >
            valtio-y Simple Example
          </h1>
          <p style={{ color: "#9ca3af" }}>
            Open in multiple browsers to see realtime sync!
          </p>
          <div
            style={{
              marginTop: "0.5rem",
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
            }}
          >
            <span style={{ fontSize: "0.875rem" }}>Status:</span>
            <span
              style={{
                background: getStatusColor(),
                padding: "0.25rem 0.5rem",
                borderRadius: "0.25rem",
                fontSize: "0.75rem",
                fontWeight: "500",
              }}
            >
              {syncStatus}
            </span>
            <span style={{ fontSize: "0.75rem", color: "#9ca3af" }}>
              Room: {roomId}
            </span>
          </div>
        </div>

        {/* Object Example */}
        <div
          style={{
            background: "#374151",
            borderRadius: "0.5rem",
            padding: "1.5rem",
            marginBottom: "1.5rem",
          }}
        >
          <h2
            style={{
              fontSize: "1.5rem",
              fontWeight: "600",
              marginBottom: "1rem",
            }}
          >
            📦 Object (Nested)
          </h2>
          <div style={{ marginBottom: "1rem" }}>
            <label
              style={{
                display: "block",
                fontSize: "0.875rem",
                marginBottom: "0.25rem",
              }}
            >
              Name
            </label>
            <input
              type="text"
              value={snap.user?.name ?? ""}
              onChange={(e) => {
                if (!proxy.user) {
                  proxy.user = { name: "", age: 0 };
                }
                proxy.user.name = e.target.value;
              }}
              placeholder="Type your name..."
              style={{
                width: "100%",
                padding: "0.5rem",
                background: "#1f2937",
                border: "1px solid #4b5563",
                borderRadius: "0.25rem",
                color: "white",
              }}
            />
          </div>
          <div>
            <label
              style={{
                display: "block",
                fontSize: "0.875rem",
                marginBottom: "0.25rem",
              }}
            >
              Age
            </label>
            <input
              type="number"
              value={snap.user?.age ?? 0}
              onChange={(e) => {
                if (!proxy.user) {
                  proxy.user = { name: "", age: 0 };
                }
                proxy.user.age = parseInt(e.target.value) || 0;
              }}
              placeholder="Enter age..."
              style={{
                width: "100%",
                padding: "0.5rem",
                background: "#1f2937",
                border: "1px solid #4b5563",
                borderRadius: "0.25rem",
                color: "white",
              }}
            />
          </div>
        </div>

        {/* String Example */}
        <div
          style={{
            background: "#374151",
            borderRadius: "0.5rem",
            padding: "1.5rem",
            marginBottom: "1.5rem",
          }}
        >
          <h2
            style={{
              fontSize: "1.5rem",
              fontWeight: "600",
              marginBottom: "1rem",
            }}
          >
            💬 String
          </h2>
          <textarea
            value={snap.message ?? ""}
            onChange={(e) => {
              proxy.message = e.target.value;
            }}
            placeholder="Type a message..."
            rows={3}
            style={{
              width: "100%",
              padding: "0.5rem",
              background: "#1f2937",
              border: "1px solid #4b5563",
              borderRadius: "0.25rem",
              color: "white",
              fontFamily: "inherit",
            }}
          />
        </div>

        {/* Number Example */}
        <div
          style={{
            background: "#374151",
            borderRadius: "0.5rem",
            padding: "1.5rem",
            marginBottom: "1.5rem",
          }}
        >
          <h2
            style={{
              fontSize: "1.5rem",
              fontWeight: "600",
              marginBottom: "1rem",
            }}
          >
            🔢 Number (Counter)
          </h2>
          <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
            <button
              onClick={() => {
                proxy.counter--;
              }}
              style={{
                padding: "0.5rem 1rem",
                background: "#dc2626",
                border: "none",
                borderRadius: "0.25rem",
                color: "white",
                cursor: "pointer",
                fontWeight: "500",
              }}
            >
              -
            </button>
            <span
              style={{
                fontSize: "2rem",
                fontWeight: "bold",
                minWidth: "60px",
                textAlign: "center",
              }}
            >
              {snap.counter ?? 0}
            </span>
            <button
              onClick={() => {
                proxy.counter++;
              }}
              style={{
                padding: "0.5rem 1rem",
                background: "#16a34a",
                border: "none",
                borderRadius: "0.25rem",
                color: "white",
                cursor: "pointer",
                fontWeight: "500",
              }}
            >
              +
            </button>
            <button
              onClick={() => {
                proxy.counter = 0;
              }}
              style={{
                padding: "0.5rem 1rem",
                background: "#4b5563",
                border: "none",
                borderRadius: "0.25rem",
                color: "white",
                cursor: "pointer",
                fontWeight: "500",
              }}
            >
              Reset
            </button>
          </div>
        </div>

        {/* Array Example */}
        <div
          style={{
            background: "#374151",
            borderRadius: "0.5rem",
            padding: "1.5rem",
            marginBottom: "1.5rem",
          }}
        >
          <h2
            style={{
              fontSize: "1.5rem",
              fontWeight: "600",
              marginBottom: "1rem",
            }}
          >
            📋 Array (List)
          </h2>
          <div style={{ marginBottom: "1rem" }}>
            <div style={{ display: "flex", gap: "0.5rem" }}>
              <input
                type="text"
                placeholder="Add new item..."
                onKeyDown={(e) => {
                  if (e.key === "Enter" && e.currentTarget.value.trim()) {
                    proxy.items.push(e.currentTarget.value.trim());
                    e.currentTarget.value = "";
                  }
                }}
                style={{
                  flex: 1,
                  padding: "0.5rem",
                  background: "#1f2937",
                  border: "1px solid #4b5563",
                  borderRadius: "0.25rem",
                  color: "white",
                }}
              />
              <button
                onClick={() => {
                  const input = document.querySelector<HTMLInputElement>(
                    'input[placeholder="Add new item..."]',
                  );
                  if (input?.value.trim()) {
                    proxy.items.push(input.value.trim());
                    input.value = "";
                  }
                }}
                style={{
                  padding: "0.5rem 1rem",
                  background: "#2563eb",
                  border: "none",
                  borderRadius: "0.25rem",
                  color: "white",
                  cursor: "pointer",
                  fontWeight: "500",
                }}
              >
                Add
              </button>
            </div>
          </div>
          <div
            style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}
          >
            {!snap.items || snap.items.length === 0 ? (
              <p style={{ color: "#9ca3af", fontStyle: "italic", margin: 0 }}>
                No items yet...
              </p>
            ) : (
              snap.items.map((item: string, index: number) => (
                <div
                  key={index}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    background: "#1f2937",
                    padding: "0.5rem",
                    borderRadius: "0.25rem",
                  }}
                >
                  <span>{item}</span>
                  <button
                    onClick={() => {
                      proxy.items.splice(index, 1);
                    }}
                    style={{
                      background: "transparent",
                      border: "1px solid #ef4444",
                      color: "#ef4444",
                      borderRadius: "0.25rem",
                      padding: "0.25rem 0.5rem",
                      cursor: "pointer",
                      fontSize: "0.875rem",
                    }}
                  >
                    ✕
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            textAlign: "center",
            color: "#9ca3af",
            fontSize: "0.875rem",
            marginTop: "2rem",
          }}
        >
          <p>
            Every change syncs instantly with{" "}
            <code>useSnapshot(proxy, {"{ sync: true }"})</code>
          </p>
        </div>
      </div>
    </div>
  );
};

export default App;
