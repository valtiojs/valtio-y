/**
 * Collaborative Drawing App
 *
 * This demo showcases valtio-y's unique selling points:
 * 1. **Batching**: Draw with the pen to see hundreds of points batched efficiently
 * 2. **Array Moves**: Drag layers to reorder without fractional indexes
 * 3. **Native API**: Just use JavaScript - no CRDT primitives
 * 4. **Real-time Sync**: Changes sync instantly across all connected clients
 */

import { useEffect, useState, useCallback, useMemo } from "react";
import {
  Undo2,
  Redo2,
  Wifi,
  WifiOff,
  ZoomIn,
  ZoomOut,
  Maximize2,
  HelpCircle,
} from "lucide-react";
import { useSnapshot } from "valtio";
import { Canvas } from "./components/canvas";
import { Toolbar } from "./components/toolbar";
import { LayersPanel } from "./components/layers-panel";
import { PerformanceStats } from "./components/performance-stats";
import { KeyboardShortcutsModal } from "./components/keyboard-shortcuts-modal";
import { useRoomProvider } from "./use-room-provider";
import {
  RoomState,
  PARTY_NAME,
  setSyncStatus,
  initUndoManager,
} from "./yjs-setup";
import type { Tool, SyncStatus } from "./types";
import { useUndoRedo, useSyncStatus } from "./hooks";

// Generate a random user ID and name for this session
const USER_ID = `user-${Math.random().toString(36).substr(2, 9)}`;
const USER_NAME = `User ${Math.floor(Math.random() * 1000)}`;

export function App() {
  const [roomId, setRoomId] = useState<string>(
    () => window.location.hash.slice(1) || "drawing-room",
  );
  const [tool, setTool] = useState<Tool>("pen");
  const [color, setColor] = useState("#fef3c7");
  const [strokeWidth, setStrokeWidth] = useState(4);
  const [fillEnabled, setFillEnabled] = useState(false);
  const [selectedShapeId, setSelectedShapeId] = useState<string>();
  const [zoom, setZoom] = useState(100);
  const [showKeyboardShortcuts, setShowKeyboardShortcuts] = useState(false);
  const [syncStatusState, setSyncStatusState] =
    useState<SyncStatus>("connecting");

  // Use custom hooks for reactive undo/redo and sync status
  const { undo, redo, canUndo, canRedo } = useUndoRedo();
  const syncStatus = useSyncStatus();

  // React to hash changes so switching rooms updates state automatically
  useEffect(() => {
    const handleHashChange = () => {
      const hashRoom = window.location.hash.slice(1) || "drawing-room";
      setRoomId(hashRoom);
    };

    window.addEventListener("hashchange", handleHashChange);
    return () => window.removeEventListener("hashchange", handleHashChange);
  }, []);

  // Create a new RoomState for this room
  const room = useMemo(() => new RoomState(USER_ID, USER_NAME), [roomId]);

  const { doc, awareness, proxy, setLocalPresence } = room;

  const state = useSnapshot(proxy, { sync: true });

  // Connect to PartyServer using custom useRoomProvider hook
  const provider = useRoomProvider({
    host: window.location.host,
    room: roomId,
    party: PARTY_NAME,
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
    setSelectedShapeId(undefined);
    return () => {
      // Provider cleanup happens first (in useRoomProvider)
      // Then we dispose the room
      room.dispose();
    };
  }, [room]);

  // Track sync status based on provider events
  useEffect(() => {
    if (!provider) return;

    setSyncStatus("connecting");
    setSyncStatusState("connecting");

    type ProviderWithConnectionState = typeof provider & {
      wsconnected: boolean;
      wsconnecting: boolean;
      shouldConnect: boolean;
    };

    const updateStatus = () => {
      const providerWithState =
        provider as unknown as ProviderWithConnectionState;

      let status: SyncStatus;
      if (providerWithState.wsconnected) {
        status = provider.synced ? "connected" : "syncing";
      } else if (providerWithState.wsconnecting) {
        status = "connecting";
      } else {
        status = "offline";
      }

      setSyncStatus(status);
      setSyncStatusState(status);
    };

    // Listen to status changes
    provider.on("status", updateStatus);
    provider.on("sync", updateStatus);

    // Handle connection errors (especially important for mobile Safari)
    provider.on("connection-error", () => {
      setSyncStatus("offline");
      setSyncStatusState("offline");
    });

    provider.on("connection-close", () => {
      setSyncStatus("offline");
      setSyncStatusState("offline");
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
      provider.off("sync", updateStatus);
      provider.off("connection-error", () => {});
      provider.off("connection-close", () => {});
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [provider]);

  // Initialize undo manager after provider is ready
  useEffect(() => {
    if (!provider) return;

    let initialized = false;

    const handleSync = (synced: boolean) => {
      if (synced && !initialized) {
        initUndoManager(doc);
        initialized = true;
      }
    };

    provider.on("sync", handleSync);

    return () => {
      provider.off("sync", handleSync);
    };
  }, [provider, doc]);

  const handleClearCanvas = useCallback(() => {
    if (proxy.shapes) {
      proxy.shapes = [];
    }
  }, [proxy]);

  // Delete selected shape
  const handleDeleteShape = useCallback(() => {
    if (selectedShapeId && proxy.shapes) {
      const index = proxy.shapes.findIndex((s) => s.id === selectedShapeId);
      if (index !== -1) {
        proxy.shapes.splice(index, 1);
        setSelectedShapeId(undefined);
      }
    }
  }, [selectedShapeId, proxy]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Show keyboard shortcuts: ? or Shift+/
      if (e.key === "?" || (e.shiftKey && e.key === "/")) {
        e.preventDefault();
        setShowKeyboardShortcuts(true);
        return;
      }

      // Close keyboard shortcuts modal with Escape
      if (e.key === "Escape" && showKeyboardShortcuts) {
        e.preventDefault();
        setShowKeyboardShortcuts(false);
        return;
      }

      // Delete or Backspace key, but not when typing in a textarea or input
      if (
        (e.key === "Delete" || e.key === "Backspace") &&
        selectedShapeId &&
        !(e.target instanceof HTMLTextAreaElement) &&
        !(e.target instanceof HTMLInputElement)
      ) {
        e.preventDefault();
        handleDeleteShape();
        return;
      }

      // Undo: Ctrl+Z or Cmd+Z
      if ((e.ctrlKey || e.metaKey) && e.key === "z" && !e.shiftKey) {
        e.preventDefault();
        undo();
      }
      // Redo: Ctrl+Y or Cmd+Shift+Z or Ctrl+Shift+Z
      else if (
        ((e.ctrlKey || e.metaKey) && e.key === "y") ||
        ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === "z")
      ) {
        e.preventDefault();
        redo();
      }
      // Tool shortcuts
      else if (e.key === "v" || e.key === "V") {
        setTool("select");
      } else if (e.key === "p" || e.key === "P") {
        setTool("pen");
      } else if (e.key === "r" || e.key === "R") {
        setTool("rect");
      } else if (e.key === "c" || e.key === "C") {
        setTool("circle");
      } else if (e.key === "e" || e.key === "E") {
        setTool("eraser");
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [undo, redo, showKeyboardShortcuts, handleDeleteShape, selectedShapeId]);

  // Zoom controls
  const handleZoomIn = useCallback(() => {
    setZoom((prev) => Math.min(prev + 10, 200));
  }, []);

  const handleZoomOut = useCallback(() => {
    setZoom((prev) => Math.max(prev - 10, 50));
  }, []);

  const handleZoomFit = useCallback(() => {
    setZoom(100);
  }, []);

  return (
    <div className="w-full h-screen bg-gray-100 relative overflow-hidden">
      {/* Floating Toolbar - Top Center */}
      <div className="absolute top-6 left-1/2 transform -translate-x-1/2 z-30">
        <Toolbar
          tool={tool}
          onToolChange={setTool}
          color={color}
          onColorChange={setColor}
          strokeWidth={strokeWidth}
          onStrokeWidthChange={setStrokeWidth}
          fillEnabled={fillEnabled}
          onFillToggle={() => setFillEnabled(!fillEnabled)}
          onClearCanvas={handleClearCanvas}
          onUndo={undo}
          onRedo={redo}
          canUndo={canUndo}
          canRedo={canRedo}
          syncStatus={syncStatusState}
        />
      </div>

      {/* User Info Badge - Top Left */}
      <div className="absolute top-6 left-6 z-30">
        <div className="bg-white/90 backdrop-blur-sm rounded-full px-4 py-2 shadow-lg border border-gray-200 flex items-center gap-2">
          <div
            className="w-3 h-3 rounded-full"
            style={{ backgroundColor: room.getUserColor() }}
          />
          <span className="text-sm font-medium text-gray-700">
            {room.getUserName()}
          </span>
        </div>
      </div>

      {/* Help Button - Top Right */}
      <div className="absolute top-6 right-6 z-30">
        <button
          onClick={() => setShowKeyboardShortcuts(true)}
          className="p-3 rounded-full bg-white/90 backdrop-blur-sm shadow-lg border border-gray-200 text-gray-700 hover:bg-white hover:shadow-xl transition-all"
          title="Keyboard shortcuts (?)"
        >
          <HelpCircle size={20} />
        </button>
      </div>

      {/* Full-width Canvas */}
      <div className="w-full h-full flex items-center justify-center overflow-auto">
        <div
          style={{
            transform: `scale(${zoom / 100})`,
            transformOrigin: "center",
            transition: "transform 0.2s ease",
          }}
        >
          <Canvas
            tool={tool}
            color={color}
            strokeWidth={strokeWidth}
            userId={room.getUserId()}
            fillEnabled={fillEnabled}
            selectedShapeId={selectedShapeId}
            onShapeSelect={setSelectedShapeId}
            proxy={proxy}
            awareness={awareness}
            zoom={zoom}
          />
        </div>
      </div>

      {/* Floating Edge Metrics - Bottom Right */}
      <div className="absolute bottom-6 right-6 z-30 max-w-sm">
        <PerformanceStats proxy={proxy} doc={doc} />
      </div>

      {/* Zoom Controls - Bottom Center */}
      <div className="absolute bottom-6 left-1/2 transform -translate-x-1/2 z-30">
        <div className="bg-white/90 backdrop-blur-sm rounded-full px-4 py-2 shadow-lg border border-gray-200 flex items-center gap-2">
          <button
            onClick={handleZoomOut}
            disabled={zoom <= 50}
            className={`p-2 rounded-full transition-all ${
              zoom > 50
                ? "text-gray-700 hover:bg-gray-100"
                : "text-gray-400 cursor-not-allowed"
            }`}
            title="Zoom out"
          >
            <ZoomOut size={18} />
          </button>
          <span className="text-sm font-medium text-gray-700 min-w-16 text-center">
            {zoom}%
          </span>
          <button
            onClick={handleZoomIn}
            disabled={zoom >= 200}
            className={`p-2 rounded-full transition-all ${
              zoom < 200
                ? "text-gray-700 hover:bg-gray-100"
                : "text-gray-400 cursor-not-allowed"
            }`}
            title="Zoom in"
          >
            <ZoomIn size={18} />
          </button>
          <button
            onClick={handleZoomFit}
            className="p-2 rounded-full text-gray-700 hover:bg-gray-100 transition-all"
            title="Fit to view (100%)"
          >
            <Maximize2 size={18} />
          </button>
        </div>
      </div>

      {/* Floating Layers Panel - Bottom Left */}
      <div className="absolute bottom-6 left-6 z-30 max-w-xs">
        <LayersPanel
          onShapeSelect={setSelectedShapeId}
          selectedShapeId={selectedShapeId}
          proxy={proxy}
        />
      </div>

      {/* Keyboard Shortcuts Modal */}
      <KeyboardShortcutsModal
        isOpen={showKeyboardShortcuts}
        onClose={() => setShowKeyboardShortcuts(false)}
      />
    </div>
  );
}
