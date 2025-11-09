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
  notes: StickyNote[];
  nextZ: number;
}

export type SyncStatus =
  | "connecting"
  | "connected"
  | "syncing"
  | "disconnected";

export interface UserPresence {
  cursor?: { x: number; y: number };
  selectedNoteId?: string;
  editingNoteId?: string;
  color: string;
  name: string;
}
