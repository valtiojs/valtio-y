import * as Y from "yjs";
import YProvider from "y-partyserver/provider";
import { createYjsProxy } from "valtio-y";
import type { AppState, SyncStatus } from "./types";

const DEFAULT_ROOM = "shared-todos";
const DEFAULT_HOST = "localhost:8788";
const PARTY_NAME = "y-doc-server";

const resolveRoom = () => {
  const envRoom = import.meta.env.VITE_PARTY_ROOM;
  if (envRoom && envRoom.length > 0) return envRoom;
  if (typeof window === "undefined") return DEFAULT_ROOM;
  const roomName = window.location.hash.replace("#", "").trim();
  return roomName.length > 0 ? roomName : DEFAULT_ROOM;
};

const resolveHost = () => {
  const envHost = import.meta.env.VITE_PARTY_HOST;
  if (envHost && envHost.length > 0) return envHost;
  if (typeof window === "undefined") {
    return DEFAULT_HOST;
  }
  const { host } = window.location;
  return host.length > 0 ? host : DEFAULT_HOST;
};

export const doc = new Y.Doc();

export const provider = new YProvider(resolveHost(), resolveRoom(), doc, {
  connect: true,
  party: PARTY_NAME,
});

export const { proxy } = createYjsProxy<AppState>(doc, {
  getRoot: (document: Y.Doc) => document.getMap("sharedState"),
});

let syncStatus: SyncStatus = "offline";

const syncListeners = new Set<() => void>();

const notifySyncListeners = () => {
  syncListeners.forEach((listener) => listener());
};

provider.on("status", ({ status }: { status: string }) => {
  syncStatus = status === "connected" ? "connected" : "offline";
  notifySyncListeners();
});

provider.on("sync", (synced: boolean) => {
  syncStatus = synced ? "connected" : syncStatus;
  notifySyncListeners();
});

export function subscribeSyncStatus(listener: () => void): () => void {
  syncListeners.add(listener);
  listener();
  return () => {
    syncListeners.delete(listener);
  };
}

export function getSyncStatus(): SyncStatus {
  return syncStatus;
}

export function connect(): void {
  syncStatus = "syncing";
  notifySyncListeners();
  void provider.connect();
}

export function disconnect(): void {
  void provider.disconnect();
  syncStatus = "offline";
  notifySyncListeners();
}

export function isConnected(): boolean {
  return provider.wsconnected;
}
