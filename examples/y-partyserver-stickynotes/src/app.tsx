import { useEffect, useMemo, useState } from "react";
import { useSnapshot } from "valtio";
import { useRoomProvider } from "./use-room-provider";
import { RoomState } from "./yjs-setup";
import { Toolbar } from "./components/toolbar";
import { StickyNote } from "./components/sticky-note";
import { Cursor } from "./components/cursor";
import { MobileListView } from "./components/mobile-list-view";
import type {
  StickyNote as StickyNoteType,
  UserPresence,
  SyncStatus,
} from "./types";

export function App() {
  const [roomId, setRoomId] = useState<string>(
    () => window.location.hash.slice(1) || "default",
  );
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
  const [selectedColor, setSelectedColor] = useState("#fef3c7");
  const [syncStatus, setSyncStatusState] = useState<SyncStatus>("connecting");
  const [presenceStates, setPresenceStates] = useState<
    Record<number, UserPresence>
  >({});

  // React to hash changes so switching rooms updates state automatically
  useEffect(() => {
    const handleHashChange = () => {
      const hashRoom = window.location.hash.slice(1) || "default";
      setRoomId(hashRoom);
    };

    window.addEventListener("hashchange", handleHashChange);
    return () => window.removeEventListener("hashchange", handleHashChange);
  }, []);

  const room = useMemo(() => new RoomState(), [roomId]);

  const { doc, awareness, proxy, setLocalPresence } = room;

  const state = useSnapshot(proxy, { sync: true });

  // Connect to PartyServer using useYProvider hook
  // Connect using y-partyserver defaults: /parties/:party/:room.
  const provider = useRoomProvider({
    host: window.location.host,
    room: roomId,
    party: "stickynotes-do",
    doc,
    options: useMemo(
      () => ({
        awareness,
      }),
      [awareness],
    ),
  });

  // Cleanup: dispose room when component unmounts or room changes
  useEffect(() => {
    setSelectedNoteId(null);
    return () => {
      // Provider cleanup happens first (in useRoomProvider)
      // Then we dispose the room
      room.dispose();
    };
  }, [room]);

  // Track sync status based on provider events
  useEffect(() => {
    if (!provider) return;

    setSyncStatusState("connecting");

    type ProviderWithConnectionState = typeof provider & {
      wsconnected: boolean;
      wsconnecting: boolean;
      shouldConnect: boolean;
    };

    const updateStatus = () => {
      const providerWithState =
        provider as unknown as ProviderWithConnectionState;

      if (providerWithState.wsconnected) {
        setSyncStatusState(provider.synced ? "connected" : "syncing");
      } else if (providerWithState.wsconnecting) {
        setSyncStatusState("connecting");
      } else {
        setSyncStatusState("disconnected");
      }
    };

    // Listen to status changes
    provider.on("status", updateStatus);
    provider.on("sync", updateStatus);

    // Handle connection errors (especially important for mobile Safari)
    provider.on("connection-error", () => {
      setSyncStatusState("disconnected");
    });

    provider.on("connection-close", () => {
      setSyncStatusState("disconnected");
    });

    // Update status immediately
    updateStatus();

    // Handle iOS Safari backgrounding - reconnect when page becomes visible again
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        const providerWithState =
          provider as unknown as ProviderWithConnectionState;
        if (!providerWithState.wsconnected && providerWithState.shouldConnect) {
          void provider.connect();
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

  // Track awareness presence states (excluding local client)
  useEffect(() => {
    setPresenceStates({});

    const updatePresence = () => {
      const states = awareness.getStates() as Map<
        number,
        { user?: UserPresence }
      >;
      const next: Record<number, UserPresence> = {};

      states.forEach((state, clientId) => {
        if (clientId !== doc.clientID && state.user) {
          next[clientId] = state.user;
        }
      });

      setPresenceStates(next);
    };

    awareness.on("change", updatePresence);
    updatePresence();

    return () => {
      awareness.off("change", updatePresence);
    };
  }, [awareness, doc]);

  // Ensure local presence is initialized for the current room
  useEffect(() => {
    setLocalPresence({});
  }, [setLocalPresence]);

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
  }, [setLocalPresence]);

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
  }, [selectedNoteId, proxy]);

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
          stateProxy={proxy}
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
                  stateProxy={proxy}
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
