/**
 * Shared PartyKit Server for valtio-y Examples
 *
 * This server provides Yjs document synchronization for all examples.
 * It uses y-partyserver to handle CRDT operations and real-time sync.
 */

import { YServer } from "y-partyserver";

/**
 * Simple Yjs server with no persistence
 * Each room maintains its own Y.Doc that syncs between all connected clients
 */
export class ValtioYExampleServer extends YServer {
  // No persistence needed for examples - documents are ephemeral
  // For production, you would implement onLoad/onSave hooks
}

// Export as default for PartyKit
export default ValtioYExampleServer;
