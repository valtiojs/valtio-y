import type * as Party from "partykit/server";
import * as Y from "yjs";
import { initializeGameDoc } from "./schema.js";
import { processOp, type ClientOp } from "./ops.js";

type ConnectionWithMetadata = Party.Connection & {
  playerId?: string;
};

export default class CardGameServer implements Party.Server {
  doc: Y.Doc;
  connections: Map<string, ConnectionWithMetadata>;

  constructor(public room: Party.Room) {
    this.doc = new Y.Doc();
    this.connections = new Map();

    // Initialize the document schema
    initializeGameDoc(this.doc);

    // Listen for document updates
    this.doc.on("update", (update: Uint8Array) => {
      // Broadcast updates to all connected clients
      this.room.broadcast(
        JSON.stringify({
          type: "sync",
          update: Array.from(update),
        }),
        []
      );
    });
  }

  async onConnect(conn: Party.Connection, ctx: Party.ConnectionContext) {
    console.log(
      `Client ${conn.id} connected to room ${this.room.id}`
    );

    const connectionWithMetadata = conn as ConnectionWithMetadata;
    this.connections.set(conn.id, connectionWithMetadata);

    // Send current state to the new connection
    const stateVector = Y.encodeStateVector(this.doc);
    const update = Y.encodeStateAsUpdate(this.doc, stateVector);

    conn.send(
      JSON.stringify({
        type: "sync",
        update: Array.from(update),
      })
    );
  }

  async onMessage(message: string, sender: Party.Connection) {
    try {
      const data = JSON.parse(message);

      if (data.type === "sync") {
        // Handle Yjs sync message
        const update = new Uint8Array(data.update);
        Y.applyUpdate(this.doc, update);
      } else if (data.type === "op") {
        // Handle game operation
        const op = data.op as ClientOp;
        const playerId = data.playerId as string;

        if (!playerId) {
          sender.send(
            JSON.stringify({
              type: "error",
              error: "No player ID provided",
            })
          );
          return;
        }

        // Store player ID on connection
        const connectionWithMetadata = sender as ConnectionWithMetadata;
        connectionWithMetadata.playerId = playerId;

        // Process the operation in a transaction
        this.doc.transact(() => {
          processOp(this.doc, playerId, op);
        });

        // Send success response
        sender.send(
          JSON.stringify({
            type: "op-ack",
            op: op.t,
          })
        );
      } else if (data.type === "awareness") {
        // Broadcast awareness updates to all other clients
        this.room.broadcast(
          JSON.stringify({
            type: "awareness",
            ...data,
          }),
          [sender.id]
        );
      }
    } catch (error) {
      console.error("Error handling message:", error);
      sender.send(
        JSON.stringify({
          type: "error",
          error: error instanceof Error ? error.message : String(error),
        })
      );
    }
  }

  async onClose(conn: Party.Connection) {
    console.log(`Client ${conn.id} disconnected from room ${this.room.id}`);
    this.connections.delete(conn.id);

    // Note: We don't remove players from the game automatically
    // They can reconnect and resume playing
  }

  async onError(conn: Party.Connection, error: Error) {
    console.error(`Error on connection ${conn.id}:`, error);
  }
}

CardGameServer satisfies Party.Worker;
