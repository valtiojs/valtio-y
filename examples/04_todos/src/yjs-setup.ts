import * as Y from "yjs";
import { createYjsProxy } from "valtio-y";
import type { AppState } from "./types";

export class RoomState {
  readonly doc: Y.Doc;
  readonly proxy: AppState;
  private readonly disposeBridge: () => void;
  readonly undo: () => void;
  readonly redo: () => void;
  readonly undoState: { canUndo: boolean; canRedo: boolean };

  constructor() {
    this.doc = new Y.Doc();

    const proxyWithUndo = createYjsProxy<AppState>(this.doc, {
      getRoot: (document: Y.Doc) => document.getMap("root"),
      undoManager: {
        captureTimeout: 100, // Group operations within 100ms (prevents overly aggressive undo)
      },
    });

    this.proxy = proxyWithUndo.proxy;
    this.disposeBridge = proxyWithUndo.dispose;
    this.undo = proxyWithUndo.undo;
    this.redo = proxyWithUndo.redo;
    this.undoState = proxyWithUndo.undoState;
  }

  dispose(): void {
    this.disposeBridge();
    // Note: We don't destroy the doc here because the provider
    // might still be cleaning up. It'll be garbage collected naturally.
  }
}

export function createRoomState(): RoomState {
  return new RoomState();
}
