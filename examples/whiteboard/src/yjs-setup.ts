/**
 * Yjs Setup with valtio-y and Y-PartyServer
 *
 * This file sets up the real-time collaboration infrastructure:
 * 1. Creates a Yjs document
 * 2. Connects to Y-PartyServer (Cloudflare Durable Object)
 * 3. Creates a valtio-y proxy for reactive state management
 */

import * as Y from "yjs";
import * as awarenessProtocol from "y-protocols/awareness";
import { createYjsProxy, VALTIO_Y_ORIGIN } from "valtio-y";
import { proxy as valtioProxy } from "valtio";
import type { AppState, SyncStatus, User } from "./types";

// ============================================================================
// ROOM STATE CLASS
// ============================================================================

const USER_COLORS = [
  "#FF6B6B",
  "#4ECDC4",
  "#45B7D1",
  "#FFA07A",
  "#98D8C8",
  "#F7DC6F",
  "#BB8FCE",
];

/**
 * RoomState class manages a single room's Y.Doc, awareness, and proxy
 * This allows for proper cleanup when switching rooms
 */
export class RoomState {
  readonly doc: Y.Doc;
  readonly awareness: awarenessProtocol.Awareness;
  readonly proxy: AppState;
  readonly setLocalPresence: (presence: Partial<User>) => void;
  private readonly disposeBridge: () => void;
  private readonly userId: string;
  private readonly userName: string;
  private readonly userColor: string;

  constructor(userId: string, userName: string) {
    this.userId = userId;
    this.userName = userName;
    this.userColor =
      USER_COLORS[Math.floor(Math.random() * USER_COLORS.length)];

    this.doc = new Y.Doc();
    this.awareness = new awarenessProtocol.Awareness(this.doc);

    const { proxy, dispose } = createYjsProxy<AppState>(this.doc, {
      getRoot: (document: Y.Doc) => document.getMap("drawingState"),
    });

    this.proxy = proxy;
    this.disposeBridge = dispose;

    // Initialize shapes array if needed
    if (!this.proxy.shapes) {
      this.proxy.shapes = [];
    }

    // Initialize users object if needed
    if (!this.proxy.users) {
      this.proxy.users = {};
    }

    // Helper to set local presence
    this.setLocalPresence = (presence: Partial<User>) => {
      this.awareness.setLocalState({
        id: this.userId,
        name: this.userName,
        color: this.userColor,
        cursor: null,
        selection: [],
        ...presence,
      });
    };

    // Initialize local presence
    this.setLocalPresence({});
  }

  getUserId(): string {
    return this.userId;
  }

  getUserName(): string {
    return this.userName;
  }

  getUserColor(): string {
    return this.userColor;
  }

  dispose(): void {
    this.awareness.setLocalState(null);
    this.disposeBridge();
    // Note: We don't destroy awareness/doc here because the provider
    // might still be cleaning up. They'll be garbage collected naturally.
  }
}

// ============================================================================
// PARTYSERVER CONFIGURATION
// ============================================================================

/**
 * PartyServer configuration
 */
export const PARTY_NAME = "y-doc-server"; // PartyServer converts YDocServer -> y-doc-server

// ============================================================================
// SYNC STATUS TRACKING
// ============================================================================

let syncStatus: SyncStatus = "offline";
const syncListeners: Set<() => void> = new Set();

function notifySyncListeners() {
  syncListeners.forEach((listener) => listener());
}

/**
 * Update the sync status and notify listeners
 */
export function setSyncStatus(status: SyncStatus) {
  syncStatus = status;
  notifySyncListeners();
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
// AWARENESS UTILITIES
// ============================================================================

/**
 * Get all connected users from awareness (excluding local client)
 */
export function getAwarenessUsers(
  awareness: awarenessProtocol.Awareness,
): User[] {
  const users: User[] = [];
  awareness.getStates().forEach((state: unknown, clientId: number) => {
    if (state && clientId !== awareness.clientID) {
      users.push(state as User);
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
export function initUndoManager(doc: Y.Doc) {
  const drawingStateMap = doc.getMap("drawingState");

  undoManager = new Y.UndoManager(drawingStateMap, {
    trackedOrigins: new Set([VALTIO_Y_ORIGIN]),
  });

  // Listen to stack changes and update the reactive UI state
  undoManager.on("stack-item-added", () => {
    console.log(
      "[undo/redo] Stack item added, canUndo:",
      undoManager?.canUndo(),
      "canRedo:",
      undoManager?.canRedo(),
    );
    updateUndoRedoState();
  });

  undoManager.on("stack-item-popped", () => {
    console.log(
      "[undo/redo] Stack item popped, canUndo:",
      undoManager?.canUndo(),
      "canRedo:",
      undoManager?.canRedo(),
    );
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
export function trackOperation(proxy: AppState, batchSize = 1) {
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
