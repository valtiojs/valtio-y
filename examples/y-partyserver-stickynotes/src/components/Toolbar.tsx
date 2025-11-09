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
  { name: "Yellow", value: "#fef3c7" },
  { name: "Peach", value: "#fed7aa" },
  { name: "Blue", value: "#dbeafe" },
  { name: "Green", value: "#d1fae5" },
  { name: "Purple", value: "#e9d5ff" },
  { name: "Pink", value: "#fce7f3" },
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
    <div className="fixed top-6 left-1/2 -translate-x-1/2 bg-white/90 backdrop-blur-md rounded-2xl shadow-xl px-4 py-3.5 flex items-center gap-3 z-50 border border-white/20">
      {/* Add Note Button */}
      <button
        onClick={onAddNote}
        className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 active:scale-95 transition-all font-medium shadow-sm hover:shadow-md"
      >
        <Plus size={18} strokeWidth={2.5} />
        Add Note
      </button>

      {/* Color Selector */}
      <div className="flex items-center gap-2.5 pl-4 border-l border-gray-200/60">
        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
          Color
        </span>
        <div className="flex gap-1.5">
          {COLORS.map((color) => (
            <button
              key={color.value}
              onClick={() => onColorChange(color.value)}
              className={`w-7 h-7 rounded-lg transition-all hover:scale-110 shadow-sm ${
                selectedColor === color.value
                  ? "ring-2 ring-offset-2 ring-indigo-500 scale-110 shadow-md"
                  : "hover:shadow-md"
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
        className={`flex items-center gap-2 px-4 py-2.5 rounded-xl transition-all font-medium ${
          hasSelection
            ? "bg-red-500 text-white hover:bg-red-600 active:scale-95 shadow-sm hover:shadow-md"
            : "bg-gray-100 text-gray-400 cursor-not-allowed"
        }`}
        title="Delete selected note"
      >
        <Trash2 size={18} strokeWidth={2.5} />
        Delete
      </button>

      {/* Sync Status */}
      <div className="flex items-center gap-2 pl-4 border-l border-gray-200/60">
        {syncStatus === "connected" ? (
          <div className="flex items-center gap-2 px-3 py-1.5 bg-green-50 rounded-lg">
            <Wifi size={16} className="text-green-600" strokeWidth={2.5} />
            <span className="text-xs font-semibold text-green-700">
              Connected
            </span>
          </div>
        ) : syncStatus === "syncing" ? (
          <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 rounded-lg">
            <Wifi
              size={16}
              className="text-blue-600 animate-pulse"
              strokeWidth={2.5}
            />
            <span className="text-xs font-semibold text-blue-700">
              Syncing...
            </span>
          </div>
        ) : syncStatus === "connecting" ? (
          <div className="flex items-center gap-2 px-3 py-1.5 bg-amber-50 rounded-lg">
            <Wifi
              size={16}
              className="text-amber-600 animate-pulse"
              strokeWidth={2.5}
            />
            <span className="text-xs font-semibold text-amber-700">
              Connecting...
            </span>
          </div>
        ) : (
          <div className="flex items-center gap-2 px-3 py-1.5 bg-red-50 rounded-lg">
            <WifiOff size={16} className="text-red-600" strokeWidth={2.5} />
            <span className="text-xs font-semibold text-red-700">
              Disconnected
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
