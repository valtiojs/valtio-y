import { routePartykitRequest } from "partyserver";
import { YServer } from "y-partyserver";
import * as Y from "yjs";

// Reset the room every 30 minutes in production, or every minute in dev mode
const CLEANUP_INTERVAL_MS = import.meta.env.DEV ? 60 * 1000 : 30 * 60 * 1000;

// Block letters spelling "valtio-y" vertically in the air (viewed from the side)
// Each letter is 5 blocks tall, readable from player's perspective
const INITIAL_CUBES: [number, number, number][] = [
  // V (x: -20 to -16)
  [-20, 5, -10],
  [-20, 4, -10],
  [-20, 3, -10],
  [-19, 2, -10],
  [-18, 1, -10],
  [-17, 2, -10],
  [-16, 3, -10],
  [-16, 4, -10],
  [-16, 5, -10],

  // A (x: -14 to -12)
  [-14, 1, -10],
  [-14, 2, -10],
  [-14, 3, -10],
  [-14, 4, -10],
  [-14, 5, -10],
  [-13, 3, -10],
  [-13, 5, -10],
  [-12, 1, -10],
  [-12, 2, -10],
  [-12, 3, -10],
  [-12, 4, -10],
  [-12, 5, -10],

  // L (x: -10 to -8)
  [-10, 1, -10],
  [-10, 2, -10],
  [-10, 3, -10],
  [-10, 4, -10],
  [-10, 5, -10],
  [-9, 1, -10],
  [-8, 1, -10],

  // T (x: -6 to -4)
  [-6, 5, -10],
  [-5, 5, -10],
  [-4, 5, -10],
  [-5, 1, -10],
  [-5, 2, -10],
  [-5, 3, -10],
  [-5, 4, -10],

  // I (x: -2 to 0)
  [-2, 1, -10],
  [-1, 1, -10],
  [0, 1, -10],
  [-1, 2, -10],
  [-1, 3, -10],
  [-1, 4, -10],
  [-2, 5, -10],
  [-1, 5, -10],
  [0, 5, -10],

  // O (x: 2 to 4)
  [2, 1, -10],
  [2, 2, -10],
  [2, 3, -10],
  [2, 4, -10],
  [2, 5, -10],
  [3, 1, -10],
  [3, 5, -10],
  [4, 1, -10],
  [4, 2, -10],
  [4, 3, -10],
  [4, 4, -10],
  [4, 5, -10],

  // - (dash, x: 6 to 8)
  [6, 3, -10],
  [7, 3, -10],
  [8, 3, -10],

  // Y (x: 10 to 14)
  [10, 5, -10],
  [11, 4, -10],
  [12, 3, -10],
  [12, 2, -10],
  [12, 1, -10],
  [13, 4, -10],
  [14, 5, -10],
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
