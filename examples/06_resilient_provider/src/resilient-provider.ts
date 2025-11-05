/**
 * Resilient Provider for Y.js
 *
 * This module demonstrates how to wrap a Y.js WebSocket provider
 * with robust error handling and automatic reconnection logic.
 */

import * as Y from "yjs";

export type ConnectionState =
  | "disconnected"
  | "connecting"
  | "connected"
  | "error";

export interface ResilientProviderOptions {
  /** Maximum number of reconnection attempts before giving up */
  maxReconnects?: number;
  /** Initial delay between reconnection attempts in ms */
  reconnectDelay?: number;
  /** Maximum delay between reconnection attempts in ms */
  maxReconnectDelay?: number;
  /** Callback when connection state changes */
  onStateChange?: (state: ConnectionState) => void;
  /** Callback when a connection error occurs */
  onError?: (error: Error) => void;
}

/**
 * A resilient wrapper around Y.js WebSocket providers that handles
 * connection failures gracefully with exponential backoff retry logic.
 *
 * @example
 * ```typescript
 * const doc = new Y.Doc();
 * const provider = new ResilientProvider(
 *   doc,
 *   'ws://localhost:1234',
 *   'my-room',
 *   {
 *     maxReconnects: 5,
 *     onStateChange: (state) => console.log('Connection:', state),
 *     onError: (err) => console.error('Connection error:', err),
 *   }
 * );
 *
 * // Clean up when done
 * provider.destroy();
 * ```
 */
export class ResilientProvider {
  private doc: Y.Doc;
  private url: string;
  private roomName: string;
  private options: Required<ResilientProviderOptions>;

  private reconnectAttempts = 0;
  private reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
  private connectionState: ConnectionState = "disconnected";
  private destroyed = false;

  // Simulated provider for this example
  // In a real app, replace with actual WebSocket provider (e.g., y-websocket)
  private provider: MockWebSocketProvider | null = null;

  constructor(
    doc: Y.Doc,
    url: string,
    roomName: string,
    options: ResilientProviderOptions = {},
  ) {
    this.doc = doc;
    this.url = url;
    this.roomName = roomName;

    // Set default options
    this.options = {
      maxReconnects: options.maxReconnects ?? 5,
      reconnectDelay: options.reconnectDelay ?? 1000,
      maxReconnectDelay: options.maxReconnectDelay ?? 30000,
      onStateChange: options.onStateChange ?? (() => {}),
      onError: options.onError ?? (() => {}),
    };

    // Start initial connection
    this.connect();
  }

  /**
   * Gets the current connection state
   */
  get state(): ConnectionState {
    return this.connectionState;
  }

  /**
   * Attempts to connect to the WebSocket server
   */
  private async connect(): Promise<void> {
    if (this.destroyed) return;

    this.setState("connecting");

    try {
      // Create provider (in a real app, use y-websocket or similar)
      this.provider = new MockWebSocketProvider(
        this.url,
        this.roomName,
        this.doc,
      );

      // Set up event listeners
      this.provider.on("status", this.handleStatus.bind(this));
      this.provider.on("connection-error", this.handleError.bind(this));

      // Attempt connection
      await this.provider.connect();

      // Success! Reset retry counter
      this.reconnectAttempts = 0;
      this.setState("connected");
    } catch (err) {
      this.handleConnectionFailure(err as Error);
    }
  }

  /**
   * Handles connection status changes from the provider
   */
  private handleStatus(event: { status: string }): void {
    if (event.status === "connected") {
      this.setState("connected");
      this.reconnectAttempts = 0;
    } else if (event.status === "disconnected") {
      this.setState("disconnected");
      this.scheduleReconnect();
    }
  }

  /**
   * Handles connection errors from the provider
   */
  private handleError(error: Error): void {
    this.options.onError(error);
    this.handleConnectionFailure(error);
  }

  /**
   * Handles a connection failure and decides whether to retry
   */
  private handleConnectionFailure(error: Error): void {
    if (this.reconnectAttempts < this.options.maxReconnects) {
      this.setState("error");
      this.scheduleReconnect();
    } else {
      this.setState("error");
      this.options.onError(
        new Error(
          `Failed to connect after ${this.options.maxReconnects} attempts`,
        ),
      );
    }
  }

  /**
   * Schedules a reconnection attempt with exponential backoff
   */
  private scheduleReconnect(): void {
    if (this.destroyed || this.reconnectTimeout) return;

    // Calculate delay with exponential backoff
    const delay = Math.min(
      this.options.reconnectDelay *
        Math.pow(2, this.reconnectAttempts),
      this.options.maxReconnectDelay,
    );

    console.log(
      `Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts + 1}/${this.options.maxReconnects})`,
    );

    this.reconnectAttempts++;

    this.reconnectTimeout = setTimeout(() => {
      this.reconnectTimeout = null;
      this.connect();
    }, delay);
  }

  /**
   * Updates the connection state and notifies listeners
   */
  private setState(newState: ConnectionState): void {
    if (this.connectionState !== newState) {
      this.connectionState = newState;
      this.options.onStateChange(newState);
    }
  }

  /**
   * Manually triggers a reconnection attempt
   */
  public reconnect(): void {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    this.reconnectAttempts = 0;
    this.provider?.disconnect();
    this.connect();
  }

  /**
   * Cleans up the provider and stops all reconnection attempts
   */
  public destroy(): void {
    this.destroyed = true;

    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    this.provider?.destroy();
    this.provider = null;

    this.setState("disconnected");
  }
}

/**
 * Mock WebSocket Provider for demonstration purposes.
 * In a real application, replace this with a real provider like 'y-websocket'.
 */
class MockWebSocketProvider {
  private listeners = new Map<string, ((event: unknown) => void)[]>();
  private connected = false;

  constructor(
    private url: string,
    private roomName: string,
    private doc: Y.Doc,
  ) {}

  on(event: string, callback: (event: unknown) => void): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event)!.push(callback);
  }

  async connect(): Promise<void> {
    // Simulate connection attempt
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Simulate random connection failures (for demo purposes)
    if (Math.random() < 0.3) {
      this.emit("connection-error", new Error("Connection failed (simulated)"));
      throw new Error("Connection failed");
    }

    this.connected = true;
    this.emit("status", { status: "connected" });
  }

  disconnect(): void {
    this.connected = false;
    this.emit("status", { status: "disconnected" });
  }

  destroy(): void {
    this.disconnect();
    this.listeners.clear();
  }

  private emit(event: string, data: unknown): void {
    const callbacks = this.listeners.get(event) || [];
    callbacks.forEach((cb) => cb(data));
  }
}
