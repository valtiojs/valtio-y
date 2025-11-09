import * as Y from "yjs";
import * as awarenessProtocol from "y-protocols/awareness";
import { createYjsProxy } from "valtio-y";
import type { AppState, UserPresence } from "./types";

const colors = [
  "#ef4444", // red
  "#f59e0b", // orange
  "#10b981", // green
  "#3b82f6", // blue
  "#8b5cf6", // purple
  "#ec4899", // pink
];

export class RoomState {
  readonly doc: Y.Doc;
  readonly awareness: awarenessProtocol.Awareness;
  readonly proxy: AppState;
  readonly setLocalPresence: (presence: Partial<UserPresence>) => void;
  private readonly disposeBridge: () => void;

  constructor() {
    this.doc = new Y.Doc();
    this.awareness = new awarenessProtocol.Awareness(this.doc);

    const { proxy, dispose } = createYjsProxy<AppState>(this.doc, {
      getRoot: (document: Y.Doc) => document.getMap("root"),
    });

    this.proxy = proxy;
    this.disposeBridge = dispose;

    const clientColor = colors[Math.floor(Math.random() * colors.length)];
    this.setLocalPresence = (presence: Partial<UserPresence>) => {
      this.awareness.setLocalStateField("user", {
        color: clientColor,
        name: `User ${this.doc.clientID}`,
        ...presence,
      });
    };
  }

  dispose(): void {
    this.disposeBridge();
    // Note: We don't destroy awareness/doc here because the provider
    // might still be cleaning up. They'll be garbage collected naturally.
  }
}

export function createRoomState(): RoomState {
  return new RoomState();
}
