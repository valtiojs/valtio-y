/**
 * Type definitions for the collaborative drawing application
 */

export type Point = { x: number; y: number };

/**
 * Style properties shared across shapes
 */
export type ShapeStyle = {
  color: string;
  strokeWidth: number;
  fillColor?: string;
};

/**
 * Freehand path drawn with perfect-freehand
 * This shape type showcases valtio-y's batching - as users draw,
 * hundreds of points are pushed rapidly to the points array
 */
export type PathShape = {
  id: string;
  type: "path";
  points: Point[]; // Rapidly growing array - perfect for batching demo!
  style: ShapeStyle;
  timestamp: number;
};

/**
 * Rectangle shape
 */
export type RectShape = {
  id: string;
  type: "rect";
  x: number;
  y: number;
  width: number;
  height: number;
  style: ShapeStyle;
  timestamp: number;
};

/**
 * Circle shape
 */
export type CircleShape = {
  id: string;
  type: "circle";
  x: number;
  y: number;
  radius: number;
  style: ShapeStyle;
  timestamp: number;
};

/**
 * Union type for all supported shapes
 */
export type Shape = PathShape | RectShape | CircleShape;

/**
 * User information and cursor position
 */
export type User = {
  id: string;
  name: string;
  color: string;
  cursor?: Point;
  selection: string[]; // IDs of selected shapes
  viewBox?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
};

/**
 * Performance statistics for showcasing valtio-y's optimizations
 */
export type PerformanceStats = {
  opsPerSecond: number;
  batchSize: number;
  totalOps: number;
  lastUpdate: number;
};

/**
 * The root application state structure.
 * valtio-y will synchronize this entire structure across clients.
 */
export type AppState = {
  shapes: Shape[]; // Main array - reordering showcases array moves without fractional indexes!
  users: Record<string, User>;
  stats?: PerformanceStats;
};

/**
 * Available drawing tools
 */
export type Tool = "select" | "pen" | "rect" | "circle" | "eraser";

/**
 * Sync status for visual feedback
 */
export type SyncStatus = "connected" | "syncing" | "offline";
