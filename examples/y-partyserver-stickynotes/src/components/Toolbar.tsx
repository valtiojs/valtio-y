import { Plus, Trash2, WifiOff, Wifi } from "lucide-react";
import type { SyncStatus } from "../types";

interface ToolbarProps {
  onAddNote: () => void;
  onDeleteNote: () => void;
  selectedColor: string;
  onColorChange: (color: string) => void;
  syncStatus: SyncStatus;
  hasSelection: boolean;
}

const COLORS = [
  { name: "Yellow", value: "#fef08a" },
  { name: "Red", value: "#fecaca" },
  { name: "Blue", value: "#bfdbfe" },
  { name: "Green", value: "#bbf7d0" },
  { name: "Purple", value: "#e9d5ff" },
  { name: "Pink", value: "#fbcfe8" },
];

export function Toolbar({
  onAddNote,
  onDeleteNote,
  selectedColor,
  onColorChange,
  syncStatus,
  hasSelection,
}: ToolbarProps) {
  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 bg-white/95 backdrop-blur-sm rounded-2xl shadow-2xl px-6 py-3 flex items-center gap-4 z-50 border border-gray-200">
      {/* Add Note Button */}
      <button
        onClick={onAddNote}
        className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium"
      >
        <Plus size={20} />
        Add Note
      </button>

      {/* Color Selector */}
      <div className="flex items-center gap-2 pl-4 border-l border-gray-300">
        <span className="text-sm font-medium text-gray-700">Color:</span>
        <div className="flex gap-2">
          {COLORS.map((color) => (
            <button
              key={color.value}
              onClick={() => onColorChange(color.value)}
              className={`w-8 h-8 rounded-lg transition-all hover:scale-110 ${
                selectedColor === color.value
                  ? "ring-2 ring-offset-2 ring-indigo-600 scale-110"
                  : ""
              }`}
              style={{ backgroundColor: color.value }}
              title={color.name}
            />
          ))}
        </div>
      </div>

      {/* Delete Button */}
      <button
        onClick={onDeleteNote}
        disabled={!hasSelection}
        className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors font-medium ml-2 ${
          hasSelection
            ? "bg-red-600 text-white hover:bg-red-700"
            : "bg-gray-200 text-gray-400 cursor-not-allowed"
        }`}
        title="Delete selected note"
      >
        <Trash2 size={20} />
        Delete
      </button>

      {/* Sync Status */}
      <div className="flex items-center gap-2 pl-4 border-l border-gray-300">
        {syncStatus === "connected" ? (
          <>
            <Wifi size={18} className="text-green-600" />
            <span className="text-sm font-medium text-gray-700">Connected</span>
          </>
        ) : syncStatus === "syncing" ? (
          <>
            <Wifi size={18} className="text-blue-600 animate-pulse" />
            <span className="text-sm font-medium text-gray-700">
              Syncing...
            </span>
          </>
        ) : syncStatus === "connecting" ? (
          <>
            <Wifi size={18} className="text-yellow-600 animate-pulse" />
            <span className="text-sm font-medium text-gray-700">
              Connecting...
            </span>
          </>
        ) : (
          <>
            <WifiOff size={18} className="text-red-600" />
            <span className="text-sm font-medium text-gray-700">
              Disconnected
            </span>
          </>
        )}
      </div>
    </div>
  );
}
