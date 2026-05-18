import { routePartykitRequest } from "partyserver";
import { YServer } from "y-partyserver";
import * as Y from "yjs";

// Cleanup interval: 30 minutes in production
const CLEANUP_INTERVAL_MS = 30 * 60 * 1000;

/**
 * YDocServer is a durable object that hosts Yjs documents.
 * YServer handles all routing, WebSocket upgrades, and synchronization automatically.
 */
export class YDocServer extends YServer<Env> {
  static options = {
    hibernate: true,
  };

  private hasActiveConnections(): boolean {
    return this.ctx
      .getWebSockets()
      .some((socket) => socket.readyState === WebSocket.OPEN);
  }

  private async scheduleNextCleanup(): Promise<void> {
    await this.ctx.storage.setAlarm(Date.now() + CLEANUP_INTERVAL_MS);
  }

  // Configure periodic snapshots - saves every 2s or after 10s max
  static callbackOptions = {
    debounceWait: 2000, // Wait 2s after last update
    debounceMaxWait: 10000, // Force save after 10s max
    timeout: 5000,
  };

  /**
   * Reset the shared state to empty
   * This is called on initial load and every 30 minutes via alarm
   */
  private createInitialShapes(): void {
    const sharedState = this.document.getMap("drawingState");

    this.document.transact(() => {
      // Clear existing shapes if any
      sharedState.delete("shapes");
      sharedState.delete("users");
      sharedState.delete("stats");

      // Create an empty Y.Array for shapes
      const yShapes = new Y.Array();

      // Set the empty Y.Array in the shared state
      sharedState.set("shapes", yShapes);
      sharedState.set("users", new Y.Map());
    });
  }

  // Load document state from Durable Object storage on initialization
  async onLoad() {
    const stored = await this.ctx.storage.get<Uint8Array>("document");
    if (stored) {
      Y.applyUpdate(this.document, stored);
      console.log(`[YDocServer] Loaded snapshot: ${stored.byteLength} bytes`);
    } else {
      // Create initial shapes if this is a new room
      this.createInitialShapes();
    }

    // Schedule the first alarm for a newly opened room
    await this.scheduleNextCleanup();
  }

  // Save document state to Durable Object storage (called automatically)
  async onSave() {
    const state = Y.encodeStateAsUpdate(this.document);
    await this.ctx.storage.put("document", state);

    // Store metadata for metrics
    await this.ctx.storage.put("snapshot_size", state.byteLength);
    await this.ctx.storage.put("snapshot_timestamp", Date.now());

    console.log(`[YDocServer] Saved snapshot: ${state.byteLength} bytes`);
  }

  /**
   * Alarm handler that resets the room to empty state
   * This is called automatically by the Durable Objects runtime
   */
  async onAlarm(): Promise<void> {
    if (!this.hasActiveConnections()) {
      await this.ctx.storage.deleteAlarm();
      return;
    }

    // Reset to empty state
    this.createInitialShapes();

    // Schedule the next alarm
    await this.scheduleNextCleanup();
  }
}

/**
 * Main Worker handler
 * Routes /parties/* requests to the Durable Object for Yjs sync
 * All other requests fall through to static assets served by Vite
 */
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const envForPartyServer = env as unknown as Record<string, unknown>;
    const response = await routePartykitRequest(request, envForPartyServer);
    if (response) {
      return response;
    }

    // All other paths fall through to static assets served by Vite
    return new Response(null, { status: 404 });
  },
} satisfies ExportedHandler<Env>;
