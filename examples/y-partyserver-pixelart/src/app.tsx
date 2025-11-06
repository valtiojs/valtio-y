/**
 * Collaborative Pixel Art Editor - Main Application
 *
 * This example demonstrates real-time collaboration using:
 * - valtio-y for reactive state management
 * - Yjs for conflict-free data synchronization
 * - y-partyserver for WebSocket-based networking via PartyKit
 *
 * Features:
 * - Shared 32×32 pixel grid
 * - Drawing tools (pencil, eraser, color picker)
 * - Color palette with custom colors
 * - Real-time cursor tracking (presence layer)
 * - Connection status indicator
 */

import { PixelGrid } from "./components/pixel-grid";
import { ColorPalette } from "./components/color-palette";
import { Toolbar } from "./components/toolbar";
import { ConnectionStatus } from "./components/connection-status";

const App = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-blue-50">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-5xl font-bold text-slate-900 mb-3 tracking-tight">
            🎨 Collaborative Pixel Art
          </h1>
          <p className="text-slate-600 text-base mb-2">
            Powered by <strong>valtio-y</strong> + <strong>PartyKit</strong>
          </p>
          <p className="text-sm text-slate-500 max-w-2xl mx-auto">
            Draw together in real-time! Select a tool, pick a color, and start
            creating. Your changes sync instantly with all connected users.
          </p>
        </div>

        {/* Connection Status */}
        <div className="flex justify-center mb-6">
          <ConnectionStatus />
        </div>

        {/* Main Content */}
        <div className="flex flex-col lg:flex-row gap-6 max-w-7xl mx-auto items-start justify-center">
          {/* Left Sidebar - Tools and Colors */}
          <div className="flex flex-col gap-4 lg:w-64">
            <Toolbar />
            <ColorPalette />
          </div>

          {/* Center - Pixel Grid */}
          <div className="flex-1 flex justify-center">
            <div className="bg-white p-6 rounded-xl shadow-xl border border-slate-200">
              <PixelGrid />
            </div>
          </div>
        </div>

        {/* Educational Footer */}
        <div className="mt-12 max-w-4xl mx-auto bg-white rounded-lg shadow-sm border border-slate-200 p-6">
          <h3 className="text-lg font-semibold text-slate-900 mb-3">
            How This Works
          </h3>
          <div className="space-y-3 text-sm text-slate-600">
            <div>
              <strong className="text-slate-900">Real-time Sync:</strong> All
              changes to the pixel grid are automatically synchronized across
              clients using Yjs CRDTs. Multiple users can draw simultaneously
              without conflicts.
            </div>
            <div>
              <strong className="text-slate-900">Presence Awareness:</strong>{" "}
              See other users' cursors in real-time with their names and colors.
              This uses Yjs Awareness for ephemeral state that doesn't need to
              be persisted.
            </div>
            <div>
              <strong className="text-slate-900">PartyKit Backend:</strong> The
              server runs on PartyKit using y-partyserver, which handles all the
              WebSocket connections and document synchronization automatically.
            </div>
            <div>
              <strong className="text-slate-900">valtio-y Magic:</strong> Write
              to the state like normal JavaScript (
              <code className="bg-slate-100 px-1.5 py-0.5 rounded text-xs">
                proxy.grid.pixels[row][col] = color
              </code>
              ), and valtio-y handles the conversion to Yjs operations.
            </div>
          </div>

          <div className="mt-4 pt-4 border-t border-slate-200">
            <h4 className="text-sm font-semibold text-slate-900 mb-2">
              Quick Tips:
            </h4>
            <ul className="text-xs text-slate-600 space-y-1 list-disc list-inside">
              <li>Click or drag to draw on the canvas</li>
              <li>
                Use the Color Picker tool to sample colors from the canvas
              </li>
              <li>Open this page in multiple tabs to see real-time sync</li>
              <li>The shared PartyKit server persists your drawing</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default App;
