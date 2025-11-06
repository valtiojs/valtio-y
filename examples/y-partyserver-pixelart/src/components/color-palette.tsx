/**
 * Color Palette Component
 *
 * Displays a palette of colors for the user to select from.
 */

import { useSnapshot } from "valtio";
import { uiState } from "../yjs-setup";

const COLORS = [
  "#000000", // Black
  "#FFFFFF", // White
  "#808080", // Gray
  "#C0C0C0", // Silver
  "#FF0000", // Red
  "#800000", // Maroon
  "#FFFF00", // Yellow
  "#808000", // Olive
  "#00FF00", // Lime
  "#008000", // Green
  "#00FFFF", // Cyan
  "#008080", // Teal
  "#0000FF", // Blue
  "#000080", // Navy
  "#FF00FF", // Magenta
  "#800080", // Purple
  "#FFA500", // Orange
  "#FFC0CB", // Pink
  "#A52A2A", // Brown
  "#D2B48C", // Tan
];

export function ColorPalette() {
  const snap = useSnapshot(uiState);

  return (
    <div className="bg-white rounded-lg shadow-md p-4 border border-slate-200">
      <h3 className="text-sm font-semibold text-slate-700 mb-3">
        Color Palette
      </h3>

      {/* Current color display */}
      <div className="mb-3">
        <div className="flex items-center gap-2">
          <div
            className="w-12 h-12 rounded-lg border-2 border-slate-300 shadow-inner"
            style={{ backgroundColor: snap.selectedColor }}
          />
          <div className="flex-1">
            <div className="text-xs text-slate-600 mb-1">Selected</div>
            <input
              type="text"
              value={snap.selectedColor}
              onChange={(e) => (uiState.selectedColor = e.target.value)}
              className="w-full text-xs font-mono px-2 py-1 border border-slate-300 rounded"
            />
          </div>
        </div>
      </div>

      {/* Color swatches */}
      <div className="grid grid-cols-5 gap-2">
        {COLORS.map((color) => (
          <button
            key={color}
            onClick={() => (uiState.selectedColor = color)}
            className={`w-10 h-10 rounded-lg border-2 transition-all hover:scale-110 hover:shadow-md ${
              snap.selectedColor === color
                ? "border-blue-500 ring-2 ring-blue-300"
                : "border-slate-300"
            }`}
            style={{ backgroundColor: color }}
            title={color}
          />
        ))}
      </div>

      {/* Custom color input */}
      <div className="mt-3 pt-3 border-t border-slate-200">
        <label className="flex items-center gap-2">
          <span className="text-xs text-slate-600">Custom:</span>
          <input
            type="color"
            value={snap.selectedColor}
            onChange={(e) => (uiState.selectedColor = e.target.value)}
            className="h-8 w-full cursor-pointer"
          />
        </label>
      </div>
    </div>
  );
}
