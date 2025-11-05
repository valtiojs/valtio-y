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
import { Canvas } from "../components/Canvas";
import { Toolbar } from "../components/Toolbar";
import { LayersPanel } from "../components/LayersPanel";
import { PerformanceStats } from "../components/PerformanceStats";
import {
  initProvider,
  setupSyncListeners,
  initializeState,
  proxy,
} from "../yjs-setup";
import type { Tool } from "../types";

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
const USER_COLOR =
  USER_COLORS[Math.floor(Math.random() * USER_COLORS.length)];

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

  // Initialize Yjs provider and state
  useEffect(() => {
    // Initialize provider
    const provider = initProvider();

    // Setup sync listeners
    setupSyncListeners();

    // Wait for initial sync, then initialize state
    provider.on("sync", (synced: boolean) => {
      if (synced && !initialized) {
        initializeState(USER_ID, USER_NAME, USER_COLOR);
        setInitialized(true);
      }
    });

    // Cleanup on unmount
    return () => {
      // Remove user from state when disconnecting
      if (proxy.users?.[USER_ID]) {
        delete proxy.users[USER_ID];
      }
    };
  }, []);

  const handleClearCanvas = useCallback(() => {
    if (proxy.shapes) {
      proxy.shapes = [];
    }
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
                Collaborative whiteboard powered by{" "}
                <strong>valtio-y</strong> + <strong>Y-PartyServer</strong>
              </p>
            </div>
            <div className="text-right">
              <p className="text-sm font-medium text-gray-700">
                {USER_NAME}
              </p>
              <div className="flex items-center gap-2 justify-end mt-1">
                <div
                  className="w-4 h-4 rounded-full"
                  style={{ backgroundColor: USER_COLOR }}
                />
                <span className="text-xs text-gray-500">
                  You
                </span>
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
              <Canvas
                tool={tool}
                color={color}
                strokeWidth={strokeWidth}
                userId={USER_ID}
                fillEnabled={fillEnabled}
              />
              <div className="mt-4 text-center">
                <p className="text-sm text-gray-600">
                  💡 Open this page in multiple windows to see real-time
                  collaboration!
                </p>
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
            What Makes This Demo Special?
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h3 className="text-lg font-semibold text-blue-600 mb-2">
                ⚡ Batching in Action
              </h3>
              <p className="text-sm text-gray-700">
                Use the <strong>pen tool</strong> to draw. As you draw, hundreds
                of points are added to the array. valtio-y batches these
                operations for efficient syncing. Watch the{" "}
                <strong>Batch Size</strong> in the Performance Stats panel!
              </p>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-purple-600 mb-2">
                🔄 Array Moves Without Fractional Indexes
              </h3>
              <p className="text-sm text-gray-700">
                Drag layers in the <strong>Layers Panel</strong> to reorder
                them. Unlike other CRDT libraries, valtio-y doesn't need
                fractional indexes - it handles array reordering natively!
              </p>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-green-600 mb-2">
                🎯 Native JavaScript API
              </h3>
              <p className="text-sm text-gray-700">
                No CRDT primitives needed! Just write normal JavaScript:{" "}
                <code className="bg-gray-100 px-2 py-1 rounded text-xs">
                  proxy.shapes.push(newShape)
                </code>
                . valtio-y handles the CRDT magic behind the scenes.
              </p>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-orange-600 mb-2">
                👥 Real-time Collaboration
              </h3>
              <p className="text-sm text-gray-700">
                Open multiple browser windows to see live cursors and instant
                synchronization. Changes sync automatically through Y-PartyServer
                running on Cloudflare Durable Objects.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
