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
import { Toolbar } from "./components/toolbar";
import { StickyNote } from "./components/sticky-note";
import { Cursor } from "./components/cursor";
import type { StickyNote as StickyNoteType, UserPresence } from "./types";

export function App() {
  const state = useSnapshot(proxy, { sync: true });
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

  // Track mouse position for presence with throttling
  useEffect(() => {
    let rafId: number | null = null;
    let lastEvent: MouseEvent | null = null;

    const updateCursor = () => {
      if (lastEvent) {
        setLocalPresence({
          cursor: { x: lastEvent.clientX, y: lastEvent.clientY },
        });
        lastEvent = null;
      }
      rafId = null;
    };

    const handleMouseMove = (e: MouseEvent) => {
      lastEvent = e;
      if (!rafId) {
        rafId = requestAnimationFrame(updateCursor);
      }
    };

    window.addEventListener("mousemove", handleMouseMove);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      if (rafId) {
        cancelAnimationFrame(rafId);
      }
    };
  }, []);


  // Handle keyboard shortcuts for deleting notes
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Delete or Backspace key, but not when typing in a textarea or input
      if (
        (e.key === "Delete" || e.key === "Backspace") &&
        selectedNoteId &&
        !(e.target instanceof HTMLTextAreaElement) &&
        !(e.target instanceof HTMLInputElement)
      ) {
        e.preventDefault();
        if (proxy.notes && selectedNoteId in proxy.notes) {
          delete proxy.notes[selectedNoteId];
          setSelectedNoteId(null);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
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
      width: 280,
      height: 200,
      color: selectedColor,
      text: "",
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

  const handleCanvasClick = () => {
    setSelectedNoteId(null);
  };

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
        {state.notes &&
          Object.keys(state.notes).map((noteId) => {
            const note = state.notes[noteId];
            return (
              <StickyNote
                key={noteId}
                note={note}
                noteId={noteId}
                isSelected={selectedNoteId === noteId}
                onSelect={() => handleSelectNote(noteId)}
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
    </div>
  );
}
