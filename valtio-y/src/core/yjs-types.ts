import * as Y from "yjs";

// Shared Yjs container types that are deeply proxied by Valtio
export type YSharedContainer = Y.Map<unknown> | Y.Array<unknown>;

// Event-related types used with observeDeep
export type YArrayDelta = Array<{
  retain?: number;
  delete?: number;
  insert?: unknown[];
}>;

export interface YMapEvent extends Y.YEvent<Y.Map<unknown>> {
  keysChanged: Set<string>;
}

export interface YArrayEvent extends Y.YEvent<Y.Array<unknown>> {
  changes: {
    added: Set<Y.Item>;
    deleted: Set<Y.Item>;
    delta: YArrayDelta;
    keys: Map<
      string,
      { action: "add" | "delete" | "update"; oldValue: unknown }
    >;
  };
}
