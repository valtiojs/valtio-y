/**
 * Cloudflare Durable Objects server for valtio-y Sticky Notes
 *
 * This server provides Yjs document synchronization using Cloudflare Durable Objects.
 * Each room is a separate Durable Object instance that manages a Y.Doc and WebSocket connections.
 */

import * as Y from "yjs";
import * as encoding from "lib0/encoding";
import * as decoding from "lib0/decoding";
import * as syncProtocol from "y-protocols/sync";
import * as awarenessProtocol from "y-protocols/awareness";

const MESSAGE_SYNC = 0;
const MESSAGE_AWARENESS = 1;

interface Env {
  STICKYNOTES_DO: DurableObjectNamespace;
}

/**
 * Durable Object that handles a single sticky notes room
 */
export class StickyNotesRoom implements DurableObject {
  private doc: Y.Doc;
  private awareness: awarenessProtocol.Awareness;
  private connections: Set<WebSocket>;

  constructor(private state: DurableObjectState, private env: Env) {
    this.doc = new Y.Doc();
    this.awareness = new awarenessProtocol.Awareness(this.doc);
    this.connections = new Set();

    // Initialize with sample data if the document is empty
    this.initializeDocument();

    // Set up awareness cleanup
    this.awareness.on("update", this.broadcastAwareness.bind(this));

    // Set up document update broadcasting
    this.doc.on("update", (update: Uint8Array, origin: unknown) => {
      // Don't broadcast updates that came from a client
      if (origin === "network") return;

      const encoder = encoding.createEncoder();
      encoding.writeVarUint(encoder, MESSAGE_SYNC);
      syncProtocol.writeUpdate(encoder, update);
      const message = encoding.toUint8Array(encoder);

      this.broadcast(message);
    });
  }

  /**
   * Initialize document with sample sticky notes if empty
   */
  private initializeDocument() {
    const sharedState = this.doc.getMap("sharedState");

    if (sharedState.size === 0) {
      // Create sample notes
      const notes = [
        {
          id: crypto.randomUUID(),
          x: 100,
          y: 100,
          width: 200,
          height: 150,
          color: "#fef08a", // yellow
          text: "Welcome to Sticky Notes! 📝\n\nClick and drag me around!",
          z: 0,
        },
        {
          id: crypto.randomUUID(),
          x: 350,
          y: 150,
          width: 200,
          height: 150,
          color: "#fecaca", // red
          text: "Double-click to edit text ✏️\n\nChanges sync in real-time!",
          z: 1,
        },
        {
          id: crypto.randomUUID(),
          x: 600,
          y: 100,
          width: 200,
          height: 150,
          color: "#bfdbfe", // blue
          text: "Drag the corner to resize 📏\n\nUse the toolbar to add more notes!",
          z: 2,
        },
      ];

      sharedState.set("notes", notes);
      sharedState.set("nextZ", 3);
    }
  }

  /**
   * Handle incoming HTTP requests
   */
  async fetch(request: Request): Promise<Response> {
    const upgradeHeader = request.headers.get("Upgrade");

    if (upgradeHeader !== "websocket") {
      return new Response("Expected WebSocket", { status: 426 });
    }

    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);

    this.handleWebSocket(server);

    return new Response(null, {
      status: 101,
      webSocket: client,
    });
  }

  /**
   * Handle WebSocket connection
   */
  private handleWebSocket(ws: WebSocket) {
    ws.accept();
    this.connections.add(ws);

    // Send initial sync
    const encoder = encoding.createEncoder();
    encoding.writeVarUint(encoder, MESSAGE_SYNC);
    syncProtocol.writeSyncStep1(encoder, this.doc);
    ws.send(encoding.toUint8Array(encoder));

    // Send initial awareness state
    const awarenessEncoder = encoding.createEncoder();
    encoding.writeVarUint(awarenessEncoder, MESSAGE_AWARENESS);
    encoding.writeVarUint8Array(
      awarenessEncoder,
      awarenessProtocol.encodeAwarenessUpdate(
        this.awareness,
        Array.from(this.awareness.getStates().keys())
      )
    );
    ws.send(encoding.toUint8Array(awarenessEncoder));

    ws.addEventListener("message", (event) => {
      try {
        const data = new Uint8Array(event.data as ArrayBuffer);
        const decoder = decoding.createDecoder(data);
        const messageType = decoding.readVarUint(decoder);

        if (messageType === MESSAGE_SYNC) {
          const encoder = encoding.createEncoder();
          encoding.writeVarUint(encoder, MESSAGE_SYNC);

          syncProtocol.readSyncMessage(decoder, encoder, this.doc, "network");

          const response = encoding.toUint8Array(encoder);
          if (response.length > 1) {
            ws.send(response);
          }
        } else if (messageType === MESSAGE_AWARENESS) {
          awarenessProtocol.applyAwarenessUpdate(
            this.awareness,
            decoding.readVarUint8Array(decoder),
            ws
          );
        }
      } catch (error) {
        console.error("Error handling message:", error);
      }
    });

    ws.addEventListener("close", () => {
      this.connections.delete(ws);

      // Clean up awareness state
      const awarenessStates = Array.from(this.awareness.getStates().keys());
      awarenessProtocol.removeAwarenessStates(
        this.awareness,
        awarenessStates.filter((id) => {
          return this.awareness.meta.get(id)?.ws === ws;
        }),
        ws
      );
    });

    ws.addEventListener("error", () => {
      this.connections.delete(ws);
    });
  }

  /**
   * Broadcast a message to all connected clients except the sender
   */
  private broadcast(message: Uint8Array, except?: WebSocket) {
    this.connections.forEach((conn) => {
      if (conn !== except && conn.readyState === 1) {
        conn.send(message);
      }
    });
  }

  /**
   * Broadcast awareness updates
   */
  private broadcastAwareness({ added, updated, removed }: {
    added: number[];
    updated: number[];
    removed: number[];
  }) {
    const changedClients = added.concat(updated).concat(removed);
    const encoder = encoding.createEncoder();
    encoding.writeVarUint(encoder, MESSAGE_AWARENESS);
    encoding.writeVarUint8Array(
      encoder,
      awarenessProtocol.encodeAwarenessUpdate(this.awareness, changedClients)
    );
    const message = encoding.toUint8Array(encoder);

    this.broadcast(message);
  }
}

/**
 * Main Worker handler
 */
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    // Extract room ID from path
    const roomId = url.pathname.slice(1) || "default";

    // Get the Durable Object stub
    const id = env.STICKYNOTES_DO.idFromName(roomId);
    const stub = env.STICKYNOTES_DO.get(id);

    // Forward the request to the Durable Object
    return stub.fetch(request);
  },
};
