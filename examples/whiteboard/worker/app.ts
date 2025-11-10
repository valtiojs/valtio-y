import { routePartykitRequest } from "partyserver";
import { YServer } from "y-partyserver";
import * as Y from "yjs";

const CLEANUP_INTERVAL_MS = import.meta.env.DEV ? 60 * 1000 : 30 * 60 * 1000;

/**
 * YDocServer is a durable object that hosts Yjs documents.
 * YServer handles all routing, WebSocket upgrades, and synchronization automatically.
 */
export class YDocServer extends YServer<Env> {
  // Configure periodic snapshots - saves every 2s or after 10s max
  static callbackOptions = {
    debounceWait: 2000, // Wait 2s after last update
    debounceMaxWait: 10000, // Force save after 10s max
    timeout: 5000,
  };

  /**
   * Create fresh initial shapes in the shared state
   * This is called on initial load and every 30 minutes via alarm
   */
  private createInitialShapes(): void {
    const sharedState = this.document.getMap("drawingState");

    this.document.transact(() => {
      // Clear existing shapes if any
      sharedState.delete("shapes");
      sharedState.delete("users");
      sharedState.delete("stats");

      // Create a Y.Array for shapes
      const yShapes = new Y.Array();

      // Create sample shapes using Y.Map for each shape
      // Shape 1: Welcome text as a rectangle
      const shape1 = new Y.Map();
      shape1.set("id", crypto.randomUUID());
      shape1.set("type", "rect");
      shape1.set("x", 100);
      shape1.set("y", 100);
      shape1.set("width", 400);
      shape1.set("height", 100);
      const style1 = new Y.Map();
      style1.set("color", "#3b82f6");
      style1.set("strokeWidth", 2);
      shape1.set("style", style1);
      shape1.set("timestamp", Date.now());
      yShapes.push([shape1]);

      // Shape 2: Circle
      const shape2 = new Y.Map();
      shape2.set("id", crypto.randomUUID());
      shape2.set("type", "circle");
      shape2.set("x", 700);
      shape2.set("y", 150);
      shape2.set("radius", 50);
      const style2 = new Y.Map();
      style2.set("color", "#ef4444");
      style2.set("strokeWidth", 3);
      shape2.set("style", style2);
      shape2.set("timestamp", Date.now());
      yShapes.push([shape2]);

      // Shape 3: Another rectangle
      const shape3 = new Y.Map();
      shape3.set("id", crypto.randomUUID());
      shape3.set("type", "rect");
      shape3.set("x", 150);
      shape3.set("y", 250);
      shape3.set("width", 300);
      shape3.set("height", 150);
      const style3 = new Y.Map();
      style3.set("color", "#10b981");
      style3.set("strokeWidth", 2);
      style3.set("fillColor", "#d1fae5");
      shape3.set("style", style3);
      shape3.set("timestamp", Date.now());
      yShapes.push([shape3]);

      // Set the Y.Array in the shared state
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

    // Schedule the first alarm to clean the room
    const now = Date.now();
    await this.ctx.storage.setAlarm(now + CLEANUP_INTERVAL_MS);
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
   * Alarm handler that cleans the room and creates fresh shapes
   * This is called automatically by the Durable Objects runtime
   */
  async alarm(): Promise<void> {
    // Create fresh initial shapes
    this.createInitialShapes();

    // Schedule the next alarm
    const now = Date.now();
    await this.ctx.storage.setAlarm(now + CLEANUP_INTERVAL_MS);
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
