/**
 * Standalone worker for Y-PartyServer
 * Combines the YServer definition and fetch handler in one file
 */

import { routePartykitRequest } from "partyserver";
import { YServer } from "y-partyserver";

/**
 * YDocServer is a durable object that hosts Yjs documents.
 * YServer handles all routing, WebSocket upgrades, and synchronization automatically.
 */
export class YDocServer extends YServer {
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
      const Y = await import("yjs");
      Y.applyUpdate(this.document, stored);
      console.log(`[YDocServer] Loaded snapshot: ${stored.byteLength} bytes`);
    }
  }

  // Save document state to Durable Object storage (called automatically)
  async onSave() {
    const Y = await import("yjs");
    const state = Y.encodeStateAsUpdate(this.document);
    await this.ctx.storage.put("document", state);

    // Store metadata for metrics
    await this.ctx.storage.put("snapshot_size", state.byteLength);
    await this.ctx.storage.put("snapshot_timestamp", Date.now());

    console.log(`[YDocServer] Saved snapshot: ${state.byteLength} bytes`);
  }
}

interface YPartyEnv extends Record<string, unknown> {
  YDocServer: DurableObjectNamespace;
}

// Default fetch handler - routes requests to the YDocServer Durable Object
export default {
  async fetch(request: Request, env: YPartyEnv): Promise<Response> {
    // Use PartyServer's routePartykitRequest to automatically route
    // URLs like /parties/ydocserver/room-name to the YDocServer Durable Object
    return (
      (await routePartykitRequest(request, env)) ||
      new Response("Not Found", { status: 404 })
    );
  },
} satisfies ExportedHandler<YPartyEnv>;
