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
  // Optional: Configure callback options for persistence
  // static callbackOptions = {
  //   debounceWait: 2000,
  //   debounceMaxWait: 10000,
  //   timeout: 5000
  // };

  // Optional: Load document state from storage
  // async onLoad() {
  //   const stored = await this.ctx.storage.get<Uint8Array>("document");
  //   if (stored) {
  //     const Y = await import("yjs");
  //     Y.applyUpdate(this.document, stored);
  //   }
  // }

  // Optional: Save document state to storage
  // async onSave() {
  //   const Y = await import("yjs");
  //   const state = Y.encodeStateAsUpdate(this.document);
  //   await this.ctx.storage.put("document", state);
  // }
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
