/**
 * Toolbar Component - Minimal horizontal floating toolbar
 *
 * Provides:
 * - Tool selection (pen, rect, circle, select, eraser)
 * - Color picker
 * - Stroke width control
 * - Undo/Redo buttons
 * - Connection status indicator
 */

import {
  Pencil,
  Square,
  Circle,
  MousePointer,
  Eraser,
  Undo2,
  Redo2,
  Wifi,
  WifiOff,
} from "lucide-react";
import type { Tool, SyncStatus } from "../types";

interface ToolbarProps {
  tool: Tool;
  onToolChange: (tool: Tool) => void;
  color: string;
  onColorChange: (color: string) => void;
  strokeWidth: number;
  onStrokeWidthChange: (width: number) => void;
  fillEnabled: boolean;
  onFillToggle: () => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  syncStatus: SyncStatus;
}

const COLORS = [
  "#fef3c7", // Yellow (like sticky notes)
  "#fed7aa", // Orange
  "#fecaca", // Red
  "#e9d5ff", // Purple
  "#ddd6fe", // Lavender
  "#c7d2fe", // Indigo
];

const STROKE_WIDTHS = [2, 4, 8, 16];

export function Toolbar({
  tool,
  onToolChange,
  color,
  onColorChange,
  strokeWidth,
  onStrokeWidthChange,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  syncStatus,
}: ToolbarProps) {
  return (
    <div className="bg-white/90 backdrop-blur-sm rounded-2xl px-4 py-3 shadow-xl border border-gray-200 flex items-center gap-4">
      {/* Connection Status */}
      <div className="pr-3 border-r border-gray-200">
        {syncStatus === "connected" ? (
          <div className="text-green-600" title="Connected">
            <Wifi size={18} />
          </div>
        ) : syncStatus === "syncing" ? (
          <div className="text-yellow-600 animate-pulse" title="Syncing...">
            <Wifi size={18} />
          </div>
        ) : syncStatus === "connecting" ? (
          <div className="text-blue-600 animate-pulse" title="Connecting...">
            <Wifi size={18} />
          </div>
        ) : (
          <div className="text-red-600" title="Offline">
            <WifiOff size={18} />
          </div>
        )}
      </div>

      {/* Undo/Redo */}
      <div className="flex items-center gap-1 pr-3 border-r border-gray-200">
        <button
          onClick={onUndo}
          disabled={!canUndo}
          className={`p-2 rounded-lg transition-all ${
            canUndo
              ? "text-gray-700 hover:bg-gray-100"
              : "text-gray-400 cursor-not-allowed"
          }`}
          title="Undo (⌘Z)"
        >
          <Undo2 size={18} />
        </button>
        <button
          onClick={onRedo}
          disabled={!canRedo}
          className={`p-2 rounded-lg transition-all ${
            canRedo
              ? "text-gray-700 hover:bg-gray-100"
              : "text-gray-400 cursor-not-allowed"
          }`}
          title="Redo (⌘Y)"
        >
          <Redo2 size={18} />
        </button>
      </div>

      {/* Tool Selection */}
      <div className="flex items-center gap-1 pr-3 border-r border-gray-200">
        <ToolButton
          icon={MousePointer}
          active={tool === "select"}
          onClick={() => onToolChange("select")}
          title="Select (V)"
        />
        <ToolButton
          icon={Pencil}
          active={tool === "pen"}
          onClick={() => onToolChange("pen")}
          title="Pen (P)"
        />
        <ToolButton
          icon={Square}
          active={tool === "rect"}
          onClick={() => onToolChange("rect")}
          title="Rectangle (R)"
        />
        <ToolButton
          icon={Circle}
          active={tool === "circle"}
          onClick={() => onToolChange("circle")}
          title="Circle (C)"
        />
        <ToolButton
          icon={Eraser}
          active={tool === "eraser"}
          onClick={() => onToolChange("eraser")}
          title="Eraser (E)"
        />
      </div>

      {/* Color Picker */}
      <div className="flex items-center gap-1.5 pr-3 border-r border-gray-200">
        {COLORS.map((c) => (
          <button
            key={c}
            className={`w-7 h-7 rounded-lg border-2 transition-all ${
              color === c
                ? "border-gray-800 scale-110"
                : "border-gray-300 hover:scale-105 hover:border-gray-400"
            }`}
            style={{ backgroundColor: c }}
            onClick={() => onColorChange(c)}
            title={c}
          />
        ))}
      </div>

      {/* Stroke Width */}
      <div className="flex items-center gap-1 pr-3 border-r border-gray-200">
        {STROKE_WIDTHS.map((width) => (
          <button
            key={width}
            className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
              strokeWidth === width
                ? "bg-gray-800 text-white"
                : "text-gray-700 hover:bg-gray-100"
            }`}
            onClick={() => onStrokeWidthChange(width)}
            title={`${width}px stroke`}
          >
            {width}
          </button>
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// TOOL BUTTON COMPONENT
// ============================================================================

interface ToolButtonProps {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  active: boolean;
  onClick: () => void;
  title: string;
}

function ToolButton({ icon: Icon, active, onClick, title }: ToolButtonProps) {
  return (
    <button
      onClick={onClick}
      className={`p-2.5 rounded-lg transition-all ${
        active ? "bg-gray-800 text-white" : "text-gray-700 hover:bg-gray-100"
      }`}
      title={title}
    >
      <Icon size={18} />
    </button>
  );
}
