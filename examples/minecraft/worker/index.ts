import { routePartykitRequest } from "partyserver";
import { YServer } from "y-partyserver";
import * as Y from "yjs";

// Reset the room every 30 minutes in production, or every minute in dev mode
const CLEANUP_INTERVAL_MS = import.meta.env.DEV ? 60 * 1000 : 30 * 60 * 1000;

// Block letters spelling "valtio-y" vertically in the air (viewed from the side)
// Each letter is 5 blocks tall, readable from player's perspective
const INITIAL_CUBES: [number, number, number][] = [
  // V (x: -20 to -18)
  [-20, 3, -10],
  [-20, 4, -10],
  [-20, 5, -10],
  [-19, 2, -10],

  // A (x: -16 to -14)
  [-16, 1, -10],
  [-16, 2, -10],
  [-16, 3, -10],
  [-16, 4, -10],
  [-16, 5, -10],
  [-15, 3, -10],
  [-15, 5, -10],
  [-14, 1, -10],
  [-14, 2, -10],
  [-14, 3, -10],
  [-14, 4, -10],
  [-14, 5, -10],

  // L (x: -12 to -10)
  [-12, 1, -10],
  [-12, 2, -10],
  [-12, 3, -10],
  [-12, 4, -10],
  [-12, 5, -10],
  [-11, 1, -10],
  [-10, 1, -10],

  // T (x: -8 to -6)
  [-8, 5, -10],
  [-7, 5, -10],
  [-6, 5, -10],
  [-7, 1, -10],
  [-7, 2, -10],
  [-7, 3, -10],
  [-7, 4, -10],

  // I (x: -4 to -2)
  [-4, 1, -10],
  [-3, 1, -10],
  [-2, 1, -10],
  [-3, 2, -10],
  [-3, 3, -10],
  [-3, 4, -10],
  [-4, 5, -10],
  [-3, 5, -10],
  [-2, 5, -10],

  // O (x: 0 to 2)
  [0, 2, -10],
  [0, 3, -10],
  [0, 4, -10],
  [0, 5, -10],
  [1, 5, -10],
  [2, 2, -10],
  [2, 3, -10],
  [2, 4, -10],
  [2, 5, -10],

  // - (dash, x: 4 to 6)
  [4, 3, -10],
  [5, 3, -10],
  [6, 3, -10],

  // Y (x: 8 to 12)
  [8, 5, -10],
  [9, 4, -10],
  [10, 3, -10],
  [10, 2, -10],
  [10, 1, -10],
  [11, 4, -10],
  [12, 5, -10],
];

export class YDocServer extends YServer<Env> {
  static options = {
    hibernate: true,
  };

  /**
   * Initialize document with initial cubes if empty
   * Called once when a client connects to the server
   */
  async onLoad(): Promise<void> {
    const sharedState = this.document.getMap("map");
    if (sharedState.size === 0) {
      this.createInitialCubes(sharedState);
    }

    // Schedule the first alarm to clean the room
    const now = Date.now();
    await this.ctx.storage.setAlarm(now + CLEANUP_INTERVAL_MS);
  }

  onError(error: unknown): void {
    console.error("[YDocServer] connection error", error);
  }

  /**
   * Alarm handler that resets the room and creates fresh initial cubes
   * This is called automatically by the Durable Objects runtime
   */
  async alarm(): Promise<void> {
    const sharedState = this.document.getMap("map");
    // Create fresh initial cubes
    this.createInitialCubes(sharedState);

    // Schedule the next alarm
    const now = Date.now();
    await this.ctx.storage.setAlarm(now + CLEANUP_INTERVAL_MS);
  }

  /**
   * Create fresh initial cubes in the shared state
   * This is called on initial load and every 30 minutes via alarm
   */
  private createInitialCubes(sharedState: Y.Map<unknown>): void {
    this.document.transact(() => {
      // Initialize with cubes spelling "valtio-y"
      const cubes = new Y.Array();

      INITIAL_CUBES.forEach(([x, y, z]) => {
        const cubeArray = new Y.Array();
        cubeArray.push([x, y, z]);
        cubes.push([cubeArray]);
      });

      sharedState.set("cubes", cubes);
    });
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const response = await routePartykitRequest(
      request,
      env as unknown as Record<string, unknown>,
    );
    if (response) {
      return response;
    }

    return new Response("Not Found", { status: 404 });
  },
} satisfies ExportedHandler<Env>;
