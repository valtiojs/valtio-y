/**
 * Yjs Setup with Y-PartyServer
 *
 * This file sets up valtio-y with real-time collaboration using y-partyserver.
 * Two clients connect to the same PartyServer room to demonstrate real-time sync.
 */

import * as Y from "yjs";
import YProvider from "y-partyserver/provider";
import { createYjsProxy } from "valtio-y";
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

/**
 * Connect both documents to the same Y-PartyServer room.
 * PartyServer converts TodosYServer -> todos-y-server (kebab-case)
 */
const Y_PARTY_HOST = "localhost:8788";
const ROOM_NAME = "todos-room";
const PARTY_NAME = "todos-y-server";

export const provider1 = new YProvider(Y_PARTY_HOST, ROOM_NAME, doc1, {
  connect: true,
  party: PARTY_NAME,
});

export const provider2 = new YProvider(Y_PARTY_HOST, ROOM_NAME, doc2, {
  connect: true,
  party: PARTY_NAME,
});

// ============================================================================
// SYNC STATUS TRACKING
// ============================================================================

/**
 * Track sync status for each client based on provider connection state
 */
let syncStatus1: SyncStatus = "offline";
let syncStatus2: SyncStatus = "offline";

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
 * Listen to provider1 connection status
 */
provider1.on("status", ({ status }: { status: string }) => {
  syncStatus1 = status === "connected" ? "connected" : "offline";
  notifySyncListeners();
});

provider1.on("sync", (synced: boolean) => {
  if (synced) {
    syncStatus1 = "connected";
    notifySyncListeners();
  }
});

/**
 * Listen to provider2 connection status
 */
provider2.on("status", ({ status }: { status: string }) => {
  syncStatus2 = status === "connected" ? "connected" : "offline";
  notifySyncListeners();
});

provider2.on("sync", (synced: boolean) => {
  if (synced) {
    syncStatus2 = "connected";
    notifySyncListeners();
  }
});

// ============================================================================
// VALTIO-YJS PROXY CREATION
// ============================================================================

/**
 * Create valtio-y proxies for each document.
 *
 * The proxy acts as a bridge between Valtio's reactive state and Yjs's CRDT.
 * - Write to the proxy like normal JavaScript: proxy.todos.push(newTodo)
 * - Changes automatically sync through Yjs to all connected clients
 * - Read from the proxy using Valtio's useSnapshot() hook in React
 */
export const { proxy: proxy1, bootstrap: bootstrap1 } =
  createYjsProxy<AppState>(doc1, {
    getRoot: (doc: Y.Doc) => doc.getMap("sharedState"),
  });

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

/**
 * Get the provider for a specific client
 */
export function getProvider(clientId: 1 | 2): YProvider {
  return clientId === 1 ? provider1 : provider2;
}

/**
 * Connect a client to the server
 */
export function connectClient(clientId: 1 | 2): void {
  const provider = getProvider(clientId);
  provider.connect();
}

/**
 * Disconnect a client from the server
 */
export function disconnectClient(clientId: 1 | 2): void {
  const provider = getProvider(clientId);
  provider.disconnect();
}

/**
 * Check if a client is connected
 */
export function isClientConnected(clientId: 1 | 2): boolean {
  const provider = getProvider(clientId);
  return provider.wsconnected;
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
