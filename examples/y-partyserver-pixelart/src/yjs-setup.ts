/**
 * Yjs Setup with PartyKit
 *
 * This file demonstrates how to set up valtio-y for real-time collaboration
 * using y-partyserver (PartyKit) as the network provider.
 */

import * as Y from "yjs";
import YProvider from "y-partyserver/provider";
import { createYjsProxy } from "valtio-y";
import { proxy as localProxy } from "valtio/vanilla";
import type { AppState, SyncStatus, UIState } from "./types";

// ============================================================================
// YJS DOCUMENT SETUP
// ============================================================================

/**
 * Create the Y.Doc instance for this client
 */
export const doc = new Y.Doc();

// ============================================================================
// NETWORK CONNECTION WITH Y-PARTYSERVER
// ============================================================================

/**
 * Track sync status
 */
let syncStatus: SyncStatus = "connected";

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
 * Connect to the PartyKit server running on localhost:1999
 * All clients connecting to the same room name will share the same document
 */
const provider = new YProvider("localhost:1999", "pixelart-demo", doc);

// Update sync status based on provider status
provider.on("status", ({ status }: { status: string }) => {
  syncStatus = status === "connected" ? "connected" : "syncing";
  notifySyncListeners();
});

provider.on("sync", (isSynced: boolean) => {
  if (isSynced) {
    syncStatus = "connected";
  } else {
    syncStatus = "syncing";
  }
  notifySyncListeners();
});

// ============================================================================
// VALTIO-YJS PROXY CREATION
// ============================================================================

/**
 * Create valtio-y proxy for the shared state
 *
 * The proxy acts as a bridge between Valtio's reactive state and Yjs's CRDT.
 * - Write to the proxy like normal JavaScript: proxy.grid.pixels[row][col] = color
 * - Changes automatically sync through Yjs to all connected clients
 * - Read from the proxy using Valtio's useSnapshot() hook in React
 */
export const { proxy, bootstrap } = createYjsProxy<AppState>(doc, {
  getRoot: (doc: Y.Doc) => doc.getMap("sharedState"),
});

// ============================================================================
// LOCAL UI STATE (NOT SYNCED)
// ============================================================================

/**
 * Local UI state that doesn't need to be synced across clients
 */
export const uiState = localProxy<UIState>({
  selectedColor: "#000000",
  selectedTool: "pencil",
  isDrawing: false,
});

// ============================================================================
// PRESENCE AWARENESS
// ============================================================================

/**
 * Get the Awareness instance for presence (cursors, user info)
 */
export const awareness = provider.awareness;

/**
 * Generate a random username
 */
function generateUsername(): string {
  const adjectives = [
    "Happy",
    "Clever",
    "Brave",
    "Swift",
    "Calm",
    "Bold",
    "Wise",
    "Kind",
  ];
  const nouns = [
    "Panda",
    "Tiger",
    "Eagle",
    "Fox",
    "Wolf",
    "Bear",
    "Hawk",
    "Lion",
  ];
  const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
  const noun = nouns[Math.floor(Math.random() * nouns.length)];
  return `${adj}${noun}`;
}

/**
 * Generate a random color for user cursor
 */
function generateUserColor(): string {
  const colors = [
    "#ef4444",
    "#f97316",
    "#eab308",
    "#22c55e",
    "#06b6d4",
    "#3b82f6",
    "#8b5cf6",
    "#ec4899",
  ];
  return colors[Math.floor(Math.random() * colors.length)];
}

/**
 * Set local user info in awareness
 */
export function initializeUser() {
  awareness.setLocalStateField("user", {
    name: generateUsername(),
    color: generateUserColor(),
  });
}

// ============================================================================
// SYNC STATUS API
// ============================================================================

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

// ============================================================================
// INITIALIZATION
// ============================================================================

/**
 * Initialize the grid if it doesn't exist
 */
provider.on("sync", (isSynced: boolean) => {
  if (isSynced && !proxy.grid) {
    console.log("Initializing empty grid...");
    // Create a 32x32 grid
    proxy.grid = {
      pixels: Array(32)
        .fill(null)
        .map(() => Array(32).fill(null)),
    };
  }
});

// Initialize user presence
initializeUser();

// Export provider for connection status monitoring
export { provider };
