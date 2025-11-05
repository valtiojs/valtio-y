/**
 * Y-PartyServer Worker for Todos Example
 * Provides real-time Yjs synchronization using Cloudflare Durable Objects
 */

import { routePartykitRequest } from "partyserver";
import { YServer } from "y-partyserver";

/**
 * TodosYServer is a durable object that hosts Yjs documents for the todos app.
 * YServer handles all routing, WebSocket upgrades, and synchronization automatically.
 */
export class TodosYServer extends YServer {
  // Optional: Enable persistence to save document state between sessions
  // async onLoad() {
  //   const stored = await this.ctx.storage.get<Uint8Array>("document");
  //   if (stored) {
  //     const Y = await import("yjs");
  //     Y.applyUpdate(this.document, stored);
  //   }
  // }
  // async onSave() {
  //   const Y = await import("yjs");
  //   const state = Y.encodeStateAsUpdate(this.document);
  //   await this.ctx.storage.put("document", state);
  // }
}

interface Env extends Record<string, unknown> {
  TodosYServer: DurableObjectNamespace;
}

// Default fetch handler - routes requests to the TodosYServer Durable Object
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    // Use PartyServer's routePartykitRequest to automatically route
    // URLs like /parties/todos-y-server/room-name to the TodosYServer Durable Object
    return (
      (await routePartykitRequest(request, env)) ||
      new Response("Not Found", { status: 404 })
    );
  },
} satisfies ExportedHandler<Env>;
