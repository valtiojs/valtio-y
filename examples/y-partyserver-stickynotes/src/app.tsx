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
import { MobileListView } from "./components/mobile-list-view";
import type { StickyNote as StickyNoteType, UserPresence } from "./types";

export function App() {
  const state = useSnapshot(proxy, { sync: true });
  const presenceStates = useSnapshot(presenceProxy);
  const syncStatus = useSnapshot(syncStatusProxy).status;
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
  const [selectedColor, setSelectedColor] = useState("#fef3c7");

  // Get room from URL hash
  const roomId = window.location.hash.slice(1) || "default";

  // Connect to PartyServer using useYProvider hook
  // Connect to /collab endpoint on the worker
  // Note: y-partyserver automatically uses the correct protocol based on the page
  const provider = useYProvider({
    host: window.location.host,
    room: roomId,
    doc,
    prefix: "/collab",
    options: {
      awareness,
    },
  });


  // Track sync status based on provider events
  useEffect(() => {
    if (!provider) return;

    type ProviderWithConnectionState = typeof provider & {
      wsconnected: boolean;
      wsconnecting: boolean;
      shouldConnect: boolean;
    };

    const updateStatus = () => {
      const providerWithState =
        provider as unknown as ProviderWithConnectionState;

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
    provider.on("sync", updateStatus);

    // Handle connection errors (especially important for mobile Safari)
    provider.on("connection-error", () => {
      setSyncStatus("disconnected");
    });

    provider.on("connection-close", () => {
      setSyncStatus("disconnected");
    });

    // Update status immediately
    updateStatus();

    // Handle iOS Safari backgrounding - reconnect when page becomes visible again
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        const providerWithState =
          provider as unknown as ProviderWithConnectionState;
        if (!providerWithState.wsconnected && providerWithState.shouldConnect) {
          provider.connect();
        }
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      provider.off("status", updateStatus);
      provider.off("connection-error", () => {});
      provider.off("connection-close", () => {});
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [provider]);

  // Track mouse position for presence with throttling (only on desktop with mouse)
  useEffect(() => {
    // Only track cursor on devices with a mouse (fine pointer = mouse/trackpad)
    const hasMouse = window.matchMedia("(pointer: fine)").matches;
    if (!hasMouse) return;

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

    // Use responsive sizing based on screen size
    const isMobile = window.innerWidth < 768;
    const noteWidth = isMobile ? Math.min(window.innerWidth - 40, 280) : 280;
    const noteHeight = isMobile ? 180 : 200;
    const maxX = window.innerWidth - noteWidth - 20;
    const maxY = window.innerHeight - noteHeight - 20;

    const newNote: StickyNoteType = {
      id: crypto.randomUUID(),
      x: Math.max(20, Math.random() * maxX),
      y: Math.max(120, Math.random() * maxY),
      width: noteWidth,
      height: noteHeight,
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
    <>
      {/* Mobile List View (visible on mobile only) */}
      <div className="block md:hidden w-full h-full">
        <MobileListView
          notes={state.notes || {}}
          selectedColor={selectedColor}
          onColorChange={setSelectedColor}
        />
      </div>

      {/* Desktop Canvas View (visible on desktop only) */}
      <div
        className="hidden md:block w-full h-full relative"
        onClick={handleCanvasClick}
      >
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
    </>
  );
}
