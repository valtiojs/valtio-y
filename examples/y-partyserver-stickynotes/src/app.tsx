import { useEffect, useState } from "react";
import { useSnapshot } from "valtio";
import {
  proxy,
  presenceProxy,
  syncStatusProxy,
  connect,
  setLocalPresence,
} from "./yjs-setup";
import { Toolbar } from "./components/Toolbar";
import { StickyNote } from "./components/StickyNote";
import { Cursor } from "./components/Cursor";
import type { StickyNote as StickyNoteType, UserPresence } from "./types";

export function App() {
  const state = useSnapshot(proxy);
  const presenceStates = useSnapshot(presenceProxy);
  const syncStatus = useSnapshot(syncStatusProxy).status;
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
  const [selectedColor, setSelectedColor] = useState("#fef08a");

  // Connect to Durable Object on mount
  useEffect(() => {
    const roomId = window.location.hash.slice(1) || "default";
    connect(roomId);
  }, []);

  // Track mouse position for presence
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      setLocalPresence({
        cursor: { x: e.clientX, y: e.clientY },
      });
    };

    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, []);

  // Update presence when selection changes
  useEffect(() => {
    setLocalPresence({
      selectedNoteId: selectedNoteId || undefined,
    });
  }, [selectedNoteId]);

  const handleAddNote = () => {
    if (!proxy.notes) {
      proxy.notes = [];
      proxy.nextZ = 0;
    }

    const newNote: StickyNoteType = {
      id: crypto.randomUUID(),
      x: Math.random() * (window.innerWidth - 250) + 50,
      y: Math.random() * (window.innerHeight - 200) + 100,
      width: 200,
      height: 150,
      color: selectedColor,
      text: "New note...",
      z: proxy.nextZ,
    };

    proxy.notes.push(newNote);
    proxy.nextZ += 1;
    setSelectedNoteId(newNote.id);
  };

  const handleDeleteNote = () => {
    if (!selectedNoteId || !proxy.notes) return;

    const index = proxy.notes.findIndex((n) => n.id === selectedNoteId);
    if (index !== -1) {
      proxy.notes.splice(index, 1);
      setSelectedNoteId(null);
    }
  };

  const handleUpdateNote = (id: string, updates: Partial<StickyNoteType>) => {
    if (!proxy.notes) return;

    const index = proxy.notes.findIndex((n) => n.id === id);
    if (index !== -1) {
      const note = proxy.notes[index];
      // Use direct property assignment instead of Object.assign for better Valtio tracking
      if (updates.x !== undefined) note.x = updates.x;
      if (updates.y !== undefined) note.y = updates.y;
      if (updates.width !== undefined) note.width = updates.width;
      if (updates.height !== undefined) note.height = updates.height;
      if (updates.color !== undefined) note.color = updates.color;
      if (updates.text !== undefined) note.text = updates.text;
      if (updates.z !== undefined) note.z = updates.z;
    }
  };

  const handleSelectNote = (id: string) => {
    setSelectedNoteId(id);

    // Bring to front
    if (!proxy.notes) return;

    const note = proxy.notes.find((n) => n.id === id);
    if (note) {
      note.z = proxy.nextZ;
      proxy.nextZ += 1;
    }
  };

  const handleStartDrag = () => {
    setLocalPresence({
      selectedNoteId: selectedNoteId || undefined,
    });
  };

  const handleStartResize = () => {
    setLocalPresence({
      selectedNoteId: selectedNoteId || undefined,
    });
  };

  const handleCanvasClick = () => {
    setSelectedNoteId(null);
  };

  // Find notes being edited by others
  const noteEditStates = new Map<string, { color: string }>();
  Object.values(presenceStates).forEach((presence: UserPresence) => {
    if (presence.editingNoteId) {
      noteEditStates.set(presence.editingNoteId, { color: presence.color });
    }
  });

  return (
    <div className="w-full h-full relative" onClick={handleCanvasClick}>
      {/* Toolbar */}
      <Toolbar
        onAddNote={handleAddNote}
        onDeleteNote={handleDeleteNote}
        selectedColor={selectedColor}
        onColorChange={setSelectedColor}
        syncStatus={syncStatus}
        hasSelection={selectedNoteId !== null}
      />

      {/* Canvas with sticky notes */}
      <div className="w-full h-full overflow-hidden">
        {state.notes?.map((note) => {
          const editState = noteEditStates.get(note.id);
          return (
            <StickyNote
              key={note.id}
              note={note}
              isSelected={selectedNoteId === note.id}
              isEditedByOther={!!editState}
              otherUserColor={editState?.color}
              onSelect={() => handleSelectNote(note.id)}
              onUpdate={(updates) => handleUpdateNote(note.id, updates)}
              onStartDrag={handleStartDrag}
              onStartResize={handleStartResize}
            />
          );
        })}

        {/* Other users' cursors */}
        {Object.entries(presenceStates).map(([clientId, presence]: [string, UserPresence]) => {
          if (!presence.cursor) return null;

          return (
            <Cursor
              key={clientId}
              x={presence.cursor.x}
              y={presence.cursor.y}
              color={presence.color}
              name={presence.name}
            />
          );
        })}
      </div>

      {/* Help text */}
      {(!state.notes || state.notes.length === 0) && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-center text-white/70 pointer-events-none">
          <p className="text-2xl font-semibold mb-2">
            Welcome to Sticky Notes!
          </p>
          <p className="text-lg">Click &quot;Add Note&quot; to get started</p>
        </div>
      )}
    </div>
  );
}
