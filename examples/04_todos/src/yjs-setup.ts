/**
 * Yjs Setup and Network Simulation
 * 
 * This file demonstrates how to set up valtio-yjs for real-time collaboration.
 * In a real application, you would connect these documents to a network provider
 * (like y-websocket, y-webrtc, etc.) instead of this manual relay.
 */

import * as Y from "yjs";
import { createYjsProxy } from "valtio-yjs";
import type { AppState, SyncStatus } from "./types";

// ============================================================================
// YJS DOCUMENT SETUP
// ============================================================================

/**
 * Create two separate Y.Doc instances to simulate two different clients.
 * Each client has their own Y.Doc that tracks changes and syncs with others.
 */
export const doc1 = new Y.Doc();
export const doc2 = new Y.Doc();

// ============================================================================
// NETWORK SIMULATION
// ============================================================================

/**
 * Symbol used to mark updates that come from the relay, preventing infinite loops.
 * When we receive an update from the network, we mark it with this origin so
 * we don't send it back out again.
 */
const RELAY_ORIGIN = Symbol("relay-origin");

/**
 * Track sync status for each client
 */
let syncStatus1: SyncStatus = "connected";
let syncStatus2: SyncStatus = "connected";

/**
 * Listeners that get notified when sync status changes
 */
const syncListeners: Set<() => void> = new Set();

/**
 * Notify all sync status listeners of a change
 */
const notifySyncListeners = () => {
  syncListeners.forEach((listener) => listener());
};

/**
 * Set up a simulated network relay between the two documents.
 * 
 * HOW IT WORKS:
 * 1. When doc1 changes, it emits an "update" event with a binary update
 * 2. We apply that update to doc2 (simulating network transmission)
 * 3. The same happens in reverse for doc2 -> doc1
 * 
 * In a real app, you would use a network provider like:
 * - y-websocket: WebSocket connection to a server
 * - y-webrtc: Peer-to-peer WebRTC connections
 * - y-indexeddb: Local persistence with optional sync
 */
doc1.on("update", (update: Uint8Array, origin: unknown) => {
  // Ignore updates that came from the relay (prevents infinite loop)
  if (origin === RELAY_ORIGIN) return;

  // Show syncing status
  syncStatus1 = "syncing";
  notifySyncListeners();

  // Simulate network delay (100ms)
  setTimeout(() => {
    // Apply the update to doc2 within a transaction marked with RELAY_ORIGIN
    doc2.transact(() => {
      Y.applyUpdate(doc2, update);
    }, RELAY_ORIGIN);

    // Update complete
    syncStatus1 = "connected";
    notifySyncListeners();
  }, 100);
});

doc2.on("update", (update: Uint8Array, origin: unknown) => {
  if (origin === RELAY_ORIGIN) return;

  syncStatus2 = "syncing";
  notifySyncListeners();

  setTimeout(() => {
    doc1.transact(() => {
      Y.applyUpdate(doc1, update);
    }, RELAY_ORIGIN);

    syncStatus2 = "connected";
    notifySyncListeners();
  }, 100);
});

// ============================================================================
// VALTIO-YJS PROXY CREATION
// ============================================================================

/**
 * Create valtio-yjs proxies for each document.
 * 
 * The proxy acts as a bridge between Valtio's reactive state and Yjs's CRDT.
 * - Write to the proxy like normal JavaScript: proxy.todos.push(newTodo)
 * - Changes automatically sync through Yjs to all connected clients
 * - Read from the proxy using Valtio's useSnapshot() hook in React
 */
export const { proxy: proxy1, bootstrap: bootstrap1 } = createYjsProxy<AppState>(
  doc1,
  {
    getRoot: (doc: Y.Doc) => doc.getMap("sharedState"),
  }
);

export const { proxy: proxy2 } = createYjsProxy<AppState>(doc2, {
  getRoot: (doc: Y.Doc) => doc.getMap("sharedState"),
});

// ============================================================================
// SYNC STATUS API
// ============================================================================

/**
 * Subscribe to sync status changes for a specific client
 */
export function subscribeSyncStatus(listener: () => void): () => void {
  syncListeners.add(listener);
  return () => {
    syncListeners.delete(listener);
  };
}

/**
 * Get the current sync status for a client
 */
export function getSyncStatus(clientId: 1 | 2): SyncStatus {
  return clientId === 1 ? syncStatus1 : syncStatus2;
}

// ============================================================================
// INITIAL DATA
// ============================================================================

/**
 * Initialize with some sample data to demonstrate the features.
 * Note: We only need to initialize one proxy - it will sync to the other!
 */
proxy1.todos = [
  {
    id: "1",
    text: "Plan project architecture",
    completed: true,
    children: [
      { id: "1-1", text: "Research technologies", completed: true },
      { id: "1-2", text: "Design data model", completed: true },
    ],
  },
];

