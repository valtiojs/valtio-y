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
export function initializeState(userId: string, userName: string, userColor: string) {
  // Only initialize if the state is empty
  if (!proxy.shapes) {
    proxy.shapes = [];
  }
  if (!proxy.users) {
    proxy.users = {};
  }

  // Add current user
  if (!proxy.users[userId]) {
    proxy.users[userId] = {
      id: userId,
      name: userName,
      color: userColor,
      selection: [],
    };
  }

  console.log("[valtio-y] State initialized:", {
    shapes: proxy.shapes?.length || 0,
    users: Object.keys(proxy.users || {}).length,
  });
}

/**
 * Clean up user on disconnect
 */
export function cleanupUser(userId: string) {
  if (proxy.users?.[userId]) {
    delete proxy.users[userId];
  }
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
