/**
 * Yjs setup for connecting to the Durable Object via WebSocket
 */

import * as Y from "yjs";
import { createYjsProxy } from "valtio-y";
import { YPartyKitProvider } from "y-partyserver/provider";
import type { GameState, SyncStatus } from "./types";

// Create the Yjs document
export const doc = new Y.Doc();

// Create the valtio-y proxy
export const { proxy, bootstrap } = createYjsProxy<GameState>(doc, {
  getRoot: (doc: Y.Doc) => doc.getMap("sharedState"),
});

// Sync status state
let syncStatus: SyncStatus = "connecting";
const syncListeners: Set<() => void> = new Set();

function notifySyncListeners() {
  syncListeners.forEach((listener) => listener());
}

// Generate a unique client ID for this session
export const clientId = `client-${Math.random().toString(36).substr(2, 9)}`;

// Get room ID from URL or use default
const getRoomId = () => {
  const params = new URLSearchParams(window.location.search);
  return params.get("room") || "default";
};

// Determine WebSocket URL based on environment
const getWebSocketUrl = () => {
  const roomId = getRoomId();

  // In development, use the proxy configured in vite.config.ts
  if (import.meta.env.DEV) {
    // Use the Vite dev server URL which will proxy to Wrangler
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    return `${protocol}//${window.location.host}/parties/tictactoe/${roomId}`;
  }

  // In production, use the deployed worker URL
  return `wss://y-partyserver-tictactoe.YOUR_SUBDOMAIN.workers.dev/parties/tictactoe/${roomId}`;
};

// Initialize the provider
export const provider = new YPartyKitProvider(getWebSocketUrl(), doc);

// Set up sync status tracking
provider.on("status", ({ status }: { status: string }) => {
  const newStatus = status === "connected" ? "connected" : "connecting";
  if (syncStatus !== newStatus) {
    syncStatus = newStatus;
    notifySyncListeners();
  }
});

provider.on("sync", ({ synced }: { synced: boolean }) => {
  if (synced && syncStatus !== "connected") {
    syncStatus = "connected";
    notifySyncListeners();
  }
});

// Handle connection errors
provider.on("connection-close", () => {
  syncStatus = "disconnected";
  notifySyncListeners();
});

provider.on("connection-error", () => {
  syncStatus = "disconnected";
  notifySyncListeners();
});

/**
 * Subscribe to sync status changes
 */
export function subscribeSyncStatus(listener: () => void): () => void {
  syncListeners.add(listener);
  return () => {
    syncListeners.delete(listener);
  };
}

/**
 * Get the current sync status
 */
export function getSyncStatus(): SyncStatus {
  return syncStatus;
}

/**
 * Cleanup function to call when unmounting
 */
export function cleanup() {
  provider.destroy();
}
