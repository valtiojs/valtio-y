/**
 * Collaborative Drawing App - Main Route
 *
 * This demo showcases valtio-y's unique selling points:
 * 1. **Batching**: Draw with the pen to see hundreds of points batched efficiently
 * 2. **Array Moves**: Drag layers to reorder without fractional indexes
 * 3. **Native API**: Just use JavaScript - no CRDT primitives
 * 4. **Real-time Sync**: Changes sync instantly across all connected clients
 */

import { useEffect, useState, useCallback } from "react";
import type { Route } from "./+types/home";
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
import { Canvas } from "../components/canvas";
import { Toolbar } from "../components/toolbar";
import { LayersPanel } from "../components/layers-panel";
import { PerformanceStats } from "../components/performance-stats";
import { KeyboardShortcutsModal } from "../components/keyboard-shortcuts-modal";
import useYProvider from "y-partyserver/react";
import {
  yDoc,
  ROOM_NAME,
  PARTY_NAME,
  setProvider,
  setupSyncListeners,
  initializeState,
  cleanupUser,
  proxy,
  initUndoManager,
  undo,
  redo,
  canUndo,
  canRedo,
  getSyncStatus,
  subscribeSyncStatus,
  subscribeUndoRedo,
} from "../yjs-setup";
import type { Tool, SyncStatus } from "../types";

// Generate a random user ID and color for this session
const USER_ID = `user-${Math.random().toString(36).substr(2, 9)}`;
const USER_NAME = `User ${Math.floor(Math.random() * 1000)}`;
const USER_COLORS = [
  "#FF6B6B",
  "#4ECDC4",
  "#45B7D1",
  "#FFA07A",
  "#98D8C8",
  "#F7DC6F",
  "#BB8FCE",
];
const USER_COLOR = USER_COLORS[Math.floor(Math.random() * USER_COLORS.length)];

export function meta({}: Route.MetaArgs) {
  return [
    { title: "valtio-y Drawing Demo - Collaborative Whiteboard" },
    {
      name: "description",
      content:
        "Real-time collaborative drawing with valtio-y and Y-PartyServer",
    },
  ];
}

export default function Home() {
  const [initialized, setInitialized] = useState(false);
  const [tool, setTool] = useState<Tool>("pen");
  const [color, setColor] = useState("#000000");
  const [strokeWidth, setStrokeWidth] = useState(4);
  const [fillEnabled, setFillEnabled] = useState(false);
  const [selectedShapeId, setSelectedShapeId] = useState<string>();
  const [undoEnabled, setUndoEnabled] = useState(false);
  const [redoEnabled, setRedoEnabled] = useState(false);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>("offline");
  const [zoom, setZoom] = useState(100);
  const [showKeyboardShortcuts, setShowKeyboardShortcuts] = useState(false);

  // Initialize Yjs provider using the hook
  const provider = useYProvider({
    host: typeof window !== "undefined" && window.location.hostname === "localhost"
      ? "localhost:8788"
      : undefined,
    room: ROOM_NAME,
    party: PARTY_NAME,
    doc: yDoc,
  });

  // Initialize state when provider syncs
  useEffect(() => {
    // Set the provider so other parts of the app can access it
    setProvider(provider);

    // Setup sync listeners
    setupSyncListeners(provider);

    // Wait for initial sync, then initialize state
    const handleSync = (synced: boolean) => {
      if (synced && !initialized) {
        initializeState(USER_ID, USER_NAME, USER_COLOR);
        initUndoManager();
        setInitialized(true);
      }
    };

    provider.on("sync", handleSync);

    // Cleanup on unmount
    return () => {
      provider.off("sync", handleSync);
      cleanupUser();
    };
  }, [provider, initialized]);

  const handleClearCanvas = useCallback(() => {
    if (proxy.shapes) {
      proxy.shapes = [];
    }
  }, []);

  const handleUndo = useCallback(() => {
    undo();
    updateUndoRedoState();
  }, []);

  const handleRedo = useCallback(() => {
    redo();
    updateUndoRedoState();
  }, []);

  const updateUndoRedoState = useCallback(() => {
    setUndoEnabled(canUndo());
    setRedoEnabled(canRedo());
  }, []);

  // Subscribe to undo/redo stack changes
  useEffect(() => {
    const unsubscribe = subscribeUndoRedo(() => {
      updateUndoRedoState();
    });

    // Initial state
    updateUndoRedoState();

    return unsubscribe;
  }, [updateUndoRedoState]);

  // Subscribe to sync status changes
  useEffect(() => {
    setSyncStatus(getSyncStatus());

    const unsubscribe = subscribeSyncStatus(() => {
      setSyncStatus(getSyncStatus());
    });

    return unsubscribe;
  }, []);

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

      // Undo: Ctrl+Z or Cmd+Z
      if ((e.ctrlKey || e.metaKey) && e.key === "z" && !e.shiftKey) {
        e.preventDefault();
        handleUndo();
      }
      // Redo: Ctrl+Y or Cmd+Shift+Z or Ctrl+Shift+Z
      else if (
        ((e.ctrlKey || e.metaKey) && e.key === "y") ||
        ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === "z")
      ) {
        e.preventDefault();
        handleRedo();
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
  }, [handleUndo, handleRedo, showKeyboardShortcuts]);

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

  if (!initialized) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Connecting to collaboration server...</p>
        </div>
      </div>
    );
  }

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
                <strong>Y-PartyServer</strong>
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
                {syncStatus === "connected" ? (
                  <div className="flex items-center gap-2 text-green-600">
                    <Wifi size={20} />
                    <span className="text-sm font-medium">Online</span>
                  </div>
                ) : syncStatus === "syncing" ? (
                  <div className="flex items-center gap-2 text-yellow-600">
                    <Wifi size={20} className="animate-pulse" />
                    <span className="text-sm font-medium">Syncing...</span>
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
                  onClick={handleUndo}
                  disabled={!undoEnabled}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-md border transition-all ${
                    undoEnabled
                      ? "bg-white text-gray-700 border-gray-300 hover:bg-gray-50 hover:border-gray-400"
                      : "bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed"
                  }`}
                  title="Undo (Ctrl+Z)"
                >
                  <Undo2 size={18} />
                  <span className="text-sm font-medium">Undo</span>
                </button>
                <button
                  onClick={handleRedo}
                  disabled={!redoEnabled}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-md border transition-all ${
                    redoEnabled
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
                <p className="text-sm font-medium text-gray-700">{USER_NAME}</p>
                <div className="flex items-center gap-2 justify-end mt-1">
                  <div
                    className="w-4 h-4 rounded-full"
                    style={{ backgroundColor: USER_COLOR }}
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
                  userId={USER_ID}
                  fillEnabled={fillEnabled}
                  selectedShapeId={selectedShapeId}
                  onShapeSelect={setSelectedShapeId}
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
                  <span className="text-sm font-medium text-gray-700 min-w-[4rem] text-center">
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
              />
            </div>
            <PerformanceStats />
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
