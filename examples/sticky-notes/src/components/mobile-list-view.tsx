import { useState } from "react";
import { Trash2 } from "lucide-react";
import {
  STICKY_NOTE_COLORS,
  type StickyNote as StickyNoteType,
  type AppState,
} from "../types";

interface MobileListViewProps {
  notes: Record<string, StickyNoteType>;
  selectedColor: string;
  onColorChange: (color: string) => void;
  stateProxy: AppState;
}

export function MobileListView({
  notes,
  selectedColor,
  onColorChange,
  stateProxy,
}: MobileListViewProps) {
  const [editingId, setEditingId] = useState<string | null>(null);

  const handleTextChange = (noteId: string, text: string) => {
    if (stateProxy.notes && noteId in stateProxy.notes) {
      stateProxy.notes[noteId].text = text;
    }
  };

  const handleDeleteNote = (noteId: string) => {
    if (stateProxy.notes && noteId in stateProxy.notes) {
      delete stateProxy.notes[noteId];
      if (editingId === noteId) {
        setEditingId(null);
      }
    }
  };

  const handleAddNote = () => {
    if (!stateProxy.notes) {
      stateProxy.notes = {};
      stateProxy.nextZ = 0;
    }

    // Use desktop viewport dimensions (1920x1080) for positioning
    // This ensures notes created on mobile will appear correctly on desktop
    const desktopWidth = 1920;
    const desktopHeight = 1080;
    const noteWidth = 280;
    const noteHeight = 200;
    const maxX = desktopWidth - noteWidth - 20;
    const maxY = desktopHeight - noteHeight - 20;

    const newNote: StickyNoteType = {
      id: crypto.randomUUID(),
      x: Math.max(20, Math.random() * maxX),
      y: Math.max(120, Math.random() * maxY),
      width: noteWidth,
      height: noteHeight,
      color: selectedColor,
      text: "",
      z: stateProxy.nextZ,
    };

    stateProxy.notes[newNote.id] = newNote;
    stateProxy.nextZ += 1;
    setEditingId(newNote.id);

    // Scroll to bottom after a brief delay to let the DOM update
    setTimeout(() => {
      window.scrollTo({
        top: document.documentElement.scrollHeight,
        behavior: "smooth",
      });
    }, 100);
  };

  // Sort notes by z-index (most recent first)
  const sortedNotes = Object.entries(notes).sort(
    ([, a], [, b]) => (b.z || 0) - (a.z || 0),
  );

  return (
    <div className="flex flex-col h-full bg-linear-to-br from-gray-50 to-gray-100">
      {/* Header with color picker */}
      <div className="sticky top-0 z-50 bg-white/95 backdrop-blur-md border-b border-gray-200 shadow-sm">
        <div className="p-4">
          <h1 className="text-lg font-semibold text-gray-800 mb-3">
            Sticky Notes
          </h1>
          <div className="flex gap-2 items-center">
            <span className="text-sm text-gray-600 font-medium">Color:</span>
            <div className="flex gap-2">
              {STICKY_NOTE_COLORS.map((color) => (
                <button
                  key={color.value}
                  onClick={() => onColorChange(color.value)}
                  className={`w-9 h-9 rounded-lg transition-all shadow-sm touch-manipulation ${
                    selectedColor === color.value
                      ? "ring-2 ring-gray-800 scale-110"
                      : "opacity-70 hover:opacity-100 hover:scale-105"
                  }`}
                  style={{ backgroundColor: color.value }}
                  aria-label={`Select ${color.name} color`}
                />
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Notes List */}
      <div className="flex-1 overflow-y-auto pb-24">
        <div className="p-4 space-y-3">
          {sortedNotes.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-400 text-sm">
                No notes yet. Tap &ldquo;Add Note&rdquo; below to create one!
              </p>
            </div>
          ) : (
            sortedNotes.map(([noteId, note]) => (
              <div
                key={noteId}
                className="rounded-xl shadow-md overflow-hidden transition-all"
                style={{ backgroundColor: note.color }}
              >
                <div className="p-4">
                  <div className="flex justify-between items-start mb-2">
                    <div className="text-xs text-gray-500 font-medium">
                      Note
                    </div>
                    <button
                      onClick={() => handleDeleteNote(noteId)}
                      className="p-1.5 rounded-lg bg-red-500 text-white hover:bg-red-600 active:scale-95 transition-all touch-manipulation"
                      aria-label="Delete note"
                    >
                      <Trash2 size={16} strokeWidth={2.5} />
                    </button>
                  </div>
                  <textarea
                    value={note.text}
                    onChange={(e) => handleTextChange(noteId, e.target.value)}
                    onFocus={() => setEditingId(noteId)}
                    onBlur={() => setEditingId(null)}
                    placeholder="Type something..."
                    className="w-full bg-transparent border-none outline-none resize-none font-sans text-base text-gray-800 leading-relaxed placeholder:text-gray-400 min-h-[100px]"
                    style={{ backgroundColor: note.color }}
                  />
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Fixed Add Button at Bottom */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-linear-to-t from-white via-white to-transparent pointer-events-none">
        <button
          onClick={handleAddNote}
          className="w-full py-4 bg-indigo-600 text-white rounded-xl font-semibold text-base shadow-lg hover:bg-indigo-700 active:scale-98 transition-all touch-manipulation pointer-events-auto"
        >
          Add Note
        </button>
      </div>
    </div>
  );
}
