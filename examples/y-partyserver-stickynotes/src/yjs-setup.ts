/**
 * Yjs Setup with Cloudflare Durable Objects WebSocket Provider
 *
 * This file sets up valtio-y for real-time collaboration using a custom
 * WebSocket provider that connects to a Cloudflare Durable Object.
 */

import * as Y from "yjs";
import * as encoding from "lib0/encoding";
import * as decoding from "lib0/decoding";
import * as syncProtocol from "y-protocols/sync";
import * as awarenessProtocol from "y-protocols/awareness";
import { createYjsProxy } from "valtio-y";
import type { AppState, SyncStatus, UserPresence } from "./types";

const MESSAGE_SYNC = 0;
const MESSAGE_AWARENESS = 1;

// ============================================================================
// YJS DOCUMENT SETUP
// ============================================================================

export const doc = new Y.Doc();
export const awareness = new awarenessProtocol.Awareness(doc);

// ============================================================================
// WEBSOCKET CONNECTION
// ============================================================================

let ws: WebSocket | null = null;
let syncStatus: SyncStatus = "connecting";
const syncListeners: Set<() => void> = new Set();

const notifySyncListeners = () => {
  syncListeners.forEach((listener) => listener());
};

const setSyncStatus = (status: SyncStatus) => {
  syncStatus = status;
  notifySyncListeners();
};

/**
 * Connect to the Durable Object WebSocket
 */
export function connect(roomId: string = "default") {
  if (ws?.readyState === WebSocket.OPEN) return;

  setSyncStatus("connecting");

  // Connect via Vite proxy
  const wsUrl = `ws://${window.location.host}/api/${roomId}`;
  ws = new WebSocket(wsUrl);

  ws.binaryType = "arraybuffer";

  ws.onopen = () => {
    setSyncStatus("connected");
  };

  ws.onmessage = (event) => {
    const data = new Uint8Array(event.data);
    const decoder = decoding.createDecoder(data);
    const messageType = decoding.readVarUint(decoder);

    if (messageType === MESSAGE_SYNC) {
      setSyncStatus("syncing");

      const encoder = encoding.createEncoder();
      encoding.writeVarUint(encoder, MESSAGE_SYNC);

      syncProtocol.readSyncMessage(decoder, encoder, doc, null);

      const response = encoding.toUint8Array(encoder);
      if (response.length > 1 && ws?.readyState === WebSocket.OPEN) {
        ws.send(response);
      }

      setSyncStatus("connected");
    } else if (messageType === MESSAGE_AWARENESS) {
      awarenessProtocol.applyAwarenessUpdate(
        awareness,
        decoding.readVarUint8Array(decoder),
        null
      );
    }
  };

  ws.onerror = () => {
    setSyncStatus("disconnected");
  };

  ws.onclose = () => {
    setSyncStatus("disconnected");

    // Attempt to reconnect after 2 seconds
    setTimeout(() => connect(roomId), 2000);
  };

  // Send local changes to server
  doc.on("update", (update: Uint8Array, origin: unknown) => {
    if (origin === "network" || !ws || ws.readyState !== WebSocket.OPEN) return;

    const encoder = encoding.createEncoder();
    encoding.writeVarUint(encoder, MESSAGE_SYNC);
    syncProtocol.writeUpdate(encoder, update);
    ws.send(encoding.toUint8Array(encoder));
  });

  // Send awareness updates
  awareness.on("update", ({ added, updated, removed }: {
    added: number[];
    updated: number[];
    removed: number[];
  }) => {
    if (!ws || ws.readyState !== WebSocket.OPEN) return;

    const changedClients = added.concat(updated).concat(removed);
    const encoder = encoding.createEncoder();
    encoding.writeVarUint(encoder, MESSAGE_AWARENESS);
    encoding.writeVarUint8Array(
      encoder,
      awarenessProtocol.encodeAwarenessUpdate(awareness, changedClients)
    );
    ws.send(encoding.toUint8Array(encoder));
  });
}

// ============================================================================
// VALTIO-YJS PROXY CREATION
// ============================================================================

export const { proxy, bootstrap } = createYjsProxy<AppState>(doc, {
  getRoot: (doc: Y.Doc) => doc.getMap("sharedState"),
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
