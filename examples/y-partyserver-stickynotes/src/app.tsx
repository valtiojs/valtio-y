import { useEffect, useState } from "react";
import { useSnapshot } from "valtio";
import useYProvider from "y-partyserver/react";
import {
  doc,
  awareness,
  proxy,
  presenceProxy,
  syncStatusProxy,
  setSyncStatus,
  setLocalPresence,
} from "./yjs-setup";
import { Toolbar } from "./components/Toolbar";
import { StickyNote } from "./components/StickyNote";
import { Cursor } from "./components/Cursor";
import type { StickyNote as StickyNoteType, UserPresence } from "./types";

export function App() {
  const presenceStates = useSnapshot(presenceProxy);
  const syncStatus = useSnapshot(syncStatusProxy).status;
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
  const [selectedColor, setSelectedColor] = useState("#fef08a");

  // Get room from URL hash
  const roomId = window.location.hash.slice(1) || "default";

  // Connect to PartyServer using useYProvider hook
  // Connect directly to the worker (no proxy needed)
  const provider = useYProvider({
    host: "localhost:8787",
    room: roomId,
    doc,
    prefix: "",
    options: {
      awareness,
    },
  });

  console.log("[App] Provider initialized for room:", roomId);

  // Track sync status based on provider events
  useEffect(() => {
    if (!provider) return;

    type ProviderWithConnectionState = typeof provider & {
      wsconnected: boolean;
      wsconnecting: boolean;
    };

    const updateStatus = () => {
      const providerWithState =
        provider as unknown as ProviderWithConnectionState;

      console.log("[App] Provider status:", {
        wsconnected: providerWithState.wsconnected,
        wsconnecting: providerWithState.wsconnecting,
        synced: provider.synced,
      });

      if (providerWithState.wsconnected) {
        setSyncStatus(provider.synced ? "connected" : "syncing");
      } else if (providerWithState.wsconnecting) {
        setSyncStatus("connecting");
      } else {
        setSyncStatus("disconnected");
      }
    };

    // Listen to status changes
    provider.on("status", updateStatus);
    provider.on("sync", (isSynced: boolean) => {
      console.log("[App] Sync event:", isSynced);
      updateStatus();
    });

    // Update status immediately
    updateStatus();

    return () => {
      provider.off("status", updateStatus);
    };
  }, [provider]);

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
      proxy.notes = {};
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

    proxy.notes[newNote.id] = newNote;
    proxy.nextZ += 1;
    setSelectedNoteId(newNote.id);
  };

  const handleDeleteNote = () => {
    if (!selectedNoteId || !proxy.notes) return;

    if (selectedNoteId in proxy.notes) {
      delete proxy.notes[selectedNoteId];
      setSelectedNoteId(null);
    }
  };

  const handleSelectNote = (id: string) => {
    setSelectedNoteId(id);

    // Bring to front
    if (!proxy.notes) return;

    const note = proxy.notes[id];
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
        {proxy.notes &&
          Object.entries(proxy.notes).map(([noteId, note]) => {
            const editState = noteEditStates.get(noteId);
            return (
              <StickyNote
                key={noteId}
                note={note}
                isSelected={selectedNoteId === noteId}
                isEditedByOther={!!editState}
                otherUserColor={editState?.color}
                onSelect={() => handleSelectNote(noteId)}
                onStartDrag={handleStartDrag}
                onStartResize={handleStartResize}
              />
            );
          })}

        {/* Other users' cursors */}
        {Object.entries(presenceStates).map(
          ([clientId, presence]: [string, UserPresence]) => {
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
          },
        )}
      </div>

      {/* Help text */}
      {(!proxy.notes || Object.keys(proxy.notes).length === 0) && (
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
