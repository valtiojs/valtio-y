/**
 * Type definitions for the Pixel Art Editor
 */

export type Tool = "pencil" | "eraser" | "picker";

export type SyncStatus = "connected" | "syncing" | "disconnected";

export interface PixelGrid {
  // 2D array of colors (hex strings)
  // null represents an empty/transparent pixel
  pixels: (string | null)[][];
}

export interface AppState {
  // Pixel grid (32x32 by default)
  grid: PixelGrid;
}

export interface UIState {
  selectedColor: string;
  selectedTool: Tool;
  isDrawing: boolean;
}
