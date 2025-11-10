/**
 * Cloudflare Durable Objects server for valtio-y Sticky Notes
 *
 * This server provides Yjs document synchronization using y-partyserver.
 * Each room is a separate Durable Object instance that manages a Y.Doc and WebSocket connections.
 */

import { YServer } from "y-partyserver";
import { routePartykitRequest } from "partyserver";
import * as Y from "yjs";

const CLEANUP_INTERVAL_MS = import.meta.env.DEV ? 60 * 1000 : 30 * 60 * 1000;

/**
 * Durable Object that handles a single sticky notes room
 */
export class StickyNotesRoom extends YServer<Env> {
  /**
   * Create fresh initial notes in the shared state
   * This is called on initial load and every 30 minutes via alarm
   */
  private createInitialNotes(): void {
    const sharedState = this.document.getMap("root");

    this.document.transact(() => {
      // Clear existing notes if any
      sharedState.delete("notes");
      sharedState.delete("nextZ");

      // Create a Y.Map for the notes collection (Map<noteId, noteData>)
      const yNotes = new Y.Map();

      // Create sample notes using Y.Map for each note
      const id1 = crypto.randomUUID();
      const note1 = new Y.Map();
      note1.set("id", id1);
      note1.set("x", 80);
      note1.set("y", 120);
      note1.set("width", 280);
      note1.set("height", 200);
      note1.set("color", "#fef08a"); // yellow
      note1.set(
        "text",
        "Welcome to valtio-y! ⚡\n\nReal-time collaborative sticky notes powered by Valtio + Yjs CRDTs.\n\nOpen this on 2 devices to see instant sync!",
      );
      note1.set("z", 0);
      yNotes.set(id1, note1);

      const id2 = crypto.randomUUID();
      const note2 = new Y.Map();
      note2.set("id", id2);
      note2.set("x", 390);
      note2.set("y", 120);
      note2.set("width", 280);
      note2.set("height", 200);
      note2.set("color", "#fecaca"); // red
      note2.set(
        "text",
        "Try it out! 🎨\n\n• Double-click to edit\n• Drag to move\n• Drag corner to resize\n• Use toolbar to add notes",
      );
      note2.set("z", 1);
      yNotes.set(id2, note2);

      const id3 = crypto.randomUUID();
      const note3 = new Y.Map();
      note3.set("id", id3);
      note3.set("x", 700);
      note3.set("y", 120);
      note3.set("width", 280);
      note3.set("height", 200);
      note3.set("color", "#bfdbfe"); // blue
      note3.set(
        "text",
        "Want privacy? 🔒\n\nAdd #room-name to the URL!\n\nExample:\nlocalhost:5173#my-private-room\n\nEach room is separate.",
      );
      note3.set("z", 2);
      yNotes.set(id3, note3);

      const id4 = crypto.randomUUID();
      const note4 = new Y.Map();
      note4.set("id", id4);
      note4.set("x", 80);
      note4.set("y", 350);
      note4.set("width", 280);
      note4.set("height", 200);
      note4.set("color", "#d9f99d"); // lime
      note4.set(
        "text",
        "How it works 🛠️\n\nValtio = Reactive state\nYjs = CRDT sync\nvaltio-y = Magic bridge\n\nConflict-free collaboration!",
      );
      note4.set("z", 3);
      yNotes.set(id4, note4);

      const id5 = crypto.randomUUID();
      const note5 = new Y.Map();
      note5.set("id", id5);
      note5.set("x", 390);
      note5.set("y", 350);
      note5.set("width", 280);
      note5.set("height", 200);
      note5.set("color", "#e9d5ff"); // purple
      note5.set(
        "text",
        "Demo mode ⏰\n\nThis room resets every minute to keep it clean.\n\nFeel free to experiment!",
      );
      note5.set("z", 4);
      yNotes.set(id5, note5);

      const id6 = crypto.randomUUID();
      const note6 = new Y.Map();
      note6.set("id", id6);
      note6.set("x", 700);
      note6.set("y", 350);
      note6.set("width", 280);
      note6.set("height", 200);
      note6.set("color", "#fecdd3"); // pink
      note6.set(
        "text",
        "Everyone sees this! 👀\n\nChanges you make here are visible to all users on this page.\n\nBe nice! ✨",
      );
      note6.set("z", 5);
      yNotes.set(id6, note6);

      // Set the Y.Map in the shared state
      sharedState.set("notes", yNotes);
      sharedState.set("nextZ", 6);
    });
  }

  /**
   * Initialize document with sample sticky notes if empty
   * Called once when a client connects to the server
   */
  async onLoad(): Promise<void> {
    const sharedState = this.document.getMap("root");

    if (sharedState.size === 0) {
      this.createInitialNotes();
    }

    // Schedule the first alarm to clean the room
    const now = Date.now();
    await this.ctx.storage.setAlarm(now + CLEANUP_INTERVAL_MS);
  }

  /**
   * Alarm handler that cleans the room and creates fresh notes
   * This is called automatically by the Durable Objects runtime
   */
  async alarm(): Promise<void> {
    // Create fresh initial notes
    this.createInitialNotes();

    // Schedule the next alarm
    const now = Date.now();
    await this.ctx.storage.setAlarm(now + CLEANUP_INTERVAL_MS);
  }
}

/**
 * Main Worker handler
 * Routes /collab requests to the Durable Object for Yjs sync
 * All other requests fall through to static assets (React app)
 */
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const envForPartyServer = env as unknown as Record<string, unknown>;
    const response = await routePartykitRequest(request, envForPartyServer);
    if (response) {
      return response;
    }

    // All other paths fall through to static assets served by Vite.
    return new Response(null, { status: 404 });
  },
} satisfies ExportedHandler<Env>;
