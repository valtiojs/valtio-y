/**
 * Toolbar Component - Drawing tool selection and style controls
 *
 * Provides:
 * - Tool selection (pen, rect, circle, select, eraser)
 * - Color picker
 * - Stroke width control
 * - Fill toggle
 * - Clear canvas action
 */

import {
  Pencil,
  Square,
  Circle,
  MousePointer,
  Eraser,
  Trash2,
} from "lucide-react";
import type { Tool } from "../types";

interface ToolbarProps {
  tool: Tool;
  onToolChange: (tool: Tool) => void;
  color: string;
  onColorChange: (color: string) => void;
  strokeWidth: number;
  onStrokeWidthChange: (width: number) => void;
  fillEnabled: boolean;
  onFillToggle: () => void;
  onClearCanvas: () => void;
}

const COLORS = [
  "#000000", // Black
  "#FF0000", // Red
  "#00FF00", // Green
  "#0000FF", // Blue
  "#FFFF00", // Yellow
  "#FF00FF", // Magenta
  "#00FFFF", // Cyan
  "#FFA500", // Orange
  "#800080", // Purple
  "#FFC0CB", // Pink
];

const STROKE_WIDTHS = [2, 4, 8, 16, 32];

export function Toolbar({
  tool,
  onToolChange,
  color,
  onColorChange,
  strokeWidth,
  onStrokeWidthChange,
  fillEnabled,
  onFillToggle,
  onClearCanvas,
}: ToolbarProps) {
  return (
    <div className="bg-white border border-gray-300 rounded-lg p-4 shadow-lg">
      {/* Tool Selection */}
      <div className="mb-6">
        <h3 className="text-sm font-semibold text-gray-700 mb-2">Tools</h3>
        <div className="flex gap-2">
          <ToolButton
            icon={MousePointer}
            label="Select"
            active={tool === "select"}
            onClick={() => onToolChange("select")}
          />
          <ToolButton
            icon={Pencil}
            label="Pen"
            active={tool === "pen"}
            onClick={() => onToolChange("pen")}
          />
          <ToolButton
            icon={Square}
            label="Rectangle"
            active={tool === "rect"}
            onClick={() => onToolChange("rect")}
          />
          <ToolButton
            icon={Circle}
            label="Circle"
            active={tool === "circle"}
            onClick={() => onToolChange("circle")}
          />
          <ToolButton
            icon={Eraser}
            label="Eraser"
            active={tool === "eraser"}
            onClick={() => onToolChange("eraser")}
          />
        </div>
      </div>

      {/* Color Picker */}
      <div className="mb-6">
        <h3 className="text-sm font-semibold text-gray-700 mb-2">Color</h3>
        <div className="flex flex-wrap gap-2">
          {COLORS.map((c) => (
            <button
              key={c}
              className={`w-8 h-8 rounded-md border-2 transition-all ${
                color === c
                  ? "border-blue-500 scale-110"
                  : "border-gray-300 hover:scale-105"
              }`}
              style={{ backgroundColor: c }}
              onClick={() => onColorChange(c)}
              title={c}
            />
          ))}
        </div>
      </div>

      {/* Stroke Width */}
      <div className="mb-6">
        <h3 className="text-sm font-semibold text-gray-700 mb-2">
          Stroke Width
        </h3>
        <div className="flex gap-2">
          {STROKE_WIDTHS.map((width) => (
            <button
              key={width}
              className={`px-3 py-2 rounded-md border text-sm font-medium transition-colors ${
                strokeWidth === width
                  ? "bg-blue-500 text-white border-blue-600"
                  : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
              }`}
              onClick={() => onStrokeWidthChange(width)}
            >
              {width}px
            </button>
          ))}
        </div>
      </div>

      {/* Fill Toggle */}
      <div className="mb-6">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={fillEnabled}
            onChange={onFillToggle}
            className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          />
          <span className="text-sm font-medium text-gray-700">
            Fill shapes
          </span>
        </label>
      </div>

      {/* Clear Canvas */}
      <div>
        <button
          onClick={onClearCanvas}
          className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-red-500 text-white rounded-md hover:bg-red-600 transition-colors font-medium"
        >
          <Trash2 size={16} />
          Clear Canvas
        </button>
      </div>
    </div>
  );
}

// ============================================================================
// TOOL BUTTON COMPONENT
// ============================================================================

interface ToolButtonProps {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  label: string;
  active: boolean;
  onClick: () => void;
}

function ToolButton({ icon: Icon, label, active, onClick }: ToolButtonProps) {
  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-center gap-1 px-3 py-2 rounded-md border transition-colors ${
        active
          ? "bg-blue-500 text-white border-blue-600"
          : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
      }`}
      title={label}
    >
      <Icon size={20} />
      <span className="text-xs font-medium">{label}</span>
    </button>
  );
}
