/**
 * Type definitions for the sticky notes application
 */

export interface StickyNote {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
  text: string;
  z: number;
}

export interface AppState {
  notes: Record<string, StickyNote>;
  nextZ: number;
}

export type SyncStatus =
  | "connecting"
  | "connected"
  | "syncing"
  | "disconnected";

export interface UserPresence {
  cursor?: { x: number; y: number };
  color: string;
  name: string;
}

export const STICKY_NOTE_COLORS = [
  { name: "Yellow", value: "#fef3c7" },
  { name: "Peach", value: "#fed7aa" },
  { name: "Blue", value: "#dbeafe" },
  { name: "Green", value: "#d1fae5" },
  { name: "Purple", value: "#e9d5ff" },
  { name: "Pink", value: "#fce7f3" },
] as const;
