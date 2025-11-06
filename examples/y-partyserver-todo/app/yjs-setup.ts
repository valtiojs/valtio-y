/**
 * Yjs Setup with valtio-y and Y-PartyServer
 *
 * This file sets up the real-time collaboration infrastructure:
 * 1. Creates a Yjs document
 * 2. Connects to Y-PartyServer (Cloudflare Durable Object)
 * 3. Creates a valtio-y proxy for reactive state management
 */

import * as Y from "yjs";
import YProvider from "y-partyserver/provider";
import { createYjsProxy } from "valtio-y";
import type { AppState, SyncStatus } from "./types";

// ============================================================================
// YJS DOCUMENT SETUP
// ============================================================================

/**
 * Create the shared Y.Doc that will sync across all clients
 */
export const yDoc = new Y.Doc();

/**
 * Connect to the Y-PartyServer worker
 * The worker runs on localhost:8788 in development
 */
const getPartyHost = () => {
  if (typeof window === "undefined") return "localhost:8788";
  return window.location.hostname === "localhost"
    ? "localhost:8788"
    : window.location.host;
};

const ROOM_NAME = "drawing-room";
const PARTY_NAME = "y-doc-server"; // PartyServer converts YDocServer -> y-doc-server

let provider: YProvider | null = null;

/**
 * Initialize the provider (call this on the client side only)
 */
export function initProvider(): YProvider {
  if (provider) return provider;

  const host = getPartyHost();
  console.log("[valtio-y] Creating YProvider");
  console.log("[valtio-y] Host:", host);
  console.log("[valtio-y] Party:", PARTY_NAME);
  console.log("[valtio-y] Room:", ROOM_NAME);

  provider = new YProvider(host, ROOM_NAME, yDoc, {
    connect: true,
    party: PARTY_NAME,
  });

  return provider;
}

// ============================================================================
// YJS AWARENESS - Ephemeral cursor/presence data
// ============================================================================

/**
 * Get the Awareness instance for ephemeral data (cursors, presence)
 * Awareness data is NOT persisted in the CRDT - perfect for cursors!
 */
export function getAwareness(): any {
  if (!provider) {
    throw new Error("[valtio-y] Provider not initialized");
  }
  return provider.awareness;
}

/**
 * Get the current provider instance
 */
export function getProvider(): YProvider | null {
  return provider;
}

// ============================================================================
// SYNC STATUS TRACKING
// ============================================================================

let syncStatus: SyncStatus = "offline";
const syncListeners: Set<() => void> = new Set();

function notifySyncListeners() {
  syncListeners.forEach((listener) => listener());
}

/**
 * Setup sync status listeners (call this after initProvider)
 */
export function setupSyncListeners() {
  if (!provider) {
    console.warn("[valtio-y] Provider not initialized");
    return;
  }

  provider.on("status", ({ status }: { status: string }) => {
    console.log("[valtio-y] Status changed:", status);
    syncStatus = status === "connected" ? "connected" : "offline";
    notifySyncListeners();
  });

  provider.on("sync", (synced: boolean) => {
    if (synced) {
      syncStatus = "connected";
      notifySyncListeners();
    }
  });

  provider.on("connection-error", (error: unknown) => {
    console.error("[valtio-y] Connection error:", error);
    syncStatus = "offline";
    notifySyncListeners();
  });
}

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
// VALTIO-Y PROXY CREATION
// ============================================================================

/**
 * Create the valtio-y proxy that bridges Valtio and Yjs.
 *
 * This proxy lets you:
 * - Write like normal JavaScript: proxy.shapes.push(newShape)
 * - Read reactively with useSnapshot(): const snap = useSnapshot(proxy)
 * - Sync automatically with all connected clients via Yjs CRDTs
 */
export const { proxy, bootstrap } = createYjsProxy<AppState>(yDoc, {
  getRoot: (doc: Y.Doc) => doc.getMap("drawingState"),
});

// ============================================================================
// INITIAL DATA
// ============================================================================

/**
 * Initialize the state with default values.
 * This will sync to all connected clients automatically.
 */
export function initializeState(
  userId: string,
  userName: string,
  userColor: string,
) {
  // Only initialize if the state is empty
  if (!proxy.shapes) {
    proxy.shapes = [];
  }

  // Set local awareness state (ephemeral, not persisted)
  const awareness = getAwareness();
  awareness.setLocalState({
    id: userId,
    name: userName,
    color: userColor,
    cursor: null,
  });

  console.log("[valtio-y] State initialized:", {
    shapes: proxy.shapes?.length || 0,
    clientId: awareness.clientID,
  });
}

/**
 * Clean up user on disconnect
 */
export function cleanupUser() {
  const awareness = getAwareness();
  awareness.setLocalState(null);
}

/**
 * Update local cursor position in awareness
 */
export function updateCursor(x: number, y: number) {
  const awareness = getAwareness();
  const currentState = awareness.getLocalState();
  if (currentState) {
    awareness.setLocalStateField("cursor", { x, y });
  }
}

/**
 * Get all connected users from awareness
 */
export function getAwarenessUsers(): any[] {
  const awareness = getAwareness();
  const users: any[] = [];
  awareness.getStates().forEach((state: any, clientId: number) => {
    if (state && clientId !== awareness.clientID) {
      users.push({ ...state, clientId });
    }
  });
  return users;
}

// ============================================================================
// UNDO/REDO MANAGER
// ============================================================================

let undoManager: Y.UndoManager | null = null;

/**
 * Initialize the undo manager for the shapes array
 */
export function initUndoManager() {
  const shapesArray = yDoc.getMap("drawingState").get("shapes") as Y.Array<any>;
  if (shapesArray) {
    undoManager = new Y.UndoManager(shapesArray, {
      trackedOrigins: new Set([yDoc.clientID]),
    });
  }
  return undoManager;
}

/**
 * Perform undo operation
 */
export function undo() {
  if (undoManager && undoManager.canUndo()) {
    undoManager.undo();
    return true;
  }
  return false;
}

/**
 * Perform redo operation
 */
export function redo() {
  if (undoManager && undoManager.canRedo()) {
    undoManager.redo();
    return true;
  }
  return false;
}

/**
 * Check if undo is available
 */
export function canUndo(): boolean {
  return undoManager?.canUndo() ?? false;
}

/**
 * Check if redo is available
 */
export function canRedo(): boolean {
  return undoManager?.canRedo() ?? false;
}

// ============================================================================
// PERFORMANCE TRACKING
// ============================================================================

let opCount = 0;
let lastStatsUpdate = Date.now();
let currentBatchSize = 0;

/**
 * Track an operation for performance stats
 */
export function trackOperation(batchSize = 1) {
  opCount += batchSize;
  currentBatchSize = Math.max(currentBatchSize, batchSize);

  const now = Date.now();
  const elapsed = now - lastStatsUpdate;

  // Update stats every second
  if (elapsed >= 1000) {
    const opsPerSecond = Math.round((opCount / elapsed) * 1000);

    if (!proxy.stats) {
      proxy.stats = {
        opsPerSecond: 0,
        batchSize: 0,
        totalOps: 0,
        lastUpdate: 0,
      };
    }

    proxy.stats.opsPerSecond = opsPerSecond;
    proxy.stats.batchSize = currentBatchSize;
    proxy.stats.totalOps = (proxy.stats.totalOps || 0) + opCount;
    proxy.stats.lastUpdate = now;

    // Reset counters
    opCount = 0;
    currentBatchSize = 0;
    lastStatsUpdate = now;
  }
}
