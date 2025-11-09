import { Plus, Trash2, WifiOff, Wifi } from "lucide-react";
import { STICKY_NOTE_COLORS, type SyncStatus } from "../types";

interface ToolbarProps {
  onAddNote: () => void;
  onDeleteNote: () => void;
  selectedColor: string;
  onColorChange: (color: string) => void;
  syncStatus: SyncStatus;
  hasSelection: boolean;
}

export function Toolbar({
  onAddNote,
  onDeleteNote,
  selectedColor,
  onColorChange,
  syncStatus,
  hasSelection,
}: ToolbarProps) {
  return (
    <div className="fixed top-6 left-1/2 -translate-x-1/2 bg-white/95 backdrop-blur-md rounded-2xl shadow-xl py-3 px-4 flex items-center gap-3 z-50 border border-gray-200/50">
      {/* Add Note Button */}
      <button
        onClick={onAddNote}
        className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 active:scale-95 transition-all font-medium shadow-sm hover:shadow-md text-sm flex-shrink-0"
      >
        <Plus size={18} strokeWidth={2.5} />
        Add Note
      </button>

      {/* Divider */}
      <div className="w-px h-8 bg-gray-200 flex-shrink-0" />

      {/* Color Selector */}
      <div className="flex items-center gap-1.5 px-2">
        <div className="flex gap-1.5">
          {STICKY_NOTE_COLORS.map((color) => (
            <button
              key={color.value}
              onClick={() => onColorChange(color.value)}
              className={`w-7 h-7 rounded-lg transition-all hover:scale-105 shadow-sm flex-shrink-0 ${
                selectedColor === color.value
                  ? "ring-2 ring-gray-800 scale-105"
                  : "hover:shadow-md opacity-80 hover:opacity-100"
              }`}
              style={{ backgroundColor: color.value }}
              title={color.name}
              aria-label={`Select ${color.name} color`}
            />
          ))}
        </div>
      </div>

      {/* Divider */}
      <div className="w-px h-8 bg-gray-200" />

      {/* Delete Button */}
      <button
        onClick={onDeleteNote}
        disabled={!hasSelection}
        className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-all font-medium text-sm ${
          hasSelection
            ? "bg-red-500 text-white hover:bg-red-600 active:scale-95 shadow-sm hover:shadow-md"
            : "bg-gray-100 text-gray-400 cursor-not-allowed"
        }`}
        title="Delete selected note"
        aria-label="Delete selected note"
      >
        <Trash2 size={18} strokeWidth={2.5} />
        Delete
      </button>

      {/* Divider */}
      <div className="w-px h-8 bg-gray-200" />

      {/* Sync Status */}
      <div className="flex items-center px-2">
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
