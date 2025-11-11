/**
 * Collaborative Todo List - Main Application
 *
 * This example demonstrates the key features of valtio-y:
 *
 * 1. **Simple API**: Just mutate the proxy like regular JavaScript objects
 * 2. **Real-time Sync**: Changes sync automatically between clients via Yjs
 * 3. **Nested Structures**: Deep nesting and arrays work seamlessly
 * 4. **React Integration**: Use useSnapshot() to read state reactively
 * 5. **Complex Operations**: Drag-and-drop, bulk edits, all sync correctly
 *
 * The code is split into logical files for learning:
 * - types.ts: Type definitions
 * - yjs-setup.ts: RoomState class with undo/redo support
 * - use-room-provider.ts: Hook for managing PartyServer connection
 * - utils.ts: Helper functions for nested data
 * - components/: Individual React components
 */

import { useEffect, useMemo, useState } from "react";
import { RoomState } from "./yjs-setup";
import { useRoomProvider } from "./use-room-provider";
import { ClientView } from "./components/client-view";
import type { SyncStatus } from "./types";

/**
 * Main App Component
 *
 * Renders a single shared todo list backed by a Y.Doc hosted on PartyServer.
 * Open this example in a second browser or device to experience real-time sync.
 *
 * Try it:
 * - Add a todo and watch it appear instantly everywhere
 * - Disconnect/reconnect to test offline behavior
 * - Drag items to reorder them
 * - Add nested subtasks with the + button
 * - Use selection mode for bulk operations
 * - Double-click any todo to edit it inline
 */
const App = () => {
  const [roomId, setRoomId] = useState<string>(
    () => window.location.hash.slice(1) || "default",
  );
  const [syncStatus, setSyncStatus] = useState<SyncStatus>("connecting");

  // React to hash changes so switching rooms updates state automatically
  useEffect(() => {
    const handleHashChange = () => {
      const hashRoom = window.location.hash.slice(1) || "default";
      setRoomId(hashRoom);
    };

    window.addEventListener("hashchange", handleHashChange);
    return () => window.removeEventListener("hashchange", handleHashChange);
  }, []);

  const room = useMemo(() => new RoomState(), [roomId]);

  const { doc, proxy } = room;

  // Connect to PartyServer using useRoomProvider hook
  // Connect using y-partyserver defaults: /parties/:party/:room.
  // PartyServer converts YDocServer -> y-doc-server
  // In dev mode, don't specify host - let YProvider auto-detect
  const provider = useRoomProvider({
    host: import.meta.env.PROD ? window.location.host : undefined,
    room: roomId,
    party: "y-doc-server",
    doc,
  });

  // Cleanup: dispose room when component unmounts or room changes
  useEffect(() => {
    return () => {
      // Provider cleanup happens first (in useRoomProvider)
      // Then we dispose the room
      room.dispose();
    };
  }, [room]);

  // Track sync status based on provider events
  useEffect(() => {
    if (!provider) return;

    setSyncStatus("connecting");

    type ProviderWithConnectionState = typeof provider & {
      wsconnected: boolean;
      wsconnecting: boolean;
      shouldConnect: boolean;
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

    // Listen to status changes
    provider.on("status", updateStatus);
    provider.on("sync", updateStatus);

    // Handle connection errors
    provider.on("connection-error", () => {
      setSyncStatus("disconnected");
    });

    provider.on("connection-close", () => {
      setSyncStatus("disconnected");
    });

    // Update status immediately
    updateStatus();

    return () => {
      provider.off("status", updateStatus);
      provider.off("connection-error", () => {});
      provider.off("connection-close", () => {});
    };
  }, [provider]);

  return (
    <div className="w-full h-full flex items-center justify-center p-6">
      {/* Main content container */}
      <div className="w-full max-w-2xl">
        <ClientView stateProxy={proxy} syncStatus={syncStatus} />
      </div>
    </div>
  );
};

export default App;
