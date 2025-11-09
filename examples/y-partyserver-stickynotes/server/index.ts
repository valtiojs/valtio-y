/**
 * Cloudflare Durable Objects server for valtio-y Sticky Notes
 *
 * This server provides Yjs document synchronization using y-partyserver.
 * Each room is a separate Durable Object instance that manages a Y.Doc and WebSocket connections.
 */

import * as Y from "yjs";
import { YServer } from "y-partyserver";
import { getServerByName } from "partyserver";

interface Env {
  STICKYNOTES_DO: DurableObjectNamespace;
}

/**
 * Durable Object that handles a single sticky notes room
 */
export class StickyNotesRoom extends YServer<Env> {
  /**
   * Create fresh initial notes in the shared state
   * This is called on initial load and every 5 minutes via alarm
   */
  private createInitialNotes(): void {
    const sharedState = this.document.getMap("sharedState");

    this.document.transact(() => {
      // Clear existing notes if any
      sharedState.delete("notes");
      sharedState.delete("nextZ");

      // Create a Y.Array for the notes
      const yNotes = new Y.Array();

      // Create sample notes using Y.Map for each note
      const note1 = new Y.Map();
      note1.set("id", crypto.randomUUID());
      note1.set("x", 100);
      note1.set("y", 100);
      note1.set("width", 200);
      note1.set("height", 150);
      note1.set("color", "#fef08a"); // yellow
      note1.set(
        "text",
        "Welcome to Sticky Notes! 📝\n\nClick and drag me around!",
      );
      note1.set("z", 0);

      const note2 = new Y.Map();
      note2.set("id", crypto.randomUUID());
      note2.set("x", 350);
      note2.set("y", 150);
      note2.set("width", 200);
      note2.set("height", 150);
      note2.set("color", "#fecaca"); // red
      note2.set(
        "text",
        "Double-click to edit text ✏️\n\nChanges sync in real-time!",
      );
      note2.set("z", 1);

      const note3 = new Y.Map();
      note3.set("id", crypto.randomUUID());
      note3.set("x", 600);
      note3.set("y", 100);
      note3.set("width", 200);
      note3.set("height", 150);
      note3.set("color", "#bfdbfe"); // blue
      note3.set(
        "text",
        "Drag the corner to resize 📏\n\nUse the toolbar to add more notes!",
      );
      note3.set("z", 2);

      // Push the Y.Map notes into the Y.Array
      yNotes.push([note1, note2, note3]);

      // Set the Y.Array in the shared state
      sharedState.set("notes", yNotes);
      sharedState.set("nextZ", 3);
    });
  }

  /**
   * Initialize document with sample sticky notes if empty
   * Called once when a client connects to the server
   */
  async onLoad(): Promise<void> {
    const sharedState = this.document.getMap("sharedState");

    // Check if we need to migrate from old plain-array format to Y.Array format
    const existingNotes = sharedState.get("notes");
    const needsMigration = existingNotes && !(existingNotes instanceof Y.Array);

    if (sharedState.size === 0 || needsMigration) {
      this.createInitialNotes();
    }

    // Schedule the first alarm to clean the room in 5 minutes
    const now = Date.now();
    const fiveMinutesMs = 5 * 60 * 1000;
    await this.ctx.storage.setAlarm(now + fiveMinutesMs);
  }

  /**
   * Alarm handler that cleans the room and creates fresh notes every 5 minutes
   * This is called automatically by the Durable Objects runtime
   */
  async alarm(): Promise<void> {
    console.log(
      "[StickyNotesRoom] Alarm triggered - cleaning room and creating fresh notes",
    );

    // Create fresh initial notes
    this.createInitialNotes();

    // Schedule the next alarm for 5 minutes from now
    const now = Date.now();
    const fiveMinutesMs = 5 * 60 * 1000;
    await this.ctx.storage.setAlarm(now + fiveMinutesMs);
  }

  /**
   * Error handler for WebSocket connection errors
   * This is called when a connection encounters an error
   */
  onError(connection: any, error: Error): void {
    console.error("[StickyNotesRoom] Connection error:", {
      connectionId: connection?.id,
      error: error.message,
      retryable: (error as any).retryable,
    });

    // YServer handles the cleanup automatically, we just log the error
    // The connection will be automatically removed from the active connections
  }
}

/**
 * Main Worker handler
 * Routes requests to the appropriate Durable Object based on the room name
 * Uses PartyServer's getServerByName to properly set up headers
 */
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    // Extract room ID from path (e.g., /room-name -> room-name)
    // Default to "default" if no room specified
    const roomId = url.pathname.slice(1) || "default";

    // Use PartyServer's getServerByName to get the server stub
    // This properly sets up the namespace and room headers that PartyServer expects
    const stub = await getServerByName(env.STICKYNOTES_DO as any, roomId);

    // Forward the request to the Durable Object
    return stub.fetch(request);
  },
};
