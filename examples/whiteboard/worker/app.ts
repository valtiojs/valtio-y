import { routePartykitRequest } from "partyserver";
import { YServer } from "y-partyserver";
import * as Y from "yjs";

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

  // Load document state from Durable Object storage on initialization
  async onLoad() {
    const stored = await this.ctx.storage.get<Uint8Array>("document");
    if (stored) {
      Y.applyUpdate(this.document, stored);
      console.log(`[YDocServer] Loaded snapshot: ${stored.byteLength} bytes`);
    }
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
