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
  const [color, setColor] = useState("#000000");
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
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 shadow-sm">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                valtio-y Drawing Demo
              </h1>
              <p className="text-sm text-gray-600 mt-1">
                Collaborative whiteboard powered by <strong>valtio-y</strong> +{" "}
                <strong>Y-PartyServer</strong> • Room: <strong>{roomId}</strong>
              </p>
            </div>

            {/* Undo/Redo and Status Controls */}
            <div className="flex items-center gap-3">
              {/* Help Button */}
              <button
                onClick={() => setShowKeyboardShortcuts(true)}
                className="p-2 rounded-md border bg-white text-gray-700 border-gray-300 hover:bg-gray-50 hover:border-gray-400 transition-all"
                title="Keyboard shortcuts (?)"
              >
                <HelpCircle size={20} />
              </button>

              {/* Connection Status */}
              <div className="flex items-center gap-2 border-r border-gray-300 pr-4">
                {syncStatusState === "connected" ? (
                  <div className="flex items-center gap-2 text-green-600">
                    <Wifi size={20} />
                    <span className="text-sm font-medium">Online</span>
                  </div>
                ) : syncStatusState === "syncing" ? (
                  <div className="flex items-center gap-2 text-yellow-600">
                    <Wifi size={20} className="animate-pulse" />
                    <span className="text-sm font-medium">Syncing...</span>
                  </div>
                ) : syncStatusState === "connecting" ? (
                  <div className="flex items-center gap-2 text-blue-600">
                    <Wifi size={20} className="animate-pulse" />
                    <span className="text-sm font-medium">Connecting...</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-red-600">
                    <WifiOff size={20} />
                    <span className="text-sm font-medium">Offline</span>
                  </div>
                )}
              </div>

              {/* Undo/Redo Buttons */}
              <div className="flex items-center gap-2 border-r border-gray-300 pr-4">
                <button
                  onClick={undo}
                  disabled={!canUndo}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-md border transition-all ${
                    canUndo
                      ? "bg-white text-gray-700 border-gray-300 hover:bg-gray-50 hover:border-gray-400"
                      : "bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed"
                  }`}
                  title="Undo (Ctrl+Z)"
                >
                  <Undo2 size={18} />
                  <span className="text-sm font-medium">Undo</span>
                </button>
                <button
                  onClick={redo}
                  disabled={!canRedo}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-md border transition-all ${
                    canRedo
                      ? "bg-white text-gray-700 border-gray-300 hover:bg-gray-50 hover:border-gray-400"
                      : "bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed"
                  }`}
                  title="Redo (Ctrl+Y)"
                >
                  <Redo2 size={18} />
                  <span className="text-sm font-medium">Redo</span>
                </button>
              </div>

              {/* User Info */}
              <div className="text-right">
                <p className="text-sm font-medium text-gray-700">
                  {room.getUserName()}
                </p>
                <div className="flex items-center gap-2 justify-end mt-1">
                  <div
                    className="w-4 h-4 rounded-full"
                    style={{ backgroundColor: room.getUserColor() }}
                  />
                  <span className="text-xs text-gray-500">You</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="container mx-auto px-6 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Sidebar - Toolbar */}
          <div className="lg:col-span-2">
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
            />
          </div>

          {/* Center - Canvas */}
          <div className="lg:col-span-7">
            <div className="bg-white border border-gray-300 rounded-lg p-4 shadow-lg">
              <div
                className="overflow-hidden"
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
                />
              </div>

              {/* Zoom Controls */}
              <div className="mt-4 flex items-center justify-between">
                <p className="text-sm text-gray-600">
                  💡 Open this page in multiple windows to see real-time
                  collaboration!
                </p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleZoomOut}
                    disabled={zoom <= 50}
                    className={`p-2 rounded-md border transition-all ${
                      zoom > 50
                        ? "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
                        : "bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed"
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
                    className={`p-2 rounded-md border transition-all ${
                      zoom < 200
                        ? "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
                        : "bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed"
                    }`}
                    title="Zoom in"
                  >
                    <ZoomIn size={18} />
                  </button>
                  <button
                    onClick={handleZoomFit}
                    className="p-2 rounded-md border bg-white text-gray-700 border-gray-300 hover:bg-gray-50 transition-all"
                    title="Fit to view (100%)"
                  >
                    <Maximize2 size={18} />
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Right Sidebar - Layers & Stats */}
          <div className="lg:col-span-3 space-y-6">
            <div className="h-96">
              <LayersPanel
                onShapeSelect={setSelectedShapeId}
                selectedShapeId={selectedShapeId}
                proxy={proxy}
              />
            </div>
            <PerformanceStats proxy={proxy} doc={doc} />
          </div>
        </div>

        {/* Educational Footer */}
        <div className="mt-8 bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">
            🎨 Figma-Like Architecture on the Edge
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h3 className="text-lg font-semibold text-blue-600 mb-2">
                👻 Two-Layer Rendering
              </h3>
              <p className="text-sm text-gray-700">
                Draw with the <strong>pen tool</strong>. Your stroke appears
                instantly in a &quot;ghost&quot; layer (ephemeral, not synced).
                Every 200ms or on release, it commits to the CRDT layer
                (persisted). This Figma-style approach delivers 60fps drawing
                with bulletproof sync.
              </p>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-purple-600 mb-2">
                📡 Awareness for Cursors
              </h3>
              <p className="text-sm text-gray-700">
                Live cursors use <strong>Yjs Awareness</strong> - ephemeral
                presence data that&apos;s never persisted. Open two windows to
                see collaborators&apos; cursors in real-time, without bloating
                the CRDT.
              </p>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-green-600 mb-2">
                🌍 Edge-Native CRDTs
              </h3>
              <p className="text-sm text-gray-700">
                Every room = one <strong>Cloudflare Durable Object</strong>{" "}
                holding a Y.Doc. Snapshots save every ~10s. New clients sync by
                sending a state vector and getting only the diff. No backend
                servers - just self-replicating edge state.
              </p>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-orange-600 mb-2">
                ⚡ Sub-50ms Latency
              </h3>
              <p className="text-sm text-gray-700">
                Check the <strong>Edge Metrics</strong> panel for your colo
                (datacenter) and RTT. Drawing operations reach the nearest edge
                in ~20-50ms, then fan out to peers globally. Feels local, works
                global.
              </p>
            </div>
          </div>

          <div className="mt-6 p-4 bg-gradient-to-br from-indigo-50 to-purple-50 border border-indigo-200 rounded-md">
            <h3 className="text-base font-semibold text-indigo-900 mb-2">
              💡 Try This
            </h3>
            <ul className="text-sm text-indigo-800 space-y-1">
              <li>
                • Open this page in 2+ windows - see cursors and strokes sync
                instantly
              </li>
              <li>
                • Draw fast with the pen - watch ghost → committed transition
              </li>
              <li>
                • Drag layers in the panel - no fractional indexes needed!
              </li>
              <li>
                • Turn off Wi-Fi, draw offline, reconnect - automatic merge
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* Keyboard Shortcuts Modal */}
      <KeyboardShortcutsModal
        isOpen={showKeyboardShortcuts}
        onClose={() => setShowKeyboardShortcuts(false)}
      />
    </div>
  );
}
