/**
 * Yjs Setup with y-partyserver Provider
 *
 * This file sets up valtio-y for real-time collaboration using y-partyserver.
 */

import * as Y from "yjs";
import * as awarenessProtocol from "y-protocols/awareness";
import YProvider from "y-partyserver/provider";
import { createYjsProxy } from "valtio-y";
import type { AppState, SyncStatus, UserPresence } from "./types";

// ============================================================================
// YJS DOCUMENT SETUP
// ============================================================================

export const doc = new Y.Doc();
export const awareness = new awarenessProtocol.Awareness(doc);

// ============================================================================
// WEBSOCKET CONNECTION
// ============================================================================

let provider: YProvider | null = null;
let syncStatus: SyncStatus = "connecting";
let syncedInterval: ReturnType<typeof setInterval> | null = null;
const syncListeners: Set<() => void> = new Set();

const notifySyncListeners = () => {
  syncListeners.forEach((listener) => listener());
};

const setSyncStatus = (status: SyncStatus) => {
  syncStatus = status;
  notifySyncListeners();
};

/**
 * Connect to the Durable Object via y-partyserver
 */
export function connect(roomId: string = "default") {
  if (provider) {
    // Already connected, just return
    return;
  }

  // Clean up any existing interval
  if (syncedInterval) {
    clearInterval(syncedInterval);
    syncedInterval = null;
  }

  setSyncStatus("connecting");

  // Connect via Vite proxy (proxy forwards /api/* to localhost:8787)
  // Our worker expects URLs like /room-name, so we use prefix to customize the path
  const host = window.location.host;
  const wsUrl = `ws://${host}/api`;

  console.log("[valtio-y debug] Creating YProvider", { wsUrl, roomId });

  provider = new YProvider(wsUrl, roomId, doc, {
    awareness,
    connect: true,
    // Use empty prefix so YProvider constructs URL as /room-name instead of /parties/main/room-name
    prefix: "",
  });

  console.log("[valtio-y debug] YProvider created, setting up listeners");

  // Track sync status
  // YProvider extends WebsocketProvider which extends Observable<string>
  // It emits "status" events with connection status
  // Note: wsconnected and wsconnecting are public properties but not in types
  type ProviderWithConnectionState = YProvider & {
    wsconnected: boolean;
    wsconnecting: boolean;
  };

  const updateStatus = () => {
    if (!provider) return;
    
    const providerWithState = provider as unknown as ProviderWithConnectionState;
    
    // Check connection and sync state
    if (providerWithState.wsconnected) {
      setSyncStatus(provider.synced ? "connected" : "syncing");
    } else if (providerWithState.wsconnecting) {
      setSyncStatus("connecting");
    } else {
      setSyncStatus("disconnected");
    }
  };

  // Listen to status changes (emitted as string events)
  provider.on("status", (event: { status: string }) => {
    console.log("[valtio-y debug] Provider status event", event);
    updateStatus();
  });

  // Listen for sync events
  provider.on("sync", (isSynced: boolean) => {
    console.log("[valtio-y debug] Provider sync event", { isSynced });
  });
  
  // Also periodically check synced state since there's no dedicated synced event
  const checkSynced = () => {
    if (!provider) return;
    
    const providerWithState = provider as unknown as ProviderWithConnectionState;
    if (providerWithState.wsconnected) {
      if (provider.synced) {
        setSyncStatus("connected");
      } else {
        setSyncStatus("syncing");
      }
    }
  };
  
  // Poll for synced state (every 200ms is reasonable)
  syncedInterval = setInterval(checkSynced, 200);

  // Update status immediately
  updateStatus();
}

// ============================================================================
// VALTIO-YJS PROXY CREATION
// ============================================================================

export const { proxy, bootstrap } = createYjsProxy<AppState>(doc, {
  getRoot: (doc: Y.Doc) => doc.getMap("sharedState"),
  logLevel: "debug", // Enable debug logging to help troubleshoot sync issues
});

// Debug: Log when local changes are made to the doc
doc.on("update", (update: Uint8Array, origin: unknown) => {
  console.log("[valtio-y debug] Doc update event", {
    updateSize: update.length,
    origin: origin?.toString(),
    hasProvider: !!provider,
  });
});

// Debug: Log when the shared state changes
const sharedState = doc.getMap("sharedState");
sharedState.observe(() => {
  const notesValue = sharedState.get("notes");
  console.log("[valtio-y debug] SharedState changed", {
    notes: notesValue,
    notesType: notesValue?.constructor?.name,
    isYArray: notesValue instanceof Y.Array,
    nextZ: sharedState.get("nextZ"),
  });
});

// ============================================================================
// SYNC STATUS API
// ============================================================================

export function subscribeSyncStatus(listener: () => void): () => void {
  syncListeners.add(listener);
  return () => {
    syncListeners.delete(listener);
  };
}

export function getSyncStatus(): SyncStatus {
  return syncStatus;
}

// ============================================================================
// PRESENCE API
// ============================================================================

const colors = [
  "#ef4444", // red
  "#f59e0b", // orange
  "#10b981", // green
  "#3b82f6", // blue
  "#8b5cf6", // purple
  "#ec4899", // pink
];

let localClientId: number;
const clientColor = colors[Math.floor(Math.random() * colors.length)];

// Set initial local user presence
export function setLocalPresence(presence: Partial<UserPresence>) {
  if (!localClientId) {
    localClientId = doc.clientID;
  }

  awareness.setLocalStateField("user", {
    color: clientColor,
    name: `User ${localClientId}`,
    ...presence,
  });
}

export function getPresenceStates(): Map<number, UserPresence> {
  const states = new Map<number, UserPresence>();

  awareness.getStates().forEach((state, clientId) => {
    if (clientId !== doc.clientID && state.user) {
      states.set(clientId, state.user);
    }
  });

  return states;
}

export function subscribePresence(listener: () => void): () => void {
  awareness.on("change", listener);
  return () => {
    awareness.off("change", listener);
  };
}
