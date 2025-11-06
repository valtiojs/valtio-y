/**
 * Cloudflare Durable Object for Tic-Tac-Toe multiplayer game
 * Uses y-partyserver to handle Yjs sync over WebSocket
 */

import { YPartyKitDurable } from "y-partyserver/durableObjects";
import type { DurableObjectState } from "@cloudflare/workers-types";

export class TicTacToeRoom extends YPartyKitDurable {
  constructor(state: DurableObjectState, env: Record<string, unknown>) {
    super(state, env);
  }

  /**
   * Initialize the Y.Doc with default game state if empty
   */
  async onConnect() {
    // This is called when the first client connects
    // The Y.Doc is automatically managed by YPartyKitDurable
    await super.onConnect?.();

    // Initialize default game state if the document is empty
    const sharedState = this.doc.getMap("sharedState");
    if (!sharedState.has("board")) {
      this.doc.transact(() => {
        sharedState.set("board", [null, null, null, null, null, null, null, null, null]);
        sharedState.set("currentPlayer", "X");
        sharedState.set("winner", null);
        sharedState.set("winningLine", null);
        sharedState.set("scores", { X: 0, O: 0, draws: 0 });
        sharedState.set("players", { X: null, O: null });
        sharedState.set("spectators", []);
      });
    }
  }
}

/**
 * Worker fetch handler - routes requests to Durable Objects
 */
export default {
  async fetch(request: Request, env: { TICTACTOE_ROOM: DurableObjectNamespace }): Promise<Response> {
    const url = new URL(request.url);

    // Health check endpoint
    if (url.pathname === "/health") {
      return new Response("OK", { status: 200 });
    }

    // Route WebSocket connections to the Durable Object
    if (url.pathname.startsWith("/parties/tictactoe/")) {
      const roomId = url.pathname.split("/")[3] || "default";
      const id = env.TICTACTOE_ROOM.idFromName(roomId);
      const stub = env.TICTACTOE_ROOM.get(id);
      return stub.fetch(request);
    }

    return new Response("Not Found", { status: 404 });
  },
};
