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

import { useEffect, useMemo, useState } from "react";
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

const App = () => {
  const [roomId] = useState<string>(
    () => window.location.hash.slice(1) || "default",
  );
  const [syncStatus, setSyncStatus] = useState<
    "connecting" | "connected" | "syncing" | "disconnected"
  >("connecting");

  // Create Y.Doc and proxy (single instance per room)
  const { proxy, provider } = useMemo(() => {
    const ydoc = new Y.Doc();

    // Create the Yjs proxy with realtime sync
    const { proxy } = createYjsProxy<AppState>(ydoc, {
      getRoot: (doc: Y.Doc) => doc.getMap("root"),
    });

    // Initialize default state if empty
    if (!proxy.user) {
      proxy.user = { name: "", age: 0 };
    }
    if (!proxy.message) {
      proxy.message = "";
    }
    if (typeof proxy.counter !== "number") {
      proxy.counter = 0;
    }
    if (!proxy.items) {
      proxy.items = [];
    }

    // Connect to PartyServer
    const resolvedHost = import.meta.env.PROD
      ? window.location.host
      : window.location.host;

    const provider = new YProvider(resolvedHost, roomId, ydoc, {
      connect: true,
      party: "y-doc-server",
    });

    return { proxy, provider };
  }, [roomId]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      provider.disconnect();
      if (typeof provider.destroy === "function") {
        provider.destroy();
      }
    };
  }, [provider]);

  // Track sync status
  useEffect(() => {
    if (!provider) return;

    setSyncStatus("connecting");

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
  }, [provider]);

  // Use snapshot with sync: true for realtime updates (every keystroke)
  const snap = useSnapshot(proxy, { sync: true });

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 text-white p-8">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2">valtio-y Simple Example</h1>
          <p className="text-gray-400">
            Open in multiple browsers to see realtime sync!
          </p>
          <div className="mt-2 flex items-center gap-2">
            <span className="text-sm">Status:</span>
            <span
              className={`px-2 py-1 rounded text-xs font-medium ${
                syncStatus === "connected"
                  ? "bg-green-600"
                  : syncStatus === "syncing"
                    ? "bg-yellow-600"
                    : syncStatus === "connecting"
                      ? "bg-blue-600"
                      : "bg-red-600"
              }`}
            >
              {syncStatus}
            </span>
            <span className="text-xs text-gray-500">Room: {roomId}</span>
          </div>
        </div>

        {/* Object Example */}
        <div className="bg-gray-800 rounded-lg p-6 mb-6 border border-gray-700">
          <h2 className="text-2xl font-semibold mb-4">📦 Object (Nested)</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Name</label>
              <input
                type="text"
                value={snap.user.name}
                onChange={(e) => {
                  proxy.user.name = e.target.value;
                }}
                placeholder="Type your name..."
                className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Age</label>
              <input
                type="number"
                value={snap.user.age}
                onChange={(e) => {
                  proxy.user.age = parseInt(e.target.value) || 0;
                }}
                placeholder="Enter age..."
                className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>

        {/* String Example */}
        <div className="bg-gray-800 rounded-lg p-6 mb-6 border border-gray-700">
          <h2 className="text-2xl font-semibold mb-4">💬 String</h2>
          <textarea
            value={snap.message}
            onChange={(e) => {
              proxy.message = e.target.value;
            }}
            placeholder="Type a message..."
            rows={3}
            className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Number Example */}
        <div className="bg-gray-800 rounded-lg p-6 mb-6 border border-gray-700">
          <h2 className="text-2xl font-semibold mb-4">🔢 Number (Counter)</h2>
          <div className="flex items-center gap-4">
            <button
              onClick={() => {
                proxy.counter--;
              }}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded font-medium"
            >
              -
            </button>
            <span className="text-3xl font-bold min-w-[60px] text-center">
              {snap.counter}
            </span>
            <button
              onClick={() => {
                proxy.counter++;
              }}
              className="px-4 py-2 bg-green-600 hover:bg-green-700 rounded font-medium"
            >
              +
            </button>
            <button
              onClick={() => {
                proxy.counter = 0;
              }}
              className="px-4 py-2 bg-gray-600 hover:bg-gray-700 rounded font-medium"
            >
              Reset
            </button>
          </div>
        </div>

        {/* Array Example */}
        <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
          <h2 className="text-2xl font-semibold mb-4">📋 Array (List)</h2>
          <div className="space-y-4">
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Add new item..."
                onKeyDown={(e) => {
                  if (e.key === "Enter" && e.currentTarget.value.trim()) {
                    proxy.items.push(e.currentTarget.value.trim());
                    e.currentTarget.value = "";
                  }
                }}
                className="flex-1 px-4 py-2 bg-gray-700 border border-gray-600 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded font-medium"
              >
                Add
              </button>
            </div>
            <div className="space-y-2">
              {snap.items.length === 0 ? (
                <p className="text-gray-500 italic">No items yet...</p>
              ) : (
                snap.items.map((item: string, index: number) => (
                  <div
                    key={index}
                    className="flex items-center justify-between bg-gray-700 px-4 py-2 rounded"
                  >
                    <span>{item}</span>
                    <button
                      onClick={() => {
                        proxy.items.splice(index, 1);
                      }}
                      className="text-red-400 hover:text-red-300 font-medium"
                    >
                      ✕
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-8 text-center text-gray-500 text-sm">
          <p>
            Every change syncs instantly with{" "}
            <code>useSnapshot(proxy, &#123; sync: true &#125;)</code>
          </p>
        </div>
      </div>
    </div>
  );
};

export default App;
