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
    this.awareness.destroy();
    this.doc.destroy();
  }
}

interface CachedRoom {
  state: RoomState;
  refCount: number;
  lastAccessed: number;
}

const roomCache = new Map<string, CachedRoom>();

function ensureRoom(roomId: string): CachedRoom {
  let entry = roomCache.get(roomId);
  if (!entry) {
    entry = {
      state: new RoomState(),
      refCount: 0,
      lastAccessed: Date.now(),
    };
    roomCache.set(roomId, entry);
  } else {
    entry.lastAccessed = Date.now();
  }
  return entry;
}

export function acquireRoom(roomId: string): RoomState {
  const entry = ensureRoom(roomId);
  entry.refCount += 1;
  entry.lastAccessed = Date.now();
  return entry.state;
}

export function releaseRoom(roomId: string): void {
  const entry = roomCache.get(roomId);
  if (!entry) {
    return;
  }

  entry.refCount = Math.max(0, entry.refCount - 1);
  entry.lastAccessed = Date.now();

  if (entry.refCount === 0) {
    entry.state.dispose();
    roomCache.delete(roomId);
  }
}
