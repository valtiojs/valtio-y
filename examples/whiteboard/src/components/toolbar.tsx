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
    <div className="bg-white border border-gray-300 rounded-lg p-5 shadow-lg space-y-8">
      {/* Tool Selection */}
      <div>
        <h3 className="text-sm font-semibold text-gray-700 mb-3">Tools</h3>
        <div className="flex gap-2">
          <ToolButton
            icon={MousePointer}
            label="Select"
            shortcut="V"
            active={tool === "select"}
            onClick={() => onToolChange("select")}
          />
          <ToolButton
            icon={Pencil}
            label="Pen"
            shortcut="P"
            active={tool === "pen"}
            onClick={() => onToolChange("pen")}
          />
          <ToolButton
            icon={Square}
            label="Rectangle"
            shortcut="R"
            active={tool === "rect"}
            onClick={() => onToolChange("rect")}
          />
          <ToolButton
            icon={Circle}
            label="Circle"
            shortcut="C"
            active={tool === "circle"}
            onClick={() => onToolChange("circle")}
          />
          <ToolButton
            icon={Eraser}
            label="Eraser"
            shortcut="E"
            active={tool === "eraser"}
            onClick={() => onToolChange("eraser")}
          />
        </div>
      </div>

      {/* Color Picker */}
      <div>
        <h3 className="text-sm font-semibold text-gray-700 mb-3">Color</h3>
        <div className="grid grid-cols-5 gap-2.5">
          {COLORS.map((c) => (
            <button
              key={c}
              className={`w-10 h-10 rounded-lg border-3 transition-all duration-200 ${
                color === c
                  ? "border-blue-500 scale-110 shadow-lg ring-2 ring-blue-200"
                  : "border-gray-300 hover:scale-105 hover:border-gray-400 hover:shadow-md"
              }`}
              style={{ backgroundColor: c }}
              onClick={() => onColorChange(c)}
              title={c}
            />
          ))}
        </div>
      </div>

      {/* Stroke Width */}
      <div>
        <h3 className="text-sm font-semibold text-gray-700 mb-3">
          Stroke Width
        </h3>
        <div className="flex gap-2">
          {STROKE_WIDTHS.map((width) => (
            <button
              key={width}
              className={`px-3 py-2 rounded-md border text-sm font-medium transition-all duration-200 ${
                strokeWidth === width
                  ? "bg-blue-500 text-white border-blue-600 shadow-md"
                  : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50 hover:border-gray-400"
              }`}
              onClick={() => onStrokeWidthChange(width)}
              title={`${width}px stroke`}
            >
              {width}px
            </button>
          ))}
        </div>
      </div>

      {/* Fill Toggle */}
      <div>
        <label className="flex items-center gap-2.5 cursor-pointer p-2 rounded-md hover:bg-gray-50 transition-colors">
          <input
            type="checkbox"
            checked={fillEnabled}
            onChange={onFillToggle}
            className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          />
          <span className="text-sm font-medium text-gray-700">Fill shapes</span>
        </label>
      </div>

      {/* Clear Canvas */}
      <div>
        <button
          onClick={onClearCanvas}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-red-500 text-white rounded-md hover:bg-red-600 transition-all duration-200 font-medium shadow-sm hover:shadow-md"
          title="Clear all shapes from canvas"
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
  shortcut?: string;
  active: boolean;
  onClick: () => void;
}

function ToolButton({
  icon: Icon,
  label,
  shortcut,
  active,
  onClick,
}: ToolButtonProps) {
  const tooltipText = shortcut ? `${label} (${shortcut})` : label;

  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-center gap-1 px-3 py-2 rounded-md border transition-all duration-200 ${
        active
          ? "bg-blue-500 text-white border-blue-600 shadow-md"
          : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50 hover:border-gray-400 hover:shadow-sm"
      }`}
      title={tooltipText}
    >
      <Icon size={20} />
      <span className="text-xs font-medium">{label}</span>
    </button>
  );
}
