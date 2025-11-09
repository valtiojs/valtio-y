/**
 * Yjs Setup with y-partyserver Provider
 *
 * This file sets up valtio-y for real-time collaboration using y-partyserver.
 */

import * as Y from "yjs";
import * as awarenessProtocol from "y-protocols/awareness";
import { proxy as createProxy } from "valtio";
import { createYjsProxy } from "valtio-y";
import type { AppState, SyncStatus, UserPresence } from "./types";

// ============================================================================
// YJS DOCUMENT SETUP
// ============================================================================

export const doc = new Y.Doc();
export const awareness = new awarenessProtocol.Awareness(doc);

// ============================================================================
// SYNC STATUS TRACKING
// ============================================================================

// Valtio proxy for sync status
export const syncStatusProxy = createProxy<{ status: SyncStatus }>({
  status: "connecting",
});

export const setSyncStatus = (status: SyncStatus) => {
  syncStatusProxy.status = status;
};

// ============================================================================
// VALTIO-YJS PROXY CREATION
// ============================================================================

export const { proxy, bootstrap } = createYjsProxy<AppState>(doc, {
  getRoot: (doc: Y.Doc) => doc.getMap("root"),
});

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

// Valtio proxy for presence states
// Maps clientId -> UserPresence (excluding local client)
export const presenceProxy = createProxy<Record<number, UserPresence>>({});

// Update the presence proxy when awareness changes
const updatePresenceProxy = () => {
  const states = awareness.getStates();
  const newPresence: Record<number, UserPresence> = {};

  states.forEach((state, clientId) => {
    // Exclude local client from presence proxy
    if (clientId !== doc.clientID && state.user) {
      newPresence[clientId] = state.user;
    }
  });

  // Remove clients that are no longer present
  Object.keys(presenceProxy).forEach((key) => {
    const clientId = Number(key);
    if (!(clientId in newPresence)) {
      delete presenceProxy[clientId];
    }
  });

  // Add or update clients
  Object.entries(newPresence).forEach(([clientId, presence]) => {
    const id = Number(clientId);
    if (presenceProxy[id]) {
      // Update existing entry - assign each property individually for reactivity
      const existing = presenceProxy[id];
      existing.cursor = presence.cursor;
      existing.selectedNoteId = presence.selectedNoteId;
      existing.editingNoteId = presence.editingNoteId;
      existing.color = presence.color;
      existing.name = presence.name;
    } else {
      // Create new entry
      presenceProxy[id] = { ...presence };
    }
  });
};

// Listen to awareness changes and update proxy
awareness.on("change", updatePresenceProxy);

// Initialize presence proxy with current state
updatePresenceProxy();

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
