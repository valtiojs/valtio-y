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
import { createYjsProxy, VALTIO_Y_ORIGIN } from "valtio-y";
import { proxy as valtioProxy } from "valtio";
import type { AppState, SyncStatus } from "./types";

// ============================================================================
// YJS DOCUMENT SETUP
// ============================================================================

/**
 * Create the shared Y.Doc that will sync across all clients
 */
export const yDoc = new Y.Doc();

/**
 * PartyServer configuration
 */
export const ROOM_NAME = "drawing-room";
export const PARTY_NAME = "y-doc-server"; // PartyServer converts YDocServer -> y-doc-server

let currentProvider: YProvider | null = null;

/**
 * Set the current provider (called from useYProvider hook)
 */
export function setProvider(provider: YProvider) {
  currentProvider = provider;
}

// ============================================================================
// YJS AWARENESS - Ephemeral cursor/presence data
// ============================================================================

/**
 * Get the Awareness instance for ephemeral data (cursors, presence)
 * Awareness data is NOT persisted in the CRDT - perfect for cursors!
 */
export function getAwareness(): any {
  if (!currentProvider) {
    throw new Error("[valtio-y] Provider not initialized");
  }
  return currentProvider.awareness;
}

/**
 * Get the current provider instance
 */
export function getProvider(): YProvider | null {
  return currentProvider;
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
 * Setup sync status listeners (call this after provider is ready)
 */
export function setupSyncListeners(provider: YProvider) {
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

/**
 * UI state proxy for reactive undo/redo state
 * This is a Valtio proxy that components can subscribe to via useSnapshot()
 */
export const uiState = valtioProxy({
  canUndo: false,
  canRedo: false,
});

let undoManager: Y.UndoManager | null = null;

/**
 * Update the UI state with current undo/redo availability
 */
function updateUndoRedoState() {
  uiState.canUndo = undoManager?.canUndo() ?? false;
  uiState.canRedo = undoManager?.canRedo() ?? false;
}

/**
 * Initialize the undo manager for the drawing state
 *
 * IMPORTANT: We track VALTIO_Y_ORIGIN because all valtio-y changes
 * use this origin. This ensures we only track local changes made
 * through the valtio proxy, not remote changes from other clients.
 */
export function initUndoManager() {
  const drawingStateMap = yDoc.getMap("drawingState");

  undoManager = new Y.UndoManager(drawingStateMap, {
    trackedOrigins: new Set([VALTIO_Y_ORIGIN]),
  });

  // Listen to stack changes and update the reactive UI state
  undoManager.on("stack-item-added", () => {
    console.log("[undo/redo] Stack item added, canUndo:", undoManager?.canUndo(), "canRedo:", undoManager?.canRedo());
    updateUndoRedoState();
  });

  undoManager.on("stack-item-popped", () => {
    console.log("[undo/redo] Stack item popped, canUndo:", undoManager?.canUndo(), "canRedo:", undoManager?.canRedo());
    updateUndoRedoState();
  });

  // Set initial state
  updateUndoRedoState();

  return undoManager;
}

/**
 * Perform undo operation
 */
export function undo() {
  if (undoManager && undoManager.canUndo()) {
    undoManager.undo();
    updateUndoRedoState();
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
    updateUndoRedoState();
    return true;
  }
  return false;
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
